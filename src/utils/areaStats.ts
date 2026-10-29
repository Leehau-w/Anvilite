import type { Task } from '@/types/task'
import { getTaskActivity } from './activityStats'

export function getAreaActivityStats(tasks: readonly Task[], category?: string) {
  const stats = getTaskActivity(tasks, category)
  return { completedTaskCount: stats.completedCount, totalMinutes: stats.minutes }
}

/** Compact category duration, using the same display rule as the status bar. */
export function formatAreaTime(value: number, timeValue: (hours: number, minutes: number) => string): string {
  const safeValue = Number.isFinite(value) ? Math.max(0, value) : 0
  const minutes = roundMinutes(safeValue)
  const hours = minutes > 60 ? Math.floor(minutes / 60) : 0
  return timeValue(hours, hours ? roundMinutes(minutes % 60) : minutes)
}

function roundMinutes(value: number) { return value > Number.MAX_VALUE / 10 ? value : Math.round(value * 10) / 10 }
