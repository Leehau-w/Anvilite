import React, { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useTaskStore } from '@/stores/taskStore'
import { useAreaStore } from '@/stores/areaStore'
import { useHabitStore } from '@/stores/habitStore'
import { TaskItem } from './TaskItem'
import { QuickInput } from './QuickInput'
import { TaskDrawer } from './TaskDrawer'
import { HabitDrawer } from '@/components/dashboard/HabitDrawer'
import { useToast } from '@/components/feedback/Toast'
import type { Task } from '@/types/task'
import type { Habit } from '@/types/habit'
import { useT } from '@/i18n'


export function TaskList() {
  const { tasks, restoreTask, permanentlyDeleteTask, updateTask } = useTaskStore()
  const getAreaCategories = useAreaStore((s) => s.getAreaCategories)
  const tr = useT()
  const [mainTab, setMainTab] = useState<'tasks' | 'habits'>('tasks')
  const [activeCategory, setActiveCategory] = useState('ALL')
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editTask, setEditTask] = useState<Task | null>(null)
  const [trashMode, setTrashMode] = useState(false)
  const [hiddenMode, setHiddenMode] = useState(false)
  const [habitDrawerOpen, setHabitDrawerOpen] = useState(false)
  const [editHabit, setEditHabit] = useState<Habit | null>(null)

  const visible = tasks.filter((task) => {
    if (task.deletedAt) return false
    if (task.isHidden) return false
    if (activeCategory !== 'ALL' && task.category !== activeCategory) return false
    return true
  })

  const doing = visible.filter((t) => t.status === 'doing')
  const todo = visible.filter((t) => t.status === 'todo')
  const done = visible.filter((t) => t.status === 'done')

  // 已删除任务（30天内）
  const deleted = tasks
    .filter((t) => !!t.deletedAt)
    .sort((a, b) => new Date(b.deletedAt!).getTime() - new Date(a.deletedAt!).getTime())

  // 已隐藏任务
  const hidden = tasks.filter((t) => !t.deletedAt && t.isHidden)

  function openEdit(task: Task) {
    setEditTask(task)
    setDrawerOpen(true)
  }

  function handleCategoryClick(cat: string) {
    setTrashMode(false)
    setHiddenMode(false)
    setActiveCategory(cat)
  }

  function isCatActive(cat: string) {
    return !trashMode && activeCategory === cat
  }

  return (
    <div className="flex flex-col h-full">
      {/* 主页签：任务 / 习惯 */}
      <div
        className="flex items-center gap-1 px-4 shrink-0"
        style={{ borderBottom: '1px solid var(--color-border)', paddingTop: 8, paddingBottom: 0 }}
      >
        {(['tasks', 'habits'] as const).map((tab) => {
          const label = tab === 'tasks' ? tr.tasklist_tabTasks : tr.tasklist_tabHabits
          const isActive = mainTab === tab
          return (
            <button
              key={tab}
              onClick={() => setMainTab(tab)}
              style={{
                fontSize: 13,
                fontWeight: isActive ? 600 : 400,
                padding: '6px 14px',
                background: 'transparent',
                border: 'none',
                borderBottom: isActive ? '2px solid var(--color-accent)' : '2px solid transparent',
                color: isActive ? 'var(--color-accent)' : 'var(--color-text-dim)',
                cursor: 'pointer',
                transition: 'all 0.15s',
                marginBottom: -1,
              }}
            >
              {label}
            </button>
          )
        })}
      </div>

      {mainTab === 'habits' ? (
        <>
          <HabitsTab
            onAdd={() => { setEditHabit(null); setHabitDrawerOpen(true) }}
            onEdit={(h) => { setEditHabit(h); setHabitDrawerOpen(true) }}
          />
          <HabitDrawer
            open={habitDrawerOpen}
            onClose={() => { setHabitDrawerOpen(false); setEditHabit(null) }}
            editHabit={editHabit}
          />
        </>
      ) : (
      <>
      {/* 分类Tab + 垃圾桶切换 */}
      <div
        className="flex items-center gap-1 px-4 py-2 shrink-0 overflow-x-auto"
        style={{ borderBottom: '1px solid var(--color-border)' }}
      >
        {[{ key: 'ALL', label: tr.tasklist_all }, ...getAreaCategories().map((c) => ({ key: c, label: c }))].map(({ key, label }) => {
          const isActive = isCatActive(key)
          return (
            <button
              key={key}
              onClick={() => handleCategoryClick(key)}
              style={{
                fontSize: 12,
                letterSpacing: '0.02em',
                padding: '4px 12px',
                borderRadius: 'var(--radius-full)',
                border: 'none',
                background: isActive
                  ? 'color-mix(in srgb, var(--color-accent) 15%, transparent)'
                  : 'transparent',
                color: isActive ? 'var(--color-accent)' : 'var(--color-text-dim)',
                cursor: 'pointer',
                fontWeight: isActive ? 500 : 400,
                whiteSpace: 'nowrap',
                transition: 'all 0.15s',
              }}
            >
              {label}
            </button>
          )
        })}
        <div style={{ flex: 1 }} />
        <button
          onClick={() => { setHiddenMode((v) => !v); setTrashMode(false) }}
          title={tr.tasklist_hiddenTooltip}
          style={{
            fontSize: 12,
            padding: '4px 10px',
            borderRadius: 'var(--radius-full)',
            border: `1px solid ${hiddenMode ? 'var(--color-secondary)' : 'var(--color-border)'}`,
            background: hiddenMode
              ? 'color-mix(in srgb, var(--color-secondary) 10%, transparent)'
              : 'transparent',
            color: hiddenMode ? 'var(--color-secondary)' : 'var(--color-text-dim)',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            transition: 'all 0.15s',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            marginRight: 4,
          }}
        >
          <EyeOffIcon />
          {hidden.length > 0 && <span>{hidden.length}</span>}
        </button>
        <button
          onClick={() => { setTrashMode((v) => !v); setHiddenMode(false) }}
          title={tr.tasklist_trashTooltip}
          style={{
            fontSize: 12,
            padding: '4px 10px',
            borderRadius: 'var(--radius-full)',
            border: `1px solid ${trashMode ? 'var(--color-danger)' : 'var(--color-border)'}`,
            background: trashMode
              ? 'color-mix(in srgb, var(--color-danger) 10%, transparent)'
              : 'transparent',
            color: trashMode ? 'var(--color-danger)' : 'var(--color-text-dim)',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            transition: 'all 0.15s',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
          }}
        >
          <TrashIcon />
          {deleted.length > 0 && <span>{deleted.length}</span>}
        </button>
      </div>

      {hiddenMode ? (
        /* 已隐藏任务视图 */
        <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3">
          {hidden.length === 0 ? (
            <div
              className="flex flex-col items-center justify-center flex-1"
              style={{ color: 'var(--color-text-dim)', fontSize: 13, gap: 8, paddingTop: 60 }}
            >
              <span style={{ fontSize: 32 }}>👁️</span>
              <span>{tr.tasklist_hiddenEmpty}</span>
            </div>
          ) : (
            <>
              <p style={{ fontSize: 11, color: 'var(--color-text-dim)', margin: 0 }}>
                {tr.tasklist_hiddenNote}
              </p>
              <AnimatePresence mode="popLayout">
                {hidden.map((task) => (
                  <motion.div
                    key={task.id}
                    layout
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: '60%' }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: '8px 12px',
                      background: 'var(--color-surface)',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--color-border)',
                      opacity: 0.8,
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: 13,
                          color: 'var(--color-text)',
                          textDecoration: task.status === 'done' ? 'line-through' : 'none',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {task.title}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--color-text-dim)', marginTop: 2 }}>
                        {task.category}
                        {task.status === 'done' && task.xpReward > 0 && (
                          <span style={{ marginLeft: 6, color: 'var(--color-success)' }}>
                            +{task.xpReward} XP
                          </span>
                        )}
                        {task.status !== 'done' && (
                          <span style={{ marginLeft: 6, color: 'var(--color-warning)' }}>{tr.tasklist_pendingStatus}</span>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => updateTask(task.id, { isHidden: false })}
                      style={{
                        fontSize: 11,
                        padding: '3px 10px',
                        borderRadius: 'var(--radius-sm)',
                        border: '1px solid var(--color-secondary)',
                        background: 'transparent',
                        color: 'var(--color-secondary)',
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {tr.tasklist_unhide}
                    </button>
                  </motion.div>
                ))}
              </AnimatePresence>
            </>
          )}
        </div>
      ) : trashMode ? (
        /* 垃圾桶视图 */
        <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3">
          {deleted.length === 0 ? (
            <div
              className="flex flex-col items-center justify-center flex-1"
              style={{ color: 'var(--color-text-dim)', fontSize: 13, gap: 8, paddingTop: 60 }}
            >
              <span style={{ fontSize: 32 }}>🗑️</span>
              <span>{tr.tasklist_trashEmpty}</span>
            </div>
          ) : (
            <>
              <p style={{ fontSize: 11, color: 'var(--color-text-dim)', margin: 0 }}>
                {tr.tasklist_trashNote}
              </p>
              <AnimatePresence mode="popLayout">
                {deleted.map((task) => (
                  <motion.div
                    key={task.id}
                    layout
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: '60%' }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: '8px 12px',
                      background: 'var(--color-surface)',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--color-border)',
                      opacity: 0.75,
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: 13,
                          color: 'var(--color-text-dim)',
                          textDecoration: 'line-through',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {task.title}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--color-text-dim)', marginTop: 2, opacity: 0.7 }}>
                        {task.category} · {tr.tasklist_deletedOn(formatDeletedDate(task.deletedAt!))}
                      </div>
                    </div>
                    <button
                      onClick={() => restoreTask(task.id)}
                      style={{
                        fontSize: 11,
                        padding: '3px 10px',
                        borderRadius: 'var(--radius-sm)',
                        border: '1px solid var(--color-border)',
                        background: 'transparent',
                        color: 'var(--color-text-dim)',
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {tr.tasklist_restore}
                    </button>
                    <button
                      onClick={() => permanentlyDeleteTask(task.id)}
                      style={{
                        fontSize: 11,
                        padding: '3px 10px',
                        borderRadius: 'var(--radius-sm)',
                        border: '1px solid var(--color-danger)',
                        background: 'transparent',
                        color: 'var(--color-danger)',
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {tr.tasklist_deletePerm}
                    </button>
                  </motion.div>
                ))}
              </AnimatePresence>
            </>
          )}
        </div>
      ) : (
        /* 正常任务视图 */
        <>
          <div className="px-4 py-3 shrink-0">
            <QuickInput onOpenDrawer={() => { setEditTask(null); setDrawerOpen(true) }} />
          </div>

          <div className="flex-1 overflow-y-auto px-4 pb-4 flex flex-col gap-4">
            {doing.length > 0 && (
              <Section title={tr.tasklist_doing} count={doing.length} accentColor>
                <AnimatePresence mode="popLayout">
                  {doing.map((task) => (
                    <TaskItem key={task.id} task={task} onEdit={openEdit} />
                  ))}
                </AnimatePresence>
              </Section>
            )}

            {todo.length > 0 && (
              <Section title={tr.tasklist_todo} count={todo.length}>
                <AnimatePresence mode="popLayout">
                  {todo.map((task) => (
                    <TaskItem key={task.id} task={task} onEdit={openEdit} />
                  ))}
                </AnimatePresence>
              </Section>
            )}

            {done.length > 0 && (
              <Section title={tr.tasklist_done} count={done.length} dim>
                <AnimatePresence mode="popLayout">
                  {done.map((task) => (
                    <TaskItem key={task.id} task={task} onEdit={openEdit} />
                  ))}
                </AnimatePresence>
              </Section>
            )}

            {visible.length === 0 && (
              <div
                className="flex flex-col items-center justify-center flex-1"
                style={{ color: 'var(--color-text-dim)', fontSize: 13, gap: 8, paddingTop: 60 }}
              >
                <span style={{ fontSize: 32 }}>⚒️</span>
                <span>{tr.tasklist_listEmpty}</span>
              </div>
            )}
          </div>
        </>
      )}

      <TaskDrawer
        open={drawerOpen}
        onClose={() => { setDrawerOpen(false); setEditTask(null) }}
        editTask={editTask}
      />
      </>
      )}
    </div>
  )
}

