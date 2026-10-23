import React, { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { Area } from '@/types/area'
import { AREA_TEMPLATES } from '@/types/area'
import type { Task } from '@/types/task'
import type { Habit } from '@/types/habit'
import { useTaskStore } from '@/stores/taskStore'
import { undoTaskCompletion } from '@/utils/taskCompletion'
import { useHabitStore } from '@/stores/habitStore'
import { useDecorationStore } from '@/stores/decorationStore'
import { useToast } from '@/components/feedback/Toast'
import { TaskDrawer } from '@/components/tasks/TaskDrawer'
import { TaskDragHandle } from '@/components/tasks/TaskDragHandle'
import { taskPriorityBackground } from '@/utils/taskPriority'
import { HabitDrawer } from '@/components/dashboard/HabitDrawer'
import { HabitManageModal } from '@/components/dashboard/HabitManageModal'
import { ArchiveSpace } from './ArchiveSpace'
import { ALL_DECORATIONS } from '@/types/decoration'
import { isOverdue, formatRelativeDate } from '@/utils/time'
import { getAreaDisplayName } from '@/utils/area'
import { useT } from '@/i18n'
import { getAreaActivityStats } from '@/utils/areaStats'

interface InteriorSpaceProps {
  area: Area
  onExit: () => void
}

function delay(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms))
}

