import React, { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence, Reorder } from 'framer-motion'
import { useHabitStore } from '@/stores/habitStore'
import { useCharacterStore } from '@/stores/characterStore'
import { useGrowthEventStore } from '@/stores/growthEventStore'
import { useFeedback } from '@/components/feedback/FeedbackContext'
import { useToast } from '@/components/feedback/Toast'
import { UndoToast } from '@/components/feedback/UndoToast'
import { CollapsibleGroup } from '@/components/ui/CollapsibleGroup'
import { getNextRefreshText } from '@/engines/habitEngine'
import type { Habit, SubHabit } from '@/types/habit'
import { useT } from '@/i18n'
import { useUIStore } from '@/stores/uiStore'

interface UndoEntry {
  habitId: string
  message: string
}

export function HabitCard({ onEdit }: { onEdit?: (habit: Habit) => void }) {
  const { getTodayHabits, completeHabit, skipHabit, habits, startHabitTimer, pauseHabitTimer, reorderHabits, undoComplete } = useHabitStore()
  const { gainXPAndOre, recordActivity } = useCharacterStore()
  const { addEvent } = useGrowthEventStore()
  const { triggerFeedback } = useFeedback()
  const { showToast } = useToast()
  const t = useT()

  const todayHabits = getTodayHabits().sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
  const allActive = habits.filter((h) => h.status === 'active')

  // Completed today habits (for the collapsible group at bottom of dashboard)
  const completedTodayHabits = habits.filter(
    (h) => !h.deletedAt && !h.isHidden && h.status === 'completed_today'
  )

  const [localHabits, setLocalHabits] = useState<Habit[]>(todayHabits)
  const isDraggingRef = useRef(false)

  // UndoToast state — only one at a time
  const [undoEntry, setUndoEntry] = useState<UndoEntry | null>(null)

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

    // Show undo toast
    setUndoEntry({
      habitId: habit.id,
      message: t.habit_completedToast(habit.title, result.xp),
    })
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

  function handleUndoComplete(habit: Habit) {
    undoComplete(habit.id)
    showToast(t.habit_undoneToast(habit.title))
  }

  if (allActive.length === 0 && completedTodayHabits.length === 0) {
    return <EmptyState message={t.habitCard_empty} />
  }

  if (todayHabits.length === 0 && completedTodayHabits.length === 0) {
    return <EmptyState message={t.habitCard_allDone} />
  }

  return (
    <>
      {todayHabits.length > 0 && (
        <Reorder.Group
          axis="y"
          values={localHabits}
          onReorder={handleReorder}
          style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 0 }}
        >
          <AnimatePresence mode="popLayout">
            {localHabits.map((habit) => {
              const children: typeof habits = []  // v0.3: 子习惯已内嵌为 subHabits，此处不再从 habits[] 查找
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
                    onStartPause={() => habit.timerStartedAt ? pauseHabitTimer(habit.id) : startHabitTimer(habit.id)}
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
                          onStartPause={() => child.timerStartedAt ? pauseHabitTimer(child.id) : startHabitTimer(child.id)}
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
      )}

      {/* Completed today section */}
      {completedTodayHabits.length > 0 && (
        <div style={{ marginTop: todayHabits.length > 0 ? 8 : 0 }}>
          <CollapsibleGroup
            label={t.dashboard_cycleCompleted}
            count={completedTodayHabits.length}
            defaultOpen={true}
          >
            <AnimatePresence mode="popLayout">
              {completedTodayHabits.map((habit) => (
                <CompletedHabitItem
                  key={habit.id}
                  habit={habit}
                  onUndo={() => handleUndoComplete(habit)}
                  undoLabel={t.common_undo}
                />
              ))}
            </AnimatePresence>
          </CollapsibleGroup>
        </div>
      )}

      {/* Undo Toast */}
      <AnimatePresence>
        {undoEntry && (
          <UndoToast
            key={undoEntry.habitId}
            message={undoEntry.message}
            undoLabel={t.common_undo}
            duration={5000}
            onUndo={() => {
              const habit = habits.find((h) => h.id === undoEntry.habitId)
              if (habit) handleUndoComplete(habit)
              setUndoEntry(null)
            }}
            onExpire={() => setUndoEntry(null)}
          />
        )}
      </AnimatePresence>
    </>
  )
}

function CompletedHabitItem({
  habit,
  onUndo,
  undoLabel,
}: {
  habit: Habit
  onUndo: () => void
  undoLabel: string
}) {
  const [hovered, setHovered] = useState(false)

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, height: 0, marginBottom: 0 }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '6px 0',
        borderBottom: '1px solid var(--color-border)',
        opacity: 0.7,
      }}
    >
      {/* Done checkmark */}
      <span
        style={{
          width: 28,
          height: 28,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          color: 'var(--color-success)',
          fontSize: 14,
        }}
      >
        ✓
      </span>

      {/* Title */}
      <span
        style={{
          flex: 1,
          fontSize: 13,
          color: 'var(--color-text-dim)',
          textDecoration: 'line-through',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {habit.title}
      </span>

      {/* Undo button on hover */}
      <AnimatePresence>
        {hovered && (
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.1 }}
            onClick={onUndo}
            style={{
              fontSize: 11,
              padding: '2px 8px',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--color-border)',
              background: 'transparent',
              color: 'var(--color-text-dim)',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              flexShrink: 0,
            }}
          >
            ↩ {undoLabel}
          </motion.button>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

function HabitItem({
  habit,
  onComplete,
  onSkip,
  onStartPause,
  onEdit,
}: {
  habit: Habit
  onComplete: () => void
  onSkip: () => void
  onStartPause: () => void
  onEdit?: () => void
}) {
  const refreshText = getNextRefreshText(habit)
  const t = useT()
  const { toggleSubHabit } = useHabitStore()
  const { isTaskCollapsed, toggleTaskCollapse } = useUIStore()
  const isDoing = !!habit.timerStartedAt

  const subHabits = habit.subHabits ?? []
  const subHabitsExpanded = !isTaskCollapsed(habit.id)
  const completedSubCount = subHabits.filter((s) => s.completed).length

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, height: 0, marginBottom: 0 }}
      style={{
        padding: '8px 0',
        borderBottom: '1px solid var(--color-border)',
        background: isDoing ? 'color-mix(in srgb, var(--color-accent) 4%, transparent)' : 'transparent',
        borderRadius: isDoing ? 'var(--radius-sm)' : undefined,
        paddingLeft: isDoing ? 6 : undefined,
        paddingRight: isDoing ? 6 : undefined,
      }}
    >
      {/* 主行 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
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
              width: 28, height: 28, borderRadius: 'var(--radius-sm)',
              border: '1.5px solid var(--color-accent)',
              background: 'color-mix(in srgb, var(--color-accent) 10%, transparent)',
              color: 'var(--color-accent)', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0, fontSize: 13, fontWeight: 700,
            }}
          >
            ✓
          </button>
        )}

        {/* 子项折叠按钮 */}
        {subHabits.length > 0 && (
          <button
            onClick={() => toggleTaskCollapse(habit.id)}
            title={subHabitsExpanded ? '收起子项' : '展开子项'}
            style={{
              display: 'flex', alignItems: 'center', gap: 3,
              padding: '0 7px', height: 20,
              borderRadius: 'var(--radius-sm)',
              border: `1px solid ${subHabitsExpanded ? 'color-mix(in srgb, var(--color-accent) 30%, var(--color-border))' : 'var(--color-border)'}`,
              background: subHabitsExpanded ? 'color-mix(in srgb, var(--color-accent) 8%, transparent)' : 'transparent',
              color: subHabitsExpanded ? 'var(--color-accent)' : 'var(--color-text-dim)',
              cursor: 'pointer', fontSize: 11, fontFamily: 'var(--font-num)',
              flexShrink: 0, transition: 'all 0.15s',
            }}
          >
            <span style={{ fontSize: 9, lineHeight: 1 }}>{subHabitsExpanded ? '▾' : '▸'}</span>
            <span>{completedSubCount}/{subHabits.length}</span>
          </button>
        )}

        {/* 名称 + 刷新时间 */}
        <div style={{ flex: 1, minWidth: 0, cursor: onEdit ? 'pointer' : 'default' }} onClick={onEdit}>
          <div style={{
            fontSize: 14,
            color: isDoing ? 'var(--color-accent)' : 'var(--color-text)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            fontWeight: isDoing ? 600 : 400,
          }}>
            {habit.title}
          </div>
          {refreshText && (
            <div style={{ fontSize: 10, color: 'var(--color-text-dim)', marginTop: 1 }}>{refreshText}</div>
          )}
        </div>

        {/* 连续次数 */}
        {habit.consecutiveCount > 0 && (
          <span style={{ fontSize: 11, color: 'var(--color-xp)', fontFamily: 'var(--font-num)', fontWeight: 600, whiteSpace: 'nowrap' }}>
            🔥{habit.consecutiveCount}
          </span>
        )}

        {/* 开始/暂停按钮 */}
        <button
          onClick={onStartPause}
          title={isDoing ? t.task_pauseDoing : t.task_startDoing}
          style={{
            width: 24, height: 24, borderRadius: 'var(--radius-sm)',
            border: `1px solid ${isDoing ? 'var(--color-accent)' : 'var(--color-border)'}`,
            background: isDoing ? 'color-mix(in srgb, var(--color-accent) 15%, transparent)' : 'transparent',
            color: isDoing ? 'var(--color-accent)' : 'var(--color-text-dim)',
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0, transition: 'all 0.15s', padding: 0,
          }}
        >
          {isDoing ? (
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
            fontSize: 10, color: 'var(--color-text-dim)', background: 'none',
            border: 'none', cursor: 'pointer', padding: '3px 6px',
            borderRadius: 'var(--radius-sm)', opacity: 0.5,
          }}
          onMouseEnter={(e) => { e.currentTarget.style.opacity = '1' }}
          onMouseLeave={(e) => { e.currentTarget.style.opacity = '0.5' }}
        >
          {t.habitCard_skip}
        </button>
      </div>

      {/* 子项列表 */}
      {subHabits.length > 0 && subHabitsExpanded && (
        <div style={{ paddingLeft: 36, marginTop: 4, display: 'flex', flexDirection: 'column', gap: 1 }}>
          {subHabits.map((sub) => (
            <DashSubHabitItem key={sub.id} sub={sub} habitId={habit.id} depth={0} onToggle={toggleSubHabit} />
          ))}
        </div>
      )}
    </motion.div>
  )
}

