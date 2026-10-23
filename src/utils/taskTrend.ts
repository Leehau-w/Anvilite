import type { Task } from '@/types/task'
import { formatDateKey } from './time'

export type TaskTrendMetric = 'count' | 'time'
export type TaskTrendTotal = { count: number; minutes: number }
export type TaskTrendData = {
  days: Map<string, TaskTrendTotal>
  slots: Map<string, TaskTrendTotal>
}

/** Completed task records are the source of truth, including tasks with zero XP. */
export function buildTaskTrend(tasks: readonly Task[]): TaskTrendData {
  const days = new Map<string, TaskTrendTotal>()
  const slots = new Map<string, TaskTrendTotal>()
  function add(map: Map<string, TaskTrendTotal>, key: string, minutes: number) {
    const previous = map.get(key) ?? { count: 0, minutes: 0 }
    map.set(key, { count: previous.count + 1, minutes: Math.min(Number.MAX_VALUE, previous.minutes + minutes) })
  }
  for (const task of tasks) {
    if (task.status !== 'done' || task.deletedAt || typeof task.completedAt !== 'string') continue
    const completed = new Date(task.completedAt)
    if (!Number.isFinite(completed.getTime())) continue
    const date = formatDateKey(completed)
    const slot = Math.floor(completed.getHours() / 6)
    const minutes = typeof task.actualMinutes === 'number' && Number.isFinite(task.actualMinutes)
      ? Math.max(0, task.actualMinutes) : 0
    add(days, date, minutes)
    add(slots, date + '-' + slot, minutes)
  }
  return { days, slots }
}

export function getTaskTrendMonthDates(today: Date): string[] {
  if (!Number.isFinite(today.getTime())) return []
  return Array.from({ length: new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate() },
    (_, index) => formatDateKey(new Date(today.getFullYear(), today.getMonth(), index + 1)))
}

export function getTaskTrendWeekDates(today: Date): string[] {
  if (!Number.isFinite(today.getTime())) return []
  const monday = new Date(today)
  monday.setDate(today.getDate() - (today.getDay() + 6) % 7)
  return Array.from({ length: 7 }, (_, index) => {
    const day = new Date(monday)
    day.setDate(monday.getDate() + index)
    return formatDateKey(day)
  })
}

export function getTaskTrendValue(total: TaskTrendTotal | undefined, metric: TaskTrendMetric): number {
  return metric === 'count' ? total?.count ?? 0 : total?.minutes ?? 0
}

/** Scale only against the cells being displayed, never historical totals. */
export function getTaskTrendMax(keys: readonly string[], map: ReadonlyMap<string, TaskTrendTotal>, metric: TaskTrendMetric): number {
  return keys.reduce((max, key) => Math.max(max, getTaskTrendValue(map.get(key), metric)), 0)
}

export function getTaskTrendHeatLevel(value: number, max: number): 0 | 1 | 2 | 3 | 4 {
  if (value <= 0 || max <= 0) return 0
  const ratio = value / max
  if (ratio < 0.2) return 1
  if (ratio < 0.45) return 2
  if (ratio < 0.75) return 3
  return 4
}
