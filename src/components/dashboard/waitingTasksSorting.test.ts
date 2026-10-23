// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { Task } from '@/types/task'

const { reorderHandlers, dragOffsets } = vi.hoisted(() => {
  vi.stubGlobal('window', document.defaultView)
  vi.stubGlobal('localStorage', document.defaultView!.localStorage)
  return {
    reorderHandlers: new Map<string, (ids: string[]) => void>(),
    dragOffsets: new Map<string, { get: () => number; set: (value: number) => void }>(),
  }
})
vi.mock('framer-motion', async importOriginal => ({
  ...await importOriginal<typeof import('framer-motion')>(),
  AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
  useDragControls: () => React.useMemo(() => ({ start: vi.fn(), cancel: vi.fn() }), []),
  Reorder: {
    Group: ({ children, onReorder, ...props }: { children: React.ReactNode; onReorder: (ids: string[]) => void; 'data-waiting-sort-group': string }) => {
      reorderHandlers.set(props['data-waiting-sort-group'], onReorder)
      return React.createElement('div', { 'data-waiting-sort-group': props['data-waiting-sort-group'] }, children)
    },
    Item: ({ children, onDragStart, onDragEnd, onPointerDown, onClickCapture, style, ...props }: {
      children: React.ReactNode; onDragStart: () => void; onDragEnd: () => void
      onPointerDown: React.PointerEventHandler; onClickCapture: React.MouseEventHandler
      style: { y: { get: () => number; set: (value: number) => void } }
      'data-waiting-task-id': string; 'data-waiting-sort-enabled': string
    }) => {
      dragOffsets.set(props['data-waiting-task-id'], style.y)
      return React.createElement('div', {
      'data-waiting-task-id': props['data-waiting-task-id'], 'data-waiting-sort-enabled': props['data-waiting-sort-enabled'],
      onMouseDown: onDragStart, onMouseUp: onDragEnd, onPointerDown, onClickCapture,
    }, children)
    },
  },
}))

import { WaitingTasksCard } from './WaitingTasksCard'
import { useTaskStore } from '@/stores/taskStore'
import { useCharacterStore } from '@/stores/characterStore'
import { useGrowthEventStore } from '@/stores/growthEventStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { sortTasksInGroup } from '@/utils/task'
import { beginTaskDrag, endTaskDrag } from '@/utils/taskDrag'
import { undoTaskCompletion } from '@/utils/taskCompletion'
import { zh } from '@/i18n/zh'

let container: HTMLDivElement
let root: Root
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  localStorage.clear()
  reorderHandlers.clear()
  dragOffsets.clear()
  useTaskStore.setState({ tasks: [], customTaskGroups: [] })
  useCharacterStore.setState({ character: { ...useCharacterStore.getInitialState().character } })
  useGrowthEventStore.setState({ events: [] })
  useSettingsStore.getState().setLanguage('zh')
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
function add(title: string, category = 'home', sortOrder = 0, status: Task['status'] = 'waiting') {
  const task = useTaskStore.getState().addTask({ title, category, difficulty: 1 })
  if (status === 'waiting') useTaskStore.getState().waitTask(task.id)
  useTaskStore.getState().updateTask(task.id, { sortOrder })
  return useTaskStore.getState().tasks.find(item => item.id === task.id)!
}
function zone(cardId = 'waiting') { return container.querySelector<HTMLElement>('[data-waiting-card-id="' + cardId + '"]')! }
function row(id: string, cardId = 'waiting') { return zone(cardId).querySelector<HTMLElement>('[data-waiting-task-id="' + id + '"]')! }
function shown(cardId = 'waiting') { return [...zone(cardId).querySelectorAll('[data-waiting-task-id]')].map(node => node.getAttribute('data-waiting-task-id')) }
function ordered() { return sortTasksInGroup(useTaskStore.getState().tasks.filter(task => task.status === 'waiting' && !task.isHidden && !task.deletedAt)).map(task => task.id) }
async function pointerStart(id: string, cardId = 'waiting') {
  await act(async () => { row(id, cardId).dispatchEvent(new MouseEvent('mousedown', { bubbles: true })) })
}
async function pointerReorder(ids: string[], cardId = 'waiting') {
  await act(async () => { reorderHandlers.get(cardId)!(ids) })
}
async function pointerEnd(id: string, cardId = 'waiting') {
  await act(async () => { row(id, cardId).dispatchEvent(new MouseEvent('mouseup', { bubbles: true })) })
}
function withoutOrder(task: Task) { const { sortOrder: _sortOrder, ...rest } = task; return rest }
function transfer() {
  const values = new Map<string, string>()
  return {
    types: [] as string[], effectAllowed: 'none', dropEffect: 'none',
    setData(this: { types: string[] }, type: string, value: string) { values.set(type, value); this.types = [...values.keys()] },
    getData(type: string) { return values.get(type) ?? '' },
  } as unknown as DataTransfer
}
async function native(type: string, target: Element, dataTransfer: DataTransfer, clientY = 0) {
  const event = new Event(type, { bubbles: true, cancelable: true })
  Object.defineProperties(event, { dataTransfer: { value: dataTransfer }, clientY: { value: clientY } })
  await act(async () => { target.dispatchEvent(event) })
  return event
}
function grip(id: string, cardId = 'waiting') { return row(id, cardId).querySelector('button[draggable="true"]')! }