export function InteriorSpace({ area, onExit }: InteriorSpaceProps) {
  const t = useT()
  const isMilestone = area.category === '_milestone'
  const areaDisplayName = getAreaDisplayName(area, t)

  if (isMilestone) {
    return <ArchiveSpace area={area} onExit={onExit} />
  }
  const emoji = area.templateId
    ? AREA_TEMPLATES[area.templateId].prosperityEmojis[0]
    : '🏗️'

  const [taskDrawerOpen, setTaskDrawerOpen] = useState(false)
  const [editTask, setEditTask] = useState<Task | null>(null)
  const [habitDrawerOpen, setHabitDrawerOpen] = useState(false)
  const [habitManageOpen, setHabitManageOpen] = useState(false)
  const [editHabit, setEditHabit] = useState<Habit | null>(null)
  const [showAllTasks, setShowAllTasks] = useState(false)
  const [showAllHabits, setShowAllHabits] = useState(false)

  const { tasks, completeTask, startTask, waitTask, resumeWaitingTask } = useTaskStore()
  const { habits, completeHabit, skipHabit, undoComplete: undoHabitComplete } = useHabitStore()
  const { getOwned } = useDecorationStore()
  const { showToast } = useToast()

  // ── 区域数据 ──────────────────────────────────────────────────────
  const areaTasks = tasks.filter((t) => !t.deletedAt && !t.isHidden && t.category === area.category)

  const activeTasks = areaTasks.filter((t) => t.status === 'doing')
  const todoTasks = areaTasks.filter((t) => t.status === 'todo')
  const waitingTasks = areaTasks.filter((t) => t.status === 'waiting')
  const doneTasks = areaTasks.filter((t) => t.status === 'done')

  const visibleTasks = showAllTasks
    ? [...activeTasks, ...todoTasks, ...waitingTasks, ...doneTasks]
    : [...activeTasks, ...todoTasks, ...waitingTasks].slice(0, 6)

  const areaHabits = habits.filter((h) => h.status !== 'archived' && h.category === area.category)

  const todayHabits = areaHabits.filter((h) => h.status === 'active')
  const completedHabits = habits.filter((h) => h.status === 'completed_today' && h.category === area.category)

  const visibleHabits = showAllHabits ? areaHabits.filter((h) => h.status !== 'archived') : todayHabits

  // ── 任务完成 ──────────────────────────────────────────────────────
  const handleCompleteTask = useCallback(async (task: Task) => {
    try {
      if (task.status === 'done') {
        if (undoTaskCompletion(task.id, task.completionId)) showToast(t.task_toastUndoDone)
        return
      }
      const completed = completeTask(task.id)
      if (!completed) return
      await delay(50)
      showToast(t.task_toastDone(0), {
        label: t.task_toastUndo,
        onClick: () => {
          try { undoTaskCompletion(task.id, completed.completionId) }
          catch { showToast(t.activity_actionFailed) }
        },
      })
    } catch {
      showToast(t.activity_actionFailed)
    }
  }, [completeTask, showToast, t])

  // ── 习惯完成 ──────────────────────────────────────────────────────
  function handleCompleteHabit(habit: Habit) {
    try {
      if (habit.status === 'completed_today') {
        showToast(undoHabitComplete(habit.id, habit.lastAction?.id) ? t.habit_undoneToast(habit.title) : t.habit_undoUnavailable)
        return
      }
      const result = completeHabit(habit.id)
      if (!result) return

      if (result.partial) {
        const current = (habit.currentCycleCount ?? 0) + 1
        const target = habit.targetCount ?? 1
        showToast(t.interior_habitPartial(habit.title, current, target))
        return
      }

      showToast(t.habitCard_toastComplete(habit.title, result.newStreak))
    } catch {
      showToast(t.activity_actionFailed)
    }
  }

  function handleSkipHabit(habit: Habit) {
    try {
      const result = skipHabit(habit.id)
      if (!result) return
      showToast(t.habitCard_toastSkip(habit.title))
    } catch {
      showToast(t.activity_actionFailed)
    }
  }

  // ── 已拥有装饰 ───────────────────────────────────────────────────
  const ownedDecoIds = getOwned(area.id)
  const ownedDecos = ALL_DECORATIONS.filter(
    (d) => d.templateId === area.templateId && ownedDecoIds.includes(d.id)
  )

  // ── 右面板统计 ────────────────────────────────────────────────────
  const { completedTaskCount: completedCount, totalMinutes } = getAreaActivityStats(tasks, area.category)
  const hours = Math.floor(totalMinutes / 60)
  const mins = totalMinutes % 60

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--color-bg)',
        position: 'relative',
      }}
    >
      {/* ── 顶部栏 ──────────────────────────────────────────────── */}
      <div
        style={{
          height: 48,
          display: 'flex',
          alignItems: 'center',
          padding: '0 16px',
          borderBottom: '1px solid var(--color-border)',
          background: 'var(--color-surface)',
          flexShrink: 0,
          gap: 12,
        }}
      >
        <button
          onClick={onExit}
          style={{
            padding: '5px 12px',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--color-border)',
            background: 'transparent',
            color: 'var(--color-text-dim)',
            fontSize: 13,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            transition: 'color 0.15s, border-color 0.15s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = 'var(--color-text)'
            e.currentTarget.style.borderColor = 'var(--color-text-dim)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = 'var(--color-text-dim)'
            e.currentTarget.style.borderColor = 'var(--color-border)'
          }}
        >
          {t.interior_backToMap}
        </button>
        <span style={{ fontSize: 11, color: 'var(--color-text-dim)', opacity: 0.6 }}>ESC</span>

        <div style={{ flex: 1 }} />

        {/* 区域标题 */}
        <span style={{ fontSize: 22 }}>{emoji}</span>
        <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--color-text)' }}>{areaDisplayName}</span>

        <div style={{ flex: 1 }} />
      </div>

      {/* ── 主体三栏 ─────────────────────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        {/* ── 左面板 ──────────────────────────────────────────── */}
        <div
          style={{
            width: '35%',
            borderRight: '1px solid var(--color-border)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          <div style={{ flex: 1, overflowY: 'auto', padding: '16px 14px', display: 'flex', flexDirection: 'column', gap: 20 }}>

            <>
                {/* ─ 任务区 ─ */}
                <PanelSection
                  title={t.interior_panelTasks}
                  count={activeTasks.length + todoTasks.length + waitingTasks.length}
                  action={
                    <button onClick={() => { setEditTask(null); setTaskDrawerOpen(true) }} style={addBtnStyle}>
                      {t.interior_newTask}
                    </button>
                  }
                >
                  {visibleTasks.length === 0 ? (
                    <EmptyHint>{t.interior_emptyTasks}</EmptyHint>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <AnimatePresence mode="popLayout">
                        {visibleTasks.map((task) => (
                          <InteriorTaskRow
                            key={task.id}
                            task={task}
                            onComplete={() => handleCompleteTask(task)}
                            onStart={() => startTask(task.id)}
                            onWaitingToggle={() => task.status === 'waiting' ? resumeWaitingTask(task.id) : waitTask(task.id)}
                            onEdit={() => { setEditTask(task); setTaskDrawerOpen(true) }}
                          />
                        ))}
                      </AnimatePresence>
                    </div>
                  )}
                  {/* 展开/收起 */}
                  {(activeTasks.length + todoTasks.length + waitingTasks.length > 6 || doneTasks.length > 0) && (
                    <button
                      onClick={() => setShowAllTasks((v) => !v)}
                      style={toggleBtnStyle}
                    >
                      {showAllTasks
                        ? t.interior_collapse
                        : t.interior_expandAll(areaTasks.length)}
                    </button>
                  )}
                </PanelSection>

                {/* ─ 习惯区 ─ */}
                <PanelSection
                  title={t.interior_panelHabits}
                  count={todayHabits.length}
                  action={
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button onClick={() => setHabitManageOpen(true)} style={addBtnStyle}>{t.interior_habitManage}</button>
                      <button onClick={() => { setEditHabit(null); setHabitDrawerOpen(true) }} style={addBtnStyle}>{t.interior_habitAdd}</button>
                    </div>
                  }
                >
                  {areaHabits.filter((h) => h.status !== 'archived').length === 0 ? (
                    <EmptyHint>{t.interior_emptyHabits}</EmptyHint>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <AnimatePresence mode="popLayout">
                        {visibleHabits.map((habit) => (
                          <InteriorHabitRow
                            key={habit.id}
                            habit={habit}
                            onComplete={() => handleCompleteHabit(habit)}
                            onSkip={() => handleSkipHabit(habit)}
                            onEdit={() => { setEditHabit(habit); setHabitDrawerOpen(true) }}
                          />
                        ))}
                      </AnimatePresence>
                      {completedHabits.length > 0 && !showAllHabits && (
                        <p style={{ fontSize: 11, color: 'var(--color-text-dim)', margin: '6px 0 0', textAlign: 'center' }}>
                          {t.interior_habitsDoneToday(completedHabits.length)}
                        </p>
                      )}
                    </div>
                  )}
                  {areaHabits.filter((h) => h.status !== 'archived').length > todayHabits.length && (
                    <button
                      onClick={() => setShowAllHabits((v) => !v)}
                      style={toggleBtnStyle}
                    >
                      {showAllHabits ? t.interior_todayOnly : t.interior_allHabits}
                    </button>
                  )}
                </PanelSection>
            </>
          </div>
        </div>

        {/* ── 中间场景 ─────────────────────────────────────────── */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {/* 背景装饰 */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: `radial-gradient(ellipse at 50% 60%, color-mix(in srgb, var(--color-accent) 6%, transparent) 0%, transparent 70%)`,
            }}
          />

          {/* 建筑大图 */}
          <motion.div
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.5, ease: [0.34, 1.56, 0.64, 1] }}
            style={{
              fontSize: 96,
              lineHeight: 1,
              filter: 'drop-shadow(0 8px 24px rgba(0,0,0,0.15))',
              zIndex: 1,
              userSelect: 'none',
            }}
          >
            {emoji}
          </motion.div>

          {/* 地面阴影 */}
          <div
            style={{
              width: 120,
              height: 16,
              background: 'radial-gradient(ellipse, rgba(0,0,0,0.12) 0%, transparent 70%)',
              borderRadius: '50%',
              marginTop: -8,
              zIndex: 0,
            }}
          />

          {/* 状态标签 */}
          {activeTasks.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              style={{
                marginTop: 20,
                padding: '5px 14px',
                background: 'color-mix(in srgb, var(--color-accent) 12%, var(--color-surface))',
                border: '1px solid color-mix(in srgb, var(--color-accent) 30%, transparent)',
                borderRadius: 'var(--radius-full)',
                fontSize: 12,
                color: 'var(--color-accent)',
                fontWeight: 500,
                zIndex: 1,
              }}
            >
              {t.interior_activeTasks(activeTasks.length)}
            </motion.div>
          )}
        </div>

        {/* ── 右面板 ────────────────────────────────────────────── */}
        <div
          style={{
            width: '35%',
            borderLeft: '1px solid var(--color-border)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          <div style={{ flex: 1, overflowY: 'auto', padding: '16px 14px', display: 'flex', flexDirection: 'column', gap: 20 }}>

            {/* ─ 实际完成统计 ─ */}
            <PanelSection title={t.interior_panelStats}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <StatCell label={t.interior_statTasks} value={completedCount} unit={t.milestone_unitTasks} />
                <StatCell
                  label={t.interior_statTime}
                  value={hours > 0 ? `${hours}h ${mins}m` : `${mins}m`}
                  unit=""
                  raw
                />
              </div>
            </PanelSection>

            {/* ─ 已拥有装饰 ─ */}
            <PanelSection title={t.interior_panelFavorites}>
              {/* 已拥有装饰网格 */}
              {ownedDecos.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
                  {ownedDecos.map((d) => (
                    <div
                      key={d.id}
                      title={d.name}
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--color-border)',
                        background: 'var(--color-surface)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 20,
                        cursor: 'default',
                      }}
                    >
                      {d.icon}
                    </div>
                  ))}
                </div>
              )}

              {ownedDecos.length === 0 && area.templateId && (
                <p style={{ fontSize: 11, color: 'var(--color-text-dim)', margin: 0, textAlign: 'center', padding: '8px 0' }}>
                  {t.interior_emptyDecos}
                </p>
              )}
            </PanelSection>
          </div>
        </div>
      </div>

      {/* ── 抽屉：新建任务（预填分类） ────────────────────────── */}
      <TaskDrawer
        open={taskDrawerOpen}
        onClose={() => { setTaskDrawerOpen(false); setEditTask(null) }}
        editTask={editTask}
        initialCategory={area.category}
      />

      {/* ── 抽屉：添加/编辑习惯（预填分类） ──────────────────── */}
      <HabitDrawer
        open={habitDrawerOpen}
        onClose={() => { setHabitDrawerOpen(false); setEditHabit(null) }}
        editHabit={editHabit}
        defaultCategory={area.category}
      />

      {/* ── 习惯管理 ───────────────────────────────────────────── */}
      <HabitManageModal
        open={habitManageOpen}
        onClose={() => setHabitManageOpen(false)}
        onEdit={(habit) => { setEditHabit(habit); setHabitManageOpen(false); setHabitDrawerOpen(true) }}
      />

    </div>
  )
}

