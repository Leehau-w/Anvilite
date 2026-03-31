import React, { useState, useEffect } from 'react'
import { Drawer } from '@/components/ui/Drawer'
import { StarRating } from '@/components/ui/StarRating'
import { CategorySelect } from '@/components/ui/CategorySelect'
import type { Task, TaskDifficulty, TaskPriority } from '@/types/task'
import { useTaskStore } from '@/stores/taskStore'
import { useAreaStore } from '@/stores/areaStore'
import { useGrowthEventStore } from '@/stores/growthEventStore'
import { getTomorrowString } from '@/utils/time'
import { useT } from '@/i18n'
import { useToast } from '@/components/feedback/Toast'

interface TaskDrawerProps {
  open: boolean
  onClose: () => void
  editTask?: Task | null
  initialCategory?: string
}

type FormData = {
  title: string
  category: string
  difficulty: TaskDifficulty
  priority: TaskPriority
  dueDate: string
  hasDueDate: boolean
  description: string
  estimatedMinutes: string
}


export function TaskDrawer({ open, onClose, editTask, initialCategory }: TaskDrawerProps) {
  const { addTask, updateTask, lastCategory } = useTaskStore()
  const { addEvent } = useGrowthEventStore()
  const { showToast } = useToast()
  const getAreaCategories = useAreaStore((s) => s.getAreaCategories)
  const t = useT()

  const defaultForm: FormData = {
    title: editTask?.title ?? '',
    category: editTask?.category ?? initialCategory ?? lastCategory,
    difficulty: editTask?.difficulty ?? 3,
    priority: editTask?.priority ?? 'medium',
    dueDate: editTask?.dueDate ?? getTomorrowString(),
    hasDueDate: editTask ? editTask.dueDate !== null : true,
    description: editTask?.description ?? '',
    estimatedMinutes: editTask?.estimatedMinutes ? String(editTask.estimatedMinutes) : '',
  }

  const [form, setForm] = useState<FormData>(defaultForm)

  useEffect(() => {
    if (open) {
      setForm({
        title: editTask?.title ?? '',
        category: editTask?.category ?? initialCategory ?? lastCategory,
        difficulty: editTask?.difficulty ?? 3,
        priority: editTask?.priority ?? 'medium',
        dueDate: editTask?.dueDate ?? getTomorrowString(),
        hasDueDate: editTask ? editTask.dueDate !== null : true,
        description: editTask?.description ?? '',
        estimatedMinutes: editTask?.estimatedMinutes ? String(editTask.estimatedMinutes) : '',
      })
    }
  }, [open, editTask?.id])

  function handleClose() {
    setForm(defaultForm)
    onClose()
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.title.trim()) return

    const data = {
      title: form.title.trim(),
      category: form.category,
      difficulty: form.difficulty,
      priority: form.priority,
      dueDate: form.hasDueDate ? form.dueDate : null,
      description: form.description,
      estimatedMinutes: form.estimatedMinutes ? Number(form.estimatedMinutes) : null,
    }

    if (editTask) {
      updateTask(editTask.id, data)
    } else {
      addTask(data)
    }
    handleClose()
  }

  const priorities = [
    { value: 'urgent' as TaskPriority, label: t.taskPriority_urgent, color: '#dc2626' },
    { value: 'high' as TaskPriority, label: t.taskPriority_high, color: 'var(--color-accent)' },
    { value: 'medium' as TaskPriority, label: t.taskPriority_medium, color: 'var(--color-text-dim)' },
    { value: 'low' as TaskPriority, label: t.taskPriority_low, color: 'var(--color-border)' },
  ]

  return (
    <Drawer open={open} onClose={handleClose} title={editTask ? t.taskDrawer_editTitle : t.taskDrawer_createTitle}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-5 p-4">
        {/* 标题 */}
        <div className="flex flex-col gap-1.5">
          <label style={{ fontSize: 12, color: 'var(--color-text-dim)' }}>{t.taskDrawer_titleLabel}</label>
          <input
            autoFocus
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            placeholder={t.taskDrawer_titlePlaceholder}
            style={{
              height: 36,
              padding: '0 12px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-border)',
              background: 'var(--color-bg)',
              color: 'var(--color-text)',
              fontSize: 14,
              outline: 'none',
              transition: 'border-color 0.15s, box-shadow 0.15s',
            }}
            onFocus={(e) => {
              e.target.style.borderColor = 'var(--color-accent)'
              e.target.style.boxShadow = '0 0 0 3px color-mix(in srgb, var(--color-accent) 15%, transparent)'
            }}
            onBlur={(e) => {
              e.target.style.borderColor = 'var(--color-border)'
              e.target.style.boxShadow = 'none'
            }}
          />
        </div>

        {/* 分类 */}
        <div className="flex flex-col gap-1.5">
          <label style={{ fontSize: 12, color: 'var(--color-text-dim)' }}>{t.taskDrawer_category}</label>
          <CategorySelect
            value={form.category}
            onChange={(v) => setForm((f) => ({ ...f, category: v }))}
            categories={getAreaCategories()}
          />
        </div>

        {/* 难度 */}
        <div className="flex flex-col gap-1.5">
          <label style={{ fontSize: 12, color: 'var(--color-text-dim)' }}>{t.taskDrawer_difficulty}</label>
          <StarRating
            value={form.difficulty}
            onChange={(v) => setForm((f) => ({ ...f, difficulty: v }))}
          />
        </div>

        {/* 优先级 */}
        <div className="flex flex-col gap-1.5">
          <label style={{ fontSize: 12, color: 'var(--color-text-dim)' }}>{t.taskDrawer_priority}</label>
          <div className="flex gap-2">
            {priorities.map((p) => {
              const isActive = form.priority === p.value
              return (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, priority: p.value }))}
                  style={{
                    fontSize: 12,
                    padding: '5px 12px',
                    borderRadius: 'var(--radius-md)',
                    border: `1px solid ${isActive ? p.color : 'var(--color-border)'}`,
                    background: isActive ? `color-mix(in srgb, ${p.color} 12%, transparent)` : 'transparent',
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

        {/* 截止日期 */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2">
            <label style={{ fontSize: 12, color: 'var(--color-text-dim)' }}>{t.taskDrawer_dueDate}</label>
            <button
              type="button"
              onClick={() => setForm((f) => ({ ...f, hasDueDate: !f.hasDueDate }))}
              style={{
                fontSize: 11,
                color: form.hasDueDate ? 'var(--color-accent)' : 'var(--color-text-dim)',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: 0,
              }}
            >
              {form.hasDueDate ? t.taskDrawer_hasDueDate : t.taskDrawer_noDueDate}
            </button>
          </div>
          {form.hasDueDate && (
            <input
              type="date"
              value={form.dueDate}
              onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))}
              style={{
                height: 36,
                padding: '0 12px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--color-border)',
                background: 'var(--color-bg)',
                color: 'var(--color-text)',
                fontSize: 14,
                outline: 'none',
              }}
            />
          )}
        </div>

        {/* 预估时长 */}
        <div className="flex flex-col gap-1.5">
          <label style={{ fontSize: 12, color: 'var(--color-text-dim)' }}>{t.taskDrawer_duration}</label>
          <input
            type="number"
            min={1}
            value={form.estimatedMinutes}
            onChange={(e) => setForm((f) => ({ ...f, estimatedMinutes: e.target.value }))}
            placeholder={t.taskDrawer_optional}
            style={{
              height: 36,
              padding: '0 12px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-border)',
              background: 'var(--color-bg)',
              color: 'var(--color-text)',
              fontSize: 14,
              outline: 'none',
            }}
          />
        </div>

        {/* 备注 */}
        <div className="flex flex-col gap-1.5">
          <label style={{ fontSize: 12, color: 'var(--color-text-dim)' }}>{t.taskDrawer_notes}</label>
          <textarea
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            placeholder={`${t.taskDrawer_optional}...`}
            rows={3}
            style={{
              padding: '8px 12px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-border)',
              background: 'var(--color-bg)',
              color: 'var(--color-text)',
              fontSize: 14,
              outline: 'none',
              resize: 'vertical',
              fontFamily: 'var(--font-zh)',
            }}
          />
        </div>

        {/* 铭刻为里程碑（编辑已完成/进行中任务时显示） */}
        {editTask && (editTask.status === 'done' || editTask.status === 'doing') && (
          <button
            type="button"
            onClick={() => {
              addEvent({
                type: 'custom_milestone',
                title: editTask.title,
                details: {
                  sourceType: 'task',
                  xpGained: editTask.xpReward,
                  actualMinutes: editTask.actualMinutes,
                  categoryName: editTask.category,
                  difficulty: editTask.difficulty,
                },
                isMilestone: true,
              })
              showToast(`⭐ ${editTask.title}`)
              handleClose()
            }}
            style={{
              width: '100%', height: 36, borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-xp)', background: 'color-mix(in srgb, var(--color-xp) 10%, transparent)',
              color: 'var(--color-xp)', cursor: 'pointer', fontSize: 13, fontWeight: 600,
            }}
          >
            ⭐ {t.task_inscribe}
          </button>
        )}

        {/* 按钮 */}
        <div className="flex gap-2 mt-2">
          <button
            type="button"
            onClick={handleClose}
            style={{
              flex: 1,
              height: 36,
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-border)',
              background: 'transparent',
              color: 'var(--color-text-dim)',
              fontSize: 14,
              cursor: 'pointer',
            }}
          >
            {t.taskDrawer_cancel}
          </button>
          <button
            type="submit"
            disabled={!form.title.trim()}
            style={{
              flex: 2,
              height: 36,
              borderRadius: 'var(--radius-md)',
              border: 'none',
              background: form.title.trim() ? 'var(--color-accent)' : 'var(--color-border)',
              color: form.title.trim() ? 'white' : 'var(--color-text-dim)',
              fontSize: 14,
              fontWeight: 600,
              cursor: form.title.trim() ? 'pointer' : 'not-allowed',
              transition: 'background 0.15s',
            }}
          >
            {editTask ? t.taskDrawer_save : t.taskDrawer_create}
          </button>
        </div>
      </form>
    </Drawer>
  )
}
