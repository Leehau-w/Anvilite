import { expect, it } from 'vitest'
import type { Task } from '@/types/task'
import { getTaskActivity } from './activityStats'
import { getAreaActivityStats } from './areaStats'

const at = new Date(2026, 9, 23, 14).toISOString()
function task(patch: Partial<Task> = {}): Task {
  return { id: 't', title: 'Synthetic', category: 'home', difficulty: 1, priority: 'medium', dueDate: null,
    description: '', actualMinutes: 10, status: 'done', xpReward: 999, completedAt: at, deletedAt: null,
    isHidden: false, sortOrder: 0, timerStartedAt: null, timerAccumulated: 50000, tags: [], subTasks: [],
    createdAt: at, updatedAt: at, ...patch }
}
it('aggregates real completed parent tasks by category and includes hidden records without XP or timer estimates', () => {
  const records = [task(), task({ id: 'hidden', isHidden: true, actualMinutes: 2.5 }),
    task({ category: 'work', actualMinutes: 5 }), task({ deletedAt: at, actualMinutes: 100 }),
    task({ status: 'todo' }), task({ status: 'doing' }), task({ status: 'waiting' })]
  expect(getTaskActivity(records, 'home')).toEqual({ completedCount: 2, minutes: 12.5, activeCount: 3, waitingCount: 1 })
  expect(getAreaActivityStats(records)).toEqual({ completedTaskCount: 3, totalMinutes: 17.5 })
  expect(getAreaActivityStats(records, 'missing')).toEqual({ completedTaskCount: 0, totalMinutes: 0 })
})
it('uses local completion dates for today while retaining all open tasks', () => {
  const records = [task({ completedAt: new Date(2026, 9, 22, 23, 59).toISOString() }),
    task({ completedAt: new Date(2026, 9, 23, 0, 0).toISOString() }), task({ status: 'todo' })]
  expect(getTaskActivity(records, undefined, '2026-10-23')).toEqual({ completedCount: 1, minutes: 10, activeCount: 1, waitingCount: 0 })
})
it('ignores invalid completion dates and treats missing or invalid actual minutes as zero', () => {
  const records = [task({ completedAt: null }), task({ completedAt: 'bad-date' }),
    ...[NaN, Infinity, -12, undefined].map(actualMinutes => task({ actualMinutes }))]
  expect(getTaskActivity(records)).toEqual({ completedCount: 4, minutes: 0, activeCount: 0, waitingCount: 0 })
})
it('keeps a finite total for extreme but valid imported values', () => {
  expect(getTaskActivity([task({ actualMinutes: Number.MAX_VALUE }), task({ actualMinutes: Number.MAX_VALUE })]).minutes).toBe(Number.MAX_VALUE)
})
