import type { Habit } from '@/types/habit'
import { formatDateKey } from './time'
import { setSubHabitsCompleted } from './subTaskUtils'

function calendarDay(date: Date) {
  return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86400000
}

export function habitCycleKey(habit: Habit, date = new Date()): string {
  if (habit.repeatType === 'monthly') return `${date.getFullYear()}-${date.getMonth()}`
  if (habit.repeatType === 'custom' || habit.repeatType === 'biweekly') {
    const interval = habit.repeatType === 'biweekly' ? 14 : Math.max(1, habit.customIntervalDays ?? 1)
    const anchor = habit.lastDueAt ? new Date(habit.lastDueAt) : new Date(`${habit.startDate}T00:00:00`)
    return `${formatDateKey(anchor)}:${Math.floor((calendarDay(date) - calendarDay(anchor)) / interval)}`
  }
  return formatDateKey(date)
}

export function refreshHabitCycle(habit: Habit, now = new Date()): Habit {
  const key = habitCycleKey(habit, now)
  const previous = habit.cycleKey ?? habitCycleKey(habit, new Date(habit.lastAction?.at ?? habit.lastDueAt ?? habit.updatedAt))
  const yesterdayAction = habit.status === 'completed_today' &&
    formatDateKey(new Date(habit.lastAction?.at ?? habit.lastDueAt ?? habit.updatedAt)) !== formatDateKey(now)
  const newCycle = previous !== key
  const monday = new Date(now)
  monday.setDate(now.getDate() - (now.getDay() || 7) + 1)
  monday.setHours(0, 0, 0, 0)
  const weeklyExpired = (habit.weeklyCompletionCount ?? 0) > 0 &&
    (!habit.lastCompletedAt || new Date(habit.lastCompletedAt) < monday)
  return {
    ...habit,
    cycleKey: key,
    status: yesterdayAction ? 'active' : habit.status,
    weeklyCompletionCount: weeklyExpired ? 0 : habit.weeklyCompletionCount,
    ...(newCycle ? {
      currentCycleCount: 0,
      subHabits: setSubHabitsCompleted(habit.subHabits, false),
      actualMinutes: 0,
      timerStartedAt: null,
      timerAccumulated: 0,
      lastAction: null,
    } : {}),
  }
}
