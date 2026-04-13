import React, { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { Area } from '@/types/area'
import { AREA_TEMPLATES } from '@/types/area'
import type { ProsperityInfo } from '@/engines/prosperityEngine'
import type { Task } from '@/types/task'
import type { Habit } from '@/types/habit'
import { useTaskStore } from '@/stores/taskStore'
import { useHabitStore } from '@/stores/habitStore'
import { useCharacterStore } from '@/stores/characterStore'
import { useGrowthEventStore } from '@/stores/growthEventStore'
import { useDecorationStore } from '@/stores/decorationStore'
import { calculateTaskXP } from '@/engines/xpEngine'
import { useFeedback } from '@/components/feedback/FeedbackContext'
import { useToast } from '@/components/feedback/Toast'
import { TaskDrawer } from '@/components/tasks/TaskDrawer'
import { HabitDrawer } from '@/components/dashboard/HabitDrawer'
import { HabitManageModal } from '@/components/dashboard/HabitManageModal'
import { DecoShop } from './DecoShop'
import { ArchiveSpace } from './ArchiveSpace'
import { ALL_DECORATIONS } from '@/types/decoration'
import { isOverdue, formatRelativeDate } from '@/utils/time'
import { useT } from '@/i18n'

interface InteriorSpaceProps {
  area: Area
  prosperity: ProsperityInfo
  onExit: () => void
}

function delay(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms))
}

