import React, { useState, useEffect, useRef, useMemo } from 'react'
import { Drawer } from '@/components/ui/Drawer'
import { StarRating } from '@/components/ui/StarRating'
import { CategorySelect } from '@/components/ui/CategorySelect'
import type { Task, TaskDifficulty, TaskPriority, SubTask } from '@/types/task'
import { useTaskStore } from '@/stores/taskStore'
import { useAreaStore } from '@/stores/areaStore'
import { useGrowthEventStore } from '@/stores/growthEventStore'
import { getTomorrowString } from '@/utils/time'
import { generateId } from '@/utils/id'
import { useT } from '@/i18n'
import { useToast } from '@/components/feedback/Toast'
import { SubTaskList } from './SubTaskItem'
import { addNestedSubTask, makeSubTask } from '@/utils/subTaskUtils'
import { TagInput } from './TagInput'
import { TASK_PRIORITY_COLORS, TASK_COLOR_PRESETS, getTaskColorPreset } from '@/utils/taskPriority'

function hasSubTask(items: SubTask[], id: string): boolean {
  return items.some(item => item.id === id || hasSubTask(item.subTasks, id))
}

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
  backgroundColor: string | null
  dueDate: string
  hasDueDate: boolean
  description: string
  actualMinutes: string
  tags: string[]
}

