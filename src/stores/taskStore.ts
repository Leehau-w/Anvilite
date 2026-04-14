import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Task, SubTask, TaskGroup } from '@/types/task'
import { getStoragePrefix } from './accountManager'
import { generateId } from '@/utils/id'
import { getTomorrowString } from '@/utils/time'
import { migrateCategory } from '@/utils/area'
import {
  addNestedSubTask,
  toggleNested,
  removeNested,
  editNested,
  reorderNested,
  makeSubTask,
  buildSubTasksFromFlat,
} from '@/utils/subTaskUtils'

const SUBTASK_MIGRATION_KEY = 'anvilite-subtask-migration-v3'

interface TaskStore {
  tasks: Task[]
  lastCategory: string
  completedViewMode: 'month' | 'area' | 'custom'
  customTaskGroups: TaskGroup[]

  addTask: (partial: Partial<Task> & { title: string }) => Task
  updateTask: (id: string, patch: Partial<Task>) => void
  deleteTask: (id: string) => void
  restoreTask: (id: string) => void
  permanentlyDeleteTask: (id: string) => void

  hideTask: (id: string) => void

  completeTask: (id: string) => Task | null
  undoComplete: (id: string) => void

  startTask: (id: string) => void
  pauseTask: (id: string) => void

  // ── 子任务 ───────────────────────────────────────────────────
  addSubTask: (taskId: string, title: string, parentSubTaskId?: string) => void
  toggleSubTask: (taskId: string, subTaskId: string) => void
  removeSubTask: (taskId: string, subTaskId: string) => void
  editSubTask: (taskId: string, subTaskId: string, title: string) => void
  reorderSubTasks: (taskId: string, parentSubTaskId: string | null, newOrder: string[]) => void

  reorderTasks: (ids: string[]) => void

  setCompletedViewMode: (mode: 'month' | 'area' | 'custom') => void
  addCustomTaskGroup: (name: string) => TaskGroup
  renameCustomTaskGroup: (id: string, name: string) => void
  deleteCustomTaskGroup: (id: string) => void
  moveTaskToGroup: (taskId: string, groupId: string) => void
  removeTaskFromGroup: (taskId: string, groupId: string) => void

  getTasksByCategory: (category?: string) => Task[]
  getActiveTasks: () => Task[]
  getTodayStats: () => { completedCount: number; totalXP: number }

  createTaskFromSOP: (params: {
    title: string
    category: string
    difficulty: 1 | 2 | 3 | 4 | 5
    priority: 'urgent' | 'high' | 'medium' | 'low'
    dueDate: string | null
    steps: import('@/types/sop').SOPStep[]
  }) => string
}

function mapStepToSubTask(step: import('@/types/sop').SOPStep, index: number): SubTask {
  const now = new Date().toISOString()
  return {
    id: generateId(),
    title: step.title,
    completed: false,
    sortOrder: index,
    subTasks: step.childSteps.map((child, ci) => ({
      id: generateId(),
      title: child.title,
      completed: false,
      sortOrder: ci,
      subTasks: [],  // 第 3 层及更深层忽略
      createdAt: now,
    })),
    createdAt: now,
  }
}

function makeDefaultTask(partial: Partial<Task> & { title: string }): Task {
  const now = new Date().toISOString()
  return {
    id: partial.id ?? generateId(),
    title: partial.title,
    category: partial.category ?? 'other',
    difficulty: partial.difficulty ?? 3,
    priority: partial.priority ?? 'medium',
    dueDate: partial.dueDate !== undefined ? partial.dueDate : getTomorrowString(),
    description: partial.description ?? '',
    status: 'todo',
    xpReward: 0,
    actualMinutes: 0,
    completedAt: null,
    deletedAt: null,
    isHidden: false,
    sortOrder: partial.sortOrder ?? Date.now(),
    subTasks: partial.subTasks ?? [],
    createdAt: now,
    updatedAt: now,
  }
}

