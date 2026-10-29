import { useCharacterStore } from '@/stores/characterStore'
import { useTaskStore } from '@/stores/taskStore'
import { useHabitStore } from '@/stores/habitStore'
import { getTaskActivity } from '@/utils/activityStats'
import { getTodayString } from '@/utils/time'
import { useT } from '@/i18n'

export function StatusBar() {
  const name = useCharacterStore(s => s.character.name)
  const tasks = useTaskStore(s => s.tasks)
  const habits = useHabitStore()
  const t = useT()
  const activity = getTaskActivity(tasks, undefined, getTodayString())
  const completed = activity.completedCount + habits.getTodayStats().completed
  const minutes = roundMinutes(activity.minutes)
  const hours = minutes > 60 ? Math.floor(minutes / 60) : 0
  const elapsed = t.milestone_timeValue(hours, hours ? roundMinutes(minutes % 60) : minutes)

  return (
    <footer data-status-bar className="flex items-center px-4 shrink-0 gap-3"
      style={{ height: 32, background: 'var(--color-surface)', borderTop: '1px solid var(--color-border)',
        fontSize: 11, color: 'var(--color-text-dim)', overflow: 'hidden', whiteSpace: 'nowrap' }}>
      <span style={{ color: 'var(--color-text)', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 150 }}>{name}</span>
      <span>{t.dash_statDone} <strong style={{ fontFamily: 'var(--font-num)', color: 'var(--color-text)' }}>{completed}</strong></span>
      <span>{t.milestone_statTime} <strong style={{ fontFamily: 'var(--font-num)', color: 'var(--color-text)' }}>{elapsed}</strong></span>
    </footer>
  )
}

function roundMinutes(value: number) { return value > Number.MAX_VALUE / 10 ? value : Math.round(value * 10) / 10 }