export function InteriorSpace({ area, prosperity, onExit }: InteriorSpaceProps) {
  const t = useT()
  const isMilestone = area.category === '_milestone'

  if (isMilestone) {
    return <ArchiveSpace area={area} prosperity={prosperity} onExit={onExit} />
  }
  const emoji = area.templateId
    ? AREA_TEMPLATES[area.templateId].prosperityEmojis[prosperity.prosperityLevel - 1]
    : '🏗️'

  const [taskDrawerOpen, setTaskDrawerOpen] = useState(false)
  const [habitDrawerOpen, setHabitDrawerOpen] = useState(false)
  const [habitManageOpen, setHabitManageOpen] = useState(false)
  const [decoShopOpen, setDecoShopOpen] = useState(false)
  const [editHabit, setEditHabit] = useState<Habit | null>(null)
  const [showAllTasks, setShowAllTasks] = useState(false)
  const [showAllHabits, setShowAllHabits] = useState(false)

  const { tasks, completeTask, undoComplete, updateTask, startTask } = useTaskStore()
  const { habits, completeHabit, skipHabit } = useHabitStore()
  const { character, gainXPAndOre, recordActivity, revokeXP } = useCharacterStore()
  const { addEvent, removeEvent } = useGrowthEventStore()
  const { getOwned } = useDecorationStore()
  const { triggerFeedback } = useFeedback()
  const { showToast } = useToast()

  // ── 区域数据 ──────────────────────────────────────────────────────
  const areaTasks = tasks.filter((t) => !t.deletedAt && !t.isHidden && t.category === area.category)

  const activeTasks = areaTasks.filter((t) => t.status === 'doing')
  const todoTasks = areaTasks.filter((t) => t.status === 'todo')
  const doneTasks = areaTasks.filter((t) => t.status === 'done')

  const visibleTasks = showAllTasks
    ? [...activeTasks, ...todoTasks, ...doneTasks]
    : [...activeTasks, ...todoTasks].slice(0, 6)

  const areaHabits = habits.filter((h) => h.status !== 'archived' && !h.parentId && h.category === area.category)

  const todayHabits = areaHabits.filter((h) => h.status === 'active')
  const completedHabits = habits.filter((h) => h.status === 'completed_today' && !h.parentId && h.category === area.category)

  const visibleHabits = showAllHabits ? areaHabits.filter((h) => h.status !== 'archived') : todayHabits

  // ── 任务完成 ──────────────────────────────────────────────────────
  const handleCompleteTask = useCallback(async (task: Task) => {
    if (task.status === 'done') return
    const completed = completeTask(task.id)
    if (!completed) return

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

    triggerFeedback({ xp, ore, leveledUp, oldLevel, newLevel, oldStreakDays: oldStreak, newStreakDays: newStreak, prestigeUnlocked })
    await delay(50)
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
  }, [completeTask, updateTask, gainXPAndOre, recordActivity, addEvent, triggerFeedback, showToast, undoComplete, revokeXP, removeEvent, character.streakDays])

  // ── 习惯完成 ──────────────────────────────────────────────────────
  function handleCompleteHabit(habit: Habit) {
    const result = completeHabit(habit.id)
    if (!result) return

    if (result.partial) {
      const current = (habit.currentCycleCount ?? 0) + 1
      const target = habit.targetCount ?? 1
      showToast(t.interior_habitPartial(habit.title, current, target))
      return
    }

    const { leveledUp, oldLevel, newLevel, prestigeUnlocked } = gainXPAndOre(result.xp, result.ore)
    const { oldStreak, newStreak } = recordActivity()
    addEvent({
      type: 'habit_complete',
      title: t.habitCard_eventTitle(habit.title),
      details: { xpGained: result.xp, oreGained: result.ore, consecutiveCount: result.newStreak, categoryName: habit.category },
      isMilestone: false,
    })
    triggerFeedback({ xp: result.xp, ore: result.ore, leveledUp, oldLevel, newLevel, oldStreakDays: oldStreak, newStreakDays: newStreak, prestigeUnlocked })
    showToast(t.habitCard_toastComplete(habit.title, result.newStreak))
  }

  function handleSkipHabit(habit: Habit) {
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

  // ── 已拥有装饰 ───────────────────────────────────────────────────
  const ownedDecoIds = getOwned(area.id)
  const ownedDecos = ALL_DECORATIONS.filter(
    (d) => d.templateId === area.templateId && ownedDecoIds.includes(d.id)
  )

  // ── 右面板统计 ────────────────────────────────────────────────────
  const totalXP = prosperity.totalSkillXP
  const completedCount = doneTasks.length
  const totalMinutes = areaTasks.filter((t) => t.status === 'done').reduce((s, t) => s + (t.actualMinutes ?? 0), 0)
  const hours = Math.floor(totalMinutes / 60)
  const mins = totalMinutes % 60

  const progressPercent = Math.round(prosperity.subLevelFraction * 100)

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
        <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--color-text)' }}>{area.name}</span>
        <span
          style={{
            fontSize: 11,
            color: 'var(--color-accent)',
            fontWeight: 500,
            background: 'color-mix(in srgb, var(--color-accent) 12%, transparent)',
            padding: '2px 8px',
            borderRadius: 'var(--radius-full)',
          }}
        >
          {prosperity.prosperityName}
        </span>

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
                  count={activeTasks.length + todoTasks.length}
                  action={
                    <button onClick={() => setTaskDrawerOpen(true)} style={addBtnStyle}>
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
                          />
                        ))}
                      </AnimatePresence>
                    </div>
                  )}
                  {/* 展开/收起 */}
                  {(activeTasks.length + todoTasks.length > 6 || doneTasks.length > 0) && (
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

            {/* ─ 技能进度 ─ */}
            <PanelSection title={t.interior_panelSkills}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 8 }}>
                <span style={{ fontSize: 22, fontWeight: 700, color: 'var(--color-text)', fontFamily: 'var(--font-num)' }}>
                  Lv.{prosperity.skillLevel}
                </span>
                <span style={{ fontSize: 12, color: 'var(--color-text-dim)' }}>
                  {prosperity.subLevelCurrent} / {prosperity.subLevelTotal} XP
                </span>
              </div>
              <div style={{ position: 'relative', height: 6, borderRadius: 9999, background: 'var(--color-border)', overflow: 'hidden' }}>
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${progressPercent}%` }}
                  transition={{ duration: 0.8, ease: 'easeOut', delay: 0.2 }}
                  style={{
                    position: 'absolute',
                    inset: '0 auto 0 0',
                    borderRadius: 9999,
                    background: 'var(--color-accent)',
                  }}
                />
              </div>
              <div style={{ marginTop: 4, display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 10, color: 'var(--color-text-dim)' }}>
                  {t.interior_prosperityLabel}{prosperity.prosperityName}
                </span>
                <span style={{ fontSize: 10, color: 'var(--color-text-dim)', fontFamily: 'var(--font-num)' }}>
                  {progressPercent}%
                </span>
              </div>
            </PanelSection>

            {/* ─ 统计四格 ─ */}
            <PanelSection title={t.interior_panelStats}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <StatCell label={t.interior_statXP} value={totalXP} unit="" accent />
                <StatCell label={t.interior_statTasks} value={completedCount} unit={t.milestone_unitTasks} />
                <StatCell
                  label={t.interior_statTime}
                  value={hours > 0 ? `${hours}h ${mins}m` : `${mins}m`}
                  unit=""
                  raw
                />
                <StatCell label={t.interior_statProsperity} value={prosperity.prosperityLevel} unit="/6" />
              </div>
            </PanelSection>

            {/* ─ 矿石收藏 ─ */}
            <PanelSection title={t.interior_panelFavorites}>
              {/* 矿石 + 商店按钮 */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '10px 12px',
                  background: 'var(--color-surface)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--color-border)',
                }}
              >
                <span style={{ fontSize: 18 }}>⛏️</span>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--color-text-dim)' }}>{t.interior_oreBalance}</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--color-text)', fontFamily: 'var(--font-num)' }}>
                    {character.ore.toLocaleString()}
                  </div>
                </div>
                <div style={{ flex: 1 }} />
                {area.templateId && (
                  <button
                    onClick={() => setDecoShopOpen(true)}
                    style={{
                      padding: '5px 12px',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--color-secondary)',
                      background: 'color-mix(in srgb, var(--color-secondary) 10%, transparent)',
                      color: 'var(--color-secondary)',
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: 'pointer',
                      transition: 'all 0.15s',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'color-mix(in srgb, var(--color-secondary) 18%, transparent)'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'color-mix(in srgb, var(--color-secondary) 10%, transparent)'
                    }}
                  >
                    {t.interior_decoShopBtn}
                  </button>
                )}
              </div>

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
        onClose={() => setTaskDrawerOpen(false)}
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

      {/* ── 装饰商店 ────────────────────────────────────────────── */}
      <AnimatePresence>
        {decoShopOpen && (
          <DecoShop
            area={area}
            prosperity={prosperity}
            onClose={() => setDecoShopOpen(false)}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

// ── 任务行 ────────────────────────────────────────────────────────────
function InteriorTaskRow({
  task,
  onComplete,
  onStart,
}: {
  task: Task
  onComplete: () => void
  onStart: () => void
}) {
  const t = useT()
  const isDone = task.status === 'done'
  const isDoing = task.status === 'doing'
  const isOv = isOverdue(task.dueDate) && !isDone

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: isDone ? 0.5 : 1, y: 0 }}
      exit={{ opacity: 0, height: 0, marginBottom: 0 }}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '7px 10px',
        background: isDoing
          ? 'color-mix(in srgb, var(--color-accent) 6%, var(--color-surface))'
          : 'var(--color-surface)',
        borderRadius: 'var(--radius-md)',
        border: `1px solid ${isDoing ? 'color-mix(in srgb, var(--color-accent) 25%, transparent)' : 'var(--color-border)'}`,
      }}
    >
      {/* 完成按钮 */}
      <button
        onClick={onComplete}
        disabled={isDone}
        title={isDone ? t.interior_done : t.interior_markDone}
        style={{
          width: 22,
          height: 22,
          borderRadius: 'var(--radius-sm)',
          border: `1.5px solid ${isDone ? 'var(--color-success)' : 'var(--color-accent)'}`,
          background: isDone
            ? 'color-mix(in srgb, var(--color-success) 20%, transparent)'
            : 'color-mix(in srgb, var(--color-accent) 10%, transparent)',
          color: isDone ? 'var(--color-success)' : 'var(--color-accent)',
          cursor: isDone ? 'default' : 'pointer',
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
      <div style={{ flex: 1, minWidth: 0 }}>
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

      {/* 进行中状态 / 开始按钮 */}
      {!isDone && (
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
        disabled={isDone}
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
          🔥{habit.consecutiveCount}
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
