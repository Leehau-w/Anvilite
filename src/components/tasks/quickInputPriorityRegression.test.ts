// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
vi.hoisted(() => { vi.stubGlobal('window', document.defaultView) })
import { QuickInput } from './QuickInput'
import { TaskItem } from './TaskItem'
import { TaskDrawer } from './TaskDrawer'
import { TaskList } from './TaskList'
import { useTaskStore } from '@/stores/taskStore'
import { useAreaStore } from '@/stores/areaStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { useCharacterStore } from '@/stores/characterStore'
import { useGrowthEventStore } from '@/stores/growthEventStore'
import { zh } from '@/i18n/zh'
import { en } from '@/i18n/en'

let container: HTMLDivElement
let root: Root
const dictionaries = { zh, en }
async function render(node: React.ReactNode) { await act(async () => root.render(node)) }
async function type(input: HTMLInputElement, value: string) {
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value)
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
}
async function select(value: string) {
  await act(async () => {
    const input = container.querySelector('select')!
    input.value = value
    input.dispatchEvent(new Event('change', { bubbles: true }))
  })
}
async function key(input: HTMLInputElement, name: string, isComposing = false) {
  await act(async () => input.dispatchEvent(new KeyboardEvent('keydown', { key: name, bubbles: true, cancelable: true, isComposing })))
}
async function click(node: Element) { await act(async () => node.dispatchEvent(new MouseEvent('click', { bubbles: true }))) }
beforeEach(() => {
  vi.stubGlobal('window', document.defaultView)
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  window.localStorage.clear()
  useTaskStore.setState({ tasks: [], lastCategory: 'home', customTaskGroups: [], completedViewMode: 'area' })
  useAreaStore.setState({ areas: useAreaStore.getInitialState().areas })
  useSettingsStore.getState().setLanguage('zh')
  useCharacterStore.setState({ character: { ...useCharacterStore.getInitialState().character } })
  useGrowthEventStore.setState({ events: [] })
  container = document.createElement('div'); document.body.append(container); root = createRoot(container)
})
afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
  vi.restoreAllMocks()
})

it.each(['zh', 'en'] as const)('explicit category creates in a custom category and carries it to full creation (%s)', async lang => {
  const t = dictionaries[lang]
  useSettingsStore.getState().setLanguage(lang)
  const custom = useAreaStore.getState().addArea(null, 'Client projects')!
  const open = vi.fn()
  await render(React.createElement(QuickInput, { onOpenDrawer: open }))
  expect(container.querySelector('select')!.getAttribute('aria-label')).toBe(t.quickInput_category)
  expect(container.querySelector('[data-create-category]')).toBeNull()
  const input = container.querySelector('input')!
  await type(input, '  Ask the client  ')
  await select(custom.category)
  expect(input.value).toBe('  Ask the client  ')
  await key(input, 'Enter')
  expect(useTaskStore.getState().tasks).toHaveLength(1)
  expect(useTaskStore.getState().tasks[0]).toMatchObject({ title: 'Ask the client', category: custom.category })
  expect(input.value).toBe('')
  await click(container.querySelector('[title="' + t.quickInput_full + '"]')!)
  expect(open).toHaveBeenCalledWith(custom.category)
})

it('follows an externally changed default and avoids reusing a deleted selected category', async () => {
  const custom = useAreaStore.getState().addArea(null, 'Temporary category')!
  await render(React.createElement(QuickInput, { defaultCategory: 'home' }))
  await select(custom.category)
  expect(container.querySelector('select')!.value).toBe(custom.category)
  await render(React.createElement(QuickInput, { defaultCategory: 'forge' }))
  expect(container.querySelector('select')!.value).toBe('forge')
  await select(custom.category)
  await act(async () => useAreaStore.getState().removeArea(custom.id))
  const input = container.querySelector('input')!
  await type(input, 'After deletion')
  await key(input, 'Enter')
  expect(useTaskStore.getState().tasks[0].category).toBe('forge')
})

