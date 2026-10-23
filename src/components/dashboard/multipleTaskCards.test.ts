// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { Task } from '@/types/task'

const { reorderHandlers } = vi.hoisted(() => {
  vi.stubGlobal('window', document.defaultView)
  vi.stubGlobal('localStorage', document.defaultView!.localStorage)
  return { reorderHandlers: new Map<string, (tasks: Task[]) => void>() }
})
vi.mock('framer-motion', async importOriginal => ({
  ...await importOriginal<typeof import('framer-motion')>(),
  AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
  Reorder: {
    Group: ({ children, onReorder, ...props }: { children: React.ReactNode; onReorder: (tasks: Task[]) => void; 'data-task-card-group': string }) => {
      reorderHandlers.set(props['data-task-card-group'], onReorder)
      return React.createElement('div', { 'data-task-card-group': props['data-task-card-group'] }, children)
    },
    Item: ({ children, onDragEnd }: { children: React.ReactNode; onDragEnd: () => void }) => React.createElement('div', { 'data-sort-item': true, onMouseUp: onDragEnd }, children),
  },
}))

import { Dashboard } from './Dashboard'
import { TaskCard } from './TaskCard'
import { useTaskStore } from '@/stores/taskStore'
import { useDashboardStore, DEFAULT_LAYOUT, ALL_CARD_IDS } from '@/stores/dashboardStore'
import { useAreaStore } from '@/stores/areaStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { zh } from '@/i18n/zh'
import { en } from '@/i18n/en'
import { sortTasksInGroup } from '@/utils/task'

let container: HTMLDivElement
let root: Root
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  localStorage.clear()
  reorderHandlers.clear()
  useTaskStore.setState({ tasks: [], customTaskGroups: [] })
  useAreaStore.setState({ areas: useAreaStore.getInitialState().areas.map(area => ({ ...area })) })
  useDashboardStore.setState({ layout: DEFAULT_LAYOUT.map(card => ({ ...card })), visibleCards: ['tasks'] })
  useSettingsStore.getState().setLanguage('zh')
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
})
afterEach(async () => {
  await act(async () => { root.unmount() })
  container.remove()
  vi.restoreAllMocks()
})
async function render(node: React.ReactNode = React.createElement(Dashboard)) {
  await act(async () => { root.render(node) })
}
async function click(element: Element) {
  await act(async () => { element.dispatchEvent(new MouseEvent('click', { bubbles: true })) })
}
function button(text: string) {
  const result = [...container.querySelectorAll('button')].find(node => node.textContent === text || node.textContent?.trim() === text)
  expect(result).toBeDefined()
  return result!
}
function card(id: string) {
  const result = container.querySelector(`[data-dashboard-card="${id}"]`)
  expect(result).not.toBeNull()
  return result!
}
function dialog(id: string) {
  const result = document.body.querySelector(`[data-task-card-filter="${id}"]`)
  expect(result).not.toBeNull()
  return result!
}
async function chooseMode(id: string, mode: string) {
  await click(dialog(id).querySelector(`input[name="filter-mode-${id}"][value="${mode}"]`)!)
}
async function chooseCategory(id: string, category: string) {
  await click(dialog(id).querySelector(`input[name="filter-category-${id}"][value="${category}"]`)!)
}
async function closeDialog(id: string) {
  await click(dialog(id).querySelector('button')!)
}
function add(title: string, category = 'home', sortOrder = 0) {
  const task = useTaskStore.getState().addTask({ title, category })
  useTaskStore.getState().updateTask(task.id, { sortOrder })
  return useTaskStore.getState().tasks.find(item => item.id === task.id)!
}

