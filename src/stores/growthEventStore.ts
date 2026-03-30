import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { GrowthEvent } from '@/types/growthEvent'
import { generateId } from '@/utils/id'

interface GrowthEventStore {
  events: GrowthEvent[]
  addEvent: (event: Omit<GrowthEvent, 'id' | 'timestamp'>) => void
  removeEvent: (id: string) => void
  markMilestone: (id: string, description?: string) => void
}

export const useGrowthEventStore = create<GrowthEventStore>()(
  persist(
    (set) => ({
      events: [],

      addEvent: (event) => {
        const newEvent: GrowthEvent = {
          ...event,
          id: generateId(),
          timestamp: new Date().toISOString(),
        }
        set((s) => ({ events: [newEvent, ...s.events] }))
      },

      removeEvent: (id) => {
        set((s) => ({ events: s.events.filter((e) => e.id !== id) }))
      },

      markMilestone: (id, description) => {
        set((s) => ({
          events: s.events.map((e) =>
            e.id === id
              ? {
                  ...e,
                  isMilestone: true,
                  details: { ...e.details, description: description ?? e.details.description },
                }
              : e
          ),
        }))
      },
    }),
    { name: 'anvilite-growth-events' }
  )
)
