import React, { useState } from 'react'
import { useTaskStore } from '@/stores/taskStore'
import { useCharacterStore } from '@/stores/characterStore'
import { useHabitStore } from '@/stores/habitStore'
import { getGreetingKey } from '@/utils/time'
import { useT } from '@/i18n'
import { TaskItem } from '@/components/tasks/TaskItem'
import { QuickInput } from '@/components/tasks/QuickInput'
import { TaskDrawer } from '@/components/tasks/TaskDrawer'
import { CharacterMiniCard } from './CharacterMiniCard'
import { HabitCard } from './HabitCard'
import { HabitDrawer } from './HabitDrawer'
import { HabitManageModal } from './HabitManageModal'
import { Heatmap } from './Heatmap'
import { AnimatePresence } from 'framer-motion'
import type { Habit } from '@/types/habit'
import type { Task } from '@/types/task'

type NavTab = 'dashboard' | 'tasks' | 'worldmap' | 'timeline' | 'milestone'

interface DashboardProps {
  onNavigate?: (tab: NavTab) => void
}

export function Dashboard({ onNavigate }: DashboardProps) {
  const { tasks, getTodayStats } = useTaskStore()
  const { character } = useCharacterStore()
  const { getTodayStats: getHabitStats } = useHabitStore()
  const t = useT()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editTask, setEditTask] = useState<Task | null>(null)
  const [habitDrawerOpen, setHabitDrawerOpen] = useState(false)
  const [editHabit, setEditHabit] = useState<Habit | null>(null)
  const [habitManageOpen, setHabitManageOpen] = useState(false)

  function openEditTask(task: Task) {
    setEditTask(task)
    setDrawerOpen(true)
  }

  const greetingKey = getGreetingKey()
  const greeting = greetingKey === 'morning' ? t.greeting_morning : greetingKey === 'afternoon' ? t.greeting_afternoon : t.greeting_evening
  const taskStats = getTodayStats()
  const habitStats = getHabitStats()

  const totalCompleted = taskStats.completedCount + habitStats.completed
  const totalXP = taskStats.totalXP + habitStats.totalXP

  const doingTasks = tasks.filter((t) => !t.deletedAt && t.status === 'doing')
  const todoTasks = tasks.filter((t) => !t.deletedAt && t.status === 'todo')
  const doneTasks = tasks.filter((t) => !t.deletedAt && t.status === 'done').slice(0, 8)

  return (
    <div
      style={{
        height: '100%',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--color-bg)',
      }}
    >
      {/* 问候语 */}
      <div style={{ padding: '16px 24px 12px', flexShrink: 0 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--color-text)', margin: 0 }}>
          {greeting}，<span style={{ color: 'var(--color-accent)' }}>{character.name}</span>
        </h1>
      </div>

      {/* 主体：两栏布局 */}
      <div
        style={{
          flex: 1,
          overflow: 'hidden',
          display: 'flex',
          gap: 16,
          padding: '0 24px 16px',
        }}
      >
        {/* 左栏：2/3 */}
        <div
          style={{
            flex: 2,
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
            overflow: 'hidden',
          }}
        >
          {/* 快速创建 */}
          <Card title={t.dash_quickAdd}>
            <QuickInput onOpenDrawer={() => setDrawerOpen(true)} />
          </Card>

          {/* 任务卡片 */}
          <Card
            title={t.dash_tasks}
            subtitle={t.dash_pendingCount(doingTasks.length + todoTasks.length)}
            style={{ flex: 1, overflow: 'hidden' }}
          >
            <div style={{ overflow: 'y-auto', flex: 1 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {/* 进行中 */}
                {doingTasks.length > 0 && (
                  <>
                    <SectionLabel label={t.dash_doing} color="var(--color-accent)" />
                    <AnimatePresence mode="popLayout">
                      {doingTasks.map((task) => <TaskItem key={task.id} task={task} compact onEdit={openEditTask} />)}
                    </AnimatePresence>
                  </>
                )}

                {/* 待办 */}
                {todoTasks.length > 0 && (
                  <>
                    {doingTasks.length > 0 && <div style={{ height: 4 }} />}
                    <SectionLabel label={t.dash_todo} />
                    <AnimatePresence mode="popLayout">
                      {todoTasks.slice(0, 10).map((task) => <TaskItem key={task.id} task={task} compact onEdit={openEditTask} />)}
                    </AnimatePresence>
                  </>
                )}

                {/* 已完成 */}
                {doneTasks.length > 0 && (
                  <>
                    <div style={{ height: 4, borderTop: '1px solid var(--color-border)', marginTop: 4 }} />
                    <SectionLabel label={t.dash_done} dim />
                    <AnimatePresence mode="popLayout">
                      {doneTasks.map((task) => <TaskItem key={task.id} task={task} compact onEdit={openEditTask} />)}
                    </AnimatePresence>
                  </>
                )}

                {doingTasks.length === 0 && todoTasks.length === 0 && doneTasks.length === 0 && (
                  <Empty>{t.dash_empty}</Empty>
                )}
              </div>
            </div>
          </Card>
        </div>

        {/* 右栏：1/3 */}
        <div
          style={{
            flex: 1,
            minWidth: 200,
            maxWidth: 260,
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
            overflow: 'hidden',
          }}
        >
          {/* 统计卡片 */}
          <Card>
            <div style={{ display: 'flex', justifyContent: 'space-around' }}>
              <BigStat label={t.dash_statDone} value={totalCompleted} unit={t.dash_unitCount} />
              <div style={{ width: 1, background: 'var(--color-border)' }} />
              <BigStat label={t.dash_statXP} value={totalXP} unit="xp" />
              <div style={{ width: 1, background: 'var(--color-border)' }} />
              <BigStat label={t.dash_statStreak} value={character.streakDays} unit={t.dash_unitDays} emoji="🔥" />
            </div>
          </Card>

          {/* 角色迷你卡 */}
          <CharacterMiniCard onClickMilestone={() => onNavigate?.('milestone')} />

          {/* 习惯卡 */}
          <Card
            title={t.dash_habits}
            action={
              <div style={{ display: 'flex', gap: 4 }}>
                <ActionBtn onClick={() => setHabitManageOpen(true)} title={t.dash_habitManage}>{t.dash_habitManage}</ActionBtn>
                <ActionBtn onClick={() => { setEditHabit(null); setHabitDrawerOpen(true) }} title={t.dash_addHabit} accent>＋</ActionBtn>
              </div>
            }
            style={{ overflow: 'hidden' }}
          >
            <HabitCard />
          </Card>

          {/* 成长趋势 */}
          <Card title={t.dash_growth} style={{ flex: 1, overflow: 'hidden' }}>
            <Heatmap />
          </Card>
        </div>
      </div>

      <TaskDrawer open={drawerOpen} onClose={() => { setDrawerOpen(false); setEditTask(null) }} editTask={editTask} />
      <HabitDrawer
        open={habitDrawerOpen}
        onClose={() => { setHabitDrawerOpen(false); setEditHabit(null) }}
        editHabit={editHabit}
      />
      <HabitManageModal
        open={habitManageOpen}
        onClose={() => setHabitManageOpen(false)}
        onEdit={(h) => { setEditHabit(h); setHabitDrawerOpen(true) }}
      />
    </div>
  )
}

// ─── 子组件 ───────────────────────────────────────────────────────────────────

function Card({
  title,
  subtitle,
  action,
  children,
  style,
}: {
  title?: string
  subtitle?: string
  action?: React.ReactNode
  children: React.ReactNode
  style?: React.CSSProperties
}) {
  return (
    <div
      style={{
        background: 'var(--color-surface)',
        borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--color-border)',
        padding: 'var(--spacing-lg)',
        boxShadow: 'var(--shadow-sm)',
        display: 'flex',
        flexDirection: 'column',
        ...style,
      }}
    >
      {title && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text)' }}>{title}</span>
          {action ?? (subtitle && <span style={{ fontSize: 12, color: 'var(--color-text-dim)' }}>{subtitle}</span>)}
        </div>
      )}
      {children}
    </div>
  )
}

