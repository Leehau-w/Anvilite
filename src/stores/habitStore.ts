import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Habit, SubHabit, HabitGroup } from '@/types/habit'
import { getStoragePrefix } from './accountManager'
import { generateId } from '@/utils/id'
import { migrateCategory } from '@/utils/area'
import { isHabitDueToday, calculateNewStreak, calculateToleranceUpdate } from '@/engines/habitEngine'
import { calculateHabitXP } from '@/engines/xpEngine'
import { useCharacterStore } from './characterStore'
import { useGrowthEventStore } from './growthEventStore'
import {
  addNestedSubHabit,
  toggleNestedHabit,
  removeNestedHabit,
  editNestedHabit,
  makeSubHabit,
} from '@/utils/subTaskUtils'

const SUBHABIT_MIGRATION_KEY = 'anvilite-subhabit-migration-v3'

interface HabitStore {
  habits: Habit[]
  completedHabitViewMode: 'area' | 'custom'
  customHabitGroups: HabitGroup[]
  addHabit: (partial: Omit<Habit, 'id' | 'status' | 'isHidden' | 'deletedAt' | 'timerStartedAt' | 'actualMinutes' | 'consecutiveCount' | 'totalCompletions' | 'toleranceCharges' | 'toleranceNextAt' | 'weeklyCompletionCount' | 'lastCompletedAt' | 'lastDueAt' | 'currentCycleCount' | 'subHabits' | 'createdAt' | 'updatedAt'>) => void
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
  undoComplete: (id: string) => void
  skipHabit: (id: string) => { newStreak: number } | null
  missHabit: (id: string) => { usedTolerance: boolean; newStreak: number } | null

  // ── 子习惯 ──────────────────────────────────────────────────
  addSubHabit: (habitId: string, title: string, parentSubHabitId?: string) => void
  toggleSubHabit: (habitId: string, subHabitId: string) => void
  removeSubHabit: (habitId: string, subHabitId: string) => void
  editSubHabit: (habitId: string, subHabitId: string, title: string) => void

  reorderHabits: (ids: string[]) => void
  resetDailyHabits: () => void
  getTodayHabits: () => Habit[]
  getHabitsByCategory: (category: string) => Habit[]
  getTodayStats: () => { completed: number; totalXP: number }

  setCompletedHabitViewMode: (mode: 'area' | 'custom') => void
  addCustomHabitGroup: (name: string) => HabitGroup
  renameCustomHabitGroup: (id: string, name: string) => void
  deleteCustomHabitGroup: (id: string) => void
  moveHabitToGroup: (habitId: string, groupId: string) => void
  removeHabitFromGroup: (habitId: string, groupId: string) => void
}

function makeDefaultHabit(partial: Parameters<HabitStore['addHabit']>[0]): Habit {
  const now = new Date().toISOString()
  return {
    ...partial,
    id: generateId(),
    subHabits: [],
    status: 'active',
    isHidden: false,
    deletedAt: null,
    timerStartedAt: null,
    actualMinutes: 0,
    consecutiveCount: 0,
    totalCompletions: 0,
    toleranceCharges: 0,
    toleranceNextAt: 0,
    weeklyCompletionCount: 0,
    currentCycleCount: 0,
    lastCompletedAt: null,
    lastDueAt: null,
    sortOrder: Date.now(),
    createdAt: now,
    updatedAt: now,
  }
}

