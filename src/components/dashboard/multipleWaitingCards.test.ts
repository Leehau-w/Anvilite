// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { DragEvent as ReactDragEvent } from 'react'

vi.hoisted(() => {
  vi.stubGlobal('window', document.defaultView)
  vi.stubGlobal('localStorage', document.defaultView!.localStorage)
})
vi.mock('framer-motion', async importOriginal => ({
  ...await importOriginal<typeof import('framer-motion')>(),
  AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
}))

import { Dashboard } from './Dashboard'
import { useTaskStore } from '@/stores/taskStore'
import { useHabitStore } from '@/stores/habitStore'
import { useDashboardStore, DEFAULT_LAYOUT, type WaitingCardId } from '@/stores/dashboardStore'
import { useAreaStore } from '@/stores/areaStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { useCharacterStore } from '@/stores/characterStore'
import { useGrowthEventStore } from '@/stores/growthEventStore'
import { beginTaskDrag, endTaskDrag } from '@/utils/taskDrag'
import { zh } from '@/i18n/zh'
import { en } from '@/i18n/en'

let container: HTMLDivElement
let root: Root
const dictionaries = { zh, en }
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  localStorage.clear()
  useTaskStore.setState({ tasks: [], customTaskGroups: [] })
  useHabitStore.setState({ habits: [], customHabitGroups: [] })
  useAreaStore.setState({ areas: useAreaStore.getInitialState().areas.map(area => ({ ...area })) })
  useDashboardStore.setState({ layout: DEFAULT_LAYOUT.map(card => ({ ...card })), visibleCards: ['tasks', 'waiting'] })
  useCharacterStore.setState({ character: { ...useCharacterStore.getInitialState().character } })
  useGrowthEventStore.setState({ events: [] })
  useSettingsStore.getState().setLanguage('zh')
  container = document.createElement('div'); document.body.append(container); root = createRoot(container)
})
afterEach(async () => {
  endTaskDrag()
  await act(async () => root.unmount())
  container.remove()
  vi.restoreAllMocks()
})
async function render() { await act(async () => root.render(React.createElement(Dashboard))) }
async function click(element: Element) { await act(async () => element.dispatchEvent(new MouseEvent('click', { bubbles: true }))) }
function button(text: string) {
  const node = [...container.querySelectorAll('button')].find(element => element.textContent?.trim() === text)
  expect(node).toBeDefined(); return node!
}
function card(id: string) {
  const node = container.querySelector(`[data-dashboard-card="${id}"]`)
  expect(node).not.toBeNull(); return node!
}
function dialog(id: string) {
  const node = document.body.querySelector(`[data-task-card-filter="${id}"]`)
  expect(node).not.toBeNull(); return node!
}
async function mode(id: string, value: string) { await click(dialog(id).querySelector(`input[name="filter-mode-${id}"][value="${value}"]`)!) }
async function choose(id: string, value: string) { await click(dialog(id).querySelector(`input[name="filter-category-${id}"][value="${value}"]`)!) }
async function close(id: string) { await click(dialog(id).querySelector('button')!) }
function add(title: string, category = 'home', waiting = true) {
  const created = useTaskStore.getState().addTask({ title, category })
  if (waiting) expect(useTaskStore.getState().waitTask(created.id)).toBe(true)
  return useTaskStore.getState().tasks.find(item => item.id === created.id)!
}
function current(id: string) { return useTaskStore.getState().tasks.find(item => item.id === id)! }
function zone(id: string) { return card(id).querySelector('[data-task-drop-target="waiting"]')! }
function transfer() {
  const values = new Map<string, string>()
  return {
    types: [] as string[], effectAllowed: 'none', dropEffect: 'none',
    setData(this: { types: string[] }, type: string, value: string) { values.set(type, value); this.types = [...values.keys()] },
    getData(type: string) { return values.get(type) ?? '' },
  } as unknown as DataTransfer
}
function begin(id: string) {
  const data = transfer()
  beginTaskDrag({ dataTransfer: data } as ReactDragEvent<HTMLElement>, id)
  return data
}
async function drag(type: string, dataTransfer: DataTransfer, target: Element) {
  const event = new Event(type, { bubbles: true, cancelable: true })
  Object.defineProperty(event, 'dataTransfer', { value: dataTransfer })
  await act(async () => target.dispatchEvent(event))
  return event
}

