import { test as nodeTest } from 'node:test'
import assert from 'node:assert/strict'
import net from 'node:net'
import os from 'node:os'
import path from 'node:path'
import fs from 'node:fs/promises'
import { randomBytes, randomUUID } from 'node:crypto'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { Client } from '@modelcontextprotocol/client'
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio'

const test = (name, fn) => nodeTest(name, { timeout: 10_000 }, fn)
const root = fileURLToPath(new URL('../../', import.meta.url))
const entry = path.join(root, 'dist-mcp', 'server.cjs')
const ok = data => ({ ok: true, data })
const fail = (code, message = code, details) => ({ ok: false, error: { code, message, ...(details ? { details } : {}) } })

async function host(t, handle) {
  const token = randomBytes(32).toString('hex')
  let directory
  const pipe = process.platform === 'win32' ? String.raw`\\.\pipe\anvilite-mcp-` + randomUUID() : path.join(directory = await fs.mkdtemp(path.join(os.tmpdir(), 'anvilite-mcp-')), 'bridge.sock')
  const sockets = new Set()
  const requests = []
  const errors = []
  const server = net.createServer(socket => {
    sockets.add(socket)
    socket.on('error', error => errors.push(error))
    socket.on('close', () => sockets.delete(socket))
    let text = ''
    socket.on('data', chunk => {
      text += chunk.toString('utf8')
      const end = text.indexOf('\n')
      if (end < 0) return
      const frame = JSON.parse(text.slice(0, end))
      assert.equal(frame.token, token)
      assert.equal(typeof frame.id, 'string')
      requests.push(frame)
      Promise.resolve(handle(frame.request, socket)).then(result => {
        if (result !== undefined && !socket.destroyed) socket.write(JSON.stringify({ id: frame.id, result }) + '\n')
      }).catch(error => { errors.push(error); socket.destroy() })
    })
  })
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(pipe, resolve) })
  t.after(async () => {
    for (const socket of sockets) socket.destroy()
    await new Promise(resolve => server.close(resolve))
    if (directory) { await fs.rm(pipe, { force: true }); await fs.rmdir(directory) }
    assert.deepEqual(errors, [])
  })
  return { pipe, token, requests, sockets }
}

async function connect(t, binding, modern = false) {
  const stderr = []
  const transport = new StdioClientTransport({ command: process.execPath, args: [entry], cwd: root,
    env: { ...Object.fromEntries(Object.entries(process.env).filter(([, value]) => typeof value === 'string')), ANVILITE_MCP_PIPE: binding.pipe, ANVILITE_MCP_TOKEN: binding.token }, stderr: 'pipe' })
  transport.stderr.on('data', value => stderr.push(value.toString('utf8')))
  const client = new Client({ name: 'anvilite-synthetic-regression', version: '1.0.0' }, modern ? { versionNegotiation: { mode: { pin: '2026-07-28' } } } : {})
  await client.connect(transport)
  t.after(async () => {
    const pid = transport.pid
    await client.close()
    assert.equal(stderr.join('').includes(binding.token), false, 'tokens never enter stderr')
    assert.equal(stderr.join('').includes('synthetic-private-content'), false, 'task contents never enter stderr')
    assert.equal(stderr.join(''), '', 'normal protocol use emits no stderr logs')
    if (pid) assert.throws(() => process.kill(pid, 0), 'stdio child must stop after client closes')
  })
  return { client, transport, stderr }
}

const invoke = async (client, name, args = {}) => {
  const response = await client.callTool({ name, arguments: args })
  assert.equal(response.structuredContent?.ok === false, response.isError === true)
  assert.deepEqual(JSON.parse(response.content.find(item => item.type === 'text').text), response.structuredContent)
  return response.structuredContent
}

for (const modern of [false, true]) test('official stdio client discovers strict schemas and reads through local pipe (' + (modern ? '2026' : 'legacy') + ')', async t => {
  const binding = await host(t, request => ok({ sessionId: 'synthetic-session', permissions: { tasks: { read: true, write: false } }, method: request.method }))
  const { client } = await connect(t, binding, modern)
  assert.equal(client.getServerVersion().name, 'anvilite-local')
  const { tools } = await client.listTools()
  assert.equal(tools.length, 19)
  const create = tools.find(tool => tool.name === 'tasks_create')
  assert.deepEqual(create.inputSchema.required, ['requestId', 'expectedVersion', 'record'])
  assert.equal(create.inputSchema.additionalProperties, false)
  assert.equal(create.annotations.readOnlyHint, false)
  assert.equal(tools.find(tool => tool.name === 'tasks_get').annotations.readOnlyHint, true)
  assert.equal(tools.every(tool => typeof tool.description === 'string' && tool.description.length > 20), true)
  const context = await invoke(client, 'get_context')
  assert.equal(context.data.sessionId, 'synthetic-session')
  assert.deepEqual(binding.requests.map(frame => frame.request), [{ method: 'get_context', params: {} }])
})

