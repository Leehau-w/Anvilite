import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useGrowthEventStore } from '@/stores/growthEventStore'
import { useT } from '@/i18n'

type HeatmapMode = 'month' | 'week'

interface DayData {
  date: string
  xp: number
  count: number
}

function getHeatLevel(xp: number, max: number): 0 | 1 | 2 | 3 | 4 {
  if (xp === 0 || max === 0) return 0
  const ratio = xp / max
  if (ratio < 0.2) return 1
  if (ratio < 0.45) return 2
  if (ratio < 0.75) return 3
  return 4
}

const HEAT_COLORS = [
  'var(--color-border)',
  'color-mix(in srgb, var(--color-accent) 20%, transparent)',
  'color-mix(in srgb, var(--color-accent) 45%, transparent)',
  'color-mix(in srgb, var(--color-accent) 72%, transparent)',
  'var(--color-accent)',
]

type SlotMap = Map<string, number>

function hourToSlot(hour: number): 0 | 1 | 2 | 3 {
  if (hour >= 1 && hour < 6)   return 0
  if (hour >= 6 && hour < 12)  return 1
  if (hour >= 12 && hour < 18) return 2
  return 3
}

/**
 * 量容器宽高，取宽/高两个方向的最小格子尺寸，确保格子不超出容器。
 * @param cols   列数（横向）
 * @param rows   行数（纵向，不含标题行）
 * @param gap    格子间距
 * @param headerH 标题行占用高度（含下方 gap）
 * @param labelW  左侧标签列宽度（周视图用）
 */
function useContainerCellSize(
  cols: number,
  rows: number,
  gap: number,
  headerH: number,
  labelW = 0,
) {
  const ref = useRef<HTMLDivElement>(null)
  const [cell, setCell] = useState(16)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const compute = () => {
      const rect = el.getBoundingClientRect()
      const availW = rect.width - labelW
      const availH = rect.height - headerH
      const fromW = Math.floor((availW - (cols - 1) * gap) / cols)
      const fromH = Math.floor((availH - (rows - 1) * gap) / rows)
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
  const { events } = useGrowthEventStore()

  const GAP = 3

  const dayMap = useMemo(() => {
    const map = new Map<string, DayData>()
    events.forEach((e) => {
      const xp = e.details.xpGained ?? 0
      if (!xp) return
      const date = e.timestamp.split('T')[0]
      const existing = map.get(date)
      if (existing) { existing.xp += xp; existing.count += 1 }
      else map.set(date, { date, xp, count: 1 })
    })
    return map
  }, [events])

  const slotMap = useMemo<SlotMap>(() => {
    const map = new Map<string, number>()
    events.forEach((e) => {
      const xp = e.details.xpGained ?? 0
      if (!xp) return
      const date = e.timestamp.split('T')[0]
      const slot = hourToSlot(new Date(e.timestamp).getHours())
      const key = `${date}-${slot}`
      map.set(key, (map.get(key) ?? 0) + xp)
    })
    return map
  }, [events])

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <TabSwitcher mode={mode} onMode={setMode} />
      {mode === 'month'
        ? <MonthHeatmap dayMap={dayMap} gap={GAP} />
        : <WeekHeatmap slotMap={slotMap} gap={GAP} />
      }
    </div>
  )
}

function TabSwitcher({ mode, onMode }: { mode: HeatmapMode; onMode: (m: HeatmapMode) => void }) {
  const t = useT()
  return (
    <div style={{ display: 'flex', gap: 4, marginBottom: 12 }}>
      {(['month', 'week'] as HeatmapMode[]).map((m) => (
        <button key={m} onClick={() => onMode(m)}
          style={{
            fontSize: 12, padding: '3px 10px', borderRadius: 'var(--radius-full)', border: 'none',
            background: mode === m ? 'color-mix(in srgb, var(--color-accent) 15%, transparent)' : 'transparent',
            color: mode === m ? 'var(--color-accent)' : 'var(--color-text-dim)',
            cursor: 'pointer', fontWeight: mode === m ? 500 : 400,
          }}
        >
          {m === 'month' ? t.heatmap_month : t.heatmap_week}
        </button>
      ))}
    </div>
  )
}

