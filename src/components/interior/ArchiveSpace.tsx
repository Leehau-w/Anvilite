import React, { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useTaskStore } from '@/stores/taskStore'
import { useHabitStore } from '@/stores/habitStore'
import { useGrowthEventStore } from '@/stores/growthEventStore'
import { useAreaStore } from '@/stores/areaStore'
import { useT } from '@/i18n'
import type { GrowthEvent } from '@/types/growthEvent'
import type { Area } from '@/types/area'
import type { ProsperityInfo } from '@/engines/prosperityEngine'

// ── 类型 ─────────────────────────────────────────────────────────────────────

type Period = 'today' | 'week' | 'month'
type ArchiveTab = 'overview' | 'scroll'

interface ArchiveSpaceProps {
  area: Area
  prosperity: ProsperityInfo
  onExit: () => void
}

// ── 工具 ─────────────────────────────────────────────────────────────────────

function getPeriodRange(period: Period): { start: string; end: string } {
  const now = new Date()
  const today = now.toISOString().split('T')[0]
  if (period === 'today') return { start: today, end: today }
  if (period === 'week') {
    const dow = now.getDay() === 0 ? 7 : now.getDay()
    const monday = new Date(now)
    monday.setDate(now.getDate() - (dow - 1))
    return { start: monday.toISOString().split('T')[0], end: today }
  }
  // month
  const first = new Date(now.getFullYear(), now.getMonth(), 1)
  return { start: first.toISOString().split('T')[0], end: today }
}

function inPeriod(ts: string, range: { start: string; end: string }): boolean {
  const d = ts.split('T')[0]
  return d >= range.start && d <= range.end
}

function fmtMinutes(mins: number, t: ReturnType<typeof useT>): string {
  if (mins < 60) return t.archive_fmtMins(mins)
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return m > 0 ? t.archive_fmtHoursMin(h, m) : t.archive_fmtHours(h)
}

// ── 主组件 ────────────────────────────────────────────────────────────────────

