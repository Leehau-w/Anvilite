import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { createMcpService } from './service'
import type { McpMethod, McpPermissions, McpResult } from './contracts'
import { canonicalJSON, versionOf } from './version'
import { useTaskStore } from '@/stores/taskStore'
import { useHabitStore } from '@/stores/habitStore'
import { useSOPStore } from '@/stores/sopStore'
import { useGrowthEventStore } from '@/stores/growthEventStore'
import { useCharacterStore } from '@/stores/characterStore'
import { useAreaStore } from '@/stores/areaStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { habitDefaults } from './validation'
import type { Task } from '@/types/task'
import type { Habit } from '@/types/habit'
import type { SOP } from '@/types/sop'

const originalCharacter = structuredClone(useCharacterStore.getState().character)
const originalAreas = structuredClone(useAreaStore.getState().areas)
let permissions: McpPermissions
let current: boolean
let sessionCounter = 0
let service: ReturnType<typeof createMcpService>
const fullAccess = (): McpPermissions => ({ tasks: { read: true, write: true }, habits: { read: true, write: true }, flows: { read: true, write: true } })
function makeService(sessionId?: string) {
  return createMcpService({ accountId: 'default', sessionId: sessionId ?? 'test-session-' + ++sessionCounter,
    getPermissions: () => permissions, isCurrent: () => current })
}
function success<T = Record<string, unknown>>(result: McpResult): T {
  expect(result.ok, JSON.stringify(result)).toBe(true)
  if (!result.ok) throw new Error(result.error.code)
  return result.data as T
}
function failure(result: McpResult, code: string) { expect(result).toMatchObject({ ok: false, error: { code } }) }
async function call(method: McpMethod, params: Record<string, unknown> = {}) { return service.handle({ method, params }) }
async function collectionVersion(domain: 'tasks' | 'habits' | 'flows') {
  return success<{ collectionVersion: string }>(await call((domain + '_list') as McpMethod)).collectionVersion
}
async function get<T>(domain: 'tasks' | 'habits' | 'flows', id: string) {
  return success<{ record: T; version: string; collectionVersion: string }>(await call((domain + '_get') as McpMethod, { id }))
}
async function createTask(record: Record<string, unknown> = { title: 'Task' }, requestId = 'create-task-1') {
  return success<{ id: string; record: Task; version: string }>(await call('tasks_create', { requestId, expectedVersion: await collectionVersion('tasks'), record }))
}
async function createHabit(record: Record<string, unknown> = { title: 'Habit' }, requestId = 'create-habit-1') {
  return success<{ id: string; record: Habit; version: string }>(await call('habits_create', { requestId, expectedVersion: await collectionVersion('habits'), record }))
}
async function action(domain: 'tasks' | 'habits' | 'flows', entityId: string, action: string, requestId: string, extra: Record<string, unknown> = {}) {
  const record = await get(domain, entityId)
  return call((domain + '_action') as McpMethod, { requestId, expectedVersion: record.version, id: entityId, action, ...extra })
}
beforeEach(() => {
  vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-23T08:00:00Z'))
  localStorage.clear(); permissions = fullAccess(); current = true
  useTaskStore.setState({ tasks: [], lastCategory: 'other', customTaskGroups: [] })
  useHabitStore.setState({ habits: [], customHabitGroups: [] })
  useSOPStore.setState({ folders: [], sops: [], deletedSystemFolderIds: [], deletedSystemSOPIds: [], selectedSOPId: null, collapsedFolderIds: [] })
  useGrowthEventStore.setState({ events: [] })
  useCharacterStore.setState({ character: { ...originalCharacter, totalXP: 700, ore: 100 } })
  useAreaStore.setState({ areas: structuredClone(originalAreas) })
  useSettingsStore.getState().setLanguage('zh')
  service = makeService()
})
afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers() })

