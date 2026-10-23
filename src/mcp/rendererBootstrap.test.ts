// @vitest-environment happy-dom
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { McpConfiguration, McpDispatch, McpPermissions, McpResult, McpStatus } from './contracts'

const harness = vi.hoisted(() => {
  vi.stubGlobal('window', document.defaultView)
  const hydrated = Array<boolean>(7).fill(true)
  const callbacks = Array.from({ length: 7 }, () => new Set<() => void>())
  const gates = callbacks.map((listeners, index) => ({ persist: {
    hasHydrated: () => hydrated[index],
    onFinishHydration: vi.fn((callback: () => void) => { listeners.add(callback); return () => { listeners.delete(callback) } }),
  } }))
  return { hydrated, callbacks, gates, accountId: 'synthetic-account', current: true, factory: vi.fn(), handle: vi.fn() }
})
vi.mock('./service', () => ({ createMcpService: harness.factory }))
vi.mock('@/stores/taskStore', () => ({ useTaskStore: harness.gates[0] }))
vi.mock('@/stores/habitStore', () => ({ useHabitStore: harness.gates[1] }))
vi.mock('@/stores/sopStore', () => ({ useSOPStore: harness.gates[2] }))
vi.mock('@/stores/areaStore', () => ({ useAreaStore: harness.gates[3] }))
vi.mock('@/stores/settingsStore', () => ({ useSettingsStore: harness.gates[4] }))
vi.mock('@/stores/growthEventStore', () => ({ useGrowthEventStore: harness.gates[5] }))
vi.mock('@/stores/characterStore', () => ({ useCharacterStore: harness.gates[6] }))
vi.mock('@/stores/accountManager', () => ({ getBoundAccountId: () => harness.accountId, getStoragePrefix: () => 'anvilite-synthetic-account', isAccountBindingCurrent: () => harness.current }))

import { NO_MCP_PERMISSIONS, READ_MCP_PERMISSIONS } from './contracts'

interface ServiceOptions { accountId: string; sessionId: string; getPermissions: () => McpPermissions; isCurrent: () => boolean }
let requestListener: ((dispatch: McpDispatch) => void) | undefined
let statusListener: ((status: McpStatus) => void) | undefined
let cleanup: (() => void) | undefined
let status: McpStatus
let api: { mcpReady: ReturnType<typeof vi.fn>; mcpConfigure: ReturnType<typeof vi.fn>; mcpGetStatus: ReturnType<typeof vi.fn>; mcpValidate: ReturnType<typeof vi.fn>; mcpRespond: ReturnType<typeof vi.fn>; onMcpRequest: ReturnType<typeof vi.fn>; onMcpStatus: ReturnType<typeof vi.fn> }
let offRequest: ReturnType<typeof vi.fn>, offStatus: ReturnType<typeof vi.fn>
const success: McpResult = { ok: true, data: { synthetic: true } }
const flush = async () => { for (let i = 0; i < 8; i++) await Promise.resolve() }
function finishHydration(index: number) {
  harness.hydrated[index] = true
  for (const callback of [...harness.callbacks[index]]) callback()
}
function dispatch(overrides: Partial<McpDispatch> = {}): McpDispatch {
  const request: McpDispatch = { bridgeId: 'synthetic-bridge', sessionId: 'synthetic-session', accountId: 'synthetic-account',
    request: { method: 'get_context', params: {} }, permissions: structuredClone(READ_MCP_PERMISSIONS), ...overrides }
  requestListener!(request)
  return request
}
function options(index = 0): ServiceOptions { return harness.factory.mock.calls[index][0] as ServiceOptions }
async function start() { const module = await import('./rendererBootstrap'); cleanup = await module.startMcpRendererBridge(); return module }

beforeEach(() => {
  vi.resetModules()
  cleanup = undefined; requestListener = undefined; statusListener = undefined
  harness.accountId = 'synthetic-account'; harness.current = true; harness.hydrated.fill(true)
  harness.callbacks.forEach(listeners => listeners.clear())
  harness.gates.forEach(gate => gate.persist.onFinishHydration.mockClear())
  harness.factory.mockReset(); harness.handle.mockReset()
  harness.factory.mockImplementation(() => ({ handle: harness.handle }))
  harness.handle.mockResolvedValue(success)
  status = { enabled: true, ready: true, accountId: 'synthetic-account', sessionId: 'synthetic-session', pipe: 'synthetic-local-pipe', token: 'synthetic-secret', permissions: structuredClone(READ_MCP_PERMISSIONS) }
  offRequest = vi.fn(); offStatus = vi.fn()
  api = {
    mcpReady: vi.fn(async () => structuredClone(status)),
    mcpGetStatus: vi.fn(async () => structuredClone(status)),
    mcpConfigure: vi.fn(async (configuration: McpConfiguration) => { status = { ...status, ...structuredClone(configuration) }; return structuredClone(status) }),
    mcpValidate: vi.fn(async () => true), mcpRespond: vi.fn(),
    onMcpRequest: vi.fn((listener: (dispatch: McpDispatch) => void) => { requestListener = listener; return offRequest }),
    onMcpStatus: vi.fn((listener: (next: McpStatus) => void) => { statusListener = listener; return offStatus }),
  }
  window.electronAPI = api as unknown as typeof window.electronAPI
})
afterEach(async () => {
  for (let i = 0; i < 7; i++) finishHydration(i)
  await flush()
  cleanup?.(); window.dispatchEvent(new Event('pagehide'))
  delete window.electronAPI; vi.restoreAllMocks()
})

