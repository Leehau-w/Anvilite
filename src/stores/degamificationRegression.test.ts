import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { useTaskStore } from './taskStore'
import { useHabitStore } from './habitStore'
import { useCharacterStore } from './characterStore'
import { useBadgeStore } from './badgeStore'
import { useGrowthEventStore } from './growthEventStore'
import { deleteTaskWithRewards, undoTaskCompletion } from '@/utils/taskCompletion'
import { makeSubHabit } from '@/utils/subTaskUtils'
import type { Habit } from '@/types/habit'
import type { GrowthEvent } from '@/types/growthEvent'

function at(day = '2026-10-23', hour = 12) { vi.setSystemTime(new Date(`${day}T${String(hour).padStart(2, '0')}:00:00`)) }
function currentTask(id: string) { return useTaskStore.getState().tasks.find(task => task.id === id)! }
function currentHabit(id: string) { return useHabitStore.getState().habits.find(habit => habit.id === id)! }
function events(type?: GrowthEvent['type']) { return useGrowthEventStore.getState().events.filter(event => !type || event.type === type) }
function addHabit(patch: Partial<Habit> = {}) {
  useHabitStore.getState().addHabit({
    title: 'Real recurring work', category: 'home', difficulty: 3, estimatedMinutes: 5,
    repeatType: 'daily', customIntervalDays: null, weeklyDays: null, weeklyMode: null,
    weeklyFlexibleCount: null, monthlyDays: null, targetCount: 1, startDate: '2026-10-01',
    endDate: null, reminderTime: null, description: '', ...patch,
  })
  return useHabitStore.getState().habits.at(-1)!.id
}
const legacyCharacter = { ...useCharacterStore.getInitialState().character,
  level: 37, totalXP: 54321, currentXP: 120, ore: 789, totalOreEarned: 999,
  prestigeLevel: 2, titlePreset: 'custom' as const, customTitles: ['Kept legacy title'], xpFormulaVersion: 0,
}
function expectLegacyRewards() {
  const current = useCharacterStore.getState().character
  for (const key of ['level', 'totalXP', 'currentXP', 'ore', 'totalOreEarned', 'prestigeLevel', 'titlePreset', 'customTitles', 'xpFormulaVersion'] as const) {
    expect(current[key]).toEqual(legacyCharacter[key])
  }
}

beforeEach(() => {
  vi.useFakeTimers()
  at()
  localStorage.clear()
  useTaskStore.setState({ tasks: [] })
  useHabitStore.setState({ habits: [] })
  useGrowthEventStore.setState({ events: [] })
  useCharacterStore.setState({ character: { ...legacyCharacter } })
  useBadgeStore.setState({ earnedIds: { legacy_badge: '2026-09-01T10:00:00Z' }, notifyQueue: ['legacy_badge'] })
})
afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers() })

it('disables legacy reward, purchase, prestige and title actions without changing persisted compatibility data', () => {
  const character = useCharacterStore.getState()
  expect(character.gainXPAndOre(999, 999)).toEqual({ leveledUp: false, oldLevel: 37, newLevel: 37, prestigeUnlocked: false })
  character.revokeXP(500)
  expect(character.spendOre(1)).toBe(false)
  character.prestige()
  character.setTitlePreset('rpg')
  character.setCustomTitles(['New reward title'])
  useBadgeStore.getState().earn(['new_badge'])
  useBadgeStore.getState().dismissNotify('legacy_badge')
  expect(useBadgeStore.getState().earnedIds).toEqual({ legacy_badge: '2026-09-01T10:00:00Z' })
  expect(useBadgeStore.getState().notifyQueue).toEqual(['legacy_badge'])
  expect(character.getTitle()).toBe('')
  expectLegacyRewards()
  expect(events()).toEqual([])
})

it('hydrates old pre-formula reward values exactly instead of recalculating them from completed work', async () => {
  const task = useTaskStore.getState().addTask({ title: 'Old completed work', difficulty: 5 })
  useTaskStore.getState().updateTask(task.id, { status: 'done', actualMinutes: 900, xpReward: 3456 })
  localStorage.setItem('anvilite-character', JSON.stringify({ state: { character: legacyCharacter }, version: 0 }))
  await useCharacterStore.persist.rehydrate()
  expect(useCharacterStore.getState().character).toEqual(legacyCharacter)
  expect(JSON.parse(localStorage.getItem('anvilite-character')!).state.character).toEqual(legacyCharacter)
  expect(currentTask(task.id).xpReward).toBe(3456)
})

