import { beforeEach, afterEach, expect, it, vi } from 'vitest'
import { useTaskStore } from './taskStore'
import { useHabitStore } from './habitStore'
import { useCharacterStore } from './characterStore'
import { useGrowthEventStore } from './growthEventStore'
import { makeSubHabit } from '@/utils/subTaskUtils'
import { deleteTaskWithRewards, undoTaskCompletion } from '@/utils/taskCompletion'
import type { Habit } from '@/types/habit'

function at(date: string) { vi.setSystemTime(new Date(`${date}T12:00:00`)) }
function current(id: string) { return useHabitStore.getState().habits.find(h => h.id === id)! }
function refresh(date: string) { at(date); useHabitStore.getState().resetDailyHabits() }
function habit(options: Partial<Habit> = {}) {
  useHabitStore.getState().addHabit({
    title: 'Synthetic audit habit', category: 'other', difficulty: 3,
    repeatType: 'daily', startDate: '2026-09-11', endDate: null,
    estimatedMinutes: 15, customIntervalDays: null, weeklyDays: null,
    weeklyMode: null, weeklyFlexibleCount: null, monthlyDays: null,
    targetCount: 1, reminderTime: null, description: '', ...options,
  })
  const id = useHabitStore.getState().habits.at(-1)!.id
  useHabitStore.getState().updateHabit(id, { consecutiveCount: 16, toleranceNextAt: 40 })
  return id
}

beforeEach(() => {
  vi.useFakeTimers()
  at('2026-09-11')
  localStorage.clear()
  useTaskStore.setState({ tasks: [] })
  useHabitStore.setState({ habits: [] })
  useGrowthEventStore.setState({ events: [] })
  useCharacterStore.setState({ character: { ...useCharacterStore.getInitialState().character } })
})
afterEach(() => vi.useRealTimers())

function completedTask() {
  const task = useTaskStore.getState().addTask({ title: 'Synthetic audit task' })
  const done = useTaskStore.getState().completeTask(task.id)!
  useTaskStore.getState().updateTask(task.id, { xpReward: 3 })
  useCharacterStore.setState({ character: { ...useCharacterStore.getState().character, totalXP: 103, ore: 103 } })
  useGrowthEventStore.getState().addEvent({ type: 'task_complete', title: 'Synthetic',
    details: { entityId: task.id, completionId: done.completionId }, isMilestone: false })
  return task.id
}

it('deletion, restore and completion undo preserve legacy balances and remain idempotent', () => {
  const id = completedTask()
  expect(deleteTaskWithRewards(id)).toBe(true)
  expect(deleteTaskWithRewards(id)).toBe(false)
  expect(useCharacterStore.getState().character.totalXP).toBe(103)
  expect(useCharacterStore.getState().character.ore).toBe(103)
  expect(useGrowthEventStore.getState().events.filter(e => e.type === 'task_complete')).toHaveLength(0)
  expect(undoTaskCompletion(id)).toBe(false)
  useTaskStore.getState().restoreTask(id)
  expect(undoTaskCompletion(id)).toBe(true)
  expect(undoTaskCompletion(id)).toBe(false)
  expect(useCharacterStore.getState().character.totalXP).toBe(103)
})

it('restoring and deleting a completed task again never charges unrelated rewards', () => {
  const id = completedTask()
  deleteTaskWithRewards(id)
  for (let count = 0; count < 3; count++) {
    useTaskStore.getState().restoreTask(id)
    expect(useTaskStore.getState().tasks[0].status).toBe('done')
    expect(deleteTaskWithRewards(id)).toBe(true)
  }
  expect(useCharacterStore.getState().character.totalXP).toBe(103)
})

it('restoring an old deleted record keeps legacy reward data without guessing compensation', () => {
  const id = completedTask()
  // Old releases left the old receipt after deletion; its reward ownership is unknown.
  useTaskStore.getState().updateTask(id, { deletedAt: '2026-09-11T10:00:00Z' })
  useTaskStore.getState().restoreTask(id)
  expect(useTaskStore.getState().tasks[0].xpReward).toBe(3)
  expect(useTaskStore.getState().tasks[0].completionId).toBeUndefined()
  expect(useCharacterStore.getState().character.totalXP).toBe(103)
  undoTaskCompletion(id)
  expect(useCharacterStore.getState().character.totalXP).toBe(103)
})

