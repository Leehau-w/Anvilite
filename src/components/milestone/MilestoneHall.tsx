import React, { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useCharacterStore } from '@/stores/characterStore'
import { useGrowthEventStore } from '@/stores/growthEventStore'
import type { GrowthEvent } from '@/types/growthEvent'
import { useTaskStore } from '@/stores/taskStore'
import { useHabitStore } from '@/stores/habitStore'
import { useAreaStore } from '@/stores/areaStore'
import { useBadgeStore } from '@/stores/badgeStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { xpToNextLevel, getXPProgress } from '@/engines/levelEngine'
import { getAreaSkillXP, skillXPToLevel } from '@/engines/prosperityEngine'
import { PrestigeModal } from '@/components/feedback/PrestigeModal'
import { SkillRadarChart, type SkillDimension } from './SkillRadarChart'
import { useT } from '@/i18n'
import { getAreaDisplayName } from '@/utils/area'
import {
  STATIC_BADGE_DEFS,
  BADGE_CATEGORY_ORDER,
  makeAreaBadgeDef,
  makeAreaBadgeId,
  type BadgeCategory,
  type BadgeDef,
} from '@/types/badge'

// ─── 称号系统 ─────────────────────────────────────────────────────────────────

const TITLE_THRESHOLDS = [1, 6, 11, 16, 21, 31, 41, 51]

function getTitleIndex(level: number): number {
  for (let i = TITLE_THRESHOLDS.length - 1; i >= 0; i--) {
    if (level >= TITLE_THRESHOLDS[i]) return i
  }
  return 0
}

// ─── 主组件 ───────────────────────────────────────────────────────────────────

const GLOBAL_STATUS_CYCLE = ['active', 'charging', 'resting', 'traveling', 'returning'] as const
const STATUS_ICONS: Record<string, { icon: string; key: string }> = {
  active:    { icon: '⚡', key: 'charCard_status_active' },
  charging:  { icon: '🔋', key: 'charCard_status_charging' },
  resting:   { icon: '💤', key: 'charCard_status_resting' },
  traveling: { icon: '🌄', key: 'charCard_status_traveling' },
  returning: { icon: '🌅', key: 'charCard_status_returning' },
}
const CATEGORY_STATUS: Record<string, { icon: string; key: string }> = {
  library:  { icon: '📚', key: 'charCard_catStatus_library' },
  forge:    { icon: '💼', key: 'charCard_catStatus_forge' },
  arena:    { icon: '🏃', key: 'charCard_catStatus_arena' },
  workshop: { icon: '✨', key: 'charCard_catStatus_workshop' },
  home:     { icon: '🏠', key: 'charCard_catStatus_home' },
}

