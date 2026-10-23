import type { Task } from '@/types/task'
import { formatDateKey } from './time'

export interface TaskActivityStats {
  completedCount: number
  minutes: number
  activeCount: number
  waitingCount: number
}

/** Business activity only. Hidden records count; deleted records and invalid completion dates do not. */
export function getTaskActivity(tasks: readonly Task[], category?: string, date?: string): TaskActivityStats {
  const result: TaskActivityStats = { completedCount: 0, minutes: 0, activeCount: 0, waitingCount: 0 }
  for (const task of tasks) {
    if (task.deletedAt || category !== undefined && task.category !== category) continue
    if (task.status !== 'done') {
      result.activeCount++
      if (task.status === 'waiting') result.waitingCount++
      continue
    }
    if (!task.completedAt) continue
    const completed = new Date(task.completedAt)
    if (!Number.isFinite(completed.getTime()) || date !== undefined && formatDateKey(completed) !== date) continue
    result.completedCount++
    const minutes = typeof task.actualMinutes === 'number' && Number.isFinite(task.actualMinutes) ? Math.max(0, task.actualMinutes) : 0
    result.minutes = Math.min(Number.MAX_VALUE, result.minutes + minutes)
  }
  return result
}
