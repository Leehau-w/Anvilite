import React, { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence, Reorder, useDragControls } from 'framer-motion'
import type { SubHabit } from '@/types/habit'
import { useHabitStore } from '@/stores/habitStore'
import type { SubTask } from '@/types/task'
import { useTaskStore } from '@/stores/taskStore'
import { useUIStore } from '@/stores/uiStore'
import { Checkbox } from '@/components/ui/Checkbox'
import { useT } from '@/i18n'
import { useToast } from '@/components/feedback/Toast'

const MAX_DEPTH = 2 // depth 0/1/2 → 最多 3 层

interface SubTaskItemProps {
  subTask: SubTask
  taskId: string
  depth: number
  compact?: boolean
  habit?: boolean
  dragHandle?: React.ReactNode
  onAddDraftSubTask?: (title: string, parentId: string) => boolean
}

export function SubTaskItem({ subTask, taskId, depth, compact, habit = false, dragHandle, onAddDraftSubTask }: SubTaskItemProps) {
  const tasks = useTaskStore()
  const habits = useHabitStore()
  const toggleSubTask = habit ? habits.toggleSubHabit : tasks.toggleSubTask
  const removeSubTask = habit ? habits.removeSubHabit : tasks.removeSubTask
  const editSubTask = habit ? habits.editSubHabit : tasks.editSubTask
  const addSubTask = habit ? habits.addSubHabit : tasks.addSubTask
  const { isTaskCollapsed, toggleTaskCollapse } = useUIStore()
  const t = useT()
  const { showToast } = useToast()
  const childrenExpanded = !isTaskCollapsed(subTask.id)
  const [editing, setEditing] = useState(false)
  const [editValue, setEditValue] = useState(subTask.title)
  const [hovered, setHovered] = useState(false)
  const [addingChild, setAddingChild] = useState(false)
  const [childInput, setChildInput] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const editCommitted = useRef(false)
  const editSaveFailed = useRef(false)
  const childInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editing && inputRef.current) inputRef.current.select()
  }, [editing])

  useEffect(() => {
    if (addingChild && childInputRef.current) childInputRef.current.focus()
  }, [addingChild])

  function handleEditCommit() {
    if (editCommitted.current) return true
    editCommitted.current = true
    const v = editValue.trim()
    try {
      if (v && (v !== subTask.title || editSaveFailed.current)) editSubTask(taskId, subTask.id, v)
      editSaveFailed.current = false
      setEditing(false)
      return true
    } catch {
      editCommitted.current = false
      editSaveFailed.current = true
      showToast(t.activity_actionFailed)
      return false
    }
  }

  function handleChildAdd() {
    const v = childInput.trim()
    if (v) {
      if (onAddDraftSubTask) {
        if (!onAddDraftSubTask(v, subTask.id)) return false
      } else addSubTask(taskId, v, subTask.id)
    }
    setChildInput('')
    setAddingChild(false)
    return true
  }

  return (
    <div style={{ minWidth: 0 }} onClick={e => e.stopPropagation()}>
      <div
        className="group"
        style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '2px 0' }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        {/* 复选框 */}
        {dragHandle}
        <Checkbox
          checked={subTask.completed}
          onChange={() => toggleSubTask(taskId, subTask.id)}
          size={13}
        />

        {/* 子项折叠按钮（有子项时显示） */}
        {subTask.subTasks.length > 0 ? (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); toggleTaskCollapse(subTask.id) }}
            title={childrenExpanded ? t.subtask_collapse : t.subtask_expand}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 2,
              padding: '0 5px',
              height: 16,
              borderRadius: 'var(--radius-sm)',
              border: `1px solid ${childrenExpanded ? 'color-mix(in srgb, var(--color-accent) 30%, var(--color-border))' : 'var(--color-border)'}`,
              background: childrenExpanded ? 'color-mix(in srgb, var(--color-accent) 8%, transparent)' : 'transparent',
              color: childrenExpanded ? 'var(--color-accent)' : 'var(--color-text-dim)',
              cursor: 'pointer',
              fontSize: 10,
              fontFamily: 'var(--font-num)',
              flexShrink: 0,
              transition: 'all 0.15s',
            }}
          >
            <span style={{ fontSize: 8, lineHeight: 1 }}>{childrenExpanded ? '▾' : '▸'}</span>
            <span>{subTask.subTasks.filter(c => c.completed).length}/{subTask.subTasks.length}</span>
          </button>
        ) : (
          <span style={{ width: 0, flexShrink: 0 }} />
        )}

        {/* 常驻添加子项按钮：和父任务行的 + 保持一致 */}
        {depth < MAX_DEPTH && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setAddingChild(true) }}
            title={t.subtask_add}
            style={inlineAddBtnStyle}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = 'var(--color-accent)'
              e.currentTarget.style.borderColor = 'var(--color-accent)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = 'var(--color-text-dim)'
              e.currentTarget.style.borderColor = 'var(--color-border)'
            }}
          >
            +
          </button>
        )}

        {/* 标题 / 编辑框 */}
        {editing ? (
          <input
            ref={inputRef}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={handleEditCommit}
            onKeyDown={(e) => {
              if (e.nativeEvent.isComposing || e.keyCode === 229) return
              if (e.key === 'Enter' && editValue.trim()) {
                e.preventDefault(); e.stopPropagation()
                const form = e.currentTarget.form
                if (handleEditCommit() && form?.hasAttribute('data-task-drawer')) form.focus()
              }
              if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); setEditValue(subTask.title); setEditing(false) }
            }}
            style={{
              flex: 1,
              fontSize: 13,
              padding: '1px 4px',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--color-accent)',
              background: 'var(--color-bg)',
              color: 'var(--color-text)',
              outline: 'none',
            }}
          />
        ) : (
          <span
            onClick={() => { editCommitted.current = false; editSaveFailed.current = false; setEditValue(subTask.title); setEditing(true) }}
            style={{
              flex: 1,
              fontSize: 13,
              color: subTask.completed ? 'var(--color-text-dim)' : 'var(--color-text)',
              textDecoration: subTask.completed ? 'line-through' : 'none',
              cursor: 'text',
              overflowWrap: 'anywhere',
              minWidth: 0,
              userSelect: 'none',
            }}
          >
            {subTask.title}
          </span>
        )}

        {/* hover 操作：删除（compact 模式隐藏） */}
        <AnimatePresence>
          {hovered && !editing && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              style={{ display: 'flex', gap: 3, flexShrink: 0 }}
            >
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); removeSubTask(taskId, subTask.id) }}
                title={t.common_delete}
                style={{ ...iconBtnStyle, color: 'var(--color-danger)' }}
              >
                ×
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* 嵌套子项 */}
      {childrenExpanded && <SubTaskList subTasks={subTask.subTasks} taskId={taskId}
        parentId={subTask.id} depth={depth + 1} compact={compact} habit={habit} onAddDraftSubTask={onAddDraftSubTask} />}

      {/* 添加子项输入框 */}
      {addingChild && (
        <div style={{ marginLeft: 18, marginTop: 2, display: 'flex', gap: 4, alignItems: 'center' }}>
          <input
            ref={childInputRef}
            data-task-child-draft={subTask.id}
            value={childInput}
            onChange={(e) => setChildInput(e.target.value)}
            placeholder={t.subtask_placeholder}
            onKeyDown={(e) => {
              if (e.nativeEvent.isComposing || e.keyCode === 229) return
              if (e.key === 'Enter' && childInput.trim()) {
                e.preventDefault(); e.stopPropagation()
                const form = e.currentTarget.form
                if (handleChildAdd() && form?.hasAttribute('data-task-drawer')) form.focus()
              }
              if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); setChildInput(''); setAddingChild(false) }
            }}
            onBlur={() => { if (!childInput.trim()) setAddingChild(false) }}
            style={{
              flex: 1,
              fontSize: 12,
              height: 24,
              padding: '0 6px',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--color-accent)',
              background: 'var(--color-bg)',
              color: 'var(--color-text)',
              outline: 'none',
            }}
          />
          <button
            type="button"
            onClick={handleChildAdd}
            style={{ ...iconBtnStyle, color: 'var(--color-success)', border: '1px solid var(--color-success)' }}
          >
            ✓
          </button>
          <button
            type="button"
            onClick={() => { setChildInput(''); setAddingChild(false) }}
            style={iconBtnStyle}
          >
            ✕
          </button>
        </div>
      )}
    </div>
  )
}

