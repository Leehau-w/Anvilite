import { afterEach, describe, expect, it, vi } from 'vitest'
import net from 'node:net'
import type { Socket } from 'node:net'
import { once } from 'node:events'
import { LocalMcpBridge } from '../../electron/mcpBridge'
import type { BridgeBinding } from '../../electron/mcpBridge'
import { NO_MCP_PERMISSIONS, READ_MCP_PERMISSIONS } from '../mcp/contracts'
import type { McpDispatch, McpPermissions, McpRequest, McpResult, McpStatus, McpWireResponse } from '../mcp/contracts'

const bridges: LocalMcpBridge[] = []
const sockets: Socket[] = []
const binding: BridgeBinding = { accountId: 'synthetic-account', sessionId: 'synthetic-session' }
const readRequest: McpRequest = { method: 'tasks_list', params: {} }
const writeRequest: McpRequest = { method: 'tasks_create', params: { requestId: 'synthetic-operation-1', expectedVersion: 'synthetic-version', record: { title: 'Synthetic' } } }
const permissions = (patch: Partial<McpPermissions> = {}): McpPermissions => ({
 tasks: { ...READ_MCP_PERMISSIONS.tasks }, habits: { ...READ_MCP_PERMISSIONS.habits }, flows: { ...READ_MCP_PERMISSIONS.flows }, ...patch,
})
function make(options: Partial<ConstructorParameters<typeof LocalMcpBridge>[0]> = {}) {
 const dispatch = vi.fn(async (_dispatch: McpDispatch): Promise<McpResult> => ({ ok: true, data: { synthetic: true } }))
 const bridge = new LocalMcpBridge({ dispatch, ...options })
 bridges.push(bridge)
 return { bridge, dispatch }
}
async function enable(bridge: LocalMcpBridge, access = permissions()) {
 bridge.ready(binding)
 return bridge.configure(binding, { enabled: true, permissions: access })
}
async function connect(status: McpStatus) {
 const socket = net.createConnection(status.pipe!)
 sockets.push(socket)
 const replies: McpWireResponse[] = []
 const waiters: ((value: McpWireResponse) => void)[] = []
 let buffer = ''
 socket.on('data', data => {
   buffer += data.toString('utf8')
   while (buffer.includes('\n')) {
     const end = buffer.indexOf('\n')
     const response = JSON.parse(buffer.slice(0, end)) as McpWireResponse
     buffer = buffer.slice(end + 1)
     const waiter = waiters.shift()
     if (waiter) waiter(response); else replies.push(response)
   }
 })
 socket.on('error', () => {})
 await once(socket, 'connect')
 return {
   socket,
   next: () => replies.length ? Promise.resolve(replies.shift()!) : new Promise<McpWireResponse>(resolve => waiters.push(resolve)),
   send: (id: string, request: McpRequest, token = status.token) => socket.write(JSON.stringify({ id, token, request }) + '\n'),
 }
}
afterEach(() => { for (const socket of sockets.splice(0)) socket.destroy(); for (const bridge of bridges.splice(0)) bridge.revoke() })