it('waits for all seven business stores, including character hydration, before announcing ready once', async () => {
  harness.hydrated.fill(false)
  const module = await import('./rendererBootstrap')
  const pending = module.startMcpRendererBridge()
  expect(await module.startMcpRendererBridge()).toBeUndefined()
  expect(api.onMcpRequest).toHaveBeenCalledTimes(1)
  expect(api.onMcpStatus).toHaveBeenCalledTimes(1)
  expect(api.mcpReady).not.toHaveBeenCalled()
  for (let i = 0; i < 6; i++) finishHydration(i)
  await flush()
  expect(api.mcpReady).not.toHaveBeenCalled()
  finishHydration(6)
  cleanup = await pending
  expect(api.mcpReady).toHaveBeenCalledExactlyOnceWith({ accountId: 'synthetic-account' })
  expect(harness.factory).toHaveBeenCalledTimes(1)
  expect(harness.callbacks.every(listeners => listeners.size === 0)).toBe(true)
  expect(await module.startMcpRendererBridge()).toBeUndefined()
})

it('passes the exact dispatch lease to main and relays a denied lease result', async () => {
  await start()
  api.mcpValidate.mockResolvedValueOnce(false)
  const rejected: McpResult = { ok: false, error: { code: 'lease_expired', message: 'Grant was revoked.' } }
  harness.handle.mockImplementationOnce(async (_request, context: { authorize: () => Promise<boolean> }) => await context.authorize() ? success : rejected)
  const request = dispatch({ bridgeId: 'synthetic-expired-lease', request: { method: 'tasks_action', params: { id: 'synthetic-task', action: 'complete', requestId: 'synthetic-request-id', expectedVersion: 'v1' } } })
  await flush()
  expect(api.mcpValidate).toHaveBeenCalledExactlyOnceWith({ bridgeId: request.bridgeId, sessionId: request.sessionId })
  expect(api.mcpRespond).toHaveBeenCalledExactlyOnceWith({ bridgeId: request.bridgeId, sessionId: request.sessionId, result: rejected })
})

it('suspends queued dispatches as soon as permissions change and keeps failures closed', async () => {
  const module = await start()
  let reject!: (error: Error) => void
  api.mcpConfigure.mockImplementationOnce(() => new Promise((_resolve, fail) => { reject = fail }))
  const configuring = module.configureMcp({ enabled: false, permissions: structuredClone(NO_MCP_PERMISSIONS) })
  expect(options().isCurrent()).toBe(false)
  dispatch()
  await flush()
  expect(harness.handle).not.toHaveBeenCalled()
  expect(api.mcpRespond.mock.calls[0][0].result.error.code).toBe('session_expired')
  reject(new Error('synthetic IPC failure'))
  await expect(configuring).rejects.toThrow('synthetic IPC failure')
  expect(options().isCurrent()).toBe(false)
  dispatch({ bridgeId: 'synthetic-after-failure' })
  await flush()
  expect(harness.handle).not.toHaveBeenCalled()
  await module.configureMcp({ enabled: true, permissions: structuredClone(READ_MCP_PERMISSIONS) })
  expect(options().isCurrent()).toBe(true)
})

it('updates same-session permissions in place and invalidates the old service when the session rotates', async () => {
  await start()
  const original = options()
  const permissions = structuredClone(READ_MCP_PERMISSIONS); permissions.flows = { read: true, write: true }; permissions.tasks = { read: false, write: false }
  statusListener!({ ...status, permissions })
  expect(harness.factory).toHaveBeenCalledTimes(1)
  expect(original.getPermissions()).toEqual(permissions)
  expect(original.isCurrent()).toBe(true)
  statusListener!({ ...status, enabled: false, permissions: structuredClone(NO_MCP_PERMISSIONS) })
  expect(original.isCurrent()).toBe(false)
  statusListener!({ ...status, sessionId: 'synthetic-session-rotated', permissions })
  expect(harness.factory).toHaveBeenCalledTimes(2)
  expect(original.isCurrent()).toBe(false)
  expect(options(1).sessionId).toBe('synthetic-session-rotated')
  expect(options(1).isCurrent()).toBe(true)
  dispatch()
  await flush()
  expect(harness.handle).not.toHaveBeenCalled()
  expect(api.mcpRespond.mock.calls[0][0].result.error.code).toBe('session_expired')
})

