import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { getStoragePrefix } from './accountManager'

interface UIStore {
  collapsedTaskIds: string[]
  toggleTaskCollapse: (id: string) => void
  isTaskCollapsed: (id: string) => boolean
}

export const useUIStore = create<UIStore>()(
  persist(
    (set, get) => ({
      collapsedTaskIds: [],
      toggleTaskCollapse: (id) => {
        const ids = get().collapsedTaskIds
        set({ collapsedTaskIds: ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id] })
      },
      isTaskCollapsed: (id) => get().collapsedTaskIds.includes(id),
    }),
    { name: `${getStoragePrefix()}-ui` }
  )
)
