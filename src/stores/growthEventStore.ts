import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { GrowthEvent } from '@/types/growthEvent'
import { getStoragePrefix } from './accountManager'
import { generateId } from '@/utils/id'
import { isManualActivityEvent, isValidMilestoneDate } from '@/utils/activityHistory'

interface GrowthEventStore {
  events: GrowthEvent[]
  addEvent: (event: Omit<GrowthEvent, 'id' | 'timestamp'>) => void
  removeEvent: (id: string) => void
  markMilestone: (id: string, description?: string) => void
  updateEventDetails: (id: string, patch: Partial<GrowthEvent['details']>) => void
  updateMilestone: (id: string, patch: { title?: string; date: string; description: string }) => boolean
}

export const useGrowthEventStore = create<GrowthEventStore>()(
  persist(
    (set, get) => ({
      events: [],

      addEvent: (event) => {
        // Preserve imported history while preventing any new game-only activity.
        if (['level_up', 'badge_earned', 'area_level_up', 'prestige'].includes(event.type)) return
        const { xpGained: _xp, oreGained: _ore, ...details } = event.details
        if (['task_complete', 'habit_complete', 'habit_skip'].includes(event.type) && details.entityId && details.completionId &&
          get().events.some(existing => existing.type === event.type && existing.details.entityId === details.entityId &&
            existing.details.completionId === details.completionId)) return
        const newEvent: GrowthEvent = {
          ...event, details,
          id: generateId(),
          timestamp: new Date().toISOString(),
        }
        try {
          set((s) => ({ events: [newEvent, ...s.events] }))
        } catch (error) {
          // Persist writes after the in-memory update; remove only this failed receipt.
          // Unrelated records and any later edits must survive a retry.
          if (get().events.some(existing => existing.id === newEvent.id)) {
            try { set(state => ({ events: state.events.filter(existing => existing.id !== newEvent.id) })) }
            catch { /* Memory rollback still succeeds if storage remains unavailable. */ }
          }
          throw error
        }
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

      updateMilestone: (id, patch) => {
        if (!patch || !isValidMilestoneDate(patch.date) || typeof patch.description !== 'string' ||
          patch.title !== undefined && (typeof patch.title !== 'string' || !patch.title.trim())) return false
        const previous = get().events.find(event => event.id === id)
        if (!previous || !isManualActivityEvent(previous)) return false
        const changes: Partial<GrowthEvent['details']> = {
          milestoneDate: patch.date, description: patch.description.trim(),
          ...(patch.title !== undefined ? { milestoneTitle: patch.title.trim() } : {}),
        }
        const updated = { ...previous, details: { ...previous.details, ...changes } }
        try {
          set(state => ({ events: state.events.map(event => event.id === id ? updated : event) }))
        } catch (error) {
          // Zustand applies memory before persistence. Revert only this action's fields,
          // keeping unrelated events or later subscriber edits made during the failed write.
          const current = get().events.find(event => event.id === id)
          if (current) {
            const details = { ...current.details }
            for (const field of ['milestoneDate', 'description', 'milestoneTitle'] as const) {
              if (!(field in changes) || details[field] !== changes[field]) continue
              if (Object.prototype.hasOwnProperty.call(previous.details, field)) details[field] = previous.details[field]
              else delete details[field]
            }
            try { set(state => ({ events: state.events.map(event => event.id === id ? { ...event, details } : event) })) }
            catch { /* Memory rollback still succeeds if storage remains unavailable. */ }
          }
          throw error
        }
        return true
      },

      updateEventDetails: (id, patch) => {
        set((s) => ({
          events: s.events.map((e) =>
            e.id === id ? { ...e, details: { ...e.details, ...patch } } : e
          ),
        }))
      },
    }),
    { name: `${getStoragePrefix()}-growth-events` }
  )
)