// ── 任务行 ────────────────────────────────────────────────────────────
function InteriorTaskRow({
  task,
  onComplete,
  onStart,
  onWaitingToggle,
  onEdit,
}: {
  task: Task
  onComplete: () => void
  onStart: () => void
  onWaitingToggle: () => void
  onEdit: () => void
}) {
  const t = useT()
  const isDone = task.status === 'done'
  const isDoing = task.status === 'doing'
  const isWaiting = task.status === 'waiting'
  const isOv = isOverdue(task.dueDate) && !isDone

  return (
    <motion.div
      data-interior-task-id={task.id}
      layout
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: isDone ? 0.5 : 1, y: 0 }}
      exit={{ opacity: 0, height: 0, marginBottom: 0 }}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '7px 10px',
        background: taskPriorityBackground(task.priority, isDone, task.backgroundColor),
        borderRadius: 'var(--radius-md)',
        border: `1px solid ${isDoing ? 'color-mix(in srgb, var(--color-accent) 25%, transparent)' : 'var(--color-border)'}`,
      }}
    >
      <TaskDragHandle task={task} compact />
      {/* 完成按钮 */}
      <button
        onClick={onComplete}
        title={isDone ? t.task_toastUndo : t.interior_markDone}
        style={{
          width: 22,
          height: 22,
          borderRadius: 'var(--radius-sm)',
          border: `1.5px solid ${isDone ? 'var(--color-success)' : 'var(--color-accent)'}`,
          background: isDone
            ? 'color-mix(in srgb, var(--color-success) 20%, transparent)'
            : 'color-mix(in srgb, var(--color-accent) 10%, transparent)',
          color: isDone ? 'var(--color-success)' : 'var(--color-accent)',
          cursor: 'pointer',
          fontSize: 11,
          fontWeight: 700,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          transition: 'all 0.15s',
        }}
      >
        {isDone ? '✓' : ''}
      </button>

      {/* 标题 */}
      <div style={{ flex: 1, minWidth: 0, cursor: 'pointer' }} onClick={onEdit}>
        <div
          style={{
            fontSize: 13,
            color: isDone ? 'var(--color-text-dim)' : 'var(--color-text)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            textDecoration: isDone ? 'line-through' : 'none',
          }}
        >
          {task.title}
        </div>
        {task.dueDate && (
          <div style={{ fontSize: 10, color: isOv ? '#dc2626' : 'var(--color-text-dim)', marginTop: 1 }}>
            {formatRelativeDate(task.dueDate)}
          </div>
        )}
      </div>

      {!isDone && (
        <button type="button" onClick={onWaitingToggle}
          title={isWaiting ? t.task_resumeWaiting : t.task_waitingAction}
          aria-label={isWaiting ? t.task_resumeWaiting : t.task_waitingAction}
          style={{ flexShrink: 0, fontSize: 11, border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-sm)', color: 'var(--color-secondary)', background: 'transparent', cursor: 'pointer', padding: '2px 5px' }}>
          {isWaiting ? '↩' : '⏳'}
        </button>
      )}
      {/* 进行中状态 / 开始按钮 */}
      {!isDone && !isWaiting && (
        isDoing ? (
          <span
            style={{
              fontSize: 10,
              color: 'var(--color-accent)',
              background: 'color-mix(in srgb, var(--color-accent) 12%, transparent)',
              padding: '2px 6px',
              borderRadius: 'var(--radius-full)',
              fontWeight: 600,
              flexShrink: 0,
            }}
          >
            {t.interior_doing}
          </span>
        ) : (
          <button
            onClick={onStart}
            title={t.task_timerStart}
            style={{
              fontSize: 10,
              color: 'var(--color-text-dim)',
              background: 'none',
              border: '1px solid var(--color-border)',
              cursor: 'pointer',
              padding: '2px 7px',
              borderRadius: 'var(--radius-full)',
              opacity: 0.7,
              flexShrink: 0,
              transition: 'opacity 0.15s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.opacity = '1' }}
            onMouseLeave={(e) => { e.currentTarget.style.opacity = '0.7' }}
          >
            ▶
          </button>
        )
      )}
    </motion.div>
  )
}

// ── 习惯行 ────────────────────────────────────────────────────────────
function InteriorHabitRow({
  habit,
  onComplete,
  onSkip,
  onEdit,
}: {
  habit: Habit
  onComplete: () => void
  onSkip: () => void
  onEdit?: () => void
}) {
  const t = useT()
  const isDone = habit.status === 'completed_today'

  return (
    <motion.div
      data-interior-habit-id={habit.id}
      layout
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: isDone ? 0.5 : 1, y: 0 }}
      exit={{ opacity: 0, height: 0 }}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '8px 0',
        borderBottom: '1px solid var(--color-border)',
      }}
    >
      {/* 完成按钮 */}
      <button
        onClick={onComplete}
        title={isDone ? t.common_undo : t.interior_markDone}
        style={{
          width: 24,
          height: 24,
          borderRadius: 'var(--radius-sm)',
          border: `1.5px solid ${isDone ? 'var(--color-success)' : 'var(--color-accent)'}`,
          background: isDone
            ? 'color-mix(in srgb, var(--color-success) 15%, transparent)'
            : 'color-mix(in srgb, var(--color-accent) 10%, transparent)',
          color: isDone ? 'var(--color-success)' : 'var(--color-accent)',
          cursor: isDone ? 'default' : 'pointer',
          fontSize: 11,
          fontWeight: 700,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        {isDone ? '✓' : ''}
      </button>

      {/* 标题 */}
      <div style={{ flex: 1, minWidth: 0, cursor: onEdit ? 'pointer' : 'default' }} onClick={onEdit}>
        <div
          style={{
            fontSize: 13,
            color: isDone ? 'var(--color-text-dim)' : 'var(--color-text)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            textDecoration: isDone ? 'line-through' : 'none',
          }}
        >
          {habit.title}
        </div>
      </div>

      {/* 连续 */}
      {habit.consecutiveCount > 0 && (
        <span style={{ fontSize: 11, color: 'var(--color-xp)', fontFamily: 'var(--font-num)', fontWeight: 600, flexShrink: 0 }}>
          {t.archive_streak(habit.consecutiveCount)}
        </span>
      )}

      {/* 跳过 */}
      {!isDone && (
        <button
          onClick={onSkip}
          title={t.habitCard_skip}
          style={{
            fontSize: 10,
            color: 'var(--color-text-dim)',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '2px 5px',
            opacity: 0.5,
            transition: 'opacity 0.15s',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.opacity = '1' }}
          onMouseLeave={(e) => { e.currentTarget.style.opacity = '0.5' }}
        >
          {t.habitCard_skip}
        </button>
      )}
    </motion.div>
  )
}

