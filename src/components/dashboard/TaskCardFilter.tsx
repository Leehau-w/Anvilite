import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useT } from '@/i18n'
import { useAreaStore } from '@/stores/areaStore'
import { useTaskStore } from '@/stores/taskStore'
import { useHabitStore } from '@/stores/habitStore'
import type { Area } from '@/types/area'
import { useDashboardStore, type CardId, type TaskCardFilter } from '@/stores/dashboardStore'
import { categoryDisplay, getAreaDisplayName } from '@/utils/area'

interface TaskCardFilterProps {
  cardId: CardId
  filter?: TaskCardFilter
  kind?: 'tasks' | 'habits'
}

function categoryLabel(category: string, areas: Area[], t: ReturnType<typeof useT>) {
  const area = areas.find(item => item.category === category)
  return area ? getAreaDisplayName(area, t) : categoryDisplay(category, t)
}

export function getCardFilterSummary(filter: TaskCardFilter | undefined, areas: Area[], t: ReturnType<typeof useT>): string {
  const mode = filter?.mode ?? 'all'
  const selected = filter?.categories ?? []
  return mode === 'all' ? t.dash_filterAll
    : mode === 'single' ? (selected[0] ? categoryLabel(selected[0], areas, t) : t.dash_filterNone)
    : selected.length ? selected.map(category => categoryLabel(category, areas, t)).join(' / ') : t.dash_filterNone
}

export function TaskCardFilterButton({ cardId, filter, kind = 'tasks' }: TaskCardFilterProps) {
  const t = useT()
  const areas = useAreaStore(s => s.areas)
  const tasks = useTaskStore(s => s.tasks)
  const habits = useHabitStore(s => s.habits)
  const records = kind === 'habits' ? habits : tasks
  const setTaskFilter = useDashboardStore(s => s.setTaskCardFilter)
  const setHabitFilter = useDashboardStore(s => s.setHabitCardFilter)
  const setFilter = kind === 'habits' ? setHabitFilter : setTaskFilter
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const dialogRef = useRef<HTMLDivElement>(null)
  const mode = filter?.mode ?? 'all'
  const selected = filter?.categories ?? []
  const options = useMemo(() => {
    const keys = new Set(areas.filter(area => area.category !== '_milestone').map(area => area.category))
    keys.add('other')
    // Keep legacy/deleted categories selectable rather than silently widening a saved filter.
    for (const category of [...records.map(record => record.category), ...selected]) {
      if (category && category !== '_milestone') keys.add(category)
    }
    return [...keys]
  }, [areas, records, selected])
  const label = (category: string) => categoryLabel(category, areas, t)
  const summary = getCardFilterSummary(filter, areas, t)

  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        setOpen(false)
      }
      if (event.key === 'Tab') {
        const controls = dialogRef.current?.querySelectorAll<HTMLElement>('button, input:not(:disabled)')
        if (!controls?.length) return
        const first = controls[0]
        const last = controls[controls.length - 1]
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault(); last.focus()
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault(); first.focus()
        }
      }
    }
    window.addEventListener('keydown', onKeyDown)
    dialogRef.current?.querySelector<HTMLButtonElement>('button')?.focus()
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      triggerRef.current?.focus()
    }
  }, [open])

  function changeMode(next: TaskCardFilter['mode']) {
    setFilter(cardId, { mode: next, categories: next === 'single' ? selected.slice(0, 1) : selected })
  }
  function choose(category: string) {
    setFilter(cardId, {
      mode,
      categories: mode === 'single' ? [category]
        : selected.includes(category) ? selected.filter(value => value !== category) : [...selected, category],
    })
  }

  return <>
    <button
      ref={triggerRef}
      type="button"
      data-filter-trigger={cardId}
      aria-label={`${t.dash_taskCardCategories}: ${summary}`}
      aria-haspopup="dialog"
      aria-expanded={open}
      onClick={() => setOpen(true)}
      title={summary}
      style={{ maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 11, padding: '2px 7px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)', background: 'var(--color-bg)', color: 'var(--color-text-dim)', cursor: 'pointer' }}
    >{summary} ▾</button>
    {open && createPortal(
      <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 1100, background: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
        <div ref={dialogRef} role="dialog" aria-modal="true" aria-label={t.dash_taskCardCategories} data-task-card-filter={cardId} data-habit-card-filter={kind === 'habits' ? cardId : undefined} onClick={event => event.stopPropagation()} style={{ width: 380, maxWidth: '100%', maxHeight: 'calc(100vh - 40px)', overflowY: 'auto', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: 18, color: 'var(--color-text)', boxShadow: '0 8px 32px rgba(0,0,0,0.15)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 14 }}>
            <strong style={{ fontSize: 15 }}>{t.dash_taskCardCategories}</strong>
            <button type="button" aria-label={t.dash_filterClose} onClick={() => setOpen(false)} style={{ border: 0, background: 'transparent', color: 'var(--color-text-dim)', fontSize: 20, cursor: 'pointer', padding: '0 4px' }}>×</button>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, fontSize: 13, marginBottom: 14 }}>
            {(['all', 'single', 'multiple'] as const).map(value => (
              <label key={value} style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
                <input type="radio" name={`filter-mode-${cardId}`} value={value} checked={mode === value} onChange={() => changeMode(value)} />
                {value === 'all' ? t.dash_filterAll : value === 'single' ? t.dash_filterSingle : t.dash_filterMultiple}
              </label>
            ))}
          </div>
          {mode !== 'all' && <div style={{ display: 'flex', flexDirection: 'column', gap: 3, borderTop: '1px solid var(--color-border)', paddingTop: 8 }}>
            {selected.length === 0 && <div role="status" style={{ color: 'var(--color-text-dim)', fontSize: 12, padding: '5px 6px' }}>{t.dash_filterEmpty}</div>}
            {options.map(category => <label key={category} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px', fontSize: 13, cursor: 'pointer', overflowWrap: 'anywhere' }}>
              <input type={mode === 'single' ? 'radio' : 'checkbox'} name={`filter-category-${cardId}`} value={category} checked={selected.includes(category)} onChange={() => choose(category)} />
              {label(category)}
            </label>)}
          </div>}
        </div>
      </div>, document.body,
    )}
  </>
}
