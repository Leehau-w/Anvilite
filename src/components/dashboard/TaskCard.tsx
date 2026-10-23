import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, Reorder } from 'framer-motion'
import { useTaskStore } from '@/stores/taskStore'
import { useT } from '@/i18n'
import { TaskItem } from '@/components/tasks/TaskItem'
import { CollapsibleGroup } from '@/components/ui/CollapsibleGroup'
import { sortTasksInGroup } from '@/utils/task'
import { getTodayString, isSameLocalDate } from '@/utils/time'
import type { Task } from '@/types/task'
import type { CardId, TaskCardFilter } from '@/stores/dashboardStore'

export function matchesTaskCardFilter(task: Task, filter?: TaskCardFilter): boolean {
  if (task.deletedAt || task.isHidden) return false
  if (!filter || filter.mode === 'all') return true
  return filter.mode === 'single' ? task.category === filter.categories[0] : filter.categories.includes(task.category)
}

interface TaskCardProps {
  cardId: CardId
  filter?: TaskCardFilter
  onEdit: (task: Task) => void
}

export function TaskCard({ cardId, filter, onEdit }: TaskCardProps) {
  const tasks = useTaskStore(s => s.tasks)
  const t = useT()
  const visible = useMemo(() => tasks.filter(task => matchesTaskCardFilter(task, filter)), [tasks, filter])
  const doing = useMemo(() => sortTasksInGroup(visible.filter(task => task.status === 'doing')), [visible])
  const todo = useMemo(() => sortTasksInGroup(visible.filter(task => task.status === 'todo')), [visible])
  const done = useMemo(() => visible.filter(task => task.status === 'done' && isSameLocalDate(task.completedAt, getTodayString())).slice(0, 8), [visible])
  const [localDoing, setLocalDoing] = useState(doing)
  const [localTodo, setLocalTodo] = useState(todo)
  const dragging = useRef(false)
  const orderRef = useRef({ doing, todo })
  const filterRef = useRef(filter)
  filterRef.current = filter

  useEffect(() => {
    if (dragging.current) return
    orderRef.current = { doing, todo }
    setLocalDoing(doing)
    setLocalTodo(todo)
  }, [doing, todo])

  const reorder = useCallback((status: 'doing' | 'todo', newOrder: Task[]) => {
    dragging.current = true
    orderRef.current[status] = newOrder
    if (status === 'doing') setLocalDoing(newOrder)
    else setLocalTodo(newOrder)
  }, [])

  const finishReorder = useCallback((status: 'doing' | 'todo') => {
    dragging.current = false
    // Another card or a task action may have changed the store during the gesture.
    // Re-read the current status group before filling this card's filter slots.
    const store = useTaskStore.getState()
    const allCurrent = sortTasksInGroup(store.tasks.filter(task => task.status === status && !task.deletedAt && !task.isHidden))
    const current = allCurrent.filter(task => matchesTaskCardFilter(task, filterRef.current))
    const currentIds = new Set(current.map(task => task.id))
    const orderedIds = orderRef.current[status].map(task => task.id).filter(id => currentIds.has(id))
    const included = new Set(orderedIds)
    for (const task of current) if (!included.has(task.id)) orderedIds.push(task.id)
    if (orderedIds.length) {
      // Replace only this filter's slots in the full status group. Interleaved
      // tasks from other categories must keep their existing positions.
      let cursor = 0
      const merged = allCurrent.map(task => currentIds.has(task.id) ? orderedIds[cursor++] : task.id)
      store.reorderTasks(merged)
    }
    const latest = useTaskStore.getState().tasks.filter(task => matchesTaskCardFilter(task, filterRef.current))
    const next = {
      doing: sortTasksInGroup(latest.filter(task => task.status === 'doing')),
      todo: sortTasksInGroup(latest.filter(task => task.status === 'todo')),
    }
    orderRef.current = next
    setLocalDoing(next.doing)
    setLocalTodo(next.todo)
  }, [])

  function mergeCurrent(local: Task[], current: Task[]) {
    const remaining = new Map(current.map(task => [task.id, task]))
    const ordered: Task[] = []
    for (const task of local) {
      const updated = remaining.get(task.id)
      if (updated) { ordered.push(updated); remaining.delete(task.id) }
    }
    return [...ordered, ...remaining.values()]
  }
  const displayedDoing = mergeCurrent(localDoing, doing)
  const displayedTodo = mergeCurrent(localTodo, todo)

  function group(status: 'doing' | 'todo', items: Task[]) {
    return <Reorder.Group axis="y" values={items} onReorder={newOrder => reorder(status, newOrder)} data-task-card-group={`${cardId}:${status}`} style={{ listStyle: 'none', padding: 0, margin: 0 }}>
      <AnimatePresence mode="popLayout">
        {items.map(task => <Reorder.Item key={task.id} value={task} onDragEnd={() => finishReorder(status)} style={{ listStyle: 'none' }}>
          <TaskItem task={task} compact onEdit={onEdit} />
        </Reorder.Item>)}
      </AnimatePresence>
    </Reorder.Group>
  }

  return <div style={{ overflowY: 'auto', height: '100%', scrollbarWidth: 'thin', scrollbarColor: 'var(--color-border) transparent' }}>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {displayedDoing.length > 0 && <>
        <SectionLabel label={t.dash_doing} color="var(--color-accent)" />
        {group('doing', displayedDoing)}
      </>}
      {displayedTodo.length > 0 && <>
        {displayedDoing.length > 0 && <div style={{ height: 4 }} />}
        <SectionLabel label={t.dash_todo} />
        {group('todo', displayedTodo)}
      </>}
      {done.length > 0 && <>
        <div style={{ height: 4, borderTop: '1px solid var(--color-border)', marginTop: 4 }} />
        <CollapsibleGroup label={t.dashboard_todayCompleted} count={done.length} defaultOpen>
          <AnimatePresence mode="popLayout">
            {done.map(task => <TaskItem key={task.id} task={task} compact onEdit={onEdit} />)}
          </AnimatePresence>
        </CollapsibleGroup>
      </>}
      {displayedDoing.length === 0 && displayedTodo.length === 0 && done.length === 0 && <div style={{ textAlign: 'center', padding: '16px 0', fontSize: 12, color: 'var(--color-text-dim)' }}>{t.dash_empty}</div>}
    </div>
  </div>
}

function SectionLabel({ label, color }: { label: string; color?: string }) {
  return <div style={{ fontSize: 11, fontWeight: 600, color: color ?? 'var(--color-text)', letterSpacing: '0.03em', marginBottom: 2 }}>{label}</div>
}
