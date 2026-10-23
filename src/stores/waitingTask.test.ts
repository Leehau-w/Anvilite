import { beforeEach, afterEach, expect, it, vi } from 'vitest'
import { useTaskStore } from './taskStore'
import { useHabitStore } from './habitStore'
import { useCharacterStore } from './characterStore'
import { useGrowthEventStore } from './growthEventStore'
import { makeSubTask } from '@/utils/subTaskUtils'
import { deleteTaskWithRewards, undoTaskCompletion } from '@/utils/taskCompletion'
import { applyImportPayload, parseImportText, serializeExportData } from '@/utils/dataExport'

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-10-22T12:00:00'))
  localStorage.clear()
  useTaskStore.setState({ tasks: [], customTaskGroups: [] })
  useHabitStore.setState({ habits: [], customHabitGroups: [] })
  useGrowthEventStore.setState({ events: [] })
  useCharacterStore.setState({ character: { ...useCharacterStore.getInitialState().character } })
})
afterEach(() => vi.useRealTimers())

function current(id: string) { return useTaskStore.getState().tasks.find(task => task.id === id)! }
function task() {
  return useTaskStore.getState().addTask({
    title: 'Waiting for external feedback', category: 'other', priority: 'high', difficulty: 3,
    dueDate: '2026-10-24', description: 'Keep the agreed context', tags: ['feedback'],
    subTasks: [makeSubTask('Prepare material', 0)],
  })
}
function payload() { return JSON.parse(serializeExportData()) }

it('entering waiting pauses work and preserves task content, elapsed time and reward state', () => {
  const created = task()
  useTaskStore.getState().updateTask(created.id, { actualMinutes: 30, timerAccumulated: 120 })
  useCharacterStore.setState({ character: { ...useCharacterStore.getState().character, totalXP: 100, ore: 100 } })
  useTaskStore.getState().startTask(created.id)
  vi.advanceTimersByTime(3 * 60 * 1000)
  const before = current(created.id)
  const eventsBefore = useGrowthEventStore.getState().events
  expect(useTaskStore.getState().waitTask(created.id)).toBe(true)
  expect(current(created.id)).toEqual({
    ...before, status: 'waiting', timerStartedAt: null, timerAccumulated: 300,
    updatedAt: new Date().toISOString(),
  })
  expect(current(created.id).subTasks).toBe(before.subTasks)
  expect(useCharacterStore.getState().character.totalXP).toBe(100)
  expect(useGrowthEventStore.getState().events).toBe(eventsBefore)
})

it('also pauses a standalone timer that was started while the task remained todo', () => {
  const created = task()
  useTaskStore.getState().startTimer(created.id)
  vi.advanceTimersByTime(90 * 1000)
  expect(current(created.id).status).toBe('todo')
  expect(useTaskStore.getState().waitTask(created.id)).toBe(true)
  expect(current(created.id).timerAccumulated).toBe(90)
  expect(current(created.id).timerStartedAt).toBeNull()
})

it('repeated waiting requests do not count waiting time or make another write', () => {
  const created = task()
  useTaskStore.getState().startTask(created.id)
  vi.advanceTimersByTime(60 * 1000)
  useTaskStore.getState().waitTask(created.id)
  const waiting = current(created.id)
  vi.advanceTimersByTime(48 * 60 * 60 * 1000)
  const write = vi.spyOn(localStorage, 'setItem')
  try {
    expect(useTaskStore.getState().waitTask(created.id)).toBe(false)
    expect(current(created.id)).toBe(waiting)
    expect(write).not.toHaveBeenCalled()
  } finally { write.mockRestore() }
})

it.each(['done', 'deleted', 'hidden', 'missing'] as const)('refuses to wait on a %s task', kind => {
  const created = task()
  if (kind === 'done') useTaskStore.getState().completeTask(created.id)
  if (kind === 'deleted') useTaskStore.getState().deleteTask(created.id)
  if (kind === 'hidden') useTaskStore.getState().hideTask(created.id)
  const before = useTaskStore.getState().tasks
  expect(useTaskStore.getState().waitTask(kind === 'missing' ? 'missing' : created.id)).toBe(false)
  expect(useTaskStore.getState().tasks).toBe(before)
})

