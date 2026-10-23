import { afterEach, beforeEach, expect, it, vi } from 'vitest'

const memoryStorage = localStorage
const memorySessionStorage = sessionStorage
let tasks: typeof import('@/stores/taskStore')['useTaskStore']
let dashboard: typeof import('@/stores/dashboardStore')['useDashboardStore']
let data: typeof import('./dataExport')

beforeEach(async () => {
  vi.resetModules()
  vi.stubGlobal('localStorage', memoryStorage)
  vi.stubGlobal('sessionStorage', memorySessionStorage)
  localStorage.clear()
  vi.stubGlobal('window', { localStorage, location: { reload: vi.fn() }, addEventListener: vi.fn() })
  localStorage.setItem('anvilite-subtask-migration-v3', 'synthetic-current-format')
  localStorage.setItem('anvilite-migration-timer-tags-v031', 'synthetic-current-format')
  data = await import('./dataExport')
  tasks = (await import('@/stores/taskStore')).useTaskStore
  dashboard = (await import('@/stores/dashboardStore')).useDashboardStore
})
afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})
function backup() { return JSON.parse(data.serializeExportData()) }
async function coldReload() {
  vi.resetModules()
  tasks = (await import('@/stores/taskStore')).useTaskStore
  dashboard = (await import('@/stores/dashboardStore')).useDashboardStore
}
function taskState() { return structuredClone(tasks.getState().tasks) }
function dashboardState() {
  const { layout, visibleCards } = dashboard.getState()
  return structuredClone({ layout, visibleCards })
}

it('saves a supplied custom hex color on creation and uses null for new automatic-color tasks', () => {
  const manual = tasks.getState().addTask({ title: 'Manual color', backgroundColor: '#A1b2C3', priority: 'high' })
  const automatic = tasks.getState().addTask({ title: 'Automatic color' })
  const explicitAutomatic = tasks.getState().addTask({ title: 'Explicit automatic', backgroundColor: null })
  expect(manual.backgroundColor).toBe('#A1b2C3')
  expect(automatic.backgroundColor).toBeNull()
  expect(explicitAutomatic.backgroundColor).toBeNull()
})

it('keeps manual color when priority changes and returns to automatic color without resetting task content or status', () => {
  const task = tasks.getState().addTask({ title: 'Await reply', backgroundColor: '#334455', category: 'forge', tags: ['preserve'] })
  tasks.getState().addSubTask(task.id, 'Sent context')
  tasks.getState().startTask(task.id)
  tasks.getState().waitTask(task.id)
  const before = structuredClone(tasks.getState().tasks.find(item => item.id === task.id)!)
  tasks.getState().updateTask(task.id, { priority: 'urgent' })
  expect(tasks.getState().tasks.find(item => item.id === task.id)?.backgroundColor).toBe('#334455')
  tasks.getState().updateTask(task.id, { backgroundColor: null })
  const restored = tasks.getState().tasks.find(item => item.id === task.id)!
  expect(restored).toEqual({ ...before, priority: 'urgent', backgroundColor: null, updatedAt: restored.updatedAt })
  expect(restored.status).toBe('waiting')
  expect(restored.timerStartedAt).toBeNull()
})

it('persists manual and automatic colors across a cold store restart', async () => {
  tasks.getState().addTask({ title: 'Manual', backgroundColor: '#fFaA00' })
  tasks.getState().addTask({ title: 'Automatic', backgroundColor: null })
  const expected = taskState()
  await coldReload()
  expect(taskState()).toEqual(expected)
})

it('round trips custom colors and absent historical color fields through export/apply/cold reload', async () => {
  const manual = tasks.getState().addTask({ title: 'Manual', backgroundColor: '#123AbC', priority: 'low' })
  const automatic = tasks.getState().addTask({ title: 'Automatic', backgroundColor: null })
  const legacy = tasks.getState().addTask({ title: 'Historical task' })
  const id = dashboard.getState().addTaskCard()
  dashboard.getState().setTaskCardFilter(id, { mode: 'single', categories: ['forge'] })
  const incoming = backup()
  delete incoming.data.tasks.tasks.find((item: { id: string }) => item.id === legacy.id).backgroundColor
  tasks.getState().updateTask(manual.id, { backgroundColor: '#000000' })
  dashboard.getState().resetLayout()
  expect(data.applyImportPayload(incoming)).toEqual({ success: true })
  await coldReload()
  expect(tasks.getState().tasks.find(item => item.id === manual.id)?.backgroundColor).toBe('#123AbC')
  expect(tasks.getState().tasks.find(item => item.id === automatic.id)?.backgroundColor).toBeNull()
  expect(tasks.getState().tasks.find(item => item.id === legacy.id)).not.toHaveProperty('backgroundColor')
  expect(dashboardState()).toEqual(incoming.data.dashboard)
})

it.each([
  'red', '#123', '#12345', '#12345678', 'rgb(1, 2, 3)', 'var(--color-danger)',
  'url(https://example.invalid/color)', '#GGHHII', ' #123456', '', 42, {},
])('rejects non-hex task color %j before writing any store', async invalid => {
  tasks.getState().addTask({ title: 'Preserve original', backgroundColor: '#aabbcc' })
  dashboard.getState().addTaskCard()
  const expectedTasks = taskState()
  const expectedDashboard = dashboardState()
  const incoming = backup()
  incoming.data.tasks.tasks[0].backgroundColor = invalid
  const writes = vi.spyOn(localStorage, 'setItem')
  expect(data.applyImportPayload(incoming)).toEqual({ success: false, error: 'invalid_tasks' })
  expect(writes).not.toHaveBeenCalled()
  await coldReload()
  expect(taskState()).toEqual(expectedTasks)
  expect(dashboardState()).toEqual(expectedDashboard)
})

it.each(['tasks', 'dynamic'])('rejects duplicate %s layout IDs before writing any store', async kind => {
  tasks.getState().addTask({ title: 'Preserve original', backgroundColor: '#abcdef' })
  const id = dashboard.getState().addTaskCard()
  dashboard.getState().setTaskCardFilter(id, { mode: 'multiple', categories: [] })
  const expectedTasks = taskState()
  const expectedDashboard = dashboardState()
  const incoming = backup()
  const duplicate = incoming.data.dashboard.layout.find((card: { id: string }) => card.id === (kind === 'dynamic' ? id : 'tasks'))
  incoming.data.dashboard.layout.push({ ...duplicate, row: 66 })
  incoming.data.tasks.tasks[0].title = 'Must not overwrite original'
  const writes = vi.spyOn(localStorage, 'setItem')
  expect(data.applyImportPayload(incoming)).toEqual({ success: false, error: 'invalid_dashboard' })
  expect(writes).not.toHaveBeenCalled()
  await coldReload()
  expect(taskState()).toEqual(expectedTasks)
  expect(dashboardState()).toEqual(expectedDashboard)
})
