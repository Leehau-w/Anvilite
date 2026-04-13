import React, { useState } from 'react'
import { motion } from 'framer-motion'
import type { Area } from '@/types/area'
import { AREA_TEMPLATES, PROSPERITY_NAMES } from '@/types/area'
import { useTaskStore } from '@/stores/taskStore'
import { useHabitStore } from '@/stores/habitStore'
import { getProsperityInfo, getAreaSkillXP } from '@/engines/prosperityEngine'
import { getAreaDisplayName } from '@/utils/area'
import { useT } from '@/i18n'

interface AreaCardProps {
  area: Area
  editMode: boolean
  onClick: () => void
  onRename: (id: string) => void
  onDelete: (id: string) => void
}

function getAreaEmoji(templateId: string | null, prosperityLevel: number): string {
  if (!templateId) return '🏕️'
  const template = AREA_TEMPLATES[templateId as keyof typeof AREA_TEMPLATES]
  if (!template) return '🏕️'
  // 繁荣度 1-6，数组 index 0-5
  return template.prosperityEmojis[Math.max(0, prosperityLevel - 1)] ?? template.prosperityEmojis[0]
}

export function AreaCard({ area, editMode, onClick, onRename, onDelete }: AreaCardProps) {
  const t = useT()
  const tasks = useTaskStore((s) => s.tasks)
  const habits = useHabitStore((s) => s.habits)

  // 计算繁荣度
  const skillXP = getAreaSkillXP(tasks, area.category)
  const { prosperityLevel } = getProsperityInfo(skillXP)
  const prosperityName = PROSPERITY_NAMES[prosperityLevel - 1] ?? PROSPERITY_NAMES[0]
  const prosperityStars = '★'.repeat(prosperityLevel) + '☆'.repeat(6 - prosperityLevel)

  const emoji = getAreaEmoji(area.templateId, prosperityLevel)
  const displayName = getAreaDisplayName(area, t)

  const isHighProsperity = prosperityLevel >= 5

  return (
    <motion.div
      layout
      whileHover={editMode ? undefined : { scale: 1.03 }}
      onClick={() => !editMode && onClick()}
      style={{
        position: 'relative',
        padding: '16px 12px 12px',
        borderRadius: 'var(--radius-xl)',
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        cursor: editMode ? 'default' : 'pointer',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 4,
        minHeight: 140,
        transition: 'border-color 0.15s',
        boxShadow: isHighProsperity
          ? '0 0 12px color-mix(in srgb, var(--color-accent) 30%, transparent)'
          : undefined,
      }}
      onHoverStart={(e) => {
        if (!editMode) {
          const el = e.target as HTMLElement
          el.closest?.('[data-area-card]')?.setAttribute('style', `border-color: var(--color-accent)`)
        }
      }}
    >
      {/* 繁荣度 emoji */}
      <div style={{ fontSize: 32, lineHeight: 1.2 }}>{emoji}</div>

      {/* 区域名称 */}
      <div
        style={{
          fontSize: 13,
          fontWeight: 600,
          color: 'var(--color-text)',
          textAlign: 'center',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          width: '100%',
        }}
      >
        {displayName}
      </div>

      {/* 繁荣度星级 */}
      <div style={{ fontSize: 11, color: 'var(--color-xp)', letterSpacing: 1 }}>{prosperityStars}</div>

      {/* 繁荣度名称 */}
      <div style={{ fontSize: 11, color: 'var(--color-text-dim)' }}>{prosperityName}</div>

      {/* 编辑模式操作 */}
      {editMode && (
        <div
          style={{
            position: 'absolute',
            top: 4,
            right: 4,
            display: 'flex',
            gap: 2,
          }}
        >
          <button
            onClick={(e) => { e.stopPropagation(); onRename(area.id) }}
            title={t.worldmap_rename ?? '重命名'}
            style={editBtnStyle}
          >
            ✏
          </button>
          {area.canDelete && (
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(area.id) }}
              title={t.worldmap_delete ?? '删除'}
              style={{ ...editBtnStyle, color: 'var(--color-danger)' }}
            >
              ✕
            </button>
          )}
        </div>
      )}

      {/* 拖拽提示（编辑模式） */}
      {editMode && (
        <div style={{ position: 'absolute', bottom: 4, left: '50%', transform: 'translateX(-50%)', fontSize: 10, color: 'var(--color-text-dim)', opacity: 0.5 }}>
          ⠿
        </div>
      )}
    </motion.div>
  )
}

const editBtnStyle: React.CSSProperties = {
  width: 20,
  height: 20,
  fontSize: 11,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'var(--color-surface)',
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius-sm)',
  color: 'var(--color-text-dim)',
  cursor: 'pointer',
  padding: 0,
}