it('habit undo preserves later nested text, additions, removals and ordering', () => {
  const id = habit()
  const first = makeSubHabit('First', 0)
  const removed = makeSubHabit('Remove later', 1)
  const nested = makeSubHabit('Nested', 0)
  const checked = makeSubHabit('Already checked', 1)
  checked.completed = true
  first.subHabits = [nested, checked]
  useHabitStore.getState().updateHabit(id, { subHabits: [first, removed] })
  const reward = useHabitStore.getState().completeHabit(id)!
  useCharacterStore.getState().gainXPAndOre(reward.xp, reward.ore)
  const actionId = current(id).lastAction!.id
  useHabitStore.getState().updateHabit(id, { title: 'Renamed parent', difficulty: 5 })
  useHabitStore.getState().editSubHabit(id, nested.id, 'Edited nested')
  useHabitStore.getState().removeSubHabit(id, removed.id)
  useHabitStore.getState().addSubHabit(id, 'Added root')
  useHabitStore.getState().addSubHabit(id, 'Added nested', first.id)
  const added = current(id).subHabits.find(s => s.title === 'Added root')!
  useHabitStore.getState().reorderSubHabits(id, null, [added.id, first.id])
  const nestedAdded = current(id).subHabits[1].subHabits.find(s => s.title === 'Added nested')!
  useHabitStore.getState().reorderSubHabits(id, first.id, [nestedAdded.id, checked.id, nested.id])
  expect(useHabitStore.getState().undoComplete(id, actionId)).toBe(true)
  const result = current(id)
  expect(result.title).toBe('Renamed parent')
  expect(result.difficulty).toBe(5)
  expect(result.subHabits.map(s => s.title)).toEqual(['Added root', 'First'])
  expect(result.subHabits[1].subHabits.map(s => [s.title, s.completed])).toEqual([
    ['Added nested', false], ['Already checked', true], ['Edited nested', false],
  ])
  expect(useCharacterStore.getState().character.totalXP).toBe(0)
  expect(useHabitStore.getState().undoComplete(id, actionId)).toBe(false)
})

it('undoing skip preserves subsequent checkbox edits because skip did not check them', () => {
  const id = habit()
  const child = makeSubHabit('Child', 0)
  useHabitStore.getState().updateHabit(id, { subHabits: [child] })
  useHabitStore.getState().skipHabit(id)
  useHabitStore.getState().toggleSubHabit(id, child.id)
  expect(useHabitStore.getState().undoComplete(id)).toBe(true)
  expect(current(id).subHabits[0].completed).toBe(true)
})

it('settles each closed daily occurrence once and consumes tolerance before halving', () => {
  const id = habit()
  useHabitStore.getState().updateHabit(id, { toleranceCharges: 1 })
  refresh('2026-09-12')
  expect([current(id).consecutiveCount, current(id).toleranceCharges]).toEqual([16, 0])
  refresh('2026-09-13')
  expect(current(id).consecutiveCount).toBe(8)
  refresh('2026-09-13')
  refresh('2026-09-12')
  refresh('2026-09-13')
  expect(current(id).consecutiveCount).toBe(8)
  refresh('2026-09-16')
  expect(current(id).consecutiveCount).toBe(1)
})

it('completion and skip each satisfy that daily occurrence', () => {
  const complete = habit()
  const skip = habit()
  useHabitStore.getState().completeHabit(complete)
  useHabitStore.getState().skipHabit(skip)
  const completeStreak = current(complete).consecutiveCount
  const skipStreak = current(skip).consecutiveCount
  refresh('2026-09-12')
  expect(current(complete).consecutiveCount).toBe(completeStreak)
  expect(current(skip).consecutiveCount).toBe(skipStreak)
  refresh('2026-09-13')
  expect(current(complete).consecutiveCount).toBe(Math.floor(completeStreak / 2))
  expect(current(skip).consecutiveCount).toBe(Math.floor(skipStreak / 2))
})

it('weekdays do not charge weekends and strict weeks deduplicate scheduled days', () => {
  const weekdays = habit({ repeatType: 'weekdays' })
  useHabitStore.getState().completeHabit(weekdays)
  const strict = habit({ repeatType: 'weekly', weeklyMode: 'strict', weeklyDays: [1, 1, 4] })
  refresh('2026-09-14')
  expect(current(weekdays).consecutiveCount).toBe(17)
  refresh('2026-09-15')
  expect(current(weekdays).consecutiveCount).toBe(8)
  expect(current(strict).consecutiveCount).toBe(8)
  refresh('2026-09-18')
  expect(current(strict).consecutiveCount).toBe(4)
})

