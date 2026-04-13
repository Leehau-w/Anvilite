import React from 'react'
import type { SOPStep } from '@/types/sop'

interface Props {
  steps: SOPStep[]
}

export function SOPItemListView({ steps }: Props) {
  const sorted = [...steps].sort((a, b) => a.sortOrder - b.sortOrder)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {sorted.map((step) => (
        <div
          key={step.id}
          style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', fontSize: 14 }}
        >
          <span style={{ color: 'var(--color-text-dim)', fontSize: 16, lineHeight: 1 }}>•</span>
          <span style={{ color: 'var(--color-text)' }}>{step.title}</span>
        </div>
      ))}
    </div>
  )
}
