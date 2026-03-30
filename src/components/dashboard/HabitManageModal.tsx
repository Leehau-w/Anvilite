import React, { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Drawer } from '@/components/ui/Drawer'
import { useHabitStore } from '@/stores/habitStore'
import { useToast } from '@/components/feedback/Toast'
import { useT } from '@/i18n'
import { categoryDisplay } from '@/utils/area'
import type { Habit } from '@/types/habit'

interface HabitManageModalProps {
  open: boolean
  onClose: () => void
  onEdit: (habit: Habit) => void
}

export function HabitManageModal({ open, onClose, onEdit }: HabitManageModalProps) {
  const { habits, pauseHabit, resumeHabit, hideHabit, unhideHabit, deleteHabit, restoreHabit, permanentlyDeleteHabit } = useHabitStore()
  const [hiddenMode, setHiddenMode] = useState(false)
  const [trashMode, setTrashMode] = useState(false)
  const tr = useT()
  const { showToast } = useToast()

  const active = habits.filter((h) => !h.deletedAt && !h.isHidden && (h.status === 'active' || h.status === 'completed_today'))
  const paused = habits.filter((h) => !h.deletedAt && !h.isHidden && h.status === 'paused')
  const mastered = habits.filter((h) => !h.deletedAt && !h.isHidden && h.status === 'mastered')
  const hidden = habits.filter((h) => !h.deletedAt && h.isHidden)
  const deleted = habits.filter((h) => !!h.deletedAt).sort((a, b) => new Date(b.deletedAt!).getTime() - new Date(a.deletedAt!).getTime())

  function handleHide(id: string) {
    hideHabit(id)
    showToast(tr.habit_toastHidden)
  }

  function handleDelete(id: string) {
    deleteHabit(id)
  }

  return (
    <Drawer open={open} onClose={onClose} title={tr.habitManage_title} width={400}>
      <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* Mode toggle buttons */}
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={() => { setHiddenMode((v) => !v); setTrashMode(false) }}
            style={{ fontSize: 11, padding: '3px 10px', borderRadius: 'var(--radius-full)', border: `1px solid ${hiddenMode ? 'var(--color-secondary)' : 'var(--color-border)'}`, background: hiddenMode ? 'color-mix(in srgb, var(--color-secondary) 10%, transparent)' : 'transparent', color: hiddenMode ? 'var(--color-secondary)' : 'var(--color-text-dim)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
          >👁 {tr.habits_hiddenTooltip}{hidden.length > 0 && ` (${hidden.length})`}</button>
          <button onClick={() => { setTrashMode((v) => !v); setHiddenMode(false) }}
            style={{ fontSize: 11, padding: '3px 10px', borderRadius: 'var(--radius-full)', border: `1px solid ${trashMode ? 'var(--color-danger)' : 'var(--color-border)'}`, background: trashMode ? 'color-mix(in srgb, var(--color-danger) 10%, transparent)' : 'transparent', color: trashMode ? 'var(--color-danger)' : 'var(--color-text-dim)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
          >🗑 {tr.habits_trashTooltip}{deleted.length > 0 && ` (${deleted.length})`}</button>
        </div>

        {hiddenMode ? (
          hidden.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--color-text-dim)', fontSize: 12 }}>{tr.habits_hiddenEmpty}</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {hidden.map((h) => (
                <HabitRow key={h.id} habit={h} onUnhide={() => unhideHabit(h.id)} dim />
              ))}
            </div>
          )
        ) : trashMode ? (
          deleted.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--color-text-dim)', fontSize: 12 }}>{tr.habits_trashEmpty}</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {deleted.map((h) => (
                <HabitRow key={h.id} habit={h} onRestore={() => restoreHabit(h.id)} onPermDelete={() => permanentlyDeleteHabit(h.id)} dim />
              ))}
            </div>
          )
        ) : (
          <>
            {habits.filter((h) => !h.deletedAt).length === 0 && (
              <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--color-text-dim)', fontSize: 13 }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>🌱</div>
                {tr.habits_empty}
              </div>
            )}

            {active.length > 0 && (
              <Section title={tr.habits_active} count={active.length}>
                <AnimatePresence mode="popLayout">
                  {active.map((h) => (
                    <HabitRow key={h.id} habit={h} onEdit={() => { onEdit(h); onClose() }} onPause={() => pauseHabit(h.id)} onHide={() => handleHide(h.id)} onDelete={() => handleDelete(h.id)} />
                  ))}
                </AnimatePresence>
              </Section>
            )}

            {paused.length > 0 && (
              <Section title={tr.habits_paused} count={paused.length}>
                <AnimatePresence mode="popLayout">
                  {paused.map((h) => (
                    <HabitRow key={h.id} habit={h} onEdit={() => { onEdit(h); onClose() }} onResume={() => resumeHabit(h.id)} onHide={() => handleHide(h.id)} onDelete={() => handleDelete(h.id)} />
                  ))}
                </AnimatePresence>
              </Section>
            )}

            {mastered.length > 0 && (
              <Section title={tr.habits_mastered} count={mastered.length}>
                <AnimatePresence mode="popLayout">
                  {mastered.map((h) => (
                    <HabitRow key={h.id} habit={h} onEdit={() => { onEdit(h); onClose() }} onDelete={() => handleDelete(h.id)} dim />
                  ))}
                </AnimatePresence>
              </Section>
            )}
          </>
        )}
      </div>
    </Drawer>
  )
}

