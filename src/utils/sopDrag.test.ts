import { afterEach, expect, it } from 'vitest'
import { beginSOPDrag, endSOPDrag, isSOPDrag, readDraggedSOP, takeDraggedSOP, SOP_DRAG_MIME } from './sopDrag'
function transfer(): DataTransfer {
  const values = new Map<string, string>()
  return {
    types: [] as string[], effectAllowed: 'none',
    setData(this: { types: string[] }, type: string, value: string) { values.set(type, value); this.types = [...values.keys()] },
    getData(type: string) { return values.get(type) ?? '' },
  } as unknown as DataTransfer
}
afterEach(endSOPDrag)
it('reads only the current gesture and consumes its token once so a replay cannot make a second copy', () => {
  const dataTransfer = transfer()
  beginSOPDrag({ dataTransfer }, 'built-in-source')
  expect(dataTransfer.effectAllowed).toBe('copyMove')
  expect(dataTransfer.getData(SOP_DRAG_MIME)).not.toBe('built-in-source')
  expect(isSOPDrag(dataTransfer)).toBe(true)
  expect(readDraggedSOP(dataTransfer)).toBe('built-in-source')
  expect(readDraggedSOP(dataTransfer)).toBe('built-in-source')
  expect(takeDraggedSOP(dataTransfer)).toBe('built-in-source')
  expect(readDraggedSOP(dataTransfer)).toBeNull()
  expect(takeDraggedSOP(dataTransfer)).toBeNull()
})
it('rejects external text, fabricated IDs and stale gesture tokens without consuming a newer gesture', () => {
  const external = transfer()
  external.setData(SOP_DRAG_MIME, 'forged-source-id')
  expect(takeDraggedSOP(external)).toBeNull()
  const old = transfer()
  beginSOPDrag({ dataTransfer: old }, 'old-source')
  const current = transfer()
  beginSOPDrag({ dataTransfer: current }, 'new-source')
  expect(takeDraggedSOP(old)).toBeNull()
  expect(takeDraggedSOP(external)).toBeNull()
  expect(takeDraggedSOP(current)).toBe('new-source')
})
it('cancels outside drops without leaking an entity ID into a later drag', () => {
  const dataTransfer = transfer()
  beginSOPDrag({ dataTransfer }, 'cancelled')
  endSOPDrag()
  expect(isSOPDrag(dataTransfer)).toBe(false)
  expect(takeDraggedSOP(dataTransfer)).toBeNull()
})
