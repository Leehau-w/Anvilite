// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { beforeEach, afterEach, expect, it, vi } from 'vitest'
vi.hoisted(() => { vi.stubGlobal('window', document.defaultView) })
import { QuickInput } from './QuickInput'
import { TaskList } from './TaskList'
import { TaskDrawer } from './TaskDrawer'
import { TaskCardFilterButton } from '@/components/dashboard/TaskCardFilter'
import { useAreaStore } from '@/stores/areaStore'
import { useTaskStore } from '@/stores/taskStore'
import { useHabitStore } from '@/stores/habitStore'
import { useCharacterStore } from '@/stores/characterStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { useDashboardStore } from '@/stores/dashboardStore'
import { zh } from '@/i18n/zh'
import { en } from '@/i18n/en'

let root: Root, container: HTMLDivElement
async function click(node: Element) { await act(async () => { node.dispatchEvent(new MouseEvent('click', { bubbles: true })) }) }
async function type(input: HTMLInputElement, value: string) {
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value)
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
}
function dialog() { return document.querySelector<HTMLFormElement>('[data-category-creator]')! }
async function submit() { await act(async () => { dialog().dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })) }) }
async function render(node: React.ReactNode) { await act(async () => { root.render(node) }) }
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  window.localStorage.clear()
  useAreaStore.setState({ areas: useAreaStore.getInitialState().areas })
  useTaskStore.setState({ tasks: [], lastCategory: 'home', customTaskGroups: [] })
  useHabitStore.setState({ habits: [] })
  useCharacterStore.setState({ character: { ...useCharacterStore.getInitialState().character } })
  useDashboardStore.setState({ layout: useDashboardStore.getInitialState().layout })
  useSettingsStore.getState().setLanguage('zh')
  container = document.createElement('div'); document.body.append(container); root = createRoot(container)
})
afterEach(async () => { await act(async () => { root.unmount() }); container.remove(); vi.restoreAllMocks() })

it.each(['zh','en'] as const)('creates a shared category after the Other task tab and preserves the task draft (%s)', async lang => {
  const t = lang === 'zh' ? zh : en
  useSettingsStore.getState().setLanguage(lang)
  await render(React.createElement(TaskList))
  const tabs = container.querySelector('[data-task-category-tabs]')!
  const other = tabs.querySelector('[data-task-category-tab="other"]')!
  expect(other.nextElementSibling?.querySelector('[data-create-category]')).not.toBeNull()
  expect(tabs.querySelectorAll('[data-create-category]')).toHaveLength(1)
  expect(container.querySelector('select')!.parentElement!.querySelector('[data-create-category]')).toBeNull()
  const hidden = container.querySelector('[title="' + t.tasklist_hiddenTooltip + '"]')!
  const trash = container.querySelector('[title="' + t.tasklist_trashTooltip + '"]')!
  expect(tabs.contains(hidden)).toBe(false)
  expect(tabs.contains(trash)).toBe(false)
  expect(tabs.compareDocumentPosition(hidden) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  const draft = container.querySelector('input')!
  await type(draft, 'Ask the client')
  await click(container.querySelector('[data-create-category]')!)
  expect(dialog().getAttribute('aria-label')).toBe(t.category_create)
  await type(dialog().querySelector('input')!, '  Client projects  ')
  await submit()
  expect(dialog()).toBeNull()
  expect(container.querySelector('select')!.value).toBe('Client projects')
  expect(container.querySelector('[data-task-category-tab="Client projects"]')!.getAttribute('aria-pressed')).toBe('true')
  expect(draft.value).toBe('Ask the client')
  expect(useTaskStore.getState().tasks).toHaveLength(0)
  await act(async () => { draft.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })) })
  expect(useTaskStore.getState().tasks[0]).toMatchObject({ title: 'Ask the client', category: 'Client projects' })
  expect(JSON.parse(window.localStorage.getItem('anvilite-areas')!).state.areas.some((area: { category: string }) => area.category === 'Client projects')).toBe(true)
  expect(useCharacterStore.getState().character.totalXP).toBe(0)
  function LiveFilter() {
    const filter = useDashboardStore(state => state.layout.find(card => card.id === 'habits')?.habitFilter)
    return React.createElement(TaskCardFilterButton, { cardId: 'habits', kind: 'habits', filter })
  }
  await render(React.createElement(LiveFilter))
  await click(container.querySelector('[data-filter-trigger]')!)
  await click(document.querySelector('[data-task-card-filter] input[value="single"]')!)
  expect(document.querySelector('[data-task-card-filter] input[value="Client projects"]')).not.toBeNull()
})