it('persists pointer sorting, preserves business fields and restores the same order after hydration', async () => {
  const a = add('A', 'home', 0), b = add('B', 'home', 1), c = add('C', 'home', 2)
  const original = useTaskStore.getState().tasks.map(withoutOrder)
  await render()
  await pointerStart(c.id)
  await pointerReorder([c.id, a.id, b.id])
  expect(shown()).toEqual([c.id, a.id, b.id])
  expect(ordered()).toEqual([a.id, b.id, c.id])
  await pointerEnd(c.id)
  expect(ordered()).toEqual([c.id, a.id, b.id])
  expect(useTaskStore.getState().tasks.map(withoutOrder).sort((x, y) => x.id.localeCompare(y.id))).toEqual(original.sort((x, y) => x.id.localeCompare(y.id)))
  const key = useTaskStore.persist.getOptions().name!
  const persisted = localStorage.getItem(key)!
  await act(async () => { useTaskStore.setState({ tasks: [] }) })
  localStorage.setItem(key, persisted)
  await act(async () => { await useTaskStore.persist.rehydrate() })
  expect(shown()).toEqual([c.id, a.id, b.id])
})

it('fills only filtered global slots and synchronizes overlapping cards while leaving excluded records untouched', async () => {
  const a = add('Home A', 'home', 0), b = add('Forge B', 'forge', 1), c = add('Home C', 'home', 2), d = add('Forge D', 'forge', 3)
  const hidden = add('Hidden', 'home', 20), deleted = add('Deleted', 'home', 30), todo = add('Todo', 'home', 40, 'todo')
  useTaskStore.getState().hideTask(hidden.id)
  useTaskStore.getState().deleteTask(deleted.id)
  const excluded = [hidden, deleted, todo].map(task => useTaskStore.getState().tasks.find(item => item.id === task.id)!)
  await render(React.createElement(React.Fragment, null,
    React.createElement(WaitingTasksCard, { filter: { mode: 'single', categories: ['home'] } }),
    React.createElement(WaitingTasksCard, { cardId: 'waiting:second' }),
  ))
  await pointerStart(c.id)
  await pointerReorder([c.id, a.id])
  await pointerEnd(c.id)
  expect(ordered()).toEqual([c.id, b.id, a.id, d.id])
  expect(shown('waiting:second')).toEqual([c.id, b.id, a.id, d.id])
  for (const task of excluded) expect(useTaskStore.getState().tasks.find(item => item.id === task.id)).toEqual(task)
  for (const task of [b, d]) expect(withoutOrder(useTaskStore.getState().tasks.find(item => item.id === task.id)!)).toEqual(withoutOrder(task))
})

it('merges current status, category, new tasks and edits from other cards at pointer release', async () => {
  const a = add('A', 'home', 0), b = add('B', 'home', 1), c = add('C', 'home', 2), d = add('D', 'forge', 3)
  await render(React.createElement(WaitingTasksCard, { filter: { mode: 'single', categories: ['home'] } }))
  await pointerStart(c.id)
  await pointerReorder([c.id, b.id, a.id])
  let added!: Task
  await act(async () => {
    useTaskStore.getState().resumeWaitingTask(a.id)
    useTaskStore.getState().updateTask(b.id, { title: 'Edited B', category: 'forge', actualMinutes: 24 })
    added = add('New Home', 'home', 4)
  })
  const aBefore = useTaskStore.getState().tasks.find(task => task.id === a.id)
  expect(shown()).toEqual([c.id, added.id])
  await pointerEnd(c.id)
  expect(ordered()).toEqual([b.id, c.id, d.id, added.id])
  expect(useTaskStore.getState().tasks.find(task => task.id === a.id)).toEqual(aBefore)
  expect(useTaskStore.getState().tasks.find(task => task.id === b.id)).toMatchObject({ title: 'Edited B', category: 'forge', actualMinutes: 24 })
})

