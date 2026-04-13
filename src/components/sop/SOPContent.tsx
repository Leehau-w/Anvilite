import React, { useState } from 'react'
import type { SOP } from '@/types/sop'
import { useSOPStore } from '@/stores/sopStore'
import { useT } from '@/i18n'
import { useSettingsStore } from '@/stores/settingsStore'
import { SOPWorkflowView } from './SOPWorkflowView'
import { SOPItemListView } from './SOPItemListView'
import { SOPScheduleView } from './SOPScheduleView'
import { SOPChecklistView } from './SOPChecklistView'
import { SOPEditor } from './SOPEditor'
import { SOPToTaskModal } from './SOPToTaskModal'
import { generateId } from '@/utils/id'

function getSOPTypeIcon(type: SOP['type']): string {
  const icons: Record<SOP['type'], string> = {
    schedule: '⏰',
    workflow: '🔄',
    checklist: '☑️',
    itemlist: '📝',
  }
  return icons[type]
}

function formatRelativeTime(iso: string, lang: 'zh' | 'en'): string {
  const diff = Date.now() - new Date(iso).getTime()
  const days = Math.floor(diff / 86400000)
  if (lang === 'en') {
    if (days === 0) return 'Today'
    if (days === 1) return 'Yesterday'
    if (days < 30) return `${days} days ago`
    return `${Math.floor(days / 30)} months ago`
  }
  if (days === 0) return '今天'
  if (days === 1) return '昨天'
  if (days < 30) return `${days} 天前`
  return `${Math.floor(days / 30)} 个月前`
}

const EXECUTION_SUPPORTED: SOP['type'][] = ['checklist', 'itemlist']

interface Props {
  sop: SOP
}

export function SOPContent({ sop }: Props) {
  const t = useT()
  const lang = useSettingsStore((s) => s.settings.language)
  const { deleteSOP, addSOP, selectSOP, folders } = useSOPStore()

  const [editing, setEditing] = useState(false)
  const [converting, setConverting] = useState(false)
  const [executionMode, setExecutionMode] = useState(false)
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set())

  const typeLabels: Record<SOP['type'], string> = {
    schedule: t.sop_type_schedule,
    workflow: t.sop_type_workflow,
    checklist: t.sop_type_checklist,
    itemlist: t.sop_type_itemlist,
  }

  const supportsExecution = EXECUTION_SUPPORTED.includes(sop.type)
  const doneCount = sop.steps.filter((s) => checkedIds.has(s.id)).length
  const totalCount = sop.steps.length

  function handleStartExecution() {
    setExecutionMode(true)
    setCheckedIds(new Set())
  }

  function handleEndExecution() {
    setExecutionMode(false)
  }

  function handleToggle(stepId: string) {
    setCheckedIds((prev) => {
      const next = new Set(prev)
      if (next.has(stepId)) next.delete(stepId)
      else next.add(stepId)
      return next
    })
  }

  // Copy system SOP to user's SOPs (title + steps are already resolved from getSystemSOPs)
  function handleCopySystemSOP() {
    const userFolders = folders.filter((f) => !f.isSystem)
    const targetFolderId = userFolders[0]?.id ?? ''
    if (!targetFolderId) return

    const newId = addSOP({
      title: sop.title + (lang === 'zh' ? '（副本）' : ' (Copy)'),
      type: sop.type,
      folderId: targetFolderId,
      steps: sop.steps.map((s) => ({ ...s, id: generateId(), childSteps: [] })),
      isSystem: false,
    })
    selectSOP(newId)
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
      {sop.type === 'workflow' && <SOPWorkflowView steps={sop.steps} />}
      {sop.type === 'itemlist' && (
        <SOPItemListView
          steps={sop.steps}
          executionMode={executionMode}
          checkedIds={checkedIds}
          onToggle={handleToggle}
        />
      )}
      {sop.type === 'schedule' && <SOPScheduleView steps={sop.steps} />}
      {sop.type === 'checklist' && (
        <SOPChecklistView
          steps={sop.steps}
          executionMode={executionMode}
          checkedIds={checkedIds}
          onToggle={handleToggle}
        />
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
          alignItems: 'center',
        }}
      >
        {!executionMode && (
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
        )}

        {supportsExecution && !executionMode && (
          <button
            onClick={handleStartExecution}
            style={{
              height: 34, padding: '0 16px', borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-accent)',
              background: 'color-mix(in srgb, var(--color-accent) 10%, transparent)',
              color: 'var(--color-accent)', fontSize: 13, fontWeight: 600, cursor: 'pointer',
            }}
          >
            ▶ {t.sop_startExecution}
          </button>
        )}

        {executionMode && (
          <button
            onClick={handleEndExecution}
            style={{
              height: 34, padding: '0 16px', borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-border)', background: 'transparent',
              color: 'var(--color-text-dim)', fontSize: 13, cursor: 'pointer',
            }}
          >
            ■ {t.sop_endExecution}
          </button>
        )}

        {!executionMode && !sop.isSystem && (
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

        {!executionMode && sop.isSystem && (
          <button
            onClick={handleCopySystemSOP}
            style={{
              height: 34, padding: '0 16px', borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-border)', background: 'transparent',
              color: 'var(--color-text)', fontSize: 13, cursor: 'pointer',
            }}
          >
            {t.sop_copyToMine}
          </button>
        )}

        {!executionMode && !sop.isSystem && (
          <button
            onClick={() => deleteSOP(sop.id)}
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
      {sop.lastUsedAt && !executionMode && (
        <div style={{ fontSize: 12, color: 'var(--color-text-dim)', marginTop: 10 }}>
          {t.sop_lastUsed}: {formatRelativeTime(sop.lastUsedAt, lang)}
        </div>
      )}

      {/* 转为任务弹窗 */}
      {converting && (
        <SOPToTaskModal sop={sop} onClose={() => setConverting(false)} />
      )}
    </div>
  )
}
