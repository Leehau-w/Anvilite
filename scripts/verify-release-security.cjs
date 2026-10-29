const fs = require('node:fs')
const path = require('node:path')
const { createHash } = require('node:crypto')
const { execFileSync, spawn } = require('node:child_process')

const root = path.resolve(__dirname, '..')
const release = path.join(root, 'release')
const scanTimeoutMs = 20 * 60 * 1000

function validateScanResult(code, stdout, stderr = '') {
  if (code !== 0) throw new Error('Defender scan failed or detected a threat (exit ' + code + ').')
  const output = stdout + '\n' + stderr
  if (!/^Scanning .+ found no threats\.\s*$/im.test(output)
    || /\bThreat(?:\s*Name)?\s*:\s*\S/i.test(output)
    || /\bfound\s+[1-9]\d*\s+threats?\b/i.test(output)) {
    throw new Error('Defender did not provide an unambiguous no-threat result; review the scan log.')
  }
}

function inside(directory, file) {
  const relative = path.relative(directory, file)
  return relative !== '' && !relative.startsWith('..' + path.sep) && relative !== '..' && !path.isAbsolute(relative)
}

function redact(value) {
  return String(value).split(root).join('<workspace>').replace(/https?:\/\/\S+/gi, '<URL omitted>')
}

function powershell(source) {
  const executable = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32/WindowsPowerShell/v1.0/powershell.exe')
  return execFileSync(executable, ['-NoProfile', '-NonInteractive', '-Command', "$ErrorActionPreference = 'Stop'; Import-Module (Join-Path $PSHOME 'Modules/Microsoft.PowerShell.Security/Microsoft.PowerShell.Security.psd1'); " + source],
    { encoding: 'utf8', windowsHide: true, timeout: 30000, maxBuffer: 1024 * 1024 }).replace(/^\uFEFF/, '').trim()
}

function defenderState() {
  const state = JSON.parse(powershell([
    "$s = Get-CimInstance -Namespace 'root/Microsoft/Windows/Defender' -ClassName MSFT_MpComputerStatus;",
    '[PSCustomObject]@{',
    'AMProductVersion=$s.AMProductVersion;',
    'AMEngineVersion=$s.AMEngineVersion;',
    'AntivirusEnabled=$s.AntivirusEnabled;',
    'RealTimeProtectionEnabled=$s.RealTimeProtectionEnabled;',
    'AntivirusSignatureVersion=$s.AntivirusSignatureVersion;',
    "AntivirusSignatureLastUpdated=if ($s.AntivirusSignatureLastUpdated) { $s.AntivirusSignatureLastUpdated.ToUniversalTime().ToString('o') } else { $null }",
    '} | ConvertTo-Json -Compress',
  ].join(' ')))
  if (state.AntivirusEnabled !== true || state.RealTimeProtectionEnabled !== true) {
    throw new Error('Microsoft Defender Antivirus and real-time protection must both be enabled.')
  }
  if (!state.AMEngineVersion || !state.AntivirusSignatureVersion) throw new Error('Defender engine or signature version unavailable.')
  const updated = Date.parse(state.AntivirusSignatureLastUpdated)
  if (!Number.isFinite(updated) || Date.now() - updated > 48 * 60 * 60 * 1000) {
    throw new Error('Defender security intelligence is unavailable or older than 48 hours; update it before scanning.')
  }
  return state
}

function scannerPath() {
  const platform = path.join(process.env.ProgramData || 'C:\\ProgramData', 'Microsoft/Windows Defender/Platform')
  const candidates = [path.join(platform, 'CurrentVersion/MpCmdRun.exe')]
  if (fs.existsSync(platform)) {
    const versions = fs.readdirSync(platform, { withFileTypes: true })
      .filter(entry => entry.isDirectory() && /^\d+\.\d+\.\d+\.\d+-\d+$/.test(entry.name))
      .map(entry => entry.name)
      .sort((a, b) => b.localeCompare(a, undefined, { numeric: true }))
    for (const version of versions) candidates.push(path.join(platform, version, 'MpCmdRun.exe'))
  }
  candidates.push(path.join(process.env.ProgramFiles || 'C:\\Program Files', 'Windows Defender/MpCmdRun.exe'))
  const executable = candidates.find(file => fs.existsSync(file) && fs.statSync(file).isFile())
  if (!executable) throw new Error('Microsoft Defender MpCmdRun.exe was not found.')
  const quoted = executable.replaceAll("'", "''")
  const signature = JSON.parse(powershell([
    "$s = Get-AuthenticodeSignature -LiteralPath '" + quoted + "';",
    '[PSCustomObject]@{Status=[string]$s.Status; Subject=$s.SignerCertificate.Subject} | ConvertTo-Json -Compress',
  ].join(' ')))
  if (signature.Status !== 'Valid' || !/(?:^|,\s*)(?:CN|O)=Microsoft Corporation(?:,|$)/i.test(signature.Subject || '')) {
    throw new Error('The Defender scan executable does not have a valid Microsoft Corporation signature.')
  }
  return { executable, signature }
}

async function sha256(file) {
  const hash = createHash('sha256')
  for await (const chunk of fs.createReadStream(file)) hash.update(chunk)
  return hash.digest('hex')
}

function scan(executable, target) {
  return new Promise((resolve, reject) => {
    // Diagnostic mode scans archives, ignores exclusions and leaves protection settings unchanged.
    const child = spawn(executable, ['-Scan', '-ScanType', '3', '-File', target, '-DisableRemediation'],
      { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] })
    let stdout = '', stderr = '', timedOut = false
    const timer = setTimeout(() => { timedOut = true; child.kill() }, scanTimeoutMs)
    child.stdout.setEncoding('utf8').on('data', chunk => { stdout += chunk })
    child.stderr.setEncoding('utf8').on('data', chunk => { stderr += chunk })
    child.once('error', error => { clearTimeout(timer); reject(error) })
    child.once('close', (code, signal) => { clearTimeout(timer); resolve({ code, signal, timedOut, stdout, stderr }) })
  })
}

