import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { useT } from '@/i18n'

export interface SkillDimension {
  name: string       // 区域名称（短版，最多4字）
  value: number      // 技能等级
  emoji?: string     // 区域 emoji
}

interface SkillRadarChartProps {
  dimensions: SkillDimension[]
  size?: number      // SVG 边长，默认 200
}

// ── 工具 ─────────────────────────────────────────────────────────────────────

/** 极坐标 → 直角坐标 */
function polar(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = (angleDeg - 90) * (Math.PI / 180)   // 从正上方开始
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) }
}

/** 数组转 SVG polygon points 字符串 */
function pts(points: { x: number; y: number }[]): string {
  return points.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ')
}

// ── 雷达图（≥3 维度） ──────────────────────────────────────────────────────

function RadarChart({ dimensions, size }: Required<SkillRadarChartProps>) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null)

  const cx = size / 2
  const cy = size / 2
  const maxR = size * 0.38          // 留出标签空间
  const labelR = size * 0.47        // 标签半径
  const n = dimensions.length
  const maxVal = Math.max(1, ...dimensions.map((d) => d.value))
  // 最大刻度：取 maxVal 上取整到 5 的倍数，至少 5
  const gridMax = Math.max(5, Math.ceil(maxVal / 5) * 5)
  const GRIDS = 4                   // 背景同心圈数

  const angles = dimensions.map((_, i) => (360 / n) * i)

  // 背景圈顶点（正多边形）
  function gridPolygon(fraction: number) {
    return angles.map((a) => polar(cx, cy, maxR * fraction, a))
  }

  // 数据多边形顶点
  const dataPoints = dimensions.map((d, i) =>
    polar(cx, cy, maxR * Math.min(d.value / gridMax, 1), angles[i])
  )

  // 轴端点（最大值）
  const axisPoints = angles.map((a) => polar(cx, cy, maxR, a))

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      style={{ display: 'block', overflow: 'visible' }}
    >
      {/* 背景同心多边形 */}
      {Array.from({ length: GRIDS }, (_, gi) => {
        const frac = (gi + 1) / GRIDS
        return (
          <polygon
            key={gi}
            points={pts(gridPolygon(frac))}
            fill="none"
            stroke="var(--color-border)"
            strokeWidth={0.8}
          />
        )
      })}

      {/* 轴线 */}
      {axisPoints.map((pt, i) => (
        <line
          key={i}
          x1={cx} y1={cy}
          x2={pt.x} y2={pt.y}
          stroke="var(--color-border)"
          strokeWidth={0.8}
        />
      ))}

      {/* 数据填充 */}
      <motion.polygon
        points={pts(dataPoints)}
        fill="color-mix(in srgb, var(--color-accent) 20%, transparent)"
        stroke="var(--color-accent)"
        strokeWidth={1.5}
        strokeLinejoin="round"
        initial={{ opacity: 0, scale: 0.4 }}
        animate={{ opacity: 1, scale: 1 }}
        style={{ transformOrigin: `${cx}px ${cy}px` }}
        transition={{ duration: 0.6, ease: [0.34, 1.2, 0.64, 1] }}
      />

      {/* 数据点 */}
      {dataPoints.map((pt, i) => (
        <motion.circle
          key={i}
          cx={pt.x} cy={pt.y} r={hoveredIdx === i ? 5 : 3}
          fill="var(--color-accent)"
          stroke="var(--color-surface)"
          strokeWidth={1.5}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 + i * 0.04 }}
          style={{ cursor: 'default' }}
          onMouseEnter={() => setHoveredIdx(i)}
          onMouseLeave={() => setHoveredIdx(null)}
        />
      ))}

      {/* 悬浮值标签 */}
      {hoveredIdx !== null && (() => {
        const d = dimensions[hoveredIdx]
        const pt = dataPoints[hoveredIdx]
        return (
          <g>
            <rect
              x={pt.x - 22} y={pt.y - 22}
              width={44} height={16}
              rx={4}
              fill="var(--color-surface)"
              stroke="var(--color-border)"
              strokeWidth={0.8}
            />
            <text
              x={pt.x} y={pt.y - 11}
              textAnchor="middle"
              fontSize={10}
              fontFamily="var(--font-num)"
              fontWeight={600}
              fill="var(--color-accent)"
            >
              Lv.{d.value}
            </text>
          </g>
        )
      })()}

      {/* 轴标签 */}
      {angles.map((a, i) => {
        const lp = polar(cx, cy, labelR, a)
        const d = dimensions[i]
        const isHovered = hoveredIdx === i
        // 截断名称
        const label = d.name.length > 4 ? d.name.slice(0, 4) : d.name
        return (
          <text
            key={i}
            x={lp.x}
            y={lp.y}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize={isHovered ? 10 : 9}
            fontFamily="var(--font-zh)"
            fontWeight={isHovered ? 600 : 400}
            fill={isHovered ? 'var(--color-accent)' : 'var(--color-text-dim)'}
            style={{ cursor: 'default', transition: 'font-size 0.15s, fill 0.15s' }}
            onMouseEnter={() => setHoveredIdx(i)}
            onMouseLeave={() => setHoveredIdx(null)}
          >
            {label}
          </text>
        )
      })}

      {/* 中心点 */}
      <circle cx={cx} cy={cy} r={2} fill="var(--color-border)" />

      {/* 最大刻度标注 */}
      {(() => {
        const topPt = polar(cx, cy, maxR, 0)
        return (
          <text
            x={topPt.x + 4} y={topPt.y}
            fontSize={8}
            fontFamily="var(--font-num)"
            fill="var(--color-text-dim)"
            dominantBaseline="middle"
            opacity={0.6}
          >
            {gridMax}
          </text>
        )
      })()}
    </svg>
  )
}

// ── 柱状图（1-2 维度回退） ─────────────────────────────────────────────────

function BarChart({ dimensions, size }: Required<SkillRadarChartProps>) {
  const maxVal = Math.max(1, ...dimensions.map((d) => d.value))
  const gridMax = Math.max(5, Math.ceil(maxVal / 5) * 5)

  return (
    <div
      style={{
        width: size,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        padding: '8px 4px',
      }}
    >
      {dimensions.map((d, i) => {
        const frac = Math.min(d.value / gridMax, 1)
        return (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <span style={{ fontSize: 12, color: 'var(--color-text)', fontWeight: 500 }}>
                {d.emoji ? `${d.emoji} ` : ''}{d.name}
              </span>
              <span style={{ fontSize: 12, fontFamily: 'var(--font-num)', fontWeight: 600, color: 'var(--color-accent)' }}>
                Lv.{d.value}
              </span>
            </div>
            <div
              style={{
                height: 8,
                borderRadius: 'var(--radius-full)',
                background: 'var(--color-border)',
                overflow: 'hidden',
              }}
            >
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${frac * 100}%` }}
                transition={{ duration: 0.7, delay: i * 0.1, ease: 'easeOut' }}
                style={{
                  height: '100%',
                  borderRadius: 'var(--radius-full)',
                  background: 'var(--color-accent)',
                }}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── 主导出 ────────────────────────────────────────────────────────────────────

export function SkillRadarChart({ dimensions, size = 200 }: SkillRadarChartProps) {
  const t = useT()

  if (dimensions.length === 0) {
    return (
      <div
        style={{
          width: size,
          height: size * 0.5,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 12,
          color: 'var(--color-text-dim)',
        }}
      >
        {t.radar_empty}
      </div>
    )
  }

  if (dimensions.length <= 2) {
    return <BarChart dimensions={dimensions} size={size} />
  }

  return <RadarChart dimensions={dimensions} size={size} />
}
