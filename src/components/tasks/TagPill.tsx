import React from 'react'
import { getTagColor } from '@/utils/tagColor'

interface TagPillProps {
  tag: string
  size?: 'sm' | 'md'
  onRemove?: () => void
}

export function TagPill({ tag, size = 'sm', onRemove }: TagPillProps) {
  const color = getTagColor(tag)

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        fontSize: size === 'sm' ? 11 : 12,
        padding: size === 'sm' ? '2px 8px' : '4px 12px',
        borderRadius: 'var(--radius-full)',
        background: `color-mix(in srgb, ${color} 15%, transparent)`,
        color,
        whiteSpace: 'nowrap',
        lineHeight: 1.3,
      }}
    >
      {tag}
      {onRemove && (
        <button
          onClick={(e) => { e.stopPropagation(); onRemove() }}
          style={{
            background: 'none',
            border: 'none',
            color,
            cursor: 'pointer',
            padding: 0,
            fontSize: size === 'sm' ? 11 : 13,
            lineHeight: 1,
            display: 'flex',
            alignItems: 'center',
          }}
        >
          ×
        </button>
      )}
    </span>
  )
}
