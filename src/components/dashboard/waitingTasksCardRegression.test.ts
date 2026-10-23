// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { beforeEach, afterEach, expect, it, vi } from 'vitest'
import type { DragEvent as ReactDragEvent } from 'react'

vi.hoisted(() => {
  vi.stubGlobal('window', document.defaultView)
  vi.stubGlobal('localStorage', document.defaultView!.localStorage)
})
vi.mock('framer-motion', async importOriginal => ({
  ...await importOriginal<typeof import('framer-motion')>(),
  AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
}))

import { WaitingTasksCard } from './WaitingTasksCard'
import { Dashboard } from './Dashboard'
import { useTaskStore } from '@/stores/taskStore'
import { useCharacterStore } from '@/stores/characterStore'
import { useGrowthEventStore } from '@/stores/growthEventStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { useDashboardStore, DEFAULT_LAYOUT } from '@/stores/dashboardStore'
import { beginTaskDrag, endTaskDrag, TASK_DRAG_MIME } from '@/utils/taskDrag'
import { zh } from '@/i18n/zh'
import { en } from '@/i18n/en'

let container: HTMLDivElement
let root: Root
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  localStorage.clear()
  useTaskStore.setState({ tasks: [], customTaskGroups: [] })
  useCharacterStore.setState({ character: { ...useCharacterStore.getInitialState().character } })
  useGrowthEventStore.setState({ events: [] })
  useSettingsStore.getState().setLanguage('zh')
  useDashboardStore.setState({ layout: DEFAULT_LAYOUT.map(card => ({ ...card })), visibleCards: ['tasks', 'waiting'] })
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
})
afterEach(async () => {
  endTaskDrag()
  await act(async () => { root.unmount() })
  container.remove()
  vi.restoreAllMocks()
})

async function render(node: React.ReactNode = React.createElement(WaitingTasksCard)) {
  await act(async () => { root.render(node) })
}
async function click(node: Element) {
  await act(async () => { node.dispatchEvent(new MouseEvent('click', { bubbles: true })) })
}
function waitingTask(title: string, dueDate: string | null = null) {
  const task = useTaskStore.getState().addTask({ title, dueDate, difficulty: 1 })
  expect(useTaskStore.getState().waitTask(task.id)).toBe(true)
  return task
}
function zone() {
  const node = container.querySelector<HTMLElement>('[data-task-drop-target="waiting"]')
  expect(node).not.toBeNull()
  return node!
}
function transfer() {
  const values = new Map<string, string>()
  return {
    types: [] as string[], effectAllowed: 'none', dropEffect: 'none',
    setData(this: { types: string[] }, type: string, value: string) { values.set(type, value); this.types = [...values.keys()] },
    getData(type: string) { return values.get(type) ?? '' },
  } as unknown as DataTransfer
}
function begin(dataTransfer: DataTransfer, id: string) {
  beginTaskDrag({ dataTransfer } as ReactDragEvent<HTMLElement>, id)
}
async function drag(type: string, dataTransfer: DataTransfer, target: Element = zone(), relatedTarget: Element | null = null) {
  const event = new Event(type, { bubbles: true, cancelable: true })
  Object.defineProperties(event, { dataTransfer: { value: dataTransfer }, relatedTarget: { value: relatedTarget } })
  await act(async () => { target.dispatchEvent(event) })
  return event
}

it.each(['zh', 'en'] as const)('shows an explicit empty state and drop hint (%s)', async lang => {
  const t = lang === 'zh' ? zh : en
  useSettingsStore.getState().setLanguage(lang)
  await render()
  expect(zone().textContent).toContain(t.dashboard_waitingEmpty)
  expect(zone().textContent).not.toContain(t.dashboard_waitingDropHint)
  expect(zone().getAttribute('data-drop-active')).toBe('false')
})

it('lists future, past and undated waiting tasks but excludes hidden, deleted and other statuses', async () => {
  waitingTask('Future external reply', '2099-12-31')
  waitingTask('Undated feedback')
  waitingTask('Past observation', '2001-01-01')
  const hidden = waitingTask('Hidden wait')
  const deleted = waitingTask('Deleted wait')
  useTaskStore.getState().hideTask(hidden.id)
  useTaskStore.getState().deleteTask(deleted.id)
  useTaskStore.getState().addTask({ title: 'Regular todo' })
  const done = useTaskStore.getState().addTask({ title: 'Already completed' })
  useTaskStore.getState().completeTask(done.id)
  await render()
  expect(zone().textContent).toContain('Future external reply')
  expect(zone().textContent).toContain('Undated feedback')
  expect(zone().textContent).toContain('Past observation')
  for (const title of ['Hidden wait', 'Deleted wait', 'Regular todo', 'Already completed']) {
    expect(zone().textContent).not.toContain(title)
  }
})

