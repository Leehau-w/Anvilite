import React from 'react'
import type { SOPStep } from '@/types/sop'

interface Props {
  steps: SOPStep[]
}

export function SOPWorkflowView({ steps }: Props) {
  const sorted = [...steps].sort((a, b) => a.sortOrder - b.sortOrder)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {sorted.map((step, idx) => (
        <div key={step.id} style={{ display: 'flex', gap: 12 }}>
          {/* 序号圆圈 */}
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

          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 500, fontSize: 14, color: 'var(--color-text)', lineHeight: 1.75 }}>
              {step.title}
            </div>

            {step.note && (
              <div style={{ fontSize: 13, color: 'var(--color-text-dim)', marginTop: 4 }}>
                💡 {step.note}
              </div>
            )}
            {step.warning && (
              <div style={{ fontSize: 13, color: 'var(--color-warning)', marginTop: 4 }}>
                ⚠️ {step.warning}
              </div>
            )}

            {/* 子步骤 */}
            {step.childSteps.length > 0 && (
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
      ))}
    </div>
  )
}
