import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const require = createRequire(path.join(root, 'mcp/package.json'))
test('standalone MCP distribution includes exact upstream runtime license and notice texts', () => {
  const notices = fs.readFileSync(path.join(root, 'dist-mcp/THIRD-PARTY-NOTICES.txt'), 'utf8')
  for (const name of ['@modelcontextprotocol/server', '@modelcontextprotocol/core', 'zod']) {
    let directory = path.dirname(require.resolve(name))
    while (!fs.existsSync(path.join(directory, 'package.json')) || !JSON.parse(fs.readFileSync(path.join(directory, 'package.json'), 'utf8')).name) directory = path.dirname(directory)
    const info = JSON.parse(fs.readFileSync(path.join(directory, 'package.json'), 'utf8'))
    assert.ok(notices.includes(name + '@' + info.version))
    for (const file of fs.readdirSync(directory).filter(file => /^(?:licen[cs]e|copying|notice)(?:[.-].*)?$/i.test(file))) {
      if (fs.statSync(path.join(directory, file)).isFile())
        assert.ok(notices.includes(fs.readFileSync(path.join(directory, file), 'utf8').trimEnd()), name + ' ' + file)
    }
  }
  assert.ok(notices.includes('Apache License'))
  assert.ok(notices.includes('MIT License'))
})
