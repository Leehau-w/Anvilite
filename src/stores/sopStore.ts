import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { SOP, SOPFolder, SOPStep } from '@/types/sop'
import type { JSONContent } from '@tiptap/react'
import { getStoragePrefix } from './accountManager'
import { generateId } from '@/utils/id'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function migrateStepContent(step: any): SOPStep {
  if ('content' in step && !('note' in step)) return step

  const blocks: JSONContent[] = []

  if (step.warning) {
    blocks.push({
      type: 'callout',
      attrs: { variant: 'warning' },
      content: [{ type: 'paragraph', content: [{ type: 'text', text: step.warning }] }],
    })
  }

  if (step.note) {
    blocks.push({
      type: 'callout',
      attrs: { variant: 'info' },
      content: [{ type: 'paragraph', content: [{ type: 'text', text: step.note }] }],
    })
  }

  const { note: _n, warning: _w, ...rest } = step
  return {
    ...rest,
    content: blocks.length > 0 ? { type: 'doc', content: blocks } : null,
    childSteps: (step.childSteps ?? []).map(migrateStepContent),
  }
}

interface SOPState {
  folders: SOPFolder[]
  sops: SOP[]
  selectedSOPId: string | null
  collapsedFolderIds: string[]

  // 文件夹 CRUD
  addFolder: (name: string, parentId?: string) => string
  renameFolder: (id: string, name: string) => void
  deleteFolder: (id: string) => void
  deleteFolderRecursive: (id: string) => void
  moveFolder: (folderId: string, targetParentId: string | null) => void
  getFolderDepth: (folderId: string) => number
  reorderFolders: (ids: string[]) => void

  // SOP CRUD
  addSOP: (sop: Omit<SOP, 'id' | 'createdAt' | 'updatedAt' | 'lastUsedAt' | 'sortOrder'>) => string
  updateSOP: (id: string, updates: Partial<SOP>) => void
  deleteSOP: (id: string) => void
  duplicateSOP: (id: string) => string
  moveSOP: (sopId: string, targetFolderId: string) => void
  setDisplayStyle: (sopId: string, style: SOP['displayStyle']) => void
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

      addFolder: (name, parentId) => {
        const id = generateId()
        const folder: SOPFolder = {
          id,
          name,
          parentId: parentId ?? null,
          sortOrder: get().folders.length,
          isSystem: false,
          createdAt: new Date().toISOString(),
        }
        set((s) => ({ folders: [...s.folders, folder] }))
        return id
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

      deleteFolderRecursive: (folderId) => {
        const allFolderIds = new Set<string>()
        function collectChildren(id: string) {
          allFolderIds.add(id)
          get().folders.filter((f) => f.parentId === id).forEach((f) => collectChildren(f.id))
        }
        collectChildren(folderId)
        set((s) => ({
          folders: s.folders.filter((f) => !allFolderIds.has(f.id)),
          sops: s.sops.filter((sop) => !allFolderIds.has(sop.folderId)),
        }))
      },

      moveFolder: (folderId, targetParentId) => {
        set((s) => ({
          folders: s.folders.map((f) =>
            f.id === folderId ? { ...f, parentId: targetParentId } : f
          ),
        }))
      },

      getFolderDepth: (folderId) => {
        let depth = 0
        let current = get().folders.find((f) => f.id === folderId)
        while (current?.parentId) {
          depth++
          current = get().folders.find((f) => f.id === current!.parentId)
        }
        return depth
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

      setDisplayStyle: (sopId, style) => {
        set((s) => ({
          sops: s.sops.map((sop) =>
            sop.id === sopId ? { ...sop, displayStyle: style, updatedAt: new Date().toISOString() } : sop
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

        // v0.3.1 migration: type → displayStyle, note/warning → content, folder.parentId
        const SOP_MIGRATION_V031 = 'anvilite-migration-sop-v031'
        if (!localStorage.getItem(SOP_MIGRATION_V031)) {
          // 1. type → displayStyle
          state.sops = state.sops.map((sop) => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const legacy = sop as any
            const oldType = legacy.type
            const displayStyle: SOP['displayStyle'] =
              oldType === 'schedule' ? 'timeline'
              : oldType === 'itemlist' ? 'bullet'
              : 'numbered'
            const { type: _, ...rest } = legacy
            return { ...rest, displayStyle }
          })

          // 2. step.note/warning → step.content (Tiptap JSON)
          state.sops = state.sops.map((sop) => ({
            ...sop,
            steps: sop.steps.map((s) => migrateStepContent(s)),
          }))

          // 3. folder.parentId 默认 null
          state.folders = state.folders.map((f) => ({
            ...f,
            parentId: (f as any).parentId ?? null, // eslint-disable-line @typescript-eslint/no-explicit-any
          }))

          localStorage.setItem(SOP_MIGRATION_V031, new Date().toISOString())
        }

        // 兼容兜底
        state.sops = state.sops.map((sop) => ({
          ...sop,
          displayStyle: sop.displayStyle ?? 'numbered',
        }))
        state.folders = state.folders.map((f) => ({
          ...f,
          parentId: f.parentId ?? null,
        }))
      },
    }
  )
)
