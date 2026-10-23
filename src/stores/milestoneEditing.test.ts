import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { GrowthEvent } from '@/types/growthEvent'
import old033 from '@/test/fixtures/release-v0.3.3-storage.json'
import { useGrowthEventStore } from './growthEventStore'
import { isLegacyPersonalNote, isManualActivityEvent, getActivityHistoryView, getMilestoneDate,
  getMilestoneHistoryView, isValidMilestoneDate } from '@/utils/activityHistory'
import { validateBackupRecords } from '@/utils/backupValidation'
import { findCompletionEvent } from '@/utils/completionEvent'
import { formatDateKey } from '@/utils/time'

function milestone(id = 'memory', type: GrowthEvent['type'] = 'custom_milestone'): GrowthEvent {
  return {
    id, type, title: 'Original title', timestamp: new Date(2026, 9, 23, 0, 5).toISOString(), isMilestone: true,
    details: { description: 'Original memory', entityId: 'linked-entity', completionId: 'receipt',
      actualMinutes: 42, xpGained: 35, oreGained: 9, oldLevel: 1, newLevel: 2 },
  }
}
function current(id = 'memory') { return useGrowthEventStore.getState().events.find(event => event.id === id)! }

beforeEach(() => {
  vi.restoreAllMocks()
  localStorage.clear()
  useGrowthEventStore.setState({ events: [] })
})
afterEach(() => { vi.restoreAllMocks() })

it.each(['2024-02-29', '2026-10-23', '0001-01-01', '9999-12-31'])('accepts actual calendar day %s', date => {
  expect(isValidMilestoneDate(date)).toBe(true)
})
it.each(['2026-02-29', '2024-02-30', '2026-04-31', '2026-13-01', '2026-00-01', '2026-01-00',
  '2026-1-01', '2026-01-1', '0000-01-01', '2026-10-23T00:00:00Z', '', null, undefined, 20261023])(
  'rejects invalid milestone day %s', date => { expect(isValidMilestoneDate(date)).toBe(false) })

it('falls back to the original local calendar day without truncating an ISO timestamp', () => {
  const event = milestone()
  expect(getMilestoneDate(event)).toBe(formatDateKey(new Date(event.timestamp)))
  expect(getMilestoneDate({ ...event, details: { milestoneDate: '2026-02-30' } })).toBe(getMilestoneDate(event))
  expect(getMilestoneDate({ ...event, details: { milestoneDate: '2024-02-29' } })).toBe('2024-02-29')
  expect(getMilestoneDate({ ...event, timestamp: 'invalid' })).toBe('')
})

it.each(['task_complete', 'habit_complete'] as const)(
  'edits a marked %s milestone while retaining raw completion evidence and historical periods', type => {
    const original = milestone('memory', type)
    const unrelated = milestone('other')
    useGrowthEventStore.setState({ events: [original, unrelated] })
    // These records stand for unrelated business-store data and must never be written by this action.
    localStorage.setItem('anvilite-tasks', old033.storage['anvilite-tasks'])
    localStorage.setItem('anvilite-habits', old033.storage['anvilite-habits'])
    localStorage.setItem('anvilite-character', old033.storage['anvilite-character'])
    const business = ['anvilite-tasks', 'anvilite-habits', 'anvilite-character'].map(key => localStorage.getItem(key))
    const writes = vi.spyOn(localStorage, 'setItem')
    expect(useGrowthEventStore.getState().updateMilestone('memory', {
      title: '  New personal title  ', date: '2024-02-29', description: '  Updated memory  ',
    })).toBe(true)
    expect(current()).toEqual({ ...original, details: { ...original.details,
      milestoneTitle: 'New personal title', milestoneDate: '2024-02-29', description: 'Updated memory' } })
    expect(current('other')).toBe(unrelated)
    expect(findCompletionEvent(useGrowthEventStore.getState().events, 'linked-entity', 'receipt')).toBe(current())
    const display = getMilestoneHistoryView(current(), 'Personal memory')
    expect(display.title).toBe('New personal title')
    expect(getMilestoneDate(display)).toBe('2024-02-29')
    expect(display.timestamp).toBe(original.timestamp)
    const archiveEvent = getActivityHistoryView(current(), 'Personal memory')
    expect(archiveEvent.title).toBe(original.title)
    expect(archiveEvent.timestamp).toBe(original.timestamp)
    expect(new Date(archiveEvent.timestamp).getMonth()).toBe(9)
    expect(['anvilite-tasks', 'anvilite-habits', 'anvilite-character'].map(key => localStorage.getItem(key))).toEqual(business)
    expect(writes.mock.calls.map(([key]) => key)).toEqual(['anvilite-growth-events'])
  })

it('merges draft metadata into the latest details rather than restoring a stale event snapshot', () => {
  useGrowthEventStore.setState({ events: [milestone()] })
  useGrowthEventStore.getState().updateEventDetails('memory', { actualMinutes: 87, categoryName: 'New category' })
  expect(useGrowthEventStore.getState().updateMilestone('memory', {
    date: '2026-10-01', description: 'New notes',
  })).toBe(true)
  expect(current().details).toMatchObject({ actualMinutes: 87, categoryName: 'New category',
    milestoneDate: '2026-10-01', description: 'New notes' })
  expect(current().details.milestoneTitle).toBeUndefined()
})

