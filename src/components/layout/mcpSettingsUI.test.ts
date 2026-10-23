// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { McpConfiguration, McpDomain, McpStatus } from '@/mcp/contracts'

const mock = vi.hoisted(() => {
  vi.stubGlobal('window', document.defaultView)
  vi.stubGlobal('localStorage', document.defaultView!.localStorage)
  return { configure: vi.fn() }
})
vi.mock('@/mcp/rendererBootstrap', () => ({ configureMcp: mock.configure }))

import { McpSettingsPanel } from './McpSettingsPanel'
import { NO_MCP_PERMISSIONS, READ_MCP_PERMISSIONS } from '@/mcp/contracts'
import { useSettingsStore } from '@/stores/settingsStore'
import { serializeExportData } from '@/utils/dataExport'
import { zh } from '@/i18n/zh'
import { en } from '@/i18n/en'

let root: Root, container: HTMLDivElement, status: McpStatus
let getStatus: ReturnType<typeof vi.fn>, clipboard: ReturnType<typeof vi.fn>
let statusListener: ((next: McpStatus) => void) | undefined
let offStatus: ReturnType<typeof vi.fn>
const freshConfig = (suffix: string) => ({ command: 'node', args: ['C:/synthetic/dist-mcp/server.cjs'], env: {
  ANVILITE_MCP_PIPE: String.raw`\\.\pipe\anvilite-mcp-synthetic-` + suffix,
  ANVILITE_MCP_TOKEN: 'synthetic-secret-' + suffix,
} })
async function render() { await act(async () => { root.render(React.createElement(McpSettingsPanel)) }) }
async function click(node: Element) { await act(async () => { node.dispatchEvent(new MouseEvent('click', { bubbles: true })) }) }
function box(selector: string) { return container.querySelector<HTMLInputElement>(selector)! }
function access(domain: McpDomain, kind: 'read' | 'write') { return box('[data-mcp-permission="' + domain + ':' + kind + '"]') }

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  localStorage.clear()
  useSettingsStore.getState().setLanguage('zh')
  status = { enabled: false, ready: true, permissions: structuredClone(NO_MCP_PERMISSIONS), accountId: 'default', sessionId: 'synthetic-session', pipe: null, token: null }
  getStatus = vi.fn(async () => structuredClone(status))
  offStatus = vi.fn()
  clipboard = vi.fn(async () => undefined)
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: clipboard } })
  window.electronAPI = { mcpGetStatus: getStatus, onMcpStatus: (listener: (next: McpStatus) => void) => { statusListener = listener; return offStatus } } as unknown as typeof window.electronAPI
  mock.configure.mockReset()
  mock.configure.mockImplementation(async (configuration: McpConfiguration) => {
    status = { ...status, ...structuredClone(configuration), ...(configuration.enabled ? { clientConfig: freshConfig('initial'), token: 'synthetic-secret-initial', pipe: freshConfig('initial').env.ANVILITE_MCP_PIPE } : { clientConfig: undefined, token: null, pipe: null }) }
    return structuredClone(status)
  })
  container = document.createElement('div'); document.body.append(container); root = createRoot(container)
})
afterEach(async () => {
  await act(async () => root.unmount())
  container.remove(); delete window.electronAPI; statusListener = undefined; vi.restoreAllMocks()
})

it.each(['zh','en'] as const)('enables read-only by default and disables the connection without leaving editable controls (%s)', async lang => {
  const t = lang === 'zh' ? zh : en
  useSettingsStore.getState().setLanguage(lang)
  await render()
  expect(container.textContent).toContain(t.mcp_title)
  expect(box('[data-mcp-enabled]').disabled).toBe(false)
  expect([...container.querySelectorAll<HTMLInputElement>('[data-mcp-permission]')].every(input => input.disabled)).toBe(true)
  await click(box('[data-mcp-enabled]'))
  expect(mock.configure).toHaveBeenLastCalledWith({ enabled: true, permissions: READ_MCP_PERMISSIONS })
  for (const domain of ['tasks','habits','flows'] as const) { expect(access(domain,'read').checked).toBe(true); expect(access(domain,'write').checked).toBe(false) }
  expect(container.textContent).not.toContain('synthetic-secret')
  await click(box('[data-mcp-enabled]'))
  expect(mock.configure).toHaveBeenLastCalledWith({ enabled: false, permissions: READ_MCP_PERMISSIONS })
  expect(box('[data-mcp-enabled]').checked).toBe(false)
  expect(container.querySelector<HTMLButtonElement>('[data-mcp-copy]')!.disabled).toBe(true)
  expect([...container.querySelectorAll<HTMLInputElement>('[data-mcp-permission]')].every(input => input.disabled)).toBe(true)
})