function ActionBtn({
  children,
  onClick,
  title,
  accent,
}: {
  children: React.ReactNode
  onClick: () => void
  title?: string
  accent?: boolean
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        fontSize: 11,
        padding: '2px 8px',
        borderRadius: 'var(--radius-sm)',
        border: `1px solid ${accent ? 'var(--color-accent)' : 'var(--color-border)'}`,
        background: accent ? 'color-mix(in srgb, var(--color-accent) 10%, transparent)' : 'transparent',
        color: accent ? 'var(--color-accent)' : 'var(--color-text-dim)',
        cursor: 'pointer',
        transition: 'all 0.15s',
        fontWeight: accent ? 600 : 400,
      }}
    >
      {children}
    </button>
  )
}

function SectionLabel({ label, color, dim }: { label: string; color?: string; dim?: boolean }) {
  return (
    <div
      style={{
        fontSize: 11,
        fontWeight: 600,
        color: color ?? (dim ? 'var(--color-text-dim)' : 'var(--color-text)'),
        letterSpacing: '0.03em',
        marginBottom: 2,
      }}
    >
      {label}
    </div>
  )
}

function BigStat({ label, value, unit, emoji }: { label: string; value: number; unit: string; emoji?: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
      <div style={{ fontSize: 20, fontWeight: 800, fontFamily: 'var(--font-num)', color: 'var(--color-text)', lineHeight: 1 }}>
        {emoji && <span style={{ marginRight: 2 }}>{emoji}</span>}
        {value}
      </div>
      <div style={{ fontSize: 11, color: 'var(--color-text-dim)' }}>{label}</div>
    </div>
  )
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ textAlign: 'center', padding: '16px 0', fontSize: 12, color: 'var(--color-text-dim)' }}>
      {children}
    </div>
  )
}
