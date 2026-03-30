import React from 'react'
import type { TaskDifficulty } from '@/types/task'

const DIFFICULTY_LABELS: Record<TaskDifficulty, string> = {
  1: '轻松',
  2: '简单',
  3: '适中',
  4: '困难',
  5: '极难',
}

interface StarRatingProps {
  value: TaskDifficulty
  onChange?: (v: TaskDifficulty) => void
  readonly?: boolean
}

export function StarRating({ value, onChange, readonly }: StarRatingProps) {
  return (
    <div className="flex items-center gap-1">
      {([1, 2, 3, 4, 5] as TaskDifficulty[]).map((star) => (
        <button
          key={star}
          type="button"
          disabled={readonly}
          onClick={() => onChange?.(star)}
          style={{
            background: 'none',
            border: 'none',
            cursor: readonly ? 'default' : 'pointer',
            padding: 0,
            lineHeight: 1,
            fontSize: 14,
            color: star <= value ? 'var(--color-xp)' : 'var(--color-border)',
            transition: 'color 0.1s',
          }}
        >
          ★
        </button>
      ))}
      {!readonly && (
        <span style={{ fontSize: 11, color: 'var(--color-text-dim)', marginLeft: 4 }}>
          {DIFFICULTY_LABELS[value]}
        </span>
      )}
    </div>
  )
}
