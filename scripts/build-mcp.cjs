const path = require('node:path')
const fs = require('node:fs')
const { createRequire } = require('node:module')
const root = path.resolve(__dirname, '..')
const localRequire = createRequire(path.join(root, 'mcp', 'package.json'))
const { build } = localRequire('esbuild')

function writeBundledNotices(metafile) {
  const packages = new Map()
  for (const input of Object.keys(metafile.inputs)) {
    if (!input.replaceAll('\\', '/').includes('node_modules/')) continue
    let directory = path.dirname(path.resolve(root, input))
    while (directory !== path.dirname(directory)) {
      const manifest = path.join(directory, 'package.json')
      if (fs.existsSync(manifest)) {
        const info = JSON.parse(fs.readFileSync(manifest, 'utf8'))
        if (info.name && info.version) {
          packages.set(info.name + '@' + info.version, { directory, info })
          break
        }
      }
      directory = path.dirname(directory)
    }
  }
  const sections = ['Anvilite local MCP — bundled third-party notices',
    'The following license and notice files are reproduced from the packages included in server.cjs.',
    'Additional upstream notices retained by the bundler appear at the end of server.cjs.']
  for (const [name, { directory, info }] of [...packages].sort(([a], [b]) => a.localeCompare(b))) {
    const notices = fs.readdirSync(directory).filter(file => /^(?:licen[cs]e|copying|notice)(?:[.-].*)?$/i.test(file))
      .filter(file => fs.statSync(path.join(directory, file)).isFile()).sort()
    if (!notices.length) throw new Error('Bundled license or notice file missing for ' + name)
    sections.push('\n' + '='.repeat(72), name + ' (' + info.license + ')')
    for (const file of notices) sections.push('\n--- ' + file + ' ---\n', fs.readFileSync(path.join(directory, file), 'utf8').trimEnd())
  }
  fs.writeFileSync(path.join(root, 'dist-mcp', 'THIRD-PARTY-NOTICES.txt'), sections.join('\n') + '\n')
}
build({
  absWorkingDir: root,
  entryPoints: [path.join(root, 'mcp', 'src', 'server.ts')],
  outfile: path.join(root, 'dist-mcp', 'server.cjs'),
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'cjs',
  sourcemap: false,
  legalComments: 'eof',
  metafile: true,
  logLevel: 'warning',
}).then(result => writeBundledNotices(result.metafile)).catch(error => {
  console.error(error)
  process.exitCode = 1
})
