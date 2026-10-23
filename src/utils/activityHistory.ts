import type { GrowthEvent } from '@/types/growthEvent'

const ACTIVITY_TYPES = new Set<GrowthEvent['type']>([
  'task_complete', 'habit_complete', 'habit_skip', 'habit_miss', 'milestone', 'custom_milestone',
])
const REWARD_TYPES = new Set<GrowthEvent['type']>(['level_up', 'badge_earned', 'area_level_up', 'prestige'])

/** Earlier versions could attach a personal inscription to any event without changing its type. */
export function isLegacyPersonalNote(event: GrowthEvent): boolean {
  return REWARD_TYPES.has(event.type) && event.isMilestone && !!event.details.description?.trim()
}

export function isActivityHistoryEvent(event: GrowthEvent): boolean {
  return ACTIVITY_TYPES.has(event.type) || isLegacyPersonalNote(event)
}

export function isManualActivityEvent(event: GrowthEvent): boolean {
  return isActivityHistoryEvent(event) &&
    (event.type === 'milestone' || event.type === 'custom_milestone' || event.isMilestone)
}

export function getActivityHistoryTitle(event: GrowthEvent, legacyNoteTitle: string): string {
  return isLegacyPersonalNote(event) ? legacyNoteTitle : event.title
}

/** Read-only display projection; callers must keep the original event in persisted history. */
export function getActivityHistoryView(event: GrowthEvent, legacyNoteTitle: string): GrowthEvent {
  if (!isLegacyPersonalNote(event)) return event
  return {
    id: event.id, timestamp: event.timestamp, type: 'custom_milestone', isMilestone: true,
    title: getActivityHistoryTitle(event, legacyNoteTitle),
    details: { description: event.details.description },
  }
}