it.each(['zh', 'en'] as const)('accepts a current task gesture, keeps highlight across descendants and synchronizes its existing record (%s)', async lang => {
  const t = lang === 'zh' ? zh : en
  useSettingsStore.getState().setLanguage(lang)
  const task = useTaskStore.getState().addTask({ title: 'Drop this original task', dueDate: '2099-01-01' })
  const original = { ...task }
  await render()
  const data = transfer()
  begin(data, task.id)
  const over = await drag('dragover', data)
  expect(over.defaultPrevented).toBe(true)
  expect(zone().getAttribute('data-drop-active')).toBe('true')
  expect(zone().textContent).toContain(t.dashboard_waitingDropActive)
  const hint = zone().querySelector('[role="status"]')!
  await drag('dragleave', data, hint, hint)
  expect(zone().getAttribute('data-drop-active')).toBe('true')
  await drag('drop', data)
  expect(zone().getAttribute('data-drop-active')).toBe('false')
  expect(zone().textContent).toContain(original.title)
  const current = useTaskStore.getState().tasks.find(item => item.id === task.id)!
  expect(current.status).toBe('waiting')
  expect(current.dueDate).toBe(original.dueDate)
  expect(useTaskStore.getState().tasks).toHaveLength(1)
})

it('does not modify tasks for external, forged, stale or layout-editing drops', async () => {
  const task = useTaskStore.getState().addTask({ title: 'Unchanged task' })
  await render()
  const original = JSON.stringify(useTaskStore.getState().tasks)
  const external = transfer()
  external.setData('text/plain', task.id)
  external.setData(TASK_DRAG_MIME, task.id)
  expect((await drag('dragover', external)).defaultPrevented).toBe(false)
  await drag('drop', external)
  expect(JSON.stringify(useTaskStore.getState().tasks)).toBe(original)
  const stale = transfer()
  begin(stale, task.id)
  const current = transfer()
  begin(current, task.id)
  await drag('drop', stale)
  expect(JSON.stringify(useTaskStore.getState().tasks)).toBe(original)
  await render(React.createElement(WaitingTasksCard, { layoutEditing: true }))
  expect((await drag('dragover', current)).defaultPrevented).toBe(false)
  await drag('drop', current)
  expect(JSON.stringify(useTaskStore.getState().tasks)).toBe(original)
  expect(zone().getAttribute('data-drop-active')).toBe('false')
})

it('clears drag highlighting when a gesture ends elsewhere without moving the task', async () => {
  const task = useTaskStore.getState().addTask({ title: 'Canceled drag' })
  await render()
  const data = transfer()
  begin(data, task.id)
  await drag('dragover', data)
  expect(zone().getAttribute('data-drop-active')).toBe('true')
  await act(async () => { window.dispatchEvent(new Event('dragend')) })
  expect(zone().getAttribute('data-drop-active')).toBe('false')
  expect(useTaskStore.getState().tasks[0].status).toBe('todo')
})

it('rechecks a dropped task whose status changed during the gesture', async () => {
  const task = useTaskStore.getState().addTask({ title: 'Completed during drag' })
  await render()
  const data = transfer()
  begin(data, task.id)
  await act(async () => { useTaskStore.getState().completeTask(task.id) })
  await drag('drop', data)
  expect(useTaskStore.getState().tasks[0].status).toBe('done')
  expect(zone().querySelectorAll('[data-waiting-task-id]')).toHaveLength(0)
})

it.each(['zh', 'en'] as const)('uses the shared compact row to restore a waiting task to todo (%s)', async lang => {
  const t = lang === 'zh' ? zh : en
  useSettingsStore.getState().setLanguage(lang)
  const task = waitingTask('Restore original task')
  await render()
  const button = Array.from(zone().querySelectorAll('button')).find(item => item.getAttribute('aria-label') === t.task_resumeWaiting)
  expect(button).toBeDefined()
  await click(button!)
  expect(useTaskStore.getState().tasks.find(item => item.id === task.id)?.status).toBe('todo')
  expect(zone().textContent).toContain(t.dashboard_waitingEmpty)
})

it('reuses the original Dashboard drawer for edits and keeps waiting tasks out of the main task card', async () => {
  const task = waitingTask('Edit waiting record')
  useTaskStore.getState().addTask({ title: 'Main card task' })
  await render(React.createElement(Dashboard))
  const taskCard = container.querySelector('[data-dashboard-card="tasks"]')!
  expect(taskCard.textContent).toContain('Main card task')
  expect(taskCard.textContent).not.toContain('Edit waiting record')
  const title = Array.from(zone().querySelectorAll('span')).find(item => item.textContent === task.title)
  expect(title).toBeDefined()
  await click(title!)
  const input = container.querySelector<HTMLInputElement>(`input[placeholder="${zh.taskDrawer_titlePlaceholder}"]`)
  expect(input?.value).toBe(task.title)
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, 'Edited waiting record')
    input!.dispatchEvent(new Event('input', { bubbles: true }))
  })
  await act(async () => { input!.closest('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })) })
  expect(useTaskStore.getState().tasks.find(item => item.id === task.id)).toMatchObject({ title: 'Edited waiting record', status: 'waiting' })
  expect(zone().textContent).toContain('Edited waiting record')
  expect(taskCard.textContent).not.toContain('Edited waiting record')
})