it.each(['zh', 'en'] as const)('independently filters several waiting cards by one, multiple or all categories (%s)', async lang => {
  const t = dictionaries[lang]
  useSettingsStore.getState().setLanguage(lang)
  add('Home reply')
  add('Forge reply', 'forge')
  useAreaStore.getState().addArea(null, 'Client calls')
  add('Client reply', 'Client calls')
  const hidden = add('Hidden reply'); useTaskStore.getState().hideTask(hidden.id)
  const deleted = add('Deleted reply'); useTaskStore.getState().deleteTask(deleted.id)
  add('Regular todo', 'home', false)
  const completed = add('Finished reply'); useTaskStore.getState().completeTask(completed.id)
  const second = useDashboardStore.getState().addWaitingCard()
  const before = JSON.stringify(useTaskStore.getState().tasks)
  await render()
  for (const id of ['waiting', second]) expect(card(id).querySelector('[data-card-title]')!.textContent).toBe(t.card_waiting)
  await click(container.querySelector('[data-filter-trigger="waiting"]')!)
  expect(dialog('waiting').getAttribute('data-waiting-card-filter')).toBe('waiting')
  expect(dialog('waiting').closest('[data-dashboard-card]')).toBeNull()
  await mode('waiting', 'single'); await choose('waiting', 'home'); await close('waiting')
  expect(card('waiting').textContent).toContain('Home reply')
  for (const title of ['Forge reply', 'Client reply', 'Hidden reply', 'Deleted reply', 'Regular todo', 'Finished reply']) expect(zone('waiting').textContent).not.toContain(title)
  await click(container.querySelector(`[data-filter-trigger="${second}"]`)!)
  await mode(second, 'multiple'); await choose(second, 'forge'); await choose(second, 'Client calls'); await close(second)
  const trigger = container.querySelector(`[data-filter-trigger="${second}"]`)!
  expect(trigger.textContent).toBe(t.areaName_forge + ' / Client calls ▾')
  expect(trigger.textContent).not.toContain(t.dash_taskCardCategories)
  expect(card(second).textContent).toContain('Forge reply')
  expect(card(second).textContent).toContain('Client reply')
  expect(card(second).textContent).not.toContain('Home reply')
  await click(trigger); await mode(second, 'all'); await close(second)
  for (const title of ['Home reply', 'Forge reply', 'Client reply']) expect(card(second).textContent).toContain(title)
  expect(JSON.stringify(useTaskStore.getState().tasks)).toBe(before)
})

it('keeps an empty filter empty, includes legacy categories, and follows renamed category labels', async () => {
  add('Legacy reply', 'Former category')
  add('Home reply')
  const second = useDashboardStore.getState().addWaitingCard()
  useDashboardStore.getState().setWaitingCardFilter(second, { mode: 'single', categories: ['Former category'] })
  await render()
  expect(card(second).textContent).toContain('Legacy reply')
  await click(container.querySelector('[data-filter-trigger="waiting"]')!)
  await mode('waiting', 'multiple')
  expect(dialog('waiting').textContent).toContain(zh.dash_filterEmpty)
  expect(dialog('waiting').querySelector('input[value="Former category"]')).not.toBeNull()
  expect(dialog('waiting').querySelector('input[value="_milestone"]')).toBeNull()
  await close('waiting')
  expect(zone('waiting').querySelectorAll('[data-waiting-task-id]')).toHaveLength(0)
  await act(async () => {
    useDashboardStore.getState().setWaitingCardFilter('waiting', { mode: 'single', categories: ['home'] })
    useAreaStore.getState().updateArea('area-home', { name: 'Renamed household' })
  })
  expect(container.querySelector('[data-filter-trigger="waiting"]')!.textContent).toBe('Renamed household ▾')
  expect(card(second).textContent).toContain('Legacy reply')
})

