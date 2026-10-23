import { useEffect, useMemo, useState, type CSSProperties, type FormEvent } from 'react'
import { useGrowthEventStore } from '@/stores/growthEventStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { useAreaStore } from '@/stores/areaStore'
import { useTaskStore } from '@/stores/taskStore'
import { useHabitStore } from '@/stores/habitStore'
import { useCharacterStore } from '@/stores/characterStore'
import { getTaskActivity } from '@/utils/activityStats'
import { SkillRadarChart } from './SkillRadarChart'
import './MilestoneHall.css'
import { getAreaDisplayName, categoryDisplay } from '@/utils/area'
import { useT, type Translations } from '@/i18n'
import type { GrowthEvent } from '@/types/growthEvent'
import { isManualActivityEvent, getActivityHistoryView } from '@/utils/activityHistory'

function eventLabel(event: GrowthEvent, t: Translations) {
  switch (event.type) {
    case 'task_complete': return t.activity_taskComplete
    case 'habit_complete': return t.activity_habitComplete
    case 'habit_skip': return t.activity_habitSkip
    case 'habit_miss': return t.activity_habitMiss
    default: return t.activity_manual
  }
}

// Navigation IDs and persisted history stay compatible with earlier versions.
export function MilestoneHall() {
  const events = useGrowthEventStore(s => s.events)
  const language = useSettingsStore(s => s.settings.language)
  const areas = useAreaStore(s => s.areas)
  const tasks = useTaskStore(s => s.tasks)
  const habits = useHabitStore(s => s.habits)
  const createdAt = useCharacterStore(s => s.character.createdAt)
  const t = useT()
  const [metric, setMetric] = useState<'count' | 'time'>('count')
  const [editor, setEditor] = useState<{ event: GrowthEvent | null } | null>(null)
  const milestones = useMemo(() => events.filter(isManualActivityEvent)
    .map(event => getActivityHistoryView(event, t.activity_legacyNote))
    .sort((a, b) => (Date.parse(b.timestamp) || 0) - (Date.parse(a.timestamp) || 0)), [events, t.activity_legacyNote])
  const activity = useMemo(() => getTaskActivity(tasks), [tasks])
  const habitStats = useMemo(() => habits.reduce((stats, habit) => {
    if (habit.deletedAt) return stats
    stats.completions = Math.min(Number.MAX_VALUE, stats.completions + safeCount(habit.totalCompletions))
    stats.streak = Math.max(stats.streak, safeCount(habit.consecutiveCount))
    return stats
  }, { completions: 0, streak: 0 }), [habits])
  const categoryStats = useMemo(() => {
    // Retain custom and historical categories even when their area has been removed.
    const categories = new Set(areas.filter(area => area.category !== '_milestone').map(area => area.category))
    for (const task of tasks) if (!task.deletedAt && task.category !== '_milestone') categories.add(task.category)
    return [...categories].map(category => ({ category, ...getTaskActivity(tasks, category) }))
  }, [areas, tasks])

  function displayCategory(category: string) {
    const area = areas.find(item => item.category === category)
    return area ? getAreaDisplayName(area, t) : categoryDisplay(category, t)
  }
  const formatTime = (value: number) => {
    const minutes = roundMinutes(value)
    return t.milestone_timeValue(Math.floor(minutes / 60), roundMinutes(minutes % 60))
  }
  const formatValue = (value: number) => metric === 'count' ? String(value) : formatTime(value)
  const dimensions = categoryStats.map(stats => ({ name: displayCategory(stats.category), value: metric === 'count' ? stats.completedCount : stats.minutes }))
  const personalStats = [
    { id: 'tasks', label: t.milestone_statTasksDone, value: String(activity.completedCount) },
    { id: 'minutes', label: t.milestone_statTime, value: formatTime(activity.minutes) },
    { id: 'habitCompletions', label: t.milestone_statHabitCompletions, value: String(habitStats.completions) + t.milestone_unitTimes },
    { id: 'habitStreak', label: t.milestone_statHabit, value: String(habitStats.streak) + t.milestone_unitTimes },
    { id: 'days', label: t.milestone_statDays, value: String(usageDays(createdAt)) + t.milestone_unitDays },
    { id: 'pending', label: t.overview_pending, value: String(activity.activeCount) },
  ]

  return (
    <div data-milestone-page className="milestone-page">
      <div className="milestone-content">
        <h1 style={{ fontSize: 20, margin: '0 0 20px' }}>{t.milestone_pageTitle}</h1>
        <div className="milestone-columns">
          <div className="milestone-profile">
            <section data-personal-stats className="milestone-personal-data" style={panelStyle} aria-labelledby="personal-data-heading">
              <h2 id="personal-data-heading" style={{ ...sectionHeading, fontSize: 13 }}>{t.milestone_statHeader}</h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10, marginTop: 16 }}>
                {personalStats.map(stat => <div key={stat.id} data-personal-stat={stat.id}
                  style={{ background: 'var(--color-surface-hover)', borderRadius: 'var(--radius-md)', padding: '12px 10px', minWidth: 0 }}>
                  <div style={{ fontSize: 17, fontWeight: 700, fontFamily: 'var(--font-num)', overflowWrap: 'anywhere', lineHeight: 1.4 }}>{stat.value}</div>
                  <div style={{ fontSize: 10, color: 'var(--color-text-dim)', marginTop: 6, lineHeight: 1.5 }}>{stat.label}</div>
                </div>)}
              </div>
            </section>
            <section data-capability-chart data-capability-metric={metric} style={panelStyle} aria-labelledby="capability-heading">
              <h2 id="capability-heading" style={sectionHeading}>{t.milestone_abilityChart}</h2>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 12, marginBottom: 4 }}>
                {(['count', 'time'] as const).map(value => <button type="button" key={value} aria-pressed={metric === value} onClick={() => setMetric(value)}
                  style={{ ...outlineButton, padding: '5px 9px', color: metric === value ? 'var(--color-accent)' : 'var(--color-text-dim)',
                    borderColor: metric === value ? 'var(--color-accent)' : 'var(--color-border)' }}>
                  {value === 'count' ? t.heatmap_countMetric : t.heatmap_timeMetric}
                </button>)}
              </div>
              <div style={{ display: 'flex', justifyContent: 'center', padding: '4px 0' }}>
                <SkillRadarChart dimensions={dimensions} size={240} formatValue={formatValue} ariaLabel={t.milestone_abilityChart} />
              </div>
              <div style={{ display: 'grid', gap: 7 }}>
                {categoryStats.map(stats => {
                  const value = metric === 'count' ? stats.completedCount : stats.minutes
                  return <div key={stats.category} data-capability-category={stats.category} data-capability-value={value}
                    style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 11, color: 'var(--color-text-dim)' }}>
                    <span style={{ overflowWrap: 'anywhere', minWidth: 0 }}>{displayCategory(stats.category)}</span>
                    <span style={{ textAlign: 'right', fontFamily: 'var(--font-num)', overflowWrap: 'anywhere', flex: '0 0 auto', maxWidth: '50%' }}>{formatValue(value)}</span>
                  </div>
                })}
              </div>
            </section>
          </div>
          <section className="milestone-records" aria-labelledby="milestone-heading">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 14 }}>
              <h2 id="milestone-heading" style={sectionHeading}>{t.milestone_header}</h2>
              <button type="button" data-add-activity onClick={() => setEditor({ event: null })} style={outlineButton}>{t.activity_add}</button>
            </div>
            {milestones.length === 0 ? <div style={{ ...panelStyle, textAlign: 'center', color: 'var(--color-text-dim)', padding: '44px 16px' }}>
              <div aria-hidden="true" style={{ fontSize: 30, marginBottom: 12 }}>☆</div>
              <div style={{ fontSize: 13 }}>{t.milestone_empty1}</div>
              <div style={{ fontSize: 11, marginTop: 8 }}>{t.milestone_empty2}</div>
            </div> : <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {milestones.map(event => {
                const minutes = event.details.actualMinutes
                const at = new Date(event.timestamp)
                return <button type="button" key={event.id} data-activity-id={event.id} onClick={() => setEditor({ event })}
                  aria-label={t.activity_edit + ': ' + event.title}
                  style={{ ...panelStyle, width: '100%', textAlign: 'left', cursor: 'pointer', overflowWrap: 'anywhere',
                    background: 'color-mix(in srgb, var(--color-accent) 5%, var(--color-surface))' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6, marginBottom: 8, color: 'var(--color-text-dim)', fontSize: 11 }}>
                    <span>{eventLabel(event, t)}</span>
                    <time dateTime={event.timestamp}>{Number.isFinite(at.getTime()) ? at.toLocaleString(language === 'zh' ? 'zh-CN' : 'en-US') : event.timestamp}</time>
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-accent)' }}>{event.title}</div>
                  {(event.details.categoryName || typeof minutes === 'number' && Number.isFinite(minutes) && minutes >= 0) &&
                    <div style={{ marginTop: 6, fontSize: 12, color: 'var(--color-text-dim)', display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                      {event.details.categoryName && <span>{displayCategory(event.details.categoryName)}</span>}
                      {typeof minutes === 'number' && Number.isFinite(minutes) && minutes >= 0 && <span>{t.heatmap_minutes(minutes)}</span>}
                    </div>}
                  {event.details.description && <div style={{ marginTop: 8, fontSize: 12, color: 'var(--color-text-dim)', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{event.details.description}</div>}
                </button>
              })}
            </div>}
          </section>

        </div>
      </div>
      {editor && <ActivityEditor key={editor.event?.id ?? 'new'} event={editor.event} onClose={() => setEditor(null)} />}
    </div>
  )
}

function safeCount(value: number) { return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0 }
function roundMinutes(value: number) { return value > Number.MAX_VALUE / 10 ? value : Math.round(value * 10) / 10 }
function usageDays(createdAt: string) {
  const created = new Date(createdAt), now = new Date()
  if (!Number.isFinite(created.getTime()) || created > now) return 0
  const day = (date: Date) => Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())
  return Math.floor((day(now) - day(created)) / 86400000) + 1
}
const panelStyle: CSSProperties = {
  padding: 16, background: 'var(--color-surface)', color: 'var(--color-text)',
  border: '1px solid var(--color-border)', borderRadius: 'var(--radius-xl)', minWidth: 0,
}
const sectionHeading: CSSProperties = { fontSize: 14, fontWeight: 600, margin: 0 }