it('resuming waiting returns to todo without starting or settling the paused timer', () => {
  const created = task()
  useTaskStore.getState().updateTask(created.id, { actualMinutes: 30, timerAccumulated: 120 })
  useTaskStore.getState().waitTask(created.id)
  vi.advanceTimersByTime(24 * 60 * 60 * 1000)
  expect(useTaskStore.getState().resumeWaitingTask(created.id)).toBe(true)
  expect(current(created.id).status).toBe('todo')
  expect(current(created.id).timerStartedAt).toBeNull()
  expect(current(created.id).timerAccumulated).toBe(120)
  expect(current(created.id).actualMinutes).toBe(30)
  const resumed = current(created.id)
  expect(useTaskStore.getState().resumeWaitingTask(created.id)).toBe(false)
  expect(current(created.id)).toBe(resumed)
})

it('ordinary start and pause actions cannot bypass explicit waiting resumption', () => {
  const created = task()
  useTaskStore.getState().waitTask(created.id)
  const waiting = current(created.id)
  useTaskStore.getState().startTask(created.id)
  useTaskStore.getState().startTimer(created.id)
  useTaskStore.getState().pauseTask(created.id)
  expect(current(created.id)).toBe(waiting)
  useTaskStore.getState().resumeWaitingTask(created.id)
  useTaskStore.getState().startTask(created.id)
  expect(current(created.id).status).toBe('doing')
  expect(current(created.id).timerStartedAt).toBe(new Date().toISOString())
})

it('manual completion from waiting settles only actual work and undo returns to todo', () => {
  const created = task()
  useTaskStore.getState().updateTask(created.id, { actualMinutes: 30 })
  useTaskStore.getState().startTask(created.id)
  vi.advanceTimersByTime(10 * 60 * 1000)
  useTaskStore.getState().waitTask(created.id)
  vi.advanceTimersByTime(3 * 24 * 60 * 60 * 1000)
  const done = useTaskStore.getState().completeTask(created.id)!
  expect(done.status).toBe('done')
  expect(done.actualMinutes).toBe(40)
  expect(done.subTasks[0].completed).toBe(true)
  expect(done.xpReward).toBe(0)
  expect(undoTaskCompletion(created.id, done.completionId)).toBe(true)
  expect(current(created.id).status).toBe('todo')
  expect(current(created.id).timerStartedAt).toBeNull()
  expect(current(created.id).actualMinutes).toBe(40)
  expect(useCharacterStore.getState().character.totalXP).toBe(0)
  expect(undoTaskCompletion(created.id, done.completionId)).toBe(false)
})

it('deleted or hidden waiting tasks cannot resume, while restore retains waiting and paused work', () => {
  const created = task()
  useTaskStore.getState().updateTask(created.id, { actualMinutes: 20, timerAccumulated: 240 })
  useTaskStore.getState().waitTask(created.id)
  deleteTaskWithRewards(created.id)
  expect(useTaskStore.getState().resumeWaitingTask(created.id)).toBe(false)
  useTaskStore.getState().restoreTask(created.id)
  expect(current(created.id).status).toBe('waiting')
  expect(current(created.id).actualMinutes).toBe(20)
  expect(current(created.id).timerAccumulated).toBe(240)
  expect(current(created.id).subTasks[0].title).toBe('Prepare material')
  useTaskStore.getState().hideTask(created.id)
  expect(useTaskStore.getState().resumeWaitingTask(created.id)).toBe(false)
})

it('waiting remains unfinished but does not enter doing or completed statistics', () => {
  const created = task()
  useTaskStore.getState().waitTask(created.id)
  expect(useTaskStore.getState().getActiveTasks().map(t => t.id)).toContain(created.id)
  expect(useTaskStore.getState().tasks.filter(t => t.status === 'doing')).toHaveLength(0)
  expect(useTaskStore.getState().getTodayStats()).toEqual({ completedCount: 0, totalXP: 0 })
})

