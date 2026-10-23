import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import {
  buildTaskTrend, getTaskTrendHeatLevel, getTaskTrendMax, getTaskTrendMonthDates,
  getTaskTrendWeekDates,
} from './taskTrend'

const memoryStorage = localStorage
let store: typeof import('@/stores/taskStore')['useTaskStore']
beforeEach(async () => {
  vi.resetModules()
  vi.useFakeTimers()
  vi.setSystemTime(new Date(2026, 9, 22, 14, 0))
  vi.stubGlobal('localStorage', memoryStorage)
  vi.stubGlobal('window', { localStorage: memoryStorage })
  localStorage.clear()
  store = (await import('@/stores/taskStore')).useTaskStore
})
afterEach(() => {
  vi.restoreAllMocks()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})
function complete(at = new Date(2026, 9, 22, 14, 0), minutes = 0) {
  vi.setSystemTime(at)
  const task = store.getState().addTask({ title: 'Completed synthetic task', difficulty: 1 })
  store.getState().updateTask(task.id, { actualMinutes: minutes })
  store.getState().completeTask(task.id)
  return task.id
}
function trend() { return buildTaskTrend(store.getState().tasks) }

it('counts actual completed parent tasks with zero XP, including hidden tasks but never nested checklist items', () => {
  const first = complete(undefined, 12)
  store.getState().addSubTask(first, 'One nested child')
  store.getState().hideTask(first)
  complete(undefined, 8)
  const data = trend()
  expect(data.days.get('2026-10-22')).toEqual({ count: 2, minutes: 20 })
  expect(data.slots.get('2026-10-22-2')).toEqual({ count: 2, minutes: 20 })
  expect(store.getState().tasks.every(task => task.xpReward === 0)).toBe(true)
})

it('removes undo and deleted completions immediately and follows edited actual minutes', () => {
  const first = complete(undefined, 10)
  const second = complete(undefined, 20)
  store.getState().updateTask(first, { actualMinutes: 35 })
  expect(trend().days.get('2026-10-22')).toEqual({ count: 2, minutes: 55 })
  store.getState().undoComplete(first)
  expect(trend().days.get('2026-10-22')).toEqual({ count: 1, minutes: 20 })
  store.getState().deleteTask(second)
  expect(trend().days.size).toBe(0)
  store.getState().restoreTask(second)
  expect(trend().days.get('2026-10-22')).toEqual({ count: 1, minutes: 20 })
})

it('ignores todo, doing, waiting and invalid completion dates even when they have time or XP', () => {
  for (const status of ['todo', 'doing', 'waiting'] as const) {
    const task = store.getState().addTask({ title: status })
    store.getState().updateTask(task.id, { status, completedAt: new Date().toISOString(), actualMinutes: 100, xpReward: 999 })
  }
  for (const completedAt of [null, '', 'not-a-date']) {
    const task = store.getState().addTask({ title: 'Invalid date' })
    store.getState().updateTask(task.id, { status: 'done', completedAt, actualMinutes: 100 })
  }
  expect(trend()).toEqual({ days: new Map(), slots: new Map() })
})

it.each([undefined, NaN, Infinity, -Infinity, -12])('counts a historical completion with invalid or absent actual minutes %s as zero time', minutes => {
  const id = complete()
  store.getState().updateTask(id, { actualMinutes: minutes, estimatedMinutes: 500, timerAccumulated: 12000 })
  expect(trend().days.get('2026-10-22')).toEqual({ count: 1, minutes: 0 })
})

it('keeps fractional actual minutes and finite totals without rounding them into XP or hours', () => {
  complete(undefined, 1.5)
  complete(undefined, 2.25)
  expect(trend().days.get('2026-10-22')).toEqual({ count: 2, minutes: 3.75 })
  complete(undefined, Number.MAX_VALUE)
  complete(undefined, Number.MAX_VALUE)
  expect(trend().days.get('2026-10-22')?.minutes).toBe(Number.MAX_VALUE)
})

it('buckets completion timestamps by local day at month and week midnight boundaries', () => {
  complete(new Date(2026, 8, 30, 23, 59), 1)
  complete(new Date(2026, 9, 1, 0, 0), 2)
  complete(new Date(2026, 9, 25, 23, 59), 3)
  complete(new Date(2026, 9, 26, 0, 0), 4)
  const data = trend()
  expect([...data.days.keys()].sort()).toEqual(['2026-09-30', '2026-10-01', '2026-10-25', '2026-10-26'])
  expect(data.slots.get('2026-09-30-3')?.minutes).toBe(1)
  expect(data.slots.get('2026-10-01-0')?.minutes).toBe(2)
  expect(data.slots.get('2026-10-25-3')?.minutes).toBe(3)
  expect(data.slots.get('2026-10-26-0')?.minutes).toBe(4)
})

it('uses the four original local hour slots exactly at 06:00, 12:00 and 18:00', () => {
  for (const [hour, minute] of [[0, 0], [5, 59], [6, 0], [11, 59], [12, 0], [17, 59], [18, 0], [23, 59]]) {
    complete(new Date(2026, 9, 22, hour, minute), 5)
  }
  for (let slot = 0; slot < 4; slot++) expect(trend().slots.get('2026-10-22-' + slot)).toEqual({ count: 2, minutes: 10 })
})

it('builds local month and Monday-to-Sunday week ranges across month/year and daylight-saving dates', () => {
  expect(getTaskTrendMonthDates(new Date(2024, 1, 15))).toHaveLength(29)
  expect(getTaskTrendMonthDates(new Date(2026, 1, 15))).toHaveLength(28)
  expect(getTaskTrendWeekDates(new Date(2026, 10, 1, 23, 59))).toEqual([
    '2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30', '2026-10-31', '2026-11-01',
  ])
  expect(getTaskTrendWeekDates(new Date(2027, 0, 1))).toEqual([
    '2026-12-28', '2026-12-29', '2026-12-30', '2026-12-31', '2027-01-01', '2027-01-02', '2027-01-03',
  ])
  expect(getTaskTrendWeekDates(new Date(2026, 9, 25))).toEqual([
    '2026-10-19', '2026-10-20', '2026-10-21', '2026-10-22', '2026-10-23', '2026-10-24', '2026-10-25',
  ])
})

it('scales visible month and week cells independently of historical count and time peaks', () => {
  for (let index = 0; index < 4; index++) complete(new Date(2026, 8, 28, 14, 0), 1000000)
  complete(new Date(2026, 9, 21, 6, 0), 5)
  complete(new Date(2026, 9, 22, 18, 0), 10)
  const data = trend()
  const monthDates = getTaskTrendMonthDates(new Date(2026, 9, 22))
  expect(getTaskTrendMax(monthDates, data.days, 'count')).toBe(1)
  expect(getTaskTrendMax(monthDates, data.days, 'time')).toBe(10)
  const weekSlots = getTaskTrendWeekDates(new Date(2026, 9, 22)).flatMap(day => [0, 1, 2, 3].map(slot => day + '-' + slot))
  expect(getTaskTrendMax(weekSlots, data.slots, 'count')).toBe(1)
  expect(getTaskTrendMax(weekSlots, data.slots, 'time')).toBe(10)
  expect(getTaskTrendHeatLevel(1, 1)).toBe(4)
  expect(getTaskTrendHeatLevel(5, 10)).toBe(3)
  expect(getTaskTrendHeatLevel(0, 0)).toBe(0)
})