it.each(['level_up', 'badge_earned', 'area_level_up', 'prestige'] as const)(
  'keeps an edited old %s inscription visible after clearing its note without revealing game details', type => {
    const original = milestone('memory', type)
    useGrowthEventStore.setState({ events: [original] })
    expect(useGrowthEventStore.getState().updateMilestone('memory', {
      title: 'Renamed personal memory', date: '2026-09-30', description: '',
    })).toBe(true)
    expect(isLegacyPersonalNote(current())).toBe(true)
    expect(isManualActivityEvent(current())).toBe(true)
    const view = getMilestoneHistoryView(current(), 'Personal memory')
    expect(view).toEqual({
      id: original.id, type: 'custom_milestone', isMilestone: true, timestamp: original.timestamp,
      title: 'Renamed personal memory', details: { description: '', milestoneTitle: 'Renamed personal memory', milestoneDate: '2026-09-30' },
    })
    expect(current().title).toBe('Original title')
    expect(current().details.xpGained).toBe(35)
    expect(getActivityHistoryView(current(), 'Personal memory').details).toEqual({ description: '' })
  })

it('does not persist a translated fallback title when only an old inscription date or note is edited', () => {
  useGrowthEventStore.setState({ events: [milestone('memory', 'level_up')] })
  expect(useGrowthEventStore.getState().updateMilestone('memory', { date: '2026-10-23', description: '' })).toBe(true)
  expect(current().title).toBe('Original title')
  expect(current().details).not.toHaveProperty('milestoneTitle')
  expect(isLegacyPersonalNote(current())).toBe(true)
  expect(getMilestoneHistoryView(current(), '个人纪念').title).toBe('个人纪念')
  expect(getMilestoneHistoryView(current(), 'Personal memory').title).toBe('Personal memory')
})

it('rejects invalid edits, missing records, ordinary activity and reward-only events without any write', () => {
  const original = milestone()
  const ordinary = { ...milestone('ordinary', 'habit_complete'), isMilestone: false }
  const reward = { ...milestone('reward', 'level_up'), details: {} }
  useGrowthEventStore.setState({ events: [original, ordinary, reward] })
  const before = useGrowthEventStore.getState().events
  const persisted = localStorage.getItem('anvilite-growth-events')
  const write = vi.spyOn(localStorage, 'setItem')
  for (const patch of [
    { title: '', date: '2026-10-23', description: '' },
    { title: '  ', date: '2026-10-23', description: '' },
    { title: 'New title', date: '2026-02-29', description: '' },
    { title: 'New title', date: '2026-10-23', description: 42 },
  ]) {
    expect(useGrowthEventStore.getState().updateMilestone('memory', patch as { title: string; date: string; description: string })).toBe(false)
  }
  for (const id of ['missing', 'ordinary', 'reward']) {
    expect(useGrowthEventStore.getState().updateMilestone(id, { title: 'New title', date: '2026-10-23', description: '' })).toBe(false)
  }
  expect(useGrowthEventStore.getState().events).toBe(before)
  expect(localStorage.getItem('anvilite-growth-events')).toBe(persisted)
  expect(write).not.toHaveBeenCalled()
})

it('rolls back only its own metadata when persistence fails, preserving unrelated and later detail edits', () => {
  const original = milestone()
  const other = milestone('other')
  useGrowthEventStore.setState({ events: [original, other] })
  const realSet = localStorage.setItem.bind(localStorage)
  let firstWrite = true
  vi.spyOn(localStorage, 'setItem').mockImplementation((key, value) => {
    if (key === 'anvilite-growth-events' && firstWrite) {
      firstWrite = false
      useGrowthEventStore.getState().updateEventDetails('other', { description: 'Unrelated saved note' })
      useGrowthEventStore.getState().updateEventDetails('memory', { actualMinutes: 99 })
      throw new Error('Synthetic quota')
    }
    realSet(key, value)
  })
  expect(() => useGrowthEventStore.getState().updateMilestone('memory', {
    title: 'Failed title', date: '2026-10-01', description: 'Failed notes',
  })).toThrow('Synthetic quota')
  expect(current()).toEqual({ ...original, details: { ...original.details, actualMinutes: 99 } })
  expect(current('other').details.description).toBe('Unrelated saved note')
  expect(JSON.parse(localStorage.getItem('anvilite-growth-events')!).state.events).toEqual(useGrowthEventStore.getState().events)
})

