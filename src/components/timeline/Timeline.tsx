import React, { useState, useMemo, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useGrowthEventStore } from '@/stores/growthEventStore'
import { useT } from '@/i18n'
import type { GrowthEvent } from '@/types/growthEvent'

// ─── 类型 ─────────────────────────────────────────────────────────────────────

type FilterType = GrowthEvent['type'] | 'all'
type TimeRange = 'week' | 'month' | 'all'

interface DayGroup {
  date: string
  dateLabel: string
  events: GrowthEvent[]
  hasMilestone: boolean
  totalXP: number
  taskCount: number
}

interface WeekGroup {
  weekLabel: string
  days: DayGroup[]
}

interface MonthGroup {
  monthKey: string
  monthLabel: string
  weeks: WeekGroup[]
}

// ─── 事件类型配置 ─────────────────────────────────────────────────────────────

function getEventConfig(t: ReturnType<typeof useT>): Record<string, { icon: string; label: string; color: string }> {
  return {
    task_complete: { icon: '✓', label: t.timeline_eventTaskComplete, color: 'var(--color-success)' },
    habit_complete: { icon: '●', label: t.timeline_eventHabitComplete, color: 'var(--color-accent)' },
    habit_skip: { icon: '⏭', label: t.timeline_eventHabitSkip, color: 'var(--color-text-dim)' },
    habit_miss: { icon: '○', label: t.timeline_eventHabitMiss, color: 'var(--color-text-dim)' },
    level_up: { icon: '⬆', label: t.timeline_eventLevelUp, color: 'var(--color-accent)' },
    badge_earned: { icon: '🏆', label: t.timeline_eventBadge, color: 'var(--color-xp)' },
    area_level_up: { icon: '🏘', label: t.timeline_eventAreaUp, color: 'var(--color-accent)' },
    milestone: { icon: '⭐', label: t.timeline_eventMilestone, color: 'var(--color-accent)' },
    custom_milestone: { icon: '⭐', label: t.timeline_eventMilestone, color: 'var(--color-accent)' },
  }
}

function getFilterTypes(t: ReturnType<typeof useT>): { value: FilterType; label: string }[] {
  return [
    { value: 'all', label: t.timeline_filterAll },
    { value: 'task_complete', label: t.timeline_filterTask },
    { value: 'habit_complete', label: t.timeline_filterHabit },
    { value: 'level_up', label: t.timeline_filterLevel },
    { value: 'badge_earned', label: t.timeline_filterBadge },
    { value: 'milestone', label: t.timeline_filterMilestone },
  ]
}

// ─── 数据处理 ─────────────────────────────────────────────────────────────────

function formatDateLabel(dateStr: string, t: ReturnType<typeof useT>): string {
  const d = new Date(dateStr)
  return t.timeline_dateLabel(d.getMonth() + 1, d.getDate(), t.timeline_dow[d.getDay()])
}

function formatMonthLabel(monthKey: string, t: ReturnType<typeof useT>): string {
  const [y, m] = monthKey.split('-')
  return t.timeline_monthLabel(y, parseInt(m))
}

function getWeekLabel(dateStr: string): string {
  const d = new Date(dateStr)
  const dow = d.getDay() === 0 ? 7 : d.getDay()
  const monday = new Date(d)
  monday.setDate(d.getDate() - (dow - 1))
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  return `${monday.getMonth() + 1}.${monday.getDate()} - ${sunday.getMonth() + 1}.${sunday.getDate()}`
}

