import type MindElixir from 'mind-elixir'
import { cloneMindMapNode, type MindMapNode } from '@/types/mindMap'

/** Reuse the library's drag session; only extend a drop with no native node target. */
export function bindMindMapSideDrag(mind: MindElixir, host: HTMLElement,
  revision: () => number, commit: (root: MindMapNode, expectedRevision: number) => boolean) {
  let gesture: { pointerId: number; source: HTMLElement; id: string; side: 0 | 1;
    revision: number; dragging: boolean } | null = null
  const container = mind.container
  const clear = () => { gesture = null }
  const cancel = () => {
    const previous = gesture
    gesture = null
    // The library owns ghost, opacity, edge scrolling and pointer state. Clear
    // that session before a refresh detaches its source element.
    if (mind.dragged) container.dispatchEvent(new PointerEvent('pointercancel', { bubbles: true,
      pointerId: previous?.pointerId ?? 0 }))
    if (previous?.source.hasPointerCapture?.(previous.pointerId)) previous.source.releasePointerCapture(previous.pointerId)
  }
  const down = (event: PointerEvent) => {
    clear()
    if (event.button !== 0 || event.isPrimary === false || mind.spacePressed || !mind.editable) return
    const source = event.target instanceof Element ? event.target.closest<HTMLElement>('me-tpc') : null
    if (!source || !container.contains(source) || container.querySelector('#input-box')) return
    const root = cloneMindMapNode(mind.getData().nodeData as MindMapNode)
    const id = source.getAttribute('data-nodeid')?.slice(2)
    if (!id || id === root.id) return
    const side = root.children?.find(child => contains(child, id))?.direction
    if (side !== 0 && side !== 1) return
    gesture = { pointerId: event.pointerId, source, id, side, revision: revision(), dragging: false }
  }
  const move = (event: PointerEvent) => {
    if (!gesture || gesture.pointerId !== event.pointerId) return
    // In particular, a quick touch swipe never becomes a drag until the native
    // long press has activated its ghost. Multiple selections keep native behavior.
    const ghost = container.querySelector<HTMLElement>('.mind-elixir-ghost')
    gesture.dragging = mind.dragged?.length === 1 && mind.dragged[0].nodeObj.id === gesture.id
      && ghost?.style.display === 'block'
  }
  const up = (event: PointerEvent) => {
    const previous = gesture
    clear()
    if (!previous || previous.pointerId !== event.pointerId || !previous.dragging || revision() !== previous.revision) return
    // This bubbles after the native container pointerup handler, so any real
    // node drop has already emitted an operation and cleared our gesture.
    const frame = container.getBoundingClientRect()
    if (event.clientX < frame.left || event.clientX > frame.right || event.clientY < frame.top || event.clientY > frame.bottom) return
    const hit = document.elementFromPoint(event.clientX, event.clientY)
    if (!hit || !container.contains(hit) || hit.closest('me-tpc,me-epd,#input-box,.svg-label,.context-menu')) return
    const root = cloneMindMapNode(mind.getData().nodeData as MindMapNode)
    const rootBox = mind.findEle(root.id).getBoundingClientRect()
    const side = event.clientX < rootBox.left - 8 ? 0 : event.clientX > rootBox.right + 8 ? 1 : null
    if (side === null || side === previous.side || !moveBranch(root, previous.id, side)) return
    commit(root, previous.revision)
  }
  const keydown = (event: KeyboardEvent) => { if (event.key === 'Escape') cancel() }
  host.addEventListener('pointerdown', down, true)
  host.addEventListener('pointermove', move)
  host.addEventListener('pointerup', up)
  host.addEventListener('pointercancel', clear, true)
  window.addEventListener('blur', cancel)
  window.addEventListener('keydown', keydown)
  mind.bus.addListener('operation', clear)
  mind.bus.addListener('expandNode', clear)
  return { cancel, dispose: () => {
    cancel()
    host.removeEventListener('pointerdown', down, true)
    host.removeEventListener('pointermove', move)
    host.removeEventListener('pointerup', up)
    host.removeEventListener('pointercancel', clear, true)
    window.removeEventListener('blur', cancel)
    window.removeEventListener('keydown', keydown)
    mind.bus.removeListener('operation', clear)
    mind.bus.removeListener('expandNode', clear)
  } }
}
function contains(node: MindMapNode, id: string): boolean {
  return node.id === id || !!node.children?.some(child => contains(child, id))
}
function moveBranch(root: MindMapNode, id: string, side: 0 | 1): boolean {
  const detach = (parent: MindMapNode): MindMapNode | undefined => {
    const index = parent.children?.findIndex(child => child.id === id) ?? -1
    if (index >= 0) return parent.children!.splice(index, 1)[0]
    for (const child of parent.children ?? []) { const found = detach(child); if (found) return found }
    return undefined
  }
  const branch = detach(root)
  if (!branch) return false
  branch.direction = side
  root.children = [...(root.children ?? []), branch]
  return true
}
