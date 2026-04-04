import React, { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence, Reorder } from 'framer-motion'
import { useHabitStore } from '@/stores/habitStore'
import { useCharacterStore } from '@/stores/characterStore'
import { useGrowthEventStore } from '@/stores/growthEventStore'
import { useFeedback } from '@/components/feedback/FeedbackContext'
import { useToast } from '@/components/feedback/Toast'
import { getNextRefreshText } from '@/engines/habitEngine'
import { formatTimer, getElapsedSeconds } from '@/utils/time'
import type { Habit } from '@/types/habit'
import { useT } from '@/i18n'

export function HabitCard({ onEdit }: { onEdit?: (habit: Habit) => void }) {
  const { getTodayHabits, completeHabit, skipHabit, habits, startHabitTimer, pauseHabitTimer, reorderHabits } = useHabitStore()
  const { gainXPAndOre, recordActivity } = useCharacterStore()
  const { addEvent } = useGrowthEventStore()
  const { triggerFeedback } = useFeedback()
  const { showToast } = useToast()
  const t = useT()

  const todayHabits = getTodayHabits().sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
  const allActive = habits.filter((h) => h.status === 'active')

  const [localHabits, setLocalHabits] = useState<Habit[]>(todayHabits)
  const isDraggingRef = useRef(false)

  // sync from store when not dragging
  useEffect(() => {
    if (!isDraggingRef.current) setLocalHabits(todayHabits)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [habits])

  const handleReorder = useCallback((newOrder: Habit[]) => {
    isDraggingRef.current = true
    setLocalHabits(newOrder)
  }, [])

  const handleDragEnd = useCallback(() => {
    isDraggingRef.current = false
    reorderHabits(localHabits.map((h) => h.id))
  }, [localHabits, reorderHabits])

  function handleComplete(habit: Habit) {
    const result = completeHabit(habit.id)
    if (!result) return

    if (result.partial) {
      const current = (habit.currentCycleCount ?? 0) + 1
      const target = habit.targetCount ?? 1
      showToast(`${habit.title} ${current}/${target} ✓`)
      return
    }

    const { leveledUp, oldLevel, newLevel, prestigeUnlocked } = gainXPAndOre(result.xp, result.ore)
    const { oldStreak, newStreak } = recordActivity()

    addEvent({
      type: 'habit_complete',
      title: t.habitCard_eventTitle(habit.title),
      details: {
        xpGained: result.xp,
        oreGained: result.ore,
        consecutiveCount: result.newStreak,
        categoryName: habit.category,
      },
      isMilestone: false,
    })

    triggerFeedback({ xp: result.xp, ore: result.ore, leveledUp, oldLevel, newLevel, oldStreakDays: oldStreak, newStreakDays: newStreak, prestigeUnlocked })
    showToast(t.habitCard_toastComplete(habit.title, result.newStreak))
  }

  function handleSkip(habit: Habit) {
    const result = skipHabit(habit.id)
    if (!result) return

    addEvent({
      type: 'habit_skip',
      title: t.habitCard_eventSkip(habit.title),
      details: { consecutiveCount: result.newStreak, categoryName: habit.category },
      isMilestone: false,
    })

    showToast(t.habitCard_toastSkip(habit.title))
  }

  if (allActive.length === 0) {
    return <EmptyState message={t.habitCard_empty} />
  }

  if (todayHabits.length === 0) {
    return <EmptyState message={t.habitCard_allDone} />
  }

  return (
    <Reorder.Group
      axis="y"
      values={localHabits}
      onReorder={handleReorder}
      style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 0 }}
    >
      <AnimatePresence mode="popLayout">
        {localHabits.map((habit) => {
          const children = habits.filter((c) => !c.deletedAt && (habit.childIds ?? []).includes(c.id))
          return (
            <Reorder.Item
              key={habit.id}
              value={habit}
              onDragEnd={handleDragEnd}
              style={{ listStyle: 'none' }}
            >
              <HabitItem
                habit={habit}
                onComplete={() => handleComplete(habit)}
                onSkip={() => handleSkip(habit)}
                onTimerToggle={() => habit.timerStartedAt ? pauseHabitTimer(habit.id) : startHabitTimer(habit.id)}
                onEdit={onEdit ? () => onEdit(habit) : undefined}
              />
              {children.length > 0 && (
                <div style={{ paddingLeft: 16, marginTop: 2, display: 'flex', flexDirection: 'column', gap: 2, borderLeft: '2px solid var(--color-border)', marginLeft: 8 }}>
                  {children.map((child) => (
                    <HabitItem
                      key={child.id}
                      habit={child}
                      onComplete={() => handleComplete(child)}
                      onSkip={() => handleSkip(child)}
                      onTimerToggle={() => child.timerStartedAt ? pauseHabitTimer(child.id) : startHabitTimer(child.id)}
                      onEdit={onEdit ? () => onEdit(child) : undefined}
                    />
                  ))}
                </div>
              )}
            </Reorder.Item>
          )
        })}
      </AnimatePresence>
    </Reorder.Group>
  )
}

