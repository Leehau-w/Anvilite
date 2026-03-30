import React from 'react'
import { useCharacterStore } from '@/stores/characterStore'
import { useTaskStore } from '@/stores/taskStore'
import { getXPProgress, xpToNextLevel } from '@/engines/levelEngine'
import { getElapsedSeconds } from '@/utils/time'
import { AnimatedXPBar } from '@/components/feedback/AnimatedXPBar'
import { useT } from '@/i18n'
import type { Translations } from '@/i18n'

const STATUS_ICONS: Record<string, { icon: string; key: keyof Translations }> = {
  active:    { icon: '⚡', key: 'charCard_status_active' },
  charging:  { icon: '🔋', key: 'charCard_status_charging' },
  resting:   { icon: '💤', key: 'charCard_status_resting' },
  traveling: { icon: '🌄', key: 'charCard_status_traveling' },
  returning: { icon: '🌅', key: 'charCard_status_returning' },
}

const CATEGORY_STATUS: Record<string, { icon: string; key: keyof Translations }> = {
  '藏书阁': { icon: '📚', key: 'charCard_catStatus_library' },
  '锻造坊':   { icon: '💼', key: 'charCard_catStatus_forge' },
  '竞技场':   { icon: '🏃', key: 'charCard_catStatus_arena' },
  '灵感工坊': { icon: '✨', key: 'charCard_catStatus_workshop' },
  '家园':     { icon: '🏠', key: 'charCard_catStatus_home' },
}

const TITLE_THRESHOLDS = [1, 6, 11, 16, 21, 31, 41, 51] as const
function getTitleIndex(level: number): number {
  for (let i = TITLE_THRESHOLDS.length - 1; i >= 0; i--) {
    if (level >= TITLE_THRESHOLDS[i]) return i
  }
  return 0
}

interface CharacterMiniCardProps {
  onClickMilestone?: () => void
}

export function CharacterMiniCard({ onClickMilestone }: CharacterMiniCardProps) {
  const { character } = useCharacterStore()
  const { tasks } = useTaskStore()
  const t = useT()

  // Translated title via i18n arrays
  const titleIdx = getTitleIndex(character.level)
  const titleDisplay = character.titlePreset === 'rpg'
    ? t.titles_rpg[titleIdx]
    : (character.titlePreset === 'custom' && character.customTitles?.[titleIdx])
      ? character.customTitles[titleIdx]
      : t.titles_forge[titleIdx]

  // 找优先级最高的进行中任务
  const doingTasks = tasks.filter((task) => task.status === 'doing' && !task.deletedAt)
  const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 }
  const topDoing = doingTasks.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority])[0]

  let statusInfo: { icon: string; label: string; extra?: string }
  if (topDoing) {
    const catStatus = CATEGORY_STATUS[topDoing.category]
    const icon = catStatus ? catStatus.icon : '📌'
    const label = catStatus ? (t[catStatus.key] as string) : t.charCard_busy
    const elapsed = topDoing.actualMinutes + Math.floor(getElapsedSeconds(topDoing.timerStartedAt) / 60)
    statusInfo = {
      icon,
      label,
      extra: elapsed > 0 ? t.charCard_elapsedMin(elapsed) : undefined,
    }
  } else {
    const s = STATUS_ICONS[character.globalStatus] ?? STATUS_ICONS.active
    statusInfo = { icon: s.icon, label: t[s.key] as string }
  }

  return (
    <div
      onClick={onClickMilestone}
      style={{
        cursor: onClickMilestone ? 'pointer' : 'default',
        padding: '14px',
        background: 'var(--color-surface)',
        borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--color-border)',
        boxShadow: 'var(--shadow-sm)',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        transition: 'box-shadow 0.15s',
      }}
      onMouseEnter={(e) => {
        if (onClickMilestone) e.currentTarget.style.boxShadow = 'var(--shadow-md)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = 'var(--shadow-sm)'
      }}
    >
      {/* 状态行 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 22 }}>{statusInfo.icon}</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)' }}>
            {statusInfo.label}
            {statusInfo.extra && (
              <span style={{ fontSize: 11, color: 'var(--color-text-dim)', marginLeft: 6, fontWeight: 400 }}>
                · {statusInfo.extra}
              </span>
            )}
          </div>
          <div style={{ fontSize: 12, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 4 }}>
            {(character.prestigeLevel ?? 0) > 0 && (
              <span style={{ fontSize: 10, letterSpacing: 1 }}>{'🌟'.repeat(Math.min(character.prestigeLevel, 5))}</span>
            )}
            <span style={{ color: 'var(--color-accent)' }}>Lv.{character.level}</span>
            <span style={{ color: 'var(--color-text-dim)' }}>·</span>
            <span
              className={(character.prestigeLevel ?? 0) > 0 ? 'prestige-title' : ''}
              style={(character.prestigeLevel ?? 0) === 0 ? { color: 'var(--color-accent)' } : {}}
            >
              {titleDisplay}
            </span>
          </div>
        </div>
        {onClickMilestone && (
          <span style={{ fontSize: 10, color: 'var(--color-text-dim)' }}>→</span>
        )}
      </div>

      {/* 经验条 */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
          <span style={{ fontSize: 10, color: 'var(--color-text-dim)' }}>{t.charCard_xp}</span>
          <span style={{ fontSize: 10, fontFamily: 'var(--font-num)', color: 'var(--color-text-dim)' }}>
            {character.currentXP}/{xpToNextLevel(character.level)}
          </span>
        </div>
        <div
          style={{
            height: 6,
            background: 'var(--color-border)',
            borderRadius: 'var(--radius-full)',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              height: '100%',
              width: `${getXPProgress(character.currentXP, character.level) * 100}%`,
              background: 'var(--color-accent)',
              borderRadius: 'var(--radius-full)',
              transition: 'width 0.6s cubic-bezier(0.4, 0, 0.2, 1)',
            }}
          />
        </div>
      </div>

      {/* 矿石 + 总XP */}
      <div style={{ display: 'flex', gap: 16 }}>
        <MiniStat label={t.charCard_statOre} value={`⛏ ${character.ore}`} />
        <MiniStat label={t.charCard_statTotalXP} value={character.totalXP} />
        <MiniStat label={t.charCard_statStreak} value={`🔥${character.streakDays}${t.dash_unitDays}`} />
      </div>
    </div>
  )
}

function MiniStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <div style={{ fontSize: 10, color: 'var(--color-text-dim)' }}>{label}</div>
      <div style={{ fontSize: 12, fontFamily: 'var(--font-num)', fontWeight: 600, color: 'var(--color-text)' }}>
        {value}
      </div>
    </div>
  )
}