export const useTaskStore = create<TaskStore>()(
  persist(
    (set, get) => ({
      tasks: [],
      lastCategory: 'other',
      completedViewMode: 'month',
      customTaskGroups: [],

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
        const now = new Date().toISOString()
        set((s) => ({
          tasks: s.tasks.map((t) =>
            t.id === id ? { ...t, deletedAt: now, updatedAt: now } : t
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
        const updatedTask: Task = {
          ...task,
          status: 'done',
          completedAt: now,
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
              ? { ...t, status: 'todo', completedAt: null, updatedAt: new Date().toISOString() }
              : t
          ),
        }))
      },

      startTask: (id) => {
        const now = new Date().toISOString()
        set((s) => ({
          tasks: s.tasks.map((t) =>
            t.id === id ? { ...t, status: 'doing', updatedAt: now } : t
          ),
        }))
      },

      pauseTask: (id) => {
        set((s) => ({
          tasks: s.tasks.map((t) =>
            t.id === id ? { ...t, status: 'todo', updatedAt: new Date().toISOString() } : t
          ),
        }))
      },

      // ── 子任务 actions ─────────────────────────────────────────

      addSubTask: (taskId, title, parentSubTaskId) => {
        set((s) => ({
          tasks: s.tasks.map((t) => {
            if (t.id !== taskId) return t
            const newSub: SubTask = makeSubTask(title, t.subTasks.length)
            if (!parentSubTaskId) {
              return { ...t, subTasks: [...t.subTasks, newSub], updatedAt: new Date().toISOString() }
            }
            return {
              ...t,
              subTasks: addNestedSubTask(t.subTasks, parentSubTaskId, newSub),
              updatedAt: new Date().toISOString(),
            }
          }),
        }))
      },

      toggleSubTask: (taskId, subTaskId) => {
        set((s) => ({
          tasks: s.tasks.map((t) => {
            if (t.id !== taskId) return t
            return { ...t, subTasks: toggleNested(t.subTasks, subTaskId), updatedAt: new Date().toISOString() }
          }),
        }))
      },

      removeSubTask: (taskId, subTaskId) => {
        set((s) => ({
          tasks: s.tasks.map((t) => {
            if (t.id !== taskId) return t
            return { ...t, subTasks: removeNested(t.subTasks, subTaskId), updatedAt: new Date().toISOString() }
          }),
        }))
      },

      editSubTask: (taskId, subTaskId, title) => {
        set((s) => ({
          tasks: s.tasks.map((t) => {
            if (t.id !== taskId) return t
            return { ...t, subTasks: editNested(t.subTasks, subTaskId, title), updatedAt: new Date().toISOString() }
          }),
        }))
      },

      reorderSubTasks: (taskId, parentSubTaskId, newOrder) => {
        set((s) => ({
          tasks: s.tasks.map((t) => {
            if (t.id !== taskId) return t
            return {
              ...t,
              subTasks: reorderNested(t.subTasks, parentSubTaskId, newOrder),
              updatedAt: new Date().toISOString(),
            }
          }),
        }))
      },

      // ── 其余 actions ──────────────────────────────────────────

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

      setCompletedViewMode: (mode) => {
        set({ completedViewMode: mode })
      },

      addCustomTaskGroup: (name) => {
        const group: TaskGroup = {
          id: generateId(),
          name,
          type: 'custom',
          taskIds: [],
          createdAt: new Date().toISOString(),
        }
        set((s) => ({ customTaskGroups: [...s.customTaskGroups, group] }))
        return group
      },

      renameCustomTaskGroup: (id, name) => {
        set((s) => ({
          customTaskGroups: s.customTaskGroups.map((g) =>
            g.id === id ? { ...g, name } : g
          ),
        }))
      },

      deleteCustomTaskGroup: (id) => {
        set((s) => ({ customTaskGroups: s.customTaskGroups.filter((g) => g.id !== id) }))
      },

      moveTaskToGroup: (taskId, groupId) => {
        set((s) => ({
          customTaskGroups: s.customTaskGroups.map((g) => {
            if (g.id === groupId) {
              return { ...g, taskIds: g.taskIds.includes(taskId) ? g.taskIds : [...g.taskIds, taskId] }
            }
            return { ...g, taskIds: g.taskIds.filter((id) => id !== taskId) }
          }),
        }))
      },

      removeTaskFromGroup: (taskId, groupId) => {
        set((s) => ({
          customTaskGroups: s.customTaskGroups.map((g) =>
            g.id === groupId ? { ...g, taskIds: g.taskIds.filter((id) => id !== taskId) } : g
          ),
        }))
      },

      createTaskFromSOP: ({ title, category, difficulty, priority, dueDate, steps }) => {
        const now = new Date().toISOString()
        const task: Task = {
          id: generateId(),
          title,
          category,
          difficulty,
          priority,
          dueDate,
          description: '',
          actualMinutes: 0,
          status: 'todo',
          xpReward: 0,
          completedAt: null,
          deletedAt: null,
          isHidden: false,
          sortOrder: get().tasks.length,
          createdAt: now,
          updatedAt: now,
          subTasks: steps.map((step, i) => mapStepToSubTask(step, i)),
        }
        set((s) => ({ tasks: [...s.tasks, task], lastCategory: category }))
        return task.id
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
      name: `${getStoragePrefix()}-tasks`,
      onRehydrateStorage: () => (state) => {
        if (!state) return

        // ── v0.3 迁移：平铺子任务 → 内嵌 subTasks ────────────────
        if (!localStorage.getItem(SUBTASK_MIGRATION_KEY)) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const allRaw = state.tasks as any[]
          const rootTasks = allRaw.filter((t) => !t.parentId)
          const childTasks = allRaw.filter((t) => t.parentId)

          const childrenMap = new Map<string, typeof childTasks>()
          childTasks.forEach((child) => {
            const pid = child.parentId as string
            const siblings = childrenMap.get(pid) ?? []
            siblings.push(child)
            childrenMap.set(pid, siblings)
          })

          state.tasks = rootTasks.map((root) => ({
            ...root,
            subTasks: buildSubTasksFromFlat(childrenMap, root.id),
          })) as Task[]

          localStorage.setItem(SUBTASK_MIGRATION_KEY, new Date().toISOString())
        }

        // ── 兼容：确保所有任务都有 subTasks ──────────────────────
        state.tasks = state.tasks.map((t) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const legacy = t as any
          if ('timerStartedAt' in legacy) delete legacy.timerStartedAt
          if ('timerElapsed' in legacy) delete legacy.timerElapsed
          return {
            ...t,
            category: migrateCategory(t.category),
            actualMinutes: t.actualMinutes ?? 0,
            sortOrder: t.sortOrder ?? 0,
            subTasks: t.subTasks ?? [],
          }
        })

        state.lastCategory = migrateCategory(state.lastCategory)
        if (!state.completedViewMode) state.completedViewMode = 'month'
        if (!state.customTaskGroups) state.customTaskGroups = []
      },
    }
  )
)
