import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { SOPStep } from '@/types/sop'
import { resolveSOPLibrary, isSystemTemplateFolder } from '@/utils/sopLibrary'
import { getSystemSOPs, SYSTEM_FOLDER_ID } from '@/data/systemSOPs'

const memoryStorage = localStorage
let store: typeof import('./sopStore')['useSOPStore']
beforeEach(async () => {
  vi.resetModules()
  vi.stubGlobal('localStorage', memoryStorage)
  vi.stubGlobal('window', { localStorage: memoryStorage })
  localStorage.clear()
  store = (await import('./sopStore')).useSOPStore
})
afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})
function library(lang: 'zh' | 'en' = 'zh') { return resolveSOPLibrary(store.getState(), lang) }
async function coldReload() {
  vi.resetModules()
  store = (await import('./sopStore')).useSOPStore
}
function step(id: string, childSteps: SOPStep[] = []): SOPStep {
  return { id, title: id, time: null, sortOrder: 0, childSteps,
    content: { type: 'doc', attrs: { metadata: { labels: ['original'] } },
      content: [{ type: 'paragraph', content: [{ type: 'text', text: id }] }] } }
}
function deepSteps() { return [step('one', [step('two', [step('three')])])] }
function ids(steps: SOPStep[]): string[] { return steps.flatMap(step => [step.id, ...ids(step.childSteps)]) }
function create(folderId: string, title = 'User flow') {
  return store.getState().addSOP({ folderId, title, isSystem: false, displayStyle: 'bullet', steps: deepSteps() })
}

it('resolves untouched built-ins in either language without materializing or persisting them', () => {
  const writes = vi.spyOn(localStorage, 'setItem')
  expect(library('zh').sops).toHaveLength(8)
  expect(library('en').sops[0].title).not.toBe(library('zh').sops[0].title)
  expect(store.getState().sops).toEqual([])
  expect(store.getState().folders).toEqual([])
  expect(writes).not.toHaveBeenCalled()
})

it('does not materialize an untouched template when conversion only records lastUsedAt, keeping language changes live', async () => {
  const settings = (await import('./settingsStore')).useSettingsStore
  const source = library('zh').sops[0]
  const writes = vi.spyOn(localStorage, 'setItem')
  // SOPToTaskModal makes this exact metadata-only update after creating the task.
  store.getState().updateSOP(source.id, { lastUsedAt: '2026-10-22T10:00:00.000Z' })
  expect(store.getState().sops).toEqual([])
  expect(writes).not.toHaveBeenCalled()
  settings.getState().setLanguage('en')
  const english = library(settings.getState().settings.language).sops.find(sop => sop.id === source.id)!
  expect(english.title).toBe(getSystemSOPs('en').find(sop => sop.id === source.id)!.title)
  expect(english.title).not.toBe(source.title)
  store.getState().updateSOP(source.id, { lastUsedAt: '2026-10-22T11:00:00.000Z' })
  await coldReload()
  expect(store.getState().sops).toEqual([])
  expect(library('zh').sops.find(sop => sop.id === source.id)?.title).toBe(source.title)
  expect(library('en').sops.find(sop => sop.id === source.id)?.title).toBe(english.title)
})

it('persists lastUsedAt normally for edited built-in overrides and user flows', async () => {
  const source = library().sops[0]
  const usedAt = '2026-10-22T10:00:00.000Z'
  store.getState().updateSOP(source.id, { title: 'Explicit local edit', lastUsedAt: usedAt })
  const folder = store.getState().addFolder('User flows')
  const userId = create(folder)
  const later = '2026-10-22T11:00:00.000Z'
  for (const id of [source.id, userId]) store.getState().updateSOP(id, { lastUsedAt: later })
  await coldReload()
  expect(store.getState().sops.find(sop => sop.id === source.id)?.title).toBe('Explicit local edit')
  expect(store.getState().sops.find(sop => sop.id === source.id)?.lastUsedAt).toBe(later)
  expect(store.getState().sops.find(sop => sop.id === userId)?.lastUsedAt).toBe(later)
})

it('materializes a built-in only on explicit save and keeps one override with deeply isolated content', () => {
  const source = library('en').sops[0]
  const draft = deepSteps()
  store.getState().updateSOP(source.id, { title: 'Saved local edit', displayStyle: 'timeline', steps: draft }, 'en')
  const saved = store.getState().sops[0]
  expect(saved.id).toBe(source.id)
  expect(saved.title).toBe('Saved local edit')
  expect(saved.isSystem).toBe(true)
  expect(library('zh').sops.find(sop => sop.id === source.id)?.title).toBe('Saved local edit')
  expect(library('en').sops[1].title).not.toBe(library('zh').sops[1].title)
  draft[0].title = 'Later draft edit'
  draft[0].content!.attrs!.metadata.labels.push('later')
  expect(saved.steps[0].title).toBe('one')
  expect(saved.steps[0].content!.attrs!.metadata.labels).toEqual(['original'])
  store.getState().updateSOP(source.id, { title: 'Saved again' }, 'en')
  expect(store.getState().sops.filter(sop => sop.id === source.id)).toHaveLength(1)
})

