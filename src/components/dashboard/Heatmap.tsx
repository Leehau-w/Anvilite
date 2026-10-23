import { useEffect, useMemo, useRef, useState } from 'react'
import { useTaskStore } from '@/stores/taskStore'
import { useT } from '@/i18n'
import { formatDateKey } from '@/utils/time'
import {
  buildTaskTrend, getTaskTrendHeatLevel, getTaskTrendMax, getTaskTrendMonthDates,
  getTaskTrendValue, getTaskTrendWeekDates, type TaskTrendMetric, type TaskTrendTotal,
} from '@/utils/taskTrend'

type HeatmapMode = 'month' | 'week'
type TrendMap = ReadonlyMap<string, TaskTrendTotal>

const HEAT_COLORS = [
  'var(--color-border)',
  'color-mix(in srgb, var(--color-accent) 20%, transparent)',
  'color-mix(in srgb, var(--color-accent) 45%, transparent)',
  'color-mix(in srgb, var(--color-accent) 72%, transparent)',
  'var(--color-accent)',
]

/** Fit the existing calendar cells to both dimensions of their card. */
function useContainerCellSize(cols: number, rows: number, gap: number, headerH: number, labelW = 0) {
  const ref = useRef<HTMLDivElement>(null)
  const [cell, setCell] = useState(16)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const compute = () => {
      const rect = el.getBoundingClientRect()
      const fromW = Math.floor((rect.width - labelW - (cols - 1) * gap) / cols)
      const fromH = Math.floor((rect.height - headerH - (rows - 1) * gap) / rows)
      setCell(Math.max(8, Math.min(fromW, fromH)))
    }
    compute()
    const obs = new ResizeObserver(compute)
    obs.observe(el)
    return () => obs.disconnect()
  }, [cols, rows, gap, headerH, labelW])
  return { ref, cell }
}

export function Heatmap() {
  const [mode, setMode] = useState<HeatmapMode>('month')
  const [metric, setMetric] = useState<TaskTrendMetric>('count')
  const tasks = useTaskStore(state => state.tasks)
  const trend = useMemo(() => buildTaskTrend(tasks), [tasks])
  const today = new Date()
  return (
    <div data-trend-metric={metric} data-trend-range={mode} style={{ width: '100%', height: '100%', minHeight: 0, display: 'flex', flexDirection: 'column' }}>
      <TabSwitcher mode={mode} onMode={setMode} metric={metric} onMetric={setMetric} />
      <div data-trend-calendar style={{ display: 'flex', flex: 1, minHeight: 0, minWidth: 0 }}>
        {mode === 'month'
          ? <MonthHeatmap dayMap={trend.days} metric={metric} gap={3} today={today} />
          : <WeekHeatmap slotMap={trend.slots} metric={metric} gap={3} today={today} />}
      </div>
    </div>
  )
}

function TabSwitcher({ mode, onMode, metric, onMetric }: {
  mode: HeatmapMode; onMode: (mode: HeatmapMode) => void
  metric: TaskTrendMetric; onMetric: (metric: TaskTrendMetric) => void
}) {
  const t = useT()
  const style = (active: boolean) => ({
    fontSize: 11, padding: '3px 8px', borderRadius: 'var(--radius-full)', border: 'none',
    background: active ? 'color-mix(in srgb, var(--color-accent) 15%, transparent)' : 'transparent',
    color: active ? 'var(--color-accent)' : 'var(--color-text-dim)',
    cursor: 'pointer', fontWeight: active ? 500 : 400, whiteSpace: 'nowrap' as const,
  })
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: '4px 8px', marginBottom: 8, flexShrink: 0 }}>
      <div style={{ display: 'flex', gap: 2 }}>
        {(['month', 'week'] as const).map(value => (
          <button type="button" key={value} aria-pressed={mode === value} onClick={() => onMode(value)} style={style(mode === value)}>
            {value === 'month' ? t.heatmap_month : t.heatmap_week}
          </button>
        ))}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
        {(['count', 'time'] as const).map(value => (
          <button type="button" key={value} aria-pressed={metric === value} onClick={() => onMetric(value)} style={style(metric === value)}>
            {value === 'count' ? t.heatmap_countMetric : t.heatmap_timeMetric}
          </button>
        ))}
      </div>
    </div>
  )
}