it.each(['todo', 'doing', 'waiting'] as const)('completes %s work once with zero rewards while preserving timer settlement and nested tasks', status => {
  const task = useTaskStore.getState().addTask({ title: 'Real task', category: 'forge' })
  useTaskStore.getState().addSubTask(task.id, 'Keep this child')
  useTaskStore.getState().updateTask(task.id, { status, actualMinutes: 20, timerAccumulated: 120,
    timerStartedAt: status === 'doing' ? new Date(Date.now() - 5 * 60_000).toISOString() : null, xpReward: 999 })
  const complete = useTaskStore.getState().completeTask
  const result = complete(task.id)!
  expect(result.xpReward).toBe(0)
  expect(result.actualMinutes).toBe(status === 'doing' ? 27 : 22)
  expect(result.subTasks[0].completed).toBe(true)
  expect(result.timerStartedAt).toBeNull()
  expect(result.timerAccumulated).toBe(0)
  expect(complete(task.id)).toBeNull()
  expect(events('task_complete')).toHaveLength(1)
  expect(events('task_complete')[0].details).toEqual({ entityId: task.id, completionId: result.completionId,
    actualMinutes: result.actualMinutes, categoryName: 'forge' })
  expect(useTaskStore.getState().getTodayStats()).toEqual({ completedCount: 1, totalXP: 0 })
  expectLegacyRewards()
})

it('keeps completion identity stable across multiple callers and only undoes the requested current receipt', () => {
  const task = useTaskStore.getState().addTask({ title: 'Same name' })
  const other = useTaskStore.getState().addTask({ title: 'Same name' })
  const first = useTaskStore.getState().completeTask(task.id)!
  useTaskStore.getState().completeTask(other.id)
  useGrowthEventStore.getState().addEvent({ type: 'task_complete', title: 'Replayed action',
    details: { entityId: task.id, completionId: first.completionId }, isMilestone: false })
  useGrowthEventStore.getState().addEvent({ type: 'custom_milestone', title: 'Personal note',
    details: { entityId: task.id, completionId: first.completionId, description: 'Keep this note' }, isMilestone: true })
  expect(events('task_complete')).toHaveLength(2)
  expect(undoTaskCompletion(task.id, first.completionId)).toBe(true)
  expect(undoTaskCompletion(task.id, first.completionId)).toBe(false)
  expect(events('task_complete').map(event => event.details.entityId)).toEqual([other.id])
  expect(events('custom_milestone')).toHaveLength(1)
  const next = useTaskStore.getState().completeTask(task.id)!
  expect(next.completionId).not.toBe(first.completionId)
  expect(undoTaskCompletion(task.id, first.completionId)).toBe(false)
  expect(currentTask(task.id).status).toBe('done')
  expectLegacyRewards()
})

it('undoes, deletes and restores old task reward records without touching historical balances or inventing events', () => {
  const task = useTaskStore.getState().addTask({ title: 'Legacy task' })
  useTaskStore.getState().updateTask(task.id, { status: 'done', completedAt: new Date().toISOString(),
    completionId: 'legacy-receipt', xpReward: 88, actualMinutes: 45 })
  useGrowthEventStore.getState().addEvent({ type: 'task_complete', title: 'Legacy',
    details: { entityId: task.id, completionId: 'legacy-receipt' }, isMilestone: false })
  expect(undoTaskCompletion(task.id, 'legacy-receipt')).toBe(true)
  expect(currentTask(task.id)).toMatchObject({ xpReward: 88, actualMinutes: 45, status: 'todo' })
  expect(deleteTaskWithRewards(task.id)).toBe(true)
  expect(deleteTaskWithRewards(task.id)).toBe(false)
  useTaskStore.getState().restoreTask(task.id)
  expect(currentTask(task.id)).toMatchObject({ xpReward: 88, actualMinutes: 45, status: 'todo', deletedAt: null })
  expect(events()).toEqual([])
  const result = useTaskStore.getState().completeTask(task.id)!
  expect(result.xpReward).toBe(0)
  expect(deleteTaskWithRewards(task.id)).toBe(true)
  expect(events()).toEqual([])
  expectLegacyRewards()
})

