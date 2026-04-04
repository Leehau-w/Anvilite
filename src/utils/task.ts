import type { Task } from '@/types/task'

const PRIORITY_ORDER = { urgent: 0, high: 1, medium: 2, low: 3 } as const

/** 在同一状态分组内按 sortOrder → 优先级 → 截止日期排序 */
export function sortTasksInGroup(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) => {
    // 有 sortOrder 且不同 → 按拖拽排序
    if (a.sortOrder !== b.sortOrder) {
      return a.sortOrder - b.sortOrder
    }
    // 优先级
    const priDiff =
      (PRIORITY_ORDER[a.priority] ?? 2) - (PRIORITY_ORDER[b.priority] ?? 2)
    if (priDiff !== 0) return priDiff
    // 截止日期（有日期的排前面）
    if (a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate)
    if (a.dueDate) return -1
    if (b.dueDate) return 1
    return 0
  })
}