it('waiting state, nested content and paused time survive export, import and reload', async () => {
  const created = task()
  useTaskStore.getState().updateTask(created.id, { actualMinutes: 30, timerAccumulated: 120 })
  useTaskStore.getState().waitTask(created.id)
  const waiting = current(created.id)
  const incoming = payload()
  expect(parseImportText(JSON.stringify(incoming)).success).toBe(true)
  useTaskStore.setState({ tasks: [] })
  expect(applyImportPayload(incoming)).toEqual({ success: true })
  await useTaskStore.persist.rehydrate()
  expect(current(created.id)).toEqual(waiting)
  useTaskStore.getState().startTask(created.id)
  expect(current(created.id).status).toBe('waiting')
  expect(current(created.id).timerStartedAt).toBeNull()
})

it.each(['todo', 'doing', 'done'] as const)('keeps older %s task records importable without waiting metadata', status => {
  const created = task()
  useTaskStore.getState().updateTask(created.id, { status })
  expect(parseImportText(serializeExportData()).success).toBe(true)
})

it.each([
  ['timerStartedAt', '2026-10-22T12:00:00Z'], ['timerStartedAt', 'invalid'],
  ['timerStartedAt', false], ['timerStartedAt', 0],
  ['timerAccumulated', -1], ['timerAccumulated', '30'], ['actualMinutes', -1],
  ['status', 'awaiting'], ['status', ['waiting']],
] as [string, unknown][])('rejects an invalid waiting %s before writing any backup slice (%j)', (field, value) => {
  const created = task()
  useTaskStore.getState().waitTask(created.id)
  const incoming = payload()
  ;(incoming.data.tasks.tasks[0] as Record<string, unknown>)[field] = value
  const write = vi.spyOn(localStorage, 'setItem')
  try {
    expect(parseImportText(JSON.stringify(incoming)).success).toBe(false)
    expect(applyImportPayload(incoming)).toEqual({ success: false, error: 'invalid_tasks' })
    expect(write).not.toHaveBeenCalled()
  } finally { write.mockRestore() }
})

it('a backwards clock does not subtract previously accumulated work when entering waiting', () => {
  const created = task()
  useTaskStore.getState().updateTask(created.id, { timerAccumulated: 60 })
  useTaskStore.getState().startTask(created.id)
  vi.setSystemTime(new Date('2026-10-22T11:00:00'))
  expect(useTaskStore.getState().waitTask(created.id)).toBe(true)
  expect(current(created.id).timerAccumulated).toBe(60)
})

it('fills missing waiting timer and tag fields after real backup restore even when migration already ran', async () => {
  const created = task()
  useTaskStore.getState().updateTask(created.id, { actualMinutes: 30 })
  useTaskStore.getState().waitTask(created.id)
  const incoming = payload()
  delete incoming.data.tasks.tasks[0].timerStartedAt
  delete incoming.data.tasks.tasks[0].timerAccumulated
  delete incoming.data.tasks.tasks[0].tags
  localStorage.setItem('anvilite-migration-timer-tags-v031', 'already-migrated')
  const parsed = parseImportText(JSON.stringify(incoming))
  expect(parsed.success).toBe(true)
  expect(applyImportPayload(parsed.data!)).toEqual({ success: true })
  await useTaskStore.persist.rehydrate()
  expect(current(created.id).status).toBe('waiting')
  expect(current(created.id).timerStartedAt).toBeNull()
  expect(current(created.id).timerAccumulated).toBe(0)
  expect(current(created.id).tags).toEqual([])
  expect(localStorage.getItem('anvilite-migration-timer-tags-v031')).toBe('already-migrated')
  expect(useTaskStore.getState().resumeWaitingTask(created.id)).toBe(true)
  useTaskStore.getState().startTask(created.id)
  vi.advanceTimersByTime(60 * 1000)
  const done = useTaskStore.getState().completeTask(created.id)!
  expect(Number.isFinite(done.actualMinutes)).toBe(true)
  expect(done.actualMinutes).toBe(31)
  expect(done.timerStartedAt).toBeNull()
  expect(done.timerAccumulated).toBe(0)
})
