// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { JSONContent } from '@tiptap/react'
import type { SOPStep } from '@/types/sop'

vi.hoisted(() => {
  vi.stubGlobal('window', document.defaultView)
  vi.stubGlobal('localStorage', document.defaultView!.localStorage)
})
import { SOPTree } from './SOPTree'
import { SOPStepListView } from './SOPStepListView'
import { SOPRichEditor } from './SOPRichEditor'
import { FlowsSummaryCard } from '@/components/dashboard/FlowsSummaryCard'
import { useSOPStore } from '@/stores/sopStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { getSystemSOPs, SYSTEM_FOLDER_ID } from '@/data/systemSOPs'
import { resolveSOPLibrary } from '@/utils/sopLibrary'
import { endSOPDrag, SOP_DRAG_MIME } from '@/utils/sopDrag'
import { zh } from '@/i18n/zh'
import { en } from '@/i18n/en'

let container: HTMLDivElement
let root: Root
const dictionaries = { zh, en }
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  localStorage.clear()
  useSOPStore.setState({ folders: [], sops: [], selectedSOPId: null, collapsedFolderIds: [], deletedSystemFolderIds: [], deletedSystemSOPIds: [] })
  useSettingsStore.getState().setLanguage('zh')
  container = document.createElement('div'); document.body.append(container); root = createRoot(container)
})
afterEach(async () => {
  endSOPDrag()
  await act(async () => root.unmount())
  container.remove()
  vi.restoreAllMocks()
})
async function render(node: React.ReactNode = React.createElement(SOPTree, { onNewSOP: vi.fn() })) {
  await act(async () => root.render(node))
}
async function click(element: Element) { await act(async () => element.dispatchEvent(new MouseEvent('click', { bubbles: true }))) }
async function context(element: Element) { await act(async () => element.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 880, clientY: 590 }))) }
function button(text: string) {
  const node = [...container.querySelectorAll('button')].find(element => element.textContent?.trim() === text)
  expect(node, text).toBeDefined(); return node!
}
function folder(id: string) { const node = container.querySelector(`[data-sop-folder="${id}"]`); expect(node).not.toBeNull(); return node! }
function row(id: string) { const node = container.querySelector(`[data-sop-id="${id}"]`); expect(node).not.toBeNull(); return node! }
function library(lang: 'zh' | 'en' = 'zh') { return resolveSOPLibrary(useSOPStore.getState(), lang) }
function step(id: string, childSteps: SOPStep[] = [], content: JSONContent | null = null): SOPStep {
  return { id, title: id, content, time: '12:34', sortOrder: 0, childSteps }
}
const rich: JSONContent = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Rich retained text', marks: [{ type: 'bold' }] }] }] }
function deepSteps() { return [step('PARENT', [step('CHILD', [step('GRANDCHILD', [], rich)], rich)], rich)] }
function addSOP(folderId: string, title = 'User flow', steps = deepSteps()) {
  return useSOPStore.getState().addSOP({ title, folderId, steps, displayStyle: 'timeline', isSystem: false })
}
function transfer() {
  const values = new Map<string, string>()
  return {
    types: [] as string[], effectAllowed: 'none', dropEffect: 'none',
    setData(this: { types: string[] }, type: string, value: string) { values.set(type, value); this.types = [...values.keys()] },
    getData(type: string) { return values.get(type) ?? '' },
  } as unknown as DataTransfer
}
async function drag(type: string, node: Element, dataTransfer: DataTransfer, relatedTarget: Element | null = null) {
  const event = new Event(type, { bubbles: true, cancelable: true })
  Object.defineProperties(event, { dataTransfer: { value: dataTransfer }, relatedTarget: { value: relatedTarget } })
  await act(async () => node.dispatchEvent(event))
  return event
}

