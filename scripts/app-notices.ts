import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import type { Plugin } from 'vite'

interface PackageNotices {
  name: string
  version: string
  license: string
  files: Array<{ name: string; text: string }>
}

const compare = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0
const noticeName = /^(?:licen[cs]e|copying|notice)(?:[.-].*)?$/i

function readPackageNotices(directory: string): PackageNotices {
  const manifest = JSON.parse(fs.readFileSync(path.join(directory, 'package.json'), 'utf8'))
  if (typeof manifest.name !== 'string' || typeof manifest.version !== 'string') {
    throw new Error('Bundled package is missing its name or version')
  }
  const name = manifest.name + '@' + manifest.version
  const files = fs.readdirSync(directory).filter(file => noticeName.test(file))
    .filter(file => fs.statSync(path.join(directory, file)).isFile()).sort(compare)
    .map(file => {
      const bytes = fs.readFileSync(path.join(directory, file))
      const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes).trimEnd()
      if (!text || text.includes('\0')) throw new Error('Invalid license or notice file for ' + name + ': ' + file)
      return { name: file, text }
    })
  if (!files.length) throw new Error('Bundled license or notice file missing for ' + name)
  return { name: manifest.name, version: manifest.version,
    license: typeof manifest.license === 'string' ? manifest.license : 'see license files', files }
}

/** Locate actual node_modules owners, including commonjs proxies and pnpm nested paths. */
function packageDirectory(moduleId: string, root: string): string | null {
  let file = moduleId.replace(/^\0+/, '').split('?')[0].replaceAll('\\', '/')
  if (file.startsWith('/@fs/')) file = file.slice('/@fs/'.length)
  const marker = '/node_modules/'
  const index = file.lastIndexOf(marker)
  if (index < 0 && !file.startsWith('node_modules/')) return null
  const after = index < 0 ? 'node_modules/'.length : index + marker.length
  const parts = file.slice(after).split('/')
  const packageParts = parts[0].startsWith('@') ? parts.slice(0, 2) : parts.slice(0, 1)
  if (packageParts.some(part => !part) || packageParts[0].startsWith('@') && packageParts.length !== 2) {
    throw new Error('Cannot determine bundled package owner')
  }
  return path.resolve(root, file.slice(0, after), ...packageParts)
}

/**
 * Preserve notices for the packages represented in emitted frontend chunks.
 * Vite's notices also cover its generated runtime helpers. MCP has its own notices.
 */
export function appNotices(): Plugin {
  let root = ''
  return {
    name: 'anvilite-app-notices',
    apply: 'build',
    configResolved(config) { root = config.root },
    generateBundle(_options, bundle) {
      const packages = new Map<string, PackageNotices>()
      const directories = new Set<string>()
      const include = (directory: string) => {
        if (directories.has(directory)) return
        const notices = readPackageNotices(directory)
        const name = notices.name + '@' + notices.version
        const previous = packages.get(name)
        if (previous && JSON.stringify(previous.files) !== JSON.stringify(notices.files)) {
          throw new Error('Conflicting bundled license files for ' + name)
        }
        packages.set(name, notices)
        directories.add(directory)
      }
      for (const item of Object.values(bundle)) {
        if (item.type !== 'chunk') continue
        for (const moduleId of Object.keys(item.modules)) {
          const directory = packageDirectory(moduleId, root)
          if (directory) include(directory)
        }
      }
      const localRequire = createRequire(path.join(root, 'package.json'))
      include(path.dirname(localRequire.resolve('vite/package.json')))
      const sections = [
        'Anvilite — frontend third-party notices',
        'License and notice files from packages represented in the emitted frontend chunks.',
        'Vite notices cover generated build runtime helpers. MCP notices are supplied separately.',
      ]
      for (const [name, notices] of [...packages].sort(([a], [b]) => compare(a, b))) {
        sections.push('\n' + '='.repeat(72), name + ' (' + notices.license + ')')
        for (const file of notices.files) sections.push('\n--- ' + file.name + ' ---\n', file.text)
      }
      this.emitFile({ type: 'asset', fileName: 'licenses/THIRD-PARTY-NOTICES.txt',
        source: sections.join('\n') + '\n' })
    },
  }
}
