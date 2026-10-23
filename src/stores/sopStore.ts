import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { SOP, SOPFolder, SOPStep } from '@/types/sop'
import type { JSONContent } from '@tiptap/react'
import { getStoragePrefix } from './accountManager'
import { useSettingsStore } from './settingsStore'
import { generateId } from '@/utils/id'
import { getSystemSOPs, SYSTEM_FOLDER_ID } from '@/data/systemSOPs'
import { cloneSOPSteps, isSystemTemplateFolder, resolveSOPLibrary, type SOPLanguage } from '@/utils/sopLibrary'

// Legacy rich-text conversion also visits nested steps that already have content.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function migrateStepContent(step: any): SOPStep {
  const children = (step.childSteps ?? []).map(migrateStepContent)
  if ('content' in step && !('note' in step) && !('warning' in step)) return { ...step, childSteps: children }
  const blocks: JSONContent[] = []
  if (step.warning) blocks.push({ type: 'callout', attrs: { variant: 'warning' },
    content: [{ type: 'paragraph', content: [{ type: 'text', text: step.warning }] }] })
  if (step.note) blocks.push({ type: 'callout', attrs: { variant: 'info' },
    content: [{ type: 'paragraph', content: [{ type: 'text', text: step.note }] }] })
  const { note: _n, warning: _w, ...rest } = step
  return { ...rest, content: step.content ?? (blocks.length ? { type: 'doc', content: blocks } : null), childSteps: children }
}
function language(lang?: SOPLanguage): SOPLanguage { return lang ?? useSettingsStore.getState().settings.language }
const systemSOPIds = new Set(getSystemSOPs('zh').map(sop => sop.id))

export interface SOPState {
  folders: SOPFolder[]
  sops: SOP[]
  deletedSystemFolderIds: string[]
  deletedSystemSOPIds: string[]
  selectedSOPId: string | null
  collapsedFolderIds: string[]
  addFolder: (name: string, parentId?: string) => string
  renameFolder: (id: string, name: string) => void
  deleteFolder: (id: string) => void
  deleteFolderRecursive: (id: string) => void
  moveFolder: (folderId: string, targetParentId: string | null) => void
  getFolderDepth: (folderId: string) => number
  reorderFolders: (ids: string[]) => void
  addSOP: (sop: Omit<SOP, 'id' | 'createdAt' | 'updatedAt' | 'lastUsedAt' | 'sortOrder'>) => string
  updateSOP: (id: string, updates: Partial<SOP>, lang?: SOPLanguage) => void
  deleteSOP: (id: string) => void
  duplicateSOP: (id: string, lang?: SOPLanguage) => string
  copySOPToFolder: (sopId: string, targetFolderId: string, lang?: SOPLanguage) => string
  transferSOP: (sopId: string, targetFolderId: string, lang?: SOPLanguage) => string
  moveSOP: (sopId: string, targetFolderId: string) => void
  setDisplayStyle: (sopId: string, style: SOP['displayStyle']) => void
  reorderSOPs: (folderId: string, ids: string[]) => void
  selectSOP: (id: string | null) => void
  toggleFolderCollapsed: (id: string) => void
}

