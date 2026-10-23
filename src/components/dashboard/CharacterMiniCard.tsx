import { useCharacterStore } from '@/stores/characterStore'
import { useTaskStore } from '@/stores/taskStore'
import { useHabitStore } from '@/stores/habitStore'
import { getTaskActivity } from '@/utils/activityStats'
import { useT, type Translations } from '@/i18n'
import type { GlobalStatus } from '@/types'

const GLOBAL_STATUS_CYCLE: GlobalStatus[] = ['active', 'charging', 'resting', 'traveling', 'returning']
const STATUS_ICONS: Record<GlobalStatus, { icon: string; key: keyof Translations }> = {
  active: { icon: '⚡', key: 'charCard_status_active' },
  charging: { icon: '🔋', key: 'charCard_status_charging' },
  resting: { icon: '💤', key: 'charCard_status_resting' },
  traveling: { icon: '🌄', key: 'charCard_status_traveling' },
  returning: { icon: '🌅', key: 'charCard_status_returning' },
}
const CATEGORY_STATUS: Record<string, { icon: string; key: keyof Translations }> = {
  library: { icon: '📚', key: 'charCard_catStatus_library' },
  forge: { icon: '💼', key: 'charCard_catStatus_forge' },
  arena: { icon: '🏃', key: 'charCard_catStatus_arena' },
  workshop: { icon: '✨', key: 'charCard_catStatus_workshop' },
  home: { icon: '🏠', key: 'charCard_catStatus_home' },
}

export function CharacterMiniCard({ onClickMilestone }: { onClickMilestone?: () => void }) {
  const { character, setGlobalStatus } = useCharacterStore()
  const tasks = useTaskStore(s => s.tasks)
  const habits = useHabitStore(s => s.habits)
  const t = useT()
  const activity = getTaskActivity(tasks)
  const activeHabits = habits.filter(h => !h.deletedAt && (h.status === 'active' || h.status === 'completed_today'))
  const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 }
  const topTask = tasks.filter(task => task.status === 'doing' && !task.deletedAt && !task.isHidden)
    .sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority])[0]
  const currentActivity = topTask ?? activeHabits.find(h => !h.isHidden && h.status === 'active' && h.timerStartedAt !== null)
  const status = currentActivity
    ? CATEGORY_STATUS[currentActivity.category] ?? { icon: '📌', key: 'charCard_busy' }
    : STATUS_ICONS[character.globalStatus] ?? STATUS_ICONS.active

  function cycleStatus() {
    const index = GLOBAL_STATUS_CYCLE.indexOf(character.globalStatus)
    setGlobalStatus(GLOBAL_STATUS_CYCLE[(index + 1) % GLOBAL_STATUS_CYCLE.length])
  }

  return (
    <div data-personal-overview style={{ height: '100%', boxSizing: 'border-box', padding: 12,
      background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)',
      boxShadow: 'var(--shadow-sm)', display: 'flex', flexDirection: 'column', gap: 8, overflow: 'auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <span style={{ fontSize: 10, color: 'var(--color-text-dim)', marginRight: 6 }}>{t.overview_title}</span>
          <strong style={{ fontSize: 14, color: 'var(--color-text)', overflowWrap: 'anywhere' }}>{character.name}</strong>
        </div>
        {onClickMilestone && <button type="button" onClick={onClickMilestone} title={t.activity_record} aria-label={t.activity_record}
          style={{ background: 'none', border: 'none', color: 'var(--color-accent)', cursor: 'pointer', fontSize: 16 }}>→</button>}
      </div>
      <button type="button" onClick={currentActivity ? undefined : cycleStatus} disabled={!!currentActivity}
        title={currentActivity ? t.charCard_statusAutoLabel : t.charCard_clickToChangeStatus}
        style={{ padding: 0, display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none',
          color: 'var(--color-text)', cursor: currentActivity ? 'default' : 'pointer', textAlign: 'left', fontSize: 12 }}>
        <span aria-hidden="true">{status.icon}</span><span>{t[status.key] as string}</span>
        {currentActivity && <span style={{ fontSize: 10, color: 'var(--color-text-dim)' }}>{t.charCard_statusAutoLabel}</span>}
      </button>
      <div style={{ display: 'flex', gap: 16, marginTop: 'auto' }}>
        <MiniStat label={t.overview_pending} value={activity.activeCount} />
        <MiniStat label={t.overview_habits} value={activeHabits.length} />
      </div>
    </div>
  )
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return <div style={{ minWidth: 0 }}>
    <div style={{ fontSize: 10, color: 'var(--color-text-dim)' }}>{label}</div>
    <div style={{ fontSize: 16, fontFamily: 'var(--font-num)', fontWeight: 600, color: 'var(--color-text)' }}>{value}</div>
  </div>
}
