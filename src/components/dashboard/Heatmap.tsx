import React, { useMemo, useState } from 'react'
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

export function Heatmap() {
  const [mode, setMode] = useState<HeatmapMode>('month')
  const { events } = useGrowthEventStore()

  const CELL = 16
  const GAP = 2

  // 按天聚合数据
  const dayMap = useMemo(() => {
    const map = new Map<string, DayData>()
    events.forEach((e) => {
      const xp = e.details.xpGained ?? 0
      if (!xp) return
      const date = e.timestamp.split('T')[0]
      const existing = map.get(date)
      if (existing) {
        existing.xp += xp
        existing.count += 1
      } else {
        map.set(date, { date, xp, count: 1 })
      }
    })
    return map
  }, [events])

  if (mode === 'month') {
    return (
      <div>
        <TabSwitcher mode={mode} onMode={setMode} />
        <MonthHeatmap dayMap={dayMap} cellSize={CELL} gap={GAP} />
      </div>
    )
  }

  return (
    <div>
      <TabSwitcher mode={mode} onMode={setMode} />
      <WeekHeatmap dayMap={dayMap} cellSize={CELL} gap={GAP} />
    </div>
  )
}

function TabSwitcher({ mode, onMode }: { mode: HeatmapMode; onMode: (m: HeatmapMode) => void }) {
  const t = useT()
  return (
    <div style={{ display: 'flex', gap: 4, marginBottom: 12 }}>
      {(['month', 'week'] as HeatmapMode[]).map((m) => (
        <button
          key={m}
          onClick={() => onMode(m)}
          style={{
            fontSize: 12,
            padding: '3px 10px',
            borderRadius: 'var(--radius-full)',
            border: 'none',
            background: mode === m ? 'color-mix(in srgb, var(--color-accent) 15%, transparent)' : 'transparent',
            color: mode === m ? 'var(--color-accent)' : 'var(--color-text-dim)',
            cursor: 'pointer',
            fontWeight: mode === m ? 500 : 400,
          }}
        >
          {m === 'month' ? t.heatmap_month : t.heatmap_week}
        </button>
      ))}
    </div>
  )
}

