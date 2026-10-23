import { beforeEach, afterEach, expect, it, vi } from 'vitest'
import { useTaskStore } from '@/stores/taskStore'
import { useHabitStore } from '@/stores/habitStore'
import { useCharacterStore } from '@/stores/characterStore'
import { useDashboardStore } from '@/stores/dashboardStore'
import { useGrowthEventStore } from '@/stores/growthEventStore'
import { applyImportPayload, buildExportPayload, parseImportText, serializeExportData } from '@/utils/dataExport'
import { makeSubHabit } from '@/utils/subTaskUtils'
import { undoTaskCompletion } from '@/utils/taskCompletion'

// Production regression coverage from the September review.
beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-09-11T12:00:00'))
  localStorage.clear()
  useTaskStore.setState({ tasks: [] })
  useHabitStore.setState({ habits: [] })
  useGrowthEventStore.setState({ events: [] })
  useCharacterStore.setState({ character: { ...useCharacterStore.getInitialState().character } })
  useDashboardStore.getState().resetLayout()
})
afterEach(() => vi.useRealTimers())

it('an old undo action cannot undo a newer habit completion', () => {
  const id = habit()
  const s = useHabitStore.getState()
  s.completeHabit(id)
  const first = useHabitStore.getState().habits[0].lastAction!.id
  expect(s.undoComplete(id, first)).toBe(true)
  s.completeHabit(id)
  expect(s.undoComplete(id, first)).toBe(false)
  expect(useHabitStore.getState().habits[0].status).toBe('completed_today')
})

it('rejects malformed custom groups without writing storage', () => {
  const payload = JSON.parse(serializeExportData())
  payload.data.tasks.customTaskGroups = [null]
  const spy = vi.spyOn(localStorage, 'setItem')
  expect(applyImportPayload(payload).success).toBe(false)
  expect(spy).not.toHaveBeenCalled()
  spy.mockRestore()
})

it('preserves subhabit order and nested content after hydration', async () => {
  const id = habit()
  const a = makeSubHabit('A', 0)
  const b = makeSubHabit('B', 1)
  a.subHabits = [makeSubHabit('Nested', 0)]
  useHabitStore.getState().updateHabit(id, { subHabits: [a, b] })
  useHabitStore.getState().reorderSubHabits(id, null, [b.id, a.id])
  await useHabitStore.persist.rehydrate()
  const children = useHabitStore.getState().habits[0].subHabits
  expect(children.map(c => c.title)).toEqual(['B', 'A'])
  expect(children[1].subHabits[0].title).toBe('Nested')
})

function habit(targetCount = 1) {
  useHabitStore.getState().addHabit({
    title: 'Audit habit', category: 'other', difficulty: 3,
    repeatType: 'daily', startDate: '2026-09-01', endDate: null,
    targetCount,
  } as Parameters<ReturnType<typeof useHabitStore.getState>['addHabit']>[0])
  return useHabitStore.getState().habits.at(-1)!.id
}

it('control: editing task duration preserves completed descendants at store level', () => {
  const s = useTaskStore.getState()
  const task = s.addTask({ title: 'Audit task' })
  s.addSubTask(task.id, 'Child')
  s.completeTask(task.id)
  s.updateTask(task.id, { actualMinutes: 25 })
  expect(useTaskStore.getState().tasks[0].subTasks[0].completed).toBe(true)
})

it('skip and undo preserve XP', () => {
  const id = habit()
  useCharacterStore.setState({ character: { ...useCharacterStore.getState().character, totalXP: 100, ore: 100 } })
  useHabitStore.getState().skipHabit(id)
  useHabitStore.getState().undoComplete(id)
  expect(useCharacterStore.getState().character.totalXP).toBe(100)
})

it('accepts a backup containing a completed habit recovery snapshot', () => {
  const id = habit()
  useHabitStore.getState().completeHabit(id)
  expect(parseImportText(serializeExportData()).success).toBe(true)
})