it('supports renaming the system root, adding folders and flows inside it, and reading inherited system ancestry', () => {
  store.getState().renameFolder(SYSTEM_FOLDER_ID, 'My system library')
  const child = store.getState().addFolder('Child', SYSTEM_FOLDER_ID)
  const grandchild = store.getState().addFolder('Grandchild', child)
  const source = create(grandchild)
  expect(source).not.toBe('')
  expect(store.getState().getFolderDepth(SYSTEM_FOLDER_ID)).toBe(0)
  expect(store.getState().getFolderDepth(grandchild)).toBe(2)
  expect(isSystemTemplateFolder(grandchild, library().folders)).toBe(true)
  expect(library('en').folders.find(folder => folder.id === SYSTEM_FOLDER_ID)?.name).toBe('My system library')
  expect(store.getState().addFolder('Too deep', grandchild)).toBe('')
})

it('copies a built-in and every nested step with new IDs and isolated rich-text JSON', () => {
  const source = library().sops[0]
  store.getState().updateSOP(source.id, { steps: deepSteps(), displayStyle: 'timeline' })
  const folder = store.getState().addFolder('Destination')
  const copiedId = store.getState().transferSOP(source.id, folder, 'zh')
  const copied = library().sops.find(sop => sop.id === copiedId)!
  const original = library().sops.find(sop => sop.id === source.id)!
  expect(copiedId).not.toBe(source.id)
  expect(copied.folderId).toBe(folder)
  expect(original.folderId).toBe(SYSTEM_FOLDER_ID)
  expect(copied.displayStyle).toBe('timeline')
  expect(copied.isSystem).toBe(false)
  expect(copied.lastUsedAt).toBeNull()
  expect(ids(copied.steps)).toHaveLength(3)
  expect(ids(copied.steps).every(id => !ids(original.steps).includes(id))).toBe(true)
  copied.steps[0].childSteps[0].content!.attrs!.metadata.labels.push('copy only')
  copied.steps[0].childSteps[0].childSteps[0].title = 'changed copy'
  expect(original.steps[0].childSteps[0].content!.attrs!.metadata.labels).toEqual(['original'])
  expect(original.steps[0].childSteps[0].childSteps[0].title).toBe('three')
})

it('copies even a user-created flow from a system descendant, but moves ordinary user flows without duplicating them', () => {
  const child = store.getState().addFolder('System child', SYSTEM_FOLDER_ID)
  const outside = store.getState().addFolder('Outside')
  const secondOutside = store.getState().addFolder('Other outside')
  const systemChildFlow = create(child)
  const copied = store.getState().transferSOP(systemChildFlow, outside)
  expect(copied).not.toBe(systemChildFlow)
  expect(library().sops.find(sop => sop.id === systemChildFlow)?.folderId).toBe(child)
  const count = store.getState().sops.length
  expect(store.getState().transferSOP(copied, secondOutside)).toBe(copied)
  expect(store.getState().sops.length).toBe(count)
  expect(library().sops.find(sop => sop.id === copied)?.folderId).toBe(secondOutside)
  expect(store.getState().transferSOP(systemChildFlow, child)).toBe(systemChildFlow)
  expect(store.getState().sops.length).toBe(count)
})

it('duplicates built-in flows in place with localized titles and independent step identities', () => {
  const source = library('en').sops[0]
  const copyId = store.getState().duplicateSOP(source.id, 'en')
  const copied = library('en').sops.find(sop => sop.id === copyId)!
  expect(copied.title).toBe(source.title + ' (Copy)')
  expect(copied.folderId).toBe(SYSTEM_FOLDER_ID)
  expect(ids(copied.steps).every(id => !ids(source.steps).includes(id))).toBe(true)
})

it('rejects missing or deleted copy targets and missing sources before any write', () => {
  const source = library().sops[0]
  const target = store.getState().addFolder('Deleted target')
  store.getState().deleteFolder(target)
  const writes = vi.spyOn(localStorage, 'setItem')
  expect(store.getState().copySOPToFolder(source.id, target)).toBe('')
  expect(store.getState().transferSOP(source.id, 'missing')).toBe('')
  expect(store.getState().copySOPToFolder('missing', SYSTEM_FOLDER_ID)).toBe('')
  expect(create('missing')).toBe('')
  expect(writes).not.toHaveBeenCalled()
})

