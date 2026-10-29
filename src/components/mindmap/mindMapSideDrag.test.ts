// @vitest-environment happy-dom
import { afterEach, beforeEach, expect, it, vi, type Mock } from 'vitest'
import type MindElixir from 'mind-elixir'
import { bindMindMapSideDrag } from './mindMapSideDrag'
import type { MindMapNode } from '@/types/mindMap'

let host: HTMLElement, container: HTMLElement, source: HTMLElement, ghost: HTMLElement
let root: MindMapNode, hit: Element | null, currentRevision: number
let nativeDragAllowed: boolean, nativeDrop: boolean, selectedCount: number
let bind: ReturnType<typeof bindMindMapSideDrag>, mind: any
let commit: Mock<(root: MindMapNode, expectedRevision: number) => boolean>
let handlers: Map<string, Function[]>
const rect = (x: number, y: number, width: number, height: number) => DOMRect.fromRect({ x, y, width, height })
const find = (node: MindMapNode, id: string): MindMapNode | undefined => node.id === id ? node : node.children?.map(child => find(child, id)).find(Boolean)
function fire(type: string, x = 100, y = 110, options: PointerEventInit = {}) {
  source.dispatchEvent(new PointerEvent(type, { bubbles: true, button: 0, pointerId: 17,
    pointerType: 'mouse', isPrimary: true, clientX: x, clientY: y, ...options }))
}
function drag(x = 100, y = 110) { fire('pointerdown', 420, 180); fire('pointermove', x, y); fire('pointerup', x, y) }
beforeEach(() => {
  vi.stubGlobal('window', document.defaultView)
  root = { id: 'root', topic: 'Plan', children: [
    { id: 'right', topic: 'Right', direction: 1, expanded: false, taskId: 'task', children: [
      { id: 'leaf', topic: 'Leaf', subTaskId: 'sub', taskId: 'task', children: [{ id: 'tip', topic: 'Tip' }] },
    ] },
    { id: 'left', topic: 'Left', direction: 0 },
  ] }
  host = document.createElement('div'); container = document.createElement('div'); host.append(container); document.body.append(host)
  container.getBoundingClientRect = () => rect(0, 0, 600, 400)
  for (const id of ['root', 'right', 'left', 'leaf']) {
    const topic = document.createElement('me-tpc') as any
    topic.setAttribute('data-nodeid', 'me' + id); topic.nodeObj = find(root, id)
    topic.getBoundingClientRect = () => id === 'root' ? rect(260, 150, 80, 50) : rect(id === 'left' ? 100 : 400, 180, 70, 30)
    container.append(topic)
  }
  source = container.querySelector('[data-nodeid="meright"]')!
  ghost = document.createElement('div'); ghost.className = 'mind-elixir-ghost'; ghost.style.display = 'none'; container.append(ghost)
  hit = container; currentRevision = 7; nativeDragAllowed = true; nativeDrop = false; selectedCount = 1
  vi.spyOn(document, 'elementFromPoint').mockImplementation(() => hit)
  handlers = new Map()
  mind = { container, spacePressed: false, editable: true, dragged: null,
    bus: { addListener: (name: string, fn: Function) => handlers.set(name, [...(handlers.get(name) ?? []), fn]),
      removeListener: (name: string, fn: Function) => handlers.set(name, (handlers.get(name) ?? []).filter(item => item !== fn)) },
    getData: () => ({ nodeData: structuredClone(root) }),
    findEle: (id: string) => container.querySelector('[data-nodeid="me' + id + '"]'),
  }
  const clearNative = () => { ghost.style.display = 'none'; mind.dragged = null }
  // These native handlers run before the extension's host bubble handlers.
  container.addEventListener('pointerdown', event => {
    const topic = event.target as any
    mind.dragged = Array.from({ length: selectedCount }, () => topic)
  })
  container.addEventListener('pointermove', () => { if (nativeDragAllowed && mind.dragged) ghost.style.display = 'block' })
  container.addEventListener('pointerup', () => {
    clearNative()
    if (nativeDrop) handlers.get('operation')?.forEach(fn => fn({ name: 'moveNodeIn' }))
  })
  container.addEventListener('pointercancel', clearNative)
  commit = vi.fn(() => true)
  bind = bindMindMapSideDrag(mind as MindElixir, host, () => currentRevision, commit)
})
afterEach(() => { bind?.dispose(); host.remove(); vi.restoreAllMocks(); vi.unstubAllGlobals() })