it('undo restores completion date and today statistics', () => {
  const id = habit()
  useHabitStore.getState().completeHabit(id)
  useHabitStore.getState().undoComplete(id)
  expect(useHabitStore.getState().habits[0].status).toBe('active')
  expect(useHabitStore.getState().getTodayStats().completed).toBe(0)
})

it('next day clears checked subhabits and partial daily counts', () => {
  const id = habit()
  useHabitStore.getState().updateHabit(id, { subHabits: [makeSubHabit('Child', 0)] })
  useHabitStore.getState().completeHabit(id)
  const partialId = habit(3)
  useHabitStore.getState().completeHabit(partialId)
  vi.setSystemTime(new Date('2026-09-12T12:00:00'))
  useHabitStore.getState().resetDailyHabits()
  const [completed, partial] = useHabitStore.getState().habits
  expect(completed.status).toBe('active')
  expect(completed.subHabits[0].completed).toBe(false)
  expect(partial.currentCycleCount).toBe(0)
})

it('restore uses the dashboard persistence version and restores the layout', async () => {
  useDashboardStore.getState().updateCard('tasks', { col: 7 })
  const payload = JSON.parse(serializeExportData())
  useDashboardStore.getState().resetLayout()
  expect(applyImportPayload(payload)).toEqual({ success: true })
  expect(JSON.parse(localStorage.getItem('anvilite-dashboard')!).version).toBe(3)
  const errors = vi.spyOn(console, 'error').mockImplementation(() => {})
  try {
    await useDashboardStore.persist.rehydrate()
    expect(useDashboardStore.getState().layout.find(c => c.id === 'tasks')!.col).toBe(7)
    expect(errors).not.toHaveBeenCalled()
  } finally { errors.mockRestore() }
})

it('backup validation rejects malformed task records', () => {
  const payload = JSON.parse(serializeExportData(buildExportPayload()))
  payload.data.tasks.tasks = [null]
  expect(parseImportText(JSON.stringify(payload)).success).toBe(false)
})

it('settling another timer session adds to previous actual minutes', () => {
  const s = useTaskStore.getState()
  const task = s.addTask({ title: 'Timer task' })
  s.updateTask(task.id, { actualMinutes: 30 })
  s.startTask(task.id)
  vi.advanceTimersByTime(10 * 60 * 1000)
  s.completeTask(task.id)
  expect(useTaskStore.getState().tasks[0].actualMinutes).toBe(40)
})

it('undo preserves balances and identifies the completion after habit renaming and difficulty changes', () => {
  const id = habit()
  const result = useHabitStore.getState().completeHabit(id)!
  useCharacterStore.getState().gainXPAndOre(result.xp, result.ore)
  const record = useHabitStore.getState().habits[0].lastAction!
  useGrowthEventStore.getState().addEvent({ type: 'habit_complete', title: 'Old name',
    details: { entityId: id, completionId: record.id }, isMilestone: false })
  useHabitStore.getState().updateHabit(id, { title: 'Renamed', difficulty: 5 })
  useHabitStore.getState().undoComplete(id)
  expect(useCharacterStore.getState().character.totalXP).toBe(0)
  expect(useCharacterStore.getState().character.ore).toBe(result.ore)
  expect(useGrowthEventStore.getState().events.filter(e => e.type === 'habit_complete')).toHaveLength(0)
  useHabitStore.getState().undoComplete(id)
  expect(useCharacterStore.getState().character.totalXP).toBe(0)
})

it('undo restores a multi-count cycle and completed subtasks to their prior state', () => {
  const id = habit(3)
  useHabitStore.getState().updateHabit(id, { subHabits: [makeSubHabit('Child', 0)] })
  useHabitStore.getState().completeHabit(id)
  useHabitStore.getState().completeHabit(id)
  useHabitStore.getState().completeHabit(id)
  useHabitStore.getState().undoComplete(id)
  const h = useHabitStore.getState().habits[0]
  expect(h.currentCycleCount).toBe(2)
  expect(h.subHabits[0].completed).toBe(false)
  expect(h.lastDueAt).toBeNull()
})