it.each(['zh', 'en'] as const)('shows useful system folder and flow context menus, including actual edit callback (%s)', async lang => {
  const t = dictionaries[lang]
  useSettingsStore.getState().setLanguage(lang)
  const onNewSOP = vi.fn(), onEditSOP = vi.fn()
  await render(React.createElement(SOPTree, { onNewSOP, onEditSOP }))
  await context(folder(SYSTEM_FOLDER_ID))
  const menu = container.querySelector('[data-sop-context-menu="folder"]')!
  expect(menu.querySelectorAll('button').length).toBeGreaterThanOrEqual(4)
  expect(menu.textContent).toContain(t.sop_contextMenu_rename)
  expect(menu.textContent).toContain(t.sop_contextMenu_deleteAll)
  await click(button(t.sop_contextMenu_newSOP))
  expect(onNewSOP).toHaveBeenCalledWith(SYSTEM_FOLDER_ID)
  const system = getSystemSOPs(lang)[0]
  await context(row(system.id)); await click(button(t.sop_contextMenu_edit))
  expect(onEditSOP).toHaveBeenCalledWith(system.id)
})

it.each(['zh', 'en'] as const)('copies a system flow from its menu with a real destination even with no user folders (%s)', async lang => {
  const t = dictionaries[lang]
  useSettingsStore.getState().setLanguage(lang)
  const system = getSystemSOPs(lang)[0]
  useSOPStore.getState().updateSOP(system.id, { steps: deepSteps() }, lang)
  await render()
  await context(row(system.id)); await click(button(t.sop_copyToMine))
  const state = useSOPStore.getState()
  const copy = state.sops.find(sop => sop.id === state.selectedSOPId)!
  expect(copy.id).not.toBe(system.id)
  expect(state.folders.find(item => item.id === copy.folderId)?.name).toBe(t.sop_myFlows)
  expect(library(lang).sops.some(sop => sop.id === system.id)).toBe(true)
  const original = state.sops.find(sop => sop.id === system.id)!
  expect(copy.steps[0].childSteps[0].childSteps[0].title).toBe('GRANDCHILD')
  expect(copy.steps[0].childSteps[0].childSteps[0].content).toEqual(rich)
  expect(copy.steps[0].id).not.toBe(original.steps[0].id)
  expect(copy.steps[0].childSteps[0].id).not.toBe(original.steps[0].childSteps[0].id)
  expect(copy.steps[0].childSteps[0].childSteps[0].id).not.toBe(original.steps[0].childSteps[0].childSteps[0].id)
  expect(copy.steps[0].content).not.toBe(original.steps[0].content)
})

it('moves a user flow into another folder without replacing its identity or nested data', async () => {
  const source = useSOPStore.getState().addFolder('Source')
  const target = useSOPStore.getState().addFolder('Target')
  const id = addSOP(source)
  const before = useSOPStore.getState().sops.find(sop => sop.id === id)!
  await render()
  const data = transfer()
  await drag('dragstart', row(id), data)
  expect((await drag('dragover', folder(target), data)).defaultPrevented).toBe(true)
  expect(folder(target).getAttribute('data-sop-drop-active')).toBe('true')
  expect(folder(target).textContent).toContain(zh.sop_dropMove)
  await drag('drop', folder(target), data)
  expect(folder(target).getAttribute('data-sop-drop-active')).toBe('false')
  expect(useSOPStore.getState().sops).toHaveLength(1)
  expect(useSOPStore.getState().sops[0]).toMatchObject({ id, folderId: target, steps: before.steps })
  expect(useSOPStore.getState().selectedSOPId).toBe(id)
})

it('copies system descendants on drop, preserves the source and consumes the gesture once', async () => {
  const childFolder = useSOPStore.getState().addFolder('My system templates', SYSTEM_FOLDER_ID)
  const target = useSOPStore.getState().addFolder('Destination')
  const sourceId = addSOP(childFolder, 'Custom template')
  await render()
  const data = transfer()
  await drag('dragstart', row(sourceId), data)
  await drag('dragover', folder(target), data)
  expect(folder(target).textContent).toContain(zh.sop_dropCopy)
  await drag('drop', folder(target), data)
  const copies = useSOPStore.getState().sops.filter(sop => sop.folderId === target)
  expect(copies).toHaveLength(1)
  expect(copies[0].id).not.toBe(sourceId)
  expect(library().sops.find(sop => sop.id === sourceId)?.folderId).toBe(childFolder)
  const count = useSOPStore.getState().sops.length
  await drag('drop', folder(target), data)
  expect(useSOPStore.getState().sops).toHaveLength(count)
})