it('does not complete missing, deleted or already completed records or duplicate their history', () => {
  const task = useTaskStore.getState().addTask({ title: 'Task' })
  useTaskStore.getState().completeTask(task.id)
  expect(useTaskStore.getState().completeTask(task.id)).toBeNull()
  useTaskStore.getState().deleteTask(task.id)
  expect(useTaskStore.getState().completeTask(task.id)).toBeNull()
  expect(useTaskStore.getState().completeTask('missing')).toBeNull()
  expect(events()).toEqual([])
  expectLegacyRewards()
})

it('updates the current completion time without rewriting earlier events or creating another completion', () => {
  const task = useTaskStore.getState().addTask({ title: 'Timed task' })
  const done = useTaskStore.getState().completeTask(task.id)!
  useGrowthEventStore.getState().addEvent({ type: 'task_complete', title: 'Past',
    details: { entityId: task.id, completionId: 'older-receipt', actualMinutes: 10 }, isMilestone: false })
  useTaskStore.getState().updateTask(task.id, { actualMinutes: 45, title: 'Renamed' })
  expect(events('task_complete')).toHaveLength(2)
  expect(events('task_complete').find(event => event.details.completionId === done.completionId)?.details.actualMinutes).toBe(45)
  expect(events('task_complete').find(event => event.details.completionId === 'older-receipt')?.details.actualMinutes).toBe(10)
})

it('settles multi-count habits once with real time and no rewards, preserving the partial-cycle undo snapshot', () => {
  const id = addHabit({ targetCount: 2 })
  const child = makeSubHabit('Nested recurring work', 0)
  useHabitStore.getState().updateHabit(id, { subHabits: [child], actualMinutes: 10, timerAccumulated: 120 })
  expect(useHabitStore.getState().completeHabit(id)).toMatchObject({ xp: 0, ore: 0, partial: true })
  expect(events()).toEqual([])
  expect(useHabitStore.getState().completeHabit(id)).toMatchObject({ xp: 0, ore: 0, partial: false })
  const action = currentHabit(id).lastAction!
  expect(action.xp).toBe(0)
  expect(useHabitStore.getState().completeHabit(id)).toBeNull()
  expect(currentHabit(id).subHabits[0].completed).toBe(true)
  expect(events('habit_complete')).toHaveLength(1)
  expect(events('habit_complete')[0].details).toMatchObject({ entityId: id, completionId: action.id, actualMinutes: 12 })
  useHabitStore.getState().updateHabit(id, { actualMinutes: 25, subHabits: [{ ...currentHabit(id).subHabits[0], title: 'Later edit' }] })
  expect(events('habit_complete')[0].details.actualMinutes).toBe(25)
  expect(useHabitStore.getState().undoComplete(id, action.id)).toBe(true)
  expect(currentHabit(id)).toMatchObject({ currentCycleCount: 1, totalCompletions: 0, actualMinutes: 12, status: 'active' })
  expect(currentHabit(id).subHabits[0]).toMatchObject({ title: 'Later edit', completed: false })
  expect(events()).toEqual([])
  expectLegacyRewards()
})

it('restores an old rewarded habit snapshot while retaining its old reward balance', () => {
  const id = addHabit()
  useHabitStore.getState().updateHabit(id, { consecutiveCount: 7, totalCompletions: 20, toleranceCharges: 1,
    toleranceNextAt: 30, actualMinutes: 18 })
  useHabitStore.getState().completeHabit(id)
  const action = currentHabit(id).lastAction!
  useHabitStore.getState().updateHabit(id, { title: 'Renamed', difficulty: 5, lastAction: { ...action, xp: 999 } })
  expect(useHabitStore.getState().undoComplete(id, action.id)).toBe(true)
  expect(currentHabit(id)).toMatchObject({ title: 'Renamed', difficulty: 5, consecutiveCount: 7,
    totalCompletions: 20, toleranceCharges: 1, toleranceNextAt: 30, actualMinutes: 18, status: 'active' })
  expect(useHabitStore.getState().undoComplete(id, action.id)).toBe(false)
  expectLegacyRewards()
})