it('category submission inside the task drawer does not submit or clear the task draft', async () => {
  const close = vi.fn()
  await render(React.createElement(TaskDrawer, { open: true, onClose: close }))
  await type(container.querySelector('form input')!, 'A task in a new category')
  await click(container.querySelector('[data-create-category]')!)
  await type(dialog().querySelector('input')!, 'Research')
  await submit()
  expect(close).not.toHaveBeenCalled()
  expect(useTaskStore.getState().tasks).toHaveLength(0)
  expect(container.querySelector<HTMLInputElement>('form input')!.value).toBe('A task in a new category')
  await act(async () => { container.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })) })
  expect(useTaskStore.getState().tasks[0]).toMatchObject({ title: 'A task in a new category', category: 'Research' })
})

it('cancel and composing Enter leave categories and the task unchanged', async () => {
  const initial = structuredClone(useAreaStore.getState().areas)
  await render(React.createElement(TaskList))
  await click(container.querySelector('[data-create-category]')!)
  const input = dialog().querySelector('input')!
  await type(input, '新的分类')
  await act(async () => {
    input.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }))
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true, isComposing: true }))
    dialog().dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
  })
  expect(useAreaStore.getState().areas).toEqual(initial)
  await act(async () => { input.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true })) })
  await click(dialog().querySelector('button[type="button"]')!)
  expect(dialog()).toBeNull()
  expect(useAreaStore.getState().areas).toEqual(initial)
  expect(useTaskStore.getState().tasks).toHaveLength(0)
})

it('selects an existing translated or renamed category without creating duplicates', async () => {
  const custom = useAreaStore.getState().addArea(null, 'Client projects')!
  useAreaStore.getState().updateArea(custom.id, { name: 'Partners' })
  const count = useAreaStore.getState().areas.length
  await render(React.createElement(TaskList))
  for (const [name, expected] of [['  PARTNERS  ', custom.category], [zh.areaName_home, 'home'], [en.areaName_home, 'home'], [en.areaName_library, 'library'], ['其他', 'other']]) {
    await click(container.querySelector('[data-create-category]')!)
    await type(dialog().querySelector('input')!, name)
    await submit()
    expect(container.querySelector('select')!.value).toBe(expected)
    expect(useAreaStore.getState().areas).toHaveLength(count)
  }
})

it.each(['_milestone', '档案馆', 'Archive', 'Archives', 'ALL', 'all', '全部'])('rejects a reserved system category %s', async name => {
  await render(React.createElement(TaskList))
  await click(container.querySelector('[data-create-category]')!)
  await type(dialog().querySelector('input')!, name)
  await submit()
  expect(dialog().querySelector('[role="alert"]')!.textContent).toBe(zh.category_reserved)
  expect(useAreaStore.getState().areas).toHaveLength(6)
})

it('reports the existing limit without silently selecting or creating a task', async () => {
  for (let i = 0; i < 6; i++) useAreaStore.getState().addArea(null, 'Extra ' + i)
  await render(React.createElement(TaskList))
  await click(container.querySelector('[data-create-category]')!)
  await type(dialog().querySelector('input')!, 'Over limit')
  await submit()
  expect(dialog().querySelector('[role="alert"]')!.textContent).toBe(zh.category_limit)
  expect(useAreaStore.getState().areas).toHaveLength(12)
  expect(useTaskStore.getState().tasks).toHaveLength(0)
})