function groupEvents(events: GrowthEvent[], t: ReturnType<typeof useT>): MonthGroup[] {
  const dayMap = new Map<string, DayGroup>()

  events.forEach((e) => {
    const date = e.timestamp.split('T')[0]
    if (!dayMap.has(date)) {
      dayMap.set(date, {
        date,
        dateLabel: formatDateLabel(date, t),
        events: [],
        hasMilestone: false,
        totalXP: 0,
        taskCount: 0,
      })
    }
    const day = dayMap.get(date)!
    day.events.push(e)
    if (e.isMilestone || e.type === 'milestone' || e.type === 'custom_milestone') {
      day.hasMilestone = true
    }
    if (e.details.xpGained) day.totalXP += e.details.xpGained
    if (e.type === 'task_complete') day.taskCount += 1
  })

  // 按月、周、天分组
  const monthMap = new Map<string, Map<string, DayGroup[]>>()

  Array.from(dayMap.values())
    .sort((a, b) => b.date.localeCompare(a.date))
    .forEach((day) => {
      const monthKey = day.date.slice(0, 7)
      const weekLabel = getWeekLabel(day.date)

      if (!monthMap.has(monthKey)) {
        monthMap.set(monthKey, new Map())
      }
      const weekMap = monthMap.get(monthKey)!
      if (!weekMap.has(weekLabel)) {
        weekMap.set(weekLabel, [])
      }
      weekMap.get(weekLabel)!.push(day)
    })

  return Array.from(monthMap.entries())
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([monthKey, weekMap]) => ({
      monthKey,
      monthLabel: formatMonthLabel(monthKey, t),
      weeks: Array.from(weekMap.entries()).map(([weekLabel, days]) => ({
        weekLabel,
        days,
      })),
    }))
}

// ─── 主组件 ───────────────────────────────────────────────────────────────────

export function Timeline() {
  const { events, markMilestone, removeEvent } = useGrowthEventStore()
  const t = useT()
  const [filterType, setFilterType] = useState<FilterType>('all')
  const [timeRange, setTimeRange] = useState<TimeRange>('all')
  const [search, setSearch] = useState('')
  const [expandedDays, setExpandedDays] = useState<Set<string>>(new Set())
  const [milestoneModal, setMilestoneModal] = useState<{ eventId: string; title: string } | null>(null)
  const filterTypes = getFilterTypes(t)

  const today = new Date().toISOString().split('T')[0]
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0]
  const monthAgo = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0]

  // 筛选
  const filtered = useMemo(() => {
    return events.filter((e) => {
      if (filterType !== 'all' && e.type !== filterType) {
        // 里程碑筛选时包含 custom_milestone
        if (filterType === 'milestone' && e.type !== 'custom_milestone') return false
        else if (filterType !== 'milestone') return false
      }
      if (timeRange === 'week' && e.timestamp.split('T')[0] < weekAgo) return false
      if (timeRange === 'month' && e.timestamp.split('T')[0] < monthAgo) return false
      if (search) {
        const q = search.toLowerCase()
        if (!e.title.toLowerCase().includes(q) && !(e.details.description ?? '').toLowerCase().includes(q)) {
          return false
        }
      }
      return true
    })
  }, [events, filterType, timeRange, search, weekAgo, monthAgo])

  const grouped = useMemo(() => groupEvents(filtered, t), [filtered, t])

  function toggleDay(date: string) {
    setExpandedDays((prev) => {
      const next = new Set(prev)
      if (next.has(date)) next.delete(date)
      else next.add(date)
      return next
    })
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--color-bg)' }}>
      {/* 顶部筛选 */}
      <div
        style={{
          padding: '12px 24px',
          borderBottom: '1px solid var(--color-border)',
          background: 'var(--color-surface)',
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}
      >
        {/* 事件类型 + 搜索 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', flex: 1 }}>
            {filterTypes.map((f) => (
              <FilterTag
                key={f.value}
                label={f.label}
                active={filterType === f.value}
                onClick={() => setFilterType(f.value)}
              />
            ))}
          </div>
          {/* 搜索框 */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              height: 30,
              padding: '0 10px',
              borderRadius: 'var(--radius-full)',
              border: '1px solid var(--color-border)',
              background: 'var(--color-bg)',
              minWidth: 160,
            }}
          >
            <span style={{ fontSize: 12, color: 'var(--color-text-dim)' }}>🔍</span>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t.timeline_search}
              style={{
                background: 'transparent',
                border: 'none',
                outline: 'none',
                fontSize: 12,
                color: 'var(--color-text)',
                fontFamily: 'var(--font-zh)',
                width: 120,
              }}
            />
          </div>
        </div>

        {/* 时间范围 */}
        <div style={{ display: 'flex', gap: 4 }}>
          {(['week', 'month', 'all'] as TimeRange[]).map((r) => (
            <FilterTag
              key={r}
              label={r === 'week' ? t.timeline_rangeWeek : r === 'month' ? t.timeline_rangeMonth : t.timeline_rangeAll}
              active={timeRange === r}
              onClick={() => setTimeRange(r)}
            />
          ))}
        </div>
      </div>

      {/* 时间轴内容 */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px' }}>
        {grouped.length === 0 ? (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: 200,
              color: 'var(--color-text-dim)',
              fontSize: 13,
              gap: 8,
            }}
          >
            <span style={{ fontSize: 32 }}>📜</span>
            <span>{t.timeline_empty}</span>
          </div>
        ) : (
          <div style={{ position: 'relative' }}>
            {/* 轴线 */}
            <div
              style={{
                position: 'absolute',
                left: 11,
                top: 0,
                bottom: 0,
                width: 2,
                background: 'color-mix(in srgb, var(--color-accent) 20%, transparent)',
              }}
            />

            {grouped.map((month) => (
              <MonthSection
                key={month.monthKey}
                month={month}
                expandedDays={expandedDays}
                onToggleDay={toggleDay}
                onMarkMilestone={(id, title) => setMilestoneModal({ eventId: id, title })}
              />
            ))}
          </div>
        )}
      </div>

      {/* 里程碑标记 Modal */}
      <MilestoneModal
        open={!!milestoneModal}
        title={milestoneModal?.title ?? ''}
        onClose={() => setMilestoneModal(null)}
        onConfirm={(desc) => {
          if (milestoneModal) markMilestone(milestoneModal.eventId, desc)
          setMilestoneModal(null)
        }}
      />
    </div>
  )
}