it('flexible weeks settle absent weeks once and do not infer missing skip history', () => {
  at('2026-09-07')
  const complete = habit({ startDate: '2026-09-07', repeatType: 'weekly', weeklyMode: 'flexible', weeklyFlexibleCount: 3 })
  const partial = habit({ startDate: '2026-09-07', repeatType: 'weekly', weeklyMode: 'flexible', weeklyFlexibleCount: 3 })
  useHabitStore.getState().completeHabit(complete)
  useHabitStore.getState().completeHabit(partial)
  refresh('2026-09-08')
  useHabitStore.getState().completeHabit(complete)
  refresh('2026-09-09')
  useHabitStore.getState().completeHabit(complete)
  refresh('2026-09-13')
  expect(current(complete).consecutiveCount).toBe(19)
  expect(current(partial).consecutiveCount).toBe(17)
  refresh('2026-09-14')
  expect(current(complete).consecutiveCount).toBe(19)
  expect(current(partial).consecutiveCount).toBe(17)
  expect(current(complete).weeklyCompletionCount).toBe(0)
  refresh('2026-09-21')
  expect(current(complete).consecutiveCount).toBe(9)
  expect(current(partial).consecutiveCount).toBe(8)
})

it('monthly targets stay open through month end and settle each absent month once', () => {
  at('2026-08-15')
  const id = habit({ repeatType: 'monthly', startDate: '2026-08-15', targetCount: 3 })
  useHabitStore.getState().completeHabit(id)
  useHabitStore.getState().completeHabit(id)
  refresh('2026-08-31')
  expect(current(id).currentCycleCount).toBe(2)
  expect(current(id).consecutiveCount).toBe(16)
  refresh('2026-09-01')
  expect(current(id).consecutiveCount).toBe(8)
  expect(current(id).currentCycleCount).toBe(0)
  refresh('2026-10-01')
  expect(current(id).consecutiveCount).toBe(4)
})

it('a completed monthly period is not also missed at its boundary', () => {
  at('2026-08-15')
  const id = habit({ repeatType: 'monthly', startDate: '2026-08-15' })
  useHabitStore.getState().completeHabit(id)
  refresh('2026-09-01')
  expect(current(id).consecutiveCount).toBe(17)
  refresh('2026-10-01')
  expect(current(id).consecutiveCount).toBe(8)
})

it('clamped month dates resolve to a single actual local date', () => {
  at('2026-02-01')
  const id = habit({ repeatType: 'monthly_fixed', startDate: '2026-02-01', monthlyDays: [30, 31, -1] })
  refresh('2026-02-28')
  expect(current(id).consecutiveCount).toBe(16)
  refresh('2026-03-01')
  expect(current(id).consecutiveCount).toBe(8)
})

it.each([['custom', 3], ['biweekly', 14]] as const)('%s waits for the entire interval and retains partial progress', (repeatType, interval) => {
  const id = habit({ repeatType, customIntervalDays: interval, targetCount: 3 })
  useHabitStore.getState().completeHabit(id)
  const dayBefore = new Date(2026, 8, 11 + interval - 1, 12)
  vi.setSystemTime(dayBefore)
  useHabitStore.getState().resetDailyHabits()
  expect(current(id).currentCycleCount).toBe(1)
  expect(current(id).consecutiveCount).toBe(16)
  vi.setSystemTime(new Date(2026, 8, 11 + interval, 12))
  useHabitStore.getState().resetDailyHabits()
  expect(current(id).currentCycleCount).toBe(0)
  expect(current(id).consecutiveCount).toBe(8)
})

it.each([['pauseHabit', 'resumeHabit'], ['hideHabit', 'unhideHabit'], ['deleteHabit', 'restoreHabit']] as const)('%s excludes inactive time when restored', (stop, resume) => {
  const id = habit()
  useHabitStore.getState()[stop](id)
  refresh('2026-10-05')
  useHabitStore.getState()[resume](id)
  useHabitStore.getState().resetDailyHabits()
  expect(current(id).consecutiveCount).toBe(16)
  refresh('2026-10-06')
  expect(current(id).consecutiveCount).toBe(8)
})