it('restores memory even when persistent storage remains unavailable throughout rollback', () => {
  const original = milestone()
  useGrowthEventStore.setState({ events: [original] })
  const persisted = localStorage.getItem('anvilite-growth-events')
  vi.spyOn(localStorage, 'setItem').mockImplementation(() => { throw new Error('Storage remains full') })
  expect(() => useGrowthEventStore.getState().updateMilestone('memory', {
    title: 'Failed title', date: '2026-10-01', description: '',
  })).toThrow('Storage remains full')
  expect(current()).toEqual(original)
  expect(localStorage.getItem('anvilite-growth-events')).toBe(persisted)
})

it.each([
  [{ milestoneTitle: '' }], [{ milestoneTitle: '  ' }], [{ milestoneTitle: 42 }],
  [{ milestoneDate: '2026-02-29' }], [{ milestoneDate: 20261023 }], [{ milestoneDate: null }],
])('rejects malformed optional milestone metadata in a backup: %j', details => {
  const data = structuredClone(old033.payload.data)
  Object.assign(data.growthEvents.events[0].details, details)
  expect(validateBackupRecords(data)).toBe('invalid_events')
})

it('accepts v0.3 events without metadata and retains edits across persistence and an export/import round trip', async () => {
  expect(validateBackupRecords(structuredClone(old033.payload.data))).toBeNull()
  const original = milestone('memory', 'habit_complete')
  useGrowthEventStore.setState({ events: [original] })
  useGrowthEventStore.getState().updateMilestone('memory', {
    title: 'Updated title', date: '2024-02-29', description: 'Updated note',
  })
  const saved = structuredClone(useGrowthEventStore.getState().events)
  const data = structuredClone(old033.payload.data)
  data.growthEvents.events = saved as typeof data.growthEvents.events
  expect(validateBackupRecords(data)).toBeNull()
  const payload = JSON.parse(JSON.stringify({ ...old033.payload, data }))
  const { applyImportPayload } = await import('@/utils/dataExport')
  expect(applyImportPayload(payload)).toEqual({ success: true })
  vi.resetModules()
  const fresh = (await import('./growthEventStore')).useGrowthEventStore
  expect(fresh.getState().events).toEqual(saved)
  expect(getMilestoneHistoryView(fresh.getState().events[0], 'Personal memory').title).toBe('Updated title')
  expect(getMilestoneDate(fresh.getState().events[0])).toBe('2024-02-29')
  expect(fresh.getState().events[0].timestamp).toBe(original.timestamp)
})


it('removes only a failed new milestone so retry creates one record without losing unrelated writes', () => {
  const previous = milestone('previous')
  useGrowthEventStore.setState({ events: [previous] })
  const realSet = localStorage.setItem.bind(localStorage)
  let failOnce = true
  vi.spyOn(localStorage, 'setItem').mockImplementation((key, value) => {
    if (key === 'anvilite-growth-events' && failOnce) {
      failOnce = false
      useGrowthEventStore.getState().updateEventDetails('previous', { description: 'Later saved note' })
      useGrowthEventStore.getState().addEvent({ type: 'custom_milestone', title: 'Independent new memory',
        details: { description: 'Must survive rollback' }, isMilestone: true })
      throw new Error('Synthetic creation quota')
    }
    realSet(key, value)
  })
  const save = () => useGrowthEventStore.getState().addEvent({
    type: 'custom_milestone', title: 'Retry this memory',
    details: { description: 'A personal note', milestoneDate: '2024-02-29' }, isMilestone: true,
  })
  expect(save).toThrow('Synthetic creation quota')
  const kept = useGrowthEventStore.getState().events
  expect(kept).toHaveLength(2)
  expect(kept.map(event => event.title)).not.toContain('Retry this memory')
  expect(kept.find(event => event.id === 'previous')!.details.description).toBe('Later saved note')
  const independent = kept.find(event => event.title === 'Independent new memory')!
  expect(independent.details.description).toBe('Must survive rollback')
  expect(JSON.parse(localStorage.getItem('anvilite-growth-events')!).state.events).toEqual(kept)
  expect(save).not.toThrow()
  const retried = useGrowthEventStore.getState().events
  expect(retried).toHaveLength(3)
  expect(retried.filter(event => event.title === 'Retry this memory')).toHaveLength(1)
  expect(retried.find(event => event.id === independent.id)).toEqual(independent)
  expect(retried.find(event => event.id === 'previous')!.details.description).toBe('Later saved note')
  expect(JSON.parse(localStorage.getItem('anvilite-growth-events')!).state.events).toEqual(retried)
})

it('removes a failed new milestone from memory even if persistence also rejects the rollback', () => {
  const previous = milestone('previous')
  useGrowthEventStore.setState({ events: [previous] })
  const persisted = localStorage.getItem('anvilite-growth-events')
  vi.spyOn(localStorage, 'setItem').mockImplementation(() => { throw new Error('Storage remains full') })
  expect(() => useGrowthEventStore.getState().addEvent({
    type: 'custom_milestone', title: 'Unsaved memory', details: { milestoneDate: '2026-10-23' }, isMilestone: true,
  })).toThrow('Storage remains full')
  expect(useGrowthEventStore.getState().events).toEqual([previous])
  expect(localStorage.getItem('anvilite-growth-events')).toBe(persisted)
})