test('permissions and version conflicts are structured tool errors without hidden retries', async t => {
  const binding = await host(t, request => request.method === 'tasks_update' ? fail('version_conflict', 'Read the record again.', { currentVersion: 'v-next' }) : fail('permission_denied'))
  const { client } = await connect(t, binding)
  const denied = await invoke(client, 'habits_list')
  assert.equal(denied.error.code, 'permission_denied')
  const conflict = await invoke(client, 'tasks_update', { id: 'synthetic-task', patch: { title: 'synthetic-private-content' }, expectedVersion: 'v-old', requestId: 'synthetic-write-0001' })
  assert.equal(conflict.error.code, 'version_conflict')
  assert.equal(conflict.error.details.currentVersion, 'v-next')
  assert.equal(binding.requests.length, 2)
})

test('bounded list pagination preserves filters and cursor exactly', async t => {
  const binding = await host(t, request => ok({ items: [{ id: request.params.cursor ? 'second' : 'first' }], collectionVersion: 'collection-v1', nextCursor: request.params.cursor ? null : 'opaque-synthetic-cursor' }))
  const { client } = await connect(t, binding)
  const filters = { query: 'read message', category: 'work', status: 'waiting', limit: 1, includeDeleted: false }
  const first = await invoke(client, 'tasks_list', filters)
  const second = await invoke(client, 'tasks_list', { ...filters, cursor: first.data.nextCursor })
  assert.equal(second.data.items[0].id, 'second')
  assert.deepEqual(binding.requests[1].request.params, { ...filters, cursor: 'opaque-synthetic-cursor' })
})

test('invalid or unknown tool parameters never reach the desktop bridge', async t => {
  const binding = await host(t, () => ok({}))
  const { client } = await connect(t, binding)
  for (const [name, args] of [
    ['tasks_create', { requestId: 'synthetic-0001', record: { title: 'missing version' } }],
    ['tasks_action', { requestId: 'synthetic-0001', expectedVersion: 'v1', id: 'one', action: 'eval' }],
    ['tasks_list', { limit: 101 }],
    ['get_context', { accountId: 'another-account', file: 'localStorage' }],
  ]) {
    const result = await client.callTool({ name, arguments: args })
    assert.equal(result.isError, true)
  }
  await assert.rejects(() => client.callTool({ name: 'arbitrary_eval', arguments: { script: 'process.env' } }), /not found/)
  assert.equal(binding.requests.length, 0)
})

test('lost write response reports unknown outcome; identical retry carries the same operation ID', async t => {
  const receipts = new Map()
  let effects = 0
  const binding = await host(t, (request, socket) => {
    if (request.method === 'operations_get') return ok(receipts.get(request.params.requestId))
    const key = request.params.requestId
    if (receipts.has(key)) return ok(receipts.get(key))
    const receipt = { requestId: key, status: 'applied', result: { id: 'habit-synthetic', completedToday: ++effects } }
    receipts.set(key, receipt)
    socket.destroy()
  })
  const { client } = await connect(t, binding)
  const args = { requestId: 'synthetic-operation-once', expectedVersion: 'habit-v1', id: 'habit-synthetic', action: 'complete' }
  const first = await invoke(client, 'habits_action', args)
  assert.equal(first.error.code, 'unknown_outcome')
  assert.match(first.error.message, /operations_get/)
  assert.equal(binding.requests.length, 1, 'no automatic retries after uncertain write')
  const receipt = await invoke(client, 'operations_get', { requestId: args.requestId })
  assert.equal(receipt.data.status, 'applied')
  const retried = await invoke(client, 'habits_action', args)
  assert.equal(retried.data.result.completedToday, 1)
  assert.equal(effects, 1)
  assert.deepEqual(binding.requests[0].request.params, binding.requests[2].request.params)
  assert.notEqual(binding.requests[0].id, binding.requests[2].id, 'transport IDs are independent of durable operation IDs')
})

test('bridge write timeouts and session loss retain uncertainty instead of claiming failure', async t => {
  const binding = await host(t, request => fail(request.params.action === 'complete' ? 'request_timeout' : 'session_revoked'))
  const { client } = await connect(t, binding)
  for (const action of ['complete', 'undo']) {
    const result = await invoke(client, 'tasks_action', { id: 'synthetic-task', action, expectedVersion: 'v1', requestId: 'synthetic-' + action })
    assert.equal(result.error.code, 'unknown_outcome')
  }
  const read = await invoke(client, 'tasks_get', { id: 'synthetic-task' })
  assert.equal(read.error.code, 'session_revoked')
})

test('offline application is reported as unavailable without stdout noise', async t => {
  const binding = { pipe: process.platform === 'win32' ? String.raw`\\.\pipe\anvilite-mcp-` + randomUUID() : path.join(os.tmpdir(), 'anvilite-mcp-synthetic-absent', 'bridge.sock'), token: randomBytes(32).toString('hex') }
  const { client } = await connect(t, binding)
  const result = await invoke(client, 'tasks_list')
  assert.equal(result.error.code, 'app_unavailable')
})

