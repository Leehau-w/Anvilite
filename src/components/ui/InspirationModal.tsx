import React, { useState, useEffect, useRef } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useInspirationStore } from '@/stores/inspirationStore'
import { useTaskStore } from '@/stores/taskStore'
import { useToast } from '@/components/feedback/Toast'
import { useT } from '@/i18n'
import type { Inspiration } from '@/types/inspiration'

interface InspirationModalProps {
  open: boolean
  onClose: () => void
}

export function InspirationModal({ open, onClose }: InspirationModalProps) {
  const { inspirations, addInspiration, deleteInspiration, markConverted } = useInspirationStore()
  const { addTask } = useTaskStore()
  const { showToast } = useToast()
  const t = useT()

  const [input, setInput] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (open) {
      setTimeout(() => textareaRef.current?.focus(), 50)
    } else {
      setInput('')
    }
  }, [open])

  function handleSave() {
    const trimmed = input.trim()
    if (!trimmed) return
    addInspiration(trimmed)
    setInput('')
    textareaRef.current?.focus()
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault()
      handleSave()
    }
    if (e.key === 'Escape') {
      onClose()
    }
  }

  function handleConvertToTask(item: Inspiration) {
    if (item.convertedTaskId) return
    const task = addTask({ title: item.content, category: 'other' })
    markConverted(item.id, task.id)
    showToast(t.inspiration_converted)
  }

  function handleDelete(id: string) {
    deleteInspiration(id)
  }

  const unconverted = inspirations.filter((i) => !i.convertedTaskId)
  const converted = inspirations.filter((i) => !!i.convertedTaskId)

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={onClose}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0,0,0,0.25)',
              zIndex: 300,
            }}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -8 }}
            transition={{ duration: 0.18, ease: [0.34, 1.56, 0.64, 1] }}
            style={{
              position: 'fixed',
              top: '15%',
              left: '50%',
              transform: 'translateX(-50%)',
              width: 480,
              maxWidth: 'calc(100vw - 32px)',
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-lg)',
              boxShadow: '0 16px 48px rgba(0,0,0,0.18)',
              zIndex: 301,
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              maxHeight: '70vh',
            }}
          >
            {/* Header */}
            <div style={{
              padding: '14px 16px 10px',
              borderBottom: '1px solid var(--color-border)',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}>
              <span style={{ fontSize: 16 }}>💡</span>
              <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--color-text)' }}>
                {t.inspiration_title}
              </span>
              <button
                onClick={onClose}
                style={{
                  marginLeft: 'auto',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--color-text-dim)',
                  fontSize: 18,
                  lineHeight: 1,
                  padding: '0 2px',
                }}
              >
                ×
              </button>
            </div>

            {/* Input area */}
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--color-border)' }}>
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={t.inspiration_placeholder}
                rows={3}
                style={{
                  width: '100%',
                  resize: 'none',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-md)',
                  padding: '8px 10px',
                  fontSize: 14,
                  color: 'var(--color-text)',
                  background: 'var(--color-bg)',
                  outline: 'none',
                  fontFamily: 'var(--font-zh)',
                  lineHeight: 1.6,
                  boxSizing: 'border-box',
                }}
              />
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
                <button
                  onClick={handleSave}
                  disabled={!input.trim()}
                  style={{
                    padding: '6px 16px',
                    borderRadius: 'var(--radius-md)',
                    border: 'none',
                    background: input.trim() ? 'var(--color-accent)' : 'var(--color-border)',
                    color: input.trim() ? '#fff' : 'var(--color-text-dim)',
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: input.trim() ? 'pointer' : 'default',
                    transition: 'all 0.15s',
                  }}
                >
                  {t.inspiration_save} ⌘↵
                </button>
              </div>
            </div>

            {/* List */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
              {inspirations.length === 0 ? (
                <p style={{ textAlign: 'center', fontSize: 12, color: 'var(--color-text-dim)', padding: '24px 16px' }}>
                  {t.inspiration_empty}
                </p>
              ) : (
                <>
                  <AnimatePresence mode="popLayout">
                    {unconverted.map((item) => (
                      <InspirationRow
                        key={item.id}
                        item={item}
                        onConvert={handleConvertToTask}
                        onDelete={handleDelete}
                        t={t}
                      />
                    ))}
                  </AnimatePresence>
                  {converted.length > 0 && (
                    <details style={{ padding: '4px 16px' }}>
                      <summary style={{ fontSize: 11, color: 'var(--color-text-dim)', cursor: 'pointer', userSelect: 'none' }}>
                        {t.inspiration_converted} ({converted.length})
                      </summary>
                      <AnimatePresence mode="popLayout">
                        {converted.map((item) => (
                          <InspirationRow
                            key={item.id}
                            item={item}
                            onConvert={handleConvertToTask}
                            onDelete={handleDelete}
                            t={t}
                          />
                        ))}
                      </AnimatePresence>
                    </details>
                  )}
                </>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

function InspirationRow({
  item,
  onConvert,
  onDelete,
  t,
}: {
  item: Inspiration
  onConvert: (item: Inspiration) => void
  onDelete: (id: string) => void
  t: ReturnType<typeof useT>
}) {
  const [hovered, setHovered] = useState(false)
  const isConverted = !!item.convertedTaskId

  return (
    <motion.div
      layout
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      style={{ overflow: 'hidden' }}
    >
      <div
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: 8,
          padding: '8px 16px',
          background: hovered ? 'var(--color-surface-hover)' : 'transparent',
          opacity: isConverted ? 0.5 : 1,
          transition: 'background 0.1s',
        }}
      >
        <span style={{ fontSize: 12, color: 'var(--color-text-dim)', marginTop: 2, flexShrink: 0 }}>💡</span>
        <span style={{
          flex: 1,
          fontSize: 13,
          color: 'var(--color-text)',
          lineHeight: 1.5,
          textDecoration: isConverted ? 'line-through' : 'none',
          wordBreak: 'break-word',
        }}>
          {item.content}
        </span>
        {hovered && (
          <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
            {!isConverted && (
              <button
                onClick={() => onConvert(item)}
                title={t.inspiration_convertToTask}
                style={{
                  fontSize: 11,
                  padding: '3px 8px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--color-accent)',
                  background: 'color-mix(in srgb, var(--color-accent) 8%, transparent)',
                  color: 'var(--color-accent)',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                {t.inspiration_convertToTask}
              </button>
            )}
            <button
              onClick={() => onDelete(item.id)}
              title={t.inspiration_deleteConfirm}
              style={{
                fontSize: 11,
                padding: '3px 6px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--color-border)',
                background: 'transparent',
                color: 'var(--color-text-dim)',
                cursor: 'pointer',
              }}
            >
              ×
            </button>
          </div>
        )}
      </div>
    </motion.div>
  )
}
