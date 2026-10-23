import { useState } from 'react'
import { motion } from 'framer-motion'
import { useT } from '@/i18n'

export interface SkillDimension {
  name: string
  value: number
  emoji?: string
}

interface SkillRadarChartProps {
  dimensions: SkillDimension[]
  size?: number
  formatValue?: (value: number) => string
  ariaLabel?: string
}

type ChartProps = {
  dimensions: SkillDimension[]
  size: number
  formatValue: (value: number) => string
  description: string
}

function polar(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = (angleDeg - 90) * (Math.PI / 180)
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) }
}

function pts(points: { x: number; y: number }[]): string {
  return points.map(p => p.x.toFixed(2) + ',' + p.y.toFixed(2)).join(' ')
}

/** Bound long names to two lines; titles and accessible summaries retain the full name. */
function splitLabel(name: string): string[] {
  const lines: string[] = []
  let line = ''
  let width = 0
  for (const char of name) {
    const charWidth = /[\u0000-\u007f]/.test(char) ? 1 : 2
    if (width + charWidth > 8 && line) {
      lines.push(line.trim())
      line = ''
      width = 0
    }
    line += char
    width += charWidth
  }
  if (line.trim()) lines.push(line.trim())
  if (lines.length > 2) return [lines[0], Array.from(lines[1]).slice(0, -1).join('') + '…']
  return lines.length ? lines : ['']
}

function textWidth(text: string, fontSize = 10) {
  return Array.from(text).reduce((width, char) => width + (/[\u0000-\u007f]/.test(char) ? 0.6 : 1) * fontSize, 0)
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

function chartMaximum(dimensions: SkillDimension[]) {
  const max = Math.max(1, ...dimensions.map(d => d.value))
  const step = 10 ** Math.floor(Math.log10(max))
  const roundedMax = Math.ceil(max / step) * step
  return Number.isFinite(roundedMax) ? roundedMax : max
}

function RadarChart({ dimensions, size, formatValue, description }: ChartProps) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null)
  const cx = size / 2
  const cy = size / 2
  const maxR = size * 0.27
  const gridMax = chartMaximum(dimensions)
  const angles = dimensions.map((_, i) => (360 / dimensions.length) * i)
  const dataPoints = dimensions.map((d, i) => polar(cx, cy, maxR * Math.min(d.value / gridMax, 1), angles[i]))
  const axisPoints = angles.map(a => polar(cx, cy, maxR, a))
  const hovered = hoveredIdx === null ? undefined : dimensions[hoveredIdx]
  const hoveredPoint = hoveredIdx === null ? undefined : dataPoints[hoveredIdx]
  const tooltip = hovered && hoveredPoint ? (() => {
    const value = formatValue(hovered.value)
    const width = Math.min(size - 8, Math.max(44, textWidth(value) + 16))
    return { value, width, x: clamp(hoveredPoint.x - width / 2, 4, size - width - 4), y: clamp(hoveredPoint.y - 24, 4, size - 22) }
  })() : undefined

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}
      role="img" aria-label={description} data-capability-radar
      style={{ display: 'block', maxWidth: '100%', overflow: 'hidden' }}>
      <title>{description}</title>
      {[0.25, 0.5, 0.75, 1].map(fraction => (
        <polygon key={fraction} points={pts(angles.map(a => polar(cx, cy, maxR * fraction, a)))}
          fill="none" stroke="var(--color-border)" strokeWidth={0.8} />
      ))}
      {axisPoints.map((point, i) => (
        <line key={i} x1={cx} y1={cy} x2={point.x} y2={point.y} stroke="var(--color-border)" strokeWidth={0.8} />
      ))}
      <motion.polygon points={pts(dataPoints)}
        fill="color-mix(in srgb, var(--color-accent) 20%, transparent)" stroke="var(--color-accent)"
        strokeWidth={1.5} strokeLinejoin="round" initial={{ opacity: 0, scale: 0.4 }} animate={{ opacity: 1, scale: 1 }}
        style={{ transformOrigin: cx + 'px ' + cy + 'px' }} transition={{ duration: 0.6, ease: [0.34, 1.2, 0.64, 1] }} />
      {dataPoints.map((point, i) => (
        <motion.circle key={i} cx={point.x} cy={point.y} r={hoveredIdx === i ? 5 : 3}
          fill="var(--color-accent)" stroke="var(--color-surface)" strokeWidth={1.5}
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 + i * 0.04 }}
          tabIndex={0} aria-label={dimensions[i].name + ': ' + formatValue(dimensions[i].value)}
          onFocus={() => setHoveredIdx(i)} onBlur={() => setHoveredIdx(null)}
          onMouseEnter={() => setHoveredIdx(i)} onMouseLeave={() => setHoveredIdx(null)}
          style={{ cursor: 'default' }} />
      ))}
      {angles.map((angle, i) => {
        const d = dimensions[i]
        const isHovered = hoveredIdx === i
        const lineH = 12
        const lines = splitLabel(d.name)
        const blockH = lines.length * lineH
        const rawPoint = polar(cx, cy, maxR + 27, angle)
        const halfWidth = Math.max(...lines.map(line => textWidth(line))) / 2
        const x = clamp(rawPoint.x, halfWidth + 4, size - halfWidth - 4)
        const y = clamp(rawPoint.y, blockH / 2 + 4, size - blockH / 2 - 4) - (blockH - lineH) / 2
        return (
          <text key={i} x={x} y={y} textAnchor="middle" dominantBaseline="middle"
            fontSize={10} fontFamily="var(--font-en)" fontWeight={isHovered ? 600 : 400}
            fill={isHovered ? 'var(--color-accent)' : 'var(--color-text-dim)'}
            onMouseEnter={() => setHoveredIdx(i)} onMouseLeave={() => setHoveredIdx(null)}
            style={{ cursor: 'default', transition: 'fill 0.15s' }}>
            <title>{d.name + ': ' + formatValue(d.value)}</title>
            {lines.map((line, index) => <tspan key={index} x={x} dy={index === 0 ? 0 : lineH}>{line}</tspan>)}
          </text>
        )
      })}
      <circle cx={cx} cy={cy} r={2} fill="var(--color-border)" />
      <text x={cx + 4} y={cy - maxR} fontSize={8} fontFamily="var(--font-num)"
        fill="var(--color-text-dim)" dominantBaseline="middle" opacity={0.6}>{gridMax}</text>
      {tooltip && (
        <g data-capability-tooltip>
          <rect x={tooltip.x} y={tooltip.y} width={tooltip.width} height={18} rx={4}
            fill="var(--color-surface)" stroke="var(--color-border)" strokeWidth={0.8} />
          <text x={tooltip.x + tooltip.width / 2} y={tooltip.y + 12} textAnchor="middle"
            fontSize={10} fontFamily="var(--font-num)" fontWeight={600} fill="var(--color-accent)">{tooltip.value}</text>
        </g>
      )}
    </svg>
  )
}

