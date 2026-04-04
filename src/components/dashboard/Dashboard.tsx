import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import { useTaskStore } from '@/stores/taskStore'
import { useCharacterStore } from '@/stores/characterStore'
import { useHabitStore } from '@/stores/habitStore'
import {
  useDashboardStore,
  DEFAULT_LAYOUT,
  ALL_CARD_IDS,
  gridRect,
  snapPos,
  snapSpan,
  gridHeight,
  COLS,
  type CardId,
  type CardLayout,
} from '@/stores/dashboardStore'
import { getGreetingKey } from '@/utils/time'
import { sortTasksInGroup } from '@/utils/task'
import { useT } from '@/i18n'
import { TaskItem } from '@/components/tasks/TaskItem'
import { QuickInput } from '@/components/tasks/QuickInput'
import { TaskDrawer } from '@/components/tasks/TaskDrawer'
import { CharacterMiniCard } from './CharacterMiniCard'
import { HabitCard } from './HabitCard'
import { HabitDrawer } from './HabitDrawer'
import { HabitManageModal } from './HabitManageModal'
import { Heatmap } from './Heatmap'
import { AnimatePresence, Reorder } from 'framer-motion'
import type { Habit } from '@/types/habit'
import type { Task } from '@/types/task'

type NavTab = 'dashboard' | 'tasks' | 'worldmap' | 'timeline' | 'milestone'

interface DashboardProps {
  onNavigate?: (tab: NavTab) => void
}

