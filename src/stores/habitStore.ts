import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Habit } from '@/types/habit'
import { generateId } from '@/utils/id'
import { migrateCategory } from '@/utils/area'
import { isHabitDueToday, calculateNewStreak, calculateToleranceUpdate } from '@/engines/habitEngine'
import { calculateHabitXP } from '@/engines/xpEngine'

interface HabitStore {
  habits: Habit[]
  addHabit: (partial: Omit<Habit, 'id' | 'status' | 'isHidden' | 'deletedAt' | 'timerStartedAt' | 'actualMinutes' | 'consecutiveCount' | 'totalCompletions' | 'toleranceCharges' | 'toleranceNextAt' | 'lastCompletedAt' | 'lastDueAt' | 'currentCycleCount' | 'createdAt' | 'updatedAt'>) => void
  updateHabit: (id: string, patch: Partial<Habit>) => void
  deleteHabit: (id: string) => void
  restoreHabit: (id: string) => void
  permanentlyDeleteHabit: (id: string) => void
  pauseHabit: (id: string) => void
  resumeHabit: (id: string) => void
  archiveHabit: (id: string) => void
  masterHabit: (id: string) => void
  hideHabit: (id: string) => void
  unhideHabit: (id: string) => void
  startHabitTimer: (id: string) => void
  pauseHabitTimer: (id: string) => void

  completeHabit: (id: string) => { xp: number; ore: number; newStreak: number; partial: boolean } | null
  skipHabit: (id: string) => { newStreak: number } | null
  missHabit: (id: string) => { usedTolerance: boolean; newStreak: number } | null

  getTodayHabits: () => Habit[]
  getHabitsByCategory: (category: string) => Habit[]
  getTodayStats: () => { completed: number; totalXP: number }
}

function makeDefaultHabit(partial: Parameters<HabitStore['addHabit']>[0]): Habit {
  const now = new Date().toISOString()
  return {
    ...partial,
    id: generateId(),
    status: 'active',
    isHidden: false,
    deletedAt: null,
    timerStartedAt: null,
    actualMinutes: 0,
    consecutiveCount: 0,
    totalCompletions: 0,
    toleranceCharges: 0,
    toleranceNextAt: 0,
    currentCycleCount: 0,
    lastCompletedAt: null,
    lastDueAt: null,
    createdAt: now,
    updatedAt: now,
  }
}

