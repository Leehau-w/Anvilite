import React, { createContext, useContext, useState, useCallback, useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { LevelUpCelebration } from './LevelUpCelebration'
import { StreakMilestonePopup } from './StreakMilestonePopup'
import { PrestigeModal } from './PrestigeModal'
import { BadgeNotificationLayer } from './BadgeNotification'
import type { StreakMilestone } from './StreakMilestonePopup'
import { useTaskStore } from '@/stores/taskStore'
import { useHabitStore } from '@/stores/habitStore'
import { useCharacterStore } from '@/stores/characterStore'
import { useAreaStore } from '@/stores/areaStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { useBadgeStore } from '@/stores/badgeStore'
import { checkNewBadges } from '@/engines/badgeEngine'

const STREAK_THRESHOLDS: StreakMilestone[] = [3, 7, 14, 30]

function crossedMilestone(oldDays: number, newDays: number): StreakMilestone | null {
  // 从高到低找，只触发最高跨越的那个
  for (let i = STREAK_THRESHOLDS.length - 1; i >= 0; i--) {
    const t = STREAK_THRESHOLDS[i]
    if (oldDays < t && newDays >= t) return t
  }
  return null
}

interface FeedbackPayload {
  xp: number
  ore: number
  leveledUp: boolean
  oldLevel: number
  newLevel: number
  oldStreakDays?: number
  newStreakDays?: number
  prestigeUnlocked?: boolean
}

interface FeedbackContextValue {
  triggerFeedback: (payload: FeedbackPayload) => void
  showPrestigeModal: () => void
}

const FeedbackContext = createContext<FeedbackContextValue>({
  triggerFeedback: () => {},
  showPrestigeModal: () => {},
})

export function useFeedback() {
  return useContext(FeedbackContext)
}

interface XPFloatItem {
  id: number
  xp: number
  ore: number
}

let _id = 0

export function FeedbackProvider({ children }: { children: React.ReactNode }) {
  const [floats, setFloats] = useState<XPFloatItem[]>([])
  const [levelUp, setLevelUp] = useState<{ visible: boolean; oldLevel: number; newLevel: number }>({
    visible: false, oldLevel: 1, newLevel: 1,
  })
  const [streakMilestone, setStreakMilestone] = useState<StreakMilestone | null>(null)
  const [prestigeVisible, setPrestigeVisible] = useState(false)

  const showPrestigeModal = useCallback(() => setPrestigeVisible(true), [])

  const triggerFeedback = useCallback((payload: FeedbackPayload) => {
    const id = ++_id
    setFloats((prev) => [...prev, { id, xp: payload.xp, ore: payload.ore }])
    setTimeout(() => {
      setFloats((prev) => prev.filter((f) => f.id !== id))
    }, 1100)

    if (payload.leveledUp) {
      setTimeout(() => {
        setLevelUp({ visible: true, oldLevel: payload.oldLevel, newLevel: payload.newLevel })
      }, 1200)
    }

    // 连击阶梯跃升：飘字后 1200ms 触发，与升级庆祝不冲突
    if (!payload.leveledUp && payload.oldStreakDays !== undefined && payload.newStreakDays !== undefined) {
      const milestone = crossedMilestone(payload.oldStreakDays, payload.newStreakDays)
      if (milestone) {
        setTimeout(() => setStreakMilestone(milestone), 1200)
      }
    }

    // 淬火重铸解锁：升级庆祝结束后弹出（约 4500ms）
    if (payload.prestigeUnlocked) {
      setTimeout(() => setPrestigeVisible(true), 4500)
    }
  }, [])

  return (
    <FeedbackContext.Provider value={{ triggerFeedback, showPrestigeModal }}>
      {children}

      {/* XP/矿石飘字层 */}
      <div
        style={{
          position: 'fixed',
          bottom: 80,
          left: '50%',
          transform: 'translateX(-50%)',
          pointerEvents: 'none',
          zIndex: 1000,
          display: 'flex',
          flexDirection: 'column-reverse',
          gap: 8,
        }}
      >
        <AnimatePresence>
          {floats.map((f) => (
            <XPFloatItem key={f.id} xp={f.xp} ore={f.ore} />
          ))}
        </AnimatePresence>
      </div>

      {/* 升级庆祝 */}
      <LevelUpCelebration
        visible={levelUp.visible}
        oldLevel={levelUp.oldLevel}
        newLevel={levelUp.newLevel}
        onDismiss={() => setLevelUp((s) => ({ ...s, visible: false }))}
      />

      {/* 连击阶梯跃升 */}
      <StreakMilestonePopup
        milestone={streakMilestone}
        onDismiss={() => setStreakMilestone(null)}
      />

      {/* 淬火重铸 */}
      <PrestigeModal
        visible={prestigeVisible}
        onDismiss={() => setPrestigeVisible(false)}
      />

      {/* 徽章通知层 */}
      <BadgeNotificationLayer />

      {/* 徽章自动检测 */}
      <BadgeChecker />
    </FeedbackContext.Provider>
  )
}

function XPFloatItem({ xp, ore }: { xp: number; ore: number }) {
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
      <motion.span
        initial={{ opacity: 0, y: 0, scale: 0.8 }}
        animate={{ opacity: [0, 1, 1, 0], y: [0, -20, -50, -60], scale: [0.8, 1.1, 1.0, 1.0] }}
        transition={{ duration: 0.8, times: [0, 0.25, 0.5, 1], ease: [0, 0, 0.2, 1] }}
        style={{
          fontFamily: 'var(--font-num)',
          fontWeight: 600,
          fontSize: 16,
          color: 'var(--color-xp)',
          letterSpacing: '0.02em',
          whiteSpace: 'nowrap',
          textShadow: '0 1px 4px rgba(0,0,0,0.2)',
        }}
      >
        +{xp} XP
      </motion.span>

      <motion.span
        initial={{ opacity: 0, y: 0, scale: 0.8 }}
        animate={{ opacity: [0, 1, 1, 0], y: [0, -15, -40, -50], scale: [0.8, 1.05, 1.0, 1.0] }}
        transition={{ duration: 0.8, delay: 0.1, times: [0, 0.25, 0.5, 1], ease: [0, 0, 0.2, 1] }}
        style={{
          fontFamily: 'var(--font-num)',
          fontWeight: 600,
          fontSize: 14,
          color: 'var(--color-secondary)',
          letterSpacing: '0.02em',
          whiteSpace: 'nowrap',
          textShadow: '0 1px 4px rgba(0,0,0,0.2)',
        }}
      >
        +{ore} ⛏
      </motion.span>
    </div>
  )
}

/**
 * 自动徽章检测器：监听关键状态变化，调用 badgeEngine 检测并授予新徽章。
 * 渲染为 null，只用于副作用。
 */
function BadgeChecker() {
  const tasks = useTaskStore((s) => s.tasks)
  const habits = useHabitStore((s) => s.habits)
  const character = useCharacterStore((s) => s.character)
  const areas = useAreaStore((s) => s.areas)
  const settings = useSettingsStore((s) => s.settings)
  const { earnedIds, earn } = useBadgeStore()

  const unlockedThemeCount = settings.unlockedThemes?.length ?? 1

  useEffect(() => {
    const earned = new Set(Object.keys(earnedIds))
    const newIds = checkNewBadges({
      tasks,
      habits,
      areas,
      level: character.level,
      streakDays: character.streakDays,
      unlockedThemeCount,
      prestigeLevel: character.prestigeLevel ?? 0,
      earnedIds: earned,
    })
    if (newIds.length > 0) earn(newIds)
  }, [
    tasks,
    habits,
    areas,
    character.level,
    character.streakDays,
    character.prestigeLevel,
    unlockedThemeCount,
  ])

  return null
}
