import { useEffect, useLayoutEffect, useRef, type RefObject } from 'react'
import MindElixir, { type MindElixirData, type NodeObj, type Operation, type Theme } from 'mind-elixir'
import 'mind-elixir/style.css'
import { useTaskStore } from '@/stores/taskStore'
import { useT, type Translations } from '@/i18n'
import { cloneMindMapNode, type MindMapDocument, type MindMapNode, type MindMapTitleEdit } from '@/types/mindMap'
import type { Task } from '@/types/task'
import { getMindMapNodeTitle, resolveMindMapNodeTask } from '@/utils/mindMapTaskLinks'

export interface MindMapCanvasControls { center: () => void; zoom: (delta: number) => void }
interface Props {
  map: MindMapDocument
  selectedNodeId: string | null
  onSelect: (id: string | null) => void
  onChange: (root: MindMapNode, expectedRevision: number, titleEdits?: MindMapTitleEdit[]) => boolean
  controlsRef: RefObject<MindMapCanvasControls | null>
  resetVersion: number
}

const theme: Theme = {
  name: 'Anvilite',
  palette: ['var(--task-tone-blue)', 'var(--task-tone-orange)', 'var(--task-tone-purple)', 'var(--task-tone-sand)', 'var(--task-tone-brown)'],
  cssVar: {
    '--main-color': 'var(--color-text)', '--main-bgcolor': 'var(--color-surface-hover)',
    '--main-bgcolor-transparent': 'var(--color-surface-hover)', '--main-border': '1px solid var(--color-border)',
    '--color': 'var(--color-text)', '--bgcolor': 'var(--color-bg)', '--selected': 'var(--color-accent)',
    '--accent-color': 'var(--color-accent)', '--root-color': 'var(--color-text)',
    '--root-bgcolor': 'var(--color-surface)', '--root-border-color': 'var(--color-accent)',
    '--root-radius': '12px', '--main-radius': '8px', '--topic-padding': '9px 13px',
    '--panel-color': 'var(--color-text)', '--panel-bgcolor': 'var(--color-surface)',
    '--panel-border-color': 'var(--color-border)', '--node-gap-x': '28px', '--node-gap-y': '14px',
    '--main-gap-x': '48px', '--main-gap-y': '26px', '--map-padding': '40px',
  },
}

/** Presentation-only task badges; task fields never become part of the saved tree. */
export function projectMindMap(root: MindMapNode, tasks: readonly Task[], t: Translations): MindElixirData {
  function project(node: MindMapNode): NodeObj {
    const linked = resolveMindMapNodeTask(node, tasks)
    const label = node.taskId ? (linked ? (linked.subTask ? (linked.subTask.completed ? t.tasklist_done : t.tasklist_todo) : taskStatus(linked.task, t)) : t.mindmap_taskMissing) : null
    return {
      id: node.id, topic: getMindMapNodeTitle(node, tasks),
      ...(node.direction === 0 || node.direction === 1 ? { direction: node.direction } : {}),
      ...(typeof node.expanded === 'boolean' ? { expanded: node.expanded } : {}),
      ...(node.children?.length ? { children: node.children.map(project) } : {}),
      ...(label ? { tags: [{ text: label, className: 'mindmap-task-tag', style: { color: 'var(--color-text-dim)', background: 'var(--color-surface-hover)', border: '1px solid var(--color-border)' } }] } : {}),
    }
  }
  return { nodeData: project(root) }
}
function taskStatus(task: Task, t: Translations) {
  if (task.status === 'done') return t.tasklist_done
  if (task.status === 'doing') return t.tasklist_doing
  if (task.status === 'waiting') return t.task_waiting
  return t.tasklist_todo
}

