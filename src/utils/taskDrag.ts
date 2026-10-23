import type { DragEvent } from 'react'

export const TASK_DRAG_MIME = 'application/x-anvilite-task'
type TaskDragEvent = Pick<DragEvent<HTMLElement>, 'dataTransfer'>
let active: { taskId: string; token: string } | null = null

/** Keep task identity in this document; external text or copied task IDs cannot move a task. */
export function beginTaskDrag(event: TaskDragEvent, taskId: string): void {
  endTaskDrag()
  const token = crypto.randomUUID()
  event.dataTransfer.setData(TASK_DRAG_MIME, token)
  event.dataTransfer.effectAllowed = 'move'
  active = { taskId, token }
  window.addEventListener?.('dragend', endTaskDrag)
  window.addEventListener?.('blur', endTaskDrag)
}

export function endTaskDrag(): void {
  active = null
  window.removeEventListener?.('dragend', endTaskDrag)
  window.removeEventListener?.('blur', endTaskDrag)
}

// During dragover browsers expose formats but intentionally hide their contents.
export function isTaskDrag(event: TaskDragEvent): boolean {
  return active !== null && Array.from(event.dataTransfer.types).includes(TASK_DRAG_MIME)
}

export function takeDraggedTask(event: TaskDragEvent): string | null {
  if (!isTaskDrag(event) || event.dataTransfer.getData(TASK_DRAG_MIME) !== active!.token) return null
  const taskId = active!.taskId
  endTaskDrag()
  return taskId
}