function BarChart({ dimensions, size, formatValue, description }: ChartProps) {
  const gridMax = chartMaximum(dimensions)
  return (
    <div role="img" aria-label={description} data-capability-bars style={{ width: size, maxWidth: '100%',
      boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: 12, padding: '8px 4px' }}>
      {dimensions.map((d, i) => (
        <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
            <span title={d.name} style={{ minWidth: 0, overflowWrap: 'anywhere', fontSize: 12, color: 'var(--color-text)', fontWeight: 500 }}>
              {d.emoji ? d.emoji + ' ' : ''}{d.name}
            </span>
            <span style={{ flexShrink: 0, fontSize: 12, fontFamily: 'var(--font-num)', fontWeight: 600, color: 'var(--color-accent)' }}>
              {formatValue(d.value)}
            </span>
          </div>
          <div style={{ height: 8, borderRadius: 'var(--radius-full)', background: 'var(--color-border)', overflow: 'hidden' }}>
            <motion.div initial={{ width: 0 }} animate={{ width: Math.min(d.value / gridMax, 1) * 100 + '%' }}
              transition={{ duration: 0.7, delay: i * 0.1, ease: 'easeOut' }}
              style={{ height: '100%', borderRadius: 'var(--radius-full)', background: 'var(--color-accent)' }} />
          </div>
        </div>
      ))}
    </div>
  )
}

export function SkillRadarChart({ dimensions, size = 200, formatValue = String, ariaLabel }: SkillRadarChartProps) {
  const t = useT()
  const safeDimensions = dimensions.map(d => ({ ...d, value: Number.isFinite(d.value) ? Math.max(0, d.value) : 0 }))
  const description = [ariaLabel, ...safeDimensions.map(d => d.name + ': ' + formatValue(d.value))].filter(Boolean).join('; ')
  if (dimensions.length === 0) {
    return <div style={{ width: size, maxWidth: '100%', height: size * 0.5, display: 'flex', alignItems: 'center',
      justifyContent: 'center', fontSize: 12, color: 'var(--color-text-dim)' }}>{t.radar_empty}</div>
  }
  const Component = dimensions.length <= 2 ? BarChart : RadarChart
  return <Component dimensions={safeDimensions} size={size} formatValue={formatValue} description={description} />
}