export const useHabitStore = create<HabitStore>()(
  persist(
    (set, get) => ({
      habits: [],
      completedHabitViewMode: 'area',
      customHabitGroups: [],

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
        const now = new Date().toISOString()
        set((s) => ({
          habits: s.habits.map((h) => h.id === id ? { ...h, deletedAt: now, updatedAt: now } : h),
        }))
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
        get().updateHabit(id, { timerStartedAt: null })
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

        // 每周弹性习惯：累计本周完成次数
        let newWeeklyCount = habit.weeklyCompletionCount ?? 0
        if (habit.repeatType === 'weekly' && habit.weeklyMode === 'flexible') {
          const today = new Date()
          const dow = today.getDay() === 0 ? 7 : today.getDay()
          const monday = new Date(today)
          monday.setDate(today.getDate() - (dow - 1))
          monday.setHours(0, 0, 0, 0)
          const lastDone = habit.lastCompletedAt ? new Date(habit.lastCompletedAt) : null
          newWeeklyCount = (!lastDone || lastDone < monday) ? 1 : newWeeklyCount + 1
        }

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
                  weeklyCompletionCount: newWeeklyCount,
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

      undoComplete: (id) => {
        const habit = get().habits.find((h) => h.id === id)
        if (!habit || habit.status !== 'completed_today') return

        // Recalculate the XP that was granted to revoke it
        const xpToRevoke = calculateHabitXP(habit.difficulty, habit.consecutiveCount, habit.repeatType).xp

        set((s) => ({
          habits: s.habits.map((h) => {
            if (h.id !== id) return h
            return {
              ...h,
              status: 'active' as const,
              consecutiveCount: Math.max(0, h.consecutiveCount - 1),
              totalCompletions: Math.max(0, (h.totalCompletions ?? 0) - 1),
              currentCycleCount: (h.targetCount ?? 1) > 1
                ? Math.max(0, (h.currentCycleCount ?? 0) - 1)
                : (h.currentCycleCount ?? 0),
              updatedAt: new Date().toISOString(),
            }
          }),
        }))

        // Revoke XP (ore is kept per project rules)
        if (xpToRevoke > 0) {
          useCharacterStore.getState().revokeXP(xpToRevoke)
        }

        // Remove the most recent habit_complete growth event matching this habit's title
        const events = useGrowthEventStore.getState().events
        const matchEvent = events.find(
          (e) => e.type === 'habit_complete' && e.title.includes(habit.title)
        )
        if (matchEvent) {
          useGrowthEventStore.getState().removeEvent(matchEvent.id)
        }
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

      // ── 子习惯 actions ──────────────────────────────────────────

      addSubHabit: (habitId, title, parentSubHabitId) => {
        set((s) => ({
          habits: s.habits.map((h) => {
            if (h.id !== habitId) return h
            const newSub: SubHabit = makeSubHabit(title, h.subHabits.length)
            if (!parentSubHabitId) {
              return { ...h, subHabits: [...h.subHabits, newSub], updatedAt: new Date().toISOString() }
            }
            return {
              ...h,
              subHabits: addNestedSubHabit(h.subHabits, parentSubHabitId, newSub),
              updatedAt: new Date().toISOString(),
            }
          }),
        }))
      },

      toggleSubHabit: (habitId, subHabitId) => {
        set((s) => ({
          habits: s.habits.map((h) => {
            if (h.id !== habitId) return h
            return { ...h, subHabits: toggleNestedHabit(h.subHabits, subHabitId), updatedAt: new Date().toISOString() }
          }),
        }))
      },

      removeSubHabit: (habitId, subHabitId) => {
        set((s) => ({
          habits: s.habits.map((h) => {
            if (h.id !== habitId) return h
            return { ...h, subHabits: removeNestedHabit(h.subHabits, subHabitId), updatedAt: new Date().toISOString() }
          }),
        }))
      },

      editSubHabit: (habitId, subHabitId, title) => {
        set((s) => ({
          habits: s.habits.map((h) => {
            if (h.id !== habitId) return h
            return { ...h, subHabits: editNestedHabit(h.subHabits, subHabitId, title), updatedAt: new Date().toISOString() }
          }),
        }))
      },

      setCompletedHabitViewMode: (mode) => {
        set({ completedHabitViewMode: mode })
      },

      addCustomHabitGroup: (name) => {
        const group: HabitGroup = {
          id: generateId(),
          name,
          type: 'custom',
          habitIds: [],
          createdAt: new Date().toISOString(),
        }
        set((s) => ({ customHabitGroups: [...s.customHabitGroups, group] }))
        return group
      },

      renameCustomHabitGroup: (id, name) => {
        set((s) => ({
          customHabitGroups: s.customHabitGroups.map((g) =>
            g.id === id ? { ...g, name } : g
          ),
        }))
      },

      deleteCustomHabitGroup: (id) => {
        set((s) => ({ customHabitGroups: s.customHabitGroups.filter((g) => g.id !== id) }))
      },

      moveHabitToGroup: (habitId, groupId) => {
        set((s) => ({
          customHabitGroups: s.customHabitGroups.map((g) => {
            if (g.id === groupId) {
              return { ...g, habitIds: g.habitIds.includes(habitId) ? g.habitIds : [...g.habitIds, habitId] }
            }
            return { ...g, habitIds: g.habitIds.filter((id) => id !== habitId) }
          }),
        }))
      },

      removeHabitFromGroup: (habitId, groupId) => {
        set((s) => ({
          customHabitGroups: s.customHabitGroups.map((g) =>
            g.id === groupId ? { ...g, habitIds: g.habitIds.filter((id) => id !== habitId) } : g
          ),
        }))
      },

      reorderHabits: (ids) => {
        set((s) => {
          const reorderedIds = new Set(ids)
          const reordered = ids.map((id, idx) => {
            const h = s.habits.find((h) => h.id === id)
            return h ? { ...h, sortOrder: idx } : null
          }).filter(Boolean) as Habit[]
          const rest = s.habits.filter((h) => !reorderedIds.has(h.id))
          return { habits: [...reordered, ...rest] }
        })
      },

      resetDailyHabits: () => {
        const now = new Date()
        const today = now.toISOString().split('T')[0]
        const dow = now.getDay() === 0 ? 7 : now.getDay()
        const monday = new Date(now)
        monday.setDate(now.getDate() - (dow - 1))
        monday.setHours(0, 0, 0, 0)

        set((s) => ({
          habits: s.habits.map((h) => {
            const staleCompleted =
              h.status === 'completed_today' &&
              (!h.lastCompletedAt || !h.lastCompletedAt.startsWith(today))
            const weeklyCount = h.weeklyCompletionCount ?? 0
            const weeklyStale =
              weeklyCount > 0 &&
              (!h.lastCompletedAt || new Date(h.lastCompletedAt) < monday)
            if (!staleCompleted && !weeklyStale) return h
            return {
              ...h,
              status: staleCompleted ? ('active' as const) : h.status,
              weeklyCompletionCount: weeklyStale ? 0 : weeklyCount,
              updatedAt: new Date().toISOString(),
            }
          }),
        }))
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
      name: `${getStoragePrefix()}-habits`,
      onRehydrateStorage: () => (state) => {
        if (!state) return
        const now = new Date()
        const today = now.toISOString().split('T')[0]
        const dow = now.getDay() === 0 ? 7 : now.getDay()
        const monday = new Date(now)
        monday.setDate(now.getDate() - (dow - 1))
        monday.setHours(0, 0, 0, 0)

        // ── v0.3 迁移：移除 parentId/childIds/nestingLevel，过滤掉旧子习惯 ──
        if (!localStorage.getItem(SUBHABIT_MIGRATION_KEY)) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          state.habits = (state.habits as any[]).filter((h) => !h.parentId)
          localStorage.setItem(SUBHABIT_MIGRATION_KEY, new Date().toISOString())
        }

        state.habits = state.habits.map((h) => {
          const staleCompleted =
            h.status === 'completed_today' &&
            (!h.lastCompletedAt || !h.lastCompletedAt.startsWith(today))
          const weeklyCount = h.weeklyCompletionCount ?? 0
          const weeklyStale = weeklyCount > 0 &&
            (!h.lastCompletedAt || new Date(h.lastCompletedAt) < monday)
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const legacy = h as any
          const patched: Habit = {
            sortOrder: h.sortOrder ?? Date.now(),
            isHidden: h.isHidden ?? (h.status === 'archived'),
            deletedAt: h.deletedAt ?? null,
            timerStartedAt: h.timerStartedAt ?? null,
            actualMinutes: h.actualMinutes ?? 0,
            weeklyCompletionCount: 0,
            ...h,
            subHabits: h.subHabits ?? [],
            category: migrateCategory(h.category),
            status: legacy.status === 'archived' ? 'paused' : staleCompleted ? 'active' : h.status,
            weeklyCompletionCount: weeklyStale ? 0 : weeklyCount,
          }
          // 清理旧字段
          delete (patched as any).parentId
          delete (patched as any).childIds
          delete (patched as any).nestingLevel
          return patched
        })

        if (!state.completedHabitViewMode) state.completedHabitViewMode = 'area'
        if (!state.customHabitGroups) state.customHabitGroups = []
      },
    }
  )
)
