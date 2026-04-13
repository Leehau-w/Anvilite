import React, { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { SubTask } from '@/types/task'
import { useTaskStore } from '@/stores/taskStore'

const MAX_DEPTH = 2 // depth 0/1/2 → 最多 3 层

interface SubTaskItemProps {
  subTask: SubTask
  taskId: string
  depth: number
}

export function SubTaskItem({ subTask, taskId, depth }: SubTaskItemProps) {
  const { toggleSubTask, removeSubTask, editSubTask, addSubTask } = useTaskStore()
  const [editing, setEditing] = useState(false)
  const [editValue, setEditValue] = useState(subTask.title)
  const [hovered, setHovered] = useState(false)
  const [addingChild, setAddingChild] = useState(false)
  const [childInput, setChildInput] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const childInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editing && inputRef.current) inputRef.current.select()
  }, [editing])

  useEffect(() => {
    if (addingChild && childInputRef.current) childInputRef.current.focus()
  }, [addingChild])

  function handleEditCommit() {
    const v = editValue.trim()
    if (v && v !== subTask.title) editSubTask(taskId, subTask.id, v)
    setEditing(false)
  }

  function handleChildAdd() {
    const v = childInput.trim()
    if (v) addSubTask(taskId, v, subTask.id)
    setChildInput('')
    setAddingChild(false)
  }

  return (
    <div style={{ marginLeft: depth * 18 }}>
      <div
        className="group"
        style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '2px 0' }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        {/* 复选框 */}
        <input
          type="checkbox"
          checked={subTask.completed}
          onChange={() => toggleSubTask(taskId, subTask.id)}
          style={{
            width: 13,
            height: 13,
            flexShrink: 0,
            cursor: 'pointer',
            accentColor: 'var(--color-accent)',
          }}
        />

        {/* 标题 / 编辑框 */}
        {editing ? (
          <input
            ref={inputRef}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={handleEditCommit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleEditCommit()
              if (e.key === 'Escape') { setEditValue(subTask.title); setEditing(false) }
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
            onClick={() => setEditing(true)}
            style={{
              flex: 1,
              fontSize: 13,
              color: subTask.completed ? 'var(--color-text-dim)' : 'var(--color-text)',
              textDecoration: subTask.completed ? 'line-through' : 'none',
              cursor: 'pointer',
              userSelect: 'none',
            }}
          >
            {subTask.title}
          </span>
        )}

        {/* hover 操作：添加子项 + 删除 */}
        <AnimatePresence>
          {hovered && !editing && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              style={{ display: 'flex', gap: 3, flexShrink: 0 }}
            >
              {depth < MAX_DEPTH && (
                <button
                  onClick={(e) => { e.stopPropagation(); setAddingChild(true) }}
                  title="添加子步骤"
                  style={iconBtnStyle}
                >
                  +
                </button>
              )}
              <button
                onClick={(e) => { e.stopPropagation(); removeSubTask(taskId, subTask.id) }}
                title="删除"
                style={{ ...iconBtnStyle, color: 'var(--color-danger)' }}
              >
                ×
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* 嵌套子项 */}
      {subTask.subTasks.map((child) => (
        <SubTaskItem key={child.id} subTask={child} taskId={taskId} depth={depth + 1} />
      ))}

      {/* 添加子步骤输入框 */}
      {addingChild && (
        <div style={{ marginLeft: (depth + 1) * 18, marginTop: 2, display: 'flex', gap: 4, alignItems: 'center' }}>
          <input
            ref={childInputRef}
            value={childInput}
            onChange={(e) => setChildInput(e.target.value)}
            placeholder="添加子步骤…"
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleChildAdd()
              if (e.key === 'Escape') { setChildInput(''); setAddingChild(false) }
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
            onClick={handleChildAdd}
            style={{ ...iconBtnStyle, color: 'var(--color-success)', border: '1px solid var(--color-success)' }}
          >
            ✓
          </button>
          <button
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