export function Dashboard({ onNavigate }: DashboardProps) {
  const { tasks, getTodayStats, reorderTasks } = useTaskStore()
  const { character } = useCharacterStore()
  const { getTodayStats: getHabitStats } = useHabitStore()
  const t = useT()
  const { layout, visibleCards, updateCard, removeCard, addCard, resetLayout } = useDashboardStore()
  const [editMode, setEditMode] = useState(false)
  const [cardPickerOpen, setCardPickerOpen] = useState(false)

  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editTask, setEditTask] = useState<Task | null>(null)
  const [habitDrawerOpen, setHabitDrawerOpen] = useState(false)
  const [editHabit, setEditHabit] = useState<Habit | null>(null)
  const [habitManageOpen, setHabitManageOpen] = useState(false)

  const [localDoing, setLocalDoing] = useState<Task[]>([])
  const [localTodo, setLocalTodo] = useState<Task[]>([])
  const isDraggingTaskRef = useRef(false)

  const containerRef = useRef<HTMLDivElement>(null)
  const [cw, setCw] = useState(800)
  useEffect(() => {
    if (!containerRef.current) return
    const ro = new ResizeObserver(([e]) => setCw(e.contentRect.width))
    ro.observe(containerRef.current)
    return () => ro.disconnect()
  }, [])

  function openEditTask(task: Task) {
    setEditTask(task)
    setDrawerOpen(true)
  }

  const greetingKey = getGreetingKey()
  const greeting =
    greetingKey === 'morning' ? t.greeting_morning : greetingKey === 'afternoon' ? t.greeting_afternoon : t.greeting_evening
  const taskStats = getTodayStats()
  const habitStats = getHabitStats()
  const totalCompleted = taskStats.completedCount + habitStats.completed
  const totalXP = taskStats.totalXP + habitStats.totalXP

  const doingTasks = useMemo(
    () => sortTasksInGroup(tasks.filter((t) => !t.deletedAt && !t.parentId && t.status === 'doing')),
    [tasks]
  )
  const todoTasks = useMemo(
    () => sortTasksInGroup(tasks.filter((t) => !t.deletedAt && !t.parentId && t.status === 'todo')),
    [tasks]
  )
  const doneTasks = useMemo(
    () => tasks.filter((t) => !t.deletedAt && !t.parentId && t.status === 'done').slice(0, 8),
    [tasks]
  )

  // sync drag-sort local state from store
  useEffect(() => {
    if (!isDraggingTaskRef.current) {
      setLocalDoing(doingTasks)
      setLocalTodo(todoTasks)
    }
  }, [doingTasks, todoTasks])

  const handleDoingReorder = useCallback((newOrder: Task[]) => {
    isDraggingTaskRef.current = true
    setLocalDoing(newOrder)
  }, [])

  const handleTodoReorder = useCallback((newOrder: Task[]) => {
    isDraggingTaskRef.current = true
    setLocalTodo(newOrder)
  }, [])

  const handleTaskDragEnd = useCallback(() => {
    isDraggingTaskRef.current = false
    reorderTasks([...localDoing, ...localTodo].map((t) => t.id))
  }, [localDoing, localTodo, reorderTasks])

  function getCard(id: CardId) {
    return layout.find((c) => c.id === id) ?? DEFAULT_LAYOUT.find((c) => c.id === id)!
  }

  const visibleLayout = useMemo(() => layout.filter((c) => visibleCards.includes(c.id)), [layout, visibleCards])
  const gh = useMemo(() => gridHeight(visibleLayout.length ? visibleLayout : DEFAULT_LAYOUT), [visibleLayout])
  const hiddenCards = useMemo(() => ALL_CARD_IDS.filter((id) => !visibleCards.includes(id)), [visibleCards])

  return (
    <div style={{ height: '100%', overflow: 'hidden', display: 'flex', flexDirection: 'column', background: 'var(--color-bg)' }}>
      {/* 问候语 + 重置 */}
      <div style={{ padding: '16px 24px 12px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--color-text)', margin: 0 }}>
          {greeting}，<span style={{ color: 'var(--color-accent)' }}>{character.name}</span>
        </h1>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {editMode && (
            <>
              {hiddenCards.length > 0 && (
                <button
                  onClick={() => setCardPickerOpen(true)}
                  style={{ fontSize: 11, color: 'var(--color-accent)', background: 'color-mix(in srgb, var(--color-accent) 10%, transparent)', border: '1px solid var(--color-accent)', borderRadius: 'var(--radius-sm)', padding: '3px 8px', cursor: 'pointer', fontWeight: 600 }}
                >
                  {t.dash_addCard}
                </button>
              )}
              <button
                onClick={() => { resetLayout(); setEditMode(false) }}
                style={{ fontSize: 11, color: 'var(--color-text-dim)', background: 'none', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', padding: '3px 8px', cursor: 'pointer' }}
              >
                {t.dash_resetLayout}
              </button>
            </>
          )}
          <button
            onClick={() => setEditMode((v) => !v)}
            style={{
              fontSize: 11, padding: '3px 10px', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontWeight: 600,
              border: `1px solid ${editMode ? 'var(--color-accent)' : 'var(--color-border)'}`,
              background: editMode ? 'color-mix(in srgb, var(--color-accent) 12%, transparent)' : 'transparent',
              color: editMode ? 'var(--color-accent)' : 'var(--color-text-dim)',
              transition: 'all 0.15s',
            }}
          >
            {editMode ? t.dash_doneEditing : t.dash_editLayout}
          </button>
        </div>
      </div>

      {/* 网格 */}
      <div style={{ flex: 1, overflow: 'auto', padding: '0 24px 16px' }}>
        <div ref={containerRef} style={{ position: 'relative', height: gh, minHeight: gh }}>

          {visibleCards.includes('quickAdd') && (
            <GridCard card={getCard('quickAdd')} cw={cw} containerRef={containerRef} onUpdate={(p) => updateCard('quickAdd', p)} locked={!editMode} onRemove={editMode ? () => removeCard('quickAdd') : undefined} title={t.dash_quickAdd}>
              <QuickInput onOpenDrawer={() => setDrawerOpen(true)} />
            </GridCard>
          )}

          {visibleCards.includes('stats') && (
            <GridCard card={getCard('stats')} cw={cw} containerRef={containerRef} onUpdate={(p) => updateCard('stats', p)} locked={!editMode} onRemove={editMode ? () => removeCard('stats') : undefined} title={t.dash_stats}>
              <div style={{ display: 'flex', justifyContent: 'space-around', padding: '4px 0' }}>
                <BigStat label={t.dash_statDone} value={totalCompleted} unit={t.dash_unitCount} />
                <div style={{ width: 1, background: 'var(--color-border)' }} />
                <BigStat label={t.dash_statXP} value={totalXP} unit="xp" />
                <div style={{ width: 1, background: 'var(--color-border)' }} />
                <BigStat label={t.dash_statStreak} value={character.streakDays} unit={t.dash_unitDays} emoji="🔥" />
              </div>
            </GridCard>
          )}

          {visibleCards.includes('tasks') && (
            <GridCard card={getCard('tasks')} cw={cw} containerRef={containerRef} onUpdate={(p) => updateCard('tasks', p)} locked={!editMode} onRemove={editMode ? () => removeCard('tasks') : undefined} resizable title={t.dash_tasks}
              titleExtra={<span style={{ fontSize: 12, color: 'var(--color-text-dim)' }}>{t.dash_pendingCount(doingTasks.length + todoTasks.length)}</span>}
            >
              <div style={{ overflowY: 'auto', height: '100%', scrollbarWidth: 'thin', scrollbarColor: 'var(--color-border) transparent' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {localDoing.length > 0 && (
                    <>
                      <SectionLabel label={t.dash_doing} color="var(--color-accent)" />
                      <Reorder.Group axis="y" values={localDoing} onReorder={handleDoingReorder} style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                        <AnimatePresence mode="popLayout">
                          {localDoing.map((task) => (
                            <Reorder.Item key={task.id} value={task} onDragEnd={handleTaskDragEnd} style={{ listStyle: 'none' }}>
                              <TaskItem task={task} compact onEdit={openEditTask} />
                            </Reorder.Item>
                          ))}
                        </AnimatePresence>
                      </Reorder.Group>
                    </>
                  )}
                  {localTodo.length > 0 && (
                    <>
                      {localDoing.length > 0 && <div style={{ height: 4 }} />}
                      <SectionLabel label={t.dash_todo} />
                      <Reorder.Group axis="y" values={localTodo} onReorder={handleTodoReorder} style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                        <AnimatePresence mode="popLayout">
                          {localTodo.slice(0, 10).map((task) => (
                            <Reorder.Item key={task.id} value={task} onDragEnd={handleTaskDragEnd} style={{ listStyle: 'none' }}>
                              <TaskItem task={task} compact onEdit={openEditTask} />
                            </Reorder.Item>
                          ))}
                        </AnimatePresence>
                      </Reorder.Group>
                    </>
                  )}
                  {doneTasks.length > 0 && (
                    <>
                      <div style={{ height: 4, borderTop: '1px solid var(--color-border)', marginTop: 4 }} />
                      <SectionLabel label={t.dash_done} dim />
                      <AnimatePresence mode="popLayout">
                        {doneTasks.map((task) => <TaskItem key={task.id} task={task} compact onEdit={openEditTask} />)}
                      </AnimatePresence>
                    </>
                  )}
                  {localDoing.length === 0 && localTodo.length === 0 && doneTasks.length === 0 && (
                    <Empty>{t.dash_empty}</Empty>
                  )}
                </div>
              </div>
            </GridCard>
          )}

          {visibleCards.includes('character') && (
            <GridCard card={getCard('character')} cw={cw} containerRef={containerRef} onUpdate={(p) => updateCard('character', p)} locked={!editMode} onRemove={editMode ? () => removeCard('character') : undefined} noShell>
              <CharacterMiniCard onClickMilestone={() => onNavigate?.('milestone')} />
            </GridCard>
          )}

          {visibleCards.includes('habits') && (
            <GridCard card={getCard('habits')} cw={cw} containerRef={containerRef} onUpdate={(p) => updateCard('habits', p)} locked={!editMode} onRemove={editMode ? () => removeCard('habits') : undefined} resizable title={t.dash_habits}
              titleExtra={
                <div style={{ display: 'flex', gap: 4 }}>
                  <ActionBtn onClick={() => setHabitManageOpen(true)} title={t.dash_habitManage}>{t.dash_habitManage}</ActionBtn>
                  <ActionBtn onClick={() => { setEditHabit(null); setHabitDrawerOpen(true) }} title={t.dash_addHabit} accent>＋</ActionBtn>
                </div>
              }
            >
              <div style={{ overflowY: 'auto', height: '100%', scrollbarWidth: 'thin', scrollbarColor: 'var(--color-border) transparent' }}>
                <HabitCard onEdit={(h) => { setEditHabit(h); setHabitDrawerOpen(true) }} />
              </div>
            </GridCard>
          )}

          {visibleCards.includes('growth') && (
            <GridCard card={getCard('growth')} cw={cw} containerRef={containerRef} onUpdate={(p) => updateCard('growth', p)} locked={!editMode} onRemove={editMode ? () => removeCard('growth') : undefined} title={t.dash_growth}>
              <Heatmap />
            </GridCard>
          )}

        </div>
      </div>

      <TaskDrawer open={drawerOpen} onClose={() => { setDrawerOpen(false); setEditTask(null) }} editTask={editTask} />
      <HabitDrawer open={habitDrawerOpen} onClose={() => { setHabitDrawerOpen(false); setEditHabit(null) }} editHabit={editHabit} />
      <HabitManageModal open={habitManageOpen} onClose={() => setHabitManageOpen(false)} onEdit={(h) => { setEditHabit(h); setHabitDrawerOpen(true) }} />
      <CardPickerModal open={cardPickerOpen} onClose={() => setCardPickerOpen(false)} hiddenCards={hiddenCards} onAdd={(id) => { addCard(id); setCardPickerOpen(false) }} />
    </div>
  )
}

// ─── GridCard: draggable + resizable card with live grid snap ─────────────────

interface GridCardProps {
  card: CardLayout
  cw: number
  containerRef: React.RefObject<HTMLDivElement | null>
  onUpdate: (patch: Partial<Omit<CardLayout, 'id'>>) => void
  onRemove?: () => void
  resizable?: boolean
  noShell?: boolean
  /** Disable drag and resize entirely */
  locked?: boolean
  title?: string
  titleExtra?: React.ReactNode
  children: React.ReactNode
}

function GridCard({ card, cw, containerRef, onUpdate, onRemove, resizable, noShell, locked, title, titleExtra, children }: GridCardProps) {
  const [hovered, setHovered] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [isResizing, setIsResizing] = useState(false)
  const [resizeDelta, setResizeDelta] = useState({ dw: 0, dh: 0 })
  const lastSnap = useRef({ col: card.col, row: card.row })

  // ── Drag (live snap) ──────────────────────────────────────────────────────
  const startDrag = useCallback((e: React.PointerEvent) => {
    if (locked) return
    e.preventDefault()
    const container = containerRef.current
    if (!container) return

    const cRect = container.getBoundingClientRect()
    const cardRect = gridRect(card, cw)
    const offsetX = e.clientX - cRect.left - cardRect.x
    const offsetY = e.clientY - cRect.top - cardRect.y
    lastSnap.current = { col: card.col, row: card.row }
    setIsDragging(true)

    function onMove(ev: PointerEvent) {
      const cr = container!.getBoundingClientRect()
      const mx = ev.clientX - cr.left - offsetX
      const my = ev.clientY - cr.top - offsetY
      const { col, row } = snapPos(mx, my, cw)
      const clampedCol = Math.min(col, COLS - card.colSpan)
      if (clampedCol !== lastSnap.current.col || row !== lastSnap.current.row) {
        lastSnap.current = { col: clampedCol, row }
        onUpdate({ col: clampedCol, row })
      }
    }

    function onUp() {
      setIsDragging(false)
      window.removeEventListener('pointermove', onMove)
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp, { once: true })
  }, [card, cw, containerRef, onUpdate, locked])

  // ── Resize (live preview) ─────────────────────────────────────────────────
  const startResize = useCallback((e: React.PointerEvent) => {
    e.stopPropagation()
    e.preventDefault()
    const sx = e.clientX, sy = e.clientY
    setIsResizing(true)

    function onMove(ev: PointerEvent) {
      setResizeDelta({ dw: ev.clientX - sx, dh: ev.clientY - sy })
    }

    function onUp(ev: PointerEvent) {
      const { colSpan, rowSpan } = snapSpan(ev.clientX - sx, ev.clientY - sy, card, cw)
      onUpdate({ colSpan, rowSpan })
      setResizeDelta({ dw: 0, dh: 0 })
      setIsResizing(false)
      window.removeEventListener('pointermove', onMove)
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp, { once: true })
  }, [card, cw, onUpdate])

  // ── Render ────────────────────────────────────────────────────────────────
  const rect = gridRect(card, cw)
  const isActive = isDragging || isResizing
  const displayW = isResizing ? Math.max(80, rect.w + resizeDelta.dw) : rect.w
  const displayH = isResizing ? Math.max(60, rect.h + resizeDelta.dh) : rect.h

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: 'absolute',
        left: rect.x,
        top: rect.y,
        width: displayW,
        height: displayH,
        zIndex: isActive ? 100 : 1,
        transition: isActive ? 'none' : 'left 0.15s ease, top 0.15s ease, width 0.15s ease, height 0.15s ease',
      }}
    >
      {noShell ? (
        <div style={{ position: 'relative', width: '100%', height: '100%' }}>
          <div
            onPointerDown={startDrag}
            style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 24, cursor: 'grab', zIndex: 2 }}
          />
          {onRemove && hovered && (
            <button
              onClick={onRemove}
              title="移除卡片"
              style={{
                position: 'absolute', top: 4, right: 4, zIndex: 10,
                width: 20, height: 20, borderRadius: '50%',
                border: '1px solid var(--color-border)',
                background: 'var(--color-surface)', color: 'var(--color-text-dim)',
                cursor: 'pointer', fontSize: 12, lineHeight: 1,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                opacity: 0.7, transition: 'opacity 0.15s',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.color = 'var(--color-danger)' }}
              onMouseLeave={(e) => { e.currentTarget.style.opacity = '0.7'; e.currentTarget.style.color = 'var(--color-text-dim)' }}
            >×</button>
          )}
          {children}
        </div>
      ) : (
        <div
          style={{
            width: '100%',
            height: '100%',
            background: 'var(--color-surface)',
            borderRadius: 'var(--radius-lg)',
            border: `1px ${!locked && !isActive ? 'dashed' : 'solid'} ${isActive ? 'var(--color-accent)' : 'var(--color-border)'}`,
            boxShadow: isActive ? '0 8px 24px rgba(0,0,0,0.12)' : 'var(--shadow-sm)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            transition: 'border-color 0.15s, box-shadow 0.15s',
            position: 'relative',
          }}
        >
          {/* Title bar (drag handle) */}
          {title !== undefined ? (
            <div
              onPointerDown={locked ? undefined : startDrag}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '10px 16px 0', flexShrink: 0, cursor: locked ? 'default' : 'grab', userSelect: 'none',
              }}
            >
              <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text)' }}>{title}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }} onPointerDown={(e) => e.stopPropagation()}>
                {titleExtra}
                {onRemove && hovered && (
                  <button
                    onClick={onRemove}
                    title="移除卡片"
                    style={{
                      width: 18, height: 18, borderRadius: '50%',
                      border: '1px solid var(--color-border)',
                      background: 'transparent', color: 'var(--color-text-dim)',
                      cursor: 'pointer', fontSize: 12, lineHeight: 1,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      opacity: 0.6, transition: 'opacity 0.15s, color 0.15s', flexShrink: 0,
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.color = 'var(--color-danger)' }}
                    onMouseLeave={(e) => { e.currentTarget.style.opacity = '0.6'; e.currentTarget.style.color = 'var(--color-text-dim)' }}
                  >×</button>
                )}
              </div>
            </div>
          ) : (
            <>
              <div
                onPointerDown={startDrag}
                style={{ position: 'absolute', top: 0, left: 0, right: resizable ? 20 : 0, height: 20, cursor: 'grab', zIndex: 1 }}
              />
              {onRemove && hovered && (
                <button
                  onClick={onRemove}
                  title="移除卡片"
                  style={{
                    position: 'absolute', top: 4, right: 4, zIndex: 10,
                    width: 18, height: 18, borderRadius: '50%',
                    border: '1px solid var(--color-border)',
                    background: 'var(--color-surface)', color: 'var(--color-text-dim)',
                    cursor: 'pointer', fontSize: 12, lineHeight: 1,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    opacity: 0.6, transition: 'opacity 0.15s, color 0.15s',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.color = 'var(--color-danger)' }}
                  onMouseLeave={(e) => { e.currentTarget.style.opacity = '0.6'; e.currentTarget.style.color = 'var(--color-text-dim)' }}
                >×</button>
              )}
            </>
          )}

          {/* Content */}
          <div style={{ flex: 1, padding: '10px 16px', overflow: 'hidden', minHeight: 0 }}>
            {children}
          </div>

          {/* Resize handle */}
          {resizable && !locked && (
            <div
              onPointerDown={startResize}
              style={{
                position: 'absolute', right: 0, bottom: 0, width: 18, height: 18,
                cursor: 'se-resize', display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'var(--color-text-dim)', opacity: 0.35, zIndex: 2,
              }}
              onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.8' }}
              onMouseLeave={(e) => { e.currentTarget.style.opacity = '0.35' }}
            >
              <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
                <circle cx="3" cy="7" r="1.2" />
                <circle cx="7" cy="3" r="1.2" />
                <circle cx="7" cy="7" r="1.2" />
              </svg>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── 子组件 ───────────────────────────────────────────────────────────────────

function ActionBtn({ children, onClick, title, accent }: { children: React.ReactNode; onClick: () => void; title?: string; accent?: boolean }) {
  return (
    <button
      onClick={onClick} title={title}
      style={{
        fontSize: 11, padding: '2px 8px', borderRadius: 'var(--radius-sm)',
        border: `1px solid ${accent ? 'var(--color-accent)' : 'var(--color-border)'}`,
        background: accent ? 'color-mix(in srgb, var(--color-accent) 10%, transparent)' : 'transparent',
        color: accent ? 'var(--color-accent)' : 'var(--color-text-dim)',
        cursor: 'pointer', transition: 'all 0.15s', fontWeight: accent ? 600 : 400,
      }}
    >
      {children}
    </button>
  )
}

function SectionLabel({ label, color, dim }: { label: string; color?: string; dim?: boolean }) {
  return (
    <div style={{ fontSize: 11, fontWeight: 600, color: color ?? (dim ? 'var(--color-text-dim)' : 'var(--color-text)'), letterSpacing: '0.03em', marginBottom: 2 }}>
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

// ─── CardPickerModal ──────────────────────────────────────────────────────────

function CardPickerModal({ open, onClose, hiddenCards, onAdd }: {
  open: boolean
  onClose: () => void
  hiddenCards: CardId[]
  onAdd: (id: CardId) => void
}) {
  const t = useT()

  const CARD_LABELS: Record<CardId, string> = {
    quickAdd: t.dash_quickAdd,
    stats: t.dash_stats,
    tasks: t.dash_tasks,
    character: t.dash_character,
    habits: t.dash_habits,
    growth: t.dash_growth,
  }

  if (!open) return null

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.35)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--color-surface)',
          borderRadius: 'var(--radius-xl)',
          border: '1px solid var(--color-border)',
          padding: '20px 24px',
          minWidth: 280,
          maxWidth: 400,
          boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-text)' }}>{t.dash_cardPickerTitle}</span>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-dim)', fontSize: 18, lineHeight: 1, padding: '0 4px' }}
          >×</button>
        </div>

        {hiddenCards.length === 0 ? (
          <p style={{ fontSize: 13, color: 'var(--color-text-dim)', textAlign: 'center', padding: '12px 0' }}>
            {t.dash_cardPickerEmpty}
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {hiddenCards.map((id) => (
              <button
                key={id}
                onClick={() => onAdd(id)}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '10px 14px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--color-border)',
                  background: 'var(--color-bg)',
                  cursor: 'pointer',
                  transition: 'border-color 0.15s, background 0.15s',
                  textAlign: 'left',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--color-accent)'; e.currentTarget.style.background = 'color-mix(in srgb, var(--color-accent) 6%, var(--color-bg))' }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--color-border)'; e.currentTarget.style.background = 'var(--color-bg)' }}
              >
                <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--color-text)' }}>{CARD_LABELS[id]}</span>
                <span style={{ fontSize: 12, color: 'var(--color-accent)', fontWeight: 600 }}>+ 添加</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