function HabitItem({
  habit,
  onComplete,
  onSkip,
  onTimerToggle,
  onEdit,
}: {
  habit: Habit
  onComplete: () => void
  onSkip: () => void
  onTimerToggle: () => void
  onEdit?: () => void
}) {
  const refreshText = getNextRefreshText(habit)
  const t = useT()
  const isTiming = !!habit.timerStartedAt
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    if (!isTiming || !habit.timerStartedAt) { setElapsed(0); return }
    const update = () => {
      setElapsed((habit.actualMinutes ?? 0) * 60 + getElapsedSeconds(habit.timerStartedAt!))
    }
    update()
    const id = setInterval(update, 1000)
    return () => clearInterval(id)
  }, [isTiming, habit.timerStartedAt, habit.actualMinutes])

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, height: 0, marginBottom: 0 }}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '8px 0',
        borderBottom: '1px solid var(--color-border)',
      }}
    >
      {/* 完成按钮 */}
      {(habit.targetCount ?? 1) > 1 ? (
        <ProgressButton
          current={habit.currentCycleCount ?? 0}
          target={habit.targetCount}
          onClick={onComplete}
        />
      ) : (
        <button
          onClick={onComplete}
          style={{
            width: 28,
            height: 28,
            borderRadius: 'var(--radius-sm)',
            border: '1.5px solid var(--color-accent)',
            background: 'color-mix(in srgb, var(--color-accent) 10%, transparent)',
            color: 'var(--color-accent)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            fontSize: 13,
            fontWeight: 700,
          }}
        >
          ✓
        </button>
      )}

      {/* 名称 + 连续 */}
      <div
        style={{ flex: 1, minWidth: 0, cursor: onEdit ? 'pointer' : 'default' }}
        onClick={onEdit}
      >
        <div
          style={{
            fontSize: 14,
            color: 'var(--color-text)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {habit.title}
        </div>
        {refreshText && (
          <div style={{ fontSize: 10, color: 'var(--color-text-dim)', marginTop: 1 }}>
            {refreshText}
          </div>
        )}
      </div>

      {/* 计时显示（计时中 or 暂停后累计） */}
      {isTiming ? (
        <span style={{ fontSize: 11, color: 'var(--color-accent)', fontFamily: 'var(--font-num)', fontWeight: 600, whiteSpace: 'nowrap' }}>
          ⏱ {formatTimer(elapsed)}
        </span>
      ) : (habit.actualMinutes ?? 0) > 0 ? (
        <span style={{ fontSize: 11, color: 'var(--color-text-dim)', fontFamily: 'var(--font-num)', fontWeight: 600, whiteSpace: 'nowrap' }}>
          ⏱ {formatTimer((habit.actualMinutes ?? 0) * 60)}
        </span>
      ) : null}

      {/* 连续次数 */}
      {!isTiming && habit.consecutiveCount > 0 && (
        <span style={{ fontSize: 11, color: 'var(--color-xp)', fontFamily: 'var(--font-num)', fontWeight: 600, whiteSpace: 'nowrap' }}>
          🔥{habit.consecutiveCount}
        </span>
      )}

      {/* 计时开始/暂停 */}
      <button
        onClick={onTimerToggle}
        title={isTiming ? t.task_timerPause : t.task_timerStart}
        style={{
          width: 24,
          height: 24,
          borderRadius: 'var(--radius-sm)',
          border: `1px solid ${isTiming ? 'var(--color-accent)' : 'var(--color-border)'}`,
          background: isTiming ? 'color-mix(in srgb, var(--color-accent) 15%, transparent)' : 'transparent',
          color: isTiming ? 'var(--color-accent)' : 'var(--color-text-dim)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          transition: 'all 0.15s',
          padding: 0,
        }}
      >
        {isTiming ? (
          <svg width="9" height="9" viewBox="0 0 10 10" fill="currentColor">
            <rect x="2" y="2" width="2.5" height="6" rx="0.5"/>
            <rect x="5.5" y="2" width="2.5" height="6" rx="0.5"/>
          </svg>
        ) : (
          <svg width="9" height="9" viewBox="0 0 10 10" fill="currentColor">
            <path d="M3 2l5 3-5 3V2z"/>
          </svg>
        )}
      </button>

      {/* 跳过按钮 */}
      <button
        onClick={onSkip}
        title={t.habitCard_skip}
        style={{
          fontSize: 10,
          color: 'var(--color-text-dim)',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: '3px 6px',
          borderRadius: 'var(--radius-sm)',
          opacity: 0.5,
        }}
        onMouseEnter={(e) => { e.currentTarget.style.opacity = '1' }}
        onMouseLeave={(e) => { e.currentTarget.style.opacity = '0.5' }}
      >
        {t.habitCard_skip}
      </button>
    </motion.div>
  )
}

function ProgressButton({
  current,
  target,
  onClick,
}: {
  current: number
  target: number
  onClick: () => void
}) {
  const radius = 11
  const circumference = 2 * Math.PI * radius
  const progress = Math.min(current / target, 1)
  const dashOffset = circumference * (1 - progress)

  return (
    <button
      onClick={onClick}
      title={`${current}/${target}`}
      style={{
        width: 32,
        height: 32,
        borderRadius: '50%',
        border: 'none',
        background: 'none',
        cursor: 'pointer',
        padding: 0,
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
      }}
    >
      <svg width={32} height={32} style={{ transform: 'rotate(-90deg)' }}>
        {/* 背景环 */}
        <circle
          cx={16} cy={16} r={radius}
          fill="none"
          stroke="color-mix(in srgb, var(--color-accent) 20%, transparent)"
          strokeWidth={2.5}
        />
        {/* 进度环 */}
        <circle
          cx={16} cy={16} r={radius}
          fill="none"
          stroke="var(--color-accent)"
          strokeWidth={2.5}
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.3s ease' }}
        />
      </svg>
      <span style={{
        position: 'absolute',
        fontSize: 9,
        fontWeight: 700,
        fontFamily: 'var(--font-num)',
        color: 'var(--color-accent)',
        lineHeight: 1,
      }}>
        {current}/{target}
      </span>
    </button>
  )
}

function EmptyState({ message }: { message: string }) {
  return (
    <p style={{ fontSize: 12, color: 'var(--color-text-dim)', textAlign: 'center', padding: '12px 0' }}>
      {message}
    </p>
  )
}