it('records skips separately, restores their own snapshots, and refuses an undo without a reliable legacy snapshot', () => {
  const id = addHabit()
  useHabitStore.getState().updateHabit(id, { consecutiveCount: 9, totalCompletions: 15 })
  useHabitStore.getState().skipHabit(id)
  const skipped = currentHabit(id).lastAction!
  expect(events('habit_skip')).toHaveLength(1)
  expect(events('habit_complete')).toHaveLength(0)
  expect(useHabitStore.getState().skipHabit(id)).toBeNull()
  expect(useHabitStore.getState().getTodayStats()).toEqual({ completed: 0, totalXP: 0 })
  expect(useHabitStore.getState().undoComplete(id, skipped.id)).toBe(true)
  expect(currentHabit(id)).toMatchObject({ consecutiveCount: 9, totalCompletions: 15, status: 'active' })
  expect(events()).toEqual([])
  useHabitStore.getState().completeHabit(id)
  expect(useHabitStore.getState().undoComplete(id, skipped.id)).toBe(false)
  useHabitStore.getState().updateHabit(id, { lastAction: null })
  const legacy = currentHabit(id)
  expect(useHabitStore.getState().undoComplete(id)).toBe(false)
  expect(currentHabit(id)).toBe(legacy)
  expect(events('habit_complete')).toHaveLength(1)
  expectLegacyRewards()
})

it('keeps earlier habit history across local cycles and only undoes the new cycle receipt', () => {
  const id = addHabit()
  useHabitStore.getState().completeHabit(id)
  const old = currentHabit(id).lastAction!
  at('2026-10-24')
  useHabitStore.getState().resetDailyHabits()
  expect(currentHabit(id)).toMatchObject({ status: 'active', actualMinutes: 0, lastAction: null })
  useHabitStore.getState().completeHabit(id)
  const recent = currentHabit(id).lastAction!
  expect(recent.id).not.toBe(old.id)
  expect(events('habit_complete')).toHaveLength(2)
  expect(useHabitStore.getState().undoComplete(id, old.id)).toBe(false)
  expect(useHabitStore.getState().undoComplete(id, recent.id)).toBe(true)
  expect(events('habit_complete').map(event => event.details.completionId)).toEqual([old.id])
  expectLegacyRewards()
})

it.each(['paused', 'archived', 'mastered', 'hidden', 'deleted', 'not_due'] as const)('refuses a %s habit without creating activity or rewards', kind => {
  const id = addHabit(kind === 'not_due' ? { startDate: '2026-10-24' } : {})
  if (kind === 'hidden') useHabitStore.getState().hideHabit(id)
  else if (kind === 'deleted') useHabitStore.getState().deleteHabit(id)
  else if (kind !== 'not_due') useHabitStore.getState().updateHabit(id, { status: kind })
  expect(useHabitStore.getState().completeHabit(id)).toBeNull()
  expect(useHabitStore.getState().skipHabit(id)).toBeNull()
  expect(events()).toEqual([])
  expectLegacyRewards()
})

it('blocks new game events, retains imported game history, and keeps personal milestones and real activity', () => {
  const imported: GrowthEvent = { id: 'legacy-event', type: 'level_up', title: 'Old level', timestamp: '2025-01-01T12:00:00Z',
    details: { oldLevel: 3, newLevel: 4 }, isMilestone: true }
  useGrowthEventStore.setState({ events: [imported] })
  for (const type of ['level_up', 'badge_earned', 'area_level_up', 'prestige'] as const) {
    useGrowthEventStore.getState().addEvent({ type, title: 'Ignored reward', details: {}, isMilestone: true })
  }
  expect(events()).toEqual([imported])
  for (const type of ['milestone', 'custom_milestone', 'habit_miss'] as const) {
    useGrowthEventStore.getState().addEvent({ type, title: 'Real personal record',
      details: { description: 'Preserve user content', xpGained: 999, oreGained: 999 }, isMilestone: true })
  }
  expect(events()).toHaveLength(4)
  expect(events('custom_milestone')[0].details).toEqual({ description: 'Preserve user content' })
  expectLegacyRewards()
})

it.each(['task', 'habit_complete', 'habit_skip'] as const)('rolls back only the current %s receipt when its history write fails, then allows a clean retry', kind => {
  const task = kind === 'task' ? useTaskStore.getState().addTask({ title: 'Work with a write failure' }) : null
  const habitId = kind === 'task' ? null : addHabit()
  if (task) useTaskStore.getState().updateTask(task.id, { status: 'waiting', actualMinutes: 10, timerAccumulated: 120 })
  else useHabitStore.getState().resetDailyHabits()
  const before = task ? currentTask(task.id) : currentHabit(habitId!)
  useGrowthEventStore.getState().addEvent({ type: 'custom_milestone', title: 'Unrelated personal record',
    details: { description: 'Must survive the failed action' }, isMilestone: true })
  const previous = events()[0]
  const realSet = localStorage.setItem.bind(localStorage)
  let failOnce = true
  const write = vi.spyOn(localStorage, 'setItem').mockImplementation((key, value) => {
    if (key === 'anvilite-growth-events' && failOnce) { failOnce = false; throw new Error('synthetic quota') }
    realSet(key, value)
  })
  const perform = () => task ? useTaskStore.getState().completeTask(task.id)
    : kind === 'habit_complete' ? useHabitStore.getState().completeHabit(habitId!) : useHabitStore.getState().skipHabit(habitId!)
  expect(perform).toThrow('synthetic quota')
  expect(task ? currentTask(task.id) : currentHabit(habitId!)).toEqual(before)
  expect(events()).toEqual([previous])
  expect(JSON.parse(localStorage.getItem('anvilite-growth-events')!).state.events).toEqual([previous])
  expectLegacyRewards()
  write.mockRestore()
  expect(perform()).not.toBeNull()
  expect(events()).toHaveLength(2)
  expect(events().filter(event => event.type !== 'custom_milestone')).toHaveLength(1)
  expectLegacyRewards()
})

