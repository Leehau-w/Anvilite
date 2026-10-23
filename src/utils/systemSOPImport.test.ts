import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { resolveSOPLibrary } from './sopLibrary'
import { SYSTEM_FOLDER_ID } from '@/data/systemSOPs'

const memoryStorage = localStorage
const memorySessionStorage = sessionStorage
let sops: typeof import('@/stores/sopStore')['useSOPStore']
let data: typeof import('./dataExport')
beforeEach(async () => {
  vi.resetModules()
  vi.stubGlobal('localStorage', memoryStorage)
  vi.stubGlobal('sessionStorage', memorySessionStorage)
  localStorage.clear()
  vi.stubGlobal('window', { localStorage, location: { reload: vi.fn() }, addEventListener: vi.fn() })
  data = await import('./dataExport')
  sops = (await import('@/stores/sopStore')).useSOPStore
})
afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})
function library() { return resolveSOPLibrary(sops.getState(), 'zh') }
function backup() { return JSON.parse(data.serializeExportData()) }
async function reload() {
  vi.resetModules()
  sops = (await import('@/stores/sopStore')).useSOPStore
}
function snapshot() {
  const { folders, sops: flows, deletedSystemFolderIds, deletedSystemSOPIds, selectedSOPId, collapsedFolderIds } = sops.getState()
  return structuredClone({ folders, sops: flows, deletedSystemFolderIds, deletedSystemSOPIds, selectedSOPId, collapsedFolderIds })
}

it('round trips system overrides, copied flows, local system children, tombstones and view metadata across import and cold reload', async () => {
  const [edited, removed] = library().sops
  const folder = sops.getState().addFolder('Local system child', SYSTEM_FOLDER_ID)
  const outside = sops.getState().addFolder('Outside')
  sops.getState().updateSOP(edited.id, { title: 'Saved override', displayStyle: 'timeline' })
  sops.getState().copySOPToFolder(edited.id, outside, 'zh')
  sops.getState().addSOP({ folderId: folder, title: 'User system flow', displayStyle: 'bullet', isSystem: false, steps: [] })
  sops.getState().deleteSOP(removed.id)
  sops.getState().selectSOP(edited.id)
  sops.getState().toggleFolderCollapsed(folder)
  const expected = snapshot()
  const incoming = backup()
  sops.getState().deleteFolderRecursive(SYSTEM_FOLDER_ID)
  expect(data.applyImportPayload(incoming)).toEqual({ success: true })
  await reload()
  expect(snapshot()).toEqual(expected)
  expect(library().sops.find(sop => sop.id === edited.id)?.title).toBe('Saved override')
  expect(library().sops.some(sop => sop.id === removed.id)).toBe(false)
  expect(library().sops.find(sop => sop.id === edited.id)?.displayStyle).toBe('timeline')
})

it('does not resurrect an untouched default system flow after deletion, export/import and repeated cold reloads', async () => {
  const source = library().sops[0]
  expect(sops.getState().sops).toEqual([])
  sops.getState().deleteSOP(source.id)
  const incoming = backup()
  expect(incoming.data.sops.deletedSystemSOPIds).toEqual([source.id])
  expect(data.applyImportPayload(incoming)).toEqual({ success: true })
  await reload()
  expect(library().sops.some(sop => sop.id === source.id)).toBe(false)
  await reload()
  expect(library().sops.some(sop => sop.id === source.id)).toBe(false)
})

it('keeps a deleted system root and its default templates absent across a backup round trip', async () => {
  sops.getState().deleteFolderRecursive(SYSTEM_FOLDER_ID)
  const incoming = backup()
  expect(data.applyImportPayload(incoming)).toEqual({ success: true })
  await reload()
  expect(library()).toEqual({ folders: [], sops: [] })
})

it.each(['metadata', 'slice'])('clears current system tombstones when an older backup omits the SOP %s', async missing => {
  const old = backup()
  if (missing === 'slice') delete old.data.sops
  else {
    delete old.data.sops.deletedSystemFolderIds
    delete old.data.sops.deletedSystemSOPIds
    delete old.data.sops.selectedSOPId
    delete old.data.sops.collapsedFolderIds
  }
  sops.getState().deleteFolderRecursive(SYSTEM_FOLDER_ID)
  expect(library().sops).toEqual([])
  expect(data.applyImportPayload(old)).toEqual({ success: true })
  const stored = JSON.parse(localStorage.getItem('anvilite-sops')!).state
  expect(stored.deletedSystemFolderIds).toEqual([])
  expect(stored.deletedSystemSOPIds).toEqual([])
  expect(stored.collapsedFolderIds).toEqual([])
  expect(stored.selectedSOPId).toBeNull()
  await reload()
  expect(library().sops).toHaveLength(8)
})

it.each([
  { deletedSystemFolderIds: null }, { deletedSystemFolderIds: [42] },
  { deletedSystemSOPIds: 'all' }, { deletedSystemSOPIds: [{}] },
  { collapsedFolderIds: {} }, { selectedSOPId: 42 },
  { deletedSystemFolderIds: ['unknown-system-folder'] },
  { deletedSystemFolderIds: [SYSTEM_FOLDER_ID, SYSTEM_FOLDER_ID] },
  { deletedSystemSOPIds: ['unknown-system-flow'] },
  { deletedSystemSOPIds: ['__sys_meetingPrep', '__sys_meetingPrep'] },
])('rejects malformed library metadata %j before any store is written', patch => {
  const incoming = backup()
  Object.assign(incoming.data.sops, patch)
  const writes = vi.spyOn(localStorage, 'setItem')
  expect(data.applyImportPayload(incoming)).toEqual({ success: false, error: 'invalid_sops' })
  expect(writes).not.toHaveBeenCalled()
})

it('retains the current tombstones if a later restore write fails and rollback is required', async () => {
  const incoming = backup()
  sops.getState().deleteSOP(library().sops[0].id)
  const expected = snapshot()
  const originalSet = localStorage.setItem.bind(localStorage)
  let failed = false
  vi.spyOn(localStorage, 'setItem').mockImplementation((key, value) => {
    if (key === 'anvilite-inspirations' && !failed) { failed = true; throw new Error('Synthetic quota exceeded') }
    return originalSet(key, value)
  })
  expect(data.applyImportPayload(incoming)).toEqual({ success: false, error: 'write_failed' })
  await reload()
  expect(snapshot()).toEqual(expected)
})
