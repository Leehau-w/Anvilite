import type { Habit } from '@/types/habit'
import { formatDateKey } from './time'
import { setSubHabitsCompleted } from './subTaskUtils'
import { calculateNewStreak, calculateToleranceUpdate } from '@/engines/habitEngine'

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

/** Only dates strictly before today are eligible for a missed occurrence. */
export function closedHabitDate(now = new Date()): string {
  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  return formatDateKey(yesterday)
}

function localDay(value: string) {
  return calendarDay(new Date(value.length === 10 ? `${value}T00:00:00` : value))
}

function monthEnd(day: number) {
  const date = new Date(day * 86400000)
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0) / 86400000
}

function countMissedPeriods(habit: Habit, from: number, to: number, limit: number): number {
  const actionDay = habit.lastDueAt ? localDay(habit.lastDueAt) : null
  let misses = 0
  if (habit.repeatType === 'monthly' || (habit.repeatType === 'weekly' && habit.weeklyMode === 'flexible')) {
    const monthly = habit.repeatType === 'monthly'
    let end = monthly ? monthEnd(from) : from + (7 - (new Date(from * 86400000).getUTCDay() || 7))
    // At most one previously satisfied period plus enough misses to exhaust the streak.
    for (let step = 0; end <= to && misses < limit && step < limit + 2; step++) {
      const periodDate = new Date(end * 86400000)
      const start = monthly ? Date.UTC(periodDate.getUTCFullYear(), periodDate.getUTCMonth(), 1) / 86400000 : end - 6
      const actionInPeriod = actionDay !== null && actionDay >= start && actionDay <= end
      const doneDay = habit.lastCompletedAt ? localDay(habit.lastCompletedAt) : null
      const metWeeklyGoal = doneDay !== null && doneDay >= start && doneDay <= end &&
        habit.weeklyCompletionCount >= (habit.weeklyFlexibleCount ?? 1)
      // Only the latest action survives in existing records. A partially active
      // flexible week may also contain skips; do not invent an extra penalty.
      const satisfied = monthly ? actionInPeriod : metWeeklyGoal || actionInPeriod
      if (!satisfied) misses++
      end = monthly ? monthEnd(end + 1) : end + 7
    }
    return misses
  }
  if (habit.repeatType === 'custom' || habit.repeatType === 'biweekly') {
    const interval = habit.repeatType === 'biweekly' ? 14 : Math.max(1, habit.customIntervalDays ?? 1)
    const anchor = actionDay ?? localDay(habit.startDate)
    // A due period stays open for its full interval; partial progress is not a miss.
    let end = anchor + interval - 1 + Math.max(0, Math.ceil((from - (anchor + interval - 1)) / interval)) * interval
    for (let step = 0; end <= to && misses < limit && step < limit + 2; step++, end += interval) {
      if (actionDay === null || actionDay < end - interval + 1 || actionDay > end) misses++
    }
    return misses
  }
  if (habit.repeatType === 'weekly' && !habit.weeklyDays?.length) return 0
  if (habit.repeatType === 'monthly_fixed' && !habit.monthlyDays?.length) return 0
  // Daily/weekday/strict-week/month-date schedules have at least one occurrence
  // every 31 days. This bound avoids iterating an arbitrarily long offline gap.
  for (let day = from, step = 0; day <= to && misses < limit && step < (limit + 2) * 32; day++, step++) {
    const date = new Date(day * 86400000)
    const dow = date.getUTCDay() || 7
    const due = habit.repeatType === 'daily' ||
      (habit.repeatType === 'weekdays' && dow <= 5) ||
      (habit.repeatType === 'weekly' && !!habit.weeklyDays?.includes(dow)) ||
      (habit.repeatType === 'monthly_fixed' && !!habit.monthlyDays?.some(d =>
        date.getUTCDate() === (d === -1 ? new Date(monthEnd(day) * 86400000).getUTCDate() :
          Math.min(d, new Date(monthEnd(day) * 86400000).getUTCDate()))))
    if (due && day !== actionDay) misses++
  }
  return misses
}

function settleMissedPeriods(habit: Habit, now: Date): Habit {
  const closed = closedHabitDate(now)
  // Never infer old attendance history, and never move the watermark backwards.
  if (!habit.lastMissCheckDate) return { ...habit, lastMissCheckDate: closed }
  if (habit.lastMissCheckDate >= closed) return habit
  let settled = { ...habit, lastMissCheckDate: closed }
  if (habit.deletedAt || habit.isHidden || !['active', 'completed_today'].includes(habit.status)) return settled
  const from = Math.max(localDay(habit.lastMissCheckDate) + 1, localDay(habit.startDate), localDay(habit.createdAt))
  const to = Math.min(localDay(closed), habit.endDate ? localDay(habit.endDate) : Infinity)
  if (!Number.isFinite(from) || from > to) return settled
  // Halving reaches zero in a bounded number of steps, even for a very long gap.
  const limit = Math.ceil(Math.log2(Math.max(1, habit.consecutiveCount))) + (habit.toleranceCharges > 0 ? 1 : 0) + 1
  const misses = countMissedPeriods(habit, from, to, limit)
  for (let i = 0; i < misses; i++) {
    const streak = calculateNewStreak(settled, 'miss')
    const tolerance = calculateToleranceUpdate(settled, 'miss')
    settled = { ...settled, consecutiveCount: streak, toleranceCharges: tolerance.charges, toleranceNextAt: tolerance.nextAt }
  }
  return settled
}

export function refreshHabitCycle(habit: Habit, now = new Date()): Habit {
  habit = settleMissedPeriods(habit, now)
  // A backwards clock must not reopen a future completion or discard its undo receipt.
  if (habit.lastMissCheckDate && habit.lastMissCheckDate > closedHabitDate(now)) return habit
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