it.each(['account','binding'] as const)('rejects commands after the %s changes before they reach business actions', async change => {
  await start()
  if (change === 'account') harness.accountId = 'synthetic-other-account'
  else harness.current = false
  expect(options().isCurrent()).toBe(false)
  dispatch()
  await flush()
  expect(harness.handle).not.toHaveBeenCalled()
  expect(api.mcpValidate).not.toHaveBeenCalled()
  expect(api.mcpRespond.mock.calls[0][0].result.error.code).toBe('session_expired')
})

it('does not announce ready when account binding changes during hydration', async () => {
  harness.hydrated[0] = false
  const module = await import('./rendererBootstrap')
  const pending = module.startMcpRendererBridge()
  harness.current = false
  finishHydration(0)
  cleanup = await pending
  expect(api.mcpReady).not.toHaveBeenCalled()
  expect(harness.factory).not.toHaveBeenCalled()
  dispatch()
  await flush()
  expect(harness.handle).not.toHaveBeenCalled()
})

it('revokes closures and removes subscriptions on pagehide even for an already queued callback', async () => {
  await start()
  const queued = requestListener!
  window.dispatchEvent(new Event('pagehide'))
  expect(options().isCurrent()).toBe(false)
  expect(offRequest).toHaveBeenCalledTimes(1)
  expect(offStatus).toHaveBeenCalledTimes(1)
  queued({ bridgeId: 'synthetic-queued', sessionId: 'synthetic-session', accountId: 'synthetic-account', request: { method: 'tasks_list', params: {} }, permissions: structuredClone(READ_MCP_PERMISSIONS) })
  await flush()
  expect(harness.handle).not.toHaveBeenCalled()
  expect(api.mcpRespond.mock.calls[0][0].result.error.code).toBe('session_expired')
  cleanup = undefined
})

it('reports an unconfirmed handler failure as unknown outcome and preserves its dispatch correlation', async () => {
  await start()
  harness.handle.mockRejectedValueOnce(new Error('synthetic-secret-never-return'))
  const request = dispatch()
  await flush()
  expect(api.mcpRespond).toHaveBeenCalledTimes(1)
  const reply = api.mcpRespond.mock.calls[0][0]
  expect(reply).toMatchObject({ bridgeId: request.bridgeId, sessionId: request.sessionId, result: { ok: false, error: { code: 'unknown_outcome' } } })
  expect(JSON.stringify(reply)).not.toContain('synthetic-secret')
})

it('stays inactive when no desktop bridge API is available', async () => {
  delete window.electronAPI
  const module = await import('./rendererBootstrap')
  expect(await module.startMcpRendererBridge()).toBeUndefined()
  expect(api.onMcpRequest).not.toHaveBeenCalled()
  expect(harness.factory).not.toHaveBeenCalled()
})


it('permanently blocks the loaded document on beforeunload, including later configuration attempts', async () => {
  const module = await start()
  window.dispatchEvent(new Event('beforeunload'))
  expect(options().isCurrent()).toBe(false)
  dispatch({ bridgeId: 'synthetic-after-beforeunload' })
  await flush()
  expect(harness.handle).not.toHaveBeenCalled()
  expect(api.mcpRespond.mock.calls[0][0].result.error.code).toBe('session_expired')
  await expect(module.configureMcp({ enabled: true, permissions: structuredClone(READ_MCP_PERMISSIONS) })).rejects.toThrow('reload_required')
  expect(api.mcpConfigure).not.toHaveBeenCalled()
  statusListener!({ ...status, enabled: true })
  expect(options().isCurrent()).toBe(false)
})

it.each(['anvilite-synthetic-account-tasks', 'anvilite-synthetic-account-mcp-receipts', 'anvilite-current-account', null])('requires reload for related external storage change %s while ignoring another account', async key => {
  const module = await start()
  for (const unrelated of ['anvilite-synthetic-other-account-tasks', 'anvilite-synthetic-other-account-mcp-receipts', 'unrelated-window-preference']) {
    window.dispatchEvent(new StorageEvent('storage', { key: unrelated, oldValue: 'old', newValue: 'new' }))
  }
  expect(options().isCurrent()).toBe(true)
  dispatch({ bridgeId: 'synthetic-unrelated-account-unchanged' })
  await flush()
  expect(harness.handle).toHaveBeenCalledTimes(1)
  expect(api.mcpRespond.mock.calls[0][0].result).toEqual(success)
  harness.handle.mockClear(); api.mcpRespond.mockClear()
  window.dispatchEvent(new StorageEvent('storage', { key, oldValue: 'old', newValue: 'new' }))
  expect(options().isCurrent()).toBe(false)
  dispatch({ bridgeId: 'synthetic-external-change-blocked' })
  await flush()
  expect(harness.handle).not.toHaveBeenCalled()
  expect(api.mcpRespond.mock.calls[0][0].result.error.code).toBe('session_expired')
  await expect(module.configureMcp({ enabled: true, permissions: structuredClone(READ_MCP_PERMISSIONS) })).rejects.toThrow('reload_required')
  expect(api.mcpConfigure).not.toHaveBeenCalled()
  statusListener!({ ...status, enabled: true })
  expect(options().isCurrent()).toBe(false)
})
