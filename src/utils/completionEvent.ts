import type { GrowthEvent } from '@/types/growthEvent'

export function findCompletionEvent(events: GrowthEvent[], entityId: string, completionId: string | undefined) {
  if (!completionId) return undefined
  return events.find(e => e.details.entityId === entityId && e.details.completionId === completionId)
}

/** Restore only the removed receipt, keeping every unrelated edit and event in its current order. */
export function restoreRemovedCompletionEvent(current: GrowthEvent[], previous: readonly GrowthEvent[], removed: GrowthEvent): GrowthEvent[] {
  if (current.some(event => event.id === removed.id)) return current
  const following = new Set(previous.slice(previous.findIndex(event => event.id === removed.id) + 1).map(event => event.id))
  const nextIndex = current.findIndex(event => following.has(event.id))
  const index = nextIndex < 0 ? current.length : nextIndex
  return [...current.slice(0, index), removed, ...current.slice(index)]
}