function Section({
  title,
  count,
  children,
  accentColor,
  dim,
}: {
  title: string
  count: number
  children: React.ReactNode
  accentColor?: boolean
  dim?: boolean
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <span
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: accentColor
              ? 'var(--color-accent)'
              : dim
              ? 'var(--color-text-dim)'
              : 'var(--color-text)',
            letterSpacing: '0.02em',
          }}
        >
          {title}
        </span>
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
      </div>
      <div className="flex flex-col gap-2">{children}</div>
    </div>
  )
}

function TrashIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6M14 11v6" />
      <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
    </svg>
  )
}

function EyeOffIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  )
}

function formatDeletedDate(iso: string): string {
  const d = new Date(iso)
  return `${d.getMonth() + 1}/${d.getDate()}`
}

// ─── 习惯页签 ──────────────────────────────────────────────────────────────────

function HabitsTab({
  onAdd,
  onEdit,
}: {
  onAdd: () => void
  onEdit: (h: Habit) => void
}) {
  const { habits, pauseHabit, resumeHabit, hideHabit, unhideHabit, deleteHabit } = useHabitStore()
  const tr = useT()
  const { showToast } = useToast()
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [showHidden, setShowHidden] = useState(false)

  const active = habits.filter((h) => !h.isHidden && (h.status === 'active' || h.status === 'completed_today'))
  const paused = habits.filter((h) => !h.isHidden && h.status === 'paused')
  const hidden = habits.filter((h) => h.isHidden)

  function handleDelete(id: string) {
    if (confirmDeleteId === id) {
      deleteHabit(id)
      setConfirmDeleteId(null)
    } else {
      setConfirmDeleteId(id)
      setTimeout(() => setConfirmDeleteId(null), 3000)
    }
  }

  function handleHide(id: string) {
    hideHabit(id)
    showToast(tr.habit_toastHidden)
  }

  return (
    <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-4">
      {/* 添加按钮 */}
      <button
        onClick={onAdd}
        style={{
          alignSelf: 'flex-start',
          fontSize: 12,
          padding: '5px 14px',
          borderRadius: 'var(--radius-full)',
          border: '1px solid var(--color-accent)',
          background: 'color-mix(in srgb, var(--color-accent) 10%, transparent)',
          color: 'var(--color-accent)',
          cursor: 'pointer',
          fontWeight: 500,
          transition: 'all 0.15s',
        }}
      >
        {tr.habits_add}
      </button>

      {habits.length === 0 && (
        <div style={{ textAlign: 'center', paddingTop: 48, color: 'var(--color-text-dim)', fontSize: 13 }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>🌱</div>
          {tr.habits_empty}
        </div>
      )}

      {active.length > 0 && (
        <HabitSection title={tr.habits_active} count={active.length}>
          <AnimatePresence mode="popLayout">
            {active.map((h) => (
              <HabitRow
                key={h.id}
                habit={h}
                confirmDeleteId={confirmDeleteId}
                onEdit={() => onEdit(h)}
                onPause={() => pauseHabit(h.id)}
                onHide={() => handleHide(h.id)}
                onDelete={() => handleDelete(h.id)}
              />
            ))}
          </AnimatePresence>
        </HabitSection>
      )}

      {paused.length > 0 && (
        <HabitSection title={tr.habits_paused} count={paused.length}>
          <AnimatePresence mode="popLayout">
            {paused.map((h) => (
              <HabitRow
                key={h.id}
                habit={h}
                confirmDeleteId={confirmDeleteId}
                onEdit={() => onEdit(h)}
                onResume={() => resumeHabit(h.id)}
                onHide={() => handleHide(h.id)}
                onDelete={() => handleDelete(h.id)}
              />
            ))}
          </AnimatePresence>
        </HabitSection>
      )}

      {hidden.length > 0 && (
        <div>
          <button
            onClick={() => setShowHidden((v) => !v)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600,
              color: 'var(--color-text-dim)', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0',
            }}
          >
            <span style={{ fontSize: 10, transform: showHidden ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s', display: 'inline-block' }}>▶</span>
            {tr.habits_hidden(hidden.length)}
          </button>
          <AnimatePresence>
            {showHidden && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                style={{ overflow: 'hidden', marginTop: 6 }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {hidden.map((h) => (
                    <HabitRow
                      key={h.id}
                      habit={h}
                      confirmDeleteId={confirmDeleteId}
                      onUnhide={() => unhideHabit(h.id)}
                      onDelete={() => handleDelete(h.id)}
                      dim
                    />
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  )
}

function HabitSection({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text)', letterSpacing: '0.02em' }}>{title}</span>
        <span style={{ fontSize: 11, color: 'var(--color-text-dim)', background: 'var(--color-surface-hover)', padding: '1px 6px', borderRadius: 'var(--radius-full)' }}>{count}</span>
      </div>
      {children}
    </div>
  )
}

function HabitRow({
  habit,
  confirmDeleteId,
  onEdit,
  onPause,
  onResume,
  onHide,
  onUnhide,
  onDelete,
  dim,
}: {
  habit: Habit
  confirmDeleteId: string | null
  onEdit?: () => void
  onPause?: () => void
  onResume?: () => void
  onHide?: () => void
  onUnhide?: () => void
  onDelete: () => void
  dim?: boolean
}) {
  const isPendingDelete = confirmDeleteId === habit.id
  const tr = useT()
  const repeatLabel = getHabitRepeatLabel(habit, tr)

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: dim ? 0.6 : 1, y: 0 }}
      exit={{ opacity: 0, height: 0 }}
      style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '8px 10px',
        background: 'var(--color-surface)',
        borderRadius: 'var(--radius-md)',
        border: '1px solid var(--color-border)',
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 13, color: dim ? 'var(--color-text-dim)' : 'var(--color-text)',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          textDecoration: dim ? 'line-through' : 'none',
        }}>
          {habit.title}
        </div>
        <div style={{ fontSize: 11, color: 'var(--color-text-dim)', marginTop: 2, display: 'flex', gap: 6 }}>
          <span>{habit.category}</span>
          <span>·</span>
          <span>{repeatLabel}</span>
          {habit.consecutiveCount > 0 && (
            <><span>·</span><span style={{ color: 'var(--color-xp)' }}>🔥{habit.consecutiveCount}</span></>
          )}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
        {onEdit && <HabitIconBtn onClick={onEdit} title={tr.habit_edit} color="var(--color-secondary)">✏️</HabitIconBtn>}
        {onPause && <HabitIconBtn onClick={onPause} title={tr.habit_pause} color="var(--color-text-dim)">⏸</HabitIconBtn>}
        {onResume && <HabitIconBtn onClick={onResume} title={tr.habit_resume} color="var(--color-success)">▶</HabitIconBtn>}
        {onHide && <HabitIconBtn onClick={onHide} title={tr.habit_hide} color="var(--color-text-dim)">🙈</HabitIconBtn>}
        {onUnhide && <HabitIconBtn onClick={onUnhide} title={tr.habit_unhide} color="var(--color-success)">👁</HabitIconBtn>}
        <HabitIconBtn
          onClick={onDelete}
          title={isPendingDelete ? tr.habit_deleteConfirm : tr.habit_delete}
          color={isPendingDelete ? '#dc2626' : 'var(--color-text-dim)'}
        >
          {isPendingDelete ? '!' : '✕'}
        </HabitIconBtn>
      </div>
    </motion.div>
  )
}

function HabitIconBtn({ children, onClick, title, color }: { children: React.ReactNode; onClick: () => void; title: string; color: string }) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        width: 26, height: 26, borderRadius: 'var(--radius-sm)',
        border: `1px solid ${color}`, background: 'transparent',
        color, cursor: 'pointer', fontSize: 11,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 0, transition: 'opacity 0.15s', opacity: 0.7,
      }}
      onMouseEnter={(e) => { e.currentTarget.style.opacity = '1' }}
      onMouseLeave={(e) => { e.currentTarget.style.opacity = '0.7' }}
    >
      {children}
    </button>
  )
}