describe('authenticated local MCP pipe', () => {
 it('starts disabled, requires a ready document and never returns credentials while off', async () => {
   const { bridge } = make()
   expect(bridge.status()).toEqual({ enabled: false, ready: false, permissions: NO_MCP_PERMISSIONS, accountId: null, sessionId: null, pipe: null, token: null })
   await expect(bridge.configure(binding, { enabled: true, permissions: permissions() })).rejects.toThrow('session_revoked')
   bridge.ready(binding)
   expect(bridge.status()).toMatchObject({ enabled: false, ready: true, token: null, pipe: null })
   await expect(bridge.configure(binding, { enabled: true, permissions: {} as McpPermissions })).rejects.toThrow('invalid_configuration')
 })

 it('reads through the fixed command bridge and rejects writes before dispatch for a read-only grant', async () => {
   const { bridge, dispatch } = make()
   const client = await connect(await enable(bridge))
   client.send('read', readRequest)
   expect((await client.next()).result).toEqual({ ok: true, data: { synthetic: true } })
   expect(dispatch.mock.calls[0][0]).toMatchObject({ ...binding, request: readRequest, permissions: permissions() })
   client.send('write', writeRequest)
   expect((await client.next()).result).toMatchObject({ ok: false, error: { code: 'permission_denied' } })
   expect(dispatch).toHaveBeenCalledTimes(1)
 })

 it('isolates grants by domain and requires tasks.write when instantiating a flow', async () => {
   const { bridge, dispatch } = make()
   const status = await enable(bridge, permissions({ tasks: { read: true, write: false }, habits: { read: false, write: false }, flows: { read: true, write: true } }))
   const client = await connect(status)
   client.send('habits', { method: 'habits_list', params: {} })
   expect((await client.next()).result).toMatchObject({ error: { code: 'permission_denied' } })
   client.send('flow', { method: 'flows_action', params: { action: 'instantiate' } })
   expect((await client.next()).result).toMatchObject({ error: { code: 'permission_denied' } })
   client.send('edit', { method: 'flows_update', params: {} })
   expect((await client.next()).result.ok).toBe(true)
   expect(dispatch).toHaveBeenCalledTimes(1)
 })

 it('disconnects invalid credentials without invoking business operations', async () => {
   const { bridge, dispatch } = make()
   const client = await connect(await enable(bridge))
   const closed = once(client.socket, 'close')
   client.send('forged', readRequest, 'f'.repeat(64))
   await closed
   expect(dispatch).not.toHaveBeenCalled()
 })

 it('does not execute a duplicate transport id twice', async () => {
   const { bridge, dispatch } = make()
   const client = await connect(await enable(bridge))
   client.send('same-id', readRequest)
   expect((await client.next()).result.ok).toBe(true)
   client.send('same-id', readRequest)
   expect((await client.next()).result).toMatchObject({ error: { code: 'duplicate_transport_id' } })
   expect(dispatch).toHaveBeenCalledTimes(1)
 })

 it('rotates credentials and closes old clients on every permission change without changing session', async () => {
   const statuses: McpStatus[] = []
   const { bridge } = make({ onStatus: status => statuses.push(status) })
   const previous = await enable(bridge)
   const client = await connect(previous)
   const closed = once(client.socket, 'close')
   const changed = await bridge.configure(binding, { enabled: true, permissions: permissions({ tasks: { read: true, write: true } }) })
   await closed
   expect(changed.sessionId).toBe(previous.sessionId)
   expect(changed.token).not.toBe(previous.token)
   expect(changed.pipe).not.toBe(previous.pipe)
   expect(statuses.slice(-2).every(status => status.ready && status.sessionId === binding.sessionId)).toBe(true)
   const fresh = await connect(changed)
   fresh.send('new', writeRequest)
   expect((await fresh.next()).result.ok).toBe(true)
 })

 it('revokes pending leases on reload/account switch and never accepts the old binding', async () => {
   let dispatched: McpDispatch | undefined
   const { bridge } = make({ dispatch: dispatch => { dispatched = dispatch; return new Promise(() => {}) } })
   const client = await connect(await enable(bridge))
   client.send('pending', readRequest)
   await vi.waitFor(() => expect(dispatched).toBeDefined())
   expect(bridge.canDispatch(dispatched!.bridgeId, binding)).toBe(true)
   const closed = once(client.socket, 'close')
   bridge.ready({ accountId: 'synthetic-other', sessionId: 'synthetic-other-session' })
   await closed
   expect(bridge.canDispatch(dispatched!.bridgeId, binding)).toBe(false)
   expect(bridge.status()).toMatchObject({ enabled: false, ready: true, token: null, pipe: null, accountId: 'synthetic-other' })
   await expect(bridge.configure(binding, { enabled: true, permissions: permissions() })).rejects.toThrow('session_revoked')
 })

 it('expires slow writes as unknown outcomes and prevents a queued command from passing lease validation', async () => {
   let dispatched: McpDispatch | undefined
   const { bridge } = make({ timeoutMs: 30, dispatch: dispatch => { dispatched = dispatch; return new Promise(() => {}) } })
   const client = await connect(await enable(bridge, permissions({ tasks: { read: true, write: true } })))
   client.send('slow', writeRequest)
   expect((await client.next()).result).toMatchObject({ error: { code: 'unknown_outcome' } })
   expect(bridge.canDispatch(dispatched!.bridgeId, binding)).toBe(false)
 })

 it('bounds pending commands and still accepts work after active commands finish', async () => {
   const resolves: ((result: McpResult) => void)[] = []
   const dispatch = vi.fn((request: McpDispatch) => {
     expect(request.request).toEqual(readRequest)
     return new Promise<McpResult>(resolve => resolves.push(resolve))
   })
   const { bridge } = make({ maxPending: 1, dispatch })
   const client = await connect(await enable(bridge))
   client.send('first', readRequest)
   client.send('second', readRequest)
   expect((await client.next()).result).toMatchObject({ error: { code: 'busy' } })
   resolves.shift()!({ ok: true, data: 'first' })
   expect((await client.next()).result).toEqual({ ok: true, data: 'first' })
   client.send('third', readRequest)
   await vi.waitFor(() => expect(resolves).toHaveLength(1))
   resolves.shift()!({ ok: true, data: 'third' })
   expect((await client.next()).result).toEqual({ ok: true, data: 'third' })
   expect(dispatch).toHaveBeenCalledTimes(2)
 })

 it('reassembles fragmented UTF-8 frames and rejects oversized or malformed frames', async () => {
   const { bridge, dispatch } = make({ maxFrameBytes: 512 })
   const status = await enable(bridge)
   const client = await connect(status)
   const frame = Buffer.from(JSON.stringify({ id: 'fragmented', token: status.token, request: { method: 'tasks_list', params: { query: '等待回信' } } }) + '\n')
   for (let start = 0; start < frame.length; start += 7) client.socket.write(frame.subarray(start, start + 7))
   expect((await client.next()).result.ok).toBe(true)
   expect(dispatch.mock.calls[0][0].request.params.query).toBe('等待回信')
   const closed = once(client.socket, 'close')
   client.socket.write('x'.repeat(513))
   await closed
   const malformed = await connect(status)
   const malformedClosed = once(malformed.socket, 'close')
   malformed.socket.write('{broken}\n')
   await malformedClosed
   expect(dispatch).toHaveBeenCalledTimes(1)
 })

 it('bounds responses and provides launch credentials only while enabled', async () => {
   const { bridge } = make({ maxFrameBytes: 512, dispatch: async () => ({ ok: true, data: 'x'.repeat(1000) }), clientConfig: (pipe, token) => ({ command: 'synthetic-electron', args: ['synthetic-server.cjs'], env: { ANVILITE_MCP_PIPE: pipe, ANVILITE_MCP_TOKEN: token } }) })
   const status = await enable(bridge)
   expect(status.clientConfig?.env.ANVILITE_MCP_TOKEN).toBe(status.token)
   const client = await connect(status)
   client.send('large', readRequest)
   expect((await client.next()).result).toMatchObject({ error: { code: 'response_too_large' } })
   const disabled = await bridge.configure(binding, { enabled: false, permissions: permissions() })
   expect(disabled).toMatchObject({ enabled: false, token: null, pipe: null })
   expect(disabled.clientConfig).toBeUndefined()
 })
})
