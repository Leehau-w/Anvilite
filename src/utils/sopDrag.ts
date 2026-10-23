export const SOP_DRAG_MIME = 'application/x-anvilite-sop'
let active: { sopId: string; token: string } | null = null

export function beginSOPDrag(event: { dataTransfer: DataTransfer }, sopId: string): void {
  endSOPDrag()
  const token = crypto.randomUUID()
  event.dataTransfer.setData(SOP_DRAG_MIME, token)
  event.dataTransfer.effectAllowed = 'copyMove'
  active = { sopId, token }
  window.addEventListener?.('dragend', endSOPDrag)
  window.addEventListener?.('blur', endSOPDrag)
}
export function endSOPDrag(): void {
  active = null
  window.removeEventListener?.('dragend', endSOPDrag)
  window.removeEventListener?.('blur', endSOPDrag)
}
export function isSOPDrag(dataTransfer: DataTransfer): boolean {
  return active !== null && Array.from(dataTransfer.types).includes(SOP_DRAG_MIME)
}
export function readDraggedSOP(dataTransfer: DataTransfer): string | null {
  return isSOPDrag(dataTransfer) && dataTransfer.getData(SOP_DRAG_MIME) === active!.token ? active!.sopId : null
}
export function takeDraggedSOP(dataTransfer: DataTransfer): string | null {
  const id = readDraggedSOP(dataTransfer)
  if (id !== null) endSOPDrag()
  return id
}
export const consumeSOPDrag = takeDraggedSOP
