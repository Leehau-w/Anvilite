
import type { SOP } from '@/types/sop'
import { useT } from '@/i18n'
import { useSettingsStore } from '@/stores/settingsStore'
import { useSOPStore } from '@/stores/sopStore'
import { SOPStepListView } from './SOPStepListView'
import { formatRelativeTime } from '@/utils/formatRelativeTime'

function getDisplayStyleIcon(style: SOP['displayStyle']): string {
  const icons: Record<SOP['displayStyle'], string> = {
    numbered: '≡',
    bullet: '•',
    timeline: '⏰',
  }
  return icons[style]
}

function countAllSteps(sop: SOP): number {
  let count = 0
  function walk(steps: SOP['steps']) {
    for (const s of steps) {
      count++
      if (s.childSteps.length > 0) walk(s.childSteps)
    }
  }
  walk(sop.steps)
  return count
}

interface Props {
  sop: SOP
  executionMode: boolean
  checkedIds: Set<string>
  onToggle: (stepId: string) => void
}

export function SOPContent({ sop, executionMode, checkedIds, onToggle }: Props) {
  const t = useT()
  const lang = useSettingsStore((s) => s.settings.language)
  const setDisplayStyle = useSOPStore((s) => s.setDisplayStyle)

  const styleLabels: Record<SOP['displayStyle'], string> = {
    numbered: t.sop_style_numbered,
    bullet: t.sop_style_bullet,
    timeline: t.sop_style_timeline,
  }

  const totalStepCount = countAllSteps(sop)

  return (
    <div>
      {/* 标题区 */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--color-text)', margin: 0 }}>
            {sop.title}
          </h2>
          {sop.isSystem && (
            <span
              style={{
                fontSize: 11,
                padding: '2px 8px',
                borderRadius: 'var(--radius-full)',
                background: 'color-mix(in srgb, var(--color-accent) 12%, transparent)',
                color: 'var(--color-accent)',
                fontWeight: 600,
                letterSpacing: '0.03em',
              }}
            >
              {t.sop_systemBadge}
            </span>
          )}

          {/* 风格切换按钮组 */}
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 2 }}>
            {(['numbered', 'bullet', 'timeline'] as const).map((style) => (
              <button
                key={style}
                onClick={() => !sop.isSystem && setDisplayStyle(sop.id, style)}
                title={styleLabels[style]}
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 'var(--radius-sm)',
                  border: 'none',
                  background:
                    sop.displayStyle === style
                      ? 'color-mix(in srgb, var(--color-accent) 15%, transparent)'
                      : 'transparent',
                  color:
                    sop.displayStyle === style
                      ? 'var(--color-accent)'
                      : 'var(--color-text-dim)',
                  cursor: sop.isSystem ? 'default' : 'pointer',
                  fontSize: 14,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: sop.isSystem ? 0.5 : 1,
                }}
                disabled={sop.isSystem}
              >
                {getDisplayStyleIcon(style)}
              </button>
            ))}
          </div>
        </div>
        <div style={{ fontSize: 13, color: 'var(--color-text-dim)' }}>
          {getDisplayStyleIcon(sop.displayStyle)}{' '}
          {styleLabels[sop.displayStyle]}{' '}
          ·{' '}
          {sop.steps.length} {t.sop_steps}
          {executionMode && (
            <span style={{ marginLeft: 12, color: 'var(--color-accent)', fontWeight: 600 }}>
              {t.sop_progress(checkedIds.size, totalStepCount)}
            </span>
          )}
        </div>
      </div>

      {/* 统一内容视图 */}
      <SOPStepListView
        sop={sop}
        executionMode={executionMode}
        checkedIds={checkedIds}
        onToggle={onToggle}
      />

      {/* 最近转化时间 */}
      {sop.lastUsedAt && !executionMode && (
        <div style={{ fontSize: 12, color: 'var(--color-text-dim)', marginTop: 24 }}>
          {t.sop_lastUsed}: {formatRelativeTime(sop.lastUsedAt, lang)}
        </div>
      )}
    </div>
  )
}
