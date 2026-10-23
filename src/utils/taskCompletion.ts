import { useTaskStore } from '@/stores/taskStore'

export function undoTaskCompletion(id: string, completionId?: string): boolean {
  const task = useTaskStore.getState().tasks.find(t => t.id === id)
  if (!task || task.deletedAt || task.status !== 'done' || (completionId && completionId !== task.completionId)) return false
  useTaskStore.getState().undoComplete(id)
  return true
}

/** Legacy name retained; deletion now changes only the task and its completion event. */
export function deleteTaskWithRewards(id: string): boolean {
  const task = useTaskStore.getState().tasks.find(t => t.id === id)
  if (!task || task.deletedAt) return false
  useTaskStore.getState().deleteTask(id)
  return true
}