it('does not complete the same habit cycle twice', () => {
  const id = habit()
  expect(useHabitStore.getState().completeHabit(id)).not.toBeNull()
  expect(useHabitStore.getState().completeHabit(id)).toBeNull()
  expect(useHabitStore.getState().habits[0].totalCompletions).toBe(1)
})

it('retains partial progress inside a custom cycle but resets it on the next cycle', () => {
  const id = habit(3)
  useHabitStore.getState().updateHabit(id, { repeatType: 'custom', customIntervalDays: 3, startDate: '2026-09-11' })
  useHabitStore.getState().completeHabit(id)
  vi.setSystemTime(new Date('2026-09-12T12:00:00'))
  useHabitStore.getState().resetDailyHabits()
  expect(useHabitStore.getState().habits[0].currentCycleCount).toBe(1)
  vi.setSystemTime(new Date('2026-09-14T12:00:00'))
  useHabitStore.getState().resetDailyHabits()
  expect(useHabitStore.getState().habits[0].currentCycleCount).toBe(0)
})

it('keeps hidden dashboard cards hidden after reload', async () => {
  useDashboardStore.getState().removeCard('flows')
  useDashboardStore.getState().removeCard('inspiration')
  await useDashboardStore.persist.rehydrate()
  expect(useDashboardStore.getState().visibleCards).not.toContain('flows')
  expect(useDashboardStore.getState().visibleCards).not.toContain('inspiration')
})

it('keeps embedded completed subitems when migration flags are absent on restore', async () => {
  const s = useTaskStore.getState()
  const task = s.addTask({ title: 'Restore task' })
  s.addSubTask(task.id, 'Child')
  s.completeTask(task.id)
  await useTaskStore.persist.rehydrate()
  expect(useTaskStore.getState().tasks[0].subTasks[0].completed).toBe(true)
})

it('rolls all slices back after an interrupted import', () => {
  const payload = JSON.parse(serializeExportData())
  localStorage.setItem('anvilite-character', 'original-character')
  localStorage.setItem('anvilite-tasks', 'original-tasks')
  const realSet = localStorage.setItem.bind(localStorage)
  let once = true
  const spy = vi.spyOn(localStorage, 'setItem').mockImplementation((key, value) => {
    if (key === 'anvilite-tasks' && once) { once = false; throw new Error('quota') }
    realSet(key, value)
  })
  try {
    expect(applyImportPayload(payload)).toEqual({ success: false, error: 'write_failed' })
    expect(localStorage.getItem('anvilite-character')).toBe('original-character')
    expect(localStorage.getItem('anvilite-tasks')).toBe('original-tasks')
  } finally { spy.mockRestore() }
})

it('undo identifies the correct completion among same-title tasks and is idempotent', () => {
  const s = useTaskStore.getState()
  const a = s.addTask({ title: 'Same' })
  const b = s.addTask({ title: 'Same' })
  useCharacterStore.setState({ character: { ...useCharacterStore.getState().character, totalXP: 100, ore: 100 } })
  for (const task of [a, b]) {
    const done = s.completeTask(task.id)!
    expect(done.xpReward).toBe(0)
    useGrowthEventStore.getState().addEvent({ type: 'task_complete', title: 'Same',
      details: { entityId: task.id, completionId: done.completionId }, isMilestone: false })
  }
  expect(undoTaskCompletion(a.id)).toBe(true)
  expect(undoTaskCompletion(a.id)).toBe(false)
  expect(useCharacterStore.getState().character.totalXP).toBe(100)
  expect(useGrowthEventStore.getState().events.filter(e => e.type === 'task_complete').map(e => e.details.entityId)).toEqual([b.id])
})
