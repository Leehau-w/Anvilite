import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { pathToFileURL, fileURLToPath } from 'node:url'
import net from 'node:net'
import type { Socket } from 'node:net'
import { once } from 'node:events'
import { READ_MCP_PERMISSIONS } from '../mcp/contracts'
import type { McpDispatch, McpStatus, McpWireResponse } from '../mcp/contracts'

const harness = vi.hoisted(() => ({
 handlers: new Map<string, (...args: any[]) => any>(), navigation: new Map<string, (...args: any[]) => any>(),
 windowEvents: new Map<string, (...args: any[]) => any>(), appEvents: new Map<string, (...args: any[]) => any>(), win: null as any,
}))
vi.mock('electron', () => ({
 app: { whenReady: () => Promise.resolve(), on: (name: string, callback: (...args: any[]) => any) => harness.appEvents.set(name, callback), isPackaged: false, getAppPath: () => process.cwd() },
 BrowserWindow: class {
   webContents = {
     mainFrame: { url: '' }, getURL: () => this.webContents.mainFrame.url, send: vi.fn(),
     setWindowOpenHandler: vi.fn(), openDevTools: vi.fn(),
     on: (name: string, callback: (...args: any[]) => any) => harness.navigation.set(name, callback),
   }
   constructor() { harness.win = this }
   isDestroyed = () => false
   on = (name: string, callback: (...args: any[]) => any) => harness.windowEvents.set(name, callback)
   loadFile = (value: string) => { this.webContents.mainFrame.url = pathToFileURL(value).href }
   loadURL = (value: string) => { this.webContents.mainFrame.url = value }
   static getAllWindows() { return [harness.win] }
 },
 ipcMain: {
   on: (name: string, callback: (...args: any[]) => any) => harness.handlers.set(name, callback),
   handle: (name: string, callback: (...args: any[]) => any) => harness.handlers.set(name, callback),
 }, dialog: {},
}))
const sockets: Socket[] = []
const renderer = pathToFileURL(fileURLToPath(new URL('../../dist/index.html', import.meta.url))).href
const event = () => ({ sender: harness.win.webContents, senderFrame: harness.win.webContents.mainFrame })
const call = (name: string, ...args: unknown[]) => harness.handlers.get(name)!(event(), ...args)
const grant = () => ({ enabled: true, permissions: structuredClone(READ_MCP_PERMISSIONS) })
async function ready() { return await call('mcp-ready', { accountId: 'synthetic-main-account' }) as McpStatus }
async function enable() { await ready(); return await call('mcp-configure', grant()) as McpStatus }
function dispatched(): McpDispatch | undefined { return harness.win.webContents.send.mock.calls.find((args: unknown[]) => args[0] === 'mcp-request')?.[1] }
async function connect(status: McpStatus) {
 const socket = net.createConnection(status.pipe!)
 sockets.push(socket)
 socket.on('error', () => {})
 await once(socket, 'connect')
 return socket
}
async function request(status: McpStatus) {
 const socket = await connect(status)
 const reply = once(socket, 'data').then(([chunk]) => JSON.parse(chunk.toString('utf8').trim()) as McpWireResponse)
 socket.write(JSON.stringify({ id: 'synthetic-main-request', token: status.token, request: { method: 'tasks_list', params: {} } }) + '\n')
 await vi.waitFor(() => expect(dispatched()).toBeDefined())
 return { socket, reply, dispatch: dispatched()! }
}
beforeAll(async () => { await import('../../electron/main'); await Promise.resolve() })
beforeEach(() => {
 harness.win.webContents.mainFrame.url = renderer
 harness.navigation.get('did-start-navigation')!({}, renderer, false, true)
 vi.clearAllMocks()
})
afterEach(() => { for (const socket of sockets.splice(0)) socket.destroy(); harness.navigation.get('did-start-navigation')!({}, renderer, false, true) })

