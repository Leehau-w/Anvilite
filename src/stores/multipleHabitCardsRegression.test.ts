import { afterEach, beforeEach, expect, it, vi } from 'vitest'

const memoryStorage = localStorage
const memorySession = sessionStorage
let dashboard: typeof import('@/stores/dashboardStore')['useDashboardStore']
let data: typeof import('@/utils/dataExport')
let cardTypes: typeof import('@/stores/dashboardStore')

beforeEach(async () => {
  vi.resetModules()
  vi.stubGlobal('localStorage', memoryStorage)
  vi.stubGlobal('sessionStorage', memorySession)
  memoryStorage.clear()
  vi.stubGlobal('window', { localStorage: memoryStorage, location: { reload: vi.fn() }, addEventListener: vi.fn() })
  data = await import('@/utils/dataExport')
  cardTypes = await import('@/stores/dashboardStore')
  dashboard = cardTypes.useDashboardStore
})
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals() })
function snapshot() {
  const { layout, visibleCards } = dashboard.getState()
  return structuredClone({ layout, visibleCards })
}
async function coldReload() {
  vi.resetModules()
  dashboard = (await import('@/stores/dashboardStore')).useDashboardStore
  return snapshot()
}
function customize() {
  const task = dashboard.getState().addTaskCard()
  const first = dashboard.getState().addHabitCard()
  const hidden = dashboard.getState().addHabitCard()
  dashboard.getState().setTaskCardFilter(task, { mode: 'multiple', categories: ['forge', 'home'] })
  dashboard.getState().setHabitCardFilter('habits', { mode: 'single', categories: ['home'] })
  dashboard.getState().setHabitCardFilter(first, { mode: 'multiple', categories: [] })
  dashboard.getState().setHabitCardFilter(hidden, { mode: 'multiple', categories: ['forge', 'custom'] })
  dashboard.getState().updateCard(first, { col: 9, row: 48, colSpan: 15, rowSpan: 6 })
  dashboard.getState().removeCard(hidden)
  return { first, hidden, task, expected: snapshot() }
}
function backup() { return JSON.parse(data.serializeExportData()) }

it('recognizes habit instances without mistaking task or unrelated cards', () => {
  expect(cardTypes.isHabitCardId('habits')).toBe(true)
  expect(cardTypes.isHabitCardId('habits:synthetic')).toBe(true)
  for (const id of ['habits:', 'habits-other', 'tasks:synthetic', 'growth', '']) expect(cardTypes.isHabitCardId(id)).toBe(false)
})

it('adds unique habit instances after the existing layout without moving or unhiding saved cards', () => {
  dashboard.getState().updateCard('tasks', { row: 35, col: 8, colSpan: 12, rowSpan: 9 })
  dashboard.getState().removeCard('tasks')
  const before = snapshot()
  const first = dashboard.getState().addHabitCard()
  const second = dashboard.getState().addHabitCard()
  expect(first).not.toBe(second)
  expect(first).toMatch(/^habits:.+/)
  expect(dashboard.getState().layout.slice(0, before.layout.length)).toEqual(before.layout)
  expect(dashboard.getState().layout.slice(-2)).toEqual([
    { id: first, col: 0, row: 44, colSpan: 8, rowSpan: 8 },
    { id: second, col: 0, row: 52, colSpan: 8, rowSpan: 8 },
  ])
  expect(dashboard.getState().visibleCards).toEqual([...before.visibleCards, first, second])
})

it('keeps filters independent, normalizes choices and preserves an intentionally empty multiple selection', () => {
  const first = dashboard.getState().addHabitCard()
  const second = dashboard.getState().addHabitCard()
  const choices = ['home', 'forge', 'home']
  dashboard.getState().setHabitCardFilter(first, { mode: 'multiple', categories: choices })
  choices.push('later')
  dashboard.getState().setHabitCardFilter(second, { mode: 'single', categories: ['forge', 'home'] })
  const filter = (id: string) => dashboard.getState().layout.find(card => card.id === id)?.habitFilter
  expect(filter(first)).toEqual({ mode: 'multiple', categories: ['home', 'forge'] })
  expect(filter(second)).toEqual({ mode: 'single', categories: ['forge'] })
  dashboard.getState().setHabitCardFilter(first, { mode: 'multiple', categories: [] })
  expect(filter(first)).toEqual({ mode: 'multiple', categories: [] })
  dashboard.getState().setHabitCardFilter(second, { mode: 'all', categories: ['home'] })
  expect(filter(second)).toEqual({ mode: 'all', categories: [] })
  const before = snapshot()
  dashboard.getState().setHabitCardFilter('tasks', { mode: 'all', categories: [] })
  dashboard.getState().setTaskCardFilter(first, { mode: 'all', categories: [] })
  expect(snapshot()).toEqual(before)
})

it('hiding, cold reloading and restoring an instance preserves its filter and geometry', async () => {
  const { hidden, expected } = customize()
  expect(await coldReload()).toEqual(expected)
  dashboard.getState().addCard(hidden)
  expect(dashboard.getState().visibleCards).toContain(hidden)
  expect(dashboard.getState().layout).toEqual(expected.layout)
})

it('exports and restores task and habit instances together through an actual cold reload', async () => {
  const { expected } = customize()
  const incoming = backup()
  dashboard.getState().resetLayout()
  expect(data.parseImportText(JSON.stringify(incoming)).success).toBe(true)
  expect(data.applyImportPayload(incoming)).toEqual({ success: true })
  expect(await coldReload()).toEqual(expected)
})

it('retains every current habit filter when a compatible old backup omits dashboard fields', async () => {
  const { expected } = customize()
  const incoming = backup()
  incoming.data.dashboard = {}
  expect(data.applyImportPayload(incoming)).toEqual({ success: true })
  expect(await coldReload()).toEqual(expected)
})

it.each([0, 3])('preserves saved habit instances and hidden filters while hydrating persist version %s', async version => {
  const { expected } = customize()
  localStorage.setItem('anvilite-dashboard', JSON.stringify({ state: expected, version }))
  expect(await coldReload()).toEqual(expected)
})

it('imports older geometry without filters as an all-category original habit card', async () => {
  const incoming = backup()
  const original = incoming.data.dashboard.layout.find((card: { id: string }) => card.id === 'habits')
  original.col = 2; original.row = 29; original.colSpan = 10
  expect(data.applyImportPayload(incoming)).toEqual({ success: true })
  const restored = await coldReload()
  expect(restored.layout.find(card => card.id === 'habits')).toEqual(original)
})

it.each([null, 'all', {}, { mode: 'unknown', categories: [] }, { mode: 'single', categories: ['home', 'forge'] },
  { mode: 'multiple', categories: 'home' }, { mode: 'multiple', categories: [1] }])('rejects malformed habit filter %j before writing any slice', invalid => {
  const { expected, first } = customize()
  const incoming = backup()
  incoming.data.dashboard.layout.find((card: { id: string }) => card.id === first).habitFilter = invalid
  const writes = vi.spyOn(localStorage, 'setItem')
  expect(data.parseImportText(JSON.stringify(incoming)).success).toBe(false)
  expect(data.applyImportPayload(incoming)).toEqual({ success: false, error: 'invalid_dashboard' })
  expect(writes).not.toHaveBeenCalled()
  expect(snapshot()).toEqual(expected)
})
