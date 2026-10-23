import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { motion, Reorder, useDragControls, useMotionValue } from 'framer-motion'
import { useTaskStore } from '@/stores/taskStore'
import { TaskItem } from '@/components/tasks/TaskItem'
import { sortTasksInGroup } from '@/utils/task'
import { isTaskDrag, takeDraggedTask } from '@/utils/taskDrag'
import { useT } from '@/i18n'
import type { Task } from '@/types/task'
import type { TaskCardFilter, WaitingCardId } from '@/stores/dashboardStore'
import { matchesTaskCardFilter } from './TaskCard'

interface WaitingTasksCardProps {
  cardId?: WaitingCardId
  filter?: TaskCardFilter
  onEdit?: (task: Task) => void
  layoutEditing?: boolean
}

export function WaitingTasksCard({ cardId = 'waiting', filter, onEdit, layoutEditing = false }: WaitingTasksCardProps) {
  const tasks = useTaskStore(s => s.tasks)
  const waitTask = useTaskStore(s => s.waitTask)
  const waiting = useMemo(() => sortTasksInGroup(tasks.filter(task =>
    task.status === 'waiting' && matchesTaskCardFilter(task, filter))), [tasks, filter])
  const [localOrder, setLocalOrder] = useState(() => waiting.map(task => task.id))
  const orderRef = useRef(localOrder)
  const dragging = useRef(false)
  const dragSource = useRef<string | null>(null)
  const filterRef = useRef(filter)
  const editingRef = useRef(layoutEditing)
  const [cancelEpoch, setCancelEpoch] = useState(0)
  const [nativeSortId, setNativeSortId] = useState<string | null>(null)
  filterRef.current = filter
  editingRef.current = layoutEditing
  const [dropActive, setDropActive] = useState(false)
  const [dropMismatch, setDropMismatch] = useState(false)
  const t = useT()

  const syncOrder = useCallback(() => {
    const ids = sortTasksInGroup(useTaskStore.getState().tasks.filter(task =>
      task.status === 'waiting' && matchesTaskCardFilter(task, filterRef.current))).map(task => task.id)
    orderRef.current = ids
    setLocalOrder(ids)
  }, [])

  const cancelSort = useCallback(() => {
    dragging.current = false
    dragSource.current = null
    setCancelEpoch(value => value + 1)
    syncOrder()
  }, [syncOrder])

  useEffect(() => {
    if (dragging.current) {
      if (dragSource.current && !waiting.some(task => task.id === dragSource.current)) cancelSort()
      return
    }
    const ids = waiting.map(task => task.id)
    orderRef.current = ids
    setLocalOrder(ids)
  }, [waiting, cancelSort])

  const filterKey = JSON.stringify(filter ?? { mode: 'all' })
  useEffect(() => {
    cancelSort()
    setDropMismatch(false)
    setDropActive(false)
    setNativeSortId(null)
  }, [layoutEditing, filterKey, cancelSort])

  useEffect(() => {
    const clear = () => { setDropActive(false); setNativeSortId(null) }
    const cancel = () => { clear(); cancelSort() }
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') cancel() }
    window.addEventListener('dragend', clear, true)
    window.addEventListener('blur', cancel)
    // Starting a native HTML5 grip drag also emits pointercancel. Keep its
    // source marker until drop/dragend so internal sorting cannot shift the rows.
    window.addEventListener('pointercancel', cancelSort)
    window.addEventListener('keydown', escape)
    return () => {
      dragging.current = false
      dragSource.current = null
      window.removeEventListener('dragend', clear, true)
      window.removeEventListener('blur', cancel)
      window.removeEventListener('pointercancel', cancelSort)
      window.removeEventListener('keydown', escape)
    }
  }, [cancelSort])

  // Both pointer sorting and the existing native grip update only this filter's
  // slots. Read the latest records so other cards and task actions cannot be overwritten.
  const commitOrder = useCallback((requested: string[]) => {
    if (editingRef.current) { cancelSort(); return }
    const store = useTaskStore.getState()
    const allCurrent = sortTasksInGroup(store.tasks.filter(task => task.status === 'waiting' && !task.deletedAt && !task.isHidden))
    const current = allCurrent.filter(task => matchesTaskCardFilter(task, filterRef.current))
    const currentIds = new Set(current.map(task => task.id))
    const ordered = [...new Set(requested.filter(id => currentIds.has(id)))]
    const included = new Set(ordered)
    for (const task of current) if (!included.has(task.id)) ordered.push(task.id)
    let cursor = 0
    const merged = allCurrent.map(task => currentIds.has(task.id) ? ordered[cursor++] : task.id)
    try {
      if (merged.some((id, index) => id !== allCurrent[index].id)) store.reorderTasks(merged)
    } finally {
      dragging.current = false
      dragSource.current = null
      syncOrder()
    }
  }, [cancelSort, syncOrder])

  const reorder = useCallback((ids: string[]) => {
    if (editingRef.current) return
    dragging.current = true
    orderRef.current = ids
    setLocalOrder(ids)
  }, [])

  const finishReorder = useCallback(() => {
    if (dragging.current) commitOrder(orderRef.current)
  }, [commitOrder])

  const currentById = new Map(waiting.map(task => [task.id, task]))
  const displayed = localOrder.flatMap(id => {
    const task = currentById.get(id)
    currentById.delete(id)
    return task ? [task] : []
  }).concat([...currentById.values()])

  function dragOver(event: React.DragEvent<HTMLDivElement>) {
    if (layoutEditing || !isTaskDrag(event)) return
    event.preventDefault()
    event.stopPropagation()
    event.dataTransfer.dropEffect = 'move'
    setDropMismatch(false)
    setDropActive(true)
  }

  function drop(event: React.DragEvent<HTMLDivElement>) {
    setDropActive(false)
    setNativeSortId(null)
    if (layoutEditing || !isTaskDrag(event)) return
    event.preventDefault()
    event.stopPropagation()
    const id = takeDraggedTask(event)
    if (!id) return
    // Re-read the record at drop time; a different card may have edited it mid-gesture.
    const task = useTaskStore.getState().tasks.find(item => item.id === id)
    if (!task || (task.status !== 'todo' && task.status !== 'doing' && task.status !== 'waiting') || task.deletedAt || task.isHidden) return
    if (!matchesTaskCardFilter(task, filter)) {
      setDropMismatch(true)
      return
    }
    setDropMismatch(false)
    if (task.status === 'waiting') {
      const current = sortTasksInGroup(useTaskStore.getState().tasks.filter(item =>
        item.status === 'waiting' && matchesTaskCardFilter(item, filterRef.current)))
      const target = (event.target as Element).closest<HTMLElement>('[data-waiting-task-id]')
      const targetId = target?.getAttribute('data-waiting-task-id')
      if (targetId === id) return
      const ids = current.map(item => item.id).filter(taskId => taskId !== id)
      const targetIndex = targetId ? ids.indexOf(targetId) : -1
      const after = target ? event.clientY >= target.getBoundingClientRect().top + target.getBoundingClientRect().height / 2 : true
      ids.splice(targetIndex < 0 ? ids.length : targetIndex + (after ? 1 : 0), 0, id)
      commitOrder(ids)
    } else {
      waitTask(id)
    }
  }

  return (
    <div
      data-testid="waiting-tasks-card"
      data-task-drop-target="waiting"
      data-waiting-card-id={cardId}
      data-drop-active={dropActive && !layoutEditing ? 'true' : 'false'}
      aria-label={t.card_waiting}
      onDragStartCapture={(event) => {
        const source = (event.target as Element).closest('[data-waiting-task-id]')
        if (!source) return
        cancelSort()
        setNativeSortId(source.getAttribute('data-waiting-task-id'))
      }}
      onDragEnter={dragOver}
      onDragOver={dragOver}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDropActive(false)
      }}
      onDrop={drop}
      style={{ height: '100%', minHeight: 0, display: 'flex', flexDirection: 'column',
        borderRadius: 'var(--radius-md)', border: `1px dashed ${dropActive ? 'var(--color-accent)' : 'var(--color-border)'}`,
        background: dropActive ? 'color-mix(in srgb, var(--color-accent) 8%, transparent)' : 'transparent',
        padding: 8, boxSizing: 'border-box', transition: 'border-color 0.15s, background 0.15s' }}
    >
      {dropActive && !layoutEditing && !nativeSortId && (
        <div role="status" style={{ flexShrink: 0, fontSize: 11, lineHeight: 1.5, marginBottom: 6,
          color: dropActive ? 'var(--color-accent)' : 'var(--color-text-dim)' }}>
          {t.dashboard_waitingDropActive}
        </div>
      )}
      {dropMismatch && (
        <div role="status" data-waiting-drop-mismatch style={{ flexShrink: 0, fontSize: 11, lineHeight: 1.5, marginBottom: 6, color: 'var(--color-danger)' }}>
          {t.dashboard_waitingCategoryMismatch}
        </div>
      )}
      <motion.div layoutScroll style={{ flex: 1, minHeight: 0, overflowY: 'auto', scrollbarWidth: 'thin',
        scrollbarColor: 'var(--color-border) transparent' }}>
        {displayed.length ? (
          <Reorder.Group axis="y" values={displayed.map(task => task.id)} onReorder={reorder}
            data-waiting-sort-group={cardId} style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {displayed.map(task => (
              <WaitingTaskRow key={task.id} task={task} onEdit={onEdit} layoutEditing={layoutEditing}
                cancelEpoch={cancelEpoch} onSortStart={() => {
                  if (!editingRef.current) { dragging.current = true; dragSource.current = task.id }
                }} onSortEnd={finishReorder} />
            ))}
          </Reorder.Group>
        ) : (
          <div style={{ padding: '16px 4px', textAlign: 'center', fontSize: 12, color: 'var(--color-text-dim)' }}>
            {t.dashboard_waitingEmpty}
          </div>
        )}
      </motion.div>
    </div>
  )
}