it.each(['tasks','habits','flows'] as const)('grants %s independently: writing includes reading, removing reading clears writing', async domain => {
  status.enabled = true
  await render()
  await click(access(domain,'write'))
  const expected = structuredClone(NO_MCP_PERMISSIONS); expected[domain] = { read: true, write: true }
  expect(mock.configure).toHaveBeenLastCalledWith({ enabled: true, permissions: expected })
  expect(access(domain,'read').checked).toBe(true)
  expect(access(domain,'write').checked).toBe(true)
  for (const other of (['tasks','habits','flows'] as const).filter(value => value !== domain)) { expect(access(other,'read').checked).toBe(false); expect(access(other,'write').checked).toBe(false) }
  await click(access(domain,'read'))
  expect(mock.configure).toHaveBeenLastCalledWith({ enabled: true, permissions: NO_MCP_PERMISSIONS })
  expect(access(domain,'read').checked).toBe(false)
  expect(access(domain,'write').checked).toBe(false)
})

it('copies only a fresh connection configuration and keeps credentials out of the page and ordinary backup', async () => {
  status.enabled = true
  status.permissions = structuredClone(READ_MCP_PERMISSIONS)
  status.clientConfig = freshConfig('old')
  status.token = 'synthetic-secret-old'
  await render()
  const fresh = { ...structuredClone(status), clientConfig: freshConfig('fresh'), token: 'synthetic-secret-fresh' }
  getStatus.mockResolvedValueOnce(fresh)
  await click(container.querySelector('[data-mcp-copy]')!)
  expect(getStatus).toHaveBeenCalledTimes(2)
  expect(JSON.parse(clipboard.mock.calls[0][0])).toEqual({ mcpServers: { anvilite: fresh.clientConfig } })
  expect(container.querySelector('[role="status"]')!.textContent).toBe(zh.mcp_copied)
  expect(container.outerHTML).not.toMatch(/synthetic-secret|ANVILITE_MCP_TOKEN|anvilite-mcp-synthetic/)
  const backup = serializeExportData()
  expect(backup).not.toMatch(/synthetic-secret|ANVILITE_MCP_TOKEN|ANVILITE_MCP_PIPE|synthetic-session|clientConfig/)
  expect(Object.keys(JSON.parse(backup).data)).not.toContain('mcp')
})

it('keeps the old controls and reports failure when a permission change is rejected', async () => {
  status.enabled = true; status.permissions = structuredClone(READ_MCP_PERMISSIONS)
  await render()
  mock.configure.mockRejectedValueOnce(new Error('synthetic-secret-error-never-display'))
  await click(access('habits','write'))
  expect(access('habits','write').checked).toBe(false)
  expect(access('habits','read').checked).toBe(true)
  expect(container.querySelector('[role="status"]')!.textContent).toBe(zh.mcp_failed)
  expect(container.textContent).not.toContain(zh.mcp_copied)
  expect(container.textContent).not.toContain('synthetic-secret-error')
})

it('blocks parallel edits while awaiting a permission change and follows external revocation', async () => {
  status.enabled = true; status.permissions = structuredClone(READ_MCP_PERMISSIONS); status.clientConfig = freshConfig('current')
  await render()
  let resolve!: (next: McpStatus) => void
  mock.configure.mockImplementationOnce(() => new Promise<McpStatus>(done => { resolve = done }))
  await click(access('tasks','write'))
  expect(box('[data-mcp-enabled]').disabled).toBe(true)
  expect([...container.querySelectorAll<HTMLInputElement>('[data-mcp-permission]')].every(input => input.disabled)).toBe(true)
  const revoked = { ...status, enabled: false, permissions: structuredClone(NO_MCP_PERMISSIONS), clientConfig: undefined, token: null, pipe: null }
  await act(async () => { resolve(revoked) })
  expect(box('[data-mcp-enabled]').checked).toBe(false)
  await act(async () => { statusListener?.({ ...revoked, ready: false, sessionId: null }) })
  expect(box('[data-mcp-enabled]').disabled).toBe(true)
  expect(container.querySelector<HTMLButtonElement>('[data-mcp-copy]')!.disabled).toBe(true)
})

it.each(['disabled','clipboard'] as const)('does not report success or expose credentials after %s copy failure', async failure => {
  status.enabled = true; status.clientConfig = freshConfig('current')
  await render()
  if (failure === 'disabled') getStatus.mockResolvedValueOnce({ ...status, enabled: false })
  else clipboard.mockRejectedValueOnce(new Error('synthetic-secret-copy-error'))
  await click(container.querySelector('[data-mcp-copy]')!)
  expect(container.querySelector('[role="status"]')!.textContent).toBe(zh.mcp_copyFailed)
  expect(container.textContent).not.toContain(zh.mcp_copied)
  expect(container.textContent).not.toContain('synthetic-secret')
  if (failure === 'disabled') expect(clipboard).not.toHaveBeenCalled()
})

it('shows the desktop-only message without rendering working controls in the browser', async () => {
  delete window.electronAPI
  await render()
  expect(container.textContent).toContain(zh.mcp_desktopOnly)
  expect(container.querySelector('[data-mcp-enabled]')).toBeNull()
  expect(mock.configure).not.toHaveBeenCalled()
})
