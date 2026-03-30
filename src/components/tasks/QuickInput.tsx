import React, { useState } from 'react'
import { useTaskStore } from '@/stores/taskStore'
import { useT } from '@/i18n'

interface QuickInputProps {
  onOpenDrawer?: () => void
  placeholder?: string
  defaultCategory?: string
}

export function QuickInput({ onOpenDrawer, placeholder, defaultCategory }: QuickInputProps) {
  const [value, setValue] = useState('')
  const { addTask, lastCategory } = useTaskStore()
  const t = useT()
  const effectivePlaceholder = placeholder ?? t.quickInput_placeholder

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && value.trim()) {
      addTask({ title: value.trim(), category: defaultCategory ?? lastCategory })
      setValue('')
    }
    if (e.key === 'Escape') {
      setValue('')
    }
  }

  return (
    <div className="flex items-center gap-2">
      <div
        className="flex-1 flex items-center gap-2"
        style={{
          height: 36,
          padding: '0 12px',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--color-border)',
          background: 'var(--color-bg)',
          transition: 'border-color 0.15s, box-shadow 0.15s',
        }}
        onFocusCapture={(e) => {
          const el = e.currentTarget
          el.style.borderColor = 'var(--color-accent)'
          el.style.boxShadow = '0 0 0 3px color-mix(in srgb, var(--color-accent) 15%, transparent)'
        }}
        onBlurCapture={(e) => {
          const el = e.currentTarget
          el.style.borderColor = 'var(--color-border)'
          el.style.boxShadow = 'none'
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-dim)" strokeWidth="2">
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={effectivePlaceholder}
          style={{
            flex: 1,
            background: 'transparent',
            border: 'none',
            outline: 'none',
            fontSize: 14,
            color: 'var(--color-text)',
            fontFamily: 'var(--font-zh)',
          }}
        />
      </div>

      {onOpenDrawer && (
        <button
          onClick={onOpenDrawer}
          title={t.quickInput_full}
          style={{
            width: 36,
            height: 36,
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--color-border)',
            background: 'transparent',
            color: 'var(--color-text-dim)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
          </svg>
        </button>
      )}
    </div>
  )
}
