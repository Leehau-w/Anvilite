export interface SubTask {
  id: string
  title: string
  completed: boolean
  sortOrder: number
  subTasks: SubTask[]  // 递归，最多 3 层（depth 0/1/2）
  createdAt: string
}

export interface Task {
  id: string
  title: string
  category: string
  difficulty: 1 | 2 | 3 | 4 | 5
  priority: 'urgent' | 'high' | 'medium' | 'low'
  dueDate: string | null
  description: string
  /** @deprecated UI 不再使用，字段保留供历史数据兼容 */
  estimatedMinutes?: number | null
  actualMinutes: number
  status: 'todo' | 'doing' | 'done'
  xpReward: number
  completedAt: string | null
  deletedAt: string | null
  isHidden: boolean
  sortOrder: number
  subTasks: SubTask[]
  createdAt: string
  updatedAt: string
}

export type TaskStatus = Task['status']
export type TaskPriority = Task['priority']
export type TaskDifficulty = Task['difficulty']

export interface TaskGroup {
  id: string
  name: string
  type: 'custom'
  taskIds: string[]
  createdAt: string
}