function ActivityEditor({ event, onClose }: { event: GrowthEvent | null; onClose: () => void }) {
  const t = useT()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState(event?.details.description ?? '')
  const [confirmDelete, setConfirmDelete] = useState(false)
  useEffect(() => {
    function onKeyDown(key: KeyboardEvent) { if (key.key === 'Escape' && !key.isComposing) onClose() }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  function save(e: FormEvent) {
    e.preventDefault()
    const store = useGrowthEventStore.getState()
    if (event) store.updateEventDetails(event.id, { description: description.trim() })
    else {
      if (!title.trim()) return
      store.addEvent({ type: 'custom_milestone', title: title.trim(), details: { description: description.trim() }, isMilestone: true })
    }
    onClose()
  }

  function remove() {
    if (!event) return
    if (!confirmDelete) { setConfirmDelete(true); return }
    useGrowthEventStore.getState().removeEvent(event.id)
    onClose()
  }

  return <div style={{ position: 'fixed', inset: 0, zIndex: 500, background: 'rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
    onClick={e => { if (e.target === e.currentTarget) onClose() }}>
    <form role="dialog" aria-modal="true" aria-label={event ? t.activity_edit : t.activity_add} onSubmit={save}
      data-activity-editor style={{ width: 380, maxWidth: '100%', maxHeight: 'calc(100vh - 32px)', overflow: 'auto', boxSizing: 'border-box', padding: 20,
        background: 'var(--color-surface)', color: 'var(--color-text)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-xl)', boxShadow: 'var(--shadow-lg)' }}>
      <h2 style={{ fontSize: 16, margin: '0 0 16px' }}>{event ? t.activity_edit : t.activity_add}</h2>
      {event ? <p style={{ fontSize: 14, fontWeight: 600, overflowWrap: 'anywhere' }}>{event.title}</p>
        : <label style={{ display: 'block', fontSize: 12 }}>{t.milestone_createLabel}
          <input autoFocus data-activity-title value={title} onChange={e => setTitle(e.target.value)} required
            onKeyDown={e => { if (e.key === 'Enter' && e.nativeEvent.isComposing) e.preventDefault() }}
            style={{ ...fieldStyle, height: 36, margin: '6px 0 12px' }} />
        </label>}
      <label style={{ display: 'block', fontSize: 12 }}>{t.milestone_createNotesLabel}
        <textarea autoFocus={!!event} data-activity-notes value={description} onChange={e => setDescription(e.target.value)} rows={4}
          placeholder={t.milestone_createNotesPlaceholder} style={{ ...fieldStyle, marginTop: 6, resize: 'vertical' }} />
      </label>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 16 }}>
        {event && <button type="button" data-delete-activity onClick={remove} style={{ ...outlineButton, color: 'var(--color-danger)', borderColor: 'var(--color-danger)' }}>
          {confirmDelete ? t.activity_deleteConfirm : t.common_delete}
        </button>}
        <button type="button" onClick={onClose} style={{ ...outlineButton, marginLeft: 'auto' }}>{t.common_cancel}</button>
        <button type="submit" disabled={!event && !title.trim()} style={{ ...primaryButton, opacity: !event && !title.trim() ? 0.5 : 1 }}>{t.common_save}</button>
      </div>
    </form>
  </div>
}

const outlineButton: CSSProperties = {
  padding: '7px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)',
  background: 'transparent', color: 'var(--color-text-dim)', cursor: 'pointer', fontSize: 12,
}
const primaryButton: CSSProperties = {
  ...outlineButton, background: 'var(--color-accent)', color: 'var(--color-on-accent, white)', borderColor: 'var(--color-accent)', fontWeight: 600,
}
const fieldStyle: CSSProperties = {
  width: '100%', boxSizing: 'border-box', padding: '8px 10px', borderRadius: 'var(--radius-md)',
  border: '1px solid var(--color-border)', background: 'var(--color-bg)', color: 'var(--color-text)', fontFamily: 'inherit', fontSize: 13,
}