describe('native MCP document authority', () => {
 it('does not expose credentials or accept configuration from unrelated contents, subframes or foreign documents', async () => {
   const invalid = [ { sender: {}, senderFrame: {} }, { sender: harness.win.webContents, senderFrame: { url: renderer } } ]
   for (const sender of invalid) {
     expect(() => harness.handlers.get('mcp-get-status')!(sender)).toThrow('invalid_sender')
     expect(() => harness.handlers.get('mcp-ready')!(sender, { accountId: 'synthetic' })).toThrow('invalid_sender')
     await expect(harness.handlers.get('mcp-configure')!(sender, grant())).rejects.toThrow('invalid_sender')
     expect(harness.handlers.get('mcp-validate')!(sender, { bridgeId: 'forged', sessionId: 'forged' })).toBe(false)
   }
   harness.win.webContents.mainFrame.url = 'https://foreign.invalid/'
   expect(() => call('mcp-get-status')).toThrow('invalid_sender')
 })

 it('requires hydrated readiness and returns a disabled fresh session without persisted tokens', async () => {
   await expect(call('mcp-configure', grant())).rejects.toThrow('renderer_not_ready')
   const initial = await ready()
   expect(initial).toMatchObject({ enabled: false, ready: true, accountId: 'synthetic-main-account', token: null, pipe: null })
   expect(initial.sessionId).toBeTypeOf('string')
   expect(initial.clientConfig).toBeUndefined()
   const status = await call('mcp-configure', grant()) as McpStatus
   expect(status.clientConfig).toMatchObject({ command: process.execPath, env: { ELECTRON_RUN_AS_NODE: '1', ANVILITE_MCP_PIPE: status.pipe, ANVILITE_MCP_TOKEN: status.token } })
   expect(status.clientConfig?.args[0]).toMatch(/dist-mcp[\\/]server\.cjs$/)
 })

 it('dispatches only a typed command and accepts only the matching current document reply', async () => {
   const status = await enable()
   const { reply, dispatch } = await request(status)
   const lease = { bridgeId: dispatch.bridgeId, sessionId: dispatch.sessionId }
   expect(call('mcp-validate', lease)).toBe(true)
   expect(call('mcp-validate', { ...lease, sessionId: 'old-session' })).toBe(false)
   const wrongFrame = { sender: harness.win.webContents, senderFrame: { url: renderer } }
   harness.handlers.get('mcp-respond')!(wrongFrame, { ...lease, result: { ok: true, data: 'forged' } })
   expect(call('mcp-validate', lease)).toBe(true)
   call('mcp-respond', { ...lease, result: { ok: true, data: { actual: true } } })
   expect((await reply).result).toEqual({ ok: true, data: { actual: true } })
   expect(call('mcp-validate', lease)).toBe(false)
 })

 it('invalidates queued commands and credentials on a same-URL reload', async () => {
   const status = await enable()
   const socket = await connect(status)
   socket.write(JSON.stringify({ id: 'queued', token: status.token, request: { method: 'tasks_list', params: {} } }) + '\n')
   await vi.waitFor(() => expect(dispatched()).toBeDefined())
   const lease = { bridgeId: dispatched()!.bridgeId, sessionId: dispatched()!.sessionId }
   const closed = once(socket, 'close')
   harness.navigation.get('did-start-navigation')!({}, renderer, false, true)
   await closed
   expect(call('mcp-validate', lease)).toBe(false)
   expect(call('mcp-get-status')).toMatchObject({ enabled: false, ready: false, sessionId: null, token: null })
   call('mcp-respond', { ...lease, result: { ok: true, data: 'stale' } })
   const next = await ready()
   expect(next.sessionId).not.toBe(status.sessionId)
 })

 it('invalidates the old account even if the renderer URL does not change', async () => {
   const previous = await enable()
   const socket = await connect(previous)
   const closed = once(socket, 'close')
   const next = await call('mcp-ready', { accountId: 'synthetic-other-account' }) as McpStatus
   await closed
   expect(next).toMatchObject({ enabled: false, ready: true, accountId: 'synthetic-other-account', pipe: null, token: null })
   expect(next.sessionId).not.toBe(previous.sessionId)
 })

 it('closes active clients and removes launch credentials when access is turned off', async () => {
   const status = await enable()
   const socket = await connect(status)
   const closed = once(socket, 'close')
   const disabled = await call('mcp-configure', { ...grant(), enabled: false }) as McpStatus
   await closed
   expect(disabled).toMatchObject({ enabled: false, ready: true, token: null, pipe: null, sessionId: status.sessionId })
   expect(disabled.clientConfig).toBeUndefined()
   expect(harness.win.webContents.send).toHaveBeenCalledWith('mcp-status', expect.objectContaining({ enabled: false, token: null }))
 })

 it('rejects configure which crosses a document reload and leaves access disabled', async () => {
   await ready()
   const pending = call('mcp-configure', grant())
   harness.navigation.get('did-start-navigation')!({}, renderer, false, true)
   await expect(pending).rejects.toThrow(/session_revoked|invalid_sender/)
   expect(call('mcp-get-status')).toMatchObject({ enabled: false, ready: false, token: null })
 })

 it('revokes the session when the renderer process exits', async () => {
   await enable()
   harness.navigation.get('render-process-gone')!({}, {})
   expect(call('mcp-get-status')).toMatchObject({ enabled: false, ready: false, sessionId: null })
 })
})