describe('MCP reads and validated business operations', () => {
  it('canonicalizes nested JSON and hashes the full content with SHA-256', async () => {
    expect(canonicalJSON({ b: 1, a: { z: 2, x: undefined } })).toBe('{"a":{"z":2},"b":1}')
    expect(await versionOf({ b: 1, a: 2 })).toBe(await versionOf({ a: 2, b: 1 }))
    expect(await versionOf({ a: 2, b: 1 })).not.toBe(await versionOf({ a: 3, b: 1 }))
  })
  it('provides permitted context and bounded pagination whose cursors expire on any change', async () => {
    for (let i = 0; i < 4; i++) useTaskStore.getState().addTask({ title: 'Item ' + i })
    const context = success<{ accountId: string; collectionVersions: { tasks: string }; categories: { id: string }[] }>(await call('get_context'))
    expect(context.accountId).toBe('default'); expect(context.categories.some(category => category.id === 'other')).toBe(true)
    const first = success<{ items: unknown[]; nextCursor: string; collectionVersion: string }>(await call('tasks_list', { limit: 2 }))
    expect(first.items).toHaveLength(2); expect(first.collectionVersion).toBe(context.collectionVersions.tasks)
    const next = success<{ items: unknown[]; nextCursor: null }>(await call('tasks_list', { limit: 2, cursor: first.nextCursor }))
    expect(next.items).toHaveLength(2); expect(next.nextCursor).toBeNull()
    useTaskStore.getState().addTask({ title: 'Later' })
    failure(await call('tasks_list', { limit: 2, cursor: first.nextCursor }), 'cursor_expired')
    failure(await call('tasks_list', { limit: 101 }), 'invalid_arguments')
  })
  it('does not allow writes or expose a denied domain when only read is granted', async () => {
    const version = await collectionVersion('tasks')
    permissions.tasks.write = false
    success(await call('tasks_list'))
    failure(await call('tasks_create', { requestId: 'readonly-create', expectedVersion: version, record: { title: 'No' } }), 'permission_denied')
    permissions.tasks.read = false
    failure(await call('tasks_list'), 'permission_denied')
    const context = success<{ collectionVersions: Record<string, string> }>(await call('get_context'))
    expect(context.collectionVersions.tasks).toBeUndefined(); expect(useTaskStore.getState().tasks).toEqual([])
    expect(localStorage.getItem('anvilite-mcp-receipts')).toBeNull()
  })
  it('creates all explicit supported task and habit content without silently dropping actual time', async () => {
    const task = await createTask({ title: '邮件', category: 'home', priority: 'high', difficulty: 4, dueDate: null,
      description: 'Rich text stays plain here', actualMinutes: 42, tags: ['work'], backgroundColor: '#bfa9a3' })
    expect(task.record).toMatchObject({ title: '邮件', category: 'home', actualMinutes: 42, tags: ['work'], priority: 'high', backgroundColor: '#bfa9a3', status: 'todo' })
    const habit = await createHabit({ title: 'Reading', actualMinutes: 12, repeatType: 'weekly', weeklyMode: 'strict', weeklyDays: [5], targetCount: 2 })
    expect(habit.record).toMatchObject({ actualMinutes: 12, weeklyDays: [5], targetCount: 2, totalCompletions: 0, currentCycleCount: 0 })
    expect(useCharacterStore.getState().character).toMatchObject({ totalXP: 700, ore: 100 })
  })
  it('rejects protected fields, unknown categories, invalid dates and invalid schedules before writing intent', async () => {
    const version = await collectionVersion('tasks')
    for (const record of [{ title: 'No', status: 'done' }, { title: 'No', id: 'forged' }, { title: 'No', category: 'missing-category' }, { title: 'No', dueDate: '2026-02-31' }, { title: 'No', actualMinutes: -1 }]) {
      failure(await call('tasks_create', { requestId: 'invalid-' + JSON.stringify(record), expectedVersion: version, record }), 'invalid_arguments')
    }
    failure(await call('habits_create', { requestId: 'invalid-week', expectedVersion: await collectionVersion('habits'), record: { title: 'No', repeatType: 'weekly', weeklyMode: 'strict', weeklyDays: [] } }), 'invalid_arguments')
    failure(await call('habits_create', { requestId: 'invalid-count', expectedVersion: await collectionVersion('habits'), record: { title: 'No', currentCycleCount: 3 } }), 'invalid_arguments')
    expect(useTaskStore.getState().tasks).toHaveLength(0); expect(useHabitStore.getState().habits).toHaveLength(0)
    expect(localStorage.getItem('anvilite-mcp-receipts')).toBeNull()
  })
  it('uses task completion, waiting, undo and deletion actions without rewards or duplicate history', async () => {
    const task = await createTask()
    useTaskStore.getState().addSubTask(task.id, 'Nested')
    success(await action('tasks', task.id, 'start', 'task-start-1'))
    vi.advanceTimersByTime(90000)
    success(await action('tasks', task.id, 'wait', 'task-wait-1'))
    expect(useTaskStore.getState().tasks[0]).toMatchObject({ status: 'waiting', timerStartedAt: null, timerAccumulated: 90 })
    success(await action('tasks', task.id, 'resume', 'task-resume-1'))
    expect(useTaskStore.getState().tasks[0].timerStartedAt).toBeNull()
    success(await action('tasks', task.id, 'complete', 'task-complete-1'))
    expect(useTaskStore.getState().tasks[0]).toMatchObject({ status: 'done', actualMinutes: 2, subTasks: [{ completed: true }] })
    expect(useGrowthEventStore.getState().events.filter(event => event.type === 'task_complete')).toHaveLength(1)
    success(await action('tasks', task.id, 'undo', 'task-undo-1'))
    expect(useGrowthEventStore.getState().events).toHaveLength(0)
    success(await action('tasks', task.id, 'delete', 'task-delete-1'))
    expect(useTaskStore.getState().tasks[0].deletedAt).toBeTruthy()
    success(await action('tasks', task.id, 'restore', 'task-restore-1'))
    expect(useTaskStore.getState().tasks[0].deletedAt).toBeNull()
    expect(useCharacterStore.getState().character).toMatchObject({ totalXP: 700, ore: 100 })
  })
  it('keeps habit partial counts, full completion, skip and undo through the actual cycle actions', async () => {
    const habit = await createHabit({ title: 'Drink', targetCount: 2 })
    success(await action('habits', habit.id, 'complete', 'habit-partial-1'))
    expect(useHabitStore.getState().habits[0]).toMatchObject({ currentCycleCount: 1, totalCompletions: 0, status: 'active' })
    success(await action('habits', habit.id, 'complete', 'habit-full-1'))
    expect(useHabitStore.getState().habits[0]).toMatchObject({ currentCycleCount: 0, totalCompletions: 1, status: 'completed_today' })
    success(await action('habits', habit.id, 'undo', 'habit-undo-1'))
    expect(useHabitStore.getState().habits[0]).toMatchObject({ currentCycleCount: 1, totalCompletions: 0, status: 'active' })
    success(await action('habits', habit.id, 'skip', 'habit-skip-1'))
    expect(useGrowthEventStore.getState().events.map(event => event.type)).toEqual(['habit_skip'])
    success(await action('habits', habit.id, 'undo', 'habit-skip-undo'))
    expect(useGrowthEventStore.getState().events).toHaveLength(0)
    expect(useHabitStore.getState().habits[0].currentCycleCount).toBe(1)
    expect(useCharacterStore.getState().character).toMatchObject({ totalXP: 700, ore: 100 })
  })
  it('does not reset a habit cycle or mutate storage while serving a read-only query', async () => {
    useHabitStore.getState().addHabit({ ...habitDefaults(), title: 'Old habit', startDate: '2026-10-01' })
    const habit = useHabitStore.getState().habits[0]
    useHabitStore.getState().updateHabit(habit.id, { status: 'completed_today', lastDueAt: '2026-10-22T08:00:00Z', cycleKey: '2026-10-22', currentCycleCount: 1 })
    permissions.habits.write = false
    const before = localStorage.getItem('anvilite-habits')
    success(await call('habits_get', { id: habit.id })); success(await call('habits_list'))
    expect(localStorage.getItem('anvilite-habits')).toBe(before)
    expect(useHabitStore.getState().habits[0].status).toBe('completed_today')
  })
})

