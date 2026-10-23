// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import type { SOPStep } from '@/types/sop'
vi.hoisted(() => { vi.stubGlobal('window', document.defaultView) })
import { SOPPage } from './SOPPage'
import { SOPEditor } from './SOPEditor'
import { useSOPStore } from '@/stores/sopStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { getSystemSOPs, SYSTEM_FOLDER_ID } from '@/data/systemSOPs'
import { zh } from '@/i18n/zh'
import { en } from '@/i18n/en'

let container: HTMLDivElement
let root: Root
const dictionaries = { zh, en }
function button(label: string, last = false): HTMLButtonElement {
  const found = Array.from(container.querySelectorAll('button')).filter((node) => node.textContent?.trim() === label)
  expect(found.length, `Missing button: ${label}`).toBeGreaterThan(0)
  return last ? found[found.length - 1] : found[0]
}
async function click(node: Element) {
  await act(async () => { node.dispatchEvent(new MouseEvent('click', { bubbles: true })) })
}
async function type(input: HTMLInputElement, value: string) {
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value)
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
}
async function render(node: React.ReactNode = React.createElement(SOPPage)) {
  await act(async () => { root.render(node) })
}
function titleInput(placeholder: string): HTMLInputElement {
  const input = container.querySelector<HTMLInputElement>(`input[placeholder="${placeholder}"]`)
  expect(input).not.toBeNull()
  return input!
}
function step(id: string, children: SOPStep[] = []): SOPStep {
  return { id, title: id, childSteps: children, content: null, time: null, sortOrder: 0 }
}
function allIds(steps: SOPStep[]): string[] { return steps.flatMap((item) => [item.id, ...allIds(item.childSteps)]) }

beforeEach(() => {
  vi.stubGlobal('window', document.defaultView)
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  localStorage.clear(); window.localStorage.clear()
  useSettingsStore.getState().setLanguage('zh')
  useSOPStore.setState({ ...useSOPStore.getInitialState(), folders: [], sops: [], selectedSOPId: null, collapsedFolderIds: [] })
  container = document.createElement('div'); document.body.append(container); root = createRoot(container)
})
afterEach(async () => {
  await act(async () => { root.unmount() })
  container.remove()
})

