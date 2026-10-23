// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { beforeEach, afterEach, expect, it, vi } from 'vitest'

// Keep real controls and handlers; exiting presentation nodes must not wait on
// the test DOM's unavailable animation-completion callbacks.
vi.mock('framer-motion', async importOriginal => ({
  ...await importOriginal<typeof import('framer-motion')>(),
  AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
}))

// Use the same isolated DOM storage for the UI, account binding and Zustand.
vi.hoisted(() => {
  vi.stubGlobal('window', document.defaultView)
  vi.stubGlobal('localStorage', document.defaultView!.localStorage)
})

import { SettingsModal } from './SettingsModal'
import { ToastProvider } from '@/components/feedback/Toast'
import { useSettingsStore } from '@/stores/settingsStore'
import { useTaskStore } from '@/stores/taskStore'
import { buildExportPayload, serializeExportData } from '@/utils/dataExport'
import { zh } from '@/i18n/zh'
import { en } from '@/i18n/en'

let container: HTMLDivElement
let root: Root
let api: { saveFile: ReturnType<typeof vi.fn>; selectSyncDirectory: ReturnType<typeof vi.fn>;
  readSyncFile: ReturnType<typeof vi.fn>; writeSyncFile: ReturnType<typeof vi.fn> }

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  localStorage.clear()
  localStorage.setItem('anvilite-sync-dir', 'synthetic-unused-sync-root')
  useTaskStore.setState({ tasks: [], customTaskGroups: [] })
  useSettingsStore.getState().setLanguage('zh')
  api = { saveFile: vi.fn(),
    selectSyncDirectory: vi.fn().mockResolvedValue({ success: true, path: 'synthetic-unused-sync-root' }),
    readSyncFile: vi.fn().mockResolvedValue({ success: true, exists: false }),
    writeSyncFile: vi.fn(),
  }
  Object.assign(window, { electronAPI: api })
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
})
afterEach(async () => {
  await act(async () => { root.unmount() })
  container.remove()
  delete window.electronAPI
  vi.restoreAllMocks()
})

function button(label: string, last = false): HTMLButtonElement {
  const matches = Array.from(container.querySelectorAll('button')).filter(node => node.textContent?.trim() === label)
  expect(matches.length, `Missing button: ${label}`).toBeGreaterThan(0)
  return last ? matches.at(-1)! : matches[0]
}
async function click(node: Element) {
  await act(async () => { node.dispatchEvent(new MouseEvent('click', { bubbles: true })) })
}
async function render() {
  await act(async () => { root.render(React.createElement(ToastProvider, null,
    React.createElement(SettingsModal, { open: true, onClose: vi.fn() }))) })
}

it.each(['zh', 'en'] as const)('unlocks actual sync controls after a rejected write and supports retry (%s)', async (lang) => {
  const t = lang === 'zh' ? zh : en
  useSettingsStore.getState().setLanguage(lang)
  api.writeSyncFile.mockRejectedValueOnce(new Error('ENOSPC: synthetic disk full')).mockResolvedValue({ success: true })
  await render()
  await click(button(t.data_syncSave))
  expect(api.writeSyncFile).toHaveBeenCalledTimes(1)
  expect(container.querySelector('[role="alert"]')?.textContent).toContain(t.data_syncError)
  expect(button(t.data_syncSave).disabled).toBe(false)
  expect(button(t.data_syncChangeFolder).disabled).toBe(false)
  await click(button(t.data_syncSave))
  expect(api.writeSyncFile).toHaveBeenCalledTimes(2)
  expect(container.querySelector('[role="alert"]')).toBeNull()
  expect(container.textContent).toContain(t.data_syncWrote)
  expect(button(t.data_syncSave).disabled).toBe(false)
})

it.each(['zh', 'en'] as const)('prompts for this-session directory approval and recovers after native reselection (%s)', async (lang) => {
  const t = lang === 'zh' ? zh : en
  useSettingsStore.getState().setLanguage(lang)
  api.readSyncFile.mockResolvedValueOnce({ success: false, error: 'directory_not_authorized' })
    .mockResolvedValue({ success: true, exists: false })
  api.writeSyncFile.mockResolvedValue({ success: true })
  await render()
  expect(container.querySelector('[role="alert"]')?.textContent).toContain(t.data_syncReselectFolder)
  await click(button(t.data_syncChooseFolder))
  expect(api.selectSyncDirectory).toHaveBeenCalledOnce()
  expect(container.querySelector('[role="alert"]')).toBeNull()
  expect(button(t.data_syncSave).disabled).toBe(false)
  await click(button(t.data_syncSave))
  expect(container.textContent).toContain(t.data_syncWrote)
})

it.each(['zh', 'en'] as const)('keeps local records after backup failure, closes the actual restore dialog, then permits retry (%s)', async (lang) => {
  const t = lang === 'zh' ? zh : en
  useSettingsStore.getState().setLanguage(lang)
  const incoming = serializeExportData(buildExportPayload())
  useTaskStore.getState().addTask({ title: 'Synthetic current record' })
  const originalTasks = localStorage.getItem('anvilite-tasks')
  api.readSyncFile.mockResolvedValue({ success: true, exists: true, content: incoming })
  api.writeSyncFile.mockRejectedValueOnce(new Error('synthetic unavailable drive')).mockResolvedValue({ success: true })
  const reload = vi.spyOn(window.location, 'reload').mockImplementation(() => {})
  await render()
  await click(button(t.data_syncRestore))
  await click(button(t.data_syncRestore, true))
  expect(container.querySelector('[role="alert"]')?.textContent).toContain(t.data_syncError)
  expect(localStorage.getItem('anvilite-tasks')).toBe(originalTasks)
  expect(reload).not.toHaveBeenCalled()
  expect(button(t.data_syncRestore).disabled).toBe(false)
  expect(container.textContent).not.toContain(t.data_syncRestoreConfirmTitle)
  await click(button(t.data_syncRestore))
  await click(button(t.data_syncRestore, true))
  expect(reload).toHaveBeenCalledOnce()
  expect(JSON.parse(localStorage.getItem('anvilite-tasks')!).state.tasks).toEqual([])
})

it.each(['zh', 'en'] as const)('does not announce a successful export when the native save dialog is canceled (%s)', async (lang) => {
  const t = lang === 'zh' ? zh : en
  useSettingsStore.getState().setLanguage(lang)
  api.saveFile.mockResolvedValue({ success: false, canceled: true })
  await render()
  const exportButton = Array.from(container.querySelectorAll('button')).find(node => node.textContent?.includes(t.data_export))
  expect(exportButton).toBeDefined()
  await click(exportButton!)
  expect(api.saveFile).toHaveBeenCalledOnce()
  expect(container.textContent).not.toContain(t.data_exportSuccess)
  expect(container.textContent).not.toContain(t.data_exportError)
})
