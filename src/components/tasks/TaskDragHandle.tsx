import type { Task } from '@/types/task'
import { useT } from '@/i18n'
import { beginTaskDrag, endTaskDrag } from '@/utils/taskDrag'

/** Native dragging is confined to this grip so list sorting and child editing keep their own gestures. */
export function TaskDragHandle({ task, compact }: { task: Task; compact?: boolean }) {
  const t = useT()
  if (task.deletedAt || task.isHidden || !['todo', 'doing', 'waiting'].includes(task.status)) return null
  return (
    <button type="button" draggable title={t.task_dragToWaiting} aria-label={t.task_dragToWaiting}
      onPointerDown={(event) => event.stopPropagation()}
      onDragStart={(event) => { event.stopPropagation(); beginTaskDrag(event, task.id) }}
      onDragEnd={(event) => { event.stopPropagation(); endTaskDrag() }}
      onClick={(event) => event.stopPropagation()}
      style={{ width: compact ? 14 : 16, height: 22, flexShrink: 0, padding: 0,
        border: 'none', background: 'transparent', color: 'var(--color-text-dim)', cursor: 'grab', touchAction: 'none' }}>
      ⠿
    </button>
  )
}