function MonthHeatmap({ dayMap, metric, gap, today }: { dayMap: TrendMap; metric: TaskTrendMetric; gap: number; today: Date }) {
  const t = useT()
  const dates = getTaskTrendMonthDates(today)
  const startDow = (new Date(today.getFullYear(), today.getMonth(), 1).getDay() + 6) % 7
  const cells: (string | null)[] = [...Array(startDow).fill(null), ...dates]
  while (cells.length % 7 !== 0) cells.push(null)
  const weeks: (string | null)[][] = []
  for (let index = 0; index < cells.length; index += 7) weeks.push(cells.slice(index, index + 7))
  const { ref, cell } = useContainerCellSize(7, weeks.length, gap, 12 + gap)
  const max = getTaskTrendMax(dates, dayMap, metric)
  const todayStr = formatDateKey(today)
  return (
    <div ref={ref} style={{ width: '100%', flex: 1, minHeight: 0 }}>
      <div style={{ display: 'flex', gap, marginBottom: gap }}>
        {t.heatmap_dow.map((label, index) => (
          <div key={index} style={{ width: cell, height: 12, fontSize: 10, color: 'var(--color-text-dim)', textAlign: 'center', flexShrink: 0 }}>{label}</div>
        ))}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap }}>
        {weeks.map((week, wi) => (
          <div key={wi} style={{ display: 'flex', gap }}>
            {week.map((date, di) => date ? (
              <HeatCell key={date} date={date} total={dayMap.get(date)} metric={metric}
                level={getTaskTrendHeatLevel(getTaskTrendValue(dayMap.get(date), metric), max)}
                isToday={date === todayStr} size={cell} />
            ) : <div key={'empty-' + wi + '-' + di} style={{ width: cell, height: cell, flexShrink: 0 }} />)}
          </div>
        ))}
      </div>
    </div>
  )
}

function WeekHeatmap({ slotMap, metric, gap, today }: { slotMap: TrendMap; metric: TaskTrendMetric; gap: number; today: Date }) {
  const t = useT()
  const SLOT_LABEL_W = 40
  const { ref, cell } = useContainerCellSize(7, 4, gap, 12 + gap, SLOT_LABEL_W + gap)
  const ranges = ['0–5', '6–11', '12–17', '18–23']
  const days = getTaskTrendWeekDates(today)
  const todayStr = formatDateKey(today)
  const max = getTaskTrendMax(days.flatMap(day => [0, 1, 2, 3].map(slot => day + '-' + slot)), slotMap, metric)
  return (
    <div ref={ref} style={{ width: '100%', flex: 1, minHeight: 0 }}>
      <div style={{ display: 'flex', gap, marginBottom: gap }}>
        <div style={{ width: SLOT_LABEL_W, flexShrink: 0 }} />
        {days.map((day, index) => (
          <div key={day} style={{ width: cell, flexShrink: 0, height: 12, fontSize: 10, textAlign: 'center', color: day === todayStr ? 'var(--color-accent)' : 'var(--color-text-dim)' }}>
            {t.heatmap_dow[index]}
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap }}>
        {t.heatmap_slots.map((slotLabel, slot) => (
          <div key={slot} style={{ display: 'flex', gap, alignItems: 'center' }}>
            <div style={{ width: SLOT_LABEL_W, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
              <span style={{ fontSize: 10, color: 'var(--color-text-dim)', lineHeight: 1 }}>{slotLabel}</span>
              <span style={{ fontSize: 9, color: 'var(--color-text-dim)', lineHeight: 1, opacity: 0.7 }}>{ranges[slot]}</span>
            </div>
            {days.map(date => {
              const total = slotMap.get(date + '-' + slot)
              return <HeatCell key={date + '-' + slot} date={date} slot={slot} slotLabel={slotLabel}
                total={total} metric={metric} level={getTaskTrendHeatLevel(getTaskTrendValue(total, metric), max)} isToday={false} size={cell} />
            })}
          </div>
        ))}
      </div>
    </div>
  )
}

function HeatCell({ date, slot, slotLabel, total, metric, level, isToday, size }: {
  date: string; slot?: number; slotLabel?: string; total?: TaskTrendTotal
  metric: TaskTrendMetric; level: 0 | 1 | 2 | 3 | 4; isToday: boolean; size: number
}) {
  const t = useT()
  const count = total?.count ?? 0
  const minutes = total?.minutes ?? 0
  const value = getTaskTrendValue(total, metric)
  const label = date + (slotLabel ? ' ' + slotLabel : '') + ' · ' + t.heatmap_taskCount(count) + ' · ' + t.heatmap_minutes(minutes)
  return (
    <div role="img" title={label} aria-label={label} data-trend-date={date} data-trend-slot={slot}
      data-trend-value={value} data-trend-count={count} data-trend-minutes={minutes} data-trend-level={level}
      style={{ width: size, height: size, flexShrink: 0, borderRadius: 'var(--radius-sm)', background: HEAT_COLORS[level],
        outline: isToday ? '1.5px solid var(--color-accent)' : 'none', cursor: value > 0 ? 'pointer' : 'default' }} />
  )
}