export const useSOPStore = create<SOPState>()(
  persist(
    (set, get) => ({
      folders: [], sops: [], deletedSystemFolderIds: [], deletedSystemSOPIds: [],
      selectedSOPId: null, collapsedFolderIds: [],
      addFolder: (name, parentId) => {
        const library = resolveSOPLibrary(get(), language())
        if (parentId && (!library.folders.some(folder => folder.id === parentId) || get().getFolderDepth(parentId) >= 2)) return ''
        const id = generateId()
        const folder: SOPFolder = { id, name, parentId: parentId ?? null,
          sortOrder: library.folders.length, isSystem: false, createdAt: new Date().toISOString() }
        set(state => ({ folders: [...state.folders, folder] }))
        return id
      },
      renameFolder: (id, name) => {
        const source = resolveSOPLibrary(get(), language()).folders.find(folder => folder.id === id)
        if (!source) return
        set(state => ({ folders: [...state.folders.filter(folder => folder.id !== id), { ...source, name }] }))
      },
      deleteFolder: id => get().deleteFolderRecursive(id),
      deleteFolderRecursive: id => {
        const library = resolveSOPLibrary(get(), language())
        if (!library.folders.some(folder => folder.id === id)) return
        const removed = new Set<string>()
        const visit = (folderId: string) => {
          if (removed.has(folderId)) return
          removed.add(folderId)
          library.folders.filter(folder => folder.parentId === folderId).forEach(folder => visit(folder.id))
        }
        visit(id)
        const removedSOPs = library.sops.filter(sop => removed.has(sop.folderId))
        const selectedRemoved = removedSOPs.some(sop => sop.id === get().selectedSOPId)
        set(state => ({
          folders: state.folders.filter(folder => !removed.has(folder.id)),
          sops: state.sops.filter(sop => !removed.has(sop.folderId)),
          deletedSystemFolderIds: [...new Set([...(state.deletedSystemFolderIds ?? []), ...(removed.has(SYSTEM_FOLDER_ID) ? [SYSTEM_FOLDER_ID] : [])])],
          deletedSystemSOPIds: [...new Set([...(state.deletedSystemSOPIds ?? []), ...removedSOPs.filter(sop => systemSOPIds.has(sop.id)).map(sop => sop.id)])],
          selectedSOPId: selectedRemoved ? null : state.selectedSOPId,
          collapsedFolderIds: state.collapsedFolderIds.filter(folderId => !removed.has(folderId)),
        }))
      },
      moveFolder: (folderId, targetParentId) => {
        const library = resolveSOPLibrary(get(), language())
        const source = library.folders.find(folder => folder.id === folderId)
        if (!source || source.parentId === targetParentId || targetParentId === folderId) return
        if (targetParentId && !library.folders.some(folder => folder.id === targetParentId)) return
        const visited = new Set<string>()
        let current = targetParentId
        while (current) {
          if (current === folderId || visited.has(current)) return
          visited.add(current)
          current = library.folders.find(folder => folder.id === current)?.parentId ?? null
        }
        set(state => ({ folders: [...state.folders.filter(folder => folder.id !== folderId), { ...source, parentId: targetParentId }] }))
      },
      getFolderDepth: folderId => {
        const folders = resolveSOPLibrary(get(), language()).folders
        const visited = new Set<string>()
        let depth = 0
        let current = folders.find(folder => folder.id === folderId)
        while (current?.parentId) {
          if (visited.has(current.id)) return Number.MAX_SAFE_INTEGER
          visited.add(current.id)
          depth++
          current = folders.find(folder => folder.id === current!.parentId)
        }
        return depth
      },
      reorderFolders: ids => {
        const library = resolveSOPLibrary(get(), language())
        const patches = library.folders.filter(folder => ids.includes(folder.id)).map(folder => ({ ...folder, sortOrder: ids.indexOf(folder.id) }))
        const patched = new Set(patches.map(folder => folder.id))
        set(state => ({ folders: [...state.folders.filter(folder => !patched.has(folder.id)), ...patches] }))
      },
      addSOP: sop => {
        const library = resolveSOPLibrary(get(), language())
        if (!library.folders.some(folder => folder.id === sop.folderId)) return ''
        const id = generateId(), now = new Date().toISOString()
        const newSOP: SOP = { ...sop, id, steps: cloneSOPSteps(sop.steps),
          sortOrder: library.sops.filter(item => item.folderId === sop.folderId).length,
          lastUsedAt: null, createdAt: now, updatedAt: now }
        set(state => ({ sops: [...state.sops, newSOP] }))
        return id
      },
      updateSOP: (id, updates, lang) => {
        const library = resolveSOPLibrary(get(), language(lang))
        const source = library.sops.find(sop => sop.id === id)
        if (!source || updates.folderId !== undefined && updates.folderId !== source.folderId && !library.folders.some(folder => folder.id === updates.folderId)) return
        // Using an untouched built-in must not freeze its translated content into a local override.
        // The old store also ignored lastUsedAt until the template had a persisted local record.
        if (systemSOPIds.has(id) && !get().sops.some(sop => sop.id === id) &&
          Object.keys(updates).length === 1 && 'lastUsedAt' in updates) return
        const next: SOP = { ...source, ...updates, id, isSystem: source.isSystem,
          steps: cloneSOPSteps(updates.steps ?? source.steps), updatedAt: new Date().toISOString() }
        set(state => ({ sops: [...state.sops.filter(sop => sop.id !== id), next] }))
      },
      deleteSOP: id => {
        set(state => ({
          sops: state.sops.filter(sop => sop.id !== id),
          deletedSystemSOPIds: systemSOPIds.has(id) ? [...new Set([...(state.deletedSystemSOPIds ?? []), id])] : state.deletedSystemSOPIds,
          selectedSOPId: state.selectedSOPId === id ? null : state.selectedSOPId,
        }))
      },
      copySOPToFolder: (id, targetFolderId, lang) => {
        const library = resolveSOPLibrary(get(), language(lang))
        const source = library.sops.find(sop => sop.id === id)
        if (!source || !library.folders.some(folder => folder.id === targetFolderId)) return ''
        return get().addSOP({ ...source, folderId: targetFolderId, isSystem: false, steps: cloneSOPSteps(source.steps, true) })
      },
      duplicateSOP: (id, lang) => {
        const currentLanguage = language(lang)
        const source = resolveSOPLibrary(get(), currentLanguage).sops.find(sop => sop.id === id)
        if (!source) return ''
        const newId = get().copySOPToFolder(id, source.folderId, currentLanguage)
        if (newId) get().updateSOP(newId, { title: source.title + (currentLanguage === 'zh' ? ' (副本)' : ' (Copy)') }, currentLanguage)
        return newId
      },
      transferSOP: (id, targetFolderId, lang) => {
        const currentLanguage = language(lang)
        const library = resolveSOPLibrary(get(), currentLanguage)
        const source = library.sops.find(sop => sop.id === id)
        if (!source || !library.folders.some(folder => folder.id === targetFolderId)) return ''
        if (source.folderId === targetFolderId) return id
        if (isSystemTemplateFolder(source.folderId, library.folders)) return get().copySOPToFolder(id, targetFolderId, currentLanguage)
        get().updateSOP(id, { folderId: targetFolderId }, currentLanguage)
        return id
      },
      moveSOP: (id, targetFolderId) => { get().transferSOP(id, targetFolderId) },
      setDisplayStyle: (id, displayStyle) => get().updateSOP(id, { displayStyle }),
      reorderSOPs: (folderId, ids) => {
        const library = resolveSOPLibrary(get(), language())
        for (const sop of library.sops.filter(sop => sop.folderId === folderId && ids.includes(sop.id))) {
          get().updateSOP(sop.id, { sortOrder: ids.indexOf(sop.id) })
        }
      },
      selectSOP: id => set({ selectedSOPId: id }),
      toggleFolderCollapsed: id => set(state => ({
        collapsedFolderIds: state.collapsedFolderIds.includes(id)
          ? state.collapsedFolderIds.filter(value => value !== id) : [...state.collapsedFolderIds, id],
      })),
    }),
    {
      name: getStoragePrefix() + '-sops',
      onRehydrateStorage: () => state => {
        if (!state) return
        state.collapsedFolderIds ??= []
        state.deletedSystemFolderIds ??= []
        state.deletedSystemSOPIds ??= []
        const marker = 'anvilite-migration-sop-v031'
        // Normalize each record even when an older backup is imported after the marker exists.
        state.sops = state.sops.map(sop => {
            const legacy = sop as SOP & { type?: string }
            const { type: oldType, ...rest } = legacy
            const displayStyle = ['numbered', 'bullet', 'timeline'].includes(sop.displayStyle) ? sop.displayStyle
              : oldType === 'schedule' ? 'timeline' : oldType === 'itemlist' ? 'bullet' : 'numbered'
            return { ...rest, displayStyle, steps: sop.steps.map(migrateStepContent) }
          })
        if (!localStorage.getItem(marker)) localStorage.setItem(marker, new Date().toISOString())
        state.sops = state.sops.map(sop => ({ ...sop, displayStyle: sop.displayStyle ?? 'numbered' }))
        state.folders = state.folders.map(folder => ({ ...folder, parentId: folder.parentId ?? null }))
      },
    },
  ),
)
