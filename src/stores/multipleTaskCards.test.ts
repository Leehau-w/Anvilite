import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { CardLayout, TaskCardFilter } from './dashboardStore'

const memoryStorage = localStorage
let module: typeof import('./dashboardStore')
beforeEach(async () => {
  vi.resetModules()
  vi.stubGlobal('localStorage', memoryStorage)
  vi.stubGlobal('window', { localStorage: memoryStorage })
  localStorage.clear()
  module = await import('./dashboardStore')
})
afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

function snapshot() {
  const { layout, visibleCards } = module.useDashboardStore.getState()
  return structuredClone({ layout, visibleCards })
}
async function coldReload() {
  vi.resetModules()
  module = await import('./dashboardStore')
  return module.useDashboardStore
}
function filterOf(id: string) {
  return module.useDashboardStore.getState().layout.find(card => card.id === id)?.taskFilter
}

it('recognizes original and generated task cards without treating other cards as task cards', () => {
  expect(module.isTaskCardId('tasks')).toBe(true)
  expect(module.isTaskCardId('tasks:synthetic-instance')).toBe(true)
  for (const id of ['tasks:', 'tasks-other', 'waiting', 'habits', '']) {
    expect(module.isTaskCardId(id)).toBe(false)
  }
})

it('adds independently addressable task cards below all saved cards without moving old geometry', () => {
  const store = module.useDashboardStore
  store.getState().updateCard('habits', { col: 5, row: 37, colSpan: 15, rowSpan: 9 })
  store.getState().removeCard('habits')
  const before = snapshot()
  const first = store.getState().addTaskCard()
  const second = store.getState().addTaskCard()
  expect(first).not.toBe(second)
  expect(first).toMatch(/^tasks:.+/)
  expect(store.getState().layout.slice(0, before.layout.length)).toEqual(before.layout)
  expect(store.getState().layout.slice(-2)).toEqual([
    { id: first, col: 0, row: 46, colSpan: 8, rowSpan: 8 },
    { id: second, col: 0, row: 54, colSpan: 8, rowSpan: 8 },
  ])
  expect(store.getState().visibleCards).toEqual([...before.visibleCards, first, second])
  expect(module.ALL_CARD_IDS).toHaveLength(9)
})

it('keeps filters independent, deduplicates selections and never changes an empty multiple selection to all', () => {
  const store = module.useDashboardStore
  const first = store.getState().addTaskCard()
  const second = store.getState().addTaskCard()
  const multiple: TaskCardFilter = { mode: 'multiple', categories: ['work', 'life', 'work'] }
  store.getState().setTaskCardFilter(first, multiple)
  store.getState().setTaskCardFilter(second, { mode: 'single', categories: ['life', 'work'] })
  expect(filterOf(first)).toEqual({ mode: 'multiple', categories: ['work', 'life'] })
  expect(filterOf(second)).toEqual({ mode: 'single', categories: ['life'] })
  expect(filterOf('tasks')).toBeUndefined()
  multiple.categories.push('later-mutation')
  expect(filterOf(first)?.categories).toEqual(['work', 'life'])
  store.getState().setTaskCardFilter(first, { mode: 'multiple', categories: [] })
  expect(filterOf(first)).toEqual({ mode: 'multiple', categories: [] })
  store.getState().setTaskCardFilter(second, { mode: 'all', categories: ['work'] })
  expect(filterOf(second)).toEqual({ mode: 'all', categories: [] })
})

it('configures the original task card but leaves non-task cards unchanged', () => {
  const store = module.useDashboardStore
  const before = snapshot()
  store.getState().setTaskCardFilter('waiting', { mode: 'single', categories: ['work'] })
  expect(snapshot()).toEqual(before)
  store.getState().setTaskCardFilter('tasks', { mode: 'single', categories: [] })
  expect(filterOf('tasks')).toEqual({ mode: 'single', categories: [] })
})

