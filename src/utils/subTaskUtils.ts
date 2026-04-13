import type { SubTask } from '@/types/task'
import type { SubHabit } from '@/types/habit'
import { generateId } from '@/utils/id'

// ─── SubTask helpers ────────────────────────────────────────────

export function addNestedSubTask(subs: SubTask[], parentId: string, newSub: SubTask): SubTask[] {
  return subs.map((s) => {
    if (s.id === parentId) {
      return { ...s, subTasks: [...s.subTasks, { ...newSub, sortOrder: s.subTasks.length }] }
    }
    return { ...s, subTasks: addNestedSubTask(s.subTasks, parentId, newSub) }
  })
}

export function toggleNested(subs: SubTask[], targetId: string): SubTask[] {
  return subs.map((s) => {
    if (s.id === targetId) return { ...s, completed: !s.completed }
    return { ...s, subTasks: toggleNested(s.subTasks, targetId) }
  })
}

export function removeNested(subs: SubTask[], targetId: string): SubTask[] {
  return subs
    .filter((s) => s.id !== targetId)
    .map((s) => ({ ...s, subTasks: removeNested(s.subTasks, targetId) }))
}

export function editNested(subs: SubTask[], targetId: string, title: string): SubTask[] {
  return subs.map((s) => {
    if (s.id === targetId) return { ...s, title }
    return { ...s, subTasks: editNested(s.subTasks, targetId, title) }
  })
}

export function reorderNested(
  subs: SubTask[],
  parentId: string | null,
  newOrder: string[]
): SubTask[] {
  if (parentId === null) {
    // 重排根级子任务
    const map = new Map(subs.map((s) => [s.id, s]))
    const reordered = newOrder.map((id, idx) => {
      const s = map.get(id)
      return s ? { ...s, sortOrder: idx } : null
    }).filter(Boolean) as SubTask[]
    const reorderedIds = new Set(newOrder)
    const rest = subs.filter((s) => !reorderedIds.has(s.id))
    return [...reordered, ...rest]
  }
  return subs.map((s) => {
    if (s.id === parentId) {
      const map = new Map(s.subTasks.map((c) => [c.id, c]))
      const reordered = newOrder.map((id, idx) => {
        const c = map.get(id)
        return c ? { ...c, sortOrder: idx } : null
      }).filter(Boolean) as SubTask[]
      const reorderedIds = new Set(newOrder)
      const rest = s.subTasks.filter((c) => !reorderedIds.has(c.id))
      return { ...s, subTasks: [...reordered, ...rest] }
    }
    return { ...s, subTasks: reorderNested(s.subTasks, parentId, newOrder) }
  })
}

export function makeSubTask(title: string, sortOrder: number): SubTask {
  return {
    id: generateId(),
    title,
    completed: false,
    sortOrder,
    subTasks: [],
    createdAt: new Date().toISOString(),
  }
}

/** 从旧版平铺 tasks 数组构建嵌套 subTasks（迁移用） */
export function buildSubTasksFromFlat(
  childrenMap: Map<string, Array<{ id: string; title: string; status: string; sortOrder?: number; createdAt: string }>>,
  parentId: string
): SubTask[] {
  const children = childrenMap.get(parentId) ?? []
  return children
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
    .map((child) => ({
      id: child.id,
      title: child.title,
      completed: child.status === 'done',
      sortOrder: child.sortOrder ?? 0,
      subTasks: buildSubTasksFromFlat(childrenMap, child.id),
      createdAt: child.createdAt,
    }))
}

// ─── SubHabit helpers ───────────────────────────────────────────

export function addNestedSubHabit(subs: SubHabit[], parentId: string, newSub: SubHabit): SubHabit[] {
  return subs.map((s) => {
    if (s.id === parentId) {
      return { ...s, subHabits: [...s.subHabits, { ...newSub, sortOrder: s.subHabits.length }] }
    }
    return { ...s, subHabits: addNestedSubHabit(s.subHabits, parentId, newSub) }
  })
}

export function toggleNestedHabit(subs: SubHabit[], targetId: string): SubHabit[] {
  return subs.map((s) => {
    if (s.id === targetId) return { ...s, completed: !s.completed }
    return { ...s, subHabits: toggleNestedHabit(s.subHabits, targetId) }
  })
}

export function removeNestedHabit(subs: SubHabit[], targetId: string): SubHabit[] {
  return subs
    .filter((s) => s.id !== targetId)
    .map((s) => ({ ...s, subHabits: removeNestedHabit(s.subHabits, targetId) }))
}

export function editNestedHabit(subs: SubHabit[], targetId: string, title: string): SubHabit[] {
  return subs.map((s) => {
    if (s.id === targetId) return { ...s, title }
    return { ...s, subHabits: editNestedHabit(s.subHabits, targetId, title) }
  })
}

export function makeSubHabit(title: string, sortOrder: number): SubHabit {
  return {
    id: generateId(),
    title,
    completed: false,
    sortOrder,
    subHabits: [],
    createdAt: new Date().toISOString(),
  }
}
