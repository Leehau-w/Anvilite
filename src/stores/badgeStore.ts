import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface BadgeStore {
  /** 已获得的徽章 ID → 获得时间（ISO） */
  earnedIds: Record<string, string>
  /** 待显示通知的徽章 ID 队列（先进先出） */
  notifyQueue: string[]

  earn: (ids: string[]) => void
  dismissNotify: (id: string) => void
  isEarned: (id: string) => boolean
  earnedCount: () => number
}

export const useBadgeStore = create<BadgeStore>()(
  persist(
    (set, get) => ({
      earnedIds: {},
      notifyQueue: [],

      earn: (ids) => {
        if (ids.length === 0) return
        const now = new Date().toISOString()
        set((s) => {
          const updated = { ...s.earnedIds }
          for (const id of ids) {
            if (!updated[id]) updated[id] = now
          }
          // 只将真正新获得的加入队列
          const newIds = ids.filter((id) => !s.earnedIds[id])
          return {
            earnedIds: updated,
            notifyQueue: [...s.notifyQueue, ...newIds],
          }
        })
      },

      dismissNotify: (id) => {
        set((s) => ({ notifyQueue: s.notifyQueue.filter((i) => i !== id) }))
      },

      isEarned: (id) => !!get().earnedIds[id],

      earnedCount: () => Object.keys(get().earnedIds).length,
    }),
    { name: 'anvilite-badges' }
  )
)