describe('MCP conflicts, permissions and durable retries', () => {
  it('detects UI edits with the same updatedAt and nested checklist edits', async () => {
    const task = await createTask()
    const old = await get<Task>('tasks', task.id)
    useTaskStore.getState().updateTask(task.id, { title: 'UI edit' })
    expect(useTaskStore.getState().tasks[0].updatedAt).toBe(old.record.updatedAt)
    failure(await call('tasks_update', { requestId: 'stale-edit-1', id: task.id, expectedVersion: old.version, patch: { title: 'Overwrite' } }), 'version_conflict')
    const latest = await get<Task>('tasks', task.id)
    useTaskStore.getState().addSubTask(task.id, 'New child')
    failure(await call('tasks_update', { requestId: 'stale-child-1', id: task.id, expectedVersion: latest.version, patch: { description: 'Overwrite' } }), 'version_conflict')
    expect(useTaskStore.getState().tasks[0]).toMatchObject({ title: 'UI edit', subTasks: [{ title: 'New child' }] })
  })
  it('detects collection changes before creation and category deletion before assignment', async () => {
    const version = await collectionVersion('tasks')
    useTaskStore.getState().addTask({ title: 'Created in UI' })
    failure(await call('tasks_create', { requestId: 'stale-create-1', expectedVersion: version, record: { title: 'No' } }), 'version_conflict')
    const task = useTaskStore.getState().tasks[0], latest = await get<Task>('tasks', task.id)
    const response = await service.handle({ method: 'tasks_update', params: { requestId: 'category-race', id: task.id, expectedVersion: latest.version, patch: { category: 'arena' } } }, {
      authorize: async () => { useAreaStore.setState({ areas: useAreaStore.getState().areas.filter(area => area.category !== 'arena') }); return true },
    })
    failure(response, 'version_conflict'); expect(useTaskStore.getState().tasks[0].category).toBe('other')
  })
  it('rechecks UI content, session and permission after the async authorization boundary', async () => {
    const task = await createTask(), latest = await get<Task>('tasks', task.id)
    const request = { method: 'tasks_update' as const, params: { requestId: 'async-race-1', id: task.id, expectedVersion: latest.version, patch: { title: 'No' } } }
    failure(await service.handle(request, { authorize: async () => { useTaskStore.getState().updateTask(task.id, { title: 'Manual' }); return true } }), 'version_conflict')
    const reread = await get<Task>('tasks', task.id)
    request.params.expectedVersion = reread.version
    failure(await service.handle(request, { authorize: async () => { permissions.tasks.write = false; return true } }), 'permission_denied')
    permissions.tasks.write = true
    failure(await service.handle(request, { authorize: async () => false }), 'session_expired')
    failure(await service.handle(request, { authorize: async () => { current = false; return true } }), 'session_expired')
    expect(useTaskStore.getState().tasks[0].title).toBe('Manual')
    expect(JSON.parse(localStorage.getItem('anvilite-mcp-receipts')!).receipts).toHaveLength(1)
  })
  it('serializes concurrent identical retries and survives new service/app sessions without duplicate creation', async () => {
    const request = { method: 'tasks_create' as const, params: { requestId: 'parallel-create-1', expectedVersion: await collectionVersion('tasks'), record: { title: 'Only once' } } }
    const results = await Promise.all([service.handle(request), service.handle(request)])
    expect(results[0]).toEqual(results[1]); success(results[0]); expect(useTaskStore.getState().tasks).toHaveLength(1)
    const second = makeService()
    expect(await second.handle(request)).toEqual(results[0]); expect(useTaskStore.getState().tasks).toHaveLength(1)
    failure(await second.handle({ ...request, params: { ...request.params, requestId: 'different-operation' } }), 'version_conflict')
    failure(await second.handle({ ...request, params: { ...request.params, record: { title: 'Different body' } } }), 'request_id_conflict')
  })
  it('allows only one competing creation for a collection version', async () => {
    const version = await collectionVersion('tasks')
    const results = await Promise.all(['a','b'].map(key => call('tasks_create', { requestId: 'competing-' + key, expectedVersion: version, record: { title: key } })))
    expect(results.filter(result => result.ok)).toHaveLength(1)
    expect(results.filter(result => !result.ok && result.error.code === 'version_conflict')).toHaveLength(1)
    expect(useTaskStore.getState().tasks).toHaveLength(1)
  })
  it('replays the original result without reverting a later manual edit', async () => {
    const task = await createTask(), latest = await get<Task>('tasks', task.id)
    const request = { method: 'tasks_update' as const, params: { requestId: 'once-edit-1', id: task.id, expectedVersion: latest.version, patch: { title: 'Agent change' } } }
    const result = await service.handle(request); success(result)
    useTaskStore.getState().updateTask(task.id, { title: 'Later UI edit' })
    expect(await makeService().handle(request)).toEqual(result)
    expect(useTaskStore.getState().tasks[0].title).toBe('Later UI edit')
    const receipt = success<{ status: string; result: McpResult }>(await call('operations_get', { requestId: 'once-edit-1' }))
    expect(receipt.status).toBe('committed'); expect(receipt.result).toEqual(result)
  })
  it('does not count a multi-target habit twice when an identical call is retried from another client', async () => {
    const habit = await createHabit({ title: 'Drink', targetCount: 3 }), latest = await get<Habit>('habits', habit.id)
    const request = { method: 'habits_action' as const, params: { requestId: 'partial-once-1', expectedVersion: latest.version, id: habit.id, action: 'complete' } }
    success(await service.handle(request)); success(await makeService().handle(request))
    expect(useHabitStore.getState().habits[0].currentCycleCount).toBe(1)
    expect(useGrowthEventStore.getState().events).toHaveLength(0)
  })
  it('invalidates old versions across midnight and new renderer sessions', async () => {
    const habit = await createHabit(), latest = await get<Habit>('habits', habit.id)
    vi.setSystemTime(new Date('2026-10-24T08:00:00Z'))
    failure(await call('habits_action', { requestId: 'old-day-write', id: habit.id, action: 'complete', expectedVersion: latest.version }), 'version_conflict')
    const task = useTaskStore.getState().addTask({ title: 'Task' }), read = await get<Task>('tasks', task.id)
    failure(await makeService().handle({ method: 'tasks_update', params: { requestId: 'old-session-write', id: task.id, expectedVersion: read.version, patch: { title: 'No' } } }), 'version_conflict')
  })
  it('does not start a business operation when the durable pending receipt cannot be written', async () => {
    const expectedVersion = await collectionVersion('tasks'), original = localStorage.setItem.bind(localStorage)
    vi.spyOn(localStorage, 'setItem').mockImplementation((key, value) => { if (key.endsWith('-mcp-receipts')) throw new Error('full'); original(key, value) })
    failure(await call('tasks_create', { requestId: 'no-intent-write', expectedVersion, record: { title: 'No' } }), 'storage_unavailable')
    expect(useTaskStore.getState().tasks).toHaveLength(0)
  })
  it('retains an unknown receipt if the action succeeded but committing its result failed, and never reexecutes', async () => {
    const request = { method: 'tasks_create' as const, params: { requestId: 'commit-failure-1', expectedVersion: await collectionVersion('tasks'), record: { title: 'Once' } } }
    const original = localStorage.setItem.bind(localStorage)
    const spy = vi.spyOn(localStorage, 'setItem').mockImplementation((key, value) => {
      if (key.endsWith('-mcp-receipts') && JSON.parse(value).receipts.some((entry: { status: string }) => entry.status === 'committed')) throw new Error('full')
      original(key, value)
    })
    failure(await service.handle(request), 'operation_unknown'); expect(useTaskStore.getState().tasks).toHaveLength(1)
    spy.mockRestore()
    failure(await makeService().handle(request), 'operation_unknown'); expect(useTaskStore.getState().tasks).toHaveLength(1)
    expect(success<{ status: string; outcome: string }>(await call('operations_get', { requestId: request.params.requestId }))).toMatchObject({ status: 'pending', outcome: 'unknown' })
    expect(JSON.parse(localStorage.getItem('anvilite-tasks')!).state.tasks).toHaveLength(1)
  })
  it('never reports success for a store persistence failure or silent receipt-storage failure', async () => {
    const version = await collectionVersion('tasks'), original = localStorage.setItem.bind(localStorage)
    const spy = vi.spyOn(localStorage, 'setItem').mockImplementation((key, value) => { if (key.endsWith('-tasks')) throw new Error('full'); original(key, value) })
    failure(await call('tasks_create', { requestId: 'store-write-fail', expectedVersion: version, record: { title: 'Unknown' } }), 'operation_unknown')
    spy.mockRestore()
    expect(success<{ status: string }>(await call('operations_get', { requestId: 'store-write-fail' })).status).toBe('pending')
    const originalLength = useTaskStore.getState().tasks.length
    service = makeService() // A new renderer session; original pending receipt remains non-replayable.
    vi.spyOn(localStorage, 'setItem').mockImplementation((key, value) => { if (!key.endsWith('-mcp-receipts')) original(key, value) })
    failure(await call('tasks_create', { requestId: 'receipt-noop-fail', expectedVersion: await collectionVersion('tasks'), record: { title: 'No' } }), 'storage_unavailable')
    expect(useTaskStore.getState().tasks).toHaveLength(originalLength)
  })
  it('fails closed on invalid receipt storage and blocks operations after account switching', async () => {
    const version = await collectionVersion('tasks')
    localStorage.setItem('anvilite-mcp-receipts', '{bad json')
    failure(await call('tasks_create', { requestId: 'broken-receipts', expectedVersion: version, record: { title: 'No' } }), 'receipt_storage_invalid')
    current = false
    failure(await call('tasks_list'), 'session_expired')
    expect(useTaskStore.getState().tasks).toHaveLength(0)
  })
})