function MonthHeatmap({ dayMap, cellSize, gap }: { dayMap: Map<string, DayData>; cellSize: number; gap: number }) {
  const t = useT()
  const today = new Date()
  const year = today.getFullYear()
  const month = today.getMonth()

  // 获取本月所有天，按周排列（周一开始）
  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)

  // 找到第一天是周几（调整为周一=0）
  const startDow = (firstDay.getDay() + 6) % 7
  const cells: (string | null)[] = Array(startDow).fill(null)

  for (let d = 1; d <= lastDay.getDate(); d++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    cells.push(dateStr)
  }

  // 补齐到完整周
  while (cells.length % 7 !== 0) cells.push(null)

  const weeks = []
  for (let i = 0; i < cells.length; i += 7) {
    weeks.push(cells.slice(i, i + 7))
  }

  const maxXP = Math.max(...Array.from(dayMap.values()).map((d) => d.xp), 1)
  const todayStr = today.toISOString().split('T')[0]
  const DOW_LABELS = t.heatmap_dow

  return (
    <div>
      <div style={{ display: 'flex', gap }}>
        {/* 行标签（周一~周日） */}
        <div style={{ display: 'flex', flexDirection: 'column', gap, marginRight: 4 }}>
          {DOW_LABELS.map((l) => (
            <div
              key={l}
              style={{
                width: 12,
                height: cellSize,
                fontSize: 10,
                color: 'var(--color-text-dim)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {l}
            </div>
          ))}
        </div>

        {/* 每列=每周 */}
        <div style={{ display: 'flex', gap }}>
          {weeks.map((week, wi) => (
            <div key={wi} style={{ display: 'flex', flexDirection: 'column', gap }}>
              {week.map((dateStr, di) => {
                if (!dateStr) {
                  return (
                    <div
                      key={di}
                      style={{ width: cellSize, height: cellSize, borderRadius: 'var(--radius-sm)' }}
                    />
                  )
                }
                const data = dayMap.get(dateStr)
                const level = getHeatLevel(data?.xp ?? 0, maxXP)
                const isToday = dateStr === todayStr

                return (
                  <HeatCell
                    key={dateStr}
                    date={dateStr}
                    xp={data?.xp ?? 0}
                    count={data?.count ?? 0}
                    level={level}
                    isToday={isToday}
                    size={cellSize}
                  />
                )
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function WeekHeatmap({ dayMap, cellSize, gap }: { dayMap: Map<string, DayData>; cellSize: number; gap: number }) {
  const t = useT()
  const today = new Date()
  // 找本周周一
  const dayOfWeek = today.getDay() === 0 ? 7 : today.getDay()
  const monday = new Date(today)
  monday.setDate(today.getDate() - (dayOfWeek - 1))

  const days: string[] = []
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    days.push(d.toISOString().split('T')[0])
  }

  const SLOTS = t.heatmap_slots.map((label, idx) => {
    const hours = [{ startH: 1, endH: 6 }, { startH: 6, endH: 12 }, { startH: 12, endH: 18 }, { startH: 18, endH: 24 }]
    return { label, ...hours[idx] }
  })

  // 按时段聚合（需要 hourly events，简化为按天均分）
  const todayStr = today.toISOString().split('T')[0]
  const DOW_LABELS = t.heatmap_dow

  const maxXP = Math.max(...days.map((d) => dayMap.get(d)?.xp ?? 0), 1)

  return (
    <div>
      <div style={{ display: 'flex', gap }}>
        {/* 时段标签：顶部加一个与日期行等高的占位，gap 改为 8 与格子行对齐 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginRight: 4 }}>
          <div style={{ height: cellSize }} />
          {SLOTS.map((s) => (
            <div
              key={s.label}
              style={{
                width: 24,
                height: cellSize,
                fontSize: 10,
                color: 'var(--color-text-dim)',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              {s.label}
            </div>
          ))}
        </div>

        {/* 每列=每天 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {/* 日期标签 */}
          <div style={{ display: 'flex', gap }}>
            {days.map((d, i) => (
              <div
                key={d}
                style={{
                  width: cellSize,
                  height: cellSize,
                  fontSize: 10,
                  color: d === todayStr ? 'var(--color-accent)' : 'var(--color-text-dim)',
                  textAlign: 'center',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {DOW_LABELS[i]}
              </div>
            ))}
          </div>

          {/* 时段格子 */}
          {SLOTS.map((slot) => (
            <div key={slot.label} style={{ display: 'flex', gap }}>
              {days.map((dateStr) => {
                const data = dayMap.get(dateStr)
                // 简化：每天XP按4个时段均分
                const slotXP = Math.floor((data?.xp ?? 0) / 4)
                const level = getHeatLevel(slotXP, Math.floor(maxXP / 4))

                return (
                  <HeatCell
                    key={`${dateStr}-${slot.label}`}
                    date={`${dateStr} ${slot.label}`}
                    xp={slotXP}
                    count={0}
                    level={level}
                    isToday={dateStr === todayStr}
                    size={cellSize}
                  />
                )
              })}
            </div>
          ))}
        </div>
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
    <div style={{ position: 'relative' }}>
      <div
        style={{
          width: size,
          height: size,
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
        <div
          style={{
            position: 'absolute',
            bottom: size + 4,
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'var(--color-text)',
            color: 'var(--color-bg)',
            fontSize: 10,
            padding: '3px 8px',
            borderRadius: 'var(--radius-sm)',
            whiteSpace: 'nowrap',
            zIndex: 50,
            pointerEvents: 'none',
          }}
        >
          {date} · +{xp} XP{count > 0 ? ` ${t.heatmap_countSuffix(count)}` : ''}
        </div>
      )}
    </div>
  )
}
