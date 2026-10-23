import { beforeEach, afterEach, expect, it, vi } from 'vitest'
import type { Habit } from '@/types/habit'

const memoryStorage = localStorage
const memorySessionStorage = sessionStorage

let exports: typeof import('./dataExport')
let sync: typeof import('./dataSync')
let tasks: typeof import('@/stores/taskStore')['useTaskStore']
let habits: typeof import('@/stores/habitStore')['useHabitStore']
let sops: typeof import('@/stores/sopStore')['useSOPStore']
let inspirations: typeof import('@/stores/inspirationStore')['useInspirationStore']
let reload: ReturnType<typeof vi.fn>
let storageChanged: ((event: Partial<StorageEvent>) => void) | undefined

beforeEach(async () => {
  vi.resetModules()
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-09-11T12:00:00'))
  vi.stubGlobal('localStorage', memoryStorage)
  vi.stubGlobal('sessionStorage', memorySessionStorage)
  localStorage.clear()
  reload = vi.fn()
  storageChanged = undefined
  vi.stubGlobal('window', { localStorage, location: { reload }, addEventListener: (name: string, listener: typeof storageChanged) => {
    if (name === 'storage') storageChanged = listener
  } })
  exports = await import('./dataExport')
  sync = await import('./dataSync')
  tasks = (await import('@/stores/taskStore')).useTaskStore
  habits = (await import('@/stores/habitStore')).useHabitStore
  sops = (await import('@/stores/sopStore')).useSOPStore
  inspirations = (await import('@/stores/inspirationStore')).useInspirationStore
  tasks.setState({ tasks: [], customTaskGroups: [] })
  habits.setState({ habits: [], customHabitGroups: [] })
  sops.setState({ folders: [], sops: [], selectedSOPId: null, collapsedFolderIds: [] })
  inspirations.setState({ inspirations: [] })
})
afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

function addHabit(patch: Partial<Habit> = {}) {
  habits.getState().addHabit({
    title: 'Synthetic habit', category: 'other', difficulty: 3, repeatType: 'daily',
    weeklyMode: null, weeklyDays: null, weeklyFlexibleCount: null, customIntervalDays: null,
    monthlyDays: null, startDate: '2026-09-01', endDate: null, targetCount: 1,
    reminderTime: null, estimatedMinutes: 15, description: '', ...patch,
  } as Parameters<ReturnType<typeof habits.getState>['addHabit']>[0])
  return habits.getState().habits.at(-1)!
}

function payload() {
  return JSON.parse(exports.serializeExportData())
}

function native() {
  const api = { saveFile: vi.fn(), selectSyncDirectory: vi.fn(), readSyncFile: vi.fn(), writeSyncFile: vi.fn() }
  Object.assign(window, { electronAPI: api })
  return api
}

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>(r => { resolve = r })
  return { promise, resolve }
}

it.each([
  ['weeklyDays', {}], ['weeklyDays', [0]], ['weeklyDays', [8]], ['weeklyDays', [1, 1]],
  ['weeklyDays', ['1']], ['weeklyMode', {}], ['weeklyMode', 'unknown'],
  ['weeklyFlexibleCount', 0], ['weeklyFlexibleCount', 8], ['weeklyFlexibleCount', 1.5],
  ['customIntervalDays', 0], ['customIntervalDays', -2], ['customIntervalDays', '2'],
  ['monthlyDays', {}], ['monthlyDays', [0]], ['monthlyDays', [32]], ['monthlyDays', [1.5]],
  ['monthlyDays', [-1, -1]], ['startDate', '2026-02-30'], ['endDate', '2026-13-01'],
  ['endDate', '2026-08-31'], ['lastMissCheckDate', '2026-02-29'], ['lastMissCheckDate', null],
  ['reminderTime', '24:00'], ['targetCount', 0], ['currentCycleCount', -1],
  ['lastDueAt', 'broken'], ['lastCompletedAt', {}], ['timerAccumulated', -1],
] as [string, unknown][])('rejects a malformed habit %s without writing any slice (%j)', (field, value) => {
  addHabit()
  const incoming = payload()
  incoming.data.habits.habits[0][field] = value
  const spy = vi.spyOn(localStorage, 'setItem')
  expect(exports.parseImportText(JSON.stringify(incoming)).success).toBe(false)
  expect(exports.applyImportPayload(incoming)).toEqual({ success: false, error: 'invalid_habits' })
  expect(spy).not.toHaveBeenCalled()
})

