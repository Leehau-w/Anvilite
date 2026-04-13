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

/** Map `${dateStr}-${slotIdx}` → XP for that slot (0=凌晨,1=上午,2=下午,3=晚上) */
type SlotMap = Map<string, number>

/** Classify hour (0-23) into time slot index 0-3 */
function hourToSlot(hour: number): 0 | 1 | 2 | 3 {
  if (hour >= 1 && hour < 6)   return 0  // 凌晨 01-05
  if (hour >= 6 && hour < 12)  return 1  // 上午 06-11
  if (hour >= 12 && hour < 18) return 2  // 下午 12-17
  return 3                                // 晚上 18-00
}

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

  // 按天+时段聚合（用于周视图）
  const slotMap = useMemo<SlotMap>(() => {
    const map = new Map<string, number>()
    events.forEach((e) => {
      const xp = e.details.xpGained ?? 0
      if (!xp) return
      const date = e.timestamp.split('T')[0]
      const hour = new Date(e.timestamp).getHours()
      const slot = hourToSlot(hour)
      const key = `${date}-${slot}`
      map.set(key, (map.get(key) ?? 0) + xp)
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
      <WeekHeatmap slotMap={slotMap} cellSize={CELL} gap={GAP} />
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
      {/* 列标题：周一~周日（7 列） */}
      <div style={{ display: 'flex', gap, marginBottom: gap, marginLeft: 0 }}>
        {DOW_LABELS.map((l) => (
          <div
            key={l}
            style={{
              width: cellSize,
              height: 12,
              fontSize: 10,
              color: 'var(--color-text-dim)',
              textAlign: 'center',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {l}
          </div>
        ))}
      </div>

      {/* 每行 = 一周，7 格 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap }}>
        {weeks.map((week, wi) => (
          <div key={wi} style={{ display: 'flex', gap }}>
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
  )
}

function WeekHeatmap({ slotMap, cellSize, gap }: { slotMap: SlotMap; cellSize: number; gap: number }) {
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

  const SLOT_LABELS = t.heatmap_slots  // ['凌晨','上午','下午','晚上']
  const todayStr = today.toISOString().split('T')[0]
  const DOW_LABELS = t.heatmap_dow

  // 计算本周内单个时段最大 XP，用于颜色归一化
  const maxSlotXP = Math.max(
    1,
    ...days.flatMap((d) =>
      SLOT_LABELS.map((_, si) => slotMap.get(`${d}-${si}`) ?? 0)
    )
  )

  return (
    <div>
      <div style={{ display: 'flex', gap }}>
        {/* 时段标签列：顶部占位对齐日期行 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginRight: 4 }}>
          <div style={{ height: cellSize }} />
          {SLOT_LABELS.map((label) => (
            <div
              key={label}
              style={{
                width: 24,
                height: cellSize,
                fontSize: 10,
                color: 'var(--color-text-dim)',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              {label}
            </div>
          ))}
        </div>

        {/* 每列 = 每天 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {/* 日期标签行 */}
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

          {/* 每行 = 一个时段 */}
          {SLOT_LABELS.map((slotLabel, si) => (
            <div key={slotLabel} style={{ display: 'flex', gap }}>
              {days.map((dateStr) => {
                const xp = slotMap.get(`${dateStr}-${si}`) ?? 0
                const level = getHeatLevel(xp, maxSlotXP)
                return (
                  <HeatCell
                    key={`${dateStr}-${si}`}
                    date={`${dateStr} ${slotLabel}`}
                    xp={xp}
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
