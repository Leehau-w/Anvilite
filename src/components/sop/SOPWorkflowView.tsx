import React from 'react'
import type { SOPStep } from '@/types/sop'

interface Props {
  steps: SOPStep[]
  executionMode?: boolean
  checkedIds?: Set<string>
  onToggle?: (stepId: string) => void
}

export function SOPWorkflowView({ steps, executionMode = false, checkedIds = new Set(), onToggle }: Props) {
  const sorted = [...steps].sort((a, b) => a.sortOrder - b.sortOrder)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {sorted.map((step, idx) => {
        const checked = executionMode && checkedIds.has(step.id)
        return (
          <div
            key={step.id}
            style={{
              display: 'flex',
              gap: 12,
              opacity: checked ? 0.5 : 1,
              transition: 'opacity 0.15s',
            }}
          >
            {/* 序号圆圈 / 执行模式下变 checkbox */}
            {executionMode ? (
              <div style={{ flexShrink: 0, width: 28, display: 'flex', alignItems: 'flex-start', paddingTop: 3 }}>
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => onToggle?.(step.id)}
                  style={{ cursor: 'pointer', width: 16, height: 16, accentColor: 'var(--color-accent)' }}
                />
              </div>
            ) : (
              <div
                style={{
                  flexShrink: 0,
                  width: 28,
                  height: 28,
                  borderRadius: 'var(--radius-full)',
                  background: 'color-mix(in srgb, var(--color-accent) 12%, transparent)',
                  color: 'var(--color-accent)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 13,
                  fontWeight: 600,
                }}
              >
                {idx + 1}
              </div>
            )}

            <div style={{ flex: 1 }}>
              <div
                style={{
                  fontWeight: 500,
                  fontSize: 14,
                  color: checked ? 'var(--color-text-dim)' : 'var(--color-text)',
                  textDecoration: checked ? 'line-through' : 'none',
                  lineHeight: 1.75,
                }}
              >
                {!executionMode && <span style={{ color: 'var(--color-text-dim)', marginRight: 6 }}>{idx + 1}.</span>}
                {step.title}
              </div>

              {!checked && step.note && (
                <div style={{ fontSize: 13, color: 'var(--color-text-dim)', marginTop: 4 }}>
                  💡 {step.note}
                </div>
              )}
              {!checked && step.warning && (
                <div style={{ fontSize: 13, color: 'var(--color-warning)', marginTop: 4 }}>
                  ⚠️ {step.warning}
                </div>
              )}

              {/* 子步骤 */}
              {!checked && step.childSteps.length > 0 && (
                <div style={{ marginLeft: 16, marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {[...step.childSteps]
                    .sort((a, b) => a.sortOrder - b.sortOrder)
                    .map((child, ci) => (
                      <div key={child.id} style={{ fontSize: 13, color: 'var(--color-text-dim)' }}>
                        {idx + 1}.{ci + 1}　{child.title}
                      </div>
                    ))}
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