function WaitingTaskRow({ task, onEdit, layoutEditing, cancelEpoch, onSortStart, onSortEnd }: {
  task: Task
  onEdit?: (task: Task) => void
  layoutEditing: boolean
  cancelEpoch: number
  onSortStart: () => void
  onSortEnd: () => void
}) {
  const controls = useDragControls()
  const y = useMotionValue(0)
  const suppressClick = useRef(false)
  const clickTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    controls.cancel()
    // cancel() releases the drag lock but does not run Reorder's snap-to-origin.
    y.stop()
    y.set(0)
    suppressClick.current = false
  }, [controls, y, cancelEpoch])
  useEffect(() => () => {
    controls.cancel()
    y.stop()
    if (clickTimer.current) clearTimeout(clickTimer.current)
  }, [controls, y])
  return <Reorder.Item value={task.id} dragListener={false} dragControls={controls}
    data-waiting-task-id={task.id} data-waiting-sort-enabled={layoutEditing ? 'false' : 'true'}
    onPointerDown={(event) => {
      if (layoutEditing || event.button !== 0 || (event.target as Element).closest('button,input,textarea,select,a,[contenteditable="true"]')) return
      controls.start(event)
    }}
    onDragStart={() => {
      if (clickTimer.current) clearTimeout(clickTimer.current)
      suppressClick.current = true
      onSortStart()
    }}
    onDragEnd={() => {
      onSortEnd()
      clickTimer.current = setTimeout(() => { suppressClick.current = false }, 0)
    }}
    onClickCapture={(event) => {
      if (suppressClick.current) { event.preventDefault(); event.stopPropagation() }
    }}
    style={{ y, listStyle: 'none', position: 'relative', touchAction: layoutEditing ? 'auto' : 'none' }}>
    <TaskItem task={task} compact onEdit={onEdit} />
  </Reorder.Item>
}
