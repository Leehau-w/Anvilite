import React, { useState, useEffect, useRef } from 'react'
import { Drawer } from '@/components/ui/Drawer'
import { StarRating } from '@/components/ui/StarRating'
import { CategorySelect } from '@/components/ui/CategorySelect'
import type { Task, TaskDifficulty, TaskPriority, SubTask } from '@/types/task'
import { useTaskStore } from '@/stores/taskStore'
import { useAreaStore } from '@/stores/areaStore'
import { useGrowthEventStore } from '@/stores/growthEventStore'
import { getTomorrowString } from '@/utils/time'
import { useT } from '@/i18n'
import { useToast } from '@/components/feedback/Toast'
import { AnimatePresence, motion } from 'framer-motion'
import { SubTaskItem } from './SubTaskItem'
import { makeSubTask } from '@/utils/subTaskUtils'

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
  actualMinutes: string
}

export function TaskDrawer({ open, onClose, editTask, initialCategory }: TaskDrawerProps) {
  const { addTask, updateTask, deleteTask, addSubTask, removeSubTask, lastCategory } = useTaskStore()
  const currentTask = useTaskStore((s) => editTask ? s.tasks.find((t) => t.id === editTask.id) : null)
  const { addEvent } = useGrowthEventStore()
  const { showToast } = useToast()
  const getAreaCategories = useAreaStore((s) => s.getAreaCategories)
  const t = useT()
  const [subtaskInput, setSubtaskInput] = useState('')
  const subtaskInputRef = useRef<HTMLInputElement>(null)
  // 新建任务时暂存子项，submit 后批量写入
  const [pendingSubTasks, setPendingSubTasks] = useState<SubTask[]>([])

  const defaultForm: FormData = {
    title: editTask?.title ?? '',
    category: editTask?.category ?? initialCategory ?? lastCategory,
    difficulty: editTask?.difficulty ?? 3,
    priority: editTask?.priority ?? 'medium',
    dueDate: editTask?.dueDate ?? getTomorrowString(),
    hasDueDate: editTask ? editTask.dueDate !== null : true,
    description: editTask?.description ?? '',
    actualMinutes: editTask?.actualMinutes ? String(editTask.actualMinutes) : '',
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
        actualMinutes: editTask?.actualMinutes ? String(editTask.actualMinutes) : '',
      })
      setSubtaskInput('')
      setPendingSubTasks([])
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
      ...(editTask?.status === 'done' && form.actualMinutes !== ''
        ? { actualMinutes: Number(form.actualMinutes) }
        : {}),
    }

    if (editTask) {
      updateTask(editTask.id, data)
    } else {
      const newTask = addTask(data)
      // 将新建前暂存的子项批量写入
      pendingSubTasks.forEach((sub) => addSubTask(newTask.id, sub.title))
    }
    handleClose()
  }

  function handleAddSubTask() {
    if (!subtaskInput.trim()) return
    if (editTask) {
      addSubTask(editTask.id, subtaskInput.trim())
    } else {
      // 新建模式：先放入本地暂存列表
      setPendingSubTasks((prev) => [...prev, makeSubTask(subtaskInput.trim(), prev.length)])
    }
    setSubtaskInput('')
    if (subtaskInputRef.current) subtaskInputRef.current.focus()
  }

  function handleRemovePending(id: string) {
    setPendingSubTasks((prev) => prev.filter((s) => s.id !== id))
  }

  const priorities = [
    { value: 'urgent' as TaskPriority, label: t.taskPriority_urgent, color: '#dc2626' },
    { value: 'high' as TaskPriority, label: t.taskPriority_high, color: 'var(--color-accent)' },
    { value: 'medium' as TaskPriority, label: t.taskPriority_medium, color: 'var(--color-text-dim)' },
    { value: 'low' as TaskPriority, label: t.taskPriority_low, color: 'var(--color-border)' },
  ]

  // 编辑模式：从 store 实时拿；新建模式：用本地暂存列表
  const subTasks = editTask ? (currentTask?.subTasks ?? editTask.subTasks ?? []) : pendingSubTasks

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
              height: 36, padding: '0 12px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-border)',
              background: 'var(--color-bg)',
              color: 'var(--color-text)',
              fontSize: 14, outline: 'none', transition: 'border-color 0.15s, box-shadow 0.15s',
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
                    fontSize: 12, padding: '5px 12px',
                    borderRadius: 'var(--radius-md)',
                    border: `1px solid ${isActive ? p.color : 'var(--color-border)'}`,
                    background: isActive ? `color-mix(in srgb, ${p.color} 12%, transparent)` : 'transparent',
                    color: isActive ? p.color : 'var(--color-text-dim)',
                    cursor: 'pointer', fontWeight: isActive ? 500 : 400,
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
                background: 'none', border: 'none', cursor: 'pointer', padding: 0,
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
                height: 36, padding: '0 12px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--color-border)',
                background: 'var(--color-bg)',
                color: 'var(--color-text)',
                fontSize: 14, outline: 'none',
              }}
            />
          )}
        </div>

        {/* 实际用时（编辑已完成任务时显示） */}
        {editTask && (
          <div className="flex flex-col gap-1.5">
            <label style={{ fontSize: 12, color: 'var(--color-text-dim)' }}>{t.task_actualMinutes}</label>
            {editTask.status === 'done' ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input
                  type="number"
                  min={0}
                  value={form.actualMinutes}
                  onChange={(e) => setForm((f) => ({ ...f, actualMinutes: e.target.value }))}
                  style={{
                    width: 100, height: 36, padding: '0 12px',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--color-border)',
                    background: 'var(--color-bg)',
                    color: 'var(--color-text)',
                    fontSize: 14, outline: 'none',
                  }}
                />
                <span style={{ fontSize: 13, color: 'var(--color-text-dim)' }}>{t.task_minuteUnit}</span>
              </div>
            ) : (
              <div style={{ fontSize: 13, color: 'var(--color-text-dim)', padding: '8px 0' }}>
                {t.task_actualMinutesPlaceholder}
              </div>
            )}
          </div>
        )}

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
              fontSize: 14, outline: 'none', resize: 'vertical',
              fontFamily: 'var(--font-zh)',
            }}
          />
        </div>

        {/* 子项管理（新建和编辑模式均显示） */}
        <div className="flex flex-col gap-2">
          <label style={{ fontSize: 12, color: 'var(--color-text-dim)' }}>{t.subtask_add}</label>

          {/* 子项列表 */}
          {subTasks.length > 0 && (
            <div style={{
              padding: '8px 10px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-border)',
              background: 'var(--color-bg)',
              display: 'flex',
              flexDirection: 'column',
              gap: 2,
            }}>
              <AnimatePresence>
                {subTasks.map((sub) => (
                  <motion.div
                    key={sub.id}
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                  >
                    {editTask ? (
                      <SubTaskItem subTask={sub} taskId={editTask.id} depth={0} />
                    ) : (
                      /* 新建模式：只显示标题 + 删除按钮 */
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '2px 0' }}>
                        <span style={{ fontSize: 12, color: 'var(--color-text-dim)', flexShrink: 0 }}>•</span>
                        <span style={{ fontSize: 13, color: 'var(--color-text)', flex: 1 }}>{sub.title}</span>
                        <button
                          type="button"
                          onClick={() => handleRemovePending(sub.id)}
                          style={{ background: 'none', border: 'none', fontSize: 13, color: 'var(--color-text-dim)', cursor: 'pointer', padding: '0 2px', lineHeight: 1 }}
                        >
                          ×
                        </button>
                      </div>
                    )}
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}

          {/* 输入行 */}
          <div style={{ display: 'flex', gap: 6 }}>
            <input
              ref={subtaskInputRef}
              value={subtaskInput}
              onChange={(e) => setSubtaskInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  handleAddSubTask()
                }
              }}
              placeholder={t.subtask_placeholder}
              style={{
                flex: 1, height: 32, padding: '0 10px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--color-border)',
                background: 'var(--color-bg)',
                color: 'var(--color-text)',
                fontSize: 13, outline: 'none',
              }}
            />
            <button
              type="button"
              onClick={handleAddSubTask}
              disabled={!subtaskInput.trim()}
              style={{
                height: 32, padding: '0 12px',
                borderRadius: 'var(--radius-md)',
                border: 'none',
                background: subtaskInput.trim() ? 'var(--color-accent)' : 'var(--color-border)',
                color: subtaskInput.trim() ? 'white' : 'var(--color-text-dim)',
                fontSize: 12, fontWeight: 600, cursor: subtaskInput.trim() ? 'pointer' : 'default',
              }}
            >
              +
            </button>
          </div>
        </div>

        {/* 铭刻为里程碑 */}
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
              border: '1px solid var(--color-xp)',
              background: 'color-mix(in srgb, var(--color-xp) 10%, transparent)',
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
              flex: 1, height: 36, borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-border)',
              background: 'transparent', color: 'var(--color-text-dim)',
              fontSize: 14, cursor: 'pointer',
            }}
          >
            {t.taskDrawer_cancel}
          </button>
          <button
            type="submit"
            disabled={!form.title.trim()}
            style={{
              flex: 2, height: 36, borderRadius: 'var(--radius-md)',
              border: 'none',
              background: form.title.trim() ? 'var(--color-accent)' : 'var(--color-border)',
              color: form.title.trim() ? 'white' : 'var(--color-text-dim)',
              fontSize: 14, fontWeight: 600,
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