it('keeps keyboard focus inside an empty category dialog while its submit button is disabled', async () => {
  await render(React.createElement(TaskList))
  await click(container.querySelector('[data-create-category]')!)
  const input = dialog().querySelector('input')!
  const cancel = dialog().querySelector<HTMLButtonElement>('button[type="button"]')!
  expect(dialog().querySelector<HTMLButtonElement>('button[type="submit"]')!.disabled).toBe(true)
  input.focus()
  await act(async () => { input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true })) })
  expect(document.activeElement).toBe(cancel)
  await act(async () => { cancel.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true })) })
  expect(document.activeElement).toBe(input)
})


it('does not offer category creation beside a standalone quick-input dropdown', async () => {
  await render(React.createElement(QuickInput))
  expect(container.querySelector('select')).not.toBeNull()
  expect(container.querySelector('[data-create-category]')).toBeNull()
})

it('clears tag filtering after creating a category so its untagged task remains visible', async () => {
  const tagged = useTaskStore.getState().addTask({ title: 'Tagged older task', category: 'home' })
  useTaskStore.getState().updateTask(tagged.id, { tags: ['selected tag'] })
  await render(React.createElement(TaskList))
  const tag = [...container.querySelectorAll('button')].find(button => button.textContent === 'selected tag')!
  await click(tag)
  expect(container.textContent).toContain(zh.tag_clearFilter)
  const draft = container.querySelector<HTMLInputElement>('input[placeholder="' + zh.quickInput_placeholder + '"]')!
  await type(draft, 'Keep this untagged draft')
  await click(container.querySelector('[data-task-category-tabs] [data-create-category]')!)
  await type(dialog().querySelector('input')!, 'Follow-up projects')
  await submit()
  expect(container.textContent).not.toContain(zh.tag_clearFilter)
  expect(draft.value).toBe('Keep this untagged draft')
  await act(async () => { draft.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })) })
  const created = useTaskStore.getState().tasks.find(task => task.title === 'Keep this untagged draft')!
  expect(created.category).toBe('Follow-up projects')
  expect(container.querySelector('[data-task-id="' + created.id + '"]')).not.toBeNull()
})

it.each(['hidden', 'trash'] as const)('returns from %s view to the newly created category', async view => {
  await render(React.createElement(TaskList))
  const title = view === 'hidden' ? zh.tasklist_hiddenTooltip : zh.tasklist_trashTooltip
  await click(container.querySelector('[title="' + title + '"]')!)
  expect(container.querySelector('select')).toBeNull()
  await click(container.querySelector('[data-task-category-tabs] [data-create-category]')!)
  await type(dialog().querySelector('input')!, 'Active category')
  await submit()
  expect(container.querySelector('select')!.value).toBe('Active category')
  expect(container.querySelector('[title="' + zh.tasklist_hiddenTooltip + '"]')!.getAttribute('aria-pressed')).toBe('false')
  expect(container.querySelector('[title="' + zh.tasklist_trashTooltip + '"]')!.getAttribute('aria-pressed')).toBe('false')
  expect(container.querySelector('[data-task-category-tab="Active category"]')!.getAttribute('aria-pressed')).toBe('true')
})

it('selects the current category again without leaving a quick-input override or losing the draft', async () => {
  await render(React.createElement(TaskList))
  await click(container.querySelector('[data-task-category-tab="home"]')!)
  const draft = container.querySelector<HTMLInputElement>('input[placeholder="' + zh.quickInput_placeholder + '"]')!
  await type(draft, 'Draft stays on reselect')
  await act(async () => {
    const select = container.querySelector('select')!
    select.value = 'forge'
    select.dispatchEvent(new Event('change', { bubbles: true }))
  })
  expect(container.querySelector('select')!.value).toBe('forge')
  await click(container.querySelector('[data-task-category-tabs] [data-create-category]')!)
  await type(dialog().querySelector('input')!, zh.areaName_home)
  await submit()
  expect(container.querySelector('select')!.value).toBe('home')
  expect(draft.value).toBe('Draft stays on reselect')
  await act(async () => { draft.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })) })
  expect(useTaskStore.getState().tasks[0]).toMatchObject({ title: 'Draft stays on reselect', category: 'home' })
})
