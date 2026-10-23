import { afterEach, beforeEach, expect, it, vi } from 'vitest'

const memoryStorage = localStorage
const memorySessionStorage = sessionStorage
let dashboard: typeof import('@/stores/dashboardStore')['useDashboardStore']
let data: typeof import('./dataExport')
beforeEach(async () => {
  vi.resetModules()
  vi.stubGlobal('localStorage', memoryStorage)
  vi.stubGlobal('sessionStorage', memorySessionStorage)
  localStorage.clear()
  vi.stubGlobal('window', { localStorage, location: { reload: vi.fn() }, addEventListener: vi.fn() })
  data = await import('./dataExport')
  dashboard = (await import('@/stores/dashboardStore')).useDashboardStore
})
afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})
function snapshot() {
  const { layout, visibleCards } = dashboard.getState()
  return structuredClone({ layout, visibleCards })
}
function customize() {
  const first = dashboard.getState().addTaskCard()
  const hidden = dashboard.getState().addTaskCard()
  dashboard.getState().setTaskCardFilter('tasks', { mode: 'single', categories: ['life'] })
  dashboard.getState().setTaskCardFilter(first, { mode: 'multiple', categories: [] })
  dashboard.getState().setTaskCardFilter(hidden, { mode: 'multiple', categories: ['work', 'life'] })
  dashboard.getState().updateCard(first, { row: 42, col: 9, colSpan: 15, rowSpan: 6 })
  dashboard.getState().removeCard(hidden)
  return snapshot()
}
function backup() { return JSON.parse(data.serializeExportData()) }
async function coldReload() {
  vi.resetModules()
  dashboard = (await import('@/stores/dashboardStore')).useDashboardStore
  return snapshot()
}

it('round trips multiple task cards, empty selections and hidden card filters through export/apply/cold reload', async () => {
  const expected = customize()
  const incoming = backup()
  dashboard.getState().resetLayout()
  expect(data.applyImportPayload(incoming)).toEqual({ success: true })
  expect(await coldReload()).toEqual(expected)
})

it('preserves the complete current card configuration when a historical backup has no dashboard fields', async () => {
  const expected = customize()
  const incoming = backup()
  incoming.data.dashboard = {}
  expect(data.applyImportPayload(incoming)).toEqual({ success: true })
  expect(await coldReload()).toEqual(expected)
})

it('keeps current dynamic geometry and filters if only layout is omitted, while applying incoming visibility', async () => {
  const expected = customize()
  const incoming = backup()
  delete incoming.data.dashboard.layout
  incoming.data.dashboard.visibleCards = []
  expect(data.applyImportPayload(incoming)).toEqual({ success: true })
  expect(await coldReload()).toEqual({ layout: expected.layout, visibleCards: [] })
})

it('keeps current visibility if omitted while restoring imported dynamic cards and filters', async () => {
  const expected = customize()
  const incoming = backup()
  delete incoming.data.dashboard.visibleCards
  for (const visible of [...dashboard.getState().visibleCards]) dashboard.getState().removeCard(visible)
  expect(data.applyImportPayload(incoming)).toEqual({ success: true })
  expect(await coldReload()).toEqual({ layout: expected.layout, visibleCards: [] })
})

it('accepts historical cards without taskFilter and uses their saved geometry instead of factory defaults', async () => {
  const incoming = backup()
  incoming.data.dashboard.layout.find((card: { id: string }) => card.id === 'tasks').row = 22
  expect(data.applyImportPayload(incoming)).toEqual({ success: true })
  const restored = await coldReload()
  expect(restored.layout.find(card => card.id === 'tasks')).toEqual({ id: 'tasks', col: 0, row: 22, colSpan: 8, rowSpan: 8 })
})

it('validates arbitrary dynamic task instance IDs without replacing them during hydration', async () => {
  const incoming = backup()
  const dynamic = { id: 'tasks:synthetic-from-backup', col: 4, row: 31, colSpan: 12, rowSpan: 9,
    taskFilter: { mode: 'single', categories: ['work'] } }
  incoming.data.dashboard.layout.push(dynamic)
  incoming.data.dashboard.visibleCards.push(dynamic.id)
  expect(data.applyImportPayload(incoming)).toEqual({ success: true })
  const restored = await coldReload()
  expect(restored.layout).toContainEqual(dynamic)
  expect(restored.visibleCards).toContain(dynamic.id)
})

it.each([
  null,
  'all',
  {},
  { mode: 'unknown', categories: [] },
  { mode: 'all' },
  { mode: 'multiple', categories: 'work' },
  { mode: 'multiple', categories: [1] },
  { mode: 'single', categories: ['work', 'life'] },
])('rejects malformed per-card filter %j before any persisted data is written', async invalid => {
  const expected = customize()
  const incoming = backup()
  incoming.data.dashboard.layout[0].taskFilter = invalid
  const writes = vi.spyOn(localStorage, 'setItem')
  expect(data.applyImportPayload(incoming)).toEqual({ success: false, error: 'invalid_dashboard' })
  expect(writes).not.toHaveBeenCalled()
  expect(await coldReload()).toEqual(expected)
})

it('rolls back every saved dynamic card and filter if a later import slice fails to write', async () => {
  const expected = customize()
  const incoming = backup()
  incoming.data.dashboard.layout[0].row = 66
  incoming.data.dashboard.visibleCards = []
  const originalSet = localStorage.setItem.bind(localStorage)
  let failed = false
  vi.spyOn(localStorage, 'setItem').mockImplementation((key, value) => {
    if (key === 'anvilite-settings' && !failed) { failed = true; throw new Error('Synthetic quota exceeded') }
    return originalSet(key, value)
  })
  expect(data.applyImportPayload(incoming)).toEqual({ success: false, error: 'write_failed' })
  expect(await coldReload()).toEqual(expected)
})