it('uses the existing native grip for before/after and blank-area sorting without an internal drop-hint layout jump', async () => {
  const a = add('A', 'home', 0), b = add('B', 'home', 1), c = add('C', 'home', 2)
  await render()
  vi.spyOn(row(a.id), 'getBoundingClientRect').mockReturnValue({ top: 100, height: 40 } as DOMRect)
  let data = transfer()
  await native('dragstart', grip(c.id), data)
  await act(async () => { window.dispatchEvent(new Event('pointercancel')) })
  await native('dragover', row(a.id), data, 105)
  expect(zone().textContent).not.toContain(zh.dashboard_waitingDropActive)
  await native('drop', row(a.id), data, 105)
  expect(ordered()).toEqual([c.id, a.id, b.id])
  data = transfer()
  await native('dragstart', grip(c.id), data)
  vi.spyOn(row(a.id), 'getBoundingClientRect').mockReturnValue({ top: 100, height: 40 } as DOMRect)
  await native('drop', row(a.id), data, 135)
  expect(ordered()).toEqual([a.id, c.id, b.id])
  data = transfer()
  await native('dragstart', grip(a.id), data)
  await native('drop', zone(), data)
  expect(ordered()).toEqual([c.id, b.id, a.id])
})

it('clears a canceled native grip drag even though the grip stops dragend propagation', async () => {
  const a = add('A', 'home', 0), b = add('B', 'home', 1)
  const todo = add('Outside todo', 'home', 9, 'todo')
  await render()
  const original = JSON.stringify(useTaskStore.getState().tasks)
  const internal = transfer()
  await native('dragstart', grip(b.id), internal)
  await native('dragover', row(a.id), internal)
  expect(zone().textContent).not.toContain(zh.dashboard_waitingDropActive)
  await native('dragend', grip(b.id), internal)
  expect(zone().getAttribute('data-drop-active')).toBe('false')
  expect(JSON.stringify(useTaskStore.getState().tasks)).toBe(original)
  const external = transfer()
  beginTaskDrag({ dataTransfer: external } as React.DragEvent<HTMLElement>, todo.id)
  await native('dragover', row(a.id), external)
  expect(zone().textContent).toContain(zh.dashboard_waitingDropActive)
  await native('drop', row(a.id), external)
  expect(useTaskStore.getState().tasks.find(task => task.id === todo.id)?.status).toBe('waiting')
})

it('merges native sorting into the latest filtered slots without writing tasks whose status changed', async () => {
  const a = add('Home A', 'home', 0), b = add('Forge B', 'forge', 1), c = add('Home C', 'home', 2), d = add('Forge D', 'forge', 3)
  await render(React.createElement(React.Fragment, null,
    React.createElement(WaitingTasksCard, { filter: { mode: 'single', categories: ['home'] } }),
    React.createElement(WaitingTasksCard, { cardId: 'waiting:second' }),
  ))
  const data = transfer()
  await native('dragstart', grip(c.id), data)
  let added!: Task
  await act(async () => {
    useTaskStore.getState().resumeWaitingTask(a.id)
    useTaskStore.getState().updateTask(c.id, { title: 'Edited during native drag' })
    added = add('New Home', 'home', 4)
  })
  const resumed = useTaskStore.getState().tasks.find(task => task.id === a.id)!
  vi.spyOn(row(added.id), 'getBoundingClientRect').mockReturnValue({ top: 100, height: 40 } as DOMRect)
  await native('drop', row(added.id), data, 135)
  expect(ordered()).toEqual([b.id, added.id, d.id, c.id])
  expect(shown('waiting:second')).toEqual([b.id, added.id, d.id, c.id])
  expect(useTaskStore.getState().tasks.find(task => task.id === a.id)).toEqual(resumed)
  expect(useTaskStore.getState().tasks.find(task => task.id === c.id)?.title).toBe('Edited during native drag')
})