it('does not create or clear a composing draft, then creates only on a separate Enter', async () => {
  await render(React.createElement(QuickInput))
  const input = container.querySelector('input')!
  await type(input, '等待输入完成')
  await act(async () => input.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true })))
  await key(input, 'Enter', true)
  await key(input, 'Escape', true)
  expect(useTaskStore.getState().tasks).toHaveLength(0)
  expect(input.value).toBe('等待输入完成')
  await act(async () => input.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true })))
  await key(input, 'Enter')
  expect(useTaskStore.getState().tasks).toHaveLength(1)
})

it('task-list full creation keeps the explicit quick-input category', async () => {
  await render(React.createElement(TaskList))
  await select('forge')
  await click(container.querySelector('[title="' + zh.quickInput_full + '"]')!)
  await type(container.querySelector('form input')!, 'Full task in work')
  await act(async () => container.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })))
  expect(useTaskStore.getState().tasks[0]).toMatchObject({ title: 'Full task in work', category: 'forge' })
})

it.each(['zh', 'en'] as const)('editing a waiting task priority updates its indicator without altering work or completion state (%s)', async lang => {
  const t = dictionaries[lang]
  useSettingsStore.getState().setLanguage(lang)
  const created = useTaskStore.getState().addTask({ title: 'A waiting task', category: 'home', priority: 'urgent' })
  useTaskStore.getState().updateTask(created.id, { status: 'waiting', actualMinutes: 25, timerAccumulated: 120, tags: ['client'] })
  const initial = useTaskStore.getState().tasks[0]
  function Live() {
    const task = useTaskStore(s => s.tasks[0])
    return React.createElement(React.Fragment, null,
      React.createElement(TaskItem, { task, compact: true }),
      React.createElement(TaskDrawer, { open: true, editTask: task, onClose: vi.fn() }))
  }
  await render(React.createElement(Live))
  const row = container.querySelector<HTMLElement>('[data-task-id="' + created.id + '"]')!
  const low = Array.from(container.querySelectorAll('button')).find(node => node.textContent === t.taskPriority_low)!
  await click(low)
  await act(async () => container.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })))
  expect(useTaskStore.getState().tasks[0]).toMatchObject({ priority: 'low', status: 'waiting', actualMinutes: 25, timerAccumulated: 120, xpReward: initial.xpReward, subTasks: initial.subTasks, tags: initial.tags })
  expect(row.querySelector('[aria-label="' + t.priority_low + '"]')).not.toBeNull()
  expect(useCharacterStore.getState().character.totalXP).toBe(0)
})
it('two views of the same task complete and undo it only once even when clicked together', async () => {
  const created = useTaskStore.getState().addTask({ title: 'Shared across two cards', category: 'home', difficulty: 2 })
  function SharedViews() {
    const task = useTaskStore(s => s.tasks.find(item => item.id === created.id)!)
    return React.createElement(React.Fragment, null,
      React.createElement(TaskItem, { key: 'first', task, compact: true }),
      React.createElement(TaskItem, { key: 'second', task, compact: true }))
  }
  await render(React.createElement(SharedViews))
  const controls = () => [...container.querySelectorAll('[data-task-id]')].map(row => row.querySelector('button:not([draggable])')!)
  await act(async () => { controls().forEach(node => node.dispatchEvent(new MouseEvent('click', { bubbles: true }))) })
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 700)) })
  const done = useTaskStore.getState().tasks[0]
  expect(done.status).toBe('done')
  expect(useCharacterStore.getState().character.totalXP).toBe(done.xpReward)
  expect(useGrowthEventStore.getState().events.filter(event => event.type === 'task_complete' && event.details.entityId === created.id)).toHaveLength(1)
  const ore = useCharacterStore.getState().character.ore
  await act(async () => { controls().forEach(node => node.dispatchEvent(new MouseEvent('click', { bubbles: true }))) })
  expect(useTaskStore.getState().tasks[0].status).toBe('todo')
  expect(useCharacterStore.getState().character.totalXP).toBe(0)
  expect(useCharacterStore.getState().character.ore).toBe(ore)
})
