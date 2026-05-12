import React, { useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import type { Habit } from '@/types/habit'
import { useAreaStore } from '@/stores/areaStore'
import { useGrowthEventStore } from '@/stores/growthEventStore'
import { useHabitStore } from '@/stores/habitStore'
import { useToast } from '@/components/feedback/Toast'
import { useT } from '@/i18n'
import { categoryDisplay, getAreaDisplayName } from '@/utils/area'

interface HabitContextMenuProps {
  habit: Habit
  position: { x: number; y: number }
  onClose: () => void
  onEdit?: () => void
  onUndo?: () => void
}

export function HabitContextMenu({ habit, position, onClose, onEdit, onUndo }: HabitContextMenuProps) {
  const {
    updateHabit,
    hideHabit,
    deleteHabit,
    pauseHabit,
    resumeHabit,
    startHabitTimer,
    pauseHabitTimer,
  } = useHabitStore()
  const areas = useAreaStore((s) => s.areas)
  const { addEvent } = useGrowthEventStore()
  const { showToast } = useToast()
  const t = useT()

  useEffect(() => {
    function handleClick() {
      onClose()
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('click', handleClick)
    window.addEventListener('scroll', handleClick, true)
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('click', handleClick)
      window.removeEventListener('scroll', handleClick, true)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [onClose])

  const categories = useMemo(() => {
    const list = areas
      .filter((area) => area.category !== '_milestone')
      .map((area) => area.category)
    if (!list.includes('other')) list.push('other')
    return list.includes(habit.category) ? list : [habit.category, ...list]
  }, [areas, habit.category])

  function getCategoryLabel(category: string): string {
    const area = areas.find((a) => a.category === category)
    return area ? getAreaDisplayName(area, t) : categoryDisplay(category, t)
  }

  function inscribeHabit() {
    const days = Math.floor((Date.now() - new Date(habit.createdAt).getTime()) / 86400000)
    addEvent({
      type: 'custom_milestone',
      title: habit.title,
      details: {
        sourceType: 'habit',
        categoryName: habit.category,
        difficulty: habit.difficulty,
        consecutiveCount: habit.consecutiveCount,
        totalCompletions: habit.totalCompletions,
        durationDays: days,
      },
      isMilestone: true,
    })
    showToast(`⭐ ${habit.title}`)
  }

  function closeAfter(action: () => void) {
    action()
    onClose()
  }

  const canChangeTimer = habit.status === 'active'

  return createPortal(
    <div
      onClick={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.preventDefault()}
      style={{
        position: 'fixed',
        left: Math.max(8, Math.min(position.x, window.innerWidth - 224)),
        top: Math.max(8, Math.min(position.y, window.innerHeight - 320)),
        width: 216,
        padding: 6,
        borderRadius: 'var(--radius-md)',
        border: '1px solid var(--color-border)',
        background: 'var(--color-surface)',
        boxShadow: 'var(--shadow-lg)',
        zIndex: 1200,
      }}
    >
      {onEdit && (
        <ContextMenuButton onClick={() => closeAfter(onEdit)}>
          {t.common_edit}
        </ContextMenuButton>
      )}
      {habit.status === 'completed_today' && onUndo && (
        <ContextMenuButton onClick={() => closeAfter(onUndo)}>
          {t.common_undo}
        </ContextMenuButton>
      )}
      {canChangeTimer && (
        <ContextMenuButton onClick={() => closeAfter(() => habit.timerStartedAt ? pauseHabitTimer(habit.id) : startHabitTimer(habit.id))}>
          {habit.timerStartedAt ? t.habit_pauseDoing : t.habit_startDoing}
        </ContextMenuButton>
      )}
      {habit.status === 'active' && (
        <ContextMenuButton onClick={() => closeAfter(() => pauseHabit(habit.id))}>
          {t.habit_pause}
        </ContextMenuButton>
      )}
      {habit.status === 'paused' && (
        <ContextMenuButton onClick={() => closeAfter(() => resumeHabit(habit.id))}>
          {t.habit_resume}
        </ContextMenuButton>
      )}
      <ContextMenuButton onClick={() => closeAfter(inscribeHabit)}>
        {t.habit_inscribe}
      </ContextMenuButton>
      {!habit.deletedAt && (
        <ContextMenuButton onClick={() => closeAfter(() => { hideHabit(habit.id); showToast(t.habit_toastHidden) })}>
          {t.habit_hide}
        </ContextMenuButton>
      )}
      {!habit.deletedAt && (
        <>
          <div style={{ padding: '6px 8px 4px', color: 'var(--color-text-dim)', fontSize: 11 }}>
            {t.taskDrawer_category}
          </div>
          <select
            value={habit.category}
            onChange={(e) => closeAfter(() => updateHabit(habit.id, { category: e.target.value }))}
            style={{
              width: '100%',
              height: 30,
              marginBottom: 4,
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--color-border)',
              background: 'var(--color-bg)',
              color: 'var(--color-text)',
              fontSize: 12,
              outline: 'none',
            }}
          >
            {categories.map((category) => (
              <option key={category} value={category}>{getCategoryLabel(category)}</option>
            ))}
          </select>
        </>
      )}
      {!habit.deletedAt && (
        <>
          <div style={{ height: 1, background: 'var(--color-border)', margin: '4px 0' }} />
          <ContextMenuButton danger onClick={() => closeAfter(() => deleteHabit(habit.id))}>
            {t.habit_delete}
          </ContextMenuButton>
        </>
      )}
    </div>,
    document.body,
  )
}

function ContextMenuButton({
  onClick,
  children,
  danger,
}: {
  onClick: () => void
  children: React.ReactNode
  danger?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        width: '100%',
        minHeight: 30,
        padding: '6px 8px',
        borderRadius: 'var(--radius-sm)',
        border: 'none',
        background: 'transparent',
        color: danger ? 'var(--color-danger)' : 'var(--color-text)',
        cursor: 'pointer',
        fontSize: 12,
        textAlign: 'left',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = danger
          ? 'color-mix(in srgb, var(--color-danger) 10%, transparent)'
          : 'color-mix(in srgb, var(--color-accent) 8%, transparent)'
      }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
    >
      {children}
    </button>
  )
}
