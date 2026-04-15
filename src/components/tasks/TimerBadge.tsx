import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { getElapsedSeconds, formatElapsed } from '@/engines/timerEngine'

interface TimerBadgeProps {
  startedAt: string | null
  accumulated: number
  onToggle: () => void
}

export function TimerBadge({ startedAt, accumulated, onToggle }: TimerBadgeProps) {
  const isRunning = !!startedAt
  const [display, setDisplay] = useState(() => formatElapsed(getElapsedSeconds(startedAt, accumulated)))

  useEffect(() => {
    setDisplay(formatElapsed(getElapsedSeconds(startedAt, accumulated)))
    if (!startedAt) return
    const interval = setInterval(() => {
      setDisplay(formatElapsed(getElapsedSeconds(startedAt, accumulated)))
    }, 1000)
    return () => clearInterval(interval)
  }, [startedAt, accumulated])

  return (
    <button
      onClick={(e) => { e.stopPropagation(); onToggle() }}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        padding: '2px 8px',
        borderRadius: 'var(--radius-sm)',
        border: 'none',
        background: isRunning
          ? 'color-mix(in srgb, var(--color-accent) 10%, transparent)'
          : 'transparent',
        color: isRunning ? 'var(--color-accent)' : 'var(--color-text-dim)',
        fontSize: 11,
        fontFamily: 'var(--font-num)',
        fontWeight: 600,
        cursor: 'pointer',
        whiteSpace: 'nowrap',
        flexShrink: 0,
      }}
    >
      {isRunning && (
        <motion.span
          animate={{ scale: [1, 1.3, 1], opacity: [1, 0.5, 1] }}
          transition={{ duration: 1.5, repeat: Infinity }}
          style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: 'var(--color-accent)',
            display: 'inline-block',
            flexShrink: 0,
          }}
        />
      )}
      {display}
    </button>
  )
}
