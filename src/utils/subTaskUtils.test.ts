import { describe, expect, it } from 'vitest'
import type { SubTask } from '@/types/task'
import { setSubTasksCompleted, toggleNested } from './subTaskUtils'

function sub(id: string, completed = false, subTasks: SubTask[] = []): SubTask {
  return {
    id,
    title: id,
    completed,
    sortOrder: 0,
    subTasks,
    createdAt: '2026-01-01T00:00:00.000Z',
  }
}

describe('nested subtasks completion', () => {
  it('marks every descendant complete when completing a parent task', () => {
    const result = setSubTasksCompleted([
      sub('a', false, [sub('a-1'), sub('a-2', false, [sub('a-2-1')])]),
    ], true)

    expect(result[0].completed).toBe(true)
    expect(result[0].subTasks[0].completed).toBe(true)
    expect(result[0].subTasks[1].completed).toBe(true)
    expect(result[0].subTasks[1].subTasks[0].completed).toBe(true)
  })

  it('toggles a parent subtask and all of its children together', () => {
    const result = toggleNested([
      sub('root', false, [sub('child'), sub('child-2')]),
    ], 'root')

    expect(result[0].completed).toBe(true)
    expect(result[0].subTasks.every((child) => child.completed)).toBe(true)
  })
})