export function TaskDrawer({ open, onClose, editTask, initialCategory }: TaskDrawerProps) {
  const { addTask, updateTask, resumeWaitingTask, lastCategory, tasks } = useTaskStore()
  const currentTask = useTaskStore((s) => editTask ? s.tasks.find((t) => t.id === editTask.id) : null)
  const { addEvent } = useGrowthEventStore()
  const { showToast } = useToast()
  const getAreaCategories = useAreaStore((s) => s.getAreaCategories)
  const t = useT()
  const [subtaskInput, setSubtaskInput] = useState('')
  const subtaskInputRef = useRef<HTMLInputElement>(null)
  // 新建任务时暂存子项，submit 后批量写入
  const [pendingSubTasks, setPendingSubTasks] = useState<SubTask[]>([])
  const saving = useRef(false)
  const composing = useRef(false)
  // Reuse the identity if persistence failed after adding the task to memory.
  const createdTaskId = useRef<string | null>(null)
  const pendingTag = useRef('')
  const draftSubTasks = useRef(new Map<string, SubTask>())

  const defaultForm: FormData = {
    title: editTask?.title ?? '',
    category: editTask?.category ?? initialCategory ?? lastCategory,
    difficulty: editTask?.difficulty ?? 3,
    priority: editTask?.priority ?? 'medium',
    backgroundColor: editTask?.backgroundColor ?? null,
    dueDate: editTask?.dueDate ?? getTomorrowString(),
    hasDueDate: editTask ? editTask.dueDate !== null : true,
    description: editTask?.description ?? '',
    actualMinutes: editTask?.actualMinutes ? String(editTask.actualMinutes) : '',
    tags: editTask?.tags ?? [],
  }

  const [form, setForm] = useState<FormData>(defaultForm)

  useEffect(() => {
    if (open) {
      saving.current = false
      composing.current = false
      createdTaskId.current = null
      pendingTag.current = ''
      draftSubTasks.current.clear()
      setForm({
        title: editTask?.title ?? '',
        category: editTask?.category ?? initialCategory ?? lastCategory,
        difficulty: editTask?.difficulty ?? 3,
        priority: editTask?.priority ?? 'medium',
        backgroundColor: editTask?.backgroundColor ?? null,
        dueDate: editTask?.dueDate ?? getTomorrowString(),
        hasDueDate: editTask ? editTask.dueDate !== null : true,
        description: editTask?.description ?? '',
        actualMinutes: editTask?.actualMinutes ? String(editTask.actualMinutes) : '',
        tags: editTask?.tags ?? [],
      })
      setSubtaskInput('')
      setPendingSubTasks([])
    }
  }, [open, editTask?.id, initialCategory])

  function handleClose() {
    setForm(defaultForm)
    onClose()
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (saving.current || composing.current || !form.title.trim()) return
    saving.current = true
    try {
      const latestTask = editTask ? useTaskStore.getState().tasks.find(task => task.id === editTask.id) : null
      if (editTask && (!latestTask || latestTask.deletedAt)) throw new Error('Task is unavailable')

      const tag = pendingTag.current.trim().slice(0, 20)
      const tags = tag && form.tags.length < 5 && !form.tags.includes(tag) ? [...form.tags, tag] : form.tags
      const recoveredCreation = !editTask && createdTaskId.current
        ? useTaskStore.getState().tasks.find(task => task.id === createdTaskId.current) : null
      const children = latestTask?.subTasks ?? recoveredCreation?.subTasks ?? pendingSubTasks
      const stagedChildren = recoveredCreation ? pendingSubTasks.filter(sub => !children.some(child => child.id === sub.id)) : []
      let nextChildren = stagedChildren.length ? [...children, ...stagedChildren] : children
      const drafts = [
        { parentId: '', title: subtaskInput },
        ...Array.from(e.currentTarget.querySelectorAll<HTMLInputElement>('[data-task-child-draft]'), input => ({
          parentId: input.dataset.taskChildDraft!, title: input.value,
        })),
      ]
      for (const draft of drafts) {
        const title = draft.title.trim()
        if (!title) continue
        const key = `${draft.parentId}\0${title}`
        const sub = draftSubTasks.current.get(key) ?? makeSubTask(title, nextChildren.length)
        draftSubTasks.current.set(key, sub)
        if (!hasSubTask(nextChildren, sub.id)) nextChildren = draft.parentId
          ? addNestedSubTask(nextChildren, draft.parentId, sub) : [...nextChildren, sub]
      }
      const data = {
        title: form.title.trim(),
        category: form.category,
        difficulty: form.difficulty,
        priority: form.priority,
        backgroundColor: form.backgroundColor,
        dueDate: form.hasDueDate ? form.dueDate : null,
        description: form.description,
        tags,
        ...(nextChildren !== children ? { subTasks: nextChildren } : {}),
        ...(latestTask?.status === 'done' && form.actualMinutes !== ''
          && form.actualMinutes !== (editTask?.actualMinutes ? String(editTask.actualMinutes) : '')
          ? { actualMinutes: Number(form.actualMinutes) }
          : {}),
      }

      if (editTask) {
        updateTask(editTask.id, data)
      } else {
        const id = createdTaskId.current ?? generateId()
        createdTaskId.current = id
        if (useTaskStore.getState().tasks.some(task => task.id === id)) {
          updateTask(id, data)
        } else {
          const previousCategory = useTaskStore.getState().lastCategory
          try {
            addTask({ ...data, id, subTasks: nextChildren })
          } catch (error) {
            const added = useTaskStore.getState().tasks.find(task => task.id === id)
            // Persist may throw after updating memory. Remove only this unchanged creation.
            if (added && added.status === 'todo' && added.subTasks === nextChildren
              && Object.entries(data).every(([key, value]) => added[key as keyof Task] === value)) {
              try { useTaskStore.setState(state => ({
                tasks: state.tasks.filter(task => task !== added),
                lastCategory: state.lastCategory === data.category ? previousCategory : state.lastCategory,
              })) } catch { /* memory rollback still runs when storage remains unavailable */ }
            }
            throw error
          }
        }
      }
      handleClose()
    } catch {
      saving.current = false
      showToast(t.activity_actionFailed)
    }
  }

  function handleFormKeyDown(e: React.KeyboardEvent<HTMLFormElement>) {
    // Category creation uses a portal with its own form and Enter behavior.
    if (!(e.target as HTMLElement).closest('form')?.hasAttribute('data-task-drawer') || e.key !== 'Enter' || e.defaultPrevented) return
    if (e.shiftKey && e.target instanceof HTMLTextAreaElement) return
    e.preventDefault()
    e.stopPropagation()
    if (!e.repeat) e.currentTarget.requestSubmit()
  }

  function saveDraftSubTask(title: string, parentId = ''): boolean {
    const trimmed = title.trim()
    if (!trimmed) return false
    const key = `${parentId}\0${trimmed}`
    const sub = draftSubTasks.current.get(key) ?? makeSubTask(trimmed, 0)
    draftSubTasks.current.set(key, sub)
    try {
      if (editTask) {
        const latest = useTaskStore.getState().tasks.find(task => task.id === editTask.id)
        if (!latest || latest.deletedAt || (parentId && !hasSubTask(latest.subTasks, parentId))) {
          throw new Error('Task or parent is unavailable')
        }
        // Retry the same draft identity against current children after a failed write.
        const children = hasSubTask(latest.subTasks, sub.id) ? latest.subTasks : parentId
          ? addNestedSubTask(latest.subTasks, parentId, sub)
          : [...latest.subTasks, { ...sub, sortOrder: latest.subTasks.length }]
        updateTask(latest.id, { subTasks: children })
      } else {
        setPendingSubTasks(previous => hasSubTask(previous, sub.id) ? previous
          : [...previous, { ...sub, sortOrder: previous.length }])
      }
      draftSubTasks.current.delete(key)
      return true
    } catch {
      showToast(t.activity_actionFailed)
      return false
    }
  }

  function handleAddSubTask() {
    if (!saveDraftSubTask(subtaskInput)) return
    setSubtaskInput('')
    subtaskInputRef.current?.focus()
  }

  function handleRemovePending(id: string) {
    setPendingSubTasks((prev) => prev.filter((s) => s.id !== id))
  }

  const priorities = [
    { value: 'urgent' as TaskPriority, label: t.taskPriority_urgent },
    { value: 'high' as TaskPriority, label: t.taskPriority_high },
    { value: 'medium' as TaskPriority, label: t.taskPriority_medium },
    { value: 'low' as TaskPriority, label: t.taskPriority_low },
  ]

  const selectedColorPreset = getTaskColorPreset(form.backgroundColor)
  const customInputColor = selectedColorPreset?.value ?? form.backgroundColor
    ?? TASK_COLOR_PRESETS.find(color => color.id === 'blue')!.value

  const allTags = useMemo(() => {
    const set = new Set<string>()
    tasks.forEach((t) => t.tags?.forEach((tag) => set.add(tag)))
    return [...set].sort()
  }, [tasks])

  // 编辑模式：从 store 实时拿；新建模式：用本地暂存列表
  const subTasks = editTask ? (currentTask?.subTasks ?? editTask.subTasks ?? []) : pendingSubTasks

  return (
    <Drawer open={open} onClose={handleClose} title={editTask ? t.taskDrawer_editTitle : t.taskDrawer_createTitle}>
      <form data-task-drawer tabIndex={-1} onSubmit={handleSubmit} onKeyDown={handleFormKeyDown}
        onCompositionStartCapture={event => {
          if ((event.target as HTMLElement).closest('form')?.hasAttribute('data-task-drawer')) composing.current = true
        }}
        onCompositionEndCapture={event => {
          if ((event.target as HTMLElement).closest('form')?.hasAttribute('data-task-drawer')) composing.current = false
        }}
        onKeyDownCapture={event => {
          if ((event.target as HTMLElement).closest('form')?.hasAttribute('data-task-drawer') && event.key === 'Enter'
            && (composing.current || event.nativeEvent.isComposing || event.keyCode === 229)) {
            event.preventDefault()
            event.stopPropagation()
          }
        }} className="flex flex-col gap-5 p-4">
        {currentTask && !currentTask.deletedAt && currentTask.status === 'waiting' && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            {currentTask.status === 'waiting' && (
              <span style={{ fontSize: 12, color: 'var(--color-secondary)' }}>⏳ {t.task_waiting}</span>
            )}
            <button type="button"
              onClick={() => resumeWaitingTask(currentTask.id)}
              style={{ marginLeft: 'auto', fontSize: 12, padding: '4px 10px', borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--color-border)', background: 'transparent', color: 'var(--color-secondary)', cursor: 'pointer' }}>
              {t.task_resumeWaiting}
            </button>
          </div>
        )}
        {/* 标题 */}
        <div className="flex flex-col gap-1.5">
          <label style={{ fontSize: 12 }}>{t.taskDrawer_titleLabel}</label>
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
          <label style={{ fontSize: 12 }}>{t.taskDrawer_category}</label>
          <CategorySelect
            value={form.category}
            onChange={(v) => setForm((f) => ({ ...f, category: v }))}
            categories={getAreaCategories()}
            allowCreate
          />
        </div>

        {/* 标签 */}
        <div className="flex flex-col gap-1.5">
          <label style={{ fontSize: 12 }}>{t.tag_add}</label>
          <TagInput
            tags={form.tags}
            allTags={allTags}
            onChange={(tags) => setForm((f) => ({ ...f, tags }))}
            onDraftChange={value => { pendingTag.current = value }}
          />
        </div>

        {/* 难度 */}
        <div className="flex flex-col gap-1.5">
          <label style={{ fontSize: 12 }}>{t.taskDrawer_difficulty}</label>
          <StarRating
            value={form.difficulty}
            onChange={(v) => setForm((f) => ({ ...f, difficulty: v }))}
          />
        </div>

        {/* 优先级 */}
        <div className="flex flex-col gap-1.5">
          <label style={{ fontSize: 12 }}>{t.taskDrawer_priority} <span style={{ fontSize: 11, marginLeft: 6 }}>{form.backgroundColor ? t.task_colorManualHint : t.task_priorityColorHint}</span></label>
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
                    border: `1px solid ${isActive ? TASK_PRIORITY_COLORS[p.value] : 'var(--color-border)'}`,
                    background: isActive ? `color-mix(in srgb, ${TASK_PRIORITY_COLORS[p.value]} 12%, transparent)` : 'transparent',
                    color: isActive ? TASK_PRIORITY_COLORS[p.value] : 'var(--color-text-dim)',
                    cursor: 'pointer', fontWeight: isActive ? 500 : 400,
                  }}
                >
                  {p.label}
                </button>
              )
            })}
          </div>
        </div>

        {/* 任务底色：保存在表单草稿中，取消时不写入任务。 */}
        <fieldset style={{ margin: 0, padding: 0, border: 0, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <legend style={{ fontSize: 12, marginBottom: 8 }}>{t.taskDrawer_backgroundColor}</legend>
          <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
            <button type="button" aria-pressed={!form.backgroundColor}
              onClick={() => setForm(current => ({ ...current, backgroundColor: null }))}
              style={{ fontSize: 12, padding: '4px 8px', borderRadius: 'var(--radius-sm)', cursor: 'pointer',
                border: '1px solid ' + (!form.backgroundColor ? 'var(--color-accent)' : 'var(--color-border)'),
                background: !form.backgroundColor ? 'color-mix(in srgb, var(--color-accent) 10%, transparent)' : 'transparent',
                color: 'var(--color-text)' }}>
              {t.task_colorAuto}
            </button>
            {TASK_COLOR_PRESETS.map(color => {
              const selected = selectedColorPreset?.id === color.id
              return <button key={color.id} type="button" data-task-color-preset={color.id} aria-label={t[color.labelKey]} title={t[color.labelKey]} aria-pressed={selected}
                onClick={() => setForm(current => ({ ...current, backgroundColor: color.value }))}
                style={{ width: 24, height: 24, flexShrink: 0, borderRadius: '50%', background: color.tone,
                  border: selected ? '2px solid var(--color-text)' : '1px solid var(--color-border)',
                  outline: selected ? '2px solid var(--color-surface)' : 'none', outlineOffset: -4, cursor: 'pointer' }} />
            })}
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--color-text)' }}>
            <input type="color" aria-label={t.task_colorCustom} value={customInputColor}
              onChange={event => {
                const color = event.target.value
                if (/^#[0-9a-f]{6}$/i.test(color)) setForm(current => ({ ...current, backgroundColor: color.toLowerCase() }))
              }}
              style={{ width: 36, height: 28, padding: 2, border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', background: 'var(--color-bg)', cursor: 'pointer' }} />
            {t.task_colorCustom}
          </label>

        </fieldset>

        {/* 截止日期 */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2">
            <label style={{ fontSize: 12 }}>{t.taskDrawer_dueDate}</label>
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

        {/* ─── 分割线 ─── */}
        <div style={{ height: 1, background: 'var(--color-border)' }} />

        {/* 子项管理（新建和编辑模式均显示） */}
        <div className="flex flex-col gap-2">
          <label style={{ fontSize: 12 }}>{t.subtask_add}</label>

          {/* 子项列表 */}
          {editTask ? (
            <SubTaskList subTasks={subTasks} taskId={editTask.id} onAddDraftSubTask={saveDraftSubTask} />
          ) : pendingSubTasks.map(sub => (
            <div key={sub.id} style={{ display: 'flex', gap: 6 }}>
              <span style={{ flex: 1 }}>{sub.title}</span>
              <button type="button" title={t.common_delete} onClick={() => handleRemovePending(sub.id)}>×</button>
            </div>
          ))}

          {/* 输入行 */}
          <div style={{ display: 'flex', gap: 6 }}>
            <input
              ref={subtaskInputRef}
              value={subtaskInput}
              onChange={(e) => setSubtaskInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.nativeEvent.isComposing || e.keyCode === 229) return
                if (e.key === 'Enter' && subtaskInput.trim()) {
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

        {/* ─── 分割线 ─── */}
        <div style={{ height: 1, background: 'var(--color-border)' }} />

        {/* 备注 */}
        <div className="flex flex-col gap-1.5">
          <label style={{ fontSize: 12 }}>{t.taskDrawer_notes}</label>
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

        {/* 实际用时（编辑已完成任务时显示） */}
        {editTask && (
          <div className="flex flex-col gap-1.5">
            <label style={{ fontSize: 12 }}>{t.task_actualMinutes}</label>
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
                <span style={{ fontSize: 13 }}>{t.task_minuteUnit}</span>
              </div>
            ) : (
              <div style={{ fontSize: 13, color: 'var(--color-text-dim)', padding: '8px 0' }}>
                {t.task_actualMinutesPlaceholder}
              </div>
            )}
          </div>
        )}

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
