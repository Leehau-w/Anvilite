import React, { useMemo, useState } from 'react'
import { useSOPStore } from '@/stores/sopStore'
import { useT } from '@/i18n'
import { useSettingsStore } from '@/stores/settingsStore'
import { getSystemSOPs } from '@/data/systemSOPs'
import { generateId } from '@/utils/id'
import { SOPTree } from './SOPTree'
import { SOPContent } from './SOPContent'
import { SOPEditor } from './SOPEditor'
import { SOPToTaskModal } from './SOPToTaskModal'
import type { SOP } from '@/types/sop'

const EXECUTION_SUPPORTED: SOP['type'][] = ['checklist', 'itemlist', 'workflow']

export function SOPPage() {
  const t = useT()
  const lang = useSettingsStore((s) => s.settings.language)
  const { sops, selectedSOPId, deleteSOP, addSOP, selectSOP, folders } = useSOPStore()

  const systemSOPs = useMemo(() => getSystemSOPs(lang), [lang])
  const selectedSOP = useMemo(
    () => [...systemSOPs, ...sops].find((s) => s.id === selectedSOPId) ?? null,
    [systemSOPs, sops, selectedSOPId]
  )

  // ── Action states ────────────────────────────────────────────
  const [creatingInFolder, setCreatingInFolder] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [converting, setConverting] = useState(false)
  const [executionMode, setExecutionMode] = useState(false)
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set())

  // 切换 SOP 时重置执行状态
  const prevSOPId = React.useRef(selectedSOPId)
  if (prevSOPId.current !== selectedSOPId) {
    prevSOPId.current = selectedSOPId
    if (executionMode) setExecutionMode(false)
    if (editing) setEditing(false)
    setCheckedIds(new Set())
  }

  function handleToggle(stepId: string) {
    setCheckedIds((prev) => {
      const next = new Set(prev)
      if (next.has(stepId)) next.delete(stepId)
      else next.add(stepId)
      return next
    })
  }

  function handleCopySystemSOP(sop: SOP) {
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

  const supportsExecution = selectedSOP ? EXECUTION_SUPPORTED.includes(selectedSOP.type) : false

  // ── 卡片内容 ─────────────────────────────────────────────────
  function renderCardContent() {
    if (!selectedSOP) return null

    if (editing) {
      return (
        <SOPEditor
          sopId={selectedSOP.id}
          onSave={() => setEditing(false)}
          onCancel={() => setEditing(false)}
        />
      )
    }

    if (creatingInFolder !== null) {
      return (
        <SOPEditor
          sopId={null}
          defaultFolderId={creatingInFolder}
          onSave={() => setCreatingInFolder(null)}
          onCancel={() => setCreatingInFolder(null)}
        />
      )
    }

    return (
      <SOPContent
        sop={selectedSOP}
        executionMode={executionMode}
        checkedIds={checkedIds}
        onToggle={handleToggle}
      />
    )
  }

  // ── 底部 action bar ──────────────────────────────────────────
  function renderActionBar() {
    if (!selectedSOP || editing || creatingInFolder !== null) return null

    const btnBase: React.CSSProperties = {
      height: 34,
      padding: '0 18px',
      borderRadius: 'var(--radius-md)',
      fontSize: 13,
      cursor: 'pointer',
      fontWeight: 500,
    }

    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '5px 20px',
          background: 'var(--color-bg)',
          flexShrink: 0,
        }}
      >
        {/* 主操作 */}
        {!executionMode && (
          <button
            onClick={() => setConverting(true)}
            style={{
              ...btnBase,
              border: 'none',
              background: 'var(--color-accent)',
              color: 'white',
              fontWeight: 600,
            }}
          >
            → {t.sop_convertToTask}
          </button>
        )}

        {supportsExecution && !executionMode && (
          <button
            onClick={() => { setExecutionMode(true); setCheckedIds(new Set()) }}
            style={{
              ...btnBase,
              border: '1px solid var(--color-accent)',
              background: 'color-mix(in srgb, var(--color-accent) 10%, transparent)',
              color: 'var(--color-accent)',
              fontWeight: 600,
            }}
          >
            ▶ {t.sop_startExecution}
          </button>
        )}

        {executionMode && (
          <button
            onClick={() => setExecutionMode(false)}
            style={{
              ...btnBase,
              border: '1px solid var(--color-border)',
              background: 'transparent',
              color: 'var(--color-text-dim)',
            }}
          >
            ■ {t.sop_endExecution}
          </button>
        )}

        {/* 次级操作 — 执行模式下隐藏 */}
        {!executionMode && !selectedSOP.isSystem && (
          <button
            onClick={() => setEditing(true)}
            style={{
              ...btnBase,
              border: '1px solid var(--color-border)',
              background: 'transparent',
              color: 'var(--color-text)',
            }}
          >
            {t.common_edit}
          </button>
        )}

        {!executionMode && selectedSOP.isSystem && (
          <button
            onClick={() => handleCopySystemSOP(selectedSOP)}
            style={{
              ...btnBase,
              border: '1px solid var(--color-border)',
              background: 'transparent',
              color: 'var(--color-text)',
            }}
          >
            {t.sop_copyToMine}
          </button>
        )}

        {!executionMode && !selectedSOP.isSystem && (
          <button
            onClick={() => deleteSOP(selectedSOP.id)}
            style={{
              ...btnBase,
              border: '1px solid var(--color-border)',
              background: 'transparent',
              color: 'var(--color-danger)',
            }}
          >
            {t.common_delete}
          </button>
        )}
      </div>
    )
  }

  // ── Layout ───────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', height: '100%' }}>
      <SOPTree onNewSOP={(fid) => { setCreatingInFolder(fid); setEditing(false) }} />

      {/* 右侧：flex 列，卡片可滚动 + 底部 bar 固定 */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--color-bg)' }}>

        {/* 滚动区域 */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
          {selectedSOP || creatingInFolder !== null ? (
            <div
              style={{
                background: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-xl)',
                boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
                padding: '28px 32px',
                minHeight: 'calc(100% - 1px)',
              }}
            >
              {renderCardContent()}
            </div>
          ) : (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
                gap: 12,
                color: 'var(--color-text-dim)',
              }}
            >
              <div style={{ fontSize: 32 }}>📋</div>
              <div style={{ fontSize: 14 }}>{t.sop_emptyState}</div>
            </div>
          )}
        </div>

        {/* 底部 action bar（卡片外，紧贴窗口底部） */}
        {renderActionBar()}
      </div>

      {/* 转为任务弹窗 */}
      {converting && selectedSOP && (
        <SOPToTaskModal sop={selectedSOP} onClose={() => setConverting(false)} />
      )}
    </div>
  )
}