it('restores a hidden task card with its geometry and filter, without creating duplicate visible entries', () => {
  const store = module.useDashboardStore
  const id = store.getState().addTaskCard()
  store.getState().updateCard(id, { col: 7, row: 39, colSpan: 13, rowSpan: 11 })
  store.getState().setTaskCardFilter(id, { mode: 'single', categories: ['work'] })
  const expected = snapshot().layout
  store.getState().removeCard(id)
  expect(store.getState().visibleCards).not.toContain(id)
  store.getState().addCard(id)
  store.getState().addCard(id)
  expect(store.getState().visibleCards.filter(visible => visible === id)).toHaveLength(1)
  expect(store.getState().layout).toEqual(expected)
  store.getState().addCard('tasks:missing-instance')
  expect(store.getState().visibleCards).not.toContain('tasks:missing-instance')
})

it('retains dynamic card identities, hidden cards, geometry and per-card filters on a cold restart', async () => {
  const store = module.useDashboardStore
  const shown = store.getState().addTaskCard()
  const hidden = store.getState().addTaskCard()
  store.getState().setTaskCardFilter(shown, { mode: 'multiple', categories: [] })
  store.getState().setTaskCardFilter(hidden, { mode: 'single', categories: ['life'] })
  store.getState().updateCard(shown, { row: 55, col: 5 })
  store.getState().removeCard(hidden)
  const expected = snapshot()
  await coldReload()
  expect(snapshot()).toEqual(expected)
  expect(module.useDashboardStore.persist.getOptions().version).toBe(3)
})

it('preserves an explicitly empty visibility list with dynamic instances after cold hydration', async () => {
  const store = module.useDashboardStore
  const id = store.getState().addTaskCard()
  store.getState().setTaskCardFilter(id, { mode: 'multiple', categories: ['life', 'work'] })
  for (const visible of [...store.getState().visibleCards]) store.getState().removeCard(visible)
  const expected = snapshot()
  await coldReload()
  expect(snapshot()).toEqual(expected)
  expect(module.useDashboardStore.getState().visibleCards).toEqual([])
})

it('migrates version-zero storage without losing dynamic cards or revealing hidden instances', async () => {
  const id = module.useDashboardStore.getState().addTaskCard()
  module.useDashboardStore.getState().setTaskCardFilter(id, { mode: 'multiple', categories: ['work'] })
  module.useDashboardStore.getState().removeCard(id)
  const expected = snapshot()
  localStorage.setItem('anvilite-dashboard', JSON.stringify({ state: expected, version: 0 }))
  await coldReload()
  expect(snapshot()).toEqual(expected)
  expect(JSON.parse(localStorage.getItem('anvilite-dashboard')!).version).toBe(3)
})

it('supplements a missing historical waiting card below dynamic cards without altering their saved filters', async () => {
  const dynamic: CardLayout = { id: 'tasks:old-instance', col: 9, row: 48, colSpan: 12, rowSpan: 7,
    taskFilter: { mode: 'multiple', categories: [] } }
  const oldLayout = [...module.DEFAULT_LAYOUT.filter(card => card.id !== 'waiting'), dynamic]
  localStorage.setItem('anvilite-dashboard', JSON.stringify({ state: { layout: oldLayout, visibleCards: ['tasks'] }, version: 0 }))
  await coldReload()
  expect(module.useDashboardStore.getState().layout.filter(card => card.id !== 'waiting')).toEqual(oldLayout)
  expect(filterOf(dynamic.id)).toEqual(dynamic.taskFilter)
  expect(module.useDashboardStore.getState().layout.find(card => card.id === 'waiting')?.row).toBe(55)
  expect(module.useDashboardStore.getState().visibleCards).toEqual(['tasks', 'waiting'])
})

it('reset layout returns to the original default cards and drops their custom filters', async () => {
  const store = module.useDashboardStore
  store.getState().addTaskCard()
  store.getState().setTaskCardFilter('tasks', { mode: 'single', categories: ['work'] })
  store.getState().removeCard('habits')
  store.getState().resetLayout()
  expect(snapshot()).toEqual({ layout: module.DEFAULT_LAYOUT, visibleCards: module.ALL_CARD_IDS })
  expect(filterOf('tasks')).toBeUndefined()
  await coldReload()
  expect(snapshot()).toEqual({ layout: module.DEFAULT_LAYOUT, visibleCards: module.ALL_CARD_IDS })
})
