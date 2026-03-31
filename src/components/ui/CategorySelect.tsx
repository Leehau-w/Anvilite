import React from 'react'
import { useT } from '@/i18n'
import { useAreaStore } from '@/stores/areaStore'
import { getAreaDisplayName, categoryDisplay } from '@/utils/area'

const DEFAULT_CATEGORIES = ['home', 'arena', 'library', 'workshop', 'forge', 'other']

interface CategorySelectProps {
  value: string
  onChange: (v: string) => void
  categories?: string[]
}

export function CategorySelect({ value, onChange, categories = DEFAULT_CATEGORIES }: CategorySelectProps) {
  const t = useT()
  const areas = useAreaStore((s) => s.areas)

  function label(cat: string): string {
    const area = areas.find((a) => a.category === cat)
    if (area) return getAreaDisplayName(area, t)
    return categoryDisplay(cat, t)
  }

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
            {label(cat)}
          </button>
        )
      })}
    </div>
  )
}