interface SubTaskListProps {
  subTasks: SubTask[]
  taskId: string
  parentId?: string | null
  depth?: number
  compact?: boolean
  habit?: boolean
  onAddDraftSubTask?: (title: string, parentId: string) => boolean
}

export function SubTaskList({ subTasks, taskId, parentId = null, depth = 0, compact, habit = false, onAddDraftSubTask }: SubTaskListProps) {
  const reorderTasks = useTaskStore(s => s.reorderSubTasks)
  const reorderHabits = useHabitStore(s => s.reorderSubHabits)
  if (!subTasks.length) return null
  return <Reorder.Group axis="y" values={subTasks.map(s => s.id)}
    onReorder={ids => (habit ? reorderHabits : reorderTasks)(taskId, parentId, ids)}
    onPointerDown={e => e.stopPropagation()} onClick={e => e.stopPropagation()}
    style={{ listStyle: 'none', padding: 0, margin: 0, marginLeft: depth > 0 ? 18 : 0 }}>
    {subTasks.map(subTask => <SortableSubTask key={subTask.id} subTask={subTask}
      taskId={taskId} depth={depth} compact={compact} habit={habit} onAddDraftSubTask={onAddDraftSubTask} />)}
  </Reorder.Group>
}

function SortableSubTask(props: SubTaskItemProps) {
  const controls = useDragControls()
  const t = useT()
  return <Reorder.Item value={props.subTask.id} dragListener={false} dragControls={controls}
    style={{ position: 'relative', listStyle: 'none' }}>
    <SubTaskItem {...props} dragHandle={<button type="button" title={t.subtask_reorder}
      aria-label={t.subtask_reorder} onPointerDown={e => { e.stopPropagation(); controls.start(e) }}
      style={{ width: 18, height: 22, flexShrink: 0, border: 'none', background: 'transparent',
        color: 'var(--color-text-dim)', cursor: 'grab', touchAction: 'none', padding: 0 }}>
      ⠿
    </button>} />
  </Reorder.Item>
}

function asTask(sub: SubHabit): SubTask {
  return { ...sub, subTasks: sub.subHabits.map(asTask) }
}

export function SubHabitList({ subHabits, habitId }: { subHabits: SubHabit[]; habitId: string }) {
  return <SubTaskList subTasks={subHabits.map(asTask)} taskId={habitId} habit />
}

const iconBtnStyle: React.CSSProperties = {
  width: 18,
  height: 18,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: 12,
  background: 'transparent',
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius-sm)',
  color: 'var(--color-text-dim)',
  cursor: 'pointer',
  padding: 0,
  lineHeight: 1,
}

const inlineAddBtnStyle: React.CSSProperties = {
  width: 18,
  height: 18,
  borderRadius: 'var(--radius-sm)',
  color: 'var(--color-text-dim)',
  fontSize: 13,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'transparent',
  border: '1px solid var(--color-border)',
  cursor: 'pointer',
  padding: 0,
  flexShrink: 0,
  lineHeight: 1,
  transition: 'all 0.15s',
}