describe('MCP flow library business operations', () => {
  async function folder(name = 'Agent folder') {
    const listed = success<{ collectionVersion: string }>(await call('flow_folders_list'))
    return success<{ id: string }>(await call('flow_folders_create', { requestId: 'folder-' + name, expectedVersion: listed.collectionVersion, name })).id
  }
  it('creates and edits nested rich-text flows, copies system sources and instantiates independent task checklists', async () => {
    const target = await folder()
    const created = success<{ id: string; record: SOP }>(await call('flows_create', { requestId: 'flow-create-1', expectedVersion: await collectionVersion('flows'), record: {
      title: 'Release', folderId: target, displayStyle: 'numbered', steps: [{ title: 'Prepare', content: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Keep this detail', marks: [{ type: 'bold' }] }] }] }, childSteps: [{ title: 'Check', childSteps: [{ title: 'Leaf' }] }] }],
    } }))
    expect(created.record.steps[0].childSteps[0].childSteps[0].title).toBe('Leaf')
    const read = await get<SOP>('flows', created.id)
    success(await call('flows_update', { requestId: 'flow-edit-1', expectedVersion: read.version, id: created.id, patch: { title: 'Release updated' } }))
    expect(useSOPStore.getState().sops[0].steps[0].content).toEqual(created.record.steps[0].content)
    const instantiated = success<{ id: string; record: Task }>(await action('flows', created.id, 'instantiate', 'flow-to-task-1', { taskCollectionVersion: await collectionVersion('tasks') }))
    expect(instantiated.record).toMatchObject({ title: 'Release updated', subTasks: [{ title: 'Prepare', subTasks: [{ title: 'Check', subTasks: [{ title: 'Leaf' }] }] }] })
    expect(instantiated.record.subTasks[0].id).not.toBe(created.record.steps[0].id)
    const listing = success<{ items: { id: string; isSystem: boolean }[] }>(await call('flows_list', { limit: 100 }))
    const systemId = listing.items.find(item => item.isSystem)!.id
    const moved = success<{ id: string; record: SOP }>(await action('flows', systemId, 'move', 'system-copy-out', { targetFolderId: target }))
    expect(moved.id).not.toBe(systemId); expect(moved.record.folderId).toBe(target)
    expect((await get<SOP>('flows', systemId)).record.isSystem).toBe(true)
  })
  it('requires both domain write grants and both current versions for instantiation', async () => {
    const items = success<{ items: { id: string }[] }>(await call('flows_list'))
    const source = items.items[0].id, read = await get<SOP>('flows', source), taskVersion = await collectionVersion('tasks')
    const request = { method: 'flows_action' as const, params: { requestId: 'instantiate-check', expectedVersion: read.version, id: source, action: 'instantiate', taskCollectionVersion: taskVersion } }
    permissions.tasks.write = false
    failure(await service.handle(request), 'permission_denied'); expect(useTaskStore.getState().tasks).toHaveLength(0)
    permissions.tasks.write = true
    useTaskStore.getState().addTask({ title: 'Concurrent task' })
    failure(await service.handle(request), 'version_conflict'); expect(useTaskStore.getState().tasks).toHaveLength(1)
  })
  it('rejects overdeep steps, forged step IDs, executable rich text and unknown destination folders', async () => {
    const target = await folder(), version = await collectionVersion('flows')
    const tooDeep = [{ title: '1', childSteps: [{ title: '2', childSteps: [{ title: '3', childSteps: [{ title: '4' }] }] }] }]
    for (const steps of [tooDeep, [{ id: 'forged-step', title: 'No' }], [{ title: 'No', content: { type: 'doc', content: [{ type: 'text', text: 'run', marks: [{ type: 'link', attrs: { href: 'javascript:alert(1)' } }] }] } }]]) {
      failure(await call('flows_create', { requestId: 'bad-flow-' + JSON.stringify(steps).length, expectedVersion: version, record: { title: 'No', folderId: target, steps } }), 'invalid_arguments')
    }
    failure(await call('flows_create', { requestId: 'bad-folder-id', expectedVersion: version, record: { title: 'No', folderId: 'missing' } }), 'not_found')
    expect(useSOPStore.getState().sops).toHaveLength(0)
  })
})


describe('MCP safety regression followups', () => {
  it('does not reopen a completed or skipped habit through resume, pause, archive or restore', async () => {
    const habit = await createHabit()
    success(await action('habits', habit.id, 'complete', 'guard-complete'))
    for (const name of ['resume','pause']) failure(await action('habits', habit.id, name, 'guard-' + name), 'invalid_state')
    success(await action('habits', habit.id, 'delete', 'guard-delete'))
    success(await action('habits', habit.id, 'restore', 'guard-restore'))
    failure(await action('habits', habit.id, 'complete', 'guard-complete-again'), 'invalid_state')
    success(await action('habits', habit.id, 'archive', 'guard-archive'))
    failure(await action('habits', habit.id, 'resume', 'guard-unarchive'), 'invalid_state')
    expect(useHabitStore.getState().habits[0].totalCompletions).toBe(1)
    expect(useGrowthEventStore.getState().events.filter(event => event.type === 'habit_complete')).toHaveLength(1)
  })
  it('allows a normal pause/resume but refuses legacy paused or active records with an already closed cycle', async () => {
    const habit = await createHabit()
    success(await action('habits', habit.id, 'pause', 'normal-pause'))
    success(await action('habits', habit.id, 'resume', 'normal-resume'))
    success(await action('habits', habit.id, 'skip', 'legacy-skip'))
    useHabitStore.getState().updateHabit(habit.id, { status: 'paused' })
    failure(await action('habits', habit.id, 'resume', 'legacy-resume'), 'invalid_state')
    useHabitStore.getState().updateHabit(habit.id, { status: 'active' })
    failure(await action('habits', habit.id, 'complete', 'legacy-recomplete'), 'invalid_state')
    failure(await action('habits', habit.id, 'skip', 'legacy-reskip'), 'invalid_state')
    expect(useHabitStore.getState().habits[0].totalCompletions).toBe(0)
    expect(useGrowthEventStore.getState().events.filter(event => event.type === 'habit_skip')).toHaveLength(1)
  })
  it('pauses all further new MCP writes after an unknown write until a new renderer session', async () => {
    const request = { method: 'tasks_create' as const, params: { requestId: 'suspend-commit', expectedVersion: await collectionVersion('tasks'), record: { title: 'Once' } } }
    const original = localStorage.setItem.bind(localStorage)
    const spy = vi.spyOn(localStorage, 'setItem').mockImplementation((key, value) => {
      if (key.endsWith('-mcp-receipts') && JSON.parse(value).receipts.some((entry: { status: string }) => entry.status === 'committed')) throw new Error('full')
      original(key, value)
    })
    failure(await service.handle(request), 'operation_unknown'); spy.mockRestore()
    const context = success<{ writeSuspended: boolean; recovery: string }>(await call('get_context'))
    expect(context.writeSuspended).toBe(true); expect(context.recovery).toContain('Reload')
    failure(await call('tasks_create', { requestId: 'suspended-new', expectedVersion: await collectionVersion('tasks'), record: { title: 'No' } }), 'writes_suspended')
    expect(useTaskStore.getState().tasks).toHaveLength(1)
    success(await call('tasks_get', { id: useTaskStore.getState().tasks[0].id }))
    service = makeService()
    failure(await service.handle(request), 'operation_unknown')
    await createTask({ title: 'New decision after inspection' }, 'after-reload-new')
    expect(useTaskStore.getState().tasks).toHaveLength(2)
  })
  it('never silently evicts old receipts to make room for another write', async () => {
    localStorage.setItem('anvilite-mcp-receipts', JSON.stringify({ version: 1, accountId: 'default', receipts: Array.from({ length: 2000 }, (_, index) => ({
      requestId: 'receipt-' + index, fingerprint: 'hash', method: 'tasks_create', domain: 'tasks', status: 'pending', createdAt: '2026-10-01T00:00:00Z',
    })) }))
    failure(await call('tasks_create', { requestId: 'over-limit-new', expectedVersion: await collectionVersion('tasks'), record: { title: 'No' } }), 'receipt_storage_full')
    expect(useTaskStore.getState().tasks).toHaveLength(0)
    expect(success<{ status: string }>(await call('operations_get', { requestId: 'receipt-0' })).status).toBe('pending')
  })
  it('does not disclose old operation results after their domain read permission is revoked', async () => {
    await createTask()
    permissions.tasks.read = false; permissions.tasks.write = false
    failure(await call('operations_get', { requestId: 'create-task-1' }), 'permission_denied')
  })
  it('merges a single step title patch without removing its rich text, children or sibling steps', async () => {
    const folderId = useSOPStore.getState().addFolder('Flows')
    const flow = success<{ id: string; record: SOP }>(await call('flows_create', { requestId: 'merge-flow-create', expectedVersion: await collectionVersion('flows'), record: {
      title: 'Safe merge', folderId, steps: [
        { title: 'First', time: '09:00', content: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Preserve detailed instructions' }] }] }, childSteps: [{ title: 'Child', childSteps: [{ title: 'Leaf' }] }] },
        { title: 'Second', content: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Preserve sibling' }] }] } },
      ],
    } }))
    const original = structuredClone(flow.record.steps), read = await get<SOP>('flows', flow.id)
    success(await call('flows_update', { requestId: 'merge-step-title', expectedVersion: read.version, id: flow.id,
      patch: { steps: [{ id: original[0].id, title: 'Renamed first' }] } }))
    const changed = (await get<SOP>('flows', flow.id)).record
    expect(changed.steps).toHaveLength(2)
    expect(changed.steps[0]).toEqual({ ...original[0], title: 'Renamed first' })
    expect(changed.steps[1]).toEqual(original[1])
    success(await call('flows_update', { requestId: 'merge-new-child', expectedVersion: (await get<SOP>('flows', flow.id)).version, id: flow.id,
      patch: { steps: [{ id: original[0].id, childSteps: [{ title: 'Additional child' }] }] } }))
    const withNew = (await get<SOP>('flows', flow.id)).record
    expect(withNew.steps[0].childSteps.map(step => step.title)).toEqual(['Child','Additional child'])
    expect(withNew.steps[0].childSteps[0]).toEqual(original[0].childSteps[0])
    failure(await call('flows_update', { requestId: 'forbid-parent-move', expectedVersion: (await get<SOP>('flows', flow.id)).version, id: flow.id,
      patch: { steps: [{ id: original[1].id, childSteps: [{ id: original[0].childSteps[0].id, title: 'Moved' }] }] } }), 'invalid_arguments')
    failure(await call('flows_update', { requestId: 'forbid-step-reorder', expectedVersion: (await get<SOP>('flows', flow.id)).version, id: flow.id,
      patch: { steps: [{ id: original[0].id, sortOrder: 100 }] } }), 'invalid_arguments')
  })
})


it('blocks an import that changes persisted data during authorization and refuses to mint a fresh token for stale memory', async () => {
  const task = await createTask({ title: 'Original' }), latest = await get<Task>('tasks', task.id)
  const { buildExportPayload, applyImportPayload } = await import('@/utils/dataExport')
  const payload = JSON.parse(JSON.stringify(buildExportPayload())) as ReturnType<typeof buildExportPayload>
  payload.data.tasks.tasks[0].title = 'Imported newer task'
  const response = await service.handle({ method: 'tasks_update', params: {
    requestId: 'import-write-race', id: task.id, expectedVersion: latest.version, patch: { title: 'Overwrite from stale memory' },
  } }, { authorize: async () => { expect(applyImportPayload(payload)).toEqual({ success: true }); return true } })
  failure(response, 'reload_required')
  expect(useTaskStore.getState().tasks[0].title).toBe('Original')
  expect(JSON.parse(localStorage.getItem('anvilite-tasks')!).state.tasks[0].title).toBe('Imported newer task')
  failure(await call('tasks_get', { id: task.id }), 'reload_required')
  failure(await call('tasks_update', { requestId: 'after-import-write', id: task.id, expectedVersion: latest.version, patch: { title: 'No' } }), 'reload_required')
  // Durable receipts remain inspectable even though business reads need a reload.
  expect(success<{ status: string }>(await call('operations_get', { requestId: 'create-task-1' })).status).toBe('committed')
})

it('never exposes private cross-domain records, character or raw storage in responses or receipts', async () => {
  useCharacterStore.getState().setName('PRIVATE-NICKNAME-CANARY')
  useHabitStore.getState().addHabit({ ...habitDefaults(), title: 'PRIVATE-HABIT-CANARY', description: 'PRIVATE-HABIT-NOTE' })
  const folder = useSOPStore.getState().addFolder('PRIVATE-FLOW-FOLDER')
  useSOPStore.getState().addSOP({ folderId: folder, title: 'PRIVATE-FLOW-CANARY', displayStyle: 'numbered', steps: [], isSystem: false })
  permissions.habits = { read: false, write: false }; permissions.flows = { read: false, write: false }
  service = makeService()
  const context = await call('get_context')
  const task = await createTask({ title: 'Public authorized task' })
  const responses = [context, await call('tasks_get', { id: task.id }), await call('tasks_list'), await call('operations_get', { requestId: 'create-task-1' })]
  const serialized = JSON.stringify(responses) + localStorage.getItem('anvilite-mcp-receipts')
  for (const secret of ['PRIVATE-NICKNAME-CANARY','PRIVATE-HABIT-CANARY','PRIVATE-HABIT-NOTE','PRIVATE-FLOW-FOLDER','PRIVATE-FLOW-CANARY']) expect(serialized).not.toContain(secret)
  expect(serialized).not.toContain('"raw":'); expect(serialized).not.toContain('persistedRevision')
  const versions = success<{ collectionVersions: Record<string, string> }>(context).collectionVersions
  expect(versions.tasks).toMatch(/^v1:[a-f0-9]{64}$/)
  expect(versions.habits).toBeUndefined(); expect(versions.flows).toBeUndefined()
})