describe('system SOP page and editor', () => {
  it.each(['zh', 'en'] as const)('cancels system edits and inline folders without persisting drafts (%s)', async (lang) => {
    const t = dictionaries[lang]
    useSettingsStore.getState().setLanguage(lang)
    const original = getSystemSOPs(lang)[0]
    useSOPStore.getState().selectSOP(original.id)
    await render()
    expect(useSOPStore.getState().sops).toEqual([])
    await click(button(t.common_edit))
    expect(titleInput(t.sop_titlePlaceholder).value).toBe(original.title)
    await type(titleInput(t.sop_titlePlaceholder), 'Canceled title')
    await click(button(`+ ${t.sop_newFolderInline}`))
    await type(titleInput(t.sop_newFolderInline), 'Canceled folder')
    await click(button(t.common_save))
    expect(useSOPStore.getState().folders).toEqual([])
    expect(useSOPStore.getState().sops).toEqual([])
    await click(button(t.common_cancel))
    expect(container.querySelector('h2')?.textContent).toBe(original.title)
    expect(useSOPStore.getState().folders).toEqual([])
    expect(useSOPStore.getState().sops).toEqual([])
  })

  it.each(['zh', 'en'] as const)('saves a system edit as an override and reopens the edited content (%s)', async (lang) => {
    const t = dictionaries[lang]
    useSettingsStore.getState().setLanguage(lang)
    const original = getSystemSOPs(lang)[0]
    useSOPStore.getState().selectSOP(original.id)
    await render()
    await click(button(t.common_edit))
    await type(titleInput(t.sop_titlePlaceholder), 'Saved system edit')
    await type(titleInput(t.sop_stepPlaceholder), 'Saved first step')
    expect(useSOPStore.getState().sops).toEqual([])
    await click(button(t.common_save))
    const saved = useSOPStore.getState().sops.find((item) => item.id === original.id)!
    expect(saved).toMatchObject({ title: 'Saved system edit', folderId: SYSTEM_FOLDER_ID })
    expect(saved.steps[0].title).toBe('Saved first step')
    expect(container.querySelector('h2')?.textContent).toBe('Saved system edit')
    await act(async () => { await useSOPStore.persist.rehydrate() })
    await click(button(t.common_edit))
    expect(titleInput(t.sop_titlePlaceholder).value).toBe('Saved system edit')
    expect(titleInput(t.sop_stepPlaceholder).value).toBe('Saved first step')
  })

  it.each(['zh', 'en'] as const)('creates a new flow directly in the system folder and selects it after saving (%s)', async (lang) => {
    const t = dictionaries[lang]
    useSettingsStore.getState().setLanguage(lang)
    await render()
    const newFlow = Array.from(container.querySelectorAll('div')).find((node) => node.childElementCount === 0 && node.textContent?.trim() === `+ ${t.sop_create}`)!
    await click(newFlow)
    await type(titleInput(t.sop_titlePlaceholder), 'New system-folder flow')
    await click(button(`+ ${t.sop_addStep}`))
    await type(titleInput(t.sop_stepPlaceholder), 'New system-folder step')
    expect(useSOPStore.getState().sops).toEqual([])
    await click(button(t.common_save))
    const created = useSOPStore.getState().sops[0]
    expect(created).toMatchObject({ title: 'New system-folder flow', folderId: SYSTEM_FOLDER_ID, isSystem: false })
    expect(created.steps[0].title).toBe('New system-folder step')
    expect(useSOPStore.getState().selectedSOPId).toBe(created.id)
    expect(container.querySelector('h2')?.textContent).toBe(created.title)
  })

  it.each(['zh', 'en'] as const)('persists an inline folder only when the enclosing editor is saved (%s)', async (lang) => {
    const t = dictionaries[lang]
    useSettingsStore.getState().setLanguage(lang)
    const original = getSystemSOPs(lang)[0]
    await render(React.createElement(SOPEditor, { sopId: original.id, onSave: vi.fn(), onCancel: vi.fn() }))
    await click(button(`+ ${t.sop_newFolderInline}`))
    await type(titleInput(t.sop_newFolderInline), 'Saved draft folder')
    await click(button(t.common_save))
    expect(useSOPStore.getState().folders).toEqual([])
    await click(button(t.common_save, true))
    const folder = useSOPStore.getState().folders.find((item) => item.name === 'Saved draft folder')!
    expect(folder).toBeDefined()
    expect(useSOPStore.getState().sops.find((item) => item.id === original.id)?.folderId).toBe(folder.id)
  })

  it.each(['zh', 'en'] as const)('copies the effective system template recursively and creates a personal folder if needed (%s)', async (lang) => {
    const t = dictionaries[lang]
    useSettingsStore.getState().setLanguage(lang)
    const original = getSystemSOPs(lang)[0]
    const steps = [step('LEVEL_ONE', [step('LEVEL_TWO', [step('LEVEL_THREE')])])]
    useSOPStore.getState().updateSOP(original.id, { title: 'Edited nested template', steps }, lang)
    useSOPStore.getState().selectSOP(original.id)
    await render()
    await click(button(t.sop_copyToMine))
    const state = useSOPStore.getState()
    const folder = state.folders.find((item) => item.name === t.sop_myFlows)!
    const copied = state.sops.find((item) => item.id !== original.id)!
    expect(folder).toBeDefined()
    expect(copied).toMatchObject({ folderId: folder.id, isSystem: false })
    expect(copied.title).toContain('Edited nested template')
    expect(copied.steps[0].childSteps[0].childSteps[0].title).toBe('LEVEL_THREE')
    expect(allIds(copied.steps).some((id) => allIds(steps).includes(id))).toBe(false)
    expect(state.sops.find((item) => item.id === original.id)?.steps).toEqual(steps)
    expect(state.selectedSOPId).toBe(copied.id)
  })

  it.each(['zh', 'en'] as const)('deletes a system template from the page and keeps it deleted across languages (%s)', async (lang) => {
    const t = dictionaries[lang]
    useSettingsStore.getState().setLanguage(lang)
    const original = getSystemSOPs(lang)[0]
    useSOPStore.getState().selectSOP(original.id)
    await render()
    await click(button(t.common_delete))
    expect(useSOPStore.getState().selectedSOPId).toBeNull()
    expect(useSOPStore.getState().deletedSystemSOPIds).toContain(original.id)
    const otherLanguage = lang === 'zh' ? 'en' : 'zh'
    await act(async () => { useSettingsStore.getState().setLanguage(otherLanguage); await useSOPStore.persist.rehydrate() })
    const otherTitle = getSystemSOPs(otherLanguage)[0].title
    expect(Array.from(container.querySelectorAll('span')).some((node) => node.textContent === otherTitle)).toBe(false)
  })

  it.each(['zh', 'en'] as const)('opens a different system template directly from its context edit action (%s)', async (lang) => {
    const t = dictionaries[lang]
    useSettingsStore.getState().setLanguage(lang)
    const templates = getSystemSOPs(lang)
    useSOPStore.getState().selectSOP(templates[0].id)
    await render()
    const treeTitle = Array.from(container.querySelectorAll('span')).find((node) => node.textContent === templates[1].title)!
    await act(async () => { treeTitle.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, button: 2 })) })
    await click(button(t.sop_contextMenu_edit))
    expect(useSOPStore.getState().selectedSOPId).toBe(templates[1].id)
    expect(titleInput(t.sop_titlePlaceholder).value).toBe(templates[1].title)
    expect(useSOPStore.getState().sops).toEqual([])
  })
})
