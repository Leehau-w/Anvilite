import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useInspirationStore } from '@/stores/inspirationStore'
import { useTaskStore } from '@/stores/taskStore'
import { useToast } from '@/components/feedback/Toast'
import { useT } from '@/i18n'
import type { Inspiration } from '@/types/inspiration'

export function InspirationCard({ onOpenModal }: { onOpenModal?: () => void }) {
  const { inspirations, deleteInspiration, markConverted } = useInspirationStore()
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
        <p style={{ fontSize: 12, color: 'var(--color-text-dim)', textAlign: 'center', lineHeight: 1.5, margin: 0 }}>
          {t.inspiration_empty}
        </p>
        {onOpenModal && (
          <button
            onClick={onOpenModal}
            style={{ fontSize: 12, color: 'var(--color-accent)', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px' }}
          >
            + {t.inspiration_save}
          </button>
        )}
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '8px 12px',
        borderBottom: '1px solid var(--color-border)',
        flexShrink: 0,
      }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)' }}>
          💡 {t.inspiration_list}
          {unconverted.length > 0 && (
            <span style={{ marginLeft: 6, fontSize: 11, color: 'var(--color-text-dim)' }}>({unconverted.length})</span>
          )}
        </span>
        {onOpenModal && (
          <button
            onClick={onOpenModal}
            style={{ fontSize: 11, color: 'var(--color-accent)', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 6px' }}
          >
            +
          </button>
        )}
      </div>

      {/* List */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '4px 0' }}>
        <AnimatePresence mode="popLayout">
          {unconverted.map((item) => (
            <InspirationRow
              key={item.id}
              item={item}
              onConvert={handleConvert}
              onDelete={() => deleteInspiration(item.id)}
              t={t}
            />
          ))}
        </AnimatePresence>
        {unconverted.length === 0 && (
          <p style={{ fontSize: 12, color: 'var(--color-text-dim)', textAlign: 'center', padding: '16px 0' }}>
            {t.inspiration_converted} ✓
          </p>
        )}
      </div>
    </div>
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
  onDelete: () => void
  t: ReturnType<typeof useT>
}) {
  const [hovered, setHovered] = useState(false)

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
          gap: 6,
          padding: '6px 12px',
          background: hovered ? 'var(--color-surface-hover)' : 'transparent',
          transition: 'background 0.1s',
        }}
      >
        <span style={{ fontSize: 11, color: 'var(--color-text-dim)', marginTop: 2, flexShrink: 0 }}>💡</span>
        <span style={{ flex: 1, fontSize: 12, color: 'var(--color-text)', lineHeight: 1.5, wordBreak: 'break-word' }}>
          {item.content}
        </span>
        {hovered && (
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
    </motion.div>
  )
}
