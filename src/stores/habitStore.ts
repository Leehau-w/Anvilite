import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Habit } from '@/types/habit'
import { getStoragePrefix } from './accountManager'
import { generateId } from '@/utils/id'
import { migrateCategory } from '@/utils/area'
import { isHabitDueToday, calculateNewStreak, calculateToleranceUpdate } from '@/engines/habitEngine'
import { calculateHabitXP } from '@/engines/xpEngine'

interface HabitStore {
  habits: Habit[]
  addHabit: (partial: Omit<Habit, 'id' | 'status' | 'isHidden' | 'deletedAt' | 'timerStartedAt' | 'actualMinutes' | 'consecutiveCount' | 'totalCompletions' | 'toleranceCharges' | 'toleranceNextAt' | 'weeklyCompletionCount' | 'lastCompletedAt' | 'lastDueAt' | 'currentCycleCount' | 'parentId' | 'childIds' | 'nestingLevel' | 'createdAt' | 'updatedAt'> & { parentId?: string | null }) => void
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

/** 收集习惯及其所有子孙 ID */
function collectHabitDescendants(habits: Habit[], rootId: string): Set<string> {
  const ids = new Set<string>([rootId])
  const queue = [rootId]
  while (queue.length > 0) {
    const pid = queue.shift()!
    const parent = habits.find((h) => h.id === pid)
    if (!parent) continue
    for (const cid of parent.childIds) {
      if (!ids.has(cid)) { ids.add(cid); queue.push(cid) }
    }
  }
  return ids
}

function makeDefaultHabit(partial: Parameters<HabitStore['addHabit']>[0]): Habit {
  const now = new Date().toISOString()
  return {
    ...partial,
    id: generateId(),
    parentId: partial.parentId ?? null,
    childIds: [],
    nestingLevel: 0,
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
        if (habit.parentId) {
          const parent = get().habits.find((h) => h.id === habit.parentId)
          if (!parent || parent.nestingLevel >= 2) return // 超过 3 层
          habit.nestingLevel = parent.nestingLevel + 1
          if (!partial.category) habit.category = parent.category
          set((s) => ({
            habits: [habit, ...s.habits.map((h) =>
              h.id === habit.parentId ? { ...h, childIds: [...h.childIds, habit.id], updatedAt: new Date().toISOString() } : h
            )],
          }))
          return
        }
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
        const ids = collectHabitDescendants(get().habits, id)
        set((s) => ({
          habits: s.habits.map((h) => ids.has(h.id) ? { ...h, deletedAt: now, updatedAt: now } : h),
        }))
      },

      restoreHabit: (id) => {
        get().updateHabit(id, { deletedAt: null })
      },

      permanentlyDeleteHabit: (id) => {
        const ids = collectHabitDescendants(get().habits, id)
        set((s) => ({ habits: s.habits.filter((h) => !ids.has(h.id)) }))
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
          (h) => !h.deletedAt && !h.isHidden && !h.parentId && h.status === 'active' && isHabitDueToday(h)
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
        // 本周一 00:00
        const dow = now.getDay() === 0 ? 7 : now.getDay()
        const monday = new Date(now)
        monday.setDate(now.getDate() - (dow - 1))
        monday.setHours(0, 0, 0, 0)

        state.habits = state.habits.map((h) => {
          // completed_today → active if completed on a previous day
          const staleCompleted =
            h.status === 'completed_today' &&
            (!h.lastCompletedAt || !h.lastCompletedAt.startsWith(today))
          // 跨周重置 weeklyCompletionCount
          const weeklyCount = h.weeklyCompletionCount ?? 0
          const weeklyStale = weeklyCount > 0 &&
            (!h.lastCompletedAt || new Date(h.lastCompletedAt) < monday)
          const patched: Habit = {
            isHidden: h.isHidden ?? (h.status === 'archived'),
            deletedAt: h.deletedAt ?? null,
            timerStartedAt: h.timerStartedAt ?? null,
            actualMinutes: h.actualMinutes ?? 0,
            weeklyCompletionCount: 0,
            parentId: null,
            childIds: [],
            nestingLevel: 0,
            ...h,
            category: migrateCategory(h.category),
            // migrate archived → paused + hidden; reset stale completed_today → active
            status: h.status === 'archived' ? 'paused' : staleCompleted ? 'active' : h.status,
            weeklyCompletionCount: weeklyStale ? 0 : weeklyCount,
          }
          return patched
        })
      },
    }
  )
)
