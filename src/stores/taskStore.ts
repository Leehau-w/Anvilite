import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Task } from '@/types/task'
import { generateId } from '@/utils/id'
import { getTomorrowString } from '@/utils/time'

interface TaskStore {
  tasks: Task[]
  lastCategory: string

  addTask: (partial: Partial<Task> & { title: string }) => Task
  updateTask: (id: string, patch: Partial<Task>) => void
  deleteTask: (id: string) => void  // soft delete
  restoreTask: (id: string) => void
  permanentlyDeleteTask: (id: string) => void

  hideTask: (id: string) => void  // 隐藏已完成任务

  completeTask: (id: string) => Task | null
  undoComplete: (id: string) => void

  startTask: (id: string) => void
  pauseTask: (id: string) => void

  reorderTasks: (ids: string[]) => void

  getTasksByCategory: (category?: string) => Task[]
  getActiveTasks: () => Task[]
  getTodayStats: () => { completedCount: number; totalXP: number }
}

function makeDefaultTask(partial: Partial<Task> & { title: string }): Task {
  const now = new Date().toISOString()
  return {
    id: generateId(),
    title: partial.title,
    category: partial.category ?? '其他',
    difficulty: partial.difficulty ?? 3,
    priority: partial.priority ?? 'medium',
    dueDate: partial.dueDate !== undefined ? partial.dueDate : getTomorrowString(),
    description: partial.description ?? '',
    estimatedMinutes: partial.estimatedMinutes ?? null,
    status: 'todo',
    parentId: partial.parentId ?? null,
    childIds: partial.childIds ?? [],
    nestingLevel: partial.nestingLevel ?? 0,
    xpReward: 0, // 完成时动态计算
    actualMinutes: 0,
    timerStartedAt: null,
    completedAt: null,
    deletedAt: null,
    isHidden: false,
    sortOrder: partial.sortOrder ?? Date.now(),
    createdAt: now,
    updatedAt: now,
  }
}

export const useTaskStore = create<TaskStore>()(
  persist(
    (set, get) => ({
      tasks: [],
      lastCategory: '其他',

      addTask: (partial) => {
        const task = makeDefaultTask(partial)
        set((s) => ({
          tasks: [task, ...s.tasks],
          lastCategory: task.category,
        }))
        return task
      },

      updateTask: (id, patch) => {
        set((s) => ({
          tasks: s.tasks.map((t) =>
            t.id === id ? { ...t, ...patch, updatedAt: new Date().toISOString() } : t
          ),
        }))
      },

      deleteTask: (id) => {
        set((s) => ({
          tasks: s.tasks.map((t) =>
            t.id === id
              ? { ...t, deletedAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
              : t
          ),
        }))
      },

      restoreTask: (id) => {
        set((s) => ({
          tasks: s.tasks.map((t) =>
            t.id === id ? { ...t, deletedAt: null, updatedAt: new Date().toISOString() } : t
          ),
        }))
      },

      permanentlyDeleteTask: (id) => {
        set((s) => ({ tasks: s.tasks.filter((t) => t.id !== id) }))
      },

      hideTask: (id) => {
        set((s) => ({
          tasks: s.tasks.map((t) =>
            t.id === id ? { ...t, isHidden: true, updatedAt: new Date().toISOString() } : t
          ),
        }))
      },

      completeTask: (id) => {
        const task = get().tasks.find((t) => t.id === id)
        if (!task || task.status === 'done') return null

        const now = new Date().toISOString()
        let actualMinutes = task.actualMinutes

        // 如果正在计时，计算额外时间
        if (task.timerStartedAt) {
          const elapsed = Math.floor(
            (Date.now() - new Date(task.timerStartedAt).getTime()) / 60000
          )
          actualMinutes += elapsed
        }

        const updatedTask: Task = {
          ...task,
          status: 'done',
          completedAt: now,
          timerStartedAt: null,
          actualMinutes,
          updatedAt: now,
        }

        set((s) => ({
          tasks: s.tasks.map((t) => (t.id === id ? updatedTask : t)),
        }))

        return updatedTask
      },

      undoComplete: (id) => {
        set((s) => ({
          tasks: s.tasks.map((t) =>
            t.id === id
              ? {
                  ...t,
                  status: 'todo',
                  completedAt: null,
                  updatedAt: new Date().toISOString(),
                }
              : t
          ),
        }))
      },

      startTask: (id) => {
        set((s) => ({
          tasks: s.tasks.map((t) =>
            t.id === id
              ? {
                  ...t,
                  status: 'doing',
                  timerStartedAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString(),
                }
              : t
          ),
        }))
      },

      pauseTask: (id) => {
        const task = get().tasks.find((t) => t.id === id)
        if (!task || !task.timerStartedAt) return

        const elapsed = Math.floor(
          (Date.now() - new Date(task.timerStartedAt).getTime()) / 60000
        )

        set((s) => ({
          tasks: s.tasks.map((t) =>
            t.id === id
              ? {
                  ...t,
                  status: 'todo',
                  timerStartedAt: null,
                  actualMinutes: t.actualMinutes + elapsed,
                  updatedAt: new Date().toISOString(),
                }
              : t
          ),
        }))
      },

      reorderTasks: (ids) => {
        set((s) => {
          const taskMap = new Map(s.tasks.map((t) => [t.id, t]))
          const reordered = ids.map((id, idx) => {
            const t = taskMap.get(id)
            return t ? { ...t, sortOrder: idx } : null
          }).filter(Boolean) as Task[]

          const reorderedIds = new Set(ids)
          const rest = s.tasks.filter((t) => !reorderedIds.has(t.id))
          return { tasks: [...reordered, ...rest] }
        })
      },

      getTasksByCategory: (category) => {
        const { tasks } = get()
        return tasks.filter((t) => {
          if (t.deletedAt) return false
          if (category && category !== '全部') return t.category === category
          return true
        })
      },

      getActiveTasks: () => {
        return get().tasks.filter((t) => !t.deletedAt && t.status !== 'done')
      },

      getTodayStats: () => {
        const today = new Date().toISOString().split('T')[0]
        const todayDone = get().tasks.filter(
          (t) => t.completedAt && t.completedAt.startsWith(today)
        )
        return {
          completedCount: todayDone.length,
          totalXP: todayDone.reduce((sum, t) => sum + t.xpReward, 0),
        }
      },
    }),
    {
      name: 'anvilite-tasks',
      onRehydrateStorage: () => (state) => {
        if (!state) return
        state.tasks = state.tasks.map((t) =>
          t.category === '书阁高塔' ? { ...t, category: '藏书阁' } : t
        )
      },
    }
  )
)
