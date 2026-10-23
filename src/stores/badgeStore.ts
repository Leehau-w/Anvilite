import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { getStoragePrefix } from './accountManager'

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
    (_set, get) => ({
      earnedIds: {},
      notifyQueue: [],

      // Historical badges remain exportable; earning and notification queues are inactive.
      earn: () => {},
      dismissNotify: () => {},

      isEarned: (id) => !!get().earnedIds[id],

      earnedCount: () => Object.keys(get().earnedIds).length,
    }),
    { name: `${getStoragePrefix()}-badges` }
  )
)
