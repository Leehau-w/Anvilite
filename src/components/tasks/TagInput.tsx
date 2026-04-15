import React, { useState, useRef, useEffect } from 'react'
import { TagPill } from './TagPill'
import { useT } from '@/i18n'

interface TagInputProps {
  tags: string[]
  allTags: string[]
  onChange: (tags: string[]) => void
  maxTags?: number
}

export function TagInput({ tags, allTags, onChange, maxTags = 5 }: TagInputProps) {
  const t = useT()
  const [adding, setAdding] = useState(false)
  const [input, setInput] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (adding && inputRef.current) inputRef.current.focus()
  }, [adding])

  const suggestions = input.trim()
    ? allTags.filter((t) => t.toLowerCase().includes(input.toLowerCase()) && !tags.includes(t)).slice(0, 5)
    : []

  function addTag(tag: string) {
    const trimmed = tag.trim().slice(0, 20)
    if (!trimmed || tags.includes(trimmed)) return
    if (tags.length >= maxTags) return
    onChange([...tags, trimmed])
    setInput('')
    setAdding(false)
  }

  function removeTag(tag: string) {
    onChange(tags.filter((t) => t !== tag))
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'center' }}>
        {tags.map((tag) => (
          <TagPill key={tag} tag={tag} size="md" onRemove={() => removeTag(tag)} />
        ))}
        {tags.length < maxTags && !adding && (
          <button
            type="button"
            onClick={() => setAdding(true)}
            style={{
              fontSize: 12,
              color: 'var(--color-text-dim)',
              background: 'none',
              border: '1px dashed var(--color-border)',
              borderRadius: 'var(--radius-full)',
              padding: '3px 10px',
              cursor: 'pointer',
            }}
          >
            + {t.tag_add}
          </button>
        )}
        {tags.length >= maxTags && !adding && (
          <span style={{ fontSize: 11, color: 'var(--color-text-dim)' }}>{t.tag_maxReached}</span>
        )}
      </div>

      {adding && (
        <div style={{ position: 'relative' }}>
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); addTag(input) }
              if (e.key === 'Escape') { setInput(''); setAdding(false) }
            }}
            onBlur={() => { if (!input.trim()) setTimeout(() => setAdding(false), 150) }}
            placeholder={t.tag_placeholder}
            style={{
              width: '100%',
              height: 32,
              padding: '0 10px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-accent)',
              background: 'var(--color-bg)',
              color: 'var(--color-text)',
              fontSize: 13,
              outline: 'none',
            }}
          />
          {suggestions.length > 0 && (
            <div
              style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                right: 0,
                marginTop: 4,
                background: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-md)',
                boxShadow: 'var(--shadow-md)',
                zIndex: 10,
                overflow: 'hidden',
              }}
            >
              {suggestions.map((s) => (
                <button
                  key={s}
                  onMouseDown={(e) => { e.preventDefault(); addTag(s) }}
                  style={{
                    display: 'block',
                    width: '100%',
                    textAlign: 'left',
                    padding: '6px 10px',
                    fontSize: 13,
                    color: 'var(--color-text)',
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                  }}
                  onMouseEnter={(e) => { (e.target as HTMLElement).style.background = 'var(--color-surface-hover)' }}
                  onMouseLeave={(e) => { (e.target as HTMLElement).style.background = 'transparent' }}
                >
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
