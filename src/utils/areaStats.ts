import type { Task } from '@/types/task'
import { getTaskActivity } from './activityStats'

export function getAreaActivityStats(tasks: readonly Task[], category?: string) {
  const stats = getTaskActivity(tasks, category)
  return { completedTaskCount: stats.completedCount, totalMinutes: stats.minutes }
}
