import { beforeEach, afterEach, expect, it, vi } from 'vitest'

const memoryStorage = localStorage
const memorySessionStorage = sessionStorage
let dashboard: typeof import('@/stores/dashboardStore')['useDashboardStore']
let data: typeof import('./dataExport')
let reload: ReturnType<typeof vi.fn>

beforeEach(async () => {
  vi.resetModules()
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-10-22T12:00:00'))
  vi.stubGlobal('localStorage', memoryStorage)
  vi.stubGlobal('sessionStorage', memorySessionStorage)
  localStorage.clear()
  reload = vi.fn()
  vi.stubGlobal('window', { localStorage, location: { reload }, addEventListener: vi.fn() })
  data = await import('./dataExport')
  dashboard = (await import('@/stores/dashboardStore')).useDashboardStore
})
afterEach(() => {
  vi.restoreAllMocks()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

function snapshot() {
  const { layout, visibleCards } = dashboard.getState()
  return JSON.parse(JSON.stringify({ layout, visibleCards }))
}
function customize() {
  dashboard.getState().updateCard('tasks', { col: 7, row: 3, colSpan: 13, rowSpan: 9 })
  dashboard.getState().updateCard('habits', { col: 0, row: 12, colSpan: 12, rowSpan: 7 })
  dashboard.getState().updateCard('quickAdd', { col: 0, row: 20, colSpan: 24, rowSpan: 3 })
  dashboard.getState().removeCard('flows')
  dashboard.getState().removeCard('inspiration')
  dashboard.getState().removeCard('character')
  return snapshot()
}
function backup() { return JSON.parse(data.serializeExportData()) }
async function coldReload() {
  vi.resetModules()
  const fresh = (await import('@/stores/dashboardStore')).useDashboardStore
  const { layout, visibleCards } = fresh.getState()
  return JSON.parse(JSON.stringify({ layout, visibleCards }))
}

it('restores all saved card positions, sizes and visibility after a real module reload', async () => {
  const expected = customize()
  const incoming = backup()
  dashboard.getState().resetLayout()
  expect(data.applyImportPayload(incoming)).toEqual({ success: true })
  expect(JSON.parse(localStorage.getItem('anvilite-dashboard')!).version).toBe(dashboard.persist.getOptions().version)
  expect(await coldReload()).toEqual(expected)
})

it('keeps every card hidden when the saved visibility list is explicitly empty', async () => {
  customize()
  for (const id of [...dashboard.getState().visibleCards]) dashboard.getState().removeCard(id)
  const expected = snapshot()
  const incoming = backup()
  dashboard.getState().resetLayout()
  expect(data.applyImportPayload(incoming).success).toBe(true)
  expect(await coldReload()).toEqual(expected)
})

it('preserves the current customized layout when an old backup has no dashboard fields', async () => {
  const expected = customize()
  const incoming = backup()
  incoming.data.dashboard = {}
  expect(data.applyImportPayload(incoming)).toEqual({ success: true })
  expect(await coldReload()).toEqual(expected)
})

it('fills only missing positions from the current layout and honors saved visibility', async () => {
  const expected = customize()
  const incoming = backup()
  delete incoming.data.dashboard.layout
  incoming.data.dashboard.visibleCards = ['tasks']
  expect(data.applyImportPayload(incoming).success).toBe(true)
  expect(await coldReload()).toEqual({ layout: expected.layout, visibleCards: ['tasks'] })
})

it('restores saved positions but preserves current visibility if the old backup omits it', async () => {
  const expected = customize()
  const incoming = backup()
  delete incoming.data.dashboard.visibleCards
  dashboard.getState().resetLayout()
  for (const id of [...dashboard.getState().visibleCards]) dashboard.getState().removeCard(id)
  expect(data.applyImportPayload(incoming).success).toBe(true)
  expect(await coldReload()).toEqual({ layout: expected.layout, visibleCards: [] })
})

it('file import restores the saved layout across its actual reload boundary', async () => {
  const expected = customize()
  const text = data.serializeExportData()
  dashboard.getState().resetLayout()
  const file = { text: async () => text } as File
  expect(await data.importData(file)).toEqual({ success: true })
  expect(reload).toHaveBeenCalledOnce()
  expect(await coldReload()).toEqual(expected)
})

it('sync restore preserves saved layout and records the pre-restore layout in its safety backup', async () => {
  const expected = customize()
  const text = data.serializeExportData()
  dashboard.getState().resetLayout()
  const previous = snapshot()
  const writeSyncFile = vi.fn().mockResolvedValue({ success: true })
  Object.assign(window, { electronAPI: {
    selectSyncDirectory: vi.fn(), writeSyncFile,
    readSyncFile: vi.fn().mockResolvedValue({ success: true, exists: true, content: text }),
  } })
  const { restoreFromSync } = await import('./dataSync')
  expect(await restoreFromSync('synthetic-unused-directory')).toEqual({ success: true })
  expect(reload).toHaveBeenCalledOnce()
  const safety = JSON.parse(writeSyncFile.mock.calls[0][2])
  expect(safety.data.dashboard).toEqual(previous)
  expect(await coldReload()).toEqual(expected)
})

it('rolls back positions and visibility if a later import slice cannot be written', async () => {
  const expected = customize()
  const incoming = backup()
  incoming.data.dashboard.layout[0].row = 44
  incoming.data.dashboard.visibleCards = ['tasks']
  const originalSet = localStorage.setItem.bind(localStorage)
  let failed = false
  vi.spyOn(localStorage, 'setItem').mockImplementation((key, value) => {
    if (key === 'anvilite-settings' && !failed) { failed = true; throw new Error('Synthetic quota exceeded') }
    return originalSet(key, value)
  })
  expect(data.applyImportPayload(incoming)).toEqual({ success: false, error: 'write_failed' })
  expect(await coldReload()).toEqual(expected)
})

it('rejects a malformed layout before changing the current saved card configuration', async () => {
  const expected = customize()
  const incoming = backup()
  incoming.data.dashboard.layout = [{ id: 'tasks', col: 0, row: 0, colSpan: 0, rowSpan: 3 }]
  const writes = vi.spyOn(localStorage, 'setItem')
  expect(data.applyImportPayload(incoming)).toEqual({ success: false, error: 'invalid_dashboard' })
  expect(writes).not.toHaveBeenCalled()
  expect(await coldReload()).toEqual(expected)
})

it('migrates historical version-zero dashboard storage without discarding customized cards', async () => {
  const expected = customize()
  localStorage.setItem('anvilite-dashboard', JSON.stringify({ state: expected, version: 0 }))
  expect(await coldReload()).toEqual(expected)
})
