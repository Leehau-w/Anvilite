import React from 'react'
import type { TaskPriority } from '@/types/task'

const PRIORITY_CONFIG: Record<TaskPriority, { label: string; color: string }> = {
  urgent: { label: '紧急', color: '#dc2626' },
  high: { label: '高', color: 'var(--color-accent)' },
  medium: { label: '中', color: 'var(--color-text-dim)' },
  low: { label: '低', color: 'var(--color-border)' },
}

interface PriorityBadgeProps {
  priority: TaskPriority
  compact?: boolean
}

export function PriorityBadge({ priority, compact }: PriorityBadgeProps) {
  const config = PRIORITY_CONFIG[priority]
  if (priority === 'medium' && !compact) return null
  return (
    <span
      style={{
        fontSize: 11,
        fontWeight: 500,
        color: config.color,
        letterSpacing: '0.02em',
        whiteSpace: 'nowrap',
      }}
    >
      {compact ? config.label[0] : config.label}
    </span>
  )
}

export function PriorityDot({ priority }: { priority: TaskPriority }) {
  const config = PRIORITY_CONFIG[priority]
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
