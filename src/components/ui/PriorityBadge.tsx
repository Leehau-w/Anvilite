
import type { TaskPriority } from '@/types/task'
import { useT } from '@/i18n'
import { TASK_PRIORITY_COLORS } from '@/utils/taskPriority'

const PRIORITY_COLORS = TASK_PRIORITY_COLORS

const PRIORITY_KEYS: Record<TaskPriority, 'priority_urgent' | 'priority_high' | 'priority_medium' | 'priority_low'> = {
  urgent: 'priority_urgent',
  high: 'priority_high',
  medium: 'priority_medium',
  low: 'priority_low',
}

interface PriorityBadgeProps {
  priority: TaskPriority
  compact?: boolean
}

export function PriorityBadge({ priority, compact }: PriorityBadgeProps) {
  const t = useT()
  const color = PRIORITY_COLORS[priority]
  const label = t[PRIORITY_KEYS[priority]]
  if (priority === 'medium' && !compact) return null
  return (
    <span
      style={{
        fontSize: 11,
        fontWeight: 500,
        color,
        letterSpacing: '0.02em',
        whiteSpace: 'nowrap',
      }}
    >
      {compact ? label[0] : label}
    </span>
  )
}

export function PriorityDot({ priority }: { priority: TaskPriority }) {
  const t = useT()
  if (priority === 'urgent') return <span style={{ color: PRIORITY_COLORS.urgent, fontSize: 11,
    fontWeight: 700, whiteSpace: 'nowrap', flexShrink: 0 }}>! {t.priority_urgent}</span>
  const config = { color: PRIORITY_COLORS[priority] }
  return (
    <span title={t[PRIORITY_KEYS[priority]]} aria-label={t[PRIORITY_KEYS[priority]]}
      style={{
        display: 'inline-block',
        width: 6,
        height: 6,
        borderRadius: '50%',
        background: config.color,
        flexShrink: 0,
      }}
    />
  )
}
