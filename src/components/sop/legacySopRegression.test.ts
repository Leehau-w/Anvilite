// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import type { Editor } from '@tiptap/core'
import type { JSONContent } from '@tiptap/react'
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import type { SOP, SOPStep } from '@/types/sop'

// The shared node setup uses a minimal window; restore this file's isolated DOM
// before React DOM determines which input events the environment supports.
vi.hoisted(() => { vi.stubGlobal('window', document.defaultView) })

import { useSOPStore } from '@/stores/sopStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { SOPPage } from './SOPPage'
import { SOPEditor } from './SOPEditor'
import { SOPStepListView } from './SOPStepListView'
import { SOPRichEditor } from './SOPRichEditor'
import { getSystemSOPs } from '@/data/systemSOPs'
import { zh } from '@/i18n/zh'
import { en } from '@/i18n/en'

let container: HTMLDivElement
let root: Root
const dictionaries = { zh, en }

function step(id: string, childSteps: SOPStep[] = []): SOPStep {
  return { id, title: id, content: null, time: null, sortOrder: 0, childSteps }
}
function sop(id = 'source', displayStyle: SOP['displayStyle'] = 'numbered'): SOP {
  return {
    id, title: `Flow ${id}`, folderId: 'test-folder', displayStyle,
    steps: [step('LEVEL_ONE', [step('LEVEL_TWO', [step('LEVEL_THREE')])])],
    isSystem: false, lastUsedAt: null, sortOrder: 0,
    createdAt: '2026-09-11T12:00:00Z', updatedAt: '2026-09-11T12:00:00Z',
  }
}
function linkContent(id = 'linked-target', title = 'Linked target'): JSONContent {
  return { type: 'doc', content: [{ type: 'paragraph', content: [
    { type: 'sopLink', attrs: { sopId: id, sopTitle: title } },
  ] }] }
}
function button(label: string): HTMLButtonElement {
  const found = Array.from(container.querySelectorAll('button')).find((node) => node.textContent?.trim() === label)
  expect(found, `Missing button: ${label}`).toBeDefined()
  return found!
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
async function render(node: React.ReactNode) {
  await act(async () => { root.render(node) })
}
function activeEditor(): Editor {
  const element = container.querySelector<HTMLElement & { editor: Editor }>('.tiptap')
  expect(element).not.toBeNull()
  return element!.editor
}

beforeEach(() => {
  vi.stubGlobal('window', document.defaultView)
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  localStorage.clear()
  window.localStorage.clear()
  useSettingsStore.getState().setLanguage('zh')
  useSOPStore.setState({
    folders: [{ id: 'test-folder', name: 'Test folder', parentId: null, sortOrder: 0,
      isSystem: false, createdAt: '2026-09-11T12:00:00Z' }],
    sops: [], selectedSOPId: null, collapsedFolderIds: [],
  })
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
})
afterEach(async () => {
  await act(async () => { root.unmount() })
  container.remove()
})

describe('legacy SOP regressions', () => {
  it.each(['zh', 'en'] as const)('creates the first flow with no selected SOP (%s)', async (lang) => {
    const t = dictionaries[lang]
    useSettingsStore.getState().setLanguage(lang)
    await render(React.createElement(SOPPage))
    const newFlow = Array.from(container.querySelectorAll('div')).filter(
      (node) => node.childElementCount === 0 && node.textContent?.trim() === `+ ${t.sop_create}`,
    ).at(-1)
    expect(newFlow).toBeDefined()
    await click(newFlow!)
    const title = container.querySelector<HTMLInputElement>(`input[placeholder="${t.sop_titlePlaceholder}"]`)
    expect(title).not.toBeNull()
    await type(title!, 'First saved flow')
    await click(button(t.common_save))
    expect(useSOPStore.getState().sops).toHaveLength(1)
    expect(useSOPStore.getState().sops[0]).toMatchObject({ title: 'First saved flow', folderId: 'test-folder' })
  })

  it.each(['zh', 'en'] as const)('keeps drafts isolated when switching from editing to another flow (%s)', async (lang) => {
    const t = dictionaries[lang]
    useSettingsStore.getState().setLanguage(lang)
    const first = { ...sop('first'), steps: [] }
    const second = { ...sop('second'), steps: [] }
    useSOPStore.setState({ sops: [first, second], selectedSOPId: first.id })
    await render(React.createElement(SOPPage))
    await click(button(t.common_edit))
    await type(container.querySelector<HTMLInputElement>(`input[placeholder="${t.sop_titlePlaceholder}"]`)!, 'Unsaved first draft')
    const secondRow = Array.from(container.querySelectorAll('span')).find((node) => node.textContent === second.title)!
    await click(secondRow)
    await click(button(t.common_edit))
    expect(container.querySelector<HTMLInputElement>(`input[placeholder="${t.sop_titlePlaceholder}"]`)!.value).toBe(second.title)
    await click(button(t.common_cancel))
    expect(useSOPStore.getState().sops.map((item) => item.title)).toEqual([first.title, second.title])
  })

  it.each(['zh', 'en'] as const)('saves and reopens a flow-link-only detail (%s)', async (lang) => {
    const t = dictionaries[lang]
    useSettingsStore.getState().setLanguage(lang)
    const source = { ...sop(), steps: [step('SOURCE_STEP')] }
    const target = sop('linked-target')
    useSOPStore.setState({ sops: [source, target] })
    const onSave = vi.fn()
    await render(React.createElement(SOPEditor, { sopId: source.id, onSave, onCancel: vi.fn() }))
    await click(button(`+ ${t.sop_content_placeholder}`))
    const content = linkContent(target.id, target.title)
    await act(async () => { activeEditor().commands.setContent(content) })
    await click(button(t.common_save))
    expect(onSave).toHaveBeenCalledOnce()
    expect(useSOPStore.getState().sops.find((item) => item.id === source.id)?.steps[0].content).toEqual(content)
    // Re-mount from persisted store content, then re-open the actual rich editor.
    await render(React.createElement(SOPEditor, { key: 'reopened', sopId: source.id, onSave, onCancel: vi.fn() }))
    const detailButton = Array.from(container.querySelectorAll('button')).find((node) => node.textContent?.includes(target.title))!
    await click(detailButton)
    expect(activeEditor().getJSON()).toEqual(content)
    await click(button(t.common_save))
    expect(useSOPStore.getState().sops.find((item) => item.id === source.id)?.steps[0].content).toEqual(content)
  })

  it('saves an emptied detail and reopens it as an empty document', async () => {
    const source = { ...sop(), steps: [step('SOURCE_STEP')] }
    source.steps[0].content = linkContent()
    useSOPStore.setState({ sops: [source] })
    const props = { sopId: source.id, onSave: vi.fn(), onCancel: vi.fn() }
    await render(React.createElement(SOPEditor, props))
    await click(Array.from(container.querySelectorAll('button')).find((node) => node.textContent?.includes('Linked target'))!)
    await act(async () => { activeEditor().commands.setContent({ type: 'doc', content: [{ type: 'paragraph' }] }) })
    await click(button(zh.common_save))
    expect(useSOPStore.getState().sops[0].steps[0].content).toBeNull()
    await render(React.createElement(SOPEditor, { ...props, key: 'reopened-empty' }))
    await click(button(`+ ${zh.sop_content_placeholder}`))
    expect(activeEditor().isEmpty).toBe(true)
    expect(activeEditor().getJSON()).toEqual({ type: 'doc', content: [{ type: 'paragraph' }] })
  })

  it('starts a fresh draft when creating in a different folder', async () => {
    const first = useSOPStore.getState().folders[0]
    useSOPStore.setState({ folders: [first, { ...first, id: 'second-folder', name: 'Second folder', sortOrder: 1 }] })
    await render(React.createElement(SOPPage))
    const newFlowEntries = Array.from(container.querySelectorAll('div')).filter(
      (node) => node.childElementCount === 0 && node.textContent?.trim() === `+ ${zh.sop_create}`,
    ).slice(-2)
    await click(newFlowEntries[0])
    await type(container.querySelector<HTMLInputElement>(`input[placeholder="${zh.sop_titlePlaceholder}"]`)!, 'First folder draft')
    await click(newFlowEntries[1])
    expect(container.querySelector<HTMLInputElement>(`input[placeholder="${zh.sop_titlePlaceholder}"]`)!.value).toBe('')
    expect(container.querySelector<HTMLSelectElement>('select')!.value).toBe('second-folder')
    expect(useSOPStore.getState().sops).toHaveLength(0)
  })

  it('switches from a new draft to a selected existing flow', async () => {
    const existing = { ...sop('existing'), steps: [] }
    useSOPStore.setState({ sops: [existing] })
    await render(React.createElement(SOPPage))
    const newFlowEntry = Array.from(container.querySelectorAll('div')).find(
      (node) => node.childElementCount === 0 && node.textContent?.trim() === `+ ${zh.sop_create}`,
    )!
    await click(newFlowEntry)
    const existingRow = Array.from(container.querySelectorAll('span')).find((node) => node.textContent === existing.title)!
    await click(existingRow)
    expect(container.querySelector(`input[placeholder="${zh.sop_titlePlaceholder}"]`)).toBeNull()
    expect(container.querySelector('h2')?.textContent).toBe(existing.title)
    expect(useSOPStore.getState().sops).toHaveLength(1)
  })

  it.each([
    { type: 'doc', content: [{ type: 'paragraph' }] },
    { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: '   ' }] }] },
  ])('normalizes an empty or whitespace-only rich document to null', async (content) => {
    const onChange = vi.fn()
    await render(React.createElement(SOPRichEditor, { content: linkContent(), onChange }))
    await act(async () => { activeEditor().commands.setContent(content) })
    expect(onChange).toHaveBeenLastCalledWith(null)
  })

  it.each(['zh', 'en'] as const)('executes all three timeline levels and clears execution styling on exit (%s)', async (lang) => {
    const t = dictionaries[lang]
    useSettingsStore.getState().setLanguage(lang)
    const source = sop('source', 'timeline')
    useSOPStore.setState({ sops: [source], selectedSOPId: source.id })
    await render(React.createElement(SOPPage))
    expect(container.textContent).toContain('LEVEL_THREE')
    await click(button(`▶ ${t.sop_startExecution}`))
    expect(container.querySelectorAll('input[type="checkbox"]')).toHaveLength(3)
    for (const checkbox of Array.from(container.querySelectorAll('input[type="checkbox"]'))) await click(checkbox)
    expect(container.textContent).toContain(t.sop_progress(3, 3))
    expect(Array.from(container.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')).every((node) => node.checked)).toBe(true)
    await click(button(`■ ${t.sop_endExecution}`))
    expect(container.querySelectorAll('input[type="checkbox"]')).toHaveLength(0)
    for (const title of ['LEVEL_ONE', 'LEVEL_TWO', 'LEVEL_THREE']) {
      const node = Array.from(container.querySelectorAll<HTMLElement>('span,div')).find((item) => item.childElementCount === 0 && item.textContent === title)!
      expect(node.style.textDecoration).not.toBe('line-through')
    }
  })

  it.each(['zh', 'en'] as const)('navigates to a valid user or system SOP and disables a deleted reference (%s)', async (lang) => {
    const t = dictionaries[lang]
    useSettingsStore.getState().setLanguage(lang)
    const source = { ...sop(), steps: [step('SOURCE_STEP')] }
    const target = sop('linked-target')
    const system = getSystemSOPs(lang)[0]
    useSOPStore.setState({ sops: [source, target], selectedSOPId: source.id })
    for (const destination of [target, system]) {
      source.steps[0].content = linkContent(destination.id, destination.title)
      await render(React.createElement(SOPStepListView, {
        sop: source, executionMode: false, checkedIds: new Set<string>(), onToggle: vi.fn(),
      }))
      const link = container.querySelector('[data-sop-link]')!
      expect(link.getAttribute('data-sopid')).toBe(destination.id)
      await click(link)
      expect(useSOPStore.getState().selectedSOPId).toBe(destination.id)
    }
    source.steps[0].content = linkContent('missing', 'Deleted flow')
    await render(React.createElement(SOPStepListView, {
      sop: source, executionMode: false, checkedIds: new Set<string>(), onToggle: vi.fn(),
    }))
    expect(container.querySelector('[data-sop-link]')).toBeNull()
    expect(container.textContent).toContain(t.sop_linkedDeleted)
    await click(container.querySelector('.sop-content-view')!)
    expect(useSOPStore.getState().selectedSOPId).toBe(system.id)
  })

  it('parses the legacy SOP link HTML attribute without losing its target', async () => {
    await render(React.createElement(SOPRichEditor, { content: null, onChange: vi.fn() }))
    await act(async () => {
      activeEditor().commands.setContent('<p><span data-sop-link sopid="legacy-target" soptitle="Legacy">Legacy</span></p>')
    })
    expect(activeEditor().getJSON().content?.[0].content?.[0]).toMatchObject({
      type: 'sopLink', attrs: { sopId: 'legacy-target', sopTitle: 'Legacy' },
    })
    expect(activeEditor().getHTML()).toContain('data-sopid="legacy-target"')
  })
})
