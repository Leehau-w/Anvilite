import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { CardLayout } from './dashboardStore'

const memoryStorage = localStorage
const memorySession = sessionStorage
let dashboard: typeof import('./dashboardStore')['useDashboardStore']
let cardTypes: typeof import('./dashboardStore')
let data: typeof import('@/utils/dataExport')

beforeEach(async () => {
  vi.resetModules()
  vi.stubGlobal('localStorage', memoryStorage)
  vi.stubGlobal('sessionStorage', memorySession)
  memoryStorage.clear()
  vi.stubGlobal('window', { localStorage: memoryStorage, location: { reload: vi.fn() }, addEventListener: vi.fn() })
  data = await import('@/utils/dataExport')
  cardTypes = await import('./dashboardStore')
  dashboard = cardTypes.useDashboardStore
})
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals() })

function snapshot() {
  const { layout, visibleCards } = dashboard.getState()
  return structuredClone({ layout, visibleCards })
}
function filterOf(id: string) { return dashboard.getState().layout.find(card => card.id === id)?.waitingFilter }
async function coldReload() {
  vi.resetModules()
  dashboard = (await import('./dashboardStore')).useDashboardStore
  return snapshot()
}
function customize() {
  const task = dashboard.getState().addTaskCard()
  const habit = dashboard.getState().addHabitCard()
  const shown = dashboard.getState().addWaitingCard()
  const hidden = dashboard.getState().addWaitingCard()
  dashboard.getState().setTaskCardFilter(task, { mode: 'single', categories: ['home'] })
  dashboard.getState().setHabitCardFilter(habit, { mode: 'multiple', categories: ['forge', 'custom'] })
  dashboard.getState().setWaitingCardFilter('waiting', { mode: 'single', categories: ['forge'] })
  dashboard.getState().setWaitingCardFilter(shown, { mode: 'multiple', categories: [] })
  dashboard.getState().setWaitingCardFilter(hidden, { mode: 'multiple', categories: ['home', 'custom'] })
  dashboard.getState().updateCard(shown, { col: 9, row: 48, colSpan: 15, rowSpan: 7 })
  dashboard.getState().removeCard(hidden)
  return { shown, hidden, expected: snapshot() }
}

it('recognizes original and instance waiting cards while keeping task and habit identities separate', () => {
  expect(cardTypes.isWaitingCardId('waiting')).toBe(true)
  expect(cardTypes.isWaitingCardId('waiting:synthetic-instance')).toBe(true)
  for (const id of ['waiting:', 'waiting-other', 'tasks:synthetic-instance', 'habits:synthetic-instance', 'growth', '']) {
    expect(cardTypes.isWaitingCardId(id)).toBe(false)
  }
})

it('adds unique waiting instances below saved geometry without moving or unhiding existing cards', () => {
  dashboard.getState().updateCard('tasks', { col: 8, row: 35, colSpan: 12, rowSpan: 9 })
  dashboard.getState().removeCard('tasks')
  dashboard.getState().removeCard('waiting')
  const before = snapshot()
  const first = dashboard.getState().addWaitingCard()
  const second = dashboard.getState().addWaitingCard()
  expect(first).not.toBe(second)
  expect(first).toMatch(/^waiting:.+/)
  expect(dashboard.getState().layout.slice(0, before.layout.length)).toEqual(before.layout)
  expect(dashboard.getState().layout.slice(-2)).toEqual([
    { id: first, col: 0, row: 44, colSpan: 8, rowSpan: 5 },
    { id: second, col: 0, row: 49, colSpan: 8, rowSpan: 5 },
  ])
  expect(dashboard.getState().visibleCards).toEqual([...before.visibleCards, first, second])
  expect(cardTypes.ALL_CARD_IDS).toHaveLength(9)
})

it('keeps waiting filters independent, copies selections, deduplicates and preserves an empty selection', () => {
  const first = dashboard.getState().addWaitingCard()
  const second = dashboard.getState().addWaitingCard()
  const choices = ['home', 'forge', 'home']
  dashboard.getState().setWaitingCardFilter(first, { mode: 'multiple', categories: choices })
  choices.push('later')
  dashboard.getState().setWaitingCardFilter(second, { mode: 'single', categories: ['forge', 'home'] })
  expect(filterOf(first)).toEqual({ mode: 'multiple', categories: ['home', 'forge'] })
  expect(filterOf(second)).toEqual({ mode: 'single', categories: ['forge'] })
  expect(filterOf('waiting')).toBeUndefined()
  dashboard.getState().setWaitingCardFilter(first, { mode: 'multiple', categories: [] })
  expect(filterOf(first)).toEqual({ mode: 'multiple', categories: [] })
  dashboard.getState().setWaitingCardFilter(second, { mode: 'all', categories: ['home'] })
  expect(filterOf(second)).toEqual({ mode: 'all', categories: [] })
  dashboard.getState().setWaitingCardFilter('waiting', { mode: 'single', categories: [] })
  expect(filterOf('waiting')).toEqual({ mode: 'single', categories: [] })
  const before = snapshot()
  dashboard.getState().setWaitingCardFilter('tasks', { mode: 'all', categories: [] })
  dashboard.getState().setWaitingCardFilter('habits', { mode: 'all', categories: [] })
  dashboard.getState().setTaskCardFilter(first, { mode: 'all', categories: [] })
  dashboard.getState().setHabitCardFilter(first, { mode: 'all', categories: [] })
  dashboard.getState().setWaitingCardFilter('waiting:missing', { mode: 'all', categories: [] })
  expect(snapshot()).toEqual(before)
})