it('rejects external, forged, stale and canceled drops without moving any flow', async () => {
  const source = useSOPStore.getState().addFolder('Source')
  const target = useSOPStore.getState().addFolder('Target')
  const id = addSOP(source)
  await render()
  const before = JSON.stringify(useSOPStore.getState().sops)
  const external = transfer(); external.setData(SOP_DRAG_MIME, id); external.setData('text/plain', id)
  expect((await drag('dragover', folder(target), external)).defaultPrevented).toBe(false)
  await drag('drop', folder(target), external)
  expect(JSON.stringify(useSOPStore.getState().sops)).toBe(before)
  const stale = transfer(), current = transfer()
  await drag('dragstart', row(id), stale)
  await drag('dragstart', row(id), current)
  await drag('drop', folder(target), stale)
  expect(JSON.stringify(useSOPStore.getState().sops)).toBe(before)
  const data = transfer()
  await drag('dragstart', row(id), data); await drag('dragover', folder(target), data)
  expect(folder(target).getAttribute('data-sop-drop-active')).toBe('true')
  await act(async () => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })))
  expect(folder(target).getAttribute('data-sop-drop-active')).toBe('false')
  await drag('drop', folder(target), data)
  expect(JSON.stringify(useSOPStore.getState().sops)).toBe(before)
})

it.each(['zh', 'en'] as const)('deletes the system folder across tree, dashboard summary and rich links without revival (%s)', async lang => {
  const t = dictionaries[lang]
  useSettingsStore.getState().setLanguage(lang)
  const system = getSystemSOPs(lang)[0]
  const userFolder = useSOPStore.getState().addFolder('Keep user flows')
  const sourceId = addSOP(userFolder, 'Source link', [step('LINK', [], { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'sopLink', attrs: { sopId: system.id, sopTitle: system.title } }] }] })])
  const source = useSOPStore.getState().sops.find(sop => sop.id === sourceId)!
  window.confirm = vi.fn().mockReturnValue(true)
  await render(React.createElement(React.Fragment, null,
    React.createElement(SOPTree, { onNewSOP: vi.fn() }), React.createElement(FlowsSummaryCard, { onNavigate: vi.fn() }),
    React.createElement(SOPStepListView, { sop: source, executionMode: false, checkedIds: new Set<string>(), onToggle: vi.fn() })))
  expect(container.querySelector('[data-sop-summary-id="' + system.id + '"]')).not.toBeNull()
  expect(container.querySelector('[data-sop-link]')).not.toBeNull()
  await context(folder(SYSTEM_FOLDER_ID)); await click(button(t.sop_contextMenu_deleteAll))
  expect(container.querySelector('[data-sop-folder="' + SYSTEM_FOLDER_ID + '"]')).toBeNull()
  expect(container.querySelector('[data-sop-summary-id="' + system.id + '"]')).toBeNull()
  expect(container.querySelector('[data-sop-link]')).toBeNull()
  expect(container.textContent).toContain(t.sop_linkedDeleted)
  expect(useSOPStore.getState().deletedSystemFolderIds).toContain(SYSTEM_FOLDER_ID)
  await act(async () => { useSettingsStore.getState().setLanguage(lang === 'zh' ? 'en' : 'zh'); await useSOPStore.persist.rehydrate() })
  expect(container.querySelector('[data-sop-folder="' + SYSTEM_FOLDER_ID + '"]')).toBeNull()
  expect(library().sops.some(sop => sop.id === sourceId)).toBe(true)
})

it('offers valid system links, excludes the edited flow and removes deleted templates from the picker', async () => {
  const userFolder = useSOPStore.getState().addFolder('User folder')
  const sourceId = addSOP(userFolder, 'Edited flow')
  const system = getSystemSOPs('zh')[0]
  await render(React.createElement(SOPRichEditor, { content: null, onChange: vi.fn(), currentSOPId: sourceId }))
  await click(container.querySelector('[title="' + zh.sop_linkSOP + '"]')!)
  expect(container.querySelector('[data-sop-link-option="' + sourceId + '"]')).toBeNull()
  expect(container.querySelector('[data-sop-link-option="' + system.id + '"]')).not.toBeNull()
  await act(async () => useSOPStore.getState().deleteSOP(system.id))
  expect(container.querySelector('[data-sop-link-option="' + system.id + '"]')).toBeNull()
})
