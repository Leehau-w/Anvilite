import React, { useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

interface CollapsibleGroupProps {
  label: string
  count: number
  children: React.ReactNode
  defaultOpen?: boolean
  onRename?: (newName: string) => void
  onDelete?: () => void
}

export function CollapsibleGroup({
  label,
  count,
  children,
  defaultOpen = true,
  onRename,
  onDelete,
}: CollapsibleGroupProps) {
  const [open, setOpen] = useState(defaultOpen)
  const [hovered, setHovered] = useState(false)
  const [renaming, setRenaming] = useState(false)
  const [renameValue, setRenameValue] = useState(label)
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  function startRename() {
    setRenameValue(label)
    setRenaming(true)
    setTimeout(() => inputRef.current?.focus(), 0)
  }

  function commitRename() {
    const trimmed = renameValue.trim()
    if (trimmed && trimmed !== label && onRename) {
      onRename(trimmed)
    }
    setRenaming(false)
  }

  function handleRenameKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault()
      commitRename()
    } else if (e.key === 'Escape') {
      setRenaming(false)
    }
  }

  function handleDelete() {
    if (!deleteConfirm) {
      setDeleteConfirm(true)
      setTimeout(() => setDeleteConfirm(false), 2500)
    } else {
      onDelete?.()
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      {/* Header */}
      <div
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => { setHovered(false); setDeleteConfirm(false) }}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '4px 0',
          cursor: 'pointer',
          userSelect: 'none',
        }}
      >
        {/* Chevron */}
        <motion.span
          animate={{ rotate: open ? 0 : -90 }}
          transition={{ duration: 0.15 }}
          onClick={() => setOpen((v) => !v)}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            color: 'var(--color-text-dim)',
            fontSize: 10,
            flexShrink: 0,
          }}
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
            <path d="M2 3l3 4 3-4H2z" />
          </svg>
        </motion.span>

        {/* Label / Rename input */}
        {renaming ? (
          <input
            ref={inputRef}
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onBlur={commitRename}
            onKeyDown={handleRenameKeyDown}
            style={{
              fontSize: 12,
              fontWeight: 600,
              letterSpacing: '0.02em',
              color: 'var(--color-text)',
              background: 'var(--color-surface-hover)',
              border: '1px solid var(--color-accent)',
              borderRadius: 'var(--radius-sm)',
              padding: '1px 6px',
              outline: 'none',
              flex: 1,
              minWidth: 0,
            }}
          />
        ) : (
          <span
            onClick={() => setOpen((v) => !v)}
            style={{
              fontSize: 12,
              fontWeight: 600,
              letterSpacing: '0.02em',
              color: 'var(--color-text-dim)',
              flex: 1,
              minWidth: 0,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {label}
          </span>
        )}

        {/* Count badge */}
        <span
          style={{
            fontSize: 11,
            color: 'var(--color-text-dim)',
            background: 'var(--color-surface-hover)',
            padding: '1px 6px',
            borderRadius: 'var(--radius-full)',
            flexShrink: 0,
          }}
        >
          {count}
        </span>

        {/* Rename / Delete buttons (hover only) */}
        <AnimatePresence>
          {hovered && !renaming && (onRename || onDelete) && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.1 }}
              style={{ display: 'flex', gap: 4, alignItems: 'center', flexShrink: 0 }}
            >
              {onRename && (
                <button
                  onClick={(e) => { e.stopPropagation(); startRename() }}
                  style={{
                    fontSize: 10,
                    padding: '2px 6px',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--color-border)',
                    background: 'transparent',
                    color: 'var(--color-text-dim)',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                  }}
                >
                  ✏️
                </button>
              )}
              {onDelete && (
                <button
                  onClick={(e) => { e.stopPropagation(); handleDelete() }}
                  style={{
                    fontSize: 10,
                    padding: '2px 6px',
                    borderRadius: 'var(--radius-sm)',
                    border: `1px solid ${deleteConfirm ? 'var(--color-danger)' : 'var(--color-border)'}`,
                    background: deleteConfirm ? 'color-mix(in srgb, var(--color-danger) 10%, transparent)' : 'transparent',
                    color: deleteConfirm ? 'var(--color-danger)' : 'var(--color-text-dim)',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    transition: 'all 0.15s',
                  }}
                >
                  {deleteConfirm ? '确认' : '🗑️'}
                </button>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Collapsible content */}
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            style={{ overflow: 'hidden' }}
          >
            <div style={{ paddingBottom: 4 }}>
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