it('deletes a built-in override persistently without resurrecting its static template on reload', async () => {
  const source = library().sops[0]
  store.getState().updateSOP(source.id, { title: 'Before delete' })
  store.getState().selectSOP(source.id)
  store.getState().deleteSOP(source.id)
  expect(store.getState().sops).toEqual([])
  expect(store.getState().selectedSOPId).toBeNull()
  expect(store.getState().deletedSystemSOPIds).toEqual([source.id])
  await coldReload()
  expect(library('en').sops.some(sop => sop.id === source.id)).toBe(false)
  store.getState().updateSOP(source.id, { title: 'Stale editor must not revive it' })
  expect(store.getState().sops).toEqual([])
})

it('deletes the system tree and its descendants without deleting copies already placed outside', async () => {
  const source = library().sops[0]
  const outside = store.getState().addFolder('Outside')
  const copied = store.getState().copySOPToFolder(source.id, outside)
  const child = store.getState().addFolder('Inside', SYSTEM_FOLDER_ID)
  const grandchild = store.getState().addFolder('Nested', child)
  create(grandchild)
  store.getState().selectSOP(source.id)
  store.getState().deleteFolderRecursive(SYSTEM_FOLDER_ID)
  await coldReload()
  expect(library().folders.map(folder => folder.id)).toEqual([outside])
  expect(library().sops.map(sop => sop.id)).toEqual([copied])
  expect(store.getState().selectedSOPId).toBeNull()
  expect(store.getState().deletedSystemFolderIds).toEqual([SYSTEM_FOLDER_ID])
})

it('does not resurrect a built-in after its local override was moved into a user folder that is deleted', async () => {
  const source = library().sops[0]
  const folder = store.getState().addFolder('Temporary')
  store.getState().updateSOP(source.id, { folderId: folder })
  store.getState().deleteFolder(folder)
  await coldReload()
  expect(library().sops.some(sop => sop.id === source.id)).toBe(false)
  expect(store.getState().deletedSystemSOPIds).toContain(source.id)
})

it('guards folder cycles and preserves omitted folders when only part of a list is reordered', () => {
  const first = store.getState().addFolder('First')
  const child = store.getState().addFolder('Child', first)
  const other = store.getState().addFolder('Other')
  store.getState().moveFolder(first, child)
  expect(library().folders.find(folder => folder.id === first)?.parentId).toBeNull()
  store.getState().reorderFolders([other])
  expect(library().folders.some(folder => folder.id === first)).toBe(true)
  expect(library().folders.some(folder => folder.id === child)).toBe(true)
  const folders = store.getState().folders.map(folder => folder.id === first ? { ...folder, parentId: child } : folder)
  store.setState({ folders })
  expect(store.getState().getFolderDepth(first)).toBe(Number.MAX_SAFE_INTEGER)
  expect(isSystemTemplateFolder(first, folders)).toBe(false)
})

it('preserves saved displayStyle during cold hydration even without the historical migration marker', async () => {
  const folder = store.getState().addFolder('Saved')
  const bullet = create(folder)
  const timeline = create(folder)
  store.getState().setDisplayStyle(timeline, 'timeline')
  localStorage.removeItem('anvilite-migration-sop-v031')
  await coldReload()
  expect(library().sops.find(sop => sop.id === bullet)?.displayStyle).toBe('bullet')
  expect(library().sops.find(sop => sop.id === timeline)?.displayStyle).toBe('timeline')
})

it('normalizes an old backup imported after a migration marker exists and stays correct on repeated cold reloads', async () => {
  const folder = store.getState().addFolder('Legacy')
  const id = create(folder)
  const stored = JSON.parse(localStorage.getItem('anvilite-sops')!)
  const legacy = stored.state.sops.find((sop: { id: string }) => sop.id === id)
  delete legacy.displayStyle
  legacy.type = 'schedule'
  localStorage.setItem('anvilite-sops', JSON.stringify(stored))
  localStorage.setItem('anvilite-migration-sop-v031', 'already-migrated')
  await coldReload()
  expect(library().sops.find(sop => sop.id === id)?.displayStyle).toBe('timeline')
  await coldReload()
  expect(library().sops.find(sop => sop.id === id)?.displayStyle).toBe('timeline')
})

it('keeps static source data unchanged after arbitrary resolver reads, overrides, copies and deletions', () => {
  const original = JSON.stringify(getSystemSOPs('en'))
  const source = library('en').sops[0]
  const target = store.getState().addFolder('Copied')
  store.getState().copySOPToFolder(source.id, target, 'en')
  store.getState().updateSOP(source.id, { title: 'Local only' }, 'en')
  store.getState().deleteSOP(source.id)
  expect(JSON.stringify(getSystemSOPs('en'))).toBe(original)
})
