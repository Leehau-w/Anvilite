import React, { useMemo, useRef, useState } from 'react'
import { useTaskStore } from '@/stores/taskStore'
import { useAreaStore } from '@/stores/areaStore'
import { useT } from '@/i18n'
import { categoryDisplay, getAreaDisplayName } from '@/utils/area'

interface QuickInputProps {
  onOpenDrawer?: (category?: string) => void
  placeholder?: string
  defaultCategory?: string
  categorySelectionVersion?: number
}

export function QuickInput({ onOpenDrawer, placeholder, defaultCategory, categorySelectionVersion = 0 }: QuickInputProps) {
  const [value, setValue] = useState('')
  const { addTask, lastCategory } = useTaskStore()
  const areas = useAreaStore(s => s.areas)
  const basis = defaultCategory ?? lastCategory
  const [selection, setSelection] = useState({ basis, version: categorySelectionVersion, category: basis })
  const composing = useRef(false)
  const t = useT()
  const categories = useMemo(() => [...new Set([
    ...areas.filter(area => area.category !== '_milestone').map(area => area.category), 'other',
  ])], [areas])
  const preferred = selection.basis === basis && selection.version === categorySelectionVersion ? selection.category : basis
  const category = categories.includes(preferred) ? preferred : categories.includes(basis) ? basis : 'other'
  const categoryLabel = (id: string) => {
    const area = areas.find(item => item.category === id)
    return area ? getAreaDisplayName(area, t) : categoryDisplay(id, t)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (composing.current || e.nativeEvent.isComposing || e.keyCode === 229) return
    if (e.key === 'Enter') {
      e.preventDefault()
      if (!value.trim()) return
      addTask({ title: value.trim(), category })
      setValue('')
    }
    if (e.key === 'Escape') setValue('')
  }

  return (
    <div className="flex items-center gap-2" style={{ minWidth: 0 }}>
      <div className="flex-1 flex items-center gap-2" style={{ minWidth: 0, height: 36, padding: '0 10px',
        borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', background: 'var(--color-bg)',
        transition: 'border-color 0.15s, box-shadow 0.15s' }}
        onFocusCapture={e => {
          e.currentTarget.style.borderColor = 'var(--color-accent)'
          e.currentTarget.style.boxShadow = '0 0 0 3px color-mix(in srgb, var(--color-accent) 15%, transparent)'
        }}
        onBlurCapture={e => {
          e.currentTarget.style.borderColor = 'var(--color-border)'
          e.currentTarget.style.boxShadow = 'none'
        }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-dim)" strokeWidth="2" style={{ flexShrink: 0 }}>
          <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
        </svg>
        <input value={value} onChange={e => setValue(e.target.value)} onKeyDown={handleKeyDown}
          onCompositionStart={() => { composing.current = true }} onCompositionEnd={() => { composing.current = false }}
          placeholder={placeholder ?? t.quickInput_placeholder}
          style={{ flex: 1, minWidth: 0, background: 'transparent', border: 'none', outline: 'none', fontSize: 14,
            color: 'var(--color-text)', fontFamily: 'var(--font-zh)' }} />
      </div>
      <label style={{ display: 'flex', alignItems: 'center', gap: 4, height: 36, flexShrink: 0, maxWidth: '44%',
        padding: '0 8px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)',
        background: 'var(--color-bg)', color: 'var(--color-text-dim)', fontSize: 12 }} title={categoryLabel(category)}>
        <select aria-label={t.quickInput_category} value={category} onChange={e => setSelection({ basis, version: categorySelectionVersion, category: e.target.value })}
          style={{ minWidth: 0, maxWidth: 110, border: 'none', background: 'var(--color-bg)', color: 'var(--color-text)',
            outline: 'none', fontSize: 12, cursor: 'pointer', textOverflow: 'ellipsis' }}>
          {categories.map(id => <option key={id} value={id}>{categoryLabel(id)}</option>)}
        </select>
      </label>
      {onOpenDrawer && (
        <button type="button" onClick={() => onOpenDrawer(category)} title={t.quickInput_full}
          style={{ width: 36, height: 36, flexShrink: 0, borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)',
            background: 'transparent', color: 'var(--color-text-dim)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
          </svg>
        </button>
      )}
    </div>
  )
}