function Section({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text)', letterSpacing: '0.02em' }}>
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
      {children}
    </div>
  )
}

function HabitRow({
  habit,
  onEdit,
  onPause,
  onResume,
  onHide,
  onUnhide,
  onDelete,
  onRestore,
  onPermDelete,
  dim,
}: {
  habit: Habit
  onEdit?: () => void
  onPause?: () => void
  onResume?: () => void
  onHide?: () => void
  onUnhide?: () => void
  onDelete?: () => void
  onRestore?: () => void
  onPermDelete?: () => void
  dim?: boolean
}) {
  const tr = useT()
  const repeatLabel = getHabitRepeatLabel(habit, tr)

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: dim ? 0.6 : 1, y: 0 }}
      exit={{ opacity: 0, height: 0 }}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '8px 10px',
        background: 'var(--color-surface)',
        borderRadius: 'var(--radius-md)',
        border: '1px solid var(--color-border)',
      }}
    >
      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 14,
            color: dim ? 'var(--color-text-dim)' : 'var(--color-text)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            textDecoration: dim ? 'line-through' : 'none',
          }}
        >
          {habit.title}
        </div>
        <div style={{ fontSize: 12, color: 'var(--color-text-dim)', marginTop: 2, display: 'flex', gap: 6 }}>
          <span>{categoryDisplay(habit.category, tr)}</span>
          <span>·</span>
          <span>{repeatLabel}</span>
          {habit.consecutiveCount > 0 && (
            <>
              <span>·</span>
              <span style={{ color: 'var(--color-xp)' }}>🔥{habit.consecutiveCount}</span>
            </>
          )}
        </div>
      </div>

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
        {onEdit && (
          <IconBtn onClick={onEdit} title={tr.habit_edit} color="var(--color-secondary)">
            ✏️
          </IconBtn>
        )}
        {onPause && (
          <IconBtn onClick={onPause} title={tr.habit_pause} color="var(--color-text-dim)">
            ⏸
          </IconBtn>
        )}
        {onResume && (
          <IconBtn onClick={onResume} title={tr.habit_resume} color="var(--color-success)">
            ▶
          </IconBtn>
        )}
        {onHide && (
          <IconBtn onClick={onHide} title={tr.habit_hide} color="var(--color-text-dim)">
            🙈
          </IconBtn>
        )}
        {onUnhide && (
          <IconBtn onClick={onUnhide} title={tr.habit_unhide} color="var(--color-success)">
            👁
          </IconBtn>
        )}
        {onDelete && (
          <IconBtn onClick={onDelete} title={tr.habit_delete} color="var(--color-text-dim)">
            ✕
          </IconBtn>
        )}
        {onRestore && (
          <IconBtn onClick={onRestore} title={tr.habit_restore} color="var(--color-success)">
            ↩
          </IconBtn>
        )}
        {onPermDelete && (
          <IconBtn onClick={onPermDelete} title={tr.habit_deletePerm} color="#dc2626">
            ✕
          </IconBtn>
        )}
      </div>
    </motion.div>
  )
}

function IconBtn({
  children,
  onClick,
  title,
  color,
}: {
  children: React.ReactNode
  onClick: () => void
  title: string
  color: string
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        width: 26,
        height: 26,
        borderRadius: 'var(--radius-sm)',
        border: `1px solid ${color}`,
        background: 'transparent',
        color,
        cursor: 'pointer',
        fontSize: 11,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 0,
        transition: 'all 0.15s',
        opacity: 0.7,
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