it('filters independent cards by one or several categories without changing task records', async () => {
  const home = add('Home task', 'home')
  add('Forge task', 'forge')
  useAreaStore.getState().addArea(null, 'Client work')
  add('Client task', 'Client work')
  const hidden = add('Hidden task')
  const deleted = add('Deleted task')
  useTaskStore.getState().hideTask(hidden.id)
  useTaskStore.getState().deleteTask(deleted.id)
  const waiting = add('Waiting task')
  useTaskStore.getState().waitTask(waiting.id)
  const second = useDashboardStore.getState().addTaskCard()
  const before = JSON.stringify(useTaskStore.getState().tasks)
  await render()
  await click(container.querySelector('[data-filter-trigger="tasks"]')!)
  expect(dialog('tasks').closest('[data-dashboard-card]')).toBeNull()
  await chooseMode('tasks', 'single')
  await chooseCategory('tasks', home.category)
  await closeDialog('tasks')
  expect(card('tasks').textContent).toContain('Home task')
  for (const title of ['Forge task', 'Client task', 'Hidden task', 'Deleted task', 'Waiting task']) expect(card('tasks').textContent).not.toContain(title)
  expect(card(second).textContent).toContain('Forge task')
  await click(container.querySelector(`[data-filter-trigger="${second}"]`)!)
  await chooseMode(second, 'multiple')
  await chooseCategory(second, 'forge')
  await chooseCategory(second, 'Client work')
  await closeDialog(second)
  expect(card(second).textContent).toContain('Forge task')
  expect(card(second).textContent).toContain('Client task')
  expect(card(second).textContent).not.toContain('Home task')
  expect(card('tasks').textContent).toContain('Home task')
  expect(JSON.stringify(useTaskStore.getState().tasks)).toBe(before)
})

it('keeps an empty multiple or single filter empty, including today completed tasks', async () => {
  const task = add('Completed today')
  useTaskStore.getState().completeTask(task.id)
  add('Regular todo')
  await render()
  expect(card('tasks').textContent).toContain('Completed today')
  await click(container.querySelector('[data-filter-trigger="tasks"]')!)
  await chooseMode('tasks', 'multiple')
  expect(dialog('tasks').textContent).toContain(zh.dash_filterEmpty)
  await closeDialog('tasks')
  expect(card('tasks').querySelectorAll('[data-task-id]')).toHaveLength(0)
  expect(card('tasks').textContent).toContain(zh.dash_empty)
  await click(container.querySelector('[data-filter-trigger="tasks"]')!)
  await chooseMode('tasks', 'single')
  await closeDialog('tasks')
  expect(card('tasks').querySelectorAll('[data-task-id]')).toHaveLength(0)
})

it('keeps unknown saved categories selectable and reacts to renaming, language and task category changes', async () => {
  const task = add('Legacy category task', 'Deleted category')
  useDashboardStore.getState().setTaskCardFilter('tasks', { mode: 'single', categories: ['Deleted category'] })
  await render()
  expect(card('tasks').textContent).toContain('Legacy category task')
  await click(container.querySelector('[data-filter-trigger="tasks"]')!)
  expect(dialog('tasks').querySelector('input[value="Deleted category"]')).not.toBeNull()
  expect(dialog('tasks').querySelector('input[value="_milestone"]')).toBeNull()
  expect(dialog('tasks').querySelector('input[value="other"]')).not.toBeNull()
  await chooseCategory('tasks', 'home')
  await act(async () => { useAreaStore.getState().updateArea('area-home', { name: 'Renamed home' }) })
  expect(dialog('tasks').textContent).toContain('Renamed home')
  await act(async () => { useSettingsStore.getState().setLanguage('en') })
  expect(dialog('tasks').textContent).toContain('Renamed home')
  expect(dialog('tasks').textContent).toContain(en.areaName_forge)
  await closeDialog('tasks')
  await act(async () => { useTaskStore.getState().updateTask(task.id, { category: 'home' }) })
  expect(card('tasks').textContent).toContain('Legacy category task')
  await act(async () => { useTaskStore.getState().updateTask(task.id, { category: 'forge' }) })
  expect(card('tasks').textContent).not.toContain('Legacy category task')
})