it('moves a whole folded branch into the opposite blank side after native drag cleanup', () => {
  drag()
  expect(mind.dragged).toBeNull(); expect(ghost.style.display).toBe('none')
  expect(commit).toHaveBeenCalledOnce()
  const [next, revision] = commit.mock.calls[0]
  expect(revision).toBe(7)
  expect(next.children!.map((node: MindMapNode) => node.id)).toEqual(['left', 'right'])
  expect(next.children![1]).toEqual({ ...root.children![0], direction: 0 })
  expect(root.children![0].direction).toBe(1)
})

it('promotes a nested branch to root while keeping its entire subtree and references', () => {
  source = container.querySelector('[data-nodeid="meleaf"]')!
  drag()
  const next = commit.mock.calls[0][0]
  expect(next.children![0].children).toEqual([])
  expect(next.children![2]).toEqual({ ...root.children![0].children![0], direction: 0 })
})

it('supports moving from the left back into blank space on the right', () => {
  source = container.querySelector('[data-nodeid="meleft"]')!
  drag(490)
  expect(commit.mock.calls[0][0].children![1]).toEqual({ id: 'left', topic: 'Left', direction: 1 })
})

it('keeps a native node-target drop as the only operation', () => {
  nativeDrop = true; drag()
  expect(commit).not.toHaveBeenCalled()
})

it.each(['node', 'expander', 'outside', 'overlay', 'center', 'same-side', 'no-hit'])(
  'ignores a %s drop instead of stealing native behavior', type => {
    let x = 100, y = 110
    if (type === 'node') hit = container.querySelector('[data-nodeid="meleft"]')!
    if (type === 'expander') { hit = document.createElement('me-epd'); container.append(hit) }
    if (type === 'outside') x = -10
    if (type === 'overlay') { hit = document.createElement('div'); host.append(hit) }
    if (type === 'center') x = 300
    if (type === 'same-side') x = 490
    if (type === 'no-hit') hit = null
    drag(x, y)
    expect(commit).not.toHaveBeenCalled()
  })

it('does not treat a quick touch swipe or a plain click as an activated native drag', () => {
  nativeDragAllowed = false
  fire('pointerdown', 420, 180, { pointerType: 'touch' }); fire('pointermove', 100, 110, { pointerType: 'touch' }); fire('pointerup', 100, 110, { pointerType: 'touch' })
  fire('pointerdown'); fire('pointerup')
  expect(commit).not.toHaveBeenCalled()
})

it('keeps multi-selection and root gestures native', () => {
  selectedCount = 2; drag(); expect(commit).not.toHaveBeenCalled()
  selectedCount = 1; source = container.querySelector('[data-nodeid="meroot"]')!
  drag(); expect(commit).not.toHaveBeenCalled()
})

it.each(['escape', 'blur', 'pointercancel', 'refresh'])(
  'cancels on %s and can start a fresh drag afterwards', type => {
    fire('pointerdown', 420, 180); fire('pointermove')
    expect(ghost.style.display).toBe('block')
    if (type === 'escape') window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    if (type === 'blur') window.dispatchEvent(new Event('blur'))
    if (type === 'pointercancel') fire('pointercancel')
    if (type === 'refresh') bind.cancel()
    fire('pointerup')
    expect(commit).not.toHaveBeenCalled(); expect(mind.dragged).toBeNull()
    drag(); expect(commit).toHaveBeenCalledOnce()
  })

it('rejects a map revision change and does not handle events after disposal', () => {
  fire('pointerdown', 420, 180); fire('pointermove'); currentRevision++
  fire('pointerup'); expect(commit).not.toHaveBeenCalled()
  bind.dispose(); drag(); expect(commit).not.toHaveBeenCalled()
})