function getHabitRepeatLabel(habit: Habit, tr: ReturnType<typeof useT>): string {
  const repeatKey = `repeat_${habit.repeatType}` as keyof ReturnType<typeof useT>
  const base = (tr[repeatKey] as string) ?? habit.repeatType
  if (habit.repeatType === 'weekly') {
    if (habit.weeklyMode === 'flexible' && habit.weeklyFlexibleCount)
      return tr.habitRepeatLabel_weekly(habit.weeklyFlexibleCount)
    if (habit.weeklyMode === 'strict' && habit.weeklyDays?.length) {
      const dayLabels = habit.weeklyDays.map((d) => (tr[`weekday_${d}` as keyof ReturnType<typeof useT>] as string) ?? d)
      return tr.habitRepeatLabel_weekDays(dayLabels.join('/'))
    }
  }
  if (habit.repeatType === 'custom' && habit.customIntervalDays) {
    const suffix = (habit.targetCount ?? 1) > 1 ? tr.habitRepeatLabel_targetSuffix(habit.targetCount!) : ''
    return tr.habitRepeatLabel_custom(habit.customIntervalDays, suffix)
  }
  if (habit.repeatType === 'monthly_fixed' && habit.monthlyDays?.length) {
    const days = habit.monthlyDays.map((d) => d === -1 ? tr.habitRepeatLabel_monthEndDay : tr.habitRepeatLabel_monthDay(d)).join('/')
    return tr.habitRepeatLabel_monthFixed(days)
  }
  if (habit.repeatType === 'monthly' && (habit.targetCount ?? 1) > 1)
    return tr.habitRepeatLabel_monthFlexible(habit.targetCount!)
  if ((habit.targetCount ?? 1) > 1) return `${base}${tr.habitRepeatLabel_targetSuffix(habit.targetCount!)}`
  return base
}
