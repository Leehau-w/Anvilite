export interface Task {
  id: string
  title: string
  category: string
  difficulty: 1 | 2 | 3 | 4 | 5
  priority: 'urgent' | 'high' | 'medium' | 'low'
  dueDate: string | null
  description: string
  estimatedMinutes: number | null
  status: 'todo' | 'doing' | 'done'
  parentId: string | null
  childIds: string[]
  nestingLevel: number
  xpReward: number
  actualMinutes: number
  completedAt: string | null
  deletedAt: string | null
  isHidden: boolean
  sortOrder: number
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