export const useHabitStore = create<HabitStore>()(
  persist(
    (set, get) => ({
      habits: [],

      addHabit: (partial) => {
        const habit = makeDefaultHabit(partial)
        set((s) => ({ habits: [...s.habits, habit] }))
      },

      updateHabit: (id, patch) => {
        set((s) => ({
          habits: s.habits.map((h) =>
            h.id === id ? { ...h, ...patch, updatedAt: new Date().toISOString() } : h
          ),
        }))
      },

      deleteHabit: (id) => {
        get().updateHabit(id, { deletedAt: new Date().toISOString() })
      },

      restoreHabit: (id) => {
        get().updateHabit(id, { deletedAt: null })
      },

      permanentlyDeleteHabit: (id) => {
        set((s) => ({ habits: s.habits.filter((h) => h.id !== id) }))
      },

      pauseHabit: (id) => {
        get().updateHabit(id, { status: 'paused' })
      },

      resumeHabit: (id) => {
        get().updateHabit(id, { status: 'active' })
      },

      archiveHabit: (id) => {
        get().updateHabit(id, { status: 'archived' })
      },

      masterHabit: (id) => {
        get().updateHabit(id, { status: 'mastered' })
      },

      hideHabit: (id) => {
        get().updateHabit(id, { isHidden: true })
      },

      unhideHabit: (id) => {
        get().updateHabit(id, { isHidden: false })
      },

      startHabitTimer: (id) => {
        const habit = get().habits.find((h) => h.id === id)
        if (!habit || habit.timerStartedAt) return
        get().updateHabit(id, { timerStartedAt: new Date().toISOString() })
      },

      pauseHabitTimer: (id) => {
        const habit = get().habits.find((h) => h.id === id)
        if (!habit || !habit.timerStartedAt) return
        const elapsed = Math.floor((Date.now() - new Date(habit.timerStartedAt).getTime()) / 60000)
        get().updateHabit(id, {
          timerStartedAt: null,
          actualMinutes: (habit.actualMinutes ?? 0) + elapsed,
        })
      },

      completeHabit: (id) => {
        const habit = get().habits.find((h) => h.id === id)
        if (!habit || habit.isHidden || habit.status === 'archived') return null

        const targetCount = habit.targetCount ?? 1
        const newCycleCount = (habit.currentCycleCount ?? 0) + 1
        const now = new Date().toISOString()

        // 未达到目标次数：局部完成，不结算XP/连续
        if (newCycleCount < targetCount) {
          set((s) => ({
            habits: s.habits.map((h) =>
              h.id === id ? { ...h, currentCycleCount: newCycleCount, updatedAt: now } : h
            ),
          }))
          return { xp: 0, ore: 0, newStreak: habit.consecutiveCount, partial: true }
        }

        // 达到目标次数：完整结算
        const newStreak = calculateNewStreak(habit, 'complete')
        const tolerance = calculateToleranceUpdate(habit, 'complete')
        const { xp, ore } = calculateHabitXP(habit.difficulty, newStreak, habit.repeatType)

        set((s) => ({
          habits: s.habits.map((h) =>
            h.id === id
              ? {
                  ...h,
                  status: 'completed_today',
                  consecutiveCount: newStreak,
                  totalCompletions: h.totalCompletions + 1,
                  toleranceCharges: tolerance.charges,
                  toleranceNextAt: tolerance.nextAt,
                  currentCycleCount: 0,
                  lastCompletedAt: now,
                  lastDueAt: now,
                  updatedAt: now,
                }
              : h
          ),
        }))

        return { xp, ore, newStreak, partial: false }
      },

      skipHabit: (id) => {
        const habit = get().habits.find((h) => h.id === id)
        if (!habit) return null

        const newStreak = calculateNewStreak(habit, 'skip')
        const now = new Date().toISOString()

        set((s) => ({
          habits: s.habits.map((h) =>
            h.id === id
              ? {
                  ...h,
                  status: 'completed_today',
                  consecutiveCount: newStreak,
                  lastDueAt: now,
                  updatedAt: now,
                }
              : h
          ),
        }))

        return { newStreak }
      },

      missHabit: (id) => {
        const habit = get().habits.find((h) => h.id === id)
        if (!habit) return null

        const usedTolerance = habit.toleranceCharges > 0
        const tolerance = calculateToleranceUpdate(habit, 'miss')
        const newStreak = calculateNewStreak(habit, 'miss')
        const now = new Date().toISOString()

        set((s) => ({
          habits: s.habits.map((h) =>
            h.id === id
              ? {
                  ...h,
                  consecutiveCount: usedTolerance ? h.consecutiveCount : newStreak,
                  toleranceCharges: tolerance.charges,
                  toleranceNextAt: tolerance.nextAt,
                  lastDueAt: now,
                  updatedAt: now,
                }
              : h
          ),
        }))

        return { usedTolerance, newStreak: usedTolerance ? habit.consecutiveCount : newStreak }
      },

      getTodayHabits: () => {
        return get().habits.filter(
          (h) => !h.deletedAt && !h.isHidden && h.status === 'active' && isHabitDueToday(h)
        )
      },

      getHabitsByCategory: (category) => {
        return get().habits.filter(
          (h) => !h.deletedAt && !h.isHidden && h.status !== 'archived' && h.status !== 'mastered' && h.category === category
        )
      },

      getTodayStats: () => {
        const today = new Date().toISOString().split('T')[0]
        const todayDone = get().habits.filter(
          (h) => h.lastCompletedAt && h.lastCompletedAt.startsWith(today)
        )
        return {
          completed: todayDone.length,
          totalXP: todayDone.reduce((sum, h) => {
            const { xp } = calculateHabitXP(h.difficulty, h.consecutiveCount, h.repeatType)
            return sum + xp
          }, 0),
        }
      },
    }),
    {
      name: 'anvilite-habits',
      onRehydrateStorage: () => (state) => {
        if (!state) return
        state.habits = state.habits.map((h) => {
          const patched: Habit = {
            isHidden: h.isHidden ?? (h.status === 'archived'),
            deletedAt: h.deletedAt ?? null,
            timerStartedAt: h.timerStartedAt ?? null,
            actualMinutes: h.actualMinutes ?? 0,
            ...h,
            category: migrateCategory(h.category),
            // migrate archived → paused + hidden
            status: h.status === 'archived' ? 'paused' : h.status,
          }
          return patched
        })
      },
    }
  )
)
