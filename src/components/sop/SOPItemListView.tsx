import React from 'react'
import type { SOPStep } from '@/types/sop'

interface Props {
  steps: SOPStep[]
  executionMode?: boolean
  checkedIds?: Set<string>
  onToggle?: (stepId: string) => void
}

export function SOPItemListView({ steps, executionMode = false, checkedIds = new Set(), onToggle }: Props) {
  const sorted = [...steps].sort((a, b) => a.sortOrder - b.sortOrder)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {sorted.map((step) => {
        const checked = executionMode && checkedIds.has(step.id)
        return (
          <div key={step.id}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '3px 0', fontSize: 14 }}>
              {executionMode ? (
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => onToggle?.(step.id)}
                  style={{ cursor: 'pointer', flexShrink: 0 }}
                />
              ) : (
                <span style={{ color: 'var(--color-text-dim)', fontSize: 16, lineHeight: 1, flexShrink: 0 }}>•</span>
              )}
              <span
                style={{
                  color: checked ? 'var(--color-text-dim)' : 'var(--color-text)',
                  textDecoration: checked ? 'line-through' : 'none',
                }}
              >
                {step.title}
              </span>
            </div>
            {step.note && (
              <div style={{ fontSize: 12, color: 'var(--color-text-dim)', marginLeft: executionMode ? 24 : 16, marginTop: 2 }}>
                💡 {step.note}
              </div>
            )}
            {step.warning && (
              <div style={{ fontSize: 12, color: 'var(--color-warning)', marginLeft: executionMode ? 24 : 16, marginTop: 2 }}>
                ⚠️ {step.warning}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