it('keeps the native move-into-waiting gesture and never reclassifies or overwrites the task', async () => {
  const a = add('A', 'home', 0)
  const todo = add('Outside todo', 'home', 9, 'todo')
  await render()
  // Begin through the same production task-grip utility, then drop on a waiting row.
  const data = transfer()
  beginTaskDrag({ dataTransfer: data } as React.DragEvent<HTMLElement>, todo.id)
  await native('dragover', row(a.id), data)
  await native('drop', row(a.id), data)
  const current = useTaskStore.getState().tasks.find(task => task.id === todo.id)!
  expect(current).toMatchObject({ title: todo.title, category: todo.category, status: 'waiting', sortOrder: 9 })
  expect(useTaskStore.getState().tasks).toHaveLength(2)
})

it.each(['Escape', 'blur', 'pointercancel'] as const)('cancels %s without saving and permits the next reorder', async event => {
  const a = add('A', 'home', 0), b = add('B', 'home', 1)
  await render()
  await pointerStart(b.id)
  await pointerReorder([b.id, a.id])
  dragOffsets.get(b.id)!.set(84)
  await act(async () => { window.dispatchEvent(event === 'Escape' ? new KeyboardEvent('keydown', { key: 'Escape' }) : new Event(event)) })
  expect(shown()).toEqual([a.id, b.id])
  expect(dragOffsets.get(b.id)!.get()).toBe(0)
  await pointerEnd(b.id)
  expect(ordered()).toEqual([a.id, b.id])
  await pointerStart(b.id)
  await pointerReorder([b.id, a.id])
  await pointerEnd(b.id)
  expect(ordered()).toEqual([b.id, a.id])
})

it('does not save an interrupted drag when its task completes, and supports sorting again after undo', async () => {
  const a = add('A', 'home', 0), b = add('B', 'home', 1)
  await render()
  await pointerStart(b.id)
  await pointerReorder([b.id, a.id])
  let completionId: string | undefined
  await act(async () => { completionId = useTaskStore.getState().completeTask(b.id)?.completionId })
  expect(shown()).toEqual([a.id])
  const completed = useTaskStore.getState().tasks.find(task => task.id === b.id)!
  await act(async () => { expect(undoTaskCompletion(b.id, completionId)).toBe(true) })
  expect(useTaskStore.getState().tasks.find(task => task.id === b.id)?.status).toBe('waiting')
  await pointerStart(b.id)
  await pointerReorder([b.id, a.id])
  await pointerEnd(b.id)
  expect(ordered()).toEqual([b.id, a.id])
  expect(useTaskStore.getState().tasks.find(task => task.id === b.id)?.title).toBe(completed.title)
})

it('cancels on layout edit/filter changes and unmount, blocking both sort gestures while editing', async () => {
  const a = add('A', 'home', 0), b = add('B', 'home', 1)
  await render()
  await pointerStart(b.id)
  await pointerReorder([b.id, a.id])
  await render(React.createElement(WaitingTasksCard, { layoutEditing: true }))
  expect(row(a.id).getAttribute('data-waiting-sort-enabled')).toBe('false')
  await pointerReorder([b.id, a.id])
  await pointerEnd(b.id)
  const data = transfer()
  await native('dragstart', grip(b.id), data)
  expect((await native('dragover', row(a.id), data)).defaultPrevented).toBe(false)
  await native('drop', row(a.id), data)
  expect(ordered()).toEqual([a.id, b.id])
  await render(React.createElement(WaitingTasksCard, { filter: { mode: 'single', categories: ['home'] } }))
  await pointerStart(b.id)
  await pointerReorder([b.id, a.id])
  await render(React.createElement(WaitingTasksCard, { filter: { mode: 'multiple', categories: ['home'] } }))
  await pointerEnd(b.id)
  expect(ordered()).toEqual([a.id, b.id])
  await pointerStart(b.id)
  await pointerReorder([b.id, a.id])
  await render(null)
  await render()
  expect(shown()).toEqual([a.id, b.id])
  await pointerStart(b.id)
  await pointerReorder([b.id, a.id])
  await pointerEnd(b.id)
  expect(ordered()).toEqual([b.id, a.id])
})
