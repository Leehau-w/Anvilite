import React, { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { Task } from '@/types/task'
import { PriorityDot } from '@/components/ui/PriorityBadge'
import { formatRelativeDate, isOverdue, formatTimer, getElapsedSeconds } from '@/utils/time'
import { useTaskStore } from '@/stores/taskStore'
import { useCharacterStore } from '@/stores/characterStore'
import { useGrowthEventStore } from '@/stores/growthEventStore'
import { calculateTaskXP } from '@/engines/xpEngine'
import { useToast } from '@/components/feedback/Toast'
import { useFeedback } from '@/components/feedback/FeedbackContext'
import { useT } from '@/i18n'
import { useSettingsStore } from '@/stores/settingsStore'

interface TaskItemProps {
  task: Task
  compact?: boolean
  onEdit?: (task: Task) => void
}

export function TaskItem({ task, compact, onEdit }: TaskItemProps) {
  const { completeTask, undoComplete, updateTask, startTask, pauseTask, deleteTask, hideTask } = useTaskStore()
  const { character, gainXPAndOre, recordActivity, revokeXP } = useCharacterStore()
  const { addEvent, removeEvent } = useGrowthEventStore()
  const { showToast } = useToast()
  const { triggerFeedback } = useFeedback()

  const t = useT()
  const lang = useSettingsStore((s) => s.settings.language)
  const [completing, setCompleting] = useState(false)
  const [confirmHigh, setConfirmHigh] = useState(false)
  const [hovered, setHovered] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [showDurationInput, setShowDurationInput] = useState(false)
  const [durationInput, setDurationInput] = useState('')
  const confirmTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const deleteConfirmTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const isOverdueDue = isOverdue(task.dueDate) && task.status !== 'done'
  const isDoing = task.status === 'doing'
  const isDone = task.status === 'done'

  // 计时器
  useEffect(() => {
    if (!isDoing || !task.timerStartedAt) return
    const update = () => {
      setElapsed(task.actualMinutes * 60 + getElapsedSeconds(task.timerStartedAt))
    }
    update()
    const interval = setInterval(update, 1000)
    return () => clearInterval(interval)
  }, [isDoing, task.timerStartedAt, task.actualMinutes])

  // 清理确认timer
  useEffect(() => {
    return () => {
      if (confirmTimer.current) clearTimeout(confirmTimer.current)
      if (deleteConfirmTimer.current) clearTimeout(deleteConfirmTimer.current)
    }
  }, [])

  const handleComplete = useCallback(async () => {
    if (completing) return

    if (isDone) {
      undoComplete(task.id)
      revokeXP(task.xpReward)
      const ev = useGrowthEventStore.getState().events.find(
        (e) => e.type === 'task_complete' && e.title === t.task_eventTitle(task.title)
      )
      if (ev) removeEvent(ev.id)
      showToast(t.task_toastUndoDone)
      setShowDurationInput(false)
      return
    }

    if (task.difficulty >= 4 && !confirmHigh) {
      setConfirmHigh(true)
      if (confirmTimer.current) clearTimeout(confirmTimer.current)
      confirmTimer.current = setTimeout(() => setConfirmHigh(false), 3000)
      return
    }
    setConfirmHigh(false)
    if (confirmTimer.current) clearTimeout(confirmTimer.current)

    setCompleting(true)
    await delay(250)

    const completed = completeTask(task.id)
    if (!completed) { setCompleting(false); return }

    const { xp, ore } = calculateTaskXP(completed, character.streakDays)
    updateTask(task.id, { xpReward: xp })
    const { leveledUp, oldLevel, newLevel, prestigeUnlocked } = gainXPAndOre(xp, ore)
    const { oldStreak, newStreak } = recordActivity()

    addEvent({
      type: 'task_complete',
      title: t.task_eventTitle(task.title),
      details: { xpGained: xp, oreGained: ore, actualMinutes: completed.actualMinutes, categoryName: task.category },
      isMilestone: false,
    })

    await delay(50)
    triggerFeedback({ xp, ore, leveledUp, oldLevel, newLevel, oldStreakDays: oldStreak, newStreakDays: newStreak, prestigeUnlocked })

    await delay(300)
    showToast(t.task_toastDone(xp), {
      label: t.task_toastUndo,
      onClick: () => {
        undoComplete(task.id)
        revokeXP(xp)
        const ev = useGrowthEventStore.getState().events.find(
          (e) => e.type === 'task_complete' && e.title === t.task_eventTitle(task.title)
        )
        if (ev) removeEvent(ev.id)
      },
    })

    if (completed.actualMinutes === 0) {
      setDurationInput('')
      setShowDurationInput(true)
    }
  }, [completing, isDone, task, confirmHigh, character.streakDays])

  function handleStatusToggle(e: React.MouseEvent) {
    e.stopPropagation()
    if (isDoing) {
      pauseTask(task.id)
    } else if (!isDone) {
      startTask(task.id)
    }
  }

  function handleSaveDuration(e?: React.MouseEvent) {
    e?.stopPropagation()
    const mins = parseInt(durationInput, 10)
    if (mins > 0) updateTask(task.id, { actualMinutes: mins })
    setShowDurationInput(false)
  }

  function handleHide(e: React.MouseEvent) {
    e.stopPropagation()
    hideTask(task.id)
    showToast(t.task_toastHidden)
  }

  function handleInscribe(e: React.MouseEvent) {
    e.stopPropagation()
    addEvent({
      type: 'custom_milestone',
      title: task.title,
      details: {
        sourceType: 'task',
        xpGained: task.xpReward,
        actualMinutes: task.actualMinutes,
        categoryName: task.category,
        difficulty: task.difficulty,
      },
      isMilestone: true,
    })
    showToast(`⭐ ${task.title}`)
  }

  function handleDeleteDone(e: React.MouseEvent) {
    e.stopPropagation()
    if (!deleteConfirm) {
      setDeleteConfirm(true)
      if (deleteConfirmTimer.current) clearTimeout(deleteConfirmTimer.current)
      deleteConfirmTimer.current = setTimeout(() => setDeleteConfirm(false), 3000)
      return
    }
    setDeleteConfirm(false)
    if (task.xpReward > 0) revokeXP(task.xpReward)
    const ev = useGrowthEventStore.getState().events.find(
      (ev) => ev.type === 'task_complete' && ev.title === `完成任务：${task.title}`
    )
    if (ev) removeEvent(ev.id)
    deleteTask(task.id)
    showToast(t.task_toastDeleted)
  }

  function handleBodyClick() {
    if (!completing && onEdit) {
      onEdit(task)
    }
  }

  const cardVariants = {
    initial: { opacity: 0, y: -10 },
    animate: {
      opacity: 1,
      y: 0,
      scale: completing ? 1.02 : 1,
      transition: { duration: 0.25 },
    },
    exit: {
      x: '120%',
      rotate: 3,
      opacity: 0,
      transition: { duration: 0.4, ease: [0.4, 0, 1, 1], delay: 0.25 },
    },
  }

  const bgColor = isDoing
    ? 'color-mix(in srgb, var(--color-accent) 5%, var(--color-surface))'
    : isOverdueDue
    ? 'color-mix(in srgb, var(--color-danger) 5%, var(--color-surface))'
    : 'var(--color-surface)'

  const borderColor = isDoing
    ? 'color-mix(in srgb, var(--color-accent) 25%, var(--color-border))'
    : 'var(--color-border)'

  return (
    <motion.div
      layout
      variants={cardVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setDeleteConfirm(false) }}
      style={{
        position: 'relative',
        padding: compact ? '8px 12px' : '10px 12px',
        background: bgColor,
        borderRadius: 'var(--radius-md)',
        border: `1px solid ${borderColor}`,
        display: 'flex',
        alignItems: compact ? 'center' : 'flex-start',
        gap: 10,
        opacity: isDone ? 0.7 : 1,
        overflow: 'hidden',
      }}
      whileHover={{ boxShadow: 'var(--shadow-md)' }}
    >
      {/* 勾选框 */}
      <CheckButton
        done={isDone}
        confirming={confirmHigh}
        onComplete={handleComplete}
        compact={compact}
      />

      {/* 主内容 */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {/* 标题行 - 非已完成任务可点击编辑 */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            cursor: !completing && onEdit ? 'pointer' : 'default',
          }}
          onClick={handleBodyClick}
        >
          <PriorityDot priority={task.priority} />
          <span
            style={{
              fontSize: 14,
              color: isDone ? 'var(--color-text-dim)' : 'var(--color-text)',
              textDecoration: isDone ? 'line-through' : 'none',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              flex: 1,
            }}
          >
            {task.title}
          </span>
        </div>

        {!compact && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              marginTop: 4,
              fontSize: 12,
              color: 'var(--color-text-dim)',
            }}
          >
            {task.dueDate && (
              <span style={{ color: isOverdueDue ? 'var(--color-danger)' : 'inherit' }}>
                {isOverdueDue ? t.task_overdue : formatRelativeDate(task.dueDate, lang)}
              </span>
            )}
            {task.childIds.length > 0 && <span>{t.task_subtasks(task.childIds.length)}</span>}
            {task.estimatedMinutes && !isDoing && (
              <span style={{ opacity: 0.6 }}>{t.task_estMin(task.estimatedMinutes)}</span>
            )}
            {isDoing && task.timerStartedAt && (
              <span style={{ color: 'var(--color-accent)', fontFamily: 'var(--font-num)', fontWeight: 600 }}>
                ⏱ {formatTimer(elapsed)}
              </span>
            )}
            {isDone && task.xpReward > 0 && (
              <span style={{ color: 'var(--color-success)', fontFamily: 'var(--font-num)', fontWeight: 600 }}>
                +{task.xpReward} XP
              </span>
            )}
            {isDone && task.actualMinutes > 0 && (
              <span style={{ fontFamily: 'var(--font-num)' }}>
                {t.task_actualMin(task.actualMinutes)}
              </span>
            )}
          </div>
        )}

        {/* 已完成任务操作行 */}
        {isDone && !compact && (
          <div style={{ marginTop: 6 }}>
            {showDurationInput && (
              <div
                style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}
                onClick={(e) => e.stopPropagation()}
              >
                <input
                  type="number"
                  min={1}
                  autoFocus
                  value={durationInput}
                  onChange={(e) => setDurationInput(e.target.value)}
                  placeholder={t.task_setActualDuration}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleSaveDuration(); if (e.key === 'Escape') setShowDurationInput(false) }}
                  style={{
                    width: 160,
                    height: 24,
                    padding: '0 8px',
                    fontSize: 11,
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--color-accent)',
                    background: 'var(--color-bg)',
                    color: 'var(--color-text)',
                    outline: 'none',
                  }}
                />
                <button
                  onClick={handleSaveDuration}
                  style={{ fontSize: 11, padding: '2px 8px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-success)', background: 'transparent', color: 'var(--color-success)', cursor: 'pointer' }}
                >
                  ✓
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); setShowDurationInput(false) }}
                  style={{ fontSize: 11, padding: '2px 8px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)', background: 'transparent', color: 'var(--color-text-dim)', cursor: 'pointer' }}
                >
                  ✕
                </button>
              </div>
            )}
            <AnimatePresence>
              {hovered && (
                <motion.div
                  initial={{ opacity: 0, x: -4 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -4 }}
                  transition={{ duration: 0.15 }}
                  style={{ display: 'flex', gap: 4 }}
                >
                  {!showDurationInput && (
                    <ActionButton onClick={(e) => { e.stopPropagation(); setDurationInput(task.actualMinutes > 0 ? String(task.actualMinutes) : ''); setShowDurationInput(true) }} color="var(--color-text-dim)">
                      ⏱
                    </ActionButton>
                  )}
                  <ActionButton onClick={handleInscribe} color="var(--color-xp)">
                    ⭐
                  </ActionButton>
                  <ActionButton onClick={handleHide} color="var(--color-text-dim)">
                    {t.task_hide}
                  </ActionButton>
                  <ActionButton
                    onClick={handleDeleteDone}
                    color={deleteConfirm ? 'var(--color-danger)' : 'var(--color-text-dim)'}
                    borderColor={deleteConfirm ? 'var(--color-danger)' : undefined}
                  >
                    {deleteConfirm ? t.task_confirmDelete(task.xpReward) : t.task_delete}
                  </ActionButton>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* 未完成任务操作行（hover 时显示删除） */}
        {!isDone && !compact && (
          <AnimatePresence>
            {hovered && (
              <motion.div
                initial={{ opacity: 0, x: -4 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -4 }}
                transition={{ duration: 0.15 }}
                style={{ display: 'flex', gap: 4, marginTop: 6 }}
              >
                <ActionButton
                  onClick={handleDeleteDone}
                  color={deleteConfirm ? 'var(--color-danger)' : 'var(--color-text-dim)'}
                  borderColor={deleteConfirm ? 'var(--color-danger)' : undefined}
                >
                  {deleteConfirm ? t.task_confirmDeleteNoXP : t.task_delete}
                </ActionButton>
              </motion.div>
            )}
          </AnimatePresence>
        )}
      </div>

      {compact && task.dueDate && (
        <span
          style={{
            fontSize: 11,
            color: isOverdueDue ? 'var(--color-danger)' : 'var(--color-text-dim)',
            whiteSpace: 'nowrap',
            flexShrink: 0,
          }}
        >
          {formatRelativeDate(task.dueDate)}
        </span>
      )}

      {/* 计时显示（compact：计时中 or 暂停后累计） */}
      {compact && isDoing && task.timerStartedAt && (
        <span
          style={{
            fontSize: 11,
            color: 'var(--color-accent)',
            fontFamily: 'var(--font-num)',
            fontWeight: 600,
            flexShrink: 0,
          }}
        >
          ⏱{formatTimer(elapsed)}
        </span>
      )}
      {compact && !isDoing && !isDone && task.actualMinutes > 0 && (
        <span
          style={{
            fontSize: 11,
            color: 'var(--color-text-dim)',
            fontFamily: 'var(--font-num)',
            fontWeight: 600,
            flexShrink: 0,
          }}
        >
          ⏱{formatTimer(task.actualMinutes * 60)}
        </span>
      )}

      {/* 计时器控制按钮（非已完成） */}
      {!isDone && (
        <button
          onClick={handleStatusToggle}
          title={isDoing ? t.task_timerPause : t.task_timerStart}
          style={{
            width: 26,
            height: 26,
            borderRadius: 'var(--radius-sm)',
            background: isDoing ? 'color-mix(in srgb, var(--color-accent) 15%, transparent)' : 'transparent',
            border: `1px solid ${isDoing ? 'var(--color-accent)' : 'var(--color-border)'}`,
            color: isDoing ? 'var(--color-accent)' : 'var(--color-text-dim)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            transition: 'all 0.15s',
          }}
        >
          {isDoing ? <PauseIcon /> : <PlayIcon />}
        </button>
      )}

      {/* 高难度确认提示 */}
      <AnimatePresence>
        {confirmHigh && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            style={{
              position: 'absolute',
              right: 8,
              top: '50%',
              transform: 'translateY(-50%)',
              background: 'var(--color-surface)',
              border: '1px solid var(--color-warning)',
              borderRadius: 'var(--radius-md)',
              padding: '4px 10px',
              fontSize: 11,
              color: 'var(--color-warning)',
              fontWeight: 500,
              whiteSpace: 'nowrap',
              boxShadow: 'var(--shadow-md)',
              zIndex: 10,
            }}
          >
            {t.task_confirmComplete}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

interface CheckButtonProps {
  done: boolean
  confirming: boolean
  onComplete: () => void
  compact?: boolean
}

function CheckButton({ done, confirming, onComplete, compact }: CheckButtonProps) {
  return (
    <motion.button
      onClick={(e) => { e.stopPropagation(); onComplete() }}
      whileTap={{ scale: 0.9 }}
      style={{
        width: compact ? 16 : 18,
        height: compact ? 16 : 18,
        borderRadius: 'var(--radius-sm)',
        border: `2px solid ${
          done ? 'var(--color-success)' : confirming ? 'var(--color-warning)' : 'var(--color-border)'
        }`,
        background: done
          ? 'var(--color-success)'
          : confirming
          ? 'color-mix(in srgb, var(--color-warning) 15%, transparent)'
          : 'transparent',
        cursor: 'pointer',
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'border-color 0.15s, background 0.15s',
        padding: 0,
      }}
    >
      {done && (
        <svg width="9" height="9" viewBox="0 0 10 10" fill="none">
          <path d="M2 5l2.5 2.5L8 3" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </motion.button>
  )
}

function ActionButton({
  onClick,
  children,
  color,
  borderColor,
}: {
  onClick: (e: React.MouseEvent) => void
  children: React.ReactNode
  color?: string
  borderColor?: string
}) {
  return (
    <button
      onClick={onClick}
      style={{
        fontSize: 11,
        padding: '2px 8px',
        borderRadius: 'var(--radius-sm)',
        border: `1px solid ${borderColor ?? 'var(--color-border)'}`,
        background: 'transparent',
        color: color ?? 'var(--color-text-dim)',
        cursor: 'pointer',
        transition: 'all 0.15s',
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </button>
  )
}

function PlayIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
      <path d="M3 2l5 3-5 3V2z" />
    </svg>
  )
}

function PauseIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
      <rect x="2" y="2" width="2.5" height="6" rx="0.5" />
      <rect x="5.5" y="2" width="2.5" height="6" rx="0.5" />
    </svg>
  )
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
