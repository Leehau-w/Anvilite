import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { McpPermissions, McpResult } from './contracts'
import type { Task } from '@/types/task'
import type { Habit } from '@/types/habit'

const permissions: McpPermissions = { tasks: { read: true, write: true }, habits: { read: true, write: true }, flows: { read: true, write: true } }
function data<T>(result: McpResult): T {
  expect(result.ok, JSON.stringify(result)).toBe(true)
  if (!result.ok) throw new Error(result.error.code)
  return result.data as T
}
async function cold(accountId: string, sessionId: string) {
  vi.resetModules()
  localStorage.setItem('anvilite-current-account', accountId)
  const [{ createMcpService }, { useTaskStore }, { useHabitStore }] = await Promise.all([
    import('./service'), import('@/stores/taskStore'), import('@/stores/habitStore'),
  ])
  const service = createMcpService({ accountId, sessionId, getPermissions: () => permissions, isCurrent: () => true })
  return { service, tasks: useTaskStore, habits: useHabitStore }
}
beforeEach(() => { vi.resetModules(); localStorage.clear(); vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-23T08:00:00Z')) })
afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); vi.resetModules(); localStorage.removeItem('anvilite-current-account') })

it('cold-reloads durable task and partial-habit receipts without executing again or changing later edits', async () => {
  const first = await cold('account-a', 'app-session-first')
  const taskVersion = data<{ collectionVersion: string }>(await first.service.handle({ method: 'tasks_list', params: {} })).collectionVersion
  const taskRequest = { method: 'tasks_create' as const, params: { requestId: 'cold-task-create', expectedVersion: taskVersion, record: { title: 'One task' } } }
  const taskResponse = await first.service.handle(taskRequest)
  const task = data<{ id: string; record: Task }>(taskResponse)
  first.tasks.getState().updateTask(task.id, { title: 'Later manual title' })
  const habitVersion = data<{ collectionVersion: string }>(await first.service.handle({ method: 'habits_list', params: {} })).collectionVersion
  const createdHabit = data<{ id: string; version: string }>(await first.service.handle({ method: 'habits_create', params: {
    requestId: 'cold-habit-create', expectedVersion: habitVersion, record: { title: 'Three cups', targetCount: 3 },
  } }))
  const habitRequest = { method: 'habits_action' as const, params: { requestId: 'cold-habit-partial', id: createdHabit.id, expectedVersion: createdHabit.version, action: 'complete' } }
  const habitResponse = await first.service.handle(habitRequest)
  data(habitResponse)
  const second = await cold('account-a', 'app-session-second')
  expect(await second.service.handle(taskRequest)).toEqual(taskResponse)
  expect(await second.service.handle(habitRequest)).toEqual(habitResponse)
  expect(second.tasks.getState().tasks).toHaveLength(1)
  expect(second.tasks.getState().tasks[0].title).toBe('Later manual title')
  expect(second.habits.getState().habits[0]).toMatchObject({ currentCycleCount: 1, totalCompletions: 0 })
  const replayWithNewId = await second.service.handle({ ...habitRequest, params: { ...habitRequest.params, requestId: 'stale-token-new-id' } })
  expect(replayWithNewId).toMatchObject({ ok: false, error: { code: 'version_conflict' } })
})

it('isolates account data and receipts and permanently rejects a switched-out renderer binding', async () => {
  const first = await cold('account-a', 'account-a-session')
  const version = data<{ collectionVersion: string }>(await first.service.handle({ method: 'tasks_list', params: {} })).collectionVersion
  const request = { method: 'tasks_create' as const, params: { requestId: 'account-specific-id', expectedVersion: version, record: { title: 'Only A' } } }
  const created = await first.service.handle(request); data(created)
  const taskId = first.tasks.getState().tasks[0].id
  const read = data<{ version: string }>(await first.service.handle({ method: 'tasks_get', params: { id: taskId } }))
  const switched = await first.service.handle({ method: 'tasks_update', params: { requestId: 'switch-race-write', id: taskId, expectedVersion: read.version, patch: { title: 'Wrong account write' } } }, {
    authorize: async () => { localStorage.setItem('anvilite-current-account', 'account-b'); return true },
  })
  expect(switched).toMatchObject({ ok: false, error: { code: 'session_expired' } })
  localStorage.setItem('anvilite-current-account', 'account-a')
  expect(await first.service.handle({ method: 'tasks_list', params: {} })).toMatchObject({ ok: false, error: { code: 'session_expired' } })
  expect(first.tasks.getState().tasks[0].title).toBe('Only A')
  const second = await cold('account-b', 'account-b-session')
  expect(data<{ items: unknown[] }>(await second.service.handle({ method: 'tasks_list', params: {} })).items).toEqual([])
  expect(data<{ status: string }>(await second.service.handle({ method: 'operations_get', params: { requestId: request.params.requestId } })).status).toBe('not_found')
  expect(await second.service.handle(request)).toMatchObject({ ok: false, error: { code: 'version_conflict' } })
  expect(localStorage.getItem('anvilite-account-b-mcp-receipts')).toBeNull()
  const third = await cold('account-a', 'account-a-reconnected')
  expect(await third.service.handle(request)).toEqual(created)
  expect(third.tasks.getState().tasks).toHaveLength(1)
})

it('survives loss of the confirmation after a persisted habit completion without counting it twice on reload', async () => {
  const first = await cold('account-a', 'before-interruption')
  const version = data<{ collectionVersion: string }>(await first.service.handle({ method: 'habits_list', params: {} })).collectionVersion
  const habit = data<{ id: string; version: string }>(await first.service.handle({ method: 'habits_create', params: { requestId: 'interrupted-habit-create', expectedVersion: version, record: { title: 'Once only' } } }))
  const request = { method: 'habits_action' as const, params: { requestId: 'interrupted-completion', id: habit.id, expectedVersion: habit.version, action: 'complete' } }
  const original = localStorage.setItem.bind(localStorage)
  const spy = vi.spyOn(localStorage, 'setItem').mockImplementation((key, value) => {
    if (key === 'anvilite-account-a-mcp-receipts' && JSON.parse(value).receipts.some((entry: { requestId: string; status: string }) => entry.requestId === request.params.requestId && entry.status === 'committed')) throw new Error('confirmation unavailable')
    original(key, value)
  })
  expect(await first.service.handle(request)).toMatchObject({ ok: false, error: { code: 'operation_unknown' } })
  spy.mockRestore()
  const second = await cold('account-a', 'after-interruption')
  expect(await second.service.handle(request)).toMatchObject({ ok: false, error: { code: 'operation_unknown' } })
  expect(second.habits.getState().habits).toHaveLength(1)
  expect(second.habits.getState().habits[0]).toMatchObject({ totalCompletions: 1, status: 'completed_today' })
  const read = data<{ record: Habit }>(await second.service.handle({ method: 'habits_get', params: { id: habit.id } }))
  expect(read.record.lastAction?.kind).toBe('complete')
  expect(data<{ status: string }>(await second.service.handle({ method: 'operations_get', params: { requestId: request.params.requestId } })).status).toBe('pending')
})