export function ArchiveSpace({ area, prosperity, onExit }: ArchiveSpaceProps) {
  const t = useT()
  const [tab, setTab] = useState<ArchiveTab>('overview')
  const [period, setPeriod] = useState<Period>('week')

  const PERIOD_LABELS: Record<Period, string> = {
    today: t.archive_periodToday,
    week: t.archive_periodWeek,
    month: t.archive_periodMonth,
  }

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--color-bg)', overflow: 'hidden' }}>
      {/* 顶部栏 */}
      <div
        style={{
          height: 52,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 20px',
          background: 'var(--color-surface)',
          borderBottom: '1px solid var(--color-border)',
          flexShrink: 0,
        }}
      >
        {/* 返回 + Tabs */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <button
            onClick={onExit}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--color-text-dim)', fontSize: 13, padding: '4px 8px',
              borderRadius: 'var(--radius-md)',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--color-surface-hover)'; e.currentTarget.style.color = 'var(--color-text)' }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = 'var(--color-text-dim)' }}
          >
            {t.archive_backToMap}
          </button>

          <div style={{ width: 1, height: 20, background: 'var(--color-border)' }} />

          <div style={{ display: 'flex', gap: 4 }}>
            {(['overview', 'scroll'] as ArchiveTab[]).map((tabKey) => (
              <button
                key={tabKey}
                onClick={() => setTab(tabKey)}
                style={{
                  padding: '5px 14px',
                  borderRadius: 'var(--radius-md)',
                  border: 'none',
                  background: tab === tabKey ? 'color-mix(in srgb, var(--color-accent) 12%, transparent)' : 'transparent',
                  color: tab === tabKey ? 'var(--color-accent)' : 'var(--color-text-dim)',
                  fontWeight: tab === tabKey ? 600 : 400,
                  fontSize: 13,
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
              >
                {tabKey === 'overview' ? t.archive_tabOverview : t.archive_tabScroll}
              </button>
            ))}
          </div>
        </div>

        {/* 周期筛选（仅数据总览使用） */}
        {tab === 'overview' && (
          <div style={{ display: 'flex', gap: 4 }}>
            {(['today', 'week', 'month'] as Period[]).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                style={{
                  padding: '4px 12px',
                  borderRadius: 'var(--radius-full)',
                  border: `1px solid ${period === p ? 'var(--color-accent)' : 'var(--color-border)'}`,
                  background: period === p ? 'color-mix(in srgb, var(--color-accent) 10%, transparent)' : 'transparent',
                  color: period === p ? 'var(--color-accent)' : 'var(--color-text-dim)',
                  fontSize: 12,
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
              >
                {PERIOD_LABELS[p]}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 内容区 */}
      <div style={{ flex: 1, overflow: 'hidden' }}>
        <AnimatePresence mode="wait">
          {tab === 'overview' ? (
            <motion.div
              key="overview"
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -12 }}
              transition={{ duration: 0.2 }}
              style={{ height: '100%', overflow: 'auto' }}
            >
              <ArchiveOverview period={period} />
            </motion.div>
          ) : (
            <motion.div
              key="scroll"
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 12 }}
              transition={{ duration: 0.2 }}
              style={{ height: '100%', overflow: 'hidden' }}
            >
              <ScrollTimeline />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

// ── 数据总览 ──────────────────────────────────────────────────────────────────

function ArchiveOverview({ period }: { period: Period }) {
  const { tasks } = useTaskStore()
  const { habits } = useHabitStore()
  const { events } = useGrowthEventStore()
  const { areas } = useAreaStore()

  const range = useMemo(() => getPeriodRange(period), [period])

  const completedTasks = useMemo(
    () => tasks.filter((t) => t.status === 'done' && t.completedAt && inPeriod(t.completedAt, range)),
    [tasks, range]
  )

  const habitEvents = useMemo(
    () => events.filter((e) => e.type === 'habit_complete' && inPeriod(e.timestamp, range)),
    [events, range]
  )

  return (
    <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* 1. 紧急程度分布 */}
      <UrgencySection tasks={completedTasks} />
      {/* 2. 难度分布 */}
      <DifficultySection tasks={completedTasks} />
      {/* 3. 区域时长 */}
      <AreaTimeSection tasks={completedTasks} areas={areas} />
      {/* 4. 习惯坚持 */}
      <HabitConsistencySection habitEvents={habitEvents} habits={habits} />
      {/* 5. 高频行为 */}
      <RoutineSection tasks={completedTasks} habitEvents={habitEvents} habits={habits} />
    </div>
  )
}

// ─ 1. 紧急程度能量条 ──────────────────────────────────────────────────────────

function UrgencySection({ tasks }: { tasks: ReturnType<typeof useTaskStore>['tasks'] }) {
  const t = useT()
  const urgent = tasks.filter((task) => task.priority === 'urgent').length
  const high   = tasks.filter((task) => task.priority === 'high').length
  const medium = tasks.filter((task) => task.priority === 'medium').length
  const low    = tasks.filter((task) => task.priority === 'low').length
  const total  = tasks.length

  const guide = urgent > 0
    ? t.archive_urgentCleared(urgent)
    : total > 0 ? t.archive_noUrgent : t.archive_noTasks

  const bars: { label: string; count: number; color: string }[] = [
    { label: t.taskPriority_urgent, count: urgent, color: '#dc2626' },
    { label: t.taskPriority_high,   count: high,   color: 'var(--color-accent)' },
    { label: t.taskPriority_medium, count: medium, color: 'var(--color-secondary)' },
    { label: t.taskPriority_low,    count: low,    color: 'var(--color-text-dim)' },
  ]

  return (
    <StatCard title={t.archive_sectionPriority} guide={guide}>
      {total === 0 ? <EmptyHint /> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {bars.filter((b) => b.count > 0 || urgent === 0).map((b) => (
            <div key={b.label} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ width: 28, fontSize: 11, color: 'var(--color-text-dim)', textAlign: 'right' }}>{b.label}</span>
              <div style={{ flex: 1, height: 8, borderRadius: 'var(--radius-full)', background: 'var(--color-border)', overflow: 'hidden' }}>
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: total > 0 ? `${(b.count / total) * 100}%` : '0%' }}
                  transition={{ duration: 0.6, ease: 'easeOut' }}
                  style={{ height: '100%', borderRadius: 'var(--radius-full)', background: b.color }}
                />
              </div>
              <span style={{ width: 24, fontSize: 12, fontFamily: 'var(--font-num)', fontWeight: 600, color: 'var(--color-text)', textAlign: 'right' }}>
                {b.count}
              </span>
            </div>
          ))}
        </div>
      )}
    </StatCard>
  )
}

