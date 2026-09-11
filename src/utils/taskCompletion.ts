import { useTaskStore } from '@/stores/taskStore'
import { useCharacterStore } from '@/stores/characterStore'
import { useGrowthEventStore } from '@/stores/growthEventStore'
import { findCompletionEvent } from './completionEvent'

export function undoTaskCompletion(id: string, completionId?: string): boolean {
  const task = useTaskStore.getState().tasks.find(t => t.id === id)
  if (!task || task.status !== 'done' || (completionId && completionId !== task.completionId)) return false
  const event = findCompletionEvent(useGrowthEventStore.getState().events, id, task.completionId)
  useTaskStore.getState().undoComplete(id)
  useTaskStore.getState().updateTask(id, { xpReward: 0, completionId: undefined })
  useCharacterStore.getState().revokeXP(task.xpReward)
  if (event) useGrowthEventStore.getState().removeEvent(event.id)
  return true
}