function DashSubHabitItem({
  sub, habitId, depth, onToggle,
}: {
  sub: SubHabit; habitId: string; depth: number; onToggle: (habitId: string, subId: string) => void
}) {
  const { isTaskCollapsed, toggleTaskCollapse } = useUIStore()
  const childrenExpanded = !isTaskCollapsed(sub.id)
  const completedChildCount = sub.subHabits.filter((c) => c.completed).length

  return (
    <div style={{ marginLeft: depth * 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '2px 0' }}>
        <input
          type="checkbox"
          checked={sub.completed}
          onChange={() => onToggle(habitId, sub.id)}
          style={{ width: 13, height: 13, flexShrink: 0, cursor: 'pointer', accentColor: 'var(--color-accent)' }}
        />
        {sub.subHabits.length > 0 && (
          <button
            onClick={() => toggleTaskCollapse(sub.id)}
            style={{
              display: 'flex', alignItems: 'center', gap: 2,
              padding: '0 5px', height: 16,
              borderRadius: 'var(--radius-sm)',
              border: `1px solid ${childrenExpanded ? 'color-mix(in srgb, var(--color-accent) 30%, var(--color-border))' : 'var(--color-border)'}`,
              background: childrenExpanded ? 'color-mix(in srgb, var(--color-accent) 8%, transparent)' : 'transparent',
              color: childrenExpanded ? 'var(--color-accent)' : 'var(--color-text-dim)',
              cursor: 'pointer', fontSize: 10, fontFamily: 'var(--font-num)',
              flexShrink: 0, transition: 'all 0.15s',
            }}
          >
            <span style={{ fontSize: 8, lineHeight: 1 }}>{childrenExpanded ? '▾' : '▸'}</span>
            <span>{completedChildCount}/{sub.subHabits.length}</span>
          </button>
        )}
        <span style={{
          flex: 1, fontSize: 13,
          color: sub.completed ? 'var(--color-text-dim)' : 'var(--color-text)',
          textDecoration: sub.completed ? 'line-through' : 'none',
          userSelect: 'none',
        }}>
          {sub.title}
        </span>
      </div>
      {sub.subHabits.length > 0 && childrenExpanded && sub.subHabits.map((child) => (
        <DashSubHabitItem key={child.id} sub={child} habitId={habitId} depth={depth + 1} onToggle={onToggle} />
      ))}
    </div>
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
