import type { GrowthEvent } from '@/types/growthEvent'

export function findCompletionEvent(events: GrowthEvent[], entityId: string, completionId: string | undefined) {
  if (!completionId) return undefined
  return events.find(e => e.details.entityId === entityId && e.details.completionId === completionId)
}