it.each([
  { repeatType: 'weekly', weeklyMode: 'strict', weeklyDays: null },
  { repeatType: 'weekly', weeklyMode: 'flexible', weeklyFlexibleCount: null },
  { repeatType: 'custom', customIntervalDays: null },
  { repeatType: 'monthly_fixed', monthlyDays: null },
])('rejects a missing active schedule parameter before overwrite (%j)', (patch) => {
  addHabit(patch as Partial<Habit>)
  const incoming = payload()
  const spy = vi.spyOn(localStorage, 'setItem')
  expect(exports.applyImportPayload(incoming).success).toBe(false)
  expect(spy).not.toHaveBeenCalled()
})

it.each([
  { repeatType: 'daily' }, { repeatType: 'weekdays' },
  { repeatType: 'weekly', weeklyMode: 'strict', weeklyDays: [1, 3, 5] },
  { repeatType: 'weekly', weeklyMode: 'flexible', weeklyFlexibleCount: 3 },
  { repeatType: 'biweekly' }, { repeatType: 'monthly' },
  { repeatType: 'monthly_fixed', monthlyDays: [1, 31, -1] },
  { repeatType: 'custom', customIntervalDays: 3 },
])('accepts legitimate schedule data and keeps its calendar watermark (%j)', async (patch) => {
  const h = addHabit({ ...patch, lastMissCheckDate: '2026-09-10' } as Partial<Habit>)
  const incoming = payload()
  expect(exports.parseImportText(JSON.stringify(incoming)).success).toBe(true)
  expect(exports.applyImportPayload(incoming)).toEqual({ success: true })
  await habits.persist.rehydrate()
  expect(habits.getState().habits.find(x => x.id === h.id)?.lastMissCheckDate).toBe('2026-09-10')
  expect(() => habits.getState().getTodayHabits()).not.toThrow()
})

it('accepts valid leap dates and a completed-habit recovery snapshot', () => {
  const h = addHabit({ startDate: '2024-02-29' })
  habits.getState().completeHabit(h.id)
  expect(exports.parseImportText(exports.serializeExportData()).success).toBe(true)
})

function addLaterRecords() {
  const folderId = sops.getState().addFolder('Synthetic folder')
  sops.getState().addSOP({ folderId, title: 'Created after backup', displayStyle: 'numbered', steps: [], isSystem: false })
  inspirations.getState().addInspiration('Created after backup')
}

function olderPayload() {
  const incoming = payload()
  delete incoming.data.sops
  delete incoming.data.inspirations
  incoming.appVersion = '0.2.0'
  return incoming
}

it('v0.2 restore explicitly clears SOPs, inspirations, selection and collapsed folders', async () => {
  const incoming = olderPayload()
  addLaterRecords()
  sops.setState({ selectedSOPId: sops.getState().sops[0].id, collapsedFolderIds: ['old-folder'] })
  expect(exports.applyImportPayload(incoming)).toEqual({ success: true })
  await sops.persist.rehydrate()
  await inspirations.persist.rehydrate()
  expect(sops.getState().sops).toEqual([])
  expect(sops.getState().folders).toEqual([])
  expect(sops.getState().selectedSOPId).toBeNull()
  expect(sops.getState().collapsedFolderIds).toEqual([])
  expect(inspirations.getState().inspirations).toEqual([])
})

it('rolls the newly cleared optional slices back when the last import write fails', () => {
  const incoming = olderPayload()
  addLaterRecords()
  const originalSops = localStorage.getItem('anvilite-sops')
  const originalInspirations = localStorage.getItem('anvilite-inspirations')
  const realSet = localStorage.setItem.bind(localStorage)
  let once = true
  vi.spyOn(localStorage, 'setItem').mockImplementation((key, value) => {
    if (key === 'anvilite-inspirations' && once) { once = false; throw new Error('synthetic quota') }
    realSet(key, value)
  })
  expect(exports.applyImportPayload(incoming)).toEqual({ success: false, error: 'write_failed' })
  expect(localStorage.getItem('anvilite-sops')).toBe(originalSops)
  expect(localStorage.getItem('anvilite-inspirations')).toBe(originalInspirations)
})

it('reports a failed rollback instead of claiming that original data was restored', () => {
  const incoming = olderPayload()
  addLaterRecords()
  const realSet = localStorage.setItem.bind(localStorage)
  vi.spyOn(localStorage, 'setItem').mockImplementation((key, value) => {
    if (key === 'anvilite-inspirations') throw new Error('synthetic persistent quota')
    realSet(key, value)
  })
  expect(exports.applyImportPayload(incoming)).toEqual({ success: false, error: 'rollback_failed' })
})

