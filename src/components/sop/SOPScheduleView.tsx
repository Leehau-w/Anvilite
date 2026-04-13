import React from 'react'
import type { SOPStep } from '@/types/sop'

interface Props {
  steps: SOPStep[]
}

export function SOPScheduleView({ steps }: Props) {
  const sorted = [...steps].sort((a, b) => {
    if (a.time && b.time) return a.time.localeCompare(b.time)
    if (a.time) return -1
    if (b.time) return 1
    return a.sortOrder - b.sortOrder
  })

  return (
    <div style={{ position: 'relative', paddingLeft: 32 }}>
      {/* 左侧时间轴竖线 */}
      <div
        style={{
          position: 'absolute',
          left: 12,
          top: 6,
          bottom: 6,
          width: 2,
          background: 'var(--color-border)',
        }}
      />

      {sorted.map((step) => (
        <div key={step.id} style={{ position: 'relative', display: 'flex', gap: 16, marginBottom: 24 }}>
          {/* 时间轴节点 */}
          <div
            style={{
              position: 'absolute',
              left: -22,
              width: 10,
              height: 10,
              borderRadius: '50%',
              background: 'var(--color-accent)',
              border: '2px solid var(--color-bg)',
              marginTop: 4,
              flexShrink: 0,
            }}
          />

          {/* 时间点 */}
          <div
            style={{
              width: 48,
              flexShrink: 0,
              fontSize: 13,
              fontWeight: 600,
              fontVariantNumeric: 'tabular-nums',
              color: 'var(--color-accent)',
              lineHeight: '20px',
            }}
          >
            {step.time ?? '--:--'}
          </div>

          {/* 内容 */}
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, color: 'var(--color-text)', lineHeight: '20px' }}>
              {step.title}
            </div>
            {step.note && (
              <div style={{ fontSize: 12, color: 'var(--color-text-dim)', marginTop: 4 }}>
                💡 {step.note}
              </div>
            )}
            {step.warning && (
              <div style={{ fontSize: 12, color: 'var(--color-warning)', marginTop: 4 }}>
                ⚠️ {step.warning}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
