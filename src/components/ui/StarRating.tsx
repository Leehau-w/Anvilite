import React from 'react'
import type { TaskDifficulty } from '@/types/task'
import { useT } from '@/i18n'

const DIFFICULTY_KEYS: Record<TaskDifficulty, 'difficulty_1' | 'difficulty_2' | 'difficulty_3' | 'difficulty_4' | 'difficulty_5'> = {
  1: 'difficulty_1',
  2: 'difficulty_2',
  3: 'difficulty_3',
  4: 'difficulty_4',
  5: 'difficulty_5',
}

interface StarRatingProps {
  value: TaskDifficulty
  onChange?: (v: TaskDifficulty) => void
  readonly?: boolean
}

export function StarRating({ value, onChange, readonly }: StarRatingProps) {
  const t = useT()
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
          {t[DIFFICULTY_KEYS[value]]}
        </span>
      )}
    </div>
  )
}