function MonthHeatmap({ dayMap, gap }: { dayMap: Map<string, DayData>; gap: number }) {
  const t = useT()

  const today = new Date()
  const year = today.getFullYear()
  const month = today.getMonth()
  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)
  const startDow = (firstDay.getDay() + 6) % 7
  const cells: (string | null)[] = Array(startDow).fill(null)
  for (let d = 1; d <= lastDay.getDate(); d++) {
    cells.push(`${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`)
  }
  while (cells.length % 7 !== 0) cells.push(null)

  const weeks: (string | null)[][] = []
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7))

  // headerH = DOW 标题行高度(12) + 下方 gap(gap)
  const { ref, cell } = useContainerCellSize(7, weeks.length, gap, 12 + gap)

  const maxXP = Math.max(...Array.from(dayMap.values()).map((d) => d.xp), 1)
  const todayStr = today.toISOString().split('T')[0]
  const DOW_LABELS = t.heatmap_dow

  return (
    <div ref={ref} style={{ width: '100%', flex: 1 }}>
      {/* DOW 标题 */}
      <div style={{ display: 'flex', gap, marginBottom: gap }}>
        {DOW_LABELS.map((l) => (
          <div key={l} style={{ width: cell, height: 12, fontSize: 10, color: 'var(--color-text-dim)', textAlign: 'center', flexShrink: 0 }}>
            {l}
          </div>
        ))}
      </div>
      {/* 周行 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap }}>
        {weeks.map((week, wi) => (
          <div key={wi} style={{ display: 'flex', gap }}>
            {week.map((dateStr, di) =>
              dateStr ? (
                <HeatCell
                  key={dateStr}
                  date={dateStr}
                  xp={dayMap.get(dateStr)?.xp ?? 0}
                  count={dayMap.get(dateStr)?.count ?? 0}
                  level={getHeatLevel(dayMap.get(dateStr)?.xp ?? 0, maxXP)}
                  isToday={dateStr === todayStr}
                  size={cell}
                />
              ) : (
                <div key={`e-${wi}-${di}`} style={{ width: cell, height: cell, flexShrink: 0 }} />
              )
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

function WeekHeatmap({ slotMap, gap }: { slotMap: SlotMap; gap: number }) {
  const t = useT()
  const SLOT_LABEL_W = 40   // 时段标签列宽（px）
  // headerH = DOW 标题行高度(12) + 下方 gap；rows = 4 时段
  const { ref, cell } = useContainerCellSize(7, 4, gap, 12 + gap, SLOT_LABEL_W + 4)
  // 与 hourToSlot 对应的时间范围
  const SLOT_RANGES = ['1–5', '6–11', '12–17', '18–0']

  const today = new Date()
  const dayOfWeek = today.getDay() === 0 ? 7 : today.getDay()
  const monday = new Date(today)
  monday.setDate(today.getDate() - (dayOfWeek - 1))
  const days: string[] = []
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    days.push(d.toISOString().split('T')[0])
  }

  const SLOT_LABELS = t.heatmap_slots
  const todayStr = today.toISOString().split('T')[0]
  const DOW_LABELS = t.heatmap_dow

  const maxSlotXP = Math.max(
    1,
    ...days.flatMap((d) => SLOT_LABELS.map((_, si) => slotMap.get(`${d}-${si}`) ?? 0))
  )

  return (
    <div ref={ref} style={{ width: '100%', flex: 1 }}>
      {/* 标题行 */}
      <div style={{ display: 'flex', gap, marginBottom: gap }}>
        <div style={{ width: SLOT_LABEL_W, flexShrink: 0 }} />
        {days.map((d, i) => (
          <div key={d} style={{
            width: cell, flexShrink: 0, height: 12, fontSize: 10, textAlign: 'center',
            color: d === todayStr ? 'var(--color-accent)' : 'var(--color-text-dim)',
          }}>
            {DOW_LABELS[i]}
          </div>
        ))}
      </div>

      {/* 时段行 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap }}>
        {SLOT_LABELS.map((slotLabel, si) => (
          <div key={slotLabel} style={{ display: 'flex', gap, alignItems: 'center' }}>
            {/* 时段标签：名称 + 时间范围 */}
            <div style={{ width: SLOT_LABEL_W, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
              <span style={{ fontSize: 10, color: 'var(--color-text-dim)', lineHeight: 1 }}>{slotLabel}</span>
              <span style={{ fontSize: 9, color: 'var(--color-text-dim)', lineHeight: 1, opacity: 0.7 }}>{SLOT_RANGES[si]}</span>
            </div>
            {days.map((dateStr) => {
              const xp = slotMap.get(`${dateStr}-${si}`) ?? 0
              return (
                <HeatCell
                  key={`${dateStr}-${si}`}
                  date={`${dateStr} ${slotLabel}`}
                  xp={xp}
                  count={0}
                  level={getHeatLevel(xp, maxSlotXP)}
                  isToday={false}
                  size={cell}
                />
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}

interface HeatCellProps {
  date: string
  xp: number
  count: number
  level: 0 | 1 | 2 | 3 | 4
  isToday: boolean
  size: number
}

function HeatCell({ date, xp, count, level, isToday, size }: HeatCellProps) {
  const [tooltip, setTooltip] = useState(false)
  const t = useT()

  return (
    <div style={{ position: 'relative', flexShrink: 0 }}>
      <div
        style={{
          width: size, height: size,
          borderRadius: 'var(--radius-sm)',
          background: HEAT_COLORS[level],
          outline: isToday ? '1.5px solid var(--color-accent)' : 'none',
          cursor: xp > 0 ? 'pointer' : 'default',
          transition: 'transform 0.1s',
        }}
        onMouseEnter={() => setTooltip(true)}
        onMouseLeave={() => setTooltip(false)}
        onMouseDown={(e) => { e.currentTarget.style.transform = 'scale(0.9)' }}
        onMouseUp={(e) => { e.currentTarget.style.transform = 'scale(1)' }}
      />
      {tooltip && xp > 0 && (
        <div style={{
          position: 'absolute', bottom: size + 4, left: '50%', transform: 'translateX(-50%)',
          background: 'var(--color-text)', color: 'var(--color-bg)',
          fontSize: 10, padding: '3px 8px', borderRadius: 'var(--radius-sm)',
          whiteSpace: 'nowrap', zIndex: 50, pointerEvents: 'none',
        }}>
          {date} · +{xp} XP{count > 0 ? ` ${t.heatmap_countSuffix(count)}` : ''}
        </div>
      )}
    </div>
  )
}
