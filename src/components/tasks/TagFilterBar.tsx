import React from 'react'
import { getTagColor } from '@/utils/tagColor'
import { useT } from '@/i18n'

interface TagFilterBarProps {
  tags: string[]
  selectedTags: string[]
  onToggle: (tag: string) => void
  onClear: () => void
}

export function TagFilterBar({ tags, selectedTags, onToggle, onClear }: TagFilterBarProps) {
  const t = useT()
  if (tags.length === 0) return null

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
      {tags.map((tag) => {
        const color = getTagColor(tag)
        const isSelected = selectedTags.includes(tag)
        return (
          <button
            key={tag}
            onClick={() => onToggle(tag)}
            style={{
              fontSize: 11,
              padding: '2px 10px',
              borderRadius: 'var(--radius-full)',
              border: `1px solid ${isSelected ? color : 'var(--color-border)'}`,
              background: isSelected
                ? `color-mix(in srgb, ${color} 15%, transparent)`
                : 'transparent',
              color: isSelected ? color : 'var(--color-text-dim)',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              transition: 'all 0.15s',
            }}
          >
            {tag}
          </button>
        )
      })}
      {selectedTags.length > 0 && (
        <button
          onClick={onClear}
          style={{
            fontSize: 11,
            padding: '2px 8px',
            borderRadius: 'var(--radius-full)',
            border: 'none',
            background: 'transparent',
            color: 'var(--color-text-dim)',
            cursor: 'pointer',
            textDecoration: 'underline',
          }}
        >
          {t.tag_clearFilter}
        </button>
      )}
    </div>
  )
}