// ── 面板区块 ──────────────────────────────────────────────────────────
function PanelSection({
  title,
  count,
  action,
  children,
}: {
  title: string
  count?: number
  action?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text)', letterSpacing: '0.03em' }}>
          {title}
        </span>
        {count !== undefined && count > 0 && (
          <span
            style={{
              fontSize: 11,
              color: 'var(--color-text-dim)',
              background: 'var(--color-surface-hover)',
              padding: '1px 6px',
              borderRadius: 'var(--radius-full)',
            }}
          >
            {count}
          </span>
        )}
        <div style={{ flex: 1 }} />
        {action}
      </div>
      {children}
    </div>
  )
}

// ── 统计格子 ──────────────────────────────────────────────────────────
function StatCell({
  label,
  value,
  unit,
  accent,
  raw,
}: {
  label: string
  value: number | string
  unit: string
  accent?: boolean
  raw?: boolean
}) {
  const display = raw ? value : (typeof value === 'number' ? value.toLocaleString() : value)
  return (
    <div
      style={{
        padding: '10px 12px',
        background: 'var(--color-surface)',
        borderRadius: 'var(--radius-md)',
        border: '1px solid var(--color-border)',
      }}
    >
      <div style={{ fontSize: 10, color: 'var(--color-text-dim)', marginBottom: 4 }}>{label}</div>
      <div
        style={{
          fontSize: 18,
          fontWeight: 700,
          fontFamily: 'var(--font-num)',
          color: accent ? 'var(--color-xp)' : 'var(--color-text)',
          lineHeight: 1,
        }}
      >
        {display}
        {unit && (
          <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--color-text-dim)', marginLeft: 2 }}>
            {unit}
          </span>
        )}
      </div>
    </div>
  )
}

function EmptyHint({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ fontSize: 12, color: 'var(--color-text-dim)', textAlign: 'center', padding: '16px 0', margin: 0 }}>
      {children}
    </p>
  )
}

const addBtnStyle: React.CSSProperties = {
  fontSize: 11,
  padding: '3px 10px',
  borderRadius: 'var(--radius-sm)',
  border: '1px solid var(--color-border)',
  background: 'transparent',
  color: 'var(--color-text-dim)',
  cursor: 'pointer',
  transition: 'all 0.15s',
  whiteSpace: 'nowrap',
}

const toggleBtnStyle: React.CSSProperties = {
  marginTop: 6,
  fontSize: 11,
  padding: '3px 0',
  border: 'none',
  background: 'none',
  color: 'var(--color-accent)',
  cursor: 'pointer',
  textAlign: 'left',
}