// ─── 月分组 ───────────────────────────────────────────────────────────────────

function MonthSection({
  month,
  expandedDays,
  onToggleDay,
  onMarkMilestone,
}: {
  month: MonthGroup
  expandedDays: Set<string>
  onToggleDay: (date: string) => void
  onMarkMilestone: (id: string, title: string) => void
}) {
  return (
    <div style={{ marginBottom: 24 }}>
      {/* 月标题（sticky） */}
      <div
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 10,
          background: 'var(--color-bg)',
          padding: '8px 0 8px 28px',
          borderBottom: '1px solid var(--color-border)',
          marginBottom: 12,
        }}
      >
        <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0, color: 'var(--color-text)' }}>
          {month.monthLabel}
        </h2>
      </div>

      {month.weeks.map((week) => (
        <WeekSection
          key={week.weekLabel}
          week={week}
          expandedDays={expandedDays}
          onToggleDay={onToggleDay}
          onMarkMilestone={onMarkMilestone}
        />
      ))}
    </div>
  )
}

function WeekSection({
  week,
  expandedDays,
  onToggleDay,
  onMarkMilestone,
}: {
  week: WeekGroup
  expandedDays: Set<string>
  onToggleDay: (date: string) => void
  onMarkMilestone: (id: string, title: string) => void
}) {
  return (
    <div style={{ marginBottom: 16, paddingLeft: 28 }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-dim)', marginBottom: 8 }}>
        {week.weekLabel}
      </div>
      {week.days.map((day) => (
        <DaySection
          key={day.date}
          day={day}
          expanded={expandedDays.has(day.date)}
          onToggle={() => onToggleDay(day.date)}
          onMarkMilestone={onMarkMilestone}
        />
      ))}
    </div>
  )
}

// ─── 天分组 ───────────────────────────────────────────────────────────────────