test('nonlocal endpoint and malformed credentials fail closed without logging secrets', async () => {
  for (const [pipe, token] of [['http://127.0.0.1:9999', randomBytes(32).toString('hex')], [String.raw`\\remote-machine\pipe\anvilite-mcp-synthetic`, randomBytes(32).toString('hex')], [String.raw`\\.\pipe\anvilite-mcp-synthetic`, 'synthetic-private-content']]) {
    const child = spawn(process.execPath, [entry], { cwd: root, env: { ...process.env, ANVILITE_MCP_PIPE: pipe, ANVILITE_MCP_TOKEN: token }, stdio: ['pipe','pipe','pipe'] })
    let stdout = '', stderr = ''
    child.stdout.on('data', text => stdout += text)
    child.stderr.on('data', text => stderr += text)
    const code = await new Promise(resolve => child.once('exit', resolve))
    assert.equal(code, 1)
    assert.equal(stdout, '')
    assert.match(stderr, /startup_failed/)
    assert.equal(stderr.includes(token), false)
  }
})


test('durable operation ID is preserved across a fresh stdio client process', async t => {
  const receipts = new Map()
  let effects = 0
  const binding = await host(t, request => {
    if (request.method === 'operations_get') return ok(receipts.get(request.params.requestId))
    if (!receipts.has(request.params.requestId)) receipts.set(request.params.requestId, { requestId: request.params.requestId, status: 'applied', result: { id: 'flow-instance-' + ++effects } })
    return ok(receipts.get(request.params.requestId))
  })
  const args = { requestId: 'synthetic-restart-operation', expectedVersion: 'flow-v1', id: 'flow-one', action: 'instantiate', taskCollectionVersion: 'tasks-v1' }
  const initial = await connect(t, binding)
  const original = await invoke(initial.client, 'flows_action', args)
  await initial.client.close()
  const restarted = await connect(t, binding)
  const receipt = await invoke(restarted.client, 'operations_get', { requestId: args.requestId })
  assert.deepEqual(receipt, original)
  const replay = await invoke(restarted.client, 'flows_action', args)
  assert.deepEqual(replay, original)
  assert.equal(effects, 1)
  assert.deepEqual(binding.requests[0].request.params, binding.requests[2].request.params)
})

test('raw stdio framing handles split and concatenated JSON messages without stdout contamination', async t => {
  const binding = await host(t, () => ok({ sessionId: 'synthetic-framing-session' }))
  const child = spawn(process.execPath, [entry], { cwd: root, env: { ...process.env, ANVILITE_MCP_PIPE: binding.pipe, ANVILITE_MCP_TOKEN: binding.token }, stdio: ['pipe','pipe','pipe'] })
  t.after(() => { if (child.exitCode === null) child.kill() })
  let buffer = '', stderr = ''
  const frames = []
  const pending = new Map()
  const timer = setTimeout(() => child.kill(), 4000)
  child.stderr.on('data', text => stderr += text)
  child.stdout.on('data', chunk => {
    buffer += chunk.toString('utf8')
    for (;;) {
      const end = buffer.indexOf('\n')
      if (end < 0) break
      const frame = JSON.parse(buffer.slice(0, end))
      buffer = buffer.slice(end + 1)
      frames.push(frame)
      pending.get(frame.id)?.(frame)
    }
  })
  const response = id => new Promise(resolve => pending.set(id, resolve))
  const initialized = response(1)
  const init = JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-11-25', capabilities: {}, clientInfo: { name: 'synthetic-raw-client', version: '1.0.0' } } }) + '\n'
  child.stdin.write(init.slice(0, 24))
  child.stdin.write(init.slice(24))
  assert.equal((await initialized).result.serverInfo.name, 'anvilite-local')
  const listed = response(2), called = response(3)
  child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n' + JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/list' }) + '\n' + JSON.stringify({ jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'get_context', arguments: {} } }) + '\n')
  assert.equal((await listed).result.tools.length, 19)
  assert.equal((await called).result.structuredContent.data.sessionId, 'synthetic-framing-session')
  child.stdin.end()
  const exit = await new Promise(resolve => child.once('exit', resolve))
  clearTimeout(timer)
  assert.equal(exit, 0)
  assert.equal(buffer, '')
  assert.equal(stderr, '')
  assert.deepEqual(frames.map(frame => frame.id).sort(), [1,2,3])
  assert.equal(JSON.stringify(frames).includes(binding.token), false)
})

test('malformed local bridge responses never prove a write failed', async t => {
  const binding = await host(t, (_request, socket) => { socket.write('not-json\n'); return undefined })
  const { client } = await connect(t, binding)
  const result = await invoke(client, 'habits_action', { requestId: 'synthetic-corrupt-response', expectedVersion: 'v1', id: 'habit-one', action: 'complete' })
  assert.equal(result.error.code, 'unknown_outcome')
  assert.equal(binding.requests.length, 1)
})
