import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { useMindMapStore } from '@/stores/mindMapStore'
import { useTaskStore } from '@/stores/taskStore'
import { useT } from '@/i18n'
import { TaskItem } from '@/components/tasks/TaskItem'
import { TaskDrawer } from '@/components/tasks/TaskDrawer'
import { findMindMapNode, cloneMindMapNode, type MindMapNode, type MindMapTitleEdit } from '@/types/mindMap'
import { generateId } from '@/utils/id'
import { getMindMapNodeTitle, resolveMindMapNodeTask, isMindMapTaskDepthError, isMindMapTaskTitleConflictError } from '@/utils/mindMapTaskLinks'
import { MindMapCanvas, type MindMapCanvasControls } from './MindMapCanvas'
import './MindMapPage.css'

type Dialog = { kind: 'new' | 'rename'; name: string } | { kind: 'delete-map' | 'delete-node'; nodeId?: string }

export function MindMapPage() {
  const t = useT()
  const maps = useMindMapStore(s => s.maps)
  const selectedMapId = useMindMapStore(s => s.selectedMapId)
  const tasks = useTaskStore(s => s.tasks)
  const activeMap = maps.find(map => map.id === selectedMapId) ?? maps[0] ?? null
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const titleBaseline = useRef<{ nodeId: string | null; title: string }>({ nodeId: null, title: '' })
  const titleComposing = useRef(false)
  const [query, setQuery] = useState('')
  const [showTaskSearch, setShowTaskSearch] = useState(false)
  const [dialog, setDialog] = useState<Dialog | null>(null)
  const [error, setError] = useState('')
  const [resetVersion, setResetVersion] = useState(0)
  const [editTaskId, setEditTaskId] = useState<string | null>(null)
  const busy = useRef(false)
  const reconciledMapId = useRef<string | null | undefined>(undefined)
  const canvas = useRef<MindMapCanvasControls | null>(null)
  const selectedNode = activeMap ? findMindMapNode(activeMap.root, selectedNodeId ?? activeMap.root.id) : null
  const linked = selectedNode ? resolveMindMapNodeTask(selectedNode, tasks) : null
  const linkedTask = linked?.task ?? null
  const linkedSubTask = linked?.subTask
  const liveTitle = selectedNode ? getMindMapNodeTitle(selectedNode, tasks) : ''
  const editTask = tasks.find(task => task.id === editTaskId && !task.deletedAt)
  const availableTasks = useMemo(() => {
    const search = query.trim().toLocaleLowerCase()
    return tasks.filter(task => !task.deletedAt && (!search || task.title.toLocaleLowerCase().includes(search)))
      .sort((a, b) => Number(a.status === 'done') - Number(b.status === 'done'))
  }, [tasks, query])

  useEffect(() => {
    const id = activeMap?.id ?? null
    if (reconciledMapId.current === id) return
    reconciledMapId.current = id
    setSelectedNodeId(activeMap?.root.id ?? null)
    setError(''); setShowTaskSearch(false); setQuery(''); setDialog(null)
    // Upgrade pre-existing task links once on opening a map. Use the current
    // revision, and let the same transactional action own all child conversion.
    const current = useMindMapStore.getState().maps.find(map => map.id === id)
    if (!current || !hasTaskReference(current.root)) return
    try {
      if (!useMindMapStore.getState().updateMapTree(current.id, cloneMindMapNode(current.root), current.revision)) setError(t.mindmap_conflict)
    } catch (error) {
      setError(isMindMapTaskDepthError(error) ? t.mindmap_subTaskDepth : isMindMapTaskTitleConflictError(error) ? t.mindmap_conflict : t.mindmap_saveFailed)
    }
    // Changes to task data and language only refresh projections, never retry migration.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeMap?.id])
  useEffect(() => {
    const baseline = titleBaseline.current
    if (baseline.nodeId !== (selectedNode?.id ?? null) || title === baseline.title) {
      titleBaseline.current = { nodeId: selectedNode?.id ?? null, title: liveTitle }
      setTitle(liveTitle)
    }
    // Preserve a dirty draft's original live title for conflict detection.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedNode?.id, liveTitle])
  useEffect(() => { setShowTaskSearch(false); setQuery('') }, [selectedNode?.id])

  function run(action: () => unknown) {
    if (busy.current) return
    busy.current = true
    try {
      const result = action()
      if (result === false || result === null) { setError(t.mindmap_saveFailed); return false }
      setError('')
      return true
    } catch (error) {
      setError(isMindMapTaskDepthError(error) ? t.mindmap_subTaskDepth : isMindMapTaskTitleConflictError(error) ? t.mindmap_conflict : t.mindmap_saveFailed)
      setResetVersion(value => value + 1)
      return false
    } finally { busy.current = false }
  }
  function saveTree(root: MindMapNode, expectedRevision = activeMap?.revision, titleEdits?: MindMapTitleEdit[]) {
    if (!activeMap) return false
    try {
      const saved = useMindMapStore.getState().updateMapTree(activeMap.id, root, expectedRevision ?? activeMap.revision, titleEdits)
      if (!saved) {
        setError(t.mindmap_conflict)
        setResetVersion(value => value + 1)
        return false
      }
      setError('')
      return true
    } catch (error) {
      setError(isMindMapTaskDepthError(error) ? t.mindmap_subTaskDepth : isMindMapTaskTitleConflictError(error) ? t.mindmap_conflict : t.mindmap_saveFailed)
      setResetVersion(value => value + 1)
      return false
    }
  }
  function saveNodeTitle(event: FormEvent) {
    event.preventDefault()
    if (titleComposing.current || !activeMap || !selectedNode || !title.trim()) return
    const root = cloneMindMapNode(activeMap.root)
    const node = findMindMapNode(root, selectedNode.id)
    if (!node) return
    const nextTitle = title.trim()
    node.topic = nextTitle
    const previousTitle = titleBaseline.current.nodeId === node.id ? titleBaseline.current.title : liveTitle
    if (saveTree(root, activeMap.revision, [{ nodeId: node.id, previousTitle, title: nextTitle }])) {
      titleBaseline.current = { nodeId: node.id, title: nextTitle }
      setTitle(nextTitle)
    } else {
      const currentMap = useMindMapStore.getState().maps.find(map => map.id === activeMap.id)
      const currentNode = currentMap && findMindMapNode(currentMap.root, node.id)
      const currentTitle = currentNode ? getMindMapNodeTitle(currentNode, useTaskStore.getState().tasks) : ''
      titleBaseline.current = { nodeId: node.id, title: currentTitle }
      setTitle(currentTitle)
    }
  }
  function changeNode(change: (node: MindMapNode, root: MindMapNode) => void) {
    if (!activeMap || !selectedNode) return
    const root = cloneMindMapNode(activeMap.root)
    const node = findMindMapNode(root, selectedNode.id)
    if (!node) return
    change(node, root)
    saveTree(root)
  }
  function addNode(sibling = false) {
    if (!activeMap || !selectedNode) return
    const root = cloneMindMapNode(activeMap.root)
    const selected = findMindMapNode(root, selectedNode.id)
    if (!selected) return
    const parent = sibling ? findParent(root, selected.id) : selected
    if (!parent) return
    const node: MindMapNode = { id: generateId(), topic: t.mindmap_newNode }
    parent.children = [...(parent.children ?? []), node]
    parent.expanded = true
    if (saveTree(root)) setSelectedNodeId(node.id)
  }
  function removeNode(nodeId: string) {
    if (!activeMap || nodeId === activeMap.root.id) return false
    const root = cloneMindMapNode(activeMap.root)
    const parent = findParent(root, nodeId)
    if (!parent) return false
    parent.children = parent.children?.filter(node => node.id !== nodeId)
    if (!saveTree(root)) return false
    setSelectedNodeId(parent.id)
    return true
  }
  function submitDialog(event: FormEvent) {
    event.preventDefault()
    if (!dialog || !('name' in dialog) || !dialog.name.trim()) return
    const saved = run(() => dialog.kind === 'new'
      ? useMindMapStore.getState().createMap(dialog.name)
      : activeMap && useMindMapStore.getState().renameMap(activeMap.id, dialog.name))
    if (saved) setDialog(null)
  }
  function statusLabel(status: string) {
    return status === 'done' ? t.tasklist_done : status === 'doing' ? t.tasklist_doing : status === 'waiting' ? t.task_waiting : t.tasklist_todo
  }

  return <section className="mindmap-page" data-mindmap-page>
    <header className="mindmap-heading">
      <h1>{t.mindmap_title}</h1>
      <button type="button" className="mindmap-button mindmap-primary" data-mindmap-new onClick={() => setDialog({ kind: 'new', name: '' })}>+ {t.mindmap_new}</button>
    </header>
    {error && <div className="mindmap-error" role="alert">{error}</div>}
    {!activeMap ? <div className="mindmap-empty">
      <svg width="64" height="64" viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="M24 32H13M40 32h11M32 24V12M32 40v12"/><rect x="23" y="24" width="18" height="16" rx="5"/><circle cx="9" cy="32" r="4"/><circle cx="55" cy="32" r="4"/><circle cx="32" cy="8" r="4"/><circle cx="32" cy="56" r="4"/></svg>
      <h2>{t.mindmap_empty}</h2><p>{t.mindmap_emptyHint}</p>
      <button type="button" className="mindmap-button" onClick={() => setDialog({ kind: 'new', name: '' })}>{t.mindmap_new}</button>
    </div> : <>
      <nav className="mindmap-maps" aria-label={t.mindmap_title}>
        {maps.map(map => <button type="button" key={map.id} data-mindmap-id={map.id} className="mindmap-tab" aria-current={activeMap.id === map.id ? 'page' : undefined}
          onClick={() => run(() => useMindMapStore.getState().selectMap(map.id))}>{map.title}</button>)}
      </nav>
      <div className="mindmap-workspace">
        <div className="mindmap-board">
          <div className="mindmap-toolbar" role="toolbar" aria-label={t.mindmap_title}>
            <button type="button" className="mindmap-button" disabled={!selectedNode} onClick={() => addNode()} data-mindmap-add-child>+ {t.mindmap_addChild}</button>
            <button type="button" className="mindmap-button" disabled={!selectedNode || selectedNode.id === activeMap.root.id} onClick={() => addNode(true)}>{t.mindmap_addSibling}</button>
            <button type="button" className="mindmap-button" disabled={!selectedNode?.children?.length} onClick={() => changeNode(node => { node.expanded = node.expanded === false })}>{selectedNode?.expanded === false ? t.mindmap_expand : t.mindmap_collapse}</button>
            <span className="mindmap-toolbar-spacer" />
            <button type="button" className="mindmap-button mindmap-icon" aria-label={t.mindmap_zoomOut} title={t.mindmap_zoomOut} onClick={() => canvas.current?.zoom(-0.1)}>−</button>
            <button type="button" className="mindmap-button mindmap-icon" aria-label={t.mindmap_zoomIn} title={t.mindmap_zoomIn} onClick={() => canvas.current?.zoom(0.1)}>+</button>
            <button type="button" className="mindmap-button" onClick={() => canvas.current?.center()}>{t.mindmap_center}</button>
          </div>
          <MindMapCanvas key={activeMap.id} map={activeMap} selectedNodeId={selectedNode?.id ?? null} onSelect={setSelectedNodeId} onChange={saveTree} controlsRef={canvas} resetVersion={resetVersion} />
          <div className="mindmap-board-footer"><span>{t.mindmap_hint}</span><span>{t.mindmap_saved}</span></div>
        </div>
        <aside className="mindmap-inspector" aria-label={t.mindmap_node}>
          <div className="mindmap-map-actions">
            <button type="button" className="mindmap-button" onClick={() => setDialog({ kind: 'rename', name: activeMap.title })}>{t.mindmap_rename}</button>
            <button type="button" className="mindmap-button" onClick={() => setDialog({ kind: 'delete-map' })}>{t.mindmap_deleteMap}</button>
          </div>
          {selectedNode ? <>
            <form onSubmit={saveNodeTitle} onCompositionStart={() => { titleComposing.current = true }} onCompositionEnd={() => { titleComposing.current = false }} onKeyDownCapture={event => {
              if (event.key === 'Enter' && (titleComposing.current || event.nativeEvent.isComposing || event.keyCode === 229)) { event.preventDefault(); event.stopPropagation() }
            }}>
              <label className="mindmap-label" htmlFor="mindmap-node-title">{t.mindmap_nodeTitle}</label>
              <textarea id="mindmap-node-title" data-mindmap-node-title onBlur={() => { titleComposing.current = false }} className="mindmap-input mindmap-node-title" value={title} rows={2} onChange={event => setTitle(event.target.value)} maxLength={1000} />
              <button type="submit" className="mindmap-button" disabled={!title.trim() || title.trim() === titleBaseline.current.title}>{t.common_save}</button>
            </form>
            <div className="mindmap-task-section">
              <h2>{selectedNode.subTaskId ? t.mindmap_linkedSubTask : t.mindmap_linkedTask}</h2>
              {selectedNode.taskId ? <>
                {linkedTask ? <>
                  <div data-mindmap-task-status={linkedSubTask ? (linkedSubTask.completed ? 'done' : 'todo') : linkedTask.status} className="mindmap-status">{statusLabel(linkedSubTask ? (linkedSubTask.completed ? 'done' : 'todo') : linkedTask.status)}</div>
                  {linkedSubTask ? <>
                    <div className="mindmap-task-result" data-mindmap-subtask={linkedSubTask.id} data-mindmap-subtask-id={linkedSubTask.id} data-mindmap-subtask-status={linkedSubTask.completed ? 'done' : 'todo'}><span>{linkedSubTask.title}</span></div>
                    <p className="mindmap-note">{t.mindmap_parentTask}: {linkedTask.title}</p>
                  </> : <TaskItem key={linkedTask.id} task={linkedTask} compact onEdit={task => setEditTaskId(task.id)} />}
                  <button type="button" className="mindmap-button" onClick={() => setEditTaskId(linkedTask.id)}>{linkedSubTask ? t.mindmap_openParentTask : t.mindmap_openTask}</button>
                  <p className="mindmap-note">{t.mindmap_linkedHint}</p>
                </> : <p className="mindmap-note">{t.mindmap_taskMissing}</p>}
                {!selectedNode.subTaskId && <button type="button" className="mindmap-button" onClick={() => run(() => useMindMapStore.getState().unlinkTask(activeMap.id, selectedNode.id))}>{t.mindmap_unlink}</button>}
              </> : <div className="mindmap-node-actions">
                <button type="button" className="mindmap-button mindmap-primary" data-mindmap-convert onClick={() => run(() => useMindMapStore.getState().convertNodeToTask(activeMap.id, selectedNode.id))}>{t.mindmap_convertTask}</button>
                <button type="button" className="mindmap-button" data-mindmap-link onClick={() => setShowTaskSearch(value => !value)} aria-expanded={showTaskSearch}>{t.mindmap_linkTask}</button>
              </div>}
              {showTaskSearch && !selectedNode.taskId && <div className="mindmap-task-picker">
                <input className="mindmap-input" type="search" autoFocus value={query} placeholder={t.mindmap_searchTask} aria-label={t.mindmap_searchTask} onChange={event => setQuery(event.target.value)} />
                <div className="mindmap-task-results">{availableTasks.length ? availableTasks.map(task => <button key={task.id} type="button" data-mindmap-link-task={task.id} className="mindmap-task-result" onClick={() => {
                  if (run(() => useMindMapStore.getState().linkTask(activeMap.id, selectedNode.id, task.id))) setShowTaskSearch(false)
                }}><span>{task.title}</span><small>{statusLabel(task.status)}</small></button>) : <p className="mindmap-note">{t.mindmap_noTasks}</p>}</div>
              </div>}
            </div>
            {selectedNode.id !== activeMap.root.id && <div className="mindmap-delete-section">
              <button type="button" className="mindmap-button mindmap-danger" data-mindmap-delete-node onClick={() => setDialog({ kind: 'delete-node', nodeId: selectedNode.id })}>{t.mindmap_deleteNode}</button>
              <p className="mindmap-note">{t.mindmap_taskPreserved}</p>
            </div>}
          </> : <p className="mindmap-note">{t.mindmap_pickNode}</p>}
        </aside>
      </div>
    </>}
    {dialog && <div className="mindmap-modal-backdrop" onClick={event => { if (event.target === event.currentTarget) setDialog(null) }} onKeyDown={event => { if (event.key === 'Escape') { event.stopPropagation(); setDialog(null) } }}>
      <div className="mindmap-modal" role="dialog" aria-modal="true" aria-label={'name' in dialog ? (dialog.kind === 'new' ? t.mindmap_new : t.mindmap_rename) : t.common_delete}>
        {'name' in dialog ? <form onSubmit={submitDialog}>
          <h2>{dialog.kind === 'new' ? t.mindmap_new : t.mindmap_rename}</h2>
          <label className="mindmap-label" htmlFor="mindmap-name">{t.mindmap_name}</label>
          <input id="mindmap-name" data-mindmap-name className="mindmap-input" autoFocus required maxLength={1000} value={dialog.name} onChange={event => setDialog({ ...dialog, name: event.target.value })} onKeyDown={event => { if (event.key === 'Enter' && (event.nativeEvent.isComposing || event.keyCode === 229)) event.preventDefault() }} />
          <div className="mindmap-dialog-actions"><button type="button" className="mindmap-button" onClick={() => setDialog(null)}>{t.common_cancel}</button><button type="submit" className="mindmap-button mindmap-primary" disabled={!dialog.name.trim()}>{t.common_save}</button></div>
        </form> : <>
          <h2>{dialog.kind === 'delete-map' ? t.mindmap_deleteMap : t.mindmap_deleteNode}</h2>
          <p>{dialog.kind === 'delete-map' ? t.mindmap_deleteConfirm : t.mindmap_deleteNodeConfirm}</p>
          <div className="mindmap-dialog-actions"><button type="button" className="mindmap-button" autoFocus onClick={() => setDialog(null)}>{t.common_cancel}</button><button type="button" className="mindmap-button mindmap-danger" onClick={() => {
            const saved = dialog.kind === 'delete-map' ? run(() => activeMap && useMindMapStore.getState().deleteMap(activeMap.id)) : dialog.nodeId && removeNode(dialog.nodeId)
            if (saved) setDialog(null)
          }}>{t.common_delete}</button></div>
        </>}
      </div>
    </div>}
    <TaskDrawer open={!!editTask} editTask={editTask} onClose={() => setEditTaskId(null)} />
  </section>
}

function findParent(root: MindMapNode, id: string): MindMapNode | null {
  if (root.children?.some(node => node.id === id)) return root
  for (const child of root.children ?? []) { const found = findParent(child, id); if (found) return found }
  return null
}

function hasTaskReference(node: MindMapNode): boolean {
  return !!node.taskId || !!node.children?.some(hasTaskReference)
}
