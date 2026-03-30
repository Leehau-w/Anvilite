import React from 'react'
import { motion } from 'framer-motion'
import type { Area } from '@/types/area'
import type { ProsperityInfo } from '@/engines/prosperityEngine'
import { useTaskStore } from '@/stores/taskStore'
import { useHabitStore } from '@/stores/habitStore'
import { useT } from '@/i18n'
import { getAreaDisplayName } from '@/utils/area'

interface AreaInfoBarProps {
  area: Area
  prosperity: ProsperityInfo
  onClose: () => void
  onEnter: () => void
}

export function AreaInfoBar({ area, prosperity, onClose, onEnter }: AreaInfoBarProps) {
  const { tasks } = useTaskStore()
  const { habits } = useHabitStore()
  const t = useT()

  const areaCategory = area.category === '_milestone' ? null : area.category

  const areaTasks = areaCategory
    ? tasks.filter((t) => !t.deletedAt && t.category === areaCategory)
    : tasks.filter((t) => !t.deletedAt)

  const areaHabits = areaCategory
    ? habits.filter((h) => h.status !== 'archived' && h.category === areaCategory)
    : []

  const activeTasks = areaTasks.filter((t) => t.status === 'doing')
  const totalXP = areaTasks
    .filter((t) => t.status === 'done')
    .reduce((sum, t) => sum + t.xpReward, 0)

  const stars = Array.from({ length: 6 }, (_, i) => i < prosperity.prosperityLevel)

  return (
    <motion.div
      initial={{ y: '100%' }}
      animate={{ y: 0 }}
      exit={{ y: '100%' }}
      transition={{ duration: 0.25, ease: [0, 0, 0.2, 1] }}
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: 130,
        background: 'var(--color-surface)',
        borderTop: '1px solid var(--color-border)',
        boxShadow: '0 -4px 20px rgba(0,0,0,0.1)',
        display: 'flex',
        alignItems: 'center',
        padding: '0 24px',
        gap: 24,
        zIndex: 20,
      }}
    >
      {/* 区域名称 + 繁荣信息 */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--color-text)' }}>
            {getAreaDisplayName(area, t)}
          </span>
          <span
            style={{
              fontSize: 12,
              color: 'var(--color-accent)',
              fontWeight: 500,
            }}
          >
            {prosperity.prosperityName}
          </span>
          <div style={{ display: 'flex', gap: 2 }}>
            {stars.map((filled, i) => (
              <span key={i} style={{ fontSize: 10, color: filled ? 'var(--color-accent)' : 'var(--color-border)' }}>
                {filled ? '★' : '☆'}
              </span>
            ))}
          </div>
        </div>

        {/* 进度条 */}
        <div
          style={{
            width: 150,
            height: 4,
            borderRadius: 9999,
            background: 'var(--color-border)',
            overflow: 'hidden',
            marginBottom: 8,
          }}
        >
          <div
            style={{
              width: `${prosperity.subLevelFraction * 100}%`,
              height: '100%',
              background: 'var(--color-accent)',
              borderRadius: 9999,
            }}
          />
        </div>

        {/* 统计数字 */}
        <div
          style={{
            fontSize: 12,
            color: 'var(--color-text-dim)',
            display: 'flex',
            gap: 12,
            marginBottom: 6,
          }}
        >
          <span>
            {t.areaInfo_tasks} <strong style={{ color: 'var(--color-text)', fontFamily: 'var(--font-num)' }}>{areaTasks.length}</strong>
          </span>
          {areaCategory && (
            <span>
              {t.areaInfo_habits} <strong style={{ color: 'var(--color-text)', fontFamily: 'var(--font-num)' }}>{areaHabits.length}</strong>
            </span>
          )}
          <span>
            {t.areaInfo_totalXP} <strong style={{ color: 'var(--color-xp)', fontFamily: 'var(--font-num)' }}>{totalXP} XP</strong>
          </span>
        </div>

        {/* 进行中任务 */}
        {activeTasks.length > 0 && (
          <div style={{ fontSize: 12, color: 'var(--color-text-dim)', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ color: 'var(--color-accent)', flexShrink: 0 }}>▸</span>
            {activeTasks.slice(0, 2).map((t) => (
              <span key={t.id} style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 180 }}>
                {t.title}
              </span>
            ))}
            {activeTasks.length > 2 && (
              <span style={{ opacity: 0.6 }}>{t.areaInfo_moreActive(activeTasks.length - 2)}</span>
            )}
          </div>
        )}
      </div>

      {/* 右侧：进入按钮 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end' }}>
        <button
          onClick={onEnter}
          style={{
            padding: '8px 20px',
            borderRadius: 'var(--radius-md)',
            background: 'var(--color-accent)',
            border: 'none',
            color: 'white',
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            transition: 'background 0.15s',
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--color-accent-hover)' }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--color-accent)' }}
        >
          {t.areaInfo_enter}
        </button>
        <button
          onClick={onClose}
          style={{
            padding: '4px 12px',
            borderRadius: 'var(--radius-md)',
            background: 'transparent',
            border: '1px solid var(--color-border)',
            color: 'var(--color-text-dim)',
            fontSize: 12,
            cursor: 'pointer',
          }}
        >
          {t.areaInfo_close}
        </button>
      </div>
    </motion.div>
  )
}