it('hides, cold reloads and restores waiting instances with their filters and geometry intact', async () => {
  const { hidden, expected } = customize()
  expect(await coldReload()).toEqual(expected)
  dashboard.getState().addCard(hidden)
  dashboard.getState().addCard(hidden)
  expect(dashboard.getState().visibleCards.filter(id => id === hidden)).toHaveLength(1)
  expect(dashboard.getState().layout).toEqual(expected.layout)
  dashboard.getState().addCard('waiting:missing')
  expect(dashboard.getState().visibleCards).not.toContain('waiting:missing')
  expect(dashboard.persist.getOptions().version).toBe(3)
})

it('preserves an explicitly empty visibility list and hidden waiting filters after cold hydration', async () => {
  customize()
  for (const id of [...dashboard.getState().visibleCards]) dashboard.getState().removeCard(id)
  const expected = snapshot()
  expect(await coldReload()).toEqual(expected)
  expect(dashboard.getState().visibleCards).toEqual([])
})

it.each([0, 3])('retains waiting instances, hidden state and filters during hydration of persist version %s', async version => {
  const { expected } = customize()
  localStorage.setItem('anvilite-dashboard', JSON.stringify({ state: expected, version }))
  expect(await coldReload()).toEqual(expected)
  expect(JSON.parse(localStorage.getItem('anvilite-dashboard')!).version).toBe(3)
})

it('supplements an old layout only below existing waiting instances and keeps explicit all-hidden visibility', async () => {
  const instance: CardLayout = { id: 'waiting:previous', col: 10, row: 48, colSpan: 12, rowSpan: 7,
    waitingFilter: { mode: 'single', categories: ['custom'] } }
  const oldLayout = [...cardTypes.DEFAULT_LAYOUT.filter(card => card.id !== 'waiting'), instance]
  localStorage.setItem('anvilite-dashboard', JSON.stringify({ state: { layout: oldLayout, visibleCards: [] }, version: 0 }))
  const restored = await coldReload()
  expect(restored.layout.filter(card => card.id !== 'waiting')).toEqual(oldLayout)
  expect(restored.layout.find(card => card.id === 'waiting')).toEqual({ id: 'waiting', col: 0, row: 55, colSpan: 8, rowSpan: 5 })
  expect(restored.visibleCards).toEqual([])
})

it('exports and restores task, habit and waiting card settings together through a cold reload', async () => {
  const { expected } = customize()
  const incoming = JSON.parse(data.serializeExportData())
  dashboard.getState().resetLayout()
  expect(data.parseImportText(JSON.stringify(incoming)).success).toBe(true)
  expect(data.applyImportPayload(incoming)).toEqual({ success: true })
  expect(await coldReload()).toEqual(expected)
})

it('retains current waiting cards and filters when an older backup omits dashboard settings', async () => {
  const { expected } = customize()
  const incoming = JSON.parse(data.serializeExportData())
  incoming.data.dashboard = {}
  expect(data.applyImportPayload(incoming)).toEqual({ success: true })
  expect(await coldReload()).toEqual(expected)
})

it('resets custom waiting instances and filters to the unchanged original defaults', async () => {
  customize()
  dashboard.getState().resetLayout()
  const expected = { layout: cardTypes.DEFAULT_LAYOUT, visibleCards: cardTypes.ALL_CARD_IDS }
  expect(snapshot()).toEqual(expected)
  expect(await coldReload()).toEqual(expected)
  expect(filterOf('waiting')).toBeUndefined()
})

it.each([null, 'all', {}, { mode: 'unknown', categories: [] },
  { mode: 'single', categories: ['home', 'forge'] }, { mode: 'multiple', categories: 'home' },
  { mode: 'multiple', categories: [1] }])('rejects malformed waiting filter %j before writing any slice', invalid => {
  const { shown, expected } = customize()
  const incoming = JSON.parse(data.serializeExportData())
  incoming.data.dashboard.layout.find((card: { id: string }) => card.id === shown).waitingFilter = invalid
  const writes = vi.spyOn(localStorage, 'setItem')
  expect(data.parseImportText(JSON.stringify(incoming)).success).toBe(false)
  expect(data.applyImportPayload(incoming)).toEqual({ success: false, error: 'invalid_dashboard' })
  expect(writes).not.toHaveBeenCalled()
  expect(snapshot()).toEqual(expected)
})

it('rejects waiting filters on another card kind before overwriting current settings', () => {
  const { expected } = customize()
  const incoming = JSON.parse(data.serializeExportData())
  incoming.data.dashboard.layout.find((card: { id: string }) => card.id === 'tasks').waitingFilter = { mode: 'single', categories: ['home'] }
  const writes = vi.spyOn(localStorage, 'setItem')
  expect(data.parseImportText(JSON.stringify(incoming)).success).toBe(false)
  expect(data.applyImportPayload(incoming)).toEqual({ success: false, error: 'invalid_dashboard' })
  expect(writes).not.toHaveBeenCalled()
  expect(snapshot()).toEqual(expected)
})