// ─ 2. 难度柱状图 ─────────────────────────────────────────────────────────────

function DifficultySection({ tasks }: { tasks: ReturnType<typeof useTaskStore>['tasks'] }) {
  const t = useT()
  const dist = [0, 0, 0, 0, 0]
  tasks.forEach((task) => {
    if (task.difficulty >= 1 && task.difficulty <= 5) dist[task.difficulty - 1]++
  })
  const maxCount = Math.max(1, ...dist)
  const total = tasks.length
  const hard = dist[3] + dist[4]
  const easy = dist[0] + dist[1]

  const guide = total === 0 ? t.archive_diffGuide_noTasks
    : (hard / total) >= 0.4 ? t.archive_diffGuide_hard(Math.round(hard / total * 100))
    : (easy / total) >= 0.6 ? t.archive_diffGuide_easy
    : t.archive_diffGuide_balanced

  return (
    <StatCard title={t.archive_sectionDifficulty} guide={guide}>
      {total === 0 ? <EmptyHint /> : (
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 80 }}>
          {dist.map((count, i) => {
            const isHard = i >= 3
            return (
              <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                <span style={{ fontSize: 10, fontFamily: 'var(--font-num)', fontWeight: 600, color: isHard ? 'var(--color-xp)' : 'var(--color-text-dim)' }}>
                  {count > 0 ? count : ''}
                </span>
                <motion.div
                  initial={{ height: 0 }}
                  animate={{ height: count > 0 ? Math.max(4, (count / maxCount) * 56) : 2 }}
                  transition={{ duration: 0.5, delay: i * 0.06 }}
                  style={{
                    width: '100%',
                    borderRadius: '3px 3px 0 0',
                    background: count > 0
                      ? (isHard ? 'var(--color-xp)' : 'var(--color-accent)')
                      : 'var(--color-border)',
                  }}
                />
                <span style={{ fontSize: 10, color: 'var(--color-text-dim)' }}>{'★'.repeat(i + 1)}</span>
              </div>
            )
          })}
        </div>
      )}
    </StatCard>
  )
}

// ─ 3. 区域时长排行 ───────────────────────────────────────────────────────────