export function MilestoneHall() {
  const { character, setTitlePreset, setGlobalStatus } = useCharacterStore()
  const { events, markMilestone, updateEventDetails } = useGrowthEventStore()
  const { tasks } = useTaskStore()
  const { habits } = useHabitStore()
  const { areas } = useAreaStore()
  const { earnedIds, earnedCount } = useBadgeStore()
  const t = useT()
  const lang = useSettingsStore((s) => s.settings.language)
  const [createModal, setCreateModal] = useState(false)
  const [editingMilestone, setEditingMilestone] = useState<GrowthEvent | null>(null)
  const [prestigeModalOpen, setPrestigeModalOpen] = useState(false)
  const canPrestige = character.level >= 51
  const prestigeLevel = character.prestigeLevel ?? 0

  const currentTitleIdx = getTitleIndex(character.level)
  const titles = character.titlePreset === 'rpg' ? t.titles_rpg : t.titles_forge
  const translatedTitle = character.titlePreset === 'rpg'
    ? t.titles_rpg[currentTitleIdx]
    : (character.titlePreset === 'custom' && character.customTitles?.[currentTitleIdx])
      ? character.customTitles[currentTitleIdx]
      : t.titles_forge[currentTitleIdx]

  const milestones = useMemo(
    () => events.filter((e) => e.isMilestone || e.type === 'milestone' || e.type === 'custom_milestone'),
    [events]
  )

  // 角色状态（与仪表盘 CharacterMiniCard 逻辑一致）
  const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 } as const
  const topDoing = tasks.filter((tk) => tk.status === 'doing' && !tk.deletedAt)
    .sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority])[0]
  const topDoingHabit = !topDoing ? habits.find((h) => !h.deletedAt && h.timerStartedAt !== null) : undefined
  const topActive = topDoing ?? topDoingHabit ?? null
  const statusEntry = STATUS_ICONS[character.globalStatus] ?? STATUS_ICONS.active
  const catEntry = topActive ? (CATEGORY_STATUS[topActive.category] ?? null) : null
  const statusIcon = topActive ? (catEntry?.icon ?? '📌') : statusEntry.icon
  const statusLabel = topActive
    ? (catEntry ? (t[catEntry.key as keyof typeof t] as string) : t.charCard_busy)
    : (t[statusEntry.key as keyof typeof t] as string)

  function cycleStatus() {
    if (topActive) return
    const idx = GLOBAL_STATUS_CYCLE.indexOf(character.globalStatus as typeof GLOBAL_STATUS_CYCLE[number])
    setGlobalStatus(GLOBAL_STATUS_CYCLE[(idx + 1) % GLOBAL_STATUS_CYCLE.length])
  }

  // 统计
  const totalTasks = tasks.filter((t) => t.status === 'done').length
  const totalMinutes = tasks.reduce((sum, t) => sum + t.actualMinutes, 0)
  const totalHours = Math.floor(totalMinutes / 60)
  const maxStreak = character.streakDays
  const longestHabit = Math.max(...habits.map((h) => h.consecutiveCount), 0)
  const usageDays = character.createdAt
    ? Math.floor((Date.now() - new Date(character.createdAt).getTime()) / 86400000)
    : 0

  // 徽章墙数据：静态 + 动态区域徽章
  const allBadgeDefs = useMemo<BadgeDef[]>(() => {
    const areaBadges: BadgeDef[] = []
    for (const area of areas) {
      if (area.category === '_milestone') continue
      const areaDisplay = getAreaDisplayName(area, t)
      for (let lvl = 2; lvl <= 6; lvl++) {
        const base = makeAreaBadgeDef(area.category, lvl)
        const prosName = (t[`badge_prosperity_name_${lvl}` as keyof typeof t] as string) ?? base.name
        const prosDesc = (t[`badge_prosperity_desc_${lvl}` as keyof typeof t] as string) ?? base.description
        areaBadges.push({
          ...base,
          name: `${areaDisplay}·${prosName}`,
          description: `「${areaDisplay}」${prosDesc}`,
        })
      }
    }
    return [...STATIC_BADGE_DEFS, ...areaBadges]
  }, [areas, t])

  const badgesByCategory = useMemo(() => {
    const map = new Map<BadgeCategory, BadgeDef[]>()
    for (const cat of BADGE_CATEGORY_ORDER) map.set(cat, [])
    for (const def of allBadgeDefs) {
      map.get(def.category)?.push(def)
    }
    return map
  }, [allBadgeDefs])

  // 能力维度：每个区域（跳过 _milestone）的技能等级
  const skillDimensions = useMemo<SkillDimension[]>(() => {
    return areas
      .filter((a) => a.category !== '_milestone')
      .map((a) => {
        const displayName = getAreaDisplayName(a, t)
        return {
          name: displayName,
          value: skillXPToLevel(getAreaSkillXP(tasks, a.category)),
          emoji: a.emoji,
        }
      })
  }, [areas, tasks, t])

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--color-bg)', overflow: 'hidden' }}>
      {/* 顶部标题 */}
      <div
        style={{
          padding: '16px 24px 12px',
          borderBottom: '1px solid var(--color-border)',
          background: 'var(--color-surface)',
          flexShrink: 0,
        }}
      >
        <h1 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: 'var(--color-text)' }}>
          {t.milestone_pageTitle}
        </h1>
      </div>

      {/* 三栏内容 */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          gap: 16,
          padding: 24,
          overflow: 'hidden',
        }}
      >
        {/* 左栏：角色 */}
        <div style={{ width: 280, paddingLeft: 4, display: 'flex', flexDirection: 'column', gap: 12, overflow: 'auto' }}>
          {/* 角色头像区 */}
          <div
            style={{
              background: 'var(--color-surface)',
              borderRadius: 'var(--radius-xl)',
              border: '1px solid var(--color-border)',
              padding: 20,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 12,
            }}
          >
            {/* 头像占位 */}
            <div
              style={{
                width: 80,
                height: 80,
                borderRadius: '50%',
                background: 'color-mix(in srgb, var(--color-accent) 15%, var(--color-surface-hover))',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 36,
              }}
            >
              ⚔️
            </div>

            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--color-text)' }}>
                {character.name}
              </div>
              <div style={{ fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                {prestigeLevel > 0 && (
                  <span style={{ fontSize: 10 }}>{'🌟'.repeat(Math.min(prestigeLevel, 5))}</span>
                )}
                <span style={{ color: 'var(--color-accent)' }}>Lv.{character.level}</span>
                <span style={{ color: 'var(--color-text-dim)' }}>·</span>
                <span
                  className={prestigeLevel > 0 ? 'prestige-title' : ''}
                  style={prestigeLevel === 0 ? { color: 'var(--color-accent)' } : {}}
                >
                  {translatedTitle}
                </span>
              </div>
            </div>

            {/* 角色状态 */}
            <div
              onClick={cycleStatus}
              title={!topActive ? t.charCard_clickToChangeStatus : undefined}
              style={{
                display: 'flex', alignItems: 'center', gap: 8, width: '100%',
                padding: '8px 12px', borderRadius: 'var(--radius-md)',
                border: '1px solid var(--color-border)',
                background: topActive ? 'color-mix(in srgb, var(--color-accent) 5%, var(--color-bg))' : 'var(--color-bg)',
                cursor: topActive ? 'default' : 'pointer',
                transition: 'background 0.15s',
                userSelect: 'none',
              }}
            >
              <span style={{ fontSize: 18 }}>{statusIcon}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)' }}>{statusLabel}</span>
                {topActive && (
                  <span style={{ fontSize: 10, fontWeight: 500, color: 'var(--color-accent)', background: 'color-mix(in srgb, var(--color-accent) 12%, transparent)', border: '1px solid color-mix(in srgb, var(--color-accent) 30%, transparent)', borderRadius: 'var(--radius-sm)', padding: '1px 5px', lineHeight: 1.4 }}>
                    {t.charCard_statusAutoLabel}
                  </span>
                )}
              </div>
              {!topActive && (
                <span style={{ fontSize: 10, color: 'var(--color-text-dim)', opacity: 0.6 }}>↻</span>
              )}
            </div>

            {/* 经验条 */}
            <div style={{ width: '100%' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: 10, color: 'var(--color-text-dim)' }}>{t.milestone_xpLabel}</span>
                <span style={{ fontSize: 10, fontFamily: 'var(--font-num)', color: 'var(--color-text-dim)' }}>
                  {character.currentXP}/{xpToNextLevel(character.level)}
                </span>
              </div>
              <div style={{ height: 6, background: 'var(--color-border)', borderRadius: 'var(--radius-full)', overflow: 'hidden' }}>
                <div
                  style={{
                    height: '100%',
                    width: `${getXPProgress(character.currentXP, character.level) * 100}%`,
                    background: 'var(--color-accent)',
                    borderRadius: 'var(--radius-full)',
                  }}
                />
              </div>
            </div>

            {/* 属性 */}
            <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 6 }}>
              <AttrRow label={t.milestone_attrTotalXP} value={character.totalXP} />
              <AttrRow label={t.milestone_attrOre} value={`⛏ ${character.ore}`} />
              <AttrRow label={t.milestone_attrStreak} value={`🔥 ${character.streakDays}${t.dash_unitDays}`} />
              {prestigeLevel > 0 && (
                <AttrRow label={t.milestone_attrPrestige} value={`${'🌟'.repeat(Math.min(prestigeLevel, 5))} ×${prestigeLevel}`} />
              )}
            </div>
          </div>

          {/* 能力雷达图 */}
          <div
            style={{
              background: 'var(--color-surface)',
              borderRadius: 'var(--radius-xl)',
              border: '1px solid var(--color-border)',
              padding: 16,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <div style={{ width: '100%', fontSize: 12, fontWeight: 600, color: 'var(--color-text-dim)', letterSpacing: '0.04em' }}>
              {t.milestone_abilityChart}
            </div>
            <SkillRadarChart dimensions={skillDimensions} size={208} />
          </div>

          {/* 称号展示柜 */}
          <div
            style={{
              background: 'var(--color-surface)',
              borderRadius: 'var(--radius-xl)',
              border: '1px solid var(--color-border)',
              padding: 16,
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-dim)', marginBottom: 10, letterSpacing: '0.04em' }}>
              {t.milestone_sectionTitles}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {titles.map((t, i) => {
                const isUnlocked = i <= currentTitleIdx
                const isCurrent = i === currentTitleIdx
                return (
                  <div
                    key={t}
                    style={{
                      padding: '5px 10px',
                      borderRadius: 'var(--radius-md)',
                      fontSize: 12,
                      fontWeight: isCurrent ? 700 : 400,
                      color: isCurrent ? 'var(--color-accent)' : isUnlocked ? 'var(--color-text)' : 'var(--color-text-dim)',
                      background: isCurrent ? 'color-mix(in srgb, var(--color-accent) 10%, transparent)' : 'transparent',
                      opacity: isUnlocked ? 1 : 0.4,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                    }}
                  >
                    <span>{isUnlocked ? '🔓' : '🔒'}</span>
                    <span>{t}</span>
                    <span style={{ fontSize: 10, color: 'var(--color-text-dim)', marginLeft: 'auto' }}>
                      Lv.{TITLE_THRESHOLDS[i]}+
                    </span>
                  </div>
                )
              })}
            </div>

            {/* 切换称号预设 */}
            <div style={{ marginTop: 12, display: 'flex', gap: 6 }}>
              <button
                onClick={() => setTitlePreset('forge')}
                style={{
                  flex: 1, fontSize: 11, padding: '4px',
                  borderRadius: 'var(--radius-sm)',
                  border: `1px solid ${character.titlePreset === 'forge' ? 'var(--color-accent)' : 'var(--color-border)'}`,
                  background: character.titlePreset === 'forge' ? 'color-mix(in srgb, var(--color-accent) 10%, transparent)' : 'transparent',
                  color: character.titlePreset === 'forge' ? 'var(--color-accent)' : 'var(--color-text-dim)',
                  cursor: 'pointer',
                }}
              >
                {t.milestone_presetForge}
              </button>
              <button
                onClick={() => setTitlePreset('rpg')}
                style={{
                  flex: 1, fontSize: 11, padding: '4px',
                  borderRadius: 'var(--radius-sm)',
                  border: `1px solid ${character.titlePreset === 'rpg' ? 'var(--color-accent)' : 'var(--color-border)'}`,
                  background: character.titlePreset === 'rpg' ? 'color-mix(in srgb, var(--color-accent) 10%, transparent)' : 'transparent',
                  color: character.titlePreset === 'rpg' ? 'var(--color-accent)' : 'var(--color-text-dim)',
                  cursor: 'pointer',
                }}
              >
                {t.milestone_presetRPG}
              </button>
            </div>
          </div>

          {/* 淬火重铸入口 */}
          {canPrestige && (
            <button
              onClick={() => setPrestigeModalOpen(true)}
              style={{
                width: '100%',
                padding: '10px 0',
                borderRadius: 'var(--radius-lg)',
                border: '1.5px solid var(--color-accent)',
                background: 'color-mix(in srgb, var(--color-accent) 8%, transparent)',
                color: 'var(--color-accent)',
                fontSize: 13,
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'color-mix(in srgb, var(--color-accent) 15%, transparent)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'color-mix(in srgb, var(--color-accent) 8%, transparent)'
              }}
            >
              {prestigeLevel > 0 ? t.milestone_prestigeAgain('🌟'.repeat(Math.min(prestigeLevel, 3))) : t.milestone_prestige}
            </button>
          )}
        </div>

        {/* 中栏：碑石 */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12, overflow: 'hidden' }}>
          {/* 标题 + 创建 */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: 'var(--color-text)' }}>{t.milestone_header}</h2>
            <button
              onClick={() => setCreateModal(true)}
              style={{
                height: 30,
                padding: '0 14px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--color-border)',
                background: 'transparent',
                color: 'var(--color-text-dim)',
                cursor: 'pointer',
                fontSize: 12,
                display: 'flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              {t.milestone_engrave}
            </button>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {milestones.length === 0 ? (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  height: 160,
                  color: 'var(--color-text-dim)',
                  fontSize: 13,
                  gap: 8,
                }}
              >
                <span style={{ fontSize: 32 }}>🪨</span>
                <span>{t.milestone_empty1}</span>
                <span style={{ fontSize: 11 }}>{t.milestone_empty2}</span>
              </div>
            ) : (
              milestones.map((e) => (
                <div
                  key={e.id}
                  onClick={() => setEditingMilestone(e)}
                  style={{
                    background: 'color-mix(in srgb, var(--color-accent) 8%, var(--color-surface))',
                    border: '1px solid color-mix(in srgb, var(--color-accent) 25%, transparent)',
                    borderRadius: 'var(--radius-lg)',
                    padding: '14px 16px',
                    cursor: 'pointer',
                    transition: 'box-shadow 0.15s',
                  }}
                  onMouseEnter={(el) => { el.currentTarget.style.boxShadow = '0 2px 12px color-mix(in srgb, var(--color-accent) 15%, transparent)' }}
                  onMouseLeave={(el) => { el.currentTarget.style.boxShadow = 'none' }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                    <span style={{ fontSize: 18 }}>⭐</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-accent)', marginBottom: 2 }}>
                        {e.title.replace(/^.+[：:]\s*/, '')}
                      </div>
                      {/* 习惯坚持时长 */}
                      {e.details.sourceType === 'habit' && e.details.durationDays != null && (
                        <div style={{ fontSize: 11, color: 'var(--color-xp)', marginBottom: 4, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          <span>{t.habit_durationLabel(e.details.durationDays)}</span>
                          {e.details.consecutiveCount != null && e.details.consecutiveCount > 0 && <span>🔥{e.details.consecutiveCount}</span>}
                          {e.details.totalCompletions != null && <span>×{e.details.totalCompletions}</span>}
                        </div>
                      )}
                      {/* 任务数据 */}
                      {e.details.sourceType === 'task' && (
                        <div style={{ fontSize: 11, color: 'var(--color-success)', marginBottom: 4, display: 'flex', gap: 8 }}>
                          {e.details.xpGained != null && <span>+{e.details.xpGained} XP</span>}
                          {e.details.actualMinutes != null && e.details.actualMinutes > 0 && <span>⏱{e.details.actualMinutes}m</span>}
                        </div>
                      )}
                      {e.details.description && (
                        <div style={{ fontSize: 12, color: 'var(--color-text)', fontStyle: 'italic', marginBottom: 4 }}>
                          "{e.details.description}"
                        </div>
                      )}
                      <div style={{ fontSize: 10, color: 'var(--color-text-dim)' }}>
                        {new Date(e.timestamp).toLocaleDateString(lang === 'zh' ? 'zh-CN' : 'en-US', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* 右栏：统计 + 徽章墙 */}
        <div style={{ width: 260, display: 'flex', flexDirection: 'column', gap: 12, overflow: 'auto' }}>
          {/* 成长总览 */}
          <div
            style={{
              background: 'var(--color-surface)',
              borderRadius: 'var(--radius-xl)',
              border: '1px solid var(--color-border)',
              padding: 16,
              flexShrink: 0,
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-dim)', marginBottom: 12, letterSpacing: '0.04em' }}>
              {t.milestone_statHeader}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <StatBox label={t.milestone_statTasksDone} value={totalTasks} unit={t.milestone_unitTasks} />
              <StatBox label={t.milestone_statHours} value={totalHours} unit={t.milestone_unitHours} />
              <StatBox label={t.milestone_statTotalXP} value={character.totalXP} />
              <StatBox label={t.milestone_statOre} value={character.ore} />
              <StatBox label={t.milestone_statDays} value={usageDays} unit={t.milestone_unitDays} />
              <StatBox label={t.milestone_statStreak} value={maxStreak} unit={t.milestone_unitDays} />
              <StatBox label={t.milestone_statHabit} value={longestHabit} unit={t.milestone_unitTimes} />
              <StatBox label={t.milestone_statBadges} value={earnedCount()} unit={t.milestone_unitBadges} />
            </div>
          </div>

          {/* 成就徽章墙 */}
          <div
            style={{
              background: 'var(--color-surface)',
              borderRadius: 'var(--radius-xl)',
              border: '1px solid var(--color-border)',
              padding: 16,
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-dim)', marginBottom: 12, letterSpacing: '0.04em' }}>
              {t.milestone_badgeHeader}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {BADGE_CATEGORY_ORDER.map((cat) => {
                const defs = badgesByCategory.get(cat) ?? []
                if (defs.length === 0) return null
                const earnedInCat = defs.filter((d) => earnedIds[d.id]).length
                return (
                  <div key={cat}>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        marginBottom: 8,
                      }}
                    >
                      <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text)', letterSpacing: '0.03em' }}>
                        {(t[`badge_cat_${cat}` as keyof typeof t] as string) ?? cat}
                      </span>
                      <span
                        style={{
                          fontSize: 10,
                          color: earnedInCat === defs.length ? 'var(--color-success)' : 'var(--color-text-dim)',
                          background: 'var(--color-surface-hover)',
                          padding: '1px 6px',
                          borderRadius: 'var(--radius-full)',
                          fontFamily: 'var(--font-num)',
                        }}
                      >
                        {earnedInCat}/{defs.length}
                      </span>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {defs.map((def) => {
                        const earned = !!earnedIds[def.id]
                        return (
                          <BadgeTile
                            key={def.id}
                            def={def}
                            earned={earned}
                            earnedAt={earnedIds[def.id] ?? null}
                          />
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>

      {/* 刻碑 Modal */}
      <CreateMilestoneModal
        open={createModal}
        onClose={() => setCreateModal(false)}
        onCreate={(title, desc) => {
          markMilestone('', desc) // 将通过 addEvent 创建
          const { addEvent } = useGrowthEventStore.getState()
          addEvent({
            type: 'custom_milestone',
            title: t.milestone_eventTitle(title),
            details: { description: desc },
            isMilestone: true,
          })
          setCreateModal(false)
        }}
      />

      {/* 编辑里程碑 Modal */}
      <EditMilestoneModal
        event={editingMilestone}
        onClose={() => setEditingMilestone(null)}
        onSave={(desc) => {
          if (editingMilestone) {
            updateEventDetails(editingMilestone.id, { description: desc })
            setEditingMilestone(null)
          }
        }}
        onDelete={() => {
          if (editingMilestone) {
            const { removeEvent } = useGrowthEventStore.getState()
            removeEvent(editingMilestone.id)
            setEditingMilestone(null)
          }
        }}
      />

      {/* 淬火重铸 Modal */}
      <PrestigeModal
        visible={prestigeModalOpen}
        onDismiss={() => setPrestigeModalOpen(false)}
      />
    </div>
  )
}

// ─── 子组件 ───────────────────────────────────────────────────────────────────

function AttrRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
      <span style={{ color: 'var(--color-text-dim)' }}>{label}</span>
      <span style={{ fontFamily: 'var(--font-num)', fontWeight: 600, color: 'var(--color-text)' }}>{value}</span>
    </div>
  )
}

function StatBox({ label, value, unit }: { label: string; value: number; unit?: string }) {
  return (
    <div
      style={{
        background: 'var(--color-surface-hover)',
        borderRadius: 'var(--radius-md)',
        padding: '8px 10px',
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
      }}
    >
      <div style={{ fontSize: 18, fontWeight: 800, fontFamily: 'var(--font-num)', color: 'var(--color-text)', lineHeight: 1 }}>
        {value}
        {unit && <span style={{ fontSize: 10, fontWeight: 400, marginLeft: 2 }}>{unit}</span>}
      </div>
      <div style={{ fontSize: 10, color: 'var(--color-text-dim)' }}>{label}</div>
    </div>
  )
}

function BadgeTile({
  def,
  earned,
  earnedAt,
}: {
  def: BadgeDef
  earned: boolean
  earnedAt: string | null
}) {
  const [showTooltip, setShowTooltip] = useState(false)
  const t = useT()
  const lang = useSettingsStore((s) => s.settings.language)
  const dateStr = earnedAt
    ? new Date(earnedAt).toLocaleDateString(lang === 'zh' ? 'zh-CN' : 'en-US', { month: 'short', day: 'numeric' })
    : null

  return (
    <div
      style={{ position: 'relative', display: 'inline-block' }}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <motion.div
        animate={earned ? { scale: [1, 1.05, 1] } : {}}
        transition={{ duration: 0.3 }}
        style={{
          width: 40,
          height: 40,
          borderRadius: 'var(--radius-md)',
          border: `1px solid ${earned ? 'color-mix(in srgb, var(--color-accent) 40%, transparent)' : 'var(--color-border)'}`,
          background: earned
            ? 'color-mix(in srgb, var(--color-accent) 8%, var(--color-surface-hover))'
            : 'var(--color-surface-hover)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 20,
          cursor: 'default',
          filter: earned ? 'none' : 'grayscale(1) opacity(0.35)',
          transition: 'all 0.2s',
          boxShadow: earned ? '0 1px 4px color-mix(in srgb, var(--color-accent) 20%, transparent)' : 'none',
        }}
      >
        {def.icon}
      </motion.div>

      {/* 悬浮提示 */}
      <AnimatePresence>
        {showTooltip && (
          <motion.div
            initial={{ opacity: 0, y: 4, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            style={{
              position: 'absolute',
              bottom: '110%',
              left: '50%',
              transform: 'translateX(-50%)',
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-md)',
              padding: '8px 10px',
              width: 160,
              zIndex: 100,
              boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
              pointerEvents: 'none',
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text)', marginBottom: 2 }}>
              {(t[`badge_name_${def.id}` as keyof typeof t] as string) ?? def.name}
            </div>
            <div style={{ fontSize: 11, color: 'var(--color-text-dim)', lineHeight: 1.4 }}>
              {(t[`badge_desc_${def.id}` as keyof typeof t] as string) ?? def.description}
            </div>
            {earned && dateStr && (
              <div style={{ fontSize: 10, color: 'var(--color-accent)', marginTop: 4 }}>
                {t.milestone_badgeEarned(dateStr)}
              </div>
            )}
            {!earned && (
              <div style={{ fontSize: 10, color: 'var(--color-text-dim)', marginTop: 4, opacity: 0.7 }}>
                {t.milestone_badgeLocked}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function CreateMilestoneModal({
  open,
  onClose,
  onCreate,
}: {
  open: boolean
  onClose: () => void
  onCreate: (title: string, desc: string) => void
}) {
  const [title, setTitle] = useState('')
  const [desc, setDesc] = useState('')
  const t = useT()

  function handleCreate() {
    if (!title.trim()) return
    onCreate(title.trim(), desc.trim())
    setTitle('')
    setDesc('')
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', zIndex: 500 }}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            style={{
              position: 'fixed',
              left: '50%',
              top: '50%',
              transform: 'translate(-50%, -50%)',
              width: 340,
              background: 'var(--color-surface)',
              borderRadius: 'var(--radius-xl)',
              border: '1px solid var(--color-border)',
              padding: 24,
              zIndex: 501,
              boxShadow: 'var(--shadow-lg)',
            }}
          >
            <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>{t.milestone_createTitle}</h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ fontSize: 12, color: 'var(--color-text-dim)', display: 'block', marginBottom: 4 }}>
                  {t.milestone_createLabel}
                </label>
                <input
                  autoFocus
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={t.milestone_createPlaceholder}
                  style={{
                    width: '100%', height: 36, padding: '0 12px',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--color-border)',
                    background: 'var(--color-bg)', color: 'var(--color-text)',
                    fontSize: 14, outline: 'none', boxSizing: 'border-box',
                  }}
                  onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                />
              </div>

              <div>
                <label style={{ fontSize: 12, color: 'var(--color-text-dim)', display: 'block', marginBottom: 4 }}>
                  {t.milestone_createNotesLabel}
                </label>
                <textarea
                  value={desc}
                  onChange={(e) => setDesc(e.target.value)}
                  placeholder={t.milestone_createNotesPlaceholder}
                  rows={3}
                  style={{
                    width: '100%', padding: '8px 12px',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--color-border)',
                    background: 'var(--color-bg)', color: 'var(--color-text)',
                    fontSize: 13, resize: 'none', outline: 'none',
                    fontFamily: 'var(--font-zh)', boxSizing: 'border-box',
                  }}
                />
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={onClose}
                  style={{
                    flex: 1, height: 36, borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--color-border)', background: 'transparent',
                    color: 'var(--color-text-dim)', cursor: 'pointer', fontSize: 13,
                  }}
                >
                  {t.milestone_createCancel}
                </button>
                <button
                  onClick={handleCreate}
                  disabled={!title.trim()}
                  style={{
                    flex: 2, height: 36, borderRadius: 'var(--radius-md)',
                    border: 'none',
                    background: title.trim() ? 'var(--color-accent)' : 'var(--color-border)',
                    color: title.trim() ? 'white' : 'var(--color-text-dim)',
                    cursor: title.trim() ? 'pointer' : 'not-allowed',
                    fontSize: 13, fontWeight: 600,
                  }}
                >
                  {t.milestone_createConfirm}
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

function EditMilestoneModal({
  event,
  onClose,
  onSave,
  onDelete,
}: {
  event: GrowthEvent | null
  onClose: () => void
  onSave: (description: string) => void
  onDelete: () => void
}) {
  const [desc, setDesc] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const t = useT()

  React.useEffect(() => {
    if (event) { setDesc(event.details.description ?? ''); setConfirmDelete(false) }
  }, [event])

  return (
    <AnimatePresence>
      {event && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', zIndex: 500 }}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            style={{
              position: 'fixed', left: '50%', top: '50%', transform: 'translate(-50%, -50%)',
              width: 340, background: 'var(--color-surface)', borderRadius: 'var(--radius-xl)',
              border: '1px solid var(--color-border)', padding: 24, zIndex: 501, boxShadow: 'var(--shadow-lg)',
            }}
          >
            <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>{t.milestone_editTitle}</h3>
            <div style={{ fontSize: 14, color: 'var(--color-accent)', fontWeight: 600, marginBottom: 12 }}>
              ⭐ {event.title.replace(/^.+[：:]\s*/, '')}
            </div>

            {event.details.sourceType === 'habit' && event.details.durationDays != null && (
              <div style={{ fontSize: 12, color: 'var(--color-text-dim)', marginBottom: 8, display: 'flex', gap: 8 }}>
                <span>{t.habit_durationLabel(event.details.durationDays)}</span>
                {event.details.consecutiveCount != null && <span>🔥{event.details.consecutiveCount}</span>}
                {event.details.totalCompletions != null && <span>×{event.details.totalCompletions}</span>}
              </div>
            )}

            {event.details.sourceType === 'task' && (
              <div style={{ fontSize: 12, color: 'var(--color-text-dim)', marginBottom: 8, display: 'flex', gap: 8 }}>
                {event.details.xpGained != null && <span>+{event.details.xpGained} XP</span>}
                {event.details.actualMinutes != null && event.details.actualMinutes > 0 && <span>⏱{event.details.actualMinutes}m</span>}
              </div>
            )}

            <textarea
              autoFocus
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              placeholder={t.milestone_createNotesPlaceholder}
              rows={3}
              style={{
                width: '100%', padding: '8px 12px', borderRadius: 'var(--radius-md)',
                border: '1px solid var(--color-border)', background: 'var(--color-bg)',
                color: 'var(--color-text)', fontSize: 13, resize: 'none', outline: 'none',
                fontFamily: 'var(--font-zh)', boxSizing: 'border-box',
              }}
            />
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button onClick={() => { if (confirmDelete) { onDelete() } else { setConfirmDelete(true); setTimeout(() => setConfirmDelete(false), 3000) } }}
                style={{
                  height: 36, borderRadius: 'var(--radius-md)', flexShrink: 0, cursor: 'pointer', fontSize: 12, fontWeight: confirmDelete ? 600 : 400,
                  padding: confirmDelete ? '0 12px' : '0',
                  width: confirmDelete ? 'auto' : 36,
                  border: `1px solid var(--color-danger)`,
                  background: confirmDelete ? 'var(--color-danger)' : 'transparent',
                  color: confirmDelete ? 'white' : 'var(--color-danger)',
                  transition: 'all 0.15s',
                }}
                title={t.habit_deletePerm}
              >{confirmDelete ? t.habit_deleteConfirm : '✕'}</button>
              <button onClick={onClose}
                style={{ flex: 1, height: 36, borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', background: 'transparent', color: 'var(--color-text-dim)', cursor: 'pointer', fontSize: 13 }}
              >{t.milestone_createCancel}</button>
              <button onClick={() => onSave(desc.trim())}
                style={{ flex: 2, height: 36, borderRadius: 'var(--radius-md)', border: 'none', background: 'var(--color-accent)', color: 'white', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}
              >{t.milestone_editSave}</button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