it('legacy hydration establishes and persists a watermark without guessing historical misses', async () => {
  const id = habit()
  useHabitStore.getState().updateHabit(id, { lastMissCheckDate: undefined, createdAt: '2020-01-01T12:00:00Z' })
  await useHabitStore.persist.rehydrate()
  await Promise.resolve()
  expect(current(id).consecutiveCount).toBe(16)
  expect(current(id).lastMissCheckDate).toBe('2026-09-10')
  expect(JSON.parse(localStorage.getItem('anvilite-habits')!).state.habits[0].lastMissCheckDate).toBe('2026-09-10')
  at('2026-09-12')
  await useHabitStore.persist.rehydrate()
  await Promise.resolve()
  expect(current(id).consecutiveCount).toBe(8)
  await useHabitStore.persist.rehydrate()
  expect(current(id).consecutiveCount).toBe(8)
})

it('obeys the end date and handles arbitrarily long gaps with bounded halving', () => {
  const ended = habit({ endDate: '2026-09-12' })
  const ongoing = habit()
  refresh('2099-09-13')
  expect(current(ended).consecutiveCount).toBe(4)
  expect(current(ongoing).consecutiveCount).toBe(0)
  refresh('2099-09-13')
  expect(current(ended).consecutiveCount).toBe(4)
})

it('uses local calendar dates across the daylight saving boundary', () => {
  at('2026-10-24')
  const id = habit({ startDate: '2026-10-24' })
  refresh('2026-10-26')
  expect(current(id).consecutiveCount).toBe(4)
  refresh('2026-10-26')
  expect(current(id).consecutiveCount).toBe(4)
})

it('a backwards clock does not reopen a completion when returning to its original day', () => {
  const id = habit()
  useHabitStore.getState().completeHabit(id)
  const receipt = current(id).lastAction!.id
  refresh('2026-09-10')
  refresh('2026-09-11')
  expect(current(id).status).toBe('completed_today')
  expect(current(id).lastAction!.id).toBe(receipt)
  expect(useHabitStore.getState().completeHabit(id)).toBeNull()
})

it('an explicitly skipped flexible week is not charged again at week end', () => {
  const id = habit({ repeatType: 'weekly', weeklyMode: 'flexible', weeklyFlexibleCount: 3 })
  useHabitStore.getState().skipHabit(id)
  const afterSkip = current(id).consecutiveCount
  refresh('2026-09-12')
  refresh('2026-09-14')
  expect(current(id).consecutiveCount).toBe(afterSkip)
  refresh('2026-09-21')
  expect(current(id).consecutiveCount).toBe(Math.floor(afterSkip / 2))
})

it('a failed hydration watermark write is contained and leaves the normalized state in memory', async () => {
  localStorage.setItem('anvilite-subhabit-migration-v3', 'done')
  localStorage.setItem('anvilite-migration-habit-timer-v031', 'done')
  const id = habit()
  useHabitStore.getState().updateHabit(id, { lastMissCheckDate: undefined })
  const warning = vi.spyOn(console, 'warn').mockImplementation(() => {})
  const write = vi.spyOn(localStorage, 'setItem').mockImplementation(() => { throw new Error('quota') })
  try {
    await expect(useHabitStore.persist.rehydrate()).resolves.toBeUndefined()
    await Promise.resolve()
    expect(current(id).lastMissCheckDate).toBe('2026-09-10')
    expect(current(id).consecutiveCount).toBe(16)
    expect(warning).toHaveBeenCalledOnce()
  } finally { write.mockRestore(); warning.mockRestore() }
})

it('unchanged hydration does not write attendance again', async () => {
  localStorage.setItem('anvilite-subhabit-migration-v3', 'done')
  localStorage.setItem('anvilite-migration-habit-timer-v031', 'done')
  habit()
  const write = vi.spyOn(localStorage, 'setItem')
  try {
    await useHabitStore.persist.rehydrate()
    await Promise.resolve()
    expect(write).not.toHaveBeenCalled()
  } finally { write.mockRestore() }
})

it('a superseded hydration snapshot neither overwrites later edits nor makes an extra write', async () => {
  const id = habit()
  useHabitStore.getState().updateHabit(id, { lastMissCheckDate: undefined })
  let queued: VoidFunction | undefined
  const microtask = vi.spyOn(globalThis, 'queueMicrotask').mockImplementation(callback => { queued = callback })
  try {
    await useHabitStore.persist.rehydrate()
    expect(queued).toBeDefined()
    useHabitStore.getState().updateHabit(id, { title: 'Edit after hydration' })
    const write = vi.spyOn(localStorage, 'setItem')
    try {
      queued!()
      expect(write).not.toHaveBeenCalled()
      expect(current(id).title).toBe('Edit after hydration')
    } finally { write.mockRestore() }
  } finally { microtask.mockRestore() }
})
