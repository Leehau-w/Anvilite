import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useT } from '@/i18n'
import { zh } from '@/i18n/zh'
import { en } from '@/i18n/en'
import { useAreaStore } from '@/stores/areaStore'
import { getAreaDisplayName, migrateCategory } from '@/utils/area'

/** Uses the existing shared category list, so tasks, habits and card filters stay in sync. */
export function CategoryCreator({ onCreated, compact = false }: { onCreated: (category: string) => void; compact?: boolean }) {
  const t = useT()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const dialogRef = useRef<HTMLFormElement>(null)
  const composing = useRef(false)

  useEffect(() => {
    if (!open) return
    inputRef.current?.focus()
    return () => { triggerRef.current?.focus() }
  }, [open])

  function save() {
    if (composing.current) return
    const trimmed = name.trim()
    if (!trimmed) return
    const normalize = (value: string) => value.normalize('NFKC').toLocaleLowerCase()
    const key = normalize(trimmed)
    const state = useAreaStore.getState()
    const archive = state.areas.find(area => area.category === '_milestone')
    const reserved = ['ALL', zh.tasklist_all, en.tasklist_all, '_milestone', '档案馆', '里程碑殿堂', 'archive', zh.areaName_archive, en.areaName_archive, ...(archive ? [archive.name, getAreaDisplayName(archive, t)] : [])]
    if (reserved.some(value => normalize(value) === key)) { setError(t.category_reserved); return }
    const existing = state.areas.find(area => area.category !== '_milestone' &&
      [area.category, area.name, getAreaDisplayName(area, zh), getAreaDisplayName(area, en)].some(value => normalize(value) === key))
    const migrated = migrateCategory(trimmed)
    const category = existing?.category ?? (normalize(migrated) === 'other' ? 'other'
      : state.getAreaCategories().find(value => normalize(value) === normalize(migrated)))
    if (category) { onCreated(category); setOpen(false); return }
    const added = state.addArea(null, trimmed)
    if (!added) { setError(t.category_limit); return }
    onCreated(added.category)
    setOpen(false)
  }

  return <>
    <button ref={triggerRef} type="button" title={t.category_create} aria-label={t.category_create}
      aria-haspopup="dialog" aria-expanded={open} data-create-category
      onClick={event => { event.preventDefault(); event.stopPropagation(); composing.current = false; setName(''); setError(''); setOpen(true) }}
      style={{ fontSize: compact ? 16 : 12, padding: compact ? '0 2px' : '5px 10px', flexShrink: 0,
        borderRadius: 'var(--radius-md)', border: compact ? 'none' : '1px dashed var(--color-border)',
        background: 'transparent', color: 'var(--color-text-dim)', cursor: 'pointer' }}>
      {compact ? '+' : '+ ' + t.category_create}
    </button>
    {open && createPortal(<div onClick={event => { event.stopPropagation(); if (event.target === event.currentTarget) setOpen(false) }}
      style={{ position: 'fixed', inset: 0, zIndex: 1200, background: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <form ref={dialogRef} role="dialog" aria-modal="true" aria-label={t.category_create} data-category-creator
        onClick={event => event.stopPropagation()}
        onSubmit={event => { event.preventDefault(); event.stopPropagation(); save() }}
        onKeyDown={event => {
          event.stopPropagation()
          if (composing.current || event.nativeEvent.isComposing || event.keyCode === 229) {
            if (event.key === 'Enter') event.preventDefault()
            return
          }
          if (event.key === 'Escape') { event.preventDefault(); setOpen(false) }
          if (event.key === 'Tab') {
            const controls = dialogRef.current?.querySelectorAll<HTMLElement>('input:not(:disabled), button:not(:disabled)')
            if (!controls?.length) return
            const first = controls[0], last = controls[controls.length - 1]
            if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
            else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
          }
        }}
        style={{ width: 360, maxWidth: '100%', maxHeight: 'calc(100vh - 40px)', overflowY: 'auto', padding: 20,
          border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', background: 'var(--color-surface)', color: 'var(--color-text)', boxShadow: 'var(--shadow-lg)' }}>
        <strong style={{ display: 'block', fontSize: 15, marginBottom: 16 }}>{t.category_create}</strong>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12 }}>{t.category_name}
          <input ref={inputRef} value={name} maxLength={80} placeholder={t.category_namePlaceholder}
            onChange={event => { setName(event.target.value); setError('') }}
            onCompositionStart={() => { composing.current = true }} onCompositionEnd={() => { composing.current = false }}
            style={{ width: '100%', minWidth: 0, height: 36, padding: '0 10px', border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-md)', background: 'var(--color-bg)', color: 'var(--color-text)', fontSize: 14 }} />
        </label>
        {error && <p role="alert" style={{ fontSize: 12, color: 'var(--color-text)', marginTop: 10 }}>{error}</p>}
        <div style={{ display: 'flex', justifyContent: 'flex-end', flexWrap: 'wrap', gap: 8, marginTop: 18 }}>
          <button type="button" onClick={() => setOpen(false)} style={{ padding: '6px 12px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', background: 'transparent', color: 'var(--color-text)', cursor: 'pointer' }}>{t.common_cancel}</button>
          <button type="submit" disabled={!name.trim()} style={{ padding: '6px 12px', border: '1px solid var(--color-accent)', borderRadius: 'var(--radius-md)', background: 'var(--color-accent)', color: 'var(--color-bg)', cursor: 'pointer' }}>{t.category_add}</button>
        </div>
      </form>
    </div>, document.body)}
  </>
}
