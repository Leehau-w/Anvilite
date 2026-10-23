const fs = require('node:fs')
const path = require('node:path')
const os = require('node:os')
const assert = require('node:assert/strict')
const { createRequire } = require('node:module')
const { pathToFileURL } = require('node:url')
const { createHash, randomUUID } = require('node:crypto')
const { execFileSync } = require('node:child_process')
const { _electron } = require('playwright')
const asar = require('@electron/asar')

const root = path.resolve(__dirname, '../..')
const version = require(path.join(root, 'package.json')).version
const output = path.join(__dirname, 'release-' + version)
const packed = path.resolve(process.argv[2] || path.join(root, 'release/win-unpacked'))
const sevenZip = path.join(root, 'node_modules/7zip-bin/win/x64/7za.exe')
const hash = file => createHash('sha256').update(fs.readFileSync(file)).digest('hex')
const walk = directory => fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => entry.isDirectory()
  ? walk(path.join(directory, entry.name)) : [path.join(directory, entry.name)])
const ok = result => { assert.equal(result?.ok, true, JSON.stringify(result)); return result.data }

async function main() {
  fs.mkdirSync(output, { recursive: true })
  const sourceAsar = path.join(packed, 'resources/app.asar')
  const metadata = JSON.parse(asar.extractFile(sourceAsar, 'package.json').toString())
  assert.equal(metadata.version, version)
  assert.equal(metadata.name, 'anvilite')
  assert.equal(metadata.productName || require(path.join(root, 'electron-builder.json')).productName, 'Anvilite')
  const notices = fs.readFileSync(path.join(packed, 'resources/mcp/THIRD-PARTY-NOTICES.txt'), 'utf8')
  for (const name of ['@modelcontextprotocol/server@2.3.1', '@modelcontextprotocol/core@2.3.1', 'zod@4.6.7', 'Apache License', 'MIT License']) assert.ok(notices.includes(name))
  const files = ['Anvilite.exe', 'resources/app.asar', 'resources/mcp/server.cjs', 'resources/mcp/THIRD-PARTY-NOTICES.txt']
  const run = path.join(output, 'run-' + randomUUID())
  fs.mkdirSync(run)
  const reference = Object.fromEntries(files.map(file => [file, hash(path.join(packed, file))]))
  const artifacts = []
  for (const file of fs.readdirSync(path.join(root, 'release')).filter(file =>
    file.endsWith('.exe') && file.includes(version))) {
    const artifact = path.join(root, 'release', file)
    const extracted = path.join(run, 'extracted-' + file.replace(/\.exe$/, ''))
    assert.equal(fs.existsSync(extracted), false, 'Use a fresh output directory for extraction')
    fs.mkdirSync(extracted)
    execFileSync(sevenZip, ['x', '-y', '-o' + extracted, artifact], { stdio: 'pipe' })
    let payload = walk(extracted).find(file => file.endsWith('app.asar'))
    if (!payload) {
      const archive = walk(extracted).find(file => /app.*\.7z$/i.test(file))
      assert.ok(archive, 'NSIS embedded application archive missing: ' + path.basename(artifact))
      const unpacked = path.join(extracted, 'application')
      fs.mkdirSync(unpacked)
      execFileSync(sevenZip, ['x', '-y', '-o' + unpacked, archive], { stdio: 'pipe' })
      payload = walk(unpacked).find(file => file.endsWith('app.asar'))
    }
    assert.ok(payload, 'Installer application payload missing')
    const payloadRoot = path.dirname(path.dirname(payload))
    for (const relative of files) assert.equal(hash(path.join(payloadRoot, relative)), reference[relative], file + ': ' + relative)
    artifacts.push({ name: file, sha256: hash(artifact), payloadMatchesPackagedApplication: true })
  }
  assert.ok(artifacts.some(item => item.name.includes('Setup')), 'Setup artifact missing')
  assert.ok(artifacts.some(item => item.name.includes('portable')), 'Portable artifact missing')

  // The production installer would upgrade the user's registered v0.3.3 installation.
  // Audit a byte-identical copied payload instead; only its startup manifest is instrumented.
  const runtime = path.join(run, 'runtime')
  assert.equal(fs.existsSync(runtime), false, 'Use a fresh output directory for runtime audit')
  fs.cpSync(packed, runtime, { recursive: true })
  const businessAsar = path.join(runtime, 'resources/business.asar')
  fs.renameSync(path.join(runtime, 'resources/app.asar'), businessAsar)
  const bootstrapFolder = path.join(runtime, 'resources/app')
  fs.mkdirSync(bootstrapFolder)
  fs.writeFileSync(path.join(bootstrapFolder, 'package.json'), JSON.stringify({ ...metadata, main: 'audit-bootstrap.cjs' }))
  fs.writeFileSync(path.join(bootstrapFolder, 'audit-bootstrap.cjs'), [
    "const { app } = require('electron')",
    "const fs = require('node:fs'), path = require('node:path'), { pathToFileURL } = require('node:url')",
    "const profile = process.env.ANVILITE_PACKAGED_AUDIT_PROFILE, nonce = process.env.ANVILITE_PACKAGED_AUDIT_NONCE",
    "if (!profile || !nonce || !path.basename(profile).startsWith('anvilite-packaged-audit-') || fs.readFileSync(path.join(profile, 'synthetic-profile.marker'), 'utf8') !== nonce) throw new Error('Synthetic profile required')",
    "app.setPath('userData', profile); app.setPath('sessionData', path.join(profile, 'session')); app.setAppLogsPath(path.join(profile, 'logs'))",
    "app.disableHardwareAcceleration()",
    "app.on('browser-window-created', (_event, win) => { win.hide(); win.webContents.on('did-finish-load', () => win.hide()) })",
    "import(pathToFileURL(path.join(__dirname, '../business.asar/dist-electron/main.js')).href).catch(error => { console.error(error); app.quit() })",
  ].join('\n'))
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'anvilite-packaged-audit-'))
  const nonce = randomUUID()
  fs.writeFileSync(path.join(profile, 'synthetic-profile.marker'), nonce)
  const env = { ...process.env, ANVILITE_PACKAGED_AUDIT_PROFILE: profile, ANVILITE_PACKAGED_AUDIT_NONCE: nonce }
  delete env.ELECTRON_RUN_AS_NODE
  let app
  const clients = [], errors = [], checks = []
  try {
    app = await _electron.launch({ executablePath: path.join(runtime, 'Anvilite.exe'), cwd: runtime, env, timeout: 30000 })
    const identity = await app.evaluate(({ app }) => ({ packaged: app.isPackaged, version: app.getVersion(), name: app.getName(), userData: app.getPath('userData') }))
    assert.equal(identity.packaged, true)
    assert.equal(identity.version, version)
    assert.equal(path.resolve(identity.userData), path.resolve(profile))
    let page = await app.firstWindow()
    page.setDefaultTimeout(20000)
    page.on('pageerror', error => errors.push(error.message))
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()) })
    const ready = () => page.waitForFunction(async () => !!(await window.electronAPI?.mcpGetStatus?.())?.ready)
    await ready()
    const initial = await page.evaluate(() => window.electronAPI.mcpGetStatus())
    assert.equal(initial.enabled, false)
    const snapshot = await page.evaluate(() => {
      localStorage.clear()
      const now = new Date().toISOString()
      const put = (key, state, version = 0) => localStorage.setItem('anvilite-' + key, JSON.stringify({ state, version }))
      const task = {
        id: 'legacy-packaged-task', title: 'Synthetic legacy task', category: 'work', difficulty: 3,
        priority: 'high', dueDate: null, description: 'Preserve old notes', estimatedMinutes: 31,
        actualMinutes: 23, status: 'todo', xpReward: 0, completedAt: null, deletedAt: null,
        isHidden: false, sortOrder: 7, timerStartedAt: null, timerAccumulated: 17, tags: ['legacy'],
        subTasks: [{ id: 'legacy-child', title: 'Nested child', completed: false, sortOrder: 0, subTasks: [], createdAt: now }],
        createdAt: now, updatedAt: now,
      }
      const habit = {
        id: 'legacy-packaged-habit', title: 'Synthetic paused legacy habit', category: 'life', difficulty: 2,
        estimatedMinutes: 5, repeatType: 'daily', customIntervalDays: null, weeklyDays: null, weeklyMode: null,
        weeklyFlexibleCount: null, monthlyDays: null, targetCount: 3, currentCycleCount: 1, startDate: now.slice(0, 10),
        endDate: null, reminderTime: null, description: 'Preserve cycle', subHabits: [], status: 'paused',
        isHidden: true, deletedAt: null, timerStartedAt: null, timerAccumulated: 0, actualMinutes: 4,
        consecutiveCount: 12, totalCompletions: 24, toleranceCharges: 1, toleranceNextAt: 15,
        weeklyCompletionCount: 0, lastCompletedAt: null, lastDueAt: null, sortOrder: 3, createdAt: now, updatedAt: now,
      }
      const character = { name: 'Synthetic release user', level: 17, totalXP: 987, currentXP: 11, ore: 321,
        totalOreEarned: 654, titlePreset: 'forge', customTitles: null, streakDays: 6, lastActiveDate: null,
        globalStatus: 'active', prestigeLevel: 0, xpFormulaVersion: 1, createdAt: now }
      const layout = [
        { id: 'tasks', visible: true, order: 4, size: 'large' },
        { id: 'habits', visible: false, order: 2, size: 'small' },
        { id: 'character', visible: false, order: 0 },
      ]
      put('tasks', { tasks: [task], lastCategory: 'work', completedViewMode: 'month', customTaskGroups: [] })
      put('habits', { habits: [habit], completedHabitViewMode: 'area', customHabitGroups: [] })
      put('settings', { settings: { theme: 'dawn-white', language: 'zh', dashboardLayout: layout,
        unlockedThemes: ['dawn-white'], characterName: character.name } })
      put('character', { character })
      put('growth-events', { events: [] }); put('badges', { earnedIds: { legacy: '2026-01-01' }, notifyQueue: [] })
      return { task, habit, character, layout }
    })
    await page.reload(); await ready()
    const read = key => page.evaluate(key => JSON.parse(localStorage.getItem('anvilite-' + key)).state, key)
    const tasksBefore = (await read('tasks')).tasks
    assert.equal(tasksBefore.length, 1)
    for (const key of ['id', 'description', 'actualMinutes', 'timerAccumulated', 'tags', 'subTasks'])
      assert.deepEqual(tasksBefore[0][key], snapshot.task[key])
    const savedLayout = (await read('settings')).settings.dashboardLayout
    for (const oldCard of snapshot.layout) assert.deepEqual(savedLayout.find(card => card.id === oldCard.id), oldCard)
    for (const key of ['id', 'status', 'currentCycleCount', 'totalCompletions', 'consecutiveCount', 'isHidden', 'actualMinutes'])
      assert.deepEqual((await read('habits')).habits[0][key], snapshot.habit[key])
    assert.deepEqual((await read('character')).character, snapshot.character)
    checks.push('packaged runtime is isolated and uses release version', 'legacy task, paused habit, reward fields and dashboard layout survive cold hydration')
    await page.getByTitle('设置', { exact: true }).click()
    const panel = page.locator('[data-mcp-settings]')
    await panel.waitFor(); await panel.scrollIntoViewIfNeeded()
    await panel.locator('[data-mcp-enabled]').click()
    await page.waitForFunction(async () => !!(await window.electronAPI.mcpGetStatus()).enabled)
    let binding = await page.evaluate(() => window.electronAPI.mcpGetStatus())
    assert.equal(path.resolve(binding.clientConfig.command), path.join(runtime, 'Anvilite.exe'))
    assert.equal(path.resolve(binding.clientConfig.args[0]), path.join(runtime, 'resources/mcp/server.cjs'))
    assert.equal(binding.clientConfig.env.ELECTRON_RUN_AS_NODE, '1')
    const mcpRequire = createRequire(path.join(root, 'mcp/package.json'))
    const { Client } = await import(pathToFileURL(mcpRequire.resolve('@modelcontextprotocol/client')).href)
    const { StdioClientTransport } = await import(pathToFileURL(mcpRequire.resolve('@modelcontextprotocol/client/stdio')).href)
    async function connect(binding) {
      const transport = new StdioClientTransport({ ...binding.clientConfig, cwd: os.tmpdir(), env: { ...process.env, ...binding.clientConfig.env }, stderr: 'pipe' })
      const client = new Client({ name: 'anvilite-packaged-release-audit', version: '1.0.0' })
      const stderr = []; transport.stderr.on('data', data => stderr.push(data.toString()))
      await client.connect(transport); clients.push(client)
      return { client, stderr }
    }
    let connection = await connect(binding), client = connection.client
    const invoke = async (name, args = {}) => (await client.callTool({ name, arguments: args })).structuredContent
    assert.equal((await client.listTools()).tools.length, 19)
    let context = ok(await invoke('get_context'))
    const get = ok(await invoke('tasks_get', { id: snapshot.task.id }))
    assert.equal(get.record.title, snapshot.task.title)
    const readHabit = ok(await invoke('habits_get', { id: snapshot.habit.id }))
    assert.equal(readHabit.record.totalCompletions, snapshot.habit.totalCompletions)
    assert.equal(readHabit.record.status, 'paused')
    assert.ok(ok(await invoke('flow_folders_list')).folders.length > 0)
    assert.ok(ok(await invoke('flows_list')).items.length > 0)
    const createArgs = { requestId: 'packaged-create-0001', expectedVersion: context.collectionVersions.tasks, record: { title: 'Packaged MCP synthetic task', category: 'other', actualMinutes: 13 } }
    const denied = await invoke('tasks_create', createArgs)
    assert.equal(denied.ok, false); assert.equal((await read('tasks')).tasks.length, 1)
    await panel.locator('[data-mcp-permission="tasks:write"]').click()
    await page.waitForFunction(async () => !!(await window.electronAPI.mcpGetStatus()).permissions.tasks.write)
    binding = await page.evaluate(() => window.electronAPI.mcpGetStatus())
    await client.close(); connection = await connect(binding); client = connection.client
    const created = ok(await invoke('tasks_create', createArgs))
    assert.equal(ok(await invoke('tasks_create', createArgs)).id, created.id)
    assert.equal((await read('tasks')).tasks.length, 2)
    const current = ok(await invoke('tasks_get', { id: created.id }))
    ok(await invoke('tasks_action', { id: created.id, action: 'complete', requestId: 'packaged-complete-0001', expectedVersion: current.version }))
    assert.equal(ok(await invoke('tasks_get', { id: created.id })).record.status, 'done')
    const characterAfterCompletion = (await read('character')).character
    for (const key of ['level', 'currentXP', 'totalXP', 'ore', 'totalOreEarned', 'titlePreset', 'customTitles', 'prestigeLevel', 'xpFormulaVersion']) assert.deepEqual(characterAfterCompletion[key], snapshot.character[key])
    for (const message of connection.stderr) assert.equal(message.includes(binding.token), false)
    checks.push('official MCP SDK starts standalone bundle with packaged executable from unrelated working directory',
      'packaged permissions deny ungranted writes', 'packaged task operation retry deduplicates and completion preserves legacy balances')
    await page.reload(); await ready()
    assert.equal((await page.evaluate(() => window.electronAPI.mcpGetStatus())).enabled, false)
    assert.equal((await read('tasks')).tasks.length, 2)
    assert.deepEqual((await read('character')).character, characterAfterCompletion)
    checks.push('reload revokes MCP and retains synthetic data')
    for (const client of clients) try { await client.close() } catch {}
    await app.close()
    app = await _electron.launch({ executablePath: path.join(runtime, 'Anvilite.exe'), cwd: runtime, env, timeout: 30000 })
    page = await app.firstWindow(); page.setDefaultTimeout(20000)
    page.on('pageerror', error => errors.push(error.message))
    await ready()
    assert.equal((await page.evaluate(() => window.electronAPI.mcpGetStatus())).enabled, false)
    assert.equal((await read('tasks')).tasks.length, 2)
    assert.deepEqual((await read('character')).character, characterAfterCompletion)
    for (const oldCard of snapshot.layout) assert.deepEqual((await read('settings')).settings.dashboardLayout.find(card => card.id === oldCard.id), oldCard)
    checks.push('complete packaged application restart retains data, legacy balances and custom layout with MCP disabled')
    await page.getByTitle('设置', { exact: true }).evaluate(button => button.click())
    const restartedPanel = page.locator('[data-mcp-settings]')
    await restartedPanel.waitFor()
    await restartedPanel.locator('[data-mcp-enabled]').evaluate(input => input.click())
    await page.waitForFunction(async () => !!(await window.electronAPI.mcpGetStatus()).enabled)
    await restartedPanel.locator('[data-mcp-permission="tasks:write"]').evaluate(input => input.click())
    await page.waitForFunction(async () => !!(await window.electronAPI.mcpGetStatus()).permissions.tasks.write)
    binding = await page.evaluate(() => window.electronAPI.mcpGetStatus())
    connection = await connect(binding); client = connection.client
    assert.equal(ok(await invoke('tasks_create', createArgs)).id, created.id)
    assert.equal((await read('tasks')).tasks.length, 2)
    assert.equal(ok(await invoke('operations_get', { requestId: createArgs.requestId })).status, 'committed')
    checks.push('persisted MCP receipt prevents repeated execution across full packaged application restart')
    assert.deepEqual(errors, [])
    assert.equal(hash(businessAsar), reference['resources/app.asar'])
    assert.equal(hash(path.join(runtime, 'Anvilite.exe')), reference['Anvilite.exe'])
    assert.equal(hash(path.join(runtime, 'resources/mcp/server.cjs')), reference['resources/mcp/server.cjs'])
    for (const [relative, value] of Object.entries(reference)) assert.equal(hash(path.join(packed, relative)), value)
    checks.push('production artifacts and instrumented-copy business bundles remain byte identical')
    const report = { version, artifacts, checks, errors, reference,
      packagedRuntime: true, syntheticProfileOnly: true, actualInstallerExecuted: false,
      runtimeInstrumentation: 'Copied payload startup manifest isolates userData before importing byte-identical production business archive.',
      installationLimitation: 'Host has registered Anvilite 0.3.3; NSIS execution would alter shared HKCU registration and may uninstall it. Both installer payloads were extracted and matched to packaged application instead.' }
    fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2))
    console.log(JSON.stringify({ version, checks: checks.length, artifacts: artifacts.length, errors, packagedRuntime: true, actualInstallerExecuted: false }))
  } finally {
    for (const client of clients) try { await client.close() } catch {}
    if (app) await app.close()
  }
}
main().catch(error => { console.error(error); process.exitCode = 1 })
