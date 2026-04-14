import React from 'react'
import type { SOP } from '@/types/sop'
import { useT } from '@/i18n'
import { useSettingsStore } from '@/stores/settingsStore'
import { SOPWorkflowView } from './SOPWorkflowView'
import { SOPItemListView } from './SOPItemListView'
import { SOPScheduleView } from './SOPScheduleView'
import { SOPChecklistView } from './SOPChecklistView'
import { formatRelativeTime } from '@/utils/formatRelativeTime'

function getSOPTypeIcon(type: SOP['type']): string {
  const icons: Record<SOP['type'], string> = {
    schedule: '⏰',
    workflow: '🔄',
    checklist: '☑️',
    itemlist: '📝',
  }
  return icons[type]
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

  const typeLabels: Record<SOP['type'], string> = {
    schedule: t.sop_type_schedule,
    workflow: t.sop_type_workflow,
    checklist: t.sop_type_checklist,
    itemlist: t.sop_type_itemlist,
  }

  const doneCount = sop.steps.filter((s) => checkedIds.has(s.id)).length
  const totalCount = sop.steps.length

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
        </div>
        <div style={{ fontSize: 13, color: 'var(--color-text-dim)' }}>
          {getSOPTypeIcon(sop.type)}{' '}
          {typeLabels[sop.type]}{' '}
          ·{' '}
          {sop.steps.length} {t.sop_steps}
          {executionMode && (
            <span style={{ marginLeft: 12, color: 'var(--color-accent)', fontWeight: 600 }}>
              {t.sop_progress(doneCount, totalCount)}
            </span>
          )}
        </div>
      </div>

      {/* 内容视图 */}
      {sop.type === 'workflow' && (
        <SOPWorkflowView
          steps={sop.steps}
          executionMode={executionMode}
          checkedIds={checkedIds}
          onToggle={onToggle}
        />
      )}
      {sop.type === 'itemlist' && (
        <SOPItemListView
          steps={sop.steps}
          executionMode={executionMode}
          checkedIds={checkedIds}
          onToggle={onToggle}
        />
      )}
      {sop.type === 'schedule' && <SOPScheduleView steps={sop.steps} />}
      {sop.type === 'checklist' && (
        <SOPChecklistView
          steps={sop.steps}
          executionMode={executionMode}
          checkedIds={checkedIds}
          onToggle={onToggle}
        />
      )}

      {/* 最近转化时间 */}
      {sop.lastUsedAt && !executionMode && (
        <div style={{ fontSize: 12, color: 'var(--color-text-dim)', marginTop: 24 }}>
          {t.sop_lastUsed}: {formatRelativeTime(sop.lastUsedAt, lang)}
        </div>
      )}
    </div>
  )
}
