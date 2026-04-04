import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Inspiration } from '@/types/inspiration'
import { getStoragePrefix } from './accountManager'
import { generateId } from '@/utils/id'

interface InspirationStore {
  inspirations: Inspiration[]
  addInspiration: (content: string) => Inspiration
  updateInspiration: (id: string, content: string) => void
  deleteInspiration: (id: string) => void
  markConverted: (id: string, taskId: string) => void
}

export const useInspirationStore = create<InspirationStore>()(
  persist(
    (set) => ({
      inspirations: [],

      addInspiration: (content) => {
        const item: Inspiration = {
          id: generateId(),
          content: content.trim(),
          createdAt: new Date().toISOString(),
        }
        set((s) => ({ inspirations: [item, ...s.inspirations] }))
        return item
      },

      updateInspiration: (id, content) => {
        set((s) => ({
          inspirations: s.inspirations.map((i) =>
            i.id === id ? { ...i, content: content.trim() } : i
          ),
        }))
      },

      deleteInspiration: (id) => {
        set((s) => ({ inspirations: s.inspirations.filter((i) => i.id !== id) }))
      },

      markConverted: (id, taskId) => {
        set((s) => ({
          inspirations: s.inspirations.map((i) =>
            i.id === id ? { ...i, convertedTaskId: taskId } : i
          ),
        }))
      },
    }),
    {
      name: `${getStoragePrefix()}-inspirations`,
    }
  )
)
