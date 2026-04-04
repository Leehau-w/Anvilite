import React, { useEffect, useRef } from 'react'
import { motion } from 'framer-motion'

interface UndoToastProps {
  message: string
  onUndo: () => void
  onExpire: () => void
  duration?: number
  undoLabel: string
}

export function UndoToast({ message, onUndo, onExpire, duration = 5000, undoLabel }: UndoToastProps) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    timerRef.current = setTimeout(() => {
      onExpire()
    }, duration)
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [duration, onExpire])

  function handleUndo() {
    if (timerRef.current) clearTimeout(timerRef.current)
    onUndo()
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 24, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 16, scale: 0.95 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      style={{
        position: 'fixed',
        bottom: 24,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 9999,
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-lg)',
        boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
        overflow: 'hidden',
        minWidth: 260,
        maxWidth: 360,
      }}
    >
      {/* Content row */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '10px 14px',
        }}
      >
        <span
          style={{
            flex: 1,
            fontSize: 13,
            color: 'var(--color-text)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {message}
        </span>
        <button
          onClick={handleUndo}
          style={{
            fontSize: 12,
            fontWeight: 600,
            padding: '4px 12px',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--color-accent)',
            background: 'color-mix(in srgb, var(--color-accent) 12%, transparent)',
            color: 'var(--color-accent)',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            flexShrink: 0,
            transition: 'all 0.15s',
          }}
        >
          {undoLabel}
        </button>
      </div>

      {/* Progress bar (drains from full → empty over duration) */}
      <motion.div
        initial={{ scaleX: 1 }}
        animate={{ scaleX: 0 }}
        transition={{ duration: duration / 1000, ease: 'linear' }}
        style={{
          height: 2,
          background: 'var(--color-accent)',
          transformOrigin: 'left',
        }}
      />
    </motion.div>
  )
}
