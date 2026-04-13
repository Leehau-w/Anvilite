import React from 'react'
import type { SOPStep } from '@/types/sop'

interface Props {
  steps: SOPStep[]
  executionMode: boolean
  checkedIds: Set<string>
  onToggle: (stepId: string) => void
}

export function SOPChecklistView({ steps, executionMode, checkedIds, onToggle }: Props) {
  const sorted = [...steps].sort((a, b) => a.sortOrder - b.sortOrder)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {sorted.map((step, idx) => {
        const checked = executionMode && checkedIds.has(step.id)
        return (
          <div key={step.id}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
              {executionMode && (
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => onToggle(step.id)}
                  style={{ marginTop: 2, cursor: 'pointer', flexShrink: 0 }}
                />
              )}
              <span
                style={{
                  fontSize: 14,
                  fontWeight: 500,
                  color: checked ? 'var(--color-text-dim)' : 'var(--color-text)',
                  textDecoration: checked ? 'line-through' : 'none',
                  lineHeight: '20px',
                }}
              >
                {idx + 1}. {step.title}
              </span>
            </div>
            {step.warning && (
              <div style={{ fontSize: 12, color: 'var(--color-warning)', marginTop: 4, marginLeft: executionMode ? 24 : 0 }}>
                ⚠️ {step.warning}
              </div>
            )}
            {step.note && (
              <div style={{ fontSize: 12, color: 'var(--color-text-dim)', marginTop: 4, marginLeft: executionMode ? 24 : 0 }}>
                💡 {step.note}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