function DaySection({
  day,
  expanded,
  onToggle,
  onMarkMilestone,
}: {
  day: DayGroup
  expanded: boolean
  onToggle: () => void
  onMarkMilestone: (id: string, title: string) => void
}) {
  const t = useT()
  const today = new Date().toISOString().split('T')[0]
  const isToday = day.date === today

  return (
    <div style={{ marginBottom: 8, position: 'relative' }}>
      {/* 轴线上的节点 */}
      <div
        style={{
          position: 'absolute',
          left: -22,
          top: 8,
          width: day.hasMilestone ? 10 : 7,
          height: day.hasMilestone ? 10 : 7,
          borderRadius: '50%',
          background: day.hasMilestone
            ? 'var(--color-accent)'
            : isToday
            ? 'var(--color-accent)'
            : 'var(--color-border)',
          boxShadow: (day.hasMilestone || isToday) ? '0 0 6px var(--color-accent)' : 'none',
          marginLeft: day.hasMilestone ? -1.5 : 0,
          zIndex: 1,
        }}
      />

      {/* 天标题 */}
      <button
        onClick={onToggle}
        style={{
          width: '100%',
          background: day.hasMilestone
            ? 'color-mix(in srgb, var(--color-accent) 8%, transparent)'
            : 'transparent',
          border: 'none',
          borderRadius: 'var(--radius-md)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '6px 10px',
          textAlign: 'left',
        }}
      >
        <span style={{ fontSize: 12, color: 'var(--color-text-dim)', flexShrink: 0 }}>
          {expanded ? '▾' : '▸'}
        </span>
        <span
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: isToday ? 'var(--color-accent)' : 'var(--color-text)',
          }}
        >
          {day.dateLabel}
          {isToday && <span style={{ fontSize: 10, marginLeft: 6, color: 'var(--color-accent)' }}>{t.timeline_today}</span>}
        </span>
        {day.hasMilestone && <span style={{ fontSize: 12 }}>⭐</span>}
        <span style={{ fontSize: 11, color: 'var(--color-text-dim)', marginLeft: 'auto' }}>
          {day.taskCount > 0 && t.timeline_tasksDone(day.taskCount)}
          {day.taskCount > 0 && day.totalXP > 0 && ' · '}
          {day.totalXP > 0 && `+${day.totalXP} XP`}
        </span>
      </button>

      {/* 展开内容 */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            style={{ overflow: 'hidden' }}
          >
            <div style={{ padding: '4px 10px 8px 24px', display: 'flex', flexDirection: 'column', gap: 4 }}>
              {day.events.map((event) => (
                <EventCard
                  key={event.id}
                  event={event}
                  onMarkMilestone={onMarkMilestone}
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── 事件卡片 ─────────────────────────────────────────────────────────────────

function EventCard({
  event,
  onMarkMilestone,
}: {
  event: GrowthEvent
  onMarkMilestone: (id: string, title: string) => void
}) {
  const t = useT()
  const eventConfig = getEventConfig(t)
  const [hovered, setHovered] = useState(false)
  const config = eventConfig[event.type] ?? eventConfig.task_complete
  const isMilestone =
    event.isMilestone || event.type === 'milestone' || event.type === 'custom_milestone'
  const time = new Date(event.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

  if (isMilestone) {
    return (
      <div
        style={{
          background: 'color-mix(in srgb, var(--color-accent) 8%, transparent)',
          border: '1px solid color-mix(in srgb, var(--color-accent) 20%, transparent)',
          borderRadius: 'var(--radius-lg)',
          padding: '12px 16px',
          marginBottom: 4,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
          <span style={{ fontSize: 18, lineHeight: 1.2 }}>⭐</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-accent)', marginBottom: 4 }}>
              {event.title.replace(/^(.*?：)/, '')}
            </div>
            {event.details.description && (
              <div style={{ fontSize: 13, color: 'var(--color-text)', fontStyle: 'italic', marginBottom: 4 }}>
                "{event.details.description}"
              </div>
            )}
            <div style={{ fontSize: 10, color: 'var(--color-text-dim)' }}>
              {new Date(event.timestamp).toLocaleDateString()}
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '5px 8px',
        borderRadius: 'var(--radius-sm)',
        background: hovered ? 'var(--color-surface-hover)' : 'transparent',
        position: 'relative',
        cursor: 'default',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <span style={{ fontSize: 12, color: config.color, width: 14, textAlign: 'center', flexShrink: 0 }}>
        {config.icon}
      </span>
      <span style={{ fontSize: 13, color: 'var(--color-text)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {event.title}
      </span>
      {event.details.xpGained && event.details.xpGained > 0 && (
        <span style={{ fontSize: 11, fontFamily: 'var(--font-num)', color: 'var(--color-success)', flexShrink: 0 }}>
          +{event.details.xpGained} XP
        </span>
      )}
      {event.details.consecutiveCount && event.details.consecutiveCount > 0 && event.type === 'habit_complete' && (
        <span style={{ fontSize: 11, color: 'var(--color-xp)', flexShrink: 0 }}>
          🔥{event.details.consecutiveCount}
        </span>
      )}
      <span style={{ fontSize: 10, color: 'var(--color-text-dim)', flexShrink: 0 }}>{time}</span>

      {/* 里程碑标记按钮 */}
      {hovered && !event.isMilestone && (
        <button
          onClick={() => onMarkMilestone(event.id, event.title)}
          title={t.timeline_markMilestone}
          style={{
            position: 'absolute',
            right: -24,
            fontSize: 12,
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--color-text-dim)',
            padding: 2,
          }}
          onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--color-xp)' }}
          onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--color-text-dim)' }}
        >
          ☆
        </button>
      )}
    </div>
  )
}

// ─── 里程碑标记 Modal ────────────────────────────────────────────────────────

function MilestoneModal({
  open,
  title,
  onClose,
  onConfirm,
}: {
  open: boolean
  title: string
  onClose: () => void
  onConfirm: (description: string) => void
}) {
  const t = useT()
  const [desc, setDesc] = useState('')

  function handleConfirm() {
    onConfirm(desc)
    setDesc('')
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', zIndex: 500 }}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            style={{
              position: 'fixed',
              left: '50%',
              top: '50%',
              transform: 'translate(-50%, -50%)',
              width: 320,
              background: 'var(--color-surface)',
              borderRadius: 'var(--radius-xl)',
              border: '1px solid var(--color-border)',
              padding: 20,
              zIndex: 501,
              boxShadow: 'var(--shadow-lg)',
            }}
          >
            <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>{t.timeline_markMilestone}</h3>
            <p style={{ fontSize: 12, color: 'var(--color-text-dim)', marginBottom: 12 }}>
              {title}
            </p>
            <textarea
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              placeholder={t.timeline_markDesc}
              rows={3}
              autoFocus
              style={{
                width: '100%',
                padding: '8px 10px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--color-border)',
                background: 'var(--color-bg)',
                color: 'var(--color-text)',
                fontSize: 13,
                resize: 'none',
                outline: 'none',
                fontFamily: 'var(--font-zh)',
                boxSizing: 'border-box',
              }}
            />
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button
                onClick={onClose}
                style={{
                  flex: 1, height: 34, borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--color-border)', background: 'transparent',
                  color: 'var(--color-text-dim)', cursor: 'pointer', fontSize: 13,
                }}
              >
                {t.timeline_cancel}
              </button>
              <button
                onClick={handleConfirm}
                style={{
                  flex: 1, height: 34, borderRadius: 'var(--radius-md)',
                  border: 'none', background: 'var(--color-accent)',
                  color: 'white', cursor: 'pointer', fontSize: 13, fontWeight: 600,
                }}
              >
                {t.timeline_confirm}
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

// ─── FilterTag ────────────────────────────────────────────────────────────────

function FilterTag({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        fontSize: 12,
        padding: '4px 12px',
        borderRadius: 'var(--radius-full)',
        border: 'none',
        background: active ? 'color-mix(in srgb, var(--color-accent) 15%, transparent)' : 'transparent',
        color: active ? 'var(--color-accent)' : 'var(--color-text-dim)',
        cursor: 'pointer',
        fontWeight: active ? 500 : 400,
        transition: 'all 0.15s',
      }}
    >
      {label}
    </button>
  )
}
