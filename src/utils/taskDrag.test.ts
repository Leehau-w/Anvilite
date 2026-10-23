import { afterEach, expect, it } from 'vitest'
import { beginTaskDrag, endTaskDrag, isTaskDrag, takeDraggedTask, TASK_DRAG_MIME } from './taskDrag'
import type { DragEvent } from 'react'

function event() {
  const values = new Map<string, string>()
  return { dataTransfer: {
    types: [] as string[], effectAllowed: 'none',
    setData(type: string, value: string) { values.set(type, value); this.types = [...values.keys()] },
    getData(type: string) { return values.get(type) ?? '' },
  } } as unknown as DragEvent<HTMLElement>
}
afterEach(endTaskDrag)

it('transfers only a task from the current gesture and consumes it once', () => {
  const drag = event()
  beginTaskDrag(drag, 'original-task')
  expect(drag.dataTransfer.effectAllowed).toBe('move')
  expect(drag.dataTransfer.getData(TASK_DRAG_MIME)).not.toBe('original-task')
  expect(isTaskDrag(drag)).toBe(true)
  expect(takeDraggedTask(drag)).toBe('original-task')
  expect(takeDraggedTask(drag)).toBeNull()
})
it('does not accept external text, fabricated task IDs or stale gesture tokens', () => {
  const external = event()
  external.dataTransfer.setData(TASK_DRAG_MIME, 'forged-task-id')
  expect(isTaskDrag(external)).toBe(false)
  expect(takeDraggedTask(external)).toBeNull()
  const old = event()
  beginTaskDrag(old, 'old')
  const current = event()
  beginTaskDrag(current, 'new')
  expect(takeDraggedTask(old)).toBeNull()
  expect(takeDraggedTask(external)).toBeNull()
  expect(takeDraggedTask(current)).toBe('new')
})
it('cancels without any transfer when the drag ends outside a drop target', () => {
  const drag = event()
  beginTaskDrag(drag, 'unchanged-task')
  endTaskDrag()
  expect(isTaskDrag(drag)).toBe(false)
  expect(takeDraggedTask(drag)).toBeNull()
})
