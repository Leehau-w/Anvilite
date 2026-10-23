import React, { useMemo, useState } from 'react'
import { useSOPStore } from '@/stores/sopStore'
import { useT } from '@/i18n'
import { useSettingsStore } from '@/stores/settingsStore'
import { isSystemTemplateFolder } from '@/utils/sopLibrary'
import { useSOPLibrary } from './useSOPLibrary'
import { SOPTree } from './SOPTree'
import { SOPContent } from './SOPContent'
import { SOPEditor } from './SOPEditor'
import { SOPToTaskModal } from './SOPToTaskModal'
import type { SOP } from '@/types/sop'

export function SOPPage() {
  const t = useT()
  const lang = useSettingsStore((s) => s.settings.language)
  const { selectedSOPId, deleteSOP, copySOPToFolder, addFolder, selectSOP } = useSOPStore()
  const { folders, sops } = useSOPLibrary()
  const selectedSOP = useMemo(
    () => sops.find((s) => s.id === selectedSOPId) ?? null,
    [sops, selectedSOPId]
  )

  // ── Action states ────────────────────────────────────────────
  const [creatingInFolder, setCreatingInFolder] = useState<string | null>(null)
  const [editingSOPId, setEditingSOPId] = useState<string | null>(null)
  const [converting, setConverting] = useState(false)
  const [executionMode, setExecutionMode] = useState(false)
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set())

  // 切换 SOP 时重置执行状态
  const prevSOPId = React.useRef(selectedSOPId)
  if (prevSOPId.current !== selectedSOPId) {
    prevSOPId.current = selectedSOPId
    if (executionMode) setExecutionMode(false)
    if (editingSOPId && editingSOPId !== selectedSOPId) setEditingSOPId(null)
    if (creatingInFolder !== null) setCreatingInFolder(null)
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
    const targetFolderId = folders.find((folder) => !isSystemTemplateFolder(folder.id, folders))?.id
      ?? addFolder(t.sop_myFlows)
    const newId = copySOPToFolder(sop.id, targetFolderId, lang)
    if (newId) selectSOP(newId)
  }

  function handleEditSOP(id: string) {
    selectSOP(id)
    setCreatingInFolder(null)
    setExecutionMode(false)
    setEditingSOPId(id)
  }

  // ── 卡片内容 ─────────────────────────────────────────────────
  function renderCardContent() {
    if (creatingInFolder !== null) {
      return (
        <SOPEditor
          key={`new-${creatingInFolder}`}
          sopId={null}
          defaultFolderId={creatingInFolder}
          onSave={(id) => { setCreatingInFolder(null); if (id) selectSOP(id) }}
          onCancel={() => setCreatingInFolder(null)}
        />
      )
    }

    if (!selectedSOP) return null

    if (editingSOPId === selectedSOP.id) {
      return (
        <SOPEditor
          key={selectedSOP.id}
          sopId={selectedSOP.id}
          onSave={() => setEditingSOPId(null)}
          onCancel={() => setEditingSOPId(null)}
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
    if (!selectedSOP || editingSOPId !== null || creatingInFolder !== null) return null

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
          flexWrap: 'wrap',
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

        {!executionMode && (
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
        {!executionMode && (
          <button
            onClick={() => handleEditSOP(selectedSOP.id)}
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

        {!executionMode && (
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
      <SOPTree onNewSOP={(fid) => { setCreatingInFolder(fid); setEditingSOPId(null); setExecutionMode(false) }} onEditSOP={handleEditSOP} />

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