function AreaTimeSection({ tasks, areas }: {
  tasks: ReturnType<typeof useTaskStore>['tasks']
  areas: Area[]
}) {
  const t = useT()
  const areaTimeMap: Record<string, number> = {}
  tasks.forEach((t) => {
    if (t.category) {
      areaTimeMap[t.category] = (areaTimeMap[t.category] ?? 0) + (t.actualMinutes ?? 0)
    }
  })

  const sorted = Object.entries(areaTimeMap)
    .filter(([, m]) => m > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)

  const maxMins = sorted.length > 0 ? sorted[0][1] : 1

  const areaMap = new Map(areas.map((a) => [a.category, a]))

  return (
    <StatCard title={t.archive_sectionFocus} guide={sorted.length > 0 ? t.archive_sectionFocusGuide(sorted.length) : t.archive_sectionFocusEmpty}>
      {sorted.length === 0 ? <EmptyHint /> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {sorted.map(([cat, mins], i) => {
            const area = areaMap.get(cat)
            const frac = mins / maxMins
            return (
              <div key={cat} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 11, color: 'var(--color-text-dim)', width: 16, textAlign: 'center' }}>#{i + 1}</span>
                <span style={{ fontSize: 14 }}>{area?.emoji ?? '📁'}</span>
                <span style={{ fontSize: 12, color: 'var(--color-text)', minWidth: 64, maxWidth: 96, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cat}</span>
                <div style={{ flex: 1, height: 6, borderRadius: 'var(--radius-full)', background: 'var(--color-border)', overflow: 'hidden' }}>
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${frac * 100}%` }}
                    transition={{ duration: 0.5, delay: i * 0.06 }}
                    style={{ height: '100%', borderRadius: 'var(--radius-full)', background: 'var(--color-accent)' }}
                  />
                </div>
                <span style={{ fontSize: 11, fontFamily: 'var(--font-num)', color: 'var(--color-text-dim)', whiteSpace: 'nowrap', minWidth: 56, textAlign: 'right' }}>
                  {fmtMinutes(mins, t)}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </StatCard>
  )
}

// ─ 4. 习惯坚持统计 ───────────────────────────────────────────────────────────

function HabitConsistencySection({ habitEvents, habits }: {
  habitEvents: GrowthEvent[]
  habits: ReturnType<typeof useHabitStore>['habits']
}) {
  const t = useT()
  const totalCompletions = habitEvents.length
  const activeStreaks = habits
    .filter((h) => h.consecutiveCount > 0)
    .sort((a, b) => b.consecutiveCount - a.consecutiveCount)
    .slice(0, 3)

  const MEDALS = ['🥇', '🥈', '🥉']

  return (
    <StatCard
      title={t.archive_sectionHabits}
      guide={totalCompletions > 0 ? t.archive_habitTotal(totalCompletions) : t.archive_habitEmpty}
    >
      {totalCompletions === 0 && activeStreaks.length === 0 ? <EmptyHint /> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {totalCompletions > 0 && (
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 4 }}>
              <span style={{ fontSize: 28, fontFamily: 'var(--font-num)', fontWeight: 800, color: 'var(--color-xp)', lineHeight: 1 }}>{totalCompletions}</span>
              <span style={{ fontSize: 12, color: 'var(--color-text-dim)' }}>{t.archive_habitCompletions}</span>
            </div>
          )}
          {activeStreaks.map((h, i) => (
            <div key={h.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 14 }}>{MEDALS[i]}</span>
              <span style={{ flex: 1, fontSize: 12, color: 'var(--color-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{h.title}</span>
              <span style={{ fontSize: 11, color: 'var(--color-xp)', fontFamily: 'var(--font-num)', fontWeight: 600, whiteSpace: 'nowrap' }}>
                {t.archive_streak(h.consecutiveCount)}
              </span>
              {h.toleranceCharges > 0 && (
                <span style={{ fontSize: 10, color: 'var(--color-secondary)' }}>{t.archive_tolerance(h.toleranceCharges)}</span>
              )}
            </div>
          ))}
        </div>
      )}
    </StatCard>
  )
}

// ─ 5. 高频行为镜像 ───────────────────────────────────────────────────────────

function RoutineSection({ tasks, habitEvents, habits }: {
  tasks: ReturnType<typeof useTaskStore>['tasks']
  habitEvents: GrowthEvent[]
  habits: ReturnType<typeof useHabitStore>['habits']
}) {
  const t = useT()
  const groups: Record<string, { count: number; totalMinutes: number }> = {}

  tasks.forEach((t) => {
    if (!t.title) return
    if (!groups[t.title]) groups[t.title] = { count: 0, totalMinutes: 0 }
    groups[t.title].count++
    groups[t.title].totalMinutes += t.actualMinutes ?? 0
  })

  habitEvents.forEach((e) => {
    const title = e.title.replace(/^.+[：:]\s*/, '')
    if (!groups[title]) groups[title] = { count: 0, totalMinutes: 0 }
    groups[title].count++
    groups[title].totalMinutes += e.details.actualMinutes ?? 0
  })

  const sorted = Object.entries(groups)
    .filter(([, v]) => v.count >= 2)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 8)

  return (
    <StatCard title={t.archive_sectionBehavior} guide={sorted.length > 0 ? t.archive_sectionBehaviorGuide(sorted.length) : t.archive_sectionBehaviorEmpty}>
      {sorted.length === 0 ? <EmptyHint /> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {sorted.map(([title, v]) => (
            <div key={title} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ flex: 1, fontSize: 12, color: 'var(--color-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</span>
              <span style={{ fontSize: 11, fontFamily: 'var(--font-num)', fontWeight: 600, color: 'var(--color-accent)', whiteSpace: 'nowrap' }}>×{v.count}</span>
              {v.totalMinutes > 0 && (
                <span style={{ fontSize: 11, color: 'var(--color-text-dim)', whiteSpace: 'nowrap' }}>{fmtMinutes(v.totalMinutes, t)}</span>
              )}
            </div>
          ))}
        </div>
      )}
    </StatCard>
  )
}

// ─ 通用卡片容器 ──────────────────────────────────────────────────────────────

function StatCard({ title, guide, children }: { title: string; guide: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        background: 'var(--color-surface)',
        borderRadius: 'var(--radius-xl)',
        border: '1px solid var(--color-border)',
        padding: '16px 20px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 12 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text)' }}>{title}</span>
        <span style={{ fontSize: 11, color: 'var(--color-text-dim)', fontStyle: 'italic' }}>{guide}</span>
      </div>
      {children}
    </div>
  )
}

function EmptyHint() {
  const t = useT()
  return <p style={{ fontSize: 12, color: 'var(--color-text-dim)', textAlign: 'center', padding: '12px 0' }}>{t.archive_noData}</p>
}

// ── 时光卷轴 ──────────────────────────────────────────────────────────────────

interface MonthBlock {
  key: string          // YYYY-MM
  label: string
  events: GrowthEvent[]
  levelUps: number
  milestones: number
  badges: number
  areaLevelUps: number
}

const EVENT_SYMBOL_COLORS: Record<string, string> = {
  '⬆': 'var(--color-accent)',
  '⭐': 'var(--color-xp)',
  '🏆': 'var(--color-secondary)',
  '🏘': 'var(--color-success)',
}

type EventSymbolConfig = Record<string, { symbol: string; label: string; color: string }>

function getEventSymbolConfig(t: ReturnType<typeof useT>): EventSymbolConfig {
  return {
    level_up:         { symbol: '⬆', label: t.archive_eventLevelUp,   color: 'var(--color-accent)' },
    milestone:        { symbol: '⭐', label: t.archive_eventMilestone, color: 'var(--color-xp)' },
    custom_milestone: { symbol: '⭐', label: t.archive_eventMilestone, color: 'var(--color-xp)' },
    badge_earned:     { symbol: '🏆', label: t.archive_eventBadge,     color: 'var(--color-secondary)' },
    area_level_up:    { symbol: '🏘', label: t.archive_eventAreaUp,    color: 'var(--color-success)' },
  }
}

const PRIORITY_ORDER = ['prestige', 'custom_milestone', 'milestone', 'badge_earned', 'level_up', 'area_level_up', 'habit_complete', 'task_complete', 'habit_skip', 'habit_miss']

function eventWeight(e: GrowthEvent): number {
  if (e.isMilestone) return 100
  const idx = PRIORITY_ORDER.indexOf(e.type)
  return idx === -1 ? 0 : PRIORITY_ORDER.length - idx
}

function groupByMonth(events: GrowthEvent[]): MonthBlock[] {
  const map = new Map<string, GrowthEvent[]>()
  for (const e of events) {
    const key = e.timestamp.slice(0, 7) // YYYY-MM
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(e)
  }

  return Array.from(map.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([key, evs]) => {
      const [y, m] = key.split('-')
      return {
        key,
        label: `${y}-${m}`,  // resolved to i18n in component
        events: evs,
        levelUps: evs.filter((e) => e.type === 'level_up').length,
        milestones: evs.filter((e) => e.isMilestone || e.type === 'milestone' || e.type === 'custom_milestone').length,
        badges: evs.filter((e) => e.type === 'badge_earned').length,
        areaLevelUps: evs.filter((e) => e.type === 'area_level_up').length,
      }
    })
}

function getEventIcon(e: GrowthEvent): string {
  switch (e.type) {
    case 'prestige': return '🔥'
    case 'custom_milestone':
    case 'milestone': return '⭐'
    case 'badge_earned': return '🏆'
    case 'level_up': return '⬆️'
    case 'area_level_up': return '🏘️'
    case 'task_complete': return '✓'
    case 'habit_complete': return '●'
    default: return '·'
  }
}

function ScrollTimeline() {
  const t = useT()
  const { events } = useGrowthEventStore()
  const [expandedKey, setExpandedKey] = useState<string | null>(null)
  const [lockedKey, setLockedKey] = useState<string | null>(null)

  const eventSymbolConfig = useMemo(() => getEventSymbolConfig(t), [t])
  const months = useMemo(() => groupByMonth(events), [events])

  if (months.length === 0) {
    return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-dim)', gap: 12 }}>
        <span style={{ fontSize: 40 }}>📜</span>
        <span style={{ fontSize: 14 }}>{t.archive_scrollEmpty1}</span>
        <span style={{ fontSize: 12 }}>{t.archive_scrollEmpty2}</span>
      </div>
    )
  }

  const activeKey = lockedKey ?? expandedKey

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* 图例 */}
      <div style={{ display: 'flex', gap: 16, padding: '10px 20px', borderBottom: '1px solid var(--color-border)', flexShrink: 0 }}>
        {Object.entries(eventSymbolConfig).filter(([k]) => ['level_up','milestone','badge_earned','area_level_up'].includes(k)).map(([k, cfg]) => (
          <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: cfg.color, fontFamily: 'var(--font-num)', width: 14, textAlign: 'center' }}>{cfg.symbol}</span>
            <span style={{ fontSize: 11, color: 'var(--color-text-dim)' }}>{cfg.label}</span>
          </div>
        ))}
        <span style={{ fontSize: 11, color: 'var(--color-text-dim)', marginLeft: 'auto', fontStyle: 'italic' }}>
          {t.archive_scrollHint}
        </span>
      </div>

      {/* 横向卷轴 */}
      <div
        style={{
          flex: 1,
          overflowX: 'auto',
          overflowY: 'hidden',
          display: 'flex',
          alignItems: 'stretch',
          padding: '20px 24px',
          gap: 0,
        }}
      >
        {/* 时间轴线 */}
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', minWidth: months.length * 180 }}>
          <div style={{ position: 'absolute', top: '50%', left: 0, right: 0, height: 2, background: 'var(--color-border)', transform: 'translateY(-50%)', zIndex: 0 }} />

          {months.map((block, idx) => (
            <MonthBlockCard
              key={block.key}
              block={block}
              isActive={activeKey === block.key}
              isLocked={lockedKey === block.key}
              onHover={() => { if (!lockedKey) setExpandedKey(block.key) }}
              onHoverEnd={() => { if (!lockedKey) setExpandedKey(null) }}
              onClick={() => {
                if (lockedKey === block.key) {
                  setLockedKey(null)
                } else {
                  setLockedKey(block.key)
                  setExpandedKey(null)
                }
              }}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

function MonthBlockCard({
  block,
  isActive,
  isLocked,
  onHover,
  onHoverEnd,
  onClick,
}: {
  block: MonthBlock
  isActive: boolean
  isLocked: boolean
  onHover: () => void
  onHoverEnd: () => void
  onClick: () => void
}) {
  const t = useT()
  const [y, m] = block.key.split('-')
  const monthLabel = t.archive_monthLabel(y, parseInt(m))
  const topEvents = useMemo(
    () => [...block.events].sort((a, b) => eventWeight(b) - eventWeight(a)).slice(0, isActive ? 8 : 3),
    [block.events, isActive]
  )

  const summaryParts: string[] = []
  if (block.levelUps > 0) summaryParts.push(`⬆×${block.levelUps}`)
  if (block.milestones > 0) summaryParts.push(`⭐×${block.milestones}`)
  if (block.badges > 0) summaryParts.push(`🏆×${block.badges}`)
  if (block.areaLevelUps > 0) summaryParts.push(`🏘×${block.areaLevelUps}`)

  return (
    <motion.div
      animate={{ width: isActive ? 260 : 160, opacity: 1 }}
      initial={{ width: 160, opacity: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      onMouseEnter={onHover}
      onMouseLeave={onHoverEnd}
      onClick={onClick}
      style={{
        flexShrink: 0,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        cursor: 'pointer',
        position: 'relative',
        zIndex: 1,
        padding: '0 8px',
      }}
    >
      {/* 连接点 */}
      <div style={{
        position: 'absolute', left: '50%', top: '50%',
        transform: 'translate(-50%, -50%)',
        width: 10, height: 10,
        borderRadius: '50%',
        background: isActive ? 'var(--color-accent)' : 'var(--color-border)',
        border: `2px solid ${isActive ? 'var(--color-accent)' : 'var(--color-surface)'}`,
        boxShadow: isActive ? '0 0 0 3px color-mix(in srgb, var(--color-accent) 20%, transparent)' : 'none',
        transition: 'all 0.2s',
        zIndex: 2,
      }} />

      {/* 上半：月份标题 + 事件列表 */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'flex-end',
          paddingBottom: 20,
          gap: 4,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            background: isActive
              ? 'color-mix(in srgb, var(--color-accent) 8%, var(--color-surface))'
              : 'var(--color-surface)',
            border: `1px solid ${isActive ? 'color-mix(in srgb, var(--color-accent) 30%, transparent)' : 'var(--color-border)'}`,
            borderRadius: 'var(--radius-lg)',
            padding: '10px 12px',
            boxShadow: isActive ? '0 4px 16px color-mix(in srgb, var(--color-accent) 10%, transparent)' : 'none',
            transition: 'all 0.2s',
          }}
        >
          {/* 月份标题 */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: isActive ? 'var(--color-accent)' : 'var(--color-text)' }}>
              {monthLabel}
            </span>
            {isLocked && <span style={{ fontSize: 9, color: 'var(--color-accent)', opacity: 0.7 }}>{t.archive_scrollLocked}</span>}
          </div>

          {/* Top 事件 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {topEvents.map((e) => (
              <div key={e.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 5 }}>
                <span style={{ fontSize: 11, flexShrink: 0, marginTop: 1 }}>{getEventIcon(e)}</span>
                <span
                  style={{
                    fontSize: 11,
                    color: e.isMilestone ? 'var(--color-accent)' : 'var(--color-text-dim)',
                    fontWeight: e.isMilestone ? 600 : 400,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    flex: 1,
                  }}
                >
                  {e.title.replace(/^.+[：:]\s*/, '')}
                </span>
              </div>
            ))}
            {!isActive && block.events.length > 3 && (
              <span style={{ fontSize: 10, color: 'var(--color-text-dim)', opacity: 0.6 }}>
                {t.archive_scrollMore(block.events.length - 3)}
              </span>
            )}
          </div>

          {/* 事件计数摘要 */}
          {summaryParts.length > 0 && (
            <div style={{ marginTop: 8, paddingTop: 6, borderTop: '1px solid var(--color-border)', display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {summaryParts.map((p, i) => {
                const sym = p[0]
                const color = EVENT_SYMBOL_COLORS[sym]
                return (
                  <span key={i} style={{ fontSize: 10, fontFamily: 'var(--font-num)', fontWeight: 600, color: color ?? 'var(--color-text-dim)' }}>
                    {p}
                  </span>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  )
}
