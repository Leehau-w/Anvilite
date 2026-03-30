import React from 'react'

const DEFAULT_CATEGORIES = ['家园', '竞技场', '藏书阁', '灵感工坊', '锻造坊', '其他']

interface CategorySelectProps {
  value: string
  onChange: (v: string) => void
  categories?: string[]
}

export function CategorySelect({ value, onChange, categories = DEFAULT_CATEGORIES }: CategorySelectProps) {
  return (
    <div className="flex flex-wrap gap-1">
      {categories.map((cat) => {
        const isActive = value === cat
        return (
          <button
            key={cat}
            type="button"
            onClick={() => onChange(cat)}
            style={{
              fontSize: 12,
              letterSpacing: '0.03em',
              padding: '5px 12px',
              borderRadius: 'var(--radius-md)',
              border: `1px solid ${isActive ? 'var(--color-accent)' : 'var(--color-border)'}`,
              background: isActive
                ? 'color-mix(in srgb, var(--color-accent) 12%, transparent)'
                : 'transparent',
              color: isActive ? 'var(--color-accent)' : 'var(--color-text-dim)',
              cursor: 'pointer',
              transition: 'all 0.15s',
              fontWeight: isActive ? 500 : 400,
            }}
          >
            {cat}
          </button>
        )
      })}
    </div>
  )
}
