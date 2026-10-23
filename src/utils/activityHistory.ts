import type { GrowthEvent } from '@/types/growthEvent'
import { formatDateKey } from './time'

const ACTIVITY_TYPES = new Set<GrowthEvent['type']>([
  'task_complete', 'habit_complete', 'habit_skip', 'habit_miss', 'milestone', 'custom_milestone',
])
const REWARD_TYPES = new Set<GrowthEvent['type']>(['level_up', 'badge_earned', 'area_level_up', 'prestige'])

/** Earlier versions could attach a personal inscription to any event without changing its type. */
export function isLegacyPersonalNote(event: GrowthEvent): boolean {
  return REWARD_TYPES.has(event.type) && event.isMilestone &&
    (!!event.details.description?.trim() || hasMilestoneTitle(event) || isValidMilestoneDate(event.details.milestoneDate))
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


function hasMilestoneTitle(event: GrowthEvent): boolean {
  return typeof event.details.milestoneTitle === 'string' && !!event.details.milestoneTitle.trim()
}

/** Calendar validation avoids Date's silent rollover of invalid month/day values. */
export function isValidMilestoneDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith('0000-')) return false
  const date = new Date(value + 'T00:00:00.000Z')
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
}

export function getMilestoneDate(event: GrowthEvent): string {
  if (isValidMilestoneDate(event.details.milestoneDate)) return event.details.milestoneDate
  const original = new Date(event.timestamp)
  if (!Number.isFinite(original.getTime())) return ''
  const date = formatDateKey(original)
  return isValidMilestoneDate(date) ? date : ''
}

/** Milestone presentation only: archive completion metrics retain the original event timestamp. */
export function getMilestoneHistoryView(event: GrowthEvent, legacyNoteTitle: string): GrowthEvent {
  const view = getActivityHistoryView(event, legacyNoteTitle)
  return {
    ...view,
    title: hasMilestoneTitle(event) ? event.details.milestoneTitle!.trim() : view.title,
    details: {
      ...view.details,
      ...(hasMilestoneTitle(event) ? { milestoneTitle: event.details.milestoneTitle } : {}),
      ...(isValidMilestoneDate(event.details.milestoneDate) ? { milestoneDate: event.details.milestoneDate } : {}),
    },
  }
}