it('rejects an invalidated account before export, import or native sync and leaves the other account untouched', async () => {
  tasks.getState().addTask({ title: 'Account A task' })
  const incoming = payload()
  const api = native()
  const otherKey = 'anvilite-synthetic-b-tasks'
  localStorage.setItem(otherKey, 'synthetic B original bytes')
  localStorage.setItem('anvilite-current-account', 'synthetic-b')
  const spy = vi.spyOn(localStorage, 'setItem')
  expect(() => exports.buildExportPayload()).toThrow('account_changed')
  expect(() => exports.serializeExportData(incoming)).toThrow('account_changed')
  expect(await exports.exportData()).toEqual({ success: false, error: 'account_changed' })
  expect(exports.applyImportPayload(incoming)).toEqual({ success: false, error: 'account_changed' })
  expect(await sync.chooseSyncDir()).toEqual({ success: false, error: 'account_changed' })
  expect(await sync.readSyncMetadata('unused')).toEqual({ success: false, error: 'account_changed' })
  expect(await sync.writeSyncSnapshot('unused')).toEqual({ success: false, error: 'account_changed' })
  expect(await sync.restoreFromSync('unused')).toEqual({ success: false, error: 'account_changed' })
  expect(spy).not.toHaveBeenCalled()
  expect(api.saveFile).not.toHaveBeenCalled()
  expect(api.readSyncFile).not.toHaveBeenCalled()
  expect(api.writeSyncFile).not.toHaveBeenCalled()
  expect(api.selectSyncDirectory).not.toHaveBeenCalled()
  expect(localStorage.getItem(otherKey)).toBe('synthetic B original bytes')
  expect(tasks.persist.getOptions().name).toBe('anvilite-tasks')
  expect(sync.getSyncFileName()).toBe('anvilite-sync-default.json')
})

it('requires reload after a storage event even if another instance switches back to the original account', async () => {
  const api = native()
  storageChanged?.({ key: 'anvilite-current-account', oldValue: 'default', newValue: 'synthetic-b' })
  // The final shared key is already back on A; the event still invalidates this window.
  expect(await sync.writeSyncSnapshot('unused')).toEqual({ success: false, error: 'account_changed' })
  expect(api.writeSyncFile).not.toHaveBeenCalled()
})

it('checks account identity again after reading an import file', async () => {
  const text = exports.serializeExportData()
  const read = deferred<string>()
  const operation = exports.importData({ text: () => read.promise } as File)
  localStorage.setItem('anvilite-current-account', 'synthetic-b')
  const spy = vi.spyOn(localStorage, 'setItem')
  read.resolve(text)
  expect(await operation).toEqual({ success: false, error: 'account_changed' })
  expect(spy).not.toHaveBeenCalled()
  expect(reload).not.toHaveBeenCalled()
})

it('does not persist a directory selected after an account change', async () => {
  const api = native()
  const selected = deferred<{ success: boolean; path: string }>()
  api.selectSyncDirectory.mockReturnValue(selected.promise)
  const operation = sync.chooseSyncDir()
  localStorage.setItem('anvilite-current-account', 'synthetic-b')
  selected.resolve({ success: true, path: 'synthetic-unused' })
  expect(await operation).toEqual({ success: false, error: 'account_changed' })
  expect(localStorage.getItem('anvilite-sync-dir')).toBeNull()
})

it('does not create a restore backup or write local data after the remote read changes accounts', async () => {
  const text = exports.serializeExportData()
  const api = native()
  const read = deferred<{ success: boolean; exists: boolean; content: string }>()
  api.readSyncFile.mockReturnValue(read.promise)
  const operation = sync.restoreFromSync('unused')
  localStorage.setItem('anvilite-current-account', 'synthetic-b')
  const spy = vi.spyOn(localStorage, 'setItem')
  read.resolve({ success: true, exists: true, content: text })
  expect(await operation).toEqual({ success: false, error: 'account_changed' })
  expect(api.writeSyncFile).not.toHaveBeenCalled()
  expect(spy).not.toHaveBeenCalled()
  expect(reload).not.toHaveBeenCalled()
})