it.each([
  ['task_undo', 'entity'], ['task_undo', 'history'],
  ['task_delete', 'entity'], ['task_delete', 'history'],
  ['habit_undo', 'entity'], ['habit_undo', 'history'],
] as const)('rolls back a failed %s %s write and retains its receipt, unrelated history and legacy balance for retry', (kind, phase) => {
  const task = kind === 'habit_undo' ? null : useTaskStore.getState().addTask({ title: 'Completed original task' })
  const habitId = kind === 'habit_undo' ? addHabit() : null
  let receipt: string
  if (task) {
    receipt = useTaskStore.getState().completeTask(task.id)!.completionId!
    useTaskStore.getState().updateTask(task.id, { xpReward: 88, actualMinutes: 30 })
  } else {
    useHabitStore.getState().updateHabit(habitId!, { consecutiveCount: 7, totalCompletions: 12, actualMinutes: 20 })
    useHabitStore.getState().completeHabit(habitId!)
    const action = currentHabit(habitId!).lastAction!
    receipt = action.id
    useHabitStore.getState().updateHabit(habitId!, { lastAction: { ...action, xp: 777 } })
  }
  const entityId = task?.id ?? habitId!
  useGrowthEventStore.getState().addEvent({ type: 'custom_milestone', title: 'Personal record sharing the receipt',
    details: { entityId, completionId: receipt, description: 'Do not delete or overwrite' }, isMilestone: true })
  useGrowthEventStore.getState().addEvent({ type: task ? 'task_complete' : 'habit_complete', title: 'Earlier true activity',
    details: { entityId, completionId: 'older-receipt', actualMinutes: 5 }, isMilestone: false })
  const before = task ? currentTask(task.id) : currentHabit(habitId!)
  const beforeEvents = [...events()]
  const realSet = localStorage.setItem.bind(localStorage)
  let failOnce = true
  const failedKey = phase === 'history' ? 'anvilite-growth-events' : task ? 'anvilite-tasks' : 'anvilite-habits'
  const write = vi.spyOn(localStorage, 'setItem').mockImplementation((key, value) => {
    if (key === failedKey && failOnce) { failOnce = false; throw new Error('synthetic undo quota') }
    realSet(key, value)
  })
  const perform = () => kind === 'task_undo' ? undoTaskCompletion(task!.id, receipt)
    : kind === 'task_delete' ? deleteTaskWithRewards(task!.id) : useHabitStore.getState().undoComplete(habitId!, receipt)
  expect(perform).toThrow('synthetic undo quota')
  expect(task ? currentTask(task.id) : currentHabit(habitId!)).toEqual(before)
  expect(events()).toEqual(beforeEvents)
  const savedRecords = JSON.parse(localStorage.getItem(task ? 'anvilite-tasks' : 'anvilite-habits')!).state[task ? 'tasks' : 'habits']
  expect(savedRecords.find((record: { id: string }) => record.id === entityId)).toEqual(before)
  expect(JSON.parse(localStorage.getItem('anvilite-growth-events')!).state.events).toEqual(beforeEvents)
  expectLegacyRewards()
  write.mockRestore()
  expect(perform()).toBe(true)
  expect(events()).toEqual(beforeEvents.filter(event => !(event.type === (task ? 'task_complete' : 'habit_complete') &&
    event.details.entityId === entityId && event.details.completionId === receipt)))
  expect(events('custom_milestone')[0].details.description).toBe('Do not delete or overwrite')
  expect(perform()).toBe(false)
  expectLegacyRewards()
})