export function MindMapCanvas({ map, selectedNodeId, onSelect, onChange, controlsRef, resetVersion }: Props) {
  const host = useRef<HTMLDivElement>(null)
  const instance = useRef<MindElixir | null>(null)
  const tasks = useTaskStore(s => s.tasks)
  const t = useT()
  const latest = useRef({ map, tasks, t, onSelect, onChange, selectedNodeId })
  latest.current = { map, tasks, t, onSelect, onChange, selectedNodeId }
  const renderedRevision = useRef(map.revision)
  const refreshLatest = useRef<() => void>(() => {})

  useLayoutEffect(() => {
    if (!host.current) return
    const el = host.current
    let active = true
    let refreshing = false
    let composing = false
    let projectedTitles = new Map<string, string>()
    function rememberTitles(node: NodeObj) {
      const titles = new Map<string, string>()
      const visit = (current: NodeObj) => { titles.set(current.id, current.topic); current.children?.forEach(visit) }
      visit(node)
      projectedTitles = titles
    }
    let blurTimer: ReturnType<typeof setTimeout> | undefined
    const mind = new MindElixir({
      el, direction: MindElixir.SIDE, editable: true, contextMenu: false, toolBar: false,
      keypress: false, allowUndo: false, theme, newTopicName: latest.current.t.mindmap_newNode,
      scaleMin: .25, scaleMax: 2, scaleSensitivity: .08,
      // Only plain node content is accepted. Diagram clipboard imports and arrows
      // are deliberately absent from this first version's saved schema.
    })
    instance.current = mind
    const initial = projectMindMap(latest.current.map.root, latest.current.tasks, latest.current.t)
    rememberTitles(initial.nodeData)
    const result = mind.init(initial)
    if (result) { mind.destroy(); instance.current = null; throw result }
    mind.scaleFit()
    renderedRevision.current = latest.current.map.revision
    function selectCurrent() {
      const id = latest.current.selectedNodeId
      if (!id || mind.currentNode?.nodeObj.id === id) return
      try { mind.selectNode(mind.findEle(id)) }
      catch {
        // A selected descendant may become hidden after an external collapse.
        try { mind.selectNode(mind.findEle(latest.current.map.root.id)); latest.current.onSelect(latest.current.map.root.id) }
        catch { mind.clearSelection() }
      }
    }
    function refresh() {
      if (!active || el.querySelector('#input-box')) return
      refreshing = true
      const value = latest.current
      const projection = projectMindMap(value.map.root, value.tasks, value.t)
      rememberTitles(projection.nodeData)
      mind.refresh(projection)
      renderedRevision.current = value.map.revision
      selectCurrent()
      refreshing = false
    }
    refreshLatest.current = refresh
    const persist = () => {
      if (!active || refreshing) return
      // getData removes library parent cycles; the whitelist clone drops tags,
      // styles and rich HTML before the store applies its own validation.
      const root = cloneMindMapNode(mind.getData().nodeData as MindMapNode)
      const titleEdits: MindMapTitleEdit[] = []
      const visit = (node: MindMapNode) => {
        const previousTitle = projectedTitles.get(node.id)
        if (previousTitle !== undefined && previousTitle !== node.topic) titleEdits.push({ nodeId: node.id, previousTitle, title: node.topic })
        node.children?.forEach(visit)
      }
      visit(root)
      // Projected task titles are only written back when the user actually edits
      // text. A stale drag or fold snapshot must never rename a changed task.
      if (latest.current.onChange(root, renderedRevision.current, titleEdits)) rememberTitles(root)
    }
    const operation = (event: Operation) => { if (event.name !== 'beginEdit') persist() }
    const select = (nodes: NodeObj[]) => { if (!refreshing) latest.current.onSelect(nodes[0]?.id ?? null) }
    mind.bus.addListener('operation', operation)
    mind.bus.addListener('expandNode', persist)
    mind.bus.addListener('selectNodes', select)
    selectCurrent()
    controlsRef.current = {
      center: () => mind.scaleFit(),
      zoom: delta => mind.scale(Math.max(.25, Math.min(2, mind.scaleVal + delta))),
    }
    const onBlur = () => {
      composing = false
      clearTimeout(blurTimer)
      // Native editing saves on blur. Refresh only afterwards so external task
      // updates cannot destroy an in-progress text composition.
      blurTimer = setTimeout(() => refresh(), 0)
    }
    const onCompositionStart = () => { composing = true }
    const onCompositionEnd = () => { composing = false }
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.target instanceof Element) || !event.target.closest('#input-box')) return
      if ((event.key === 'Enter' || event.key === 'Tab') && (composing || event.isComposing || event.keyCode === 229)) event.stopPropagation()
    }
    el.addEventListener('blur', onBlur, true)
    el.addEventListener('compositionstart', onCompositionStart, true)
    el.addEventListener('compositionend', onCompositionEnd, true)
    el.addEventListener('keydown', onKeyDown, true)
    const resize = () => { if (active) mind.linkDiv() }
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null
    observer?.observe(el)
    window.addEventListener('resize', resize)
    return () => {
      active = false
      clearTimeout(blurTimer)
      observer?.disconnect()
      window.removeEventListener('resize', resize)
      el.removeEventListener('blur', onBlur, true)
      el.removeEventListener('compositionstart', onCompositionStart, true)
      el.removeEventListener('compositionend', onCompositionEnd, true)
      el.removeEventListener('keydown', onKeyDown, true)
      mind.bus.removeListener('operation', operation)
      mind.bus.removeListener('expandNode', persist)
      mind.bus.removeListener('selectNodes', select)
      controlsRef.current = null
      refreshLatest.current = () => {}
      instance.current = null
      mind.destroy()
    }
  }, [map.id, controlsRef])

  useEffect(() => { refreshLatest.current() }, [map.root, map.revision, tasks, t, resetVersion])
  useEffect(() => {
    const mind = instance.current
    if (!mind || !selectedNodeId || mind.currentNode?.nodeObj.id === selectedNodeId) return
    try { mind.selectNode(mind.findEle(selectedNodeId)) }
    catch {
      try { mind.selectNode(mind.findEle(map.root.id)); latest.current.onSelect(map.root.id) }
      catch { mind.clearSelection() }
    }
  }, [selectedNodeId, map.root])

  return <div ref={host} className="mindmap-canvas" data-mindmap-canvas aria-label={t.mindmap_title} />
}