it('adds multiple waiting cards and restores an instance with its filter and size without moving existing cards', async () => {
  const original = JSON.stringify(useDashboardStore.getState().layout)
  await render()
  await click(button(zh.dash_editLayout)); await click(button(zh.dash_addCard))
  await click(container.querySelector('[data-add-waiting-card]')!)
  const second = useDashboardStore.getState().layout.at(-1)!.id as WaitingCardId
  expect(container.querySelector('[data-add-waiting-card]')).toBeNull()
  await click(button(zh.dash_addCard)); await click(container.querySelector('[data-add-waiting-card]')!)
  const third = useDashboardStore.getState().layout.at(-1)!.id
  expect(third).not.toBe(second)
  expect(JSON.stringify(useDashboardStore.getState().layout.slice(0, DEFAULT_LAYOUT.length))).toBe(original)
  await act(async () => {
    useDashboardStore.getState().setWaitingCardFilter(second, { mode: 'single', categories: ['forge'] })
    useDashboardStore.getState().updateCard(second, { colSpan: 6, rowSpan: 5 })
  })
  const saved = { ...useDashboardStore.getState().layout.find(item => item.id === second)! }
  await act(async () => { useDashboardStore.getState().removeCard(second) })
  expect(container.querySelector(`[data-dashboard-card="${second}"]`)).toBeNull()
  await click(button(zh.dash_addCard))
  const restore = container.querySelector(`[data-restore-card="${second}"]`)!
  expect(restore.textContent).toContain(zh.card_waiting + ' · ' + zh.areaName_forge)
  await click(restore)
  expect(useDashboardStore.getState().layout.find(item => item.id === second)).toEqual(saved)
  expect(card(second).querySelector('[data-card-title]')!.textContent).toBe(zh.card_waiting)
})

it.each(['zh', 'en'] as const)('rejects a drop outside this card’s categories, explains it, and accepts the next matching gesture (%s)', async lang => {
  const t = dictionaries[lang]
  useSettingsStore.getState().setLanguage(lang)
  const wrong = add('Home remains todo', 'home', false)
  const right = add('Forge becomes waiting', 'forge', false)
  useDashboardStore.getState().setWaitingCardFilter('waiting', { mode: 'single', categories: ['forge'] })
  await render()
  const before = JSON.stringify(current(wrong.id))
  let data = begin(wrong.id)
  await drag('dragover', data, zone('waiting')); await drag('drop', data, zone('waiting'))
  expect(JSON.stringify(current(wrong.id))).toBe(before)
  expect(zone('waiting').querySelector('[data-waiting-drop-mismatch]')!.textContent).toBe(t.dashboard_waitingCategoryMismatch)
  expect(card('tasks').textContent).toContain(wrong.title)
  data = begin(right.id)
  await drag('dragover', data, zone('waiting'))
  expect(zone('waiting').querySelector('[data-waiting-drop-mismatch]')).toBeNull()
  await drag('drop', data, zone('waiting'))
  expect(current(right.id)).toMatchObject({ status: 'waiting', category: 'forge' })
  expect(zone('waiting').textContent).toContain(right.title)
  expect(useTaskStore.getState().tasks).toHaveLength(2)
})

it('checks the latest category and filter at drop time, and moving between overlapping waiting cards never duplicates a task', async () => {
  const task = add('Reply changed during drag', 'home', false)
  const second = useDashboardStore.getState().addWaitingCard()
  useDashboardStore.getState().setWaitingCardFilter('waiting', { mode: 'single', categories: ['home'] })
  await render()
  let data = begin(task.id)
  await drag('dragover', data, zone('waiting'))
  await act(async () => { useTaskStore.getState().updateTask(task.id, { category: 'forge' }) })
  await drag('drop', data, zone('waiting'))
  expect(current(task.id)).toMatchObject({ status: 'todo', category: 'forge' })
  expect(zone('waiting').querySelector('[data-waiting-drop-mismatch]')).not.toBeNull()
  data = begin(task.id)
  await act(async () => { useDashboardStore.getState().setWaitingCardFilter('waiting', { mode: 'single', categories: ['forge'] }) })
  expect(zone('waiting').querySelector('[data-waiting-drop-mismatch]')).toBeNull()
  await drag('drop', data, zone('waiting'))
  expect(current(task.id)).toMatchObject({ status: 'waiting', category: 'forge' })
  const before = JSON.stringify(current(task.id))
  data = begin(task.id)
  await drag('drop', data, zone(second))
  expect(JSON.stringify(current(task.id))).toBe(before)
  for (const id of ['waiting', second]) expect(zone(id).querySelectorAll(`[data-waiting-task-id="${task.id}"]`)).toHaveLength(1)
  expect(useTaskStore.getState().tasks).toHaveLength(1)
})