it('does not import after the before-restore backup finishes under a changed account', async () => {
  const text = exports.serializeExportData()
  const api = native()
  api.readSyncFile.mockResolvedValue({ success: true, exists: true, content: text })
  const backup = deferred<{ success: boolean }>()
  api.writeSyncFile.mockReturnValue(backup.promise)
  const operation = sync.restoreFromSync('unused')
  await Promise.resolve()
  expect(api.writeSyncFile).toHaveBeenCalledOnce()
  localStorage.setItem('anvilite-current-account', 'synthetic-b')
  const spy = vi.spyOn(localStorage, 'setItem')
  backup.resolve({ success: true })
  expect(await operation).toEqual({ success: false, error: 'account_changed' })
  expect(spy).not.toHaveBeenCalled()
  expect(reload).not.toHaveBeenCalled()
})

it('does not record sync success after the native write finishes under a changed account', async () => {
  const api = native()
  const write = deferred<{ success: boolean }>()
  api.writeSyncFile.mockReturnValue(write.promise)
  const operation = sync.writeSyncSnapshot('unused')
  localStorage.setItem('anvilite-current-account', 'synthetic-b')
  write.resolve({ success: true })
  expect(await operation).toEqual({ success: false, error: 'account_changed' })
  expect(localStorage.getItem('anvilite-sync-last-exported-at')).toBeNull()
  expect(api.writeSyncFile.mock.calls[0][1]).toBe('anvilite-sync-default.json')
})

it('returns native write failures and supports an explicit retry without a stuck utility state', async () => {
  const api = native()
  api.writeSyncFile.mockRejectedValueOnce(new Error('ENOSPC: synthetic disk full')).mockResolvedValue({ success: true })
  expect(await sync.writeSyncSnapshot('unused')).toEqual({ success: false, error: 'write_failed' })
  expect(localStorage.getItem('anvilite-sync-last-exported-at')).toBeNull()
  expect((await sync.writeSyncSnapshot('unused')).success).toBe(true)
  expect(localStorage.getItem('anvilite-sync-last-exported-at')).toBe(new Date('2026-09-11T12:00:00').toISOString())
})

it('surfaces directory reauthorization and does not apply local records without a successful backup', async () => {
  const text = exports.serializeExportData()
  const api = native()
  api.readSyncFile.mockResolvedValue({ success: true, exists: true, content: text })
  api.writeSyncFile.mockResolvedValue({ success: false, error: 'directory_not_authorized' })
  const spy = vi.spyOn(localStorage, 'setItem')
  expect(await sync.restoreFromSync('unused')).toEqual({ success: false, error: 'directory_not_authorized' })
  expect(spy).not.toHaveBeenCalled()
  expect(reload).not.toHaveBeenCalled()
})

it('restores after an explicit retry when a native backup write previously rejected', async () => {
  const text = exports.serializeExportData()
  const api = native()
  api.readSyncFile.mockResolvedValue({ success: true, exists: true, content: text })
  api.writeSyncFile.mockRejectedValueOnce(new Error('synthetic unavailable drive')).mockResolvedValue({ success: true })
  expect(await sync.restoreFromSync('unused')).toEqual({ success: false, error: 'restore_failed' })
  expect(reload).not.toHaveBeenCalled()
  expect(await sync.restoreFromSync('unused')).toEqual({ success: true })
  expect(reload).toHaveBeenCalledOnce()
})

it('rejects malformed or other-account sync content before making a local backup', async () => {
  const incoming = payload()
  incoming.accountId = 'synthetic-b'
  const api = native()
  api.readSyncFile.mockResolvedValueOnce({ success: true, exists: true, content: '{}' })
    .mockResolvedValue({ success: true, exists: true, content: JSON.stringify(incoming) })
  expect((await sync.restoreFromSync('unused')).success).toBe(false)
  expect(await sync.restoreFromSync('unused')).toEqual({ success: false, error: 'account_mismatch' })
  expect(api.writeSyncFile).not.toHaveBeenCalled()
})

it('distinguishes canceled, failed and successful native exports', async () => {
  const api = native()
  api.saveFile.mockResolvedValueOnce({ success: false, canceled: true })
    .mockResolvedValueOnce({ success: false, error: 'write_failed' })
    .mockResolvedValueOnce({ success: true })
  expect(await exports.exportData()).toEqual({ success: false, canceled: true, error: 'canceled' })
  expect(await exports.exportData()).toEqual({ success: false, canceled: undefined, error: 'write_failed' })
  expect(await exports.exportData()).toEqual({ success: true })
})