async function main() {
  if (process.argv.length > 2) {
    if (process.argv.length === 3 && process.argv[2] === '--help') {
      console.log('Usage: node scripts/verify-release-security.cjs\nScans this version\'s unpacked app, Setup and portable exe with Microsoft Defender.\nRequires enabled protection and current signatures. Detection, error or missing evidence blocks release.\nNo installers are executed and no protection settings or exclusions are changed.')
      return
    }
    throw new Error('Unknown arguments. Use --help; scan targets cannot be overridden.')
  }
  if (process.platform !== 'win32') throw new Error('Windows and Microsoft Defender are required; release security verification cannot be skipped.')
  const { version } = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'))
  if (!/^\d+\.\d+\.\d+(?:[-+][\w.-]+)?$/.test(version)) throw new Error('Unexpected application version.')
  if (!fs.existsSync(release) || !inside(fs.realpathSync(root), fs.realpathSync(release))) {
    throw new Error('The release directory must already exist inside this workspace.')
  }
  const reportFile = path.join(release, 'security-scan-v' + version + '.json')
  const logDirectory = path.join(release, 'security-v' + version)
  if (fs.existsSync(logDirectory) && !inside(fs.realpathSync(release), fs.realpathSync(logDirectory))) {
    throw new Error('Security log directory resolves outside release.')
  }
  if (fs.existsSync(reportFile) && !inside(fs.realpathSync(release), fs.realpathSync(reportFile))) {
    throw new Error('Security report resolves outside release.')
  }
  fs.mkdirSync(logDirectory, { recursive: true })
  const report = {
    version, startedAt: new Date().toISOString(), status: 'failed', scans: [], assets: [],
    method: 'Microsoft Defender custom diagnostic scan; file exclusions ignored and archives scanned.',
    protectionSettingsChanged: false,
    codeSigning: 'This script does not sign files. A no-threat result is scoped to the recorded scan and is not proof of absolute safety or publisher trust.',
  }
  const saveReport = () => fs.writeFileSync(reportFile, JSON.stringify(report, null, 2) + '\n')
  saveReport()
  try {
    const targets = [
      { name: 'win-unpacked', directory: true },
      { name: 'Anvilite-Setup-' + version + '.exe', directory: false },
      { name: 'Anvilite-' + version + '-portable.exe', directory: false },
    ]
    const assetNames = targets.filter(target => !target.directory).map(target => target.name)
    assetNames.push('Anvilite-Setup-' + version + '.exe.blockmap')
    const before = new Map()
    for (const name of [...targets.map(target => target.name), assetNames.at(-1)]) {
      const file = path.join(release, name)
      if (!fs.existsSync(file) || !inside(fs.realpathSync(release), fs.realpathSync(file))) throw new Error('Release target missing or outside release: ' + name)
      const stat = fs.statSync(file)
      const target = targets.find(item => item.name === name)
      if (target?.directory ? !stat.isDirectory() : !stat.isFile()) throw new Error('Unexpected release target type: ' + name)
      before.set(name, { size: stat.size, mtimeMs: stat.mtimeMs })
    }
    report.defenderBefore = defenderState()
    const scanner = scannerPath()
    report.scanner = { name: 'MpCmdRun.exe', signer: scanner.signature.Subject, signatureStatus: scanner.signature.Status }
    saveReport()
    for (const target of targets) {
      console.log('[release-security] Scanning ' + target.name)
      const startedAt = new Date().toISOString()
      const result = await scan(scanner.executable, path.join(release, target.name))
      const logName = target.name.replaceAll('.', '-') + '.log'
      const logFile = path.join(logDirectory, logName)
      if (fs.existsSync(logFile) && !inside(fs.realpathSync(release), fs.realpathSync(logFile))) throw new Error('Scan log resolves outside release.')
      fs.writeFileSync(logFile, redact(result.stdout + '\n' + result.stderr))
      const record = { target: target.name, startedAt, finishedAt: new Date().toISOString(), exitCode: result.code,
        signal: result.signal, timedOut: result.timedOut, status: 'failed', log: path.relative(release, path.join(logDirectory, logName)).replaceAll('\\', '/') }
      report.scans.push(record)
      saveReport()
      if (result.timedOut || result.signal) throw new Error('Defender scan did not complete for ' + target.name)
      validateScanResult(result.code, result.stdout, result.stderr)
      record.status = 'no-threats-found'
      saveReport()
    }
    report.defenderAfter = defenderState()
    for (const name of assetNames) {
      const file = path.join(release, name), stat = fs.statSync(file), previous = before.get(name)
      if (!stat.isFile() || stat.size !== previous.size || stat.mtimeMs !== previous.mtimeMs) throw new Error('Release asset changed during security verification: ' + name)
      report.assets.push({ name, size: stat.size, sha256: await sha256(file) })
    }
    report.status = 'no-threats-found'
    report.finishedAt = new Date().toISOString()
    saveReport()
    console.log('[release-security] All release scans completed without detected threats. Report: release/' + path.basename(reportFile))
  } catch (error) {
    report.error = redact(error.message)
    report.finishedAt = new Date().toISOString()
    saveReport()
    throw error
  }
}

module.exports = { validateScanResult }
if (require.main === module) main().catch(error => { console.error('[release-security] BLOCKED: ' + redact(error.message)); process.exitCode = 1 })
