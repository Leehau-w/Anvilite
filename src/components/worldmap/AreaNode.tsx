import React, { useState } from 'react'
import { motion } from 'framer-motion'
import type { Area } from '@/types/area'
import { AREA_TEMPLATES } from '@/types/area'
import type { ProsperityInfo } from '@/engines/prosperityEngine'
import { useT } from '@/i18n'
import { getAreaDisplayName } from '@/utils/area'

interface AreaNodeProps {
  area: Area
  prosperity: ProsperityInfo
  isSelected: boolean
  isEditMode: boolean
  glowing: boolean
  onSelect: () => void
  onEdit: () => void
  onDelete: () => void
  onDragStart: (e: React.PointerEvent) => void
}

export function AreaNode({
  area,
  prosperity,
  isSelected,
  isEditMode,
  glowing,
  onSelect,
  onEdit,
  onDelete,
  onDragStart,
}: AreaNodeProps) {
  const [hovered, setHovered] = useState(false)
  const t = useT()

  const template = area.templateId ? AREA_TEMPLATES[area.templateId] : null
  const emoji = template ? template.prosperityEmojis[prosperity.prosperityLevel - 1] : '🏗️'
  const stars = Array.from({ length: 6 }, (_, i) => i < prosperity.prosperityLevel)

  // 不可改名：只有里程碑殿堂
  const canRename = area.templateId !== 'milestone'

  const glowShadow = glowing
    ? '0 0 24px 8px color-mix(in srgb, var(--color-accent) 60%, transparent)'
    : isSelected
    ? '0 0 16px color-mix(in srgb, var(--color-accent) 35%, transparent)'
    : hovered
    ? '0 4px 12px color-mix(in srgb, var(--color-accent) 15%, transparent)'
    : '0 2px 6px rgba(0,0,0,0.08)'

  return (
    <motion.div
      data-area-node="true"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={(e) => { e.stopPropagation(); onSelect() }}
      onPointerDown={isEditMode ? onDragStart : undefined}
      animate={{ scale: hovered && !isEditMode ? 1.05 : 1 }}
      transition={{ duration: 0.15 }}
      style={{
        position: 'absolute',
        left: area.position.x,
        top: area.position.y,
        transform: 'translate(-50%, -50%)',
        width: 100,
        cursor: isEditMode ? 'grab' : 'pointer',
        userSelect: 'none',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 3,
      }}
    >
      {/* 建筑体 */}
      <motion.div
        animate={glowing ? {
          boxShadow: [
            '0 0 12px 4px color-mix(in srgb, var(--color-accent) 40%, transparent)',
            '0 0 32px 12px color-mix(in srgb, var(--color-accent) 70%, transparent)',
            '0 0 12px 4px color-mix(in srgb, var(--color-accent) 40%, transparent)',
          ],
        } : { boxShadow: glowShadow }}
        transition={glowing ? { duration: 1, repeat: 1, ease: 'easeInOut' } : { duration: 0.15 }}
        style={{
          width: 80,
          height: 80,
          borderRadius: 'var(--radius-lg)',
          background: isSelected
            ? 'color-mix(in srgb, var(--color-accent) 12%, var(--color-surface))'
            : hovered
            ? 'var(--color-surface-hover)'
            : 'var(--color-surface)',
          border: `2px solid ${
            isSelected || glowing
              ? 'var(--color-accent)'
              : hovered
              ? 'color-mix(in srgb, var(--color-accent) 30%, var(--color-border))'
              : 'var(--color-border)'
          }`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          transition: 'border-color 0.15s, background 0.15s',
          overflow: 'visible',
        }}
      >
        {/* emoji 在繁荣升级时缩放动画 */}
        <motion.span
          key={`${area.id}-${prosperity.prosperityLevel}`}
          initial={glowing ? { scale: 1.5, opacity: 0.5 } : false}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.5 }}
          style={{ fontSize: 36 }}
        >
          {emoji}
        </motion.span>

        {/* 编辑模式操作按钮 */}
        {isEditMode && (
          <div style={{ position: 'absolute', top: -8, right: -8, display: 'flex', gap: 3 }}>
            {canRename && (
              <button
                onClick={(e) => { e.stopPropagation(); onEdit() }}
                style={editBtnStyle('var(--color-secondary)')}
                title="改名"
              >
                ✏️
              </button>
            )}
            {area.canDelete && (
              <button
                onClick={(e) => { e.stopPropagation(); onDelete() }}
                style={editBtnStyle('var(--color-danger)')}
                title="删除"
              >
                ✕
              </button>
            )}
          </div>
        )}
      </motion.div>

      {/* 区域名称 */}
      <span
        style={{
          fontSize: 12,
          fontWeight: 600,
          color: isSelected ? 'var(--color-accent)' : 'var(--color-text)',
          textAlign: 'center',
          whiteSpace: 'nowrap',
          letterSpacing: '0.01em',
          textShadow: '0 1px 3px rgba(0,0,0,0.15)',
        }}
      >
        {getAreaDisplayName(area, t)}
      </span>

      {/* 繁荣星级 */}
      <div style={{ display: 'flex', gap: 1 }}>
        {stars.map((filled, i) => (
          <span key={i} style={{ fontSize: 9, color: filled ? 'var(--color-accent)' : 'var(--color-border)' }}>
            {filled ? '★' : '☆'}
          </span>
        ))}
      </div>

      {/* 迷你进度条 */}
      <div style={{ width: 60, height: 3, borderRadius: 9999, background: 'var(--color-border)', overflow: 'hidden' }}>
        <div
          style={{
            width: `${prosperity.subLevelFraction * 100}%`,
            height: '100%',
            background: 'var(--color-accent)',
            borderRadius: 9999,
            transition: 'width 0.4s ease',
          }}
        />
      </div>
    </motion.div>
  )
}

function editBtnStyle(color: string): React.CSSProperties {
  return {
    width: 18, height: 18, borderRadius: '50%',
    background: color, border: 'none', color: 'white',
    fontSize: 9, cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: 0, lineHeight: 1,
  }
}
