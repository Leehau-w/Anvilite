import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { SOP, SOPFolder } from '@/types/sop'
import { getStoragePrefix } from './accountManager'
import { generateId } from '@/utils/id'

interface SOPState {
  folders: SOPFolder[]
  sops: SOP[]
  selectedSOPId: string | null
  collapsedFolderIds: string[]

  // 文件夹 CRUD
  addFolder: (name: string) => void
  renameFolder: (id: string, name: string) => void
  deleteFolder: (id: string) => void
  reorderFolders: (ids: string[]) => void

  // SOP CRUD
  addSOP: (sop: Omit<SOP, 'id' | 'createdAt' | 'updatedAt' | 'lastUsedAt' | 'sortOrder'>) => string
  updateSOP: (id: string, updates: Partial<SOP>) => void
  deleteSOP: (id: string) => void
  duplicateSOP: (id: string) => string
  moveSOP: (sopId: string, targetFolderId: string) => void
  reorderSOPs: (folderId: string, ids: string[]) => void

  selectSOP: (id: string | null) => void
  toggleFolderCollapsed: (id: string) => void
}

export const useSOPStore = create<SOPState>()(
  persist(
    (set, get) => ({
      folders: [],
      sops: [],
      selectedSOPId: null,
      collapsedFolderIds: [],

      addFolder: (name) => {
        const folder: SOPFolder = {
          id: generateId(),
          name,
          sortOrder: get().folders.length,
          isSystem: false,
          createdAt: new Date().toISOString(),
        }
        set((s) => ({ folders: [...s.folders, folder] }))
      },

      renameFolder: (id, name) => {
        set((s) => ({
          folders: s.folders.map((f) => (f.id === id ? { ...f, name } : f)),
        }))
      },

      deleteFolder: (id) => {
        set((s) => ({
          folders: s.folders.filter((f) => f.id !== id),
          sops: s.sops.filter((sop) => sop.folderId !== id),
        }))
      },

      reorderFolders: (ids) => {
        set((s) => ({
          folders: ids
            .map((id, i) => {
              const f = s.folders.find((x) => x.id === id)
              return f ? { ...f, sortOrder: i } : null
            })
            .filter(Boolean) as SOPFolder[],
        }))
      },

      addSOP: (sop) => {
        const id = generateId()
        const now = new Date().toISOString()
        const newSOP: SOP = {
          ...sop,
          id,
          sortOrder: get().sops.filter((s) => s.folderId === sop.folderId).length,
          lastUsedAt: null,
          createdAt: now,
          updatedAt: now,
        }
        set((s) => ({ sops: [...s.sops, newSOP] }))
        return id
      },

      updateSOP: (id, updates) => {
        set((s) => ({
          sops: s.sops.map((sop) =>
            sop.id === id ? { ...sop, ...updates, updatedAt: new Date().toISOString() } : sop
          ),
        }))
      },

      deleteSOP: (id) => {
        set((s) => ({
          sops: s.sops.filter((sop) => sop.id !== id),
          selectedSOPId: s.selectedSOPId === id ? null : s.selectedSOPId,
        }))
      },

      duplicateSOP: (id) => {
        const source = get().sops.find((s) => s.id === id)
        if (!source) return ''
        const newId = generateId()
        const now = new Date().toISOString()
        const copy: SOP = {
          ...source,
          id: newId,
          title: source.title + ' (副本)',
          isSystem: false,
          lastUsedAt: null,
          sortOrder: get().sops.filter((s) => s.folderId === source.folderId).length,
          createdAt: now,
          updatedAt: now,
        }
        set((s) => ({ sops: [...s.sops, copy] }))
        return newId
      },

      moveSOP: (sopId, targetFolderId) => {
        set((s) => ({
          sops: s.sops.map((sop) =>
            sop.id === sopId ? { ...sop, folderId: targetFolderId } : sop
          ),
        }))
      },

      reorderSOPs: (folderId, ids) => {
        set((s) => ({
          sops: s.sops.map((sop) => {
            if (sop.folderId !== folderId) return sop
            const idx = ids.indexOf(sop.id)
            return idx >= 0 ? { ...sop, sortOrder: idx } : sop
          }),
        }))
      },

      selectSOP: (id) => set({ selectedSOPId: id }),

      toggleFolderCollapsed: (id) => {
        set((s) => ({
          collapsedFolderIds: s.collapsedFolderIds.includes(id)
            ? s.collapsedFolderIds.filter((x) => x !== id)
            : [...s.collapsedFolderIds, id],
        }))
      },
    }),
    {
      name: `${getStoragePrefix()}-sops`,
      onRehydrateStorage: () => (state) => {
        if (!state) return
        if (!state.collapsedFolderIds) state.collapsedFolderIds = []
      },
    }
  )
)
