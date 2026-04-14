import React, { useState, useRef, useEffect } from 'react'
import { Reorder, useDragControls } from 'framer-motion'
import { useInspirationStore } from '@/stores/inspirationStore'
import { useTaskStore } from '@/stores/taskStore'
import { useToast } from '@/components/feedback/Toast'
import { useT } from '@/i18n'
import type { Inspiration } from '@/types/inspiration'

export function InspirationCard({ onOpenModal }: { onOpenModal?: () => void }) {
  const { inspirations, deleteInspiration, markConverted, updateInspiration, reorderInspirations } = useInspirationStore()
  const { addTask } = useTaskStore()
  const { showToast } = useToast()
  const t = useT()

  const unconverted = inspirations.filter((i) => !i.convertedTaskId)

  function handleConvert(item: Inspiration) {
    const task = addTask({ title: item.content, category: 'other' })
    markConverted(item.id, task.id)
    showToast(t.inspiration_converted)
  }

  if (inspirations.length === 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 8 }}>
        <span style={{ fontSize: 24 }}>💡</span>
        <p style={{ fontSize: 12, color: 'var(--color-text-dim)', textAlign: 'center', lineHeight: 1.5, margin: 0, padding: '0 8px' }}>
          {t.inspiration_empty}
        </p>
      </div>
    )
  }

  return (
    <div style={{ overflowY: 'auto', height: '100%', scrollbarWidth: 'thin', scrollbarColor: 'var(--color-border) transparent' }}>
      <Reorder.Group
        axis="y"
        values={unconverted}
        onReorder={(items) => reorderInspirations(items.map((i) => i.id))}
        style={{ listStyle: 'none', margin: 0, padding: 0 }}
      >
        {unconverted.map((item) => (
          <InspirationRow
            key={item.id}
            item={item}
            onConvert={handleConvert}
            onDelete={() => deleteInspiration(item.id)}
            onUpdate={(content) => updateInspiration(item.id, content)}
            t={t}
          />
        ))}
      </Reorder.Group>
      {unconverted.length === 0 && inspirations.length > 0 && (
        <p style={{ fontSize: 12, color: 'var(--color-text-dim)', textAlign: 'center', padding: '16px 0' }}>
          {t.inspiration_allConverted} ✓
        </p>
      )}
    </div>
  )
}

function InspirationRow({
  item,
  onConvert,
  onDelete,
  onUpdate,
  t,
}: {
  item: Inspiration
  onConvert: (item: Inspiration) => void
  onDelete: () => void
  onUpdate: (content: string) => void
  t: ReturnType<typeof useT>
}) {
  const [hovered, setHovered] = useState(false)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(item.content)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const dragControls = useDragControls()

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus()
      inputRef.current?.select()
    }
  }, [editing])

  function commitEdit() {
    const trimmed = draft.trim()
    if (trimmed && trimmed !== item.content) onUpdate(trimmed)
    else setDraft(item.content)
    setEditing(false)
  }

  function cancelEdit() {
    setDraft(item.content)
    setEditing(false)
  }

  return (
    <Reorder.Item value={item} dragListener={false} dragControls={dragControls} style={{ listStyle: 'none' }}>
      <div
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: 4,
          padding: '6px 2px',
          borderBottom: '1px solid var(--color-border)',
          background: editing || hovered ? 'var(--color-surface-hover)' : 'transparent',
          transition: 'background 0.1s',
        }}
      >
        {/* 拖拽把手 */}
        <span
          onPointerDown={(e) => { e.preventDefault(); dragControls.start(e) }}
          style={{
            fontSize: 11, color: 'var(--color-border)', cursor: 'grab',
            flexShrink: 0, marginTop: editing ? 6 : 3,
            opacity: hovered ? 1 : 0, transition: 'opacity 0.1s',
            userSelect: 'none',
          }}
        >
          ⠿
        </span>

        {editing ? (
          <textarea
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commitEdit}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); commitEdit() }
              if (e.key === 'Escape') cancelEdit()
            }}
            rows={2}
            style={{
              flex: 1, fontSize: 12, color: 'var(--color-text)', lineHeight: 1.5,
              background: 'transparent', border: 'none', outline: 'none',
              resize: 'none', fontFamily: 'var(--font-zh)', padding: 0,
            }}
          />
        ) : (
          <span
            onClick={() => { setDraft(item.content); setEditing(true) }}
            style={{ flex: 1, fontSize: 12, color: 'var(--color-text)', lineHeight: 1.5, wordBreak: 'break-word', cursor: 'text' }}
          >
            {item.content}
          </span>
        )}

        {!editing && hovered && (
          <div style={{ display: 'flex', gap: 3, flexShrink: 0 }}>
            <button
              onClick={() => onConvert(item)}
              title={t.inspiration_convertToTask}
              style={{ fontSize: 11, padding: '2px 6px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-accent)', background: 'none', color: 'var(--color-accent)', cursor: 'pointer' }}
            >
              →
            </button>
            <button
              onClick={onDelete}
              style={{ fontSize: 11, padding: '2px 5px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)', background: 'none', color: 'var(--color-text-dim)', cursor: 'pointer' }}
            >
              ×
            </button>
          </div>
        )}
      </div>
    </Reorder.Item>
  )
}
