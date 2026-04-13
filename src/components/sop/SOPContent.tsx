import React, { useState } from 'react'
import type { SOP } from '@/types/sop'
import { useSOPStore } from '@/stores/sopStore'
import { useT } from '@/i18n'
import { SOPWorkflowView } from './SOPWorkflowView'
import { SOPItemListView } from './SOPItemListView'
import { SOPEditor } from './SOPEditor'
import { SOPToTaskModal } from './SOPToTaskModal'

function getSOPTypeIcon(type: SOP['type']): string {
  const icons: Record<SOP['type'], string> = {
    schedule: '⏰',
    workflow: '🔄',
    checklist: '☑️',
    itemlist: '📝',
  }
  return icons[type]
}

function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const days = Math.floor(diff / 86400000)
  if (days === 0) return '今天'
  if (days === 1) return '昨天'
  if (days < 30) return `${days} 天前`
  const months = Math.floor(days / 30)
  return `${months} 个月前`
}

interface Props {
  sop: SOP
}

export function SOPContent({ sop }: Props) {
  const t = useT()
  const { deleteSOP, duplicateSOP, selectSOP } = useSOPStore()
  const [editing, setEditing] = useState(false)
  const [converting, setConverting] = useState(false)

  const typeLabels: Record<SOP['type'], string> = {
    schedule: t.sop_type_schedule,
    workflow: t.sop_type_workflow,
    checklist: t.sop_type_checklist,
    itemlist: t.sop_type_itemlist,
  }

  if (editing) {
    return (
      <SOPEditor
        sopId={sop.id}
        onSave={() => setEditing(false)}
        onCancel={() => setEditing(false)}
      />
    )
  }

  return (
    <div>
      {/* 标题区 */}
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--color-text)', marginBottom: 6 }}>
          {sop.title}
        </h2>
        <div style={{ fontSize: 13, color: 'var(--color-text-dim)' }}>
          {getSOPTypeIcon(sop.type)}{' '}
          {typeLabels[sop.type]}{' '}
          ·{' '}
          {sop.steps.length} {t.sop_steps}
        </div>
      </div>

      {/* 内容视图 */}
      {sop.type === 'workflow' && <SOPWorkflowView steps={sop.steps} />}
      {sop.type === 'itemlist' && <SOPItemListView steps={sop.steps} />}
      {(sop.type === 'schedule' || sop.type === 'checklist') && (
        <div style={{ color: 'var(--color-text-dim)', fontSize: 14 }}>
          {t.sop_viewComingSoon}
        </div>
      )}

      {/* 底部操作栏 */}
      <div
        style={{
          display: 'flex',
          gap: 10,
          marginTop: 32,
          paddingTop: 16,
          borderTop: '1px solid var(--color-border)',
          flexWrap: 'wrap',
        }}
      >
        <button
          onClick={() => setConverting(true)}
          style={{
            height: 34, padding: '0 16px', borderRadius: 'var(--radius-md)',
            border: 'none', background: 'var(--color-accent)',
            color: 'white', fontSize: 13, fontWeight: 600, cursor: 'pointer',
          }}
        >
          → {t.sop_convertToTask}
        </button>

        {!sop.isSystem && (
          <button
            onClick={() => setEditing(true)}
            style={{
              height: 34, padding: '0 16px', borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-border)', background: 'transparent',
              color: 'var(--color-text)', fontSize: 13, cursor: 'pointer',
            }}
          >
            {t.common_edit}
          </button>
        )}

        {sop.isSystem && (
          <button
            onClick={() => {
              const newId = duplicateSOP(sop.id)
              selectSOP(newId)
            }}
            style={{
              height: 34, padding: '0 16px', borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-border)', background: 'transparent',
              color: 'var(--color-text)', fontSize: 13, cursor: 'pointer',
            }}
          >
            {t.sop_copyToMine}
          </button>
        )}

        {!sop.isSystem && (
          <button
            onClick={() => {
              deleteSOP(sop.id)
            }}
            style={{
              height: 34, padding: '0 16px', borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-border)', background: 'transparent',
              color: 'var(--color-danger)', fontSize: 13, cursor: 'pointer',
            }}
          >
            {t.common_delete}
          </button>
        )}
      </div>

      {/* 最近转化时间 */}
      {sop.lastUsedAt && (
        <div style={{ fontSize: 12, color: 'var(--color-text-dim)', marginTop: 10 }}>
          {t.sop_lastUsed}: {formatRelativeTime(sop.lastUsedAt)}
        </div>
      )}

      {/* 转为任务弹窗 */}
      {converting && (
        <SOPToTaskModal sop={sop} onClose={() => setConverting(false)} />
      )}
    </div>
  )
}
