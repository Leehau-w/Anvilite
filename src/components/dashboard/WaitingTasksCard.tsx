import React, { useEffect, useMemo, useState } from 'react'
import { useTaskStore } from '@/stores/taskStore'
import { TaskItem } from '@/components/tasks/TaskItem'
import { sortTasksInGroup } from '@/utils/task'
import { isTaskDrag, takeDraggedTask } from '@/utils/taskDrag'
import { useT } from '@/i18n'
import type { Task } from '@/types/task'

interface WaitingTasksCardProps {
  onEdit?: (task: Task) => void
  layoutEditing?: boolean
}

export function WaitingTasksCard({ onEdit, layoutEditing = false }: WaitingTasksCardProps) {
  const tasks = useTaskStore(s => s.tasks)
  const waitTask = useTaskStore(s => s.waitTask)
  const waiting = useMemo(() => sortTasksInGroup(tasks.filter(task =>
    task.status === 'waiting' && !task.deletedAt && !task.isHidden)), [tasks])
  const [dropActive, setDropActive] = useState(false)
  const t = useT()

  useEffect(() => {
    if (layoutEditing) setDropActive(false)
  }, [layoutEditing])

  useEffect(() => {
    const clear = () => setDropActive(false)
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') clear() }
    window.addEventListener('dragend', clear)
    window.addEventListener('blur', clear)
    window.addEventListener('keydown', escape)
    return () => {
      window.removeEventListener('dragend', clear)
      window.removeEventListener('blur', clear)
      window.removeEventListener('keydown', escape)
    }
  }, [])

  function dragOver(event: React.DragEvent<HTMLDivElement>) {
    if (layoutEditing || !isTaskDrag(event)) return
    event.preventDefault()
    event.stopPropagation()
    event.dataTransfer.dropEffect = 'move'
    setDropActive(true)
  }

  function drop(event: React.DragEvent<HTMLDivElement>) {
    setDropActive(false)
    if (layoutEditing || !isTaskDrag(event)) return
    event.preventDefault()
    event.stopPropagation()
    const id = takeDraggedTask(event)
    if (id) waitTask(id)
  }

  return (
    <div
      data-testid="waiting-tasks-card"
      data-task-drop-target="waiting"
      data-drop-active={dropActive && !layoutEditing ? 'true' : 'false'}
      aria-label={t.card_waiting}
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
      {dropActive && !layoutEditing && (
        <div role="status" style={{ flexShrink: 0, fontSize: 11, lineHeight: 1.5, marginBottom: 6,
          color: dropActive ? 'var(--color-accent)' : 'var(--color-text-dim)' }}>
          {t.dashboard_waitingDropActive}
        </div>
      )}
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', scrollbarWidth: 'thin',
        scrollbarColor: 'var(--color-border) transparent' }}>
        {waiting.length ? waiting.map(task => (
          <div key={task.id} data-waiting-task-id={task.id}>
            <TaskItem task={task} compact onEdit={onEdit} />
          </div>
        )) : (
          <div style={{ padding: '16px 4px', textAlign: 'center', fontSize: 12, color: 'var(--color-text-dim)' }}>
            {t.dashboard_waitingEmpty}
          </div>
        )}
      </div>
    </div>
  )
}