it('always offers another task card and restores a hidden instance without changing its filter or old positions', async () => {
  useDashboardStore.setState({ visibleCards: [...ALL_CARD_IDS] })
  const original = JSON.stringify(useDashboardStore.getState().layout)
  await render()
  await click(button(zh.dash_editLayout))
  await click(button(zh.dash_addCard))
  await click(container.querySelector('[data-add-task-card]')!)
  const second = useDashboardStore.getState().layout.at(-1)!.id
  await click(button(zh.dash_addCard))
  await click(container.querySelector('[data-add-task-card]')!)
  const third = useDashboardStore.getState().layout.at(-1)!.id
  expect(third).not.toBe(second)
  expect(container.querySelectorAll('[data-filter-trigger^="tasks"]')).toHaveLength(3)
  expect(JSON.stringify(useDashboardStore.getState().layout.slice(0, DEFAULT_LAYOUT.length))).toBe(original)
  await act(async () => {
    useDashboardStore.getState().setTaskCardFilter(second, { mode: 'single', categories: ['home'] })
    useDashboardStore.getState().removeCard(second)
  })
  expect(container.querySelector(`[data-dashboard-card="${second}"]`)).toBeNull()
  await click(button(zh.dash_addCard))
  const restore = container.querySelector(`[data-restore-card="${second}"]`)!
  expect(restore.textContent).toContain(zh.dash_tasks)
  expect(restore.textContent).not.toContain(zh.dash_taskCardInstance(2))
  await click(restore)
  expect(card(second)).not.toBeNull()
  expect(useDashboardStore.getState().layout.find(item => item.id === second)?.taskFilter).toEqual({ mode: 'single', categories: ['home'] })
})

it('reorders filtered tasks in their existing global slots and synchronizes another card', async () => {
  const a = add('Work A', 'home', 0)
  const b = add('Life B', 'forge', 1)
  const c = add('Work C', 'home', 2)
  const d = add('Life D', 'forge', 3)
  const hidden = add('Hidden extra', 'home', 12)
  useTaskStore.getState().hideTask(hidden.id)
  const waiting = add('Waiting extra', 'home', 25)
  useTaskStore.getState().waitTask(waiting.id)
  useDashboardStore.getState().setTaskCardFilter('tasks', { mode: 'single', categories: ['home'] })
  const second = useDashboardStore.getState().addTaskCard()
  await render()
  await act(async () => { reorderHandlers.get('tasks:todo')!([c, a]) })
  await act(async () => { card('tasks').querySelector('[data-sort-item]')!.dispatchEvent(new MouseEvent('mouseup', { bubbles: true })) })
  const current = useTaskStore.getState().tasks
  expect(sortTasksInGroup(current.filter(task => task.status === 'todo' && !task.isHidden)).map(task => task.id)).toEqual([c.id, b.id, a.id, d.id])
  expect([...card(second).querySelectorAll('[data-task-id]')].map(node => node.getAttribute('data-task-id'))).toEqual([c.id, b.id, a.id, d.id])
  expect(current.find(task => task.id === hidden.id)?.sortOrder).toBe(12)
  expect(current.find(task => task.id === waiting.id)?.sortOrder).toBe(25)
})

it('does not write a task moved to waiting during another card reorder', async () => {
  const a = add('Move while dragging', 'home', 4)
  const b = add('Keep todo', 'home', 8)
  await render(React.createElement(TaskCard, { cardId: 'tasks', onEdit: () => {} }))
  await act(async () => { reorderHandlers.get('tasks:todo')!([b, a]) })
  await act(async () => { useTaskStore.getState().waitTask(a.id) })
  expect(container.textContent).not.toContain('Move while dragging')
  const snapshot = JSON.stringify(useTaskStore.getState().tasks.find(task => task.id === a.id))
  await act(async () => { container.querySelector('[data-sort-item]')!.dispatchEvent(new MouseEvent('mouseup', { bubbles: true })) })
  expect(JSON.stringify(useTaskStore.getState().tasks.find(task => task.id === a.id))).toBe(snapshot)
  expect(useTaskStore.getState().tasks).toHaveLength(2)
})
