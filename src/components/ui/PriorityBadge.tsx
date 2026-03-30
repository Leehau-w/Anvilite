import React from 'react'
import type { TaskPriority } from '@/types/task'
import { useT } from '@/i18n'

const PRIORITY_COLORS: Record<TaskPriority, string> = {
  urgent: '#dc2626',
  high: 'var(--color-accent)',
  medium: 'var(--color-text-dim)',
  low: 'var(--color-border)',
}

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
  const config = { color: PRIORITY_COLORS[priority] }
  return (
    <span
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
