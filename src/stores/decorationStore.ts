import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface DecorationStore {
  /** areaId → 已购买的 decorationId 列表 */
  owned: Record<string, string[]>

  buy: (areaId: string, decorationId: string) => void
  isOwned: (areaId: string, decorationId: string) => boolean
  getOwned: (areaId: string) => string[]
}

export const useDecorationStore = create<DecorationStore>()(
  persist(
    (set, get) => ({
      owned: {},

      buy: (areaId, decorationId) => {
        set((s) => {
          const current = s.owned[areaId] ?? []
          if (current.includes(decorationId)) return s
          return { owned: { ...s.owned, [areaId]: [...current, decorationId] } }
        })
      },

      isOwned: (areaId, decorationId) => {
        return (get().owned[areaId] ?? []).includes(decorationId)
      },

      getOwned: (areaId) => get().owned[areaId] ?? [],
    }),
    { name: 'anvilite-decorations' }
  )
)
