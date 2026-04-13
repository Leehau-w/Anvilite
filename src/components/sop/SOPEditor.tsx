import React, { useState } from 'react'
import type { SOP, SOPStep } from '@/types/sop'
import { useSOPStore } from '@/stores/sopStore'
import { useT } from '@/i18n'
import { generateId } from '@/utils/id'

interface Props {
  sopId: string | null
  defaultFolderId?: string
  onSave: () => void
  onCancel: () => void
}

function makeStep(sortOrder: number): SOPStep {
  return {
    id: generateId(),
    title: '',
    note: '',
    warning: '',
    time: null,
    sortOrder,
    childSteps: [],
  }
}

export function SOPEditor({ sopId, defaultFolderId = '', onSave, onCancel }: Props) {
  const t = useT()
  const { folders, sops, addSOP, updateSOP } = useSOPStore()
  const existingSOP = sopId ? sops.find((s) => s.id === sopId) : null

  const [title, setTitle] = useState(existingSOP?.title ?? '')
  const [type, setType] = useState<SOP['type']>(existingSOP?.type ?? 'workflow')
  const [folderId, setFolderId] = useState(existingSOP?.folderId ?? defaultFolderId)
  const [steps, setSteps] = useState<SOPStep[]>(
    existingSOP?.steps ? [...existingSOP.steps].sort((a, b) => a.sortOrder - b.sortOrder) : []
  )

  const userFolders = folders.filter((f) => !f.isSystem)

  function handleAddStep() {
    setSteps((prev) => [...prev, makeStep(prev.length)])
  }

  function handleRemoveStep(idx: number) {
    setSteps((prev) => prev.filter((_, i) => i !== idx).map((s, i) => ({ ...s, sortOrder: i })))
  }

  function handleUpdateStep(idx: number, patch: Partial<SOPStep>) {
    setSteps((prev) => prev.map((s, i) => (i === idx ? { ...s, ...patch } : s)))
  }

  function handleSave() {
    if (!title.trim()) return
    const resolvedFolderId = folderId || (userFolders[0]?.id ?? '')
    if (!resolvedFolderId) return
    const now = new Date().toISOString()
    const normalizedSteps = steps.map((s, i) => ({ ...s, sortOrder: i }))

    if (sopId) {
      updateSOP(sopId, { title: title.trim(), type, folderId: resolvedFolderId, steps: normalizedSteps, updatedAt: now })
    } else {
      addSOP({ title: title.trim(), type, folderId: resolvedFolderId, steps: normalizedSteps, isSystem: false })
    }
    onSave()
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    height: 36,
    padding: '0 12px',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--color-border)',
    background: 'var(--color-bg)',
    color: 'var(--color-text)',
    fontSize: 14,
    outline: 'none',
    boxSizing: 'border-box',
  }

  const labelStyle: React.CSSProperties = {
    fontSize: 12,
    color: 'var(--color-text-dim)',
    marginBottom: 6,
    display: 'block',
  }

  return (
    <div style={{ padding: 24 }}>
      <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 20, color: 'var(--color-text)' }}>
        {sopId ? t.sop_edit : t.sop_create}
      </h2>

      {/* 标题 */}
      <div style={{ marginBottom: 16 }}>
        <label style={labelStyle}>{t.sop_titlePlaceholder}</label>
        <input
          autoFocus
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={t.sop_titlePlaceholder}
          style={inputStyle}
        />
      </div>

      {/* 类型选择 */}
      <div style={{ marginBottom: 16 }}>
        <label style={labelStyle}>{t.sop_typeLabel}</label>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {(['workflow', 'checklist', 'schedule', 'itemlist'] as const).map((tp) => {
            const isActive = type === tp
            const labels: Record<typeof tp, string> = {
              workflow: t.sop_type_workflow,
              checklist: t.sop_type_checklist,
              schedule: t.sop_type_schedule,
              itemlist: t.sop_type_itemlist,
            }
            return (
              <button
                key={tp}
                type="button"
                onClick={() => setType(tp)}
                style={{
                  fontSize: 13,
                  padding: '5px 14px',
                  borderRadius: 'var(--radius-md)',
                  border: `1px solid ${isActive ? 'var(--color-accent)' : 'var(--color-border)'}`,
                  background: isActive
                    ? 'color-mix(in srgb, var(--color-accent) 12%, transparent)'
                    : 'transparent',
                  color: isActive ? 'var(--color-accent)' : 'var(--color-text-dim)',
                  cursor: 'pointer',
                  fontWeight: isActive ? 500 : 400,
                }}
              >
                {labels[tp]}
              </button>
            )
          })}
        </div>
      </div>

      {/* 文件夹选择 */}
      {userFolders.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>文件夹</label>
          <select
            value={folderId || userFolders[0]?.id}
            onChange={(e) => setFolderId(e.target.value)}
            style={{ ...inputStyle, height: 36 }}
          >
            {userFolders.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* 步骤列表 */}
      <div style={{ marginBottom: 16 }}>
        <label style={labelStyle}>步骤</label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {steps.map((step, idx) => (
            <div
              key={step.id}
              style={{
                display: 'flex',
                gap: 8,
                alignItems: 'flex-start',
                padding: 12,
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--color-border)',
                background: 'var(--color-bg)',
              }}
            >
              {type !== 'itemlist' && (
                <span
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: 'var(--color-accent)',
                    minWidth: 20,
                    paddingTop: 8,
                  }}
                >
                  {idx + 1}.
                </span>
              )}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ display: 'flex', gap: 8 }}>
                  {type === 'schedule' && (
                    <input
                      type="time"
                      value={step.time ?? ''}
                      onChange={(e) => handleUpdateStep(idx, { time: e.target.value || null })}
                      style={{ ...inputStyle, width: 110, flexShrink: 0 }}
                    />
                  )}
                  <input
                    value={step.title}
                    onChange={(e) => handleUpdateStep(idx, { title: e.target.value })}
                    placeholder={t.sop_stepPlaceholder}
                    style={inputStyle}
                  />
                </div>
                {type !== 'itemlist' && (
                  <input
                    value={step.note}
                    onChange={(e) => handleUpdateStep(idx, { note: e.target.value })}
                    placeholder={t.sop_notePlaceholder}
                    style={{ ...inputStyle, height: 30, fontSize: 13 }}
                  />
                )}
                {(type === 'checklist' || type === 'schedule') && (
                  <input
                    value={step.warning}
                    onChange={(e) => handleUpdateStep(idx, { warning: e.target.value })}
                    placeholder={t.sop_warningPlaceholder}
                    style={{ ...inputStyle, height: 30, fontSize: 13, color: 'var(--color-warning)' }}
                  />
                )}
              </div>
              <button
                type="button"
                onClick={() => handleRemoveStep(idx)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--color-text-dim)',
                  cursor: 'pointer',
                  fontSize: 16,
                  padding: '4px 6px',
                  borderRadius: 'var(--radius-sm)',
                  flexShrink: 0,
                }}
              >
                ×
              </button>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={handleAddStep}
          style={{
            marginTop: 8,
            fontSize: 13,
            color: 'var(--color-accent)',
            background: 'none',
            border: '1px dashed var(--color-accent)',
            borderRadius: 'var(--radius-md)',
            padding: '6px 14px',
            cursor: 'pointer',
            width: '100%',
          }}
        >
          + {t.sop_addStep}
        </button>
      </div>

      {/* 操作按钮 */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
        <button
          type="button"
          onClick={onCancel}
          style={{
            height: 36,
            padding: '0 16px',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--color-border)',
            background: 'transparent',
            color: 'var(--color-text-dim)',
            fontSize: 14,
            cursor: 'pointer',
          }}
        >
          {t.common_cancel}
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={!title.trim() || (!folderId && userFolders.length === 0)}
          style={{
            height: 36,
            padding: '0 20px',
            borderRadius: 'var(--radius-md)',
            border: 'none',
            background: title.trim() ? 'var(--color-accent)' : 'var(--color-border)',
            color: title.trim() ? 'white' : 'var(--color-text-dim)',
            fontSize: 14,
            fontWeight: 600,
            cursor: title.trim() ? 'pointer' : 'not-allowed',
          }}
        >
          {t.common_save}
        </button>
      </div>
    </div>
  )
}
