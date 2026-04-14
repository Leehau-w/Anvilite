import React, { useState } from 'react'
import type { SOP, SOPStep } from '@/types/sop'
import type { TaskPriority } from '@/types/task'
import { useTaskStore } from '@/stores/taskStore'
import { useSOPStore } from '@/stores/sopStore'
import { useAreaStore } from '@/stores/areaStore'
import { useT } from '@/i18n'
import { CategorySelect } from '@/components/ui/CategorySelect'

interface Props {
  sop: SOP
  onClose: () => void
}

export function SOPToTaskModal({ sop, onClose }: Props) {
  const t = useT()
  const { createTaskFromSOP } = useTaskStore()
  const { updateSOP } = useSOPStore()
  const getAreaCategories = useAreaStore((s) => s.getAreaCategories)

  const [title, setTitle] = useState(sop.title)
  const [category, setCategory] = useState(getAreaCategories()[0] ?? 'other')
  const [difficulty, setDifficulty] = useState<1 | 2 | 3 | 4 | 5>(3)
  const [priority, setPriority] = useState<TaskPriority>('medium')
  const [dueDate, setDueDate] = useState('')
  const [selectedStepIds, setSelectedStepIds] = useState<Set<string>>(
    new Set(sop.steps.map((s) => s.id))
  )

  function toggleStep(id: string) {
    setSelectedStepIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function handleConvert() {
    if (!title.trim()) return
    const selectedSteps = sop.steps
      .filter((s) => selectedStepIds.has(s.id))
      .sort((a, b) => a.sortOrder - b.sortOrder)

    createTaskFromSOP({
      title: title.trim(),
      category,
      difficulty,
      priority,
      dueDate: dueDate || null,
      steps: selectedSteps,
    })
    updateSOP(sop.id, { lastUsedAt: new Date().toISOString() })
    onClose()
  }

  const categories = getAreaCategories()
  const difficulties: { value: 1 | 2 | 3 | 4 | 5; label: string }[] = [
    { value: 1, label: '⭐' },
    { value: 2, label: '⭐⭐' },
    { value: 3, label: '⭐⭐⭐' },
    { value: 4, label: '⭐⭐⭐⭐' },
    { value: 5, label: '⭐⭐⭐⭐⭐' },
  ]

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
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 200,
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        style={{
          background: 'var(--color-surface)',
          borderRadius: 'var(--radius-xl)',
          padding: 24,
          width: 480,
          maxHeight: '80vh',
          overflowY: 'auto',
          boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
        }}
      >
        <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 20, color: 'var(--color-text)' }}>
          {t.sop_confirmConvert}
        </h3>

        {/* 任务标题 */}
        <div style={{ marginBottom: 14 }}>
          <label style={labelStyle}>{t.taskDrawer_titleLabel}</label>
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            style={inputStyle}
          />
        </div>

        {/* 分类 */}
        {categories.length > 0 && (
          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>{t.taskDrawer_category}</label>
            <CategorySelect
              value={category}
              onChange={setCategory}
              categories={categories}
            />
          </div>
        )}

        {/* 难度 */}
        <div style={{ marginBottom: 14 }}>
          <label style={labelStyle}>{t.taskDrawer_difficulty}</label>
          <div style={{ display: 'flex', gap: 6 }}>
            {difficulties.map((d) => (
              <button
                key={d.value}
                type="button"
                onClick={() => setDifficulty(d.value)}
                style={{
                  flex: 1,
                  height: 32,
                  borderRadius: 'var(--radius-md)',
                  border: `1px solid ${difficulty === d.value ? 'var(--color-accent)' : 'var(--color-border)'}`,
                  background: difficulty === d.value
                    ? 'color-mix(in srgb, var(--color-accent) 12%, transparent)'
                    : 'transparent',
                  cursor: 'pointer',
                  fontSize: 11,
                }}
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>

        {/* 优先级 */}
        <div style={{ marginBottom: 14 }}>
          <label style={labelStyle}>{t.taskDrawer_priority}</label>
          <div style={{ display: 'flex', gap: 6 }}>
            {(
              [
                { value: 'urgent' as TaskPriority, label: t.taskPriority_urgent, color: '#dc2626' },
                { value: 'high'   as TaskPriority, label: t.taskPriority_high,   color: 'var(--color-accent)' },
                { value: 'medium' as TaskPriority, label: t.taskPriority_medium, color: 'var(--color-text-dim)' },
                { value: 'low'    as TaskPriority, label: t.taskPriority_low,    color: 'var(--color-border)' },
              ] as const
            ).map((p) => {
              const isActive = priority === p.value
              return (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => setPriority(p.value)}
                  style={{
                    flex: 1,
                    height: 32,
                    fontSize: 12,
                    borderRadius: 'var(--radius-md)',
                    border: `1px solid ${isActive ? p.color : 'var(--color-border)'}`,
                    background: isActive
                      ? `color-mix(in srgb, ${p.color} 12%, transparent)`
                      : 'transparent',
                    color: isActive ? p.color : 'var(--color-text-dim)',
                    cursor: 'pointer',
                    fontWeight: isActive ? 500 : 400,
                  }}
                >
                  {p.label}
                </button>
              )
            })}
          </div>
        </div>

        {/* 截止日期（可选） */}
        <div style={{ marginBottom: 20 }}>
          <label style={labelStyle}>{t.taskDrawer_dueDate}（可选）</label>
          <input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            style={inputStyle}
          />
        </div>

        {/* 步骤选择 */}
        {sop.steps.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <label style={labelStyle}>{t.sop_selectSteps}</label>
            <div
              style={{
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-md)',
                overflow: 'hidden',
              }}
            >
              {[...sop.steps]
                .sort((a, b) => a.sortOrder - b.sortOrder)
                .map((step, idx) => (
                  <div
                    key={step.id}
                    onClick={() => toggleStep(step.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: '8px 12px',
                      cursor: 'pointer',
                      background: selectedStepIds.has(step.id)
                        ? 'color-mix(in srgb, var(--color-accent) 6%, transparent)'
                        : 'transparent',
                      borderBottom: idx < sop.steps.length - 1 ? '1px solid var(--color-border)' : 'none',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={selectedStepIds.has(step.id)}
                      onChange={() => toggleStep(step.id)}
                      onClick={(e) => e.stopPropagation()}
                      style={{ accentColor: 'var(--color-accent)', flexShrink: 0 }}
                    />
                    <span style={{ fontSize: 13, color: 'var(--color-text)' }}>
                      {idx + 1}. {step.title}
                    </span>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* 操作按钮 */}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            style={{
              height: 36, padding: '0 16px', borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-border)', background: 'transparent',
              color: 'var(--color-text-dim)', fontSize: 14, cursor: 'pointer',
            }}
          >
            {t.common_cancel}
          </button>
          <button
            onClick={handleConvert}
            disabled={!title.trim()}
            style={{
              height: 36, padding: '0 20px', borderRadius: 'var(--radius-md)',
              border: 'none',
              background: title.trim() ? 'var(--color-accent)' : 'var(--color-border)',
              color: title.trim() ? 'white' : 'var(--color-text-dim)',
              fontSize: 14, fontWeight: 600,
              cursor: title.trim() ? 'pointer' : 'not-allowed',
            }}
          >
            {t.sop_convertToTask}
          </button>
        </div>
      </div>
    </div>
  )
}
