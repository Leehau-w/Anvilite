// @vitest-environment happy-dom
import React, { act, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { Task } from '@/types/task'

const { showToast } = vi.hoisted(() => {
  vi.stubGlobal('window', document.defaultView)
  vi.stubGlobal('localStorage', document.defaultView!.localStorage)
  return { showToast: vi.fn() }
})
vi.mock('framer-motion', async importOriginal => ({
  ...await importOriginal<typeof import('framer-motion')>(),
  AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
}))
vi.mock('@/components/feedback/Toast', () => ({ useToast: () => ({ showToast }) }))

import { TaskDrawer } from './TaskDrawer'
import { useTaskStore } from '@/stores/taskStore'
import { useAreaStore } from '@/stores/areaStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { useCharacterStore } from '@/stores/characterStore'
import { useGrowthEventStore } from '@/stores/growthEventStore'
import { zh } from '@/i18n/zh'
import { en } from '@/i18n/en'
import { TASK_COLOR_PRESETS } from '@/utils/taskPriority'

let container: HTMLDivElement
let root: Root
const dictionaries = { zh, en }
const originalActions = {
  addTask: useTaskStore.getState().addTask,
  updateTask: useTaskStore.getState().updateTask,
}
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  localStorage.clear()
  showToast.mockClear()
  useTaskStore.setState({ ...originalActions, tasks: [], lastCategory: 'home', customTaskGroups: [] })
  useAreaStore.setState({ areas: useAreaStore.getInitialState().areas.map(area => ({ ...area })) })
  useCharacterStore.setState({ character: { ...useCharacterStore.getInitialState().character, totalXP: 400 } })
  useGrowthEventStore.setState({ events: [] })
  useSettingsStore.getState().setLanguage('zh')
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
})
afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
  vi.restoreAllMocks()
  useTaskStore.setState(originalActions)
})
async function render(node: React.ReactNode) { await act(async () => { root.render(node) }) }
async function click(element: Element) {
  await act(async () => { element.dispatchEvent(new MouseEvent('click', { bubbles: true })) })
}
function button(text: string, scope: ParentNode = container) {
  const result = [...scope.querySelectorAll('button')].find(element => element.textContent === text)
  expect(result, text).toBeDefined()
  return result!
}
function input(placeholder: string) { return container.querySelector<HTMLInputElement>('input[placeholder="' + placeholder + '"]')! }
function form() { return container.querySelector<HTMLFormElement>('form[data-task-drawer]')! }
async function setInput(element: HTMLInputElement | HTMLTextAreaElement, value: string) {
  await act(async () => {
    const prototype = element instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype
    Object.getOwnPropertyDescriptor(prototype, 'value')!.set!.call(element, value)
    element.dispatchEvent(new Event('input', { bubbles: true }))
    element.dispatchEvent(new Event('change', { bubbles: true }))
  })
}
async function enter(element: Element, options: KeyboardEventInit = {}) {
  const event = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true, ...options })
  await act(async () => { element.dispatchEvent(event) })
  return event
}
function Harness({ task, onClose = () => {} }: { task?: Task; onClose?: () => void }) {
  const [open, setOpen] = useState(true)
  return React.createElement(TaskDrawer, { open, editTask: task, onClose: () => { onClose(); setOpen(false) } })
}
function seed(status: Task['status'] = 'waiting') {
  const task = useTaskStore.getState().addTask({ title: 'Original task', category: 'home', tags: ['client'] })
  useTaskStore.getState().addSubTask(task.id, 'Original child')
  useTaskStore.getState().updateTask(task.id, {
    status, actualMinutes: 37, timerAccumulated: 125, backgroundColor: null,
    completedAt: status === 'done' ? '2026-10-21T10:00:00Z' : null,
    completionId: status === 'done' ? 'original-completion' : undefined,
    completionReturnStatus: status === 'done' ? 'waiting' : undefined,
    xpReward: 72,
  })
  return useTaskStore.getState().tasks.find(item => item.id === task.id)!
}

const fields = ['category', 'difficulty', 'priority', 'preset', 'custom', 'date', 'due-toggle', 'notes', 'minutes'] as const
it.each((['zh', 'en'] as const).flatMap(language => fields.map(field => ({ language, field }))))(
  'Enter saves the current draft from $field and closes without activating that control ($language)',
  async ({ language, field }) => {
    const t = dictionaries[language]
    useSettingsStore.getState().setLanguage(language)
    const task = seed('done')
    const events = JSON.stringify(useGrowthEventStore.getState().events)
    const character = JSON.stringify(useCharacterStore.getState().character)
    const close = vi.fn()
    await render(React.createElement(Harness, { task, onClose: close }))
    let target: Element
    let expected: Partial<Task>
    if (field === 'category') {
      target = button(t.areaName_library)
      await click(target); expected = { category: 'library' }
    } else if (field === 'difficulty') {
      target = [...container.querySelectorAll('button')].filter(element => element.textContent === '★')[4]
      await click(target); expected = { difficulty: 5 }
    } else if (field === 'priority') {
      target = button(t.taskPriority_high)
      await click(target); expected = { priority: 'high' }
    } else if (field === 'preset') {
      target = container.querySelector('[data-task-color-preset="purple"]')!
      await click(target); expected = { backgroundColor: TASK_COLOR_PRESETS.find(color => color.id === 'purple')!.value }
    } else if (field === 'custom') {
      target = container.querySelector('input[type="color"]')!
      await setInput(target as HTMLInputElement, '#ab8a91'); expected = { backgroundColor: '#ab8a91' }
    } else if (field === 'date') {
      target = container.querySelector('input[type="date"]')!
      await setInput(target as HTMLInputElement, '2026-11-13'); expected = { dueDate: '2026-11-13' }
    } else if (field === 'due-toggle') {
      target = button(t.taskDrawer_hasDueDate)
      await click(target); expected = { dueDate: null }
    } else if (field === 'notes') {
      target = container.querySelector('textarea')!
      await setInput(target as HTMLTextAreaElement, 'Changed notes'); expected = { description: 'Changed notes' }
    } else {
      target = container.querySelector('input[type="number"]')!
      await setInput(target as HTMLInputElement, '51'); expected = { actualMinutes: 51 }
    }
    const event = await enter(target)
    expect(event.defaultPrevented).toBe(true)
    expect(close).toHaveBeenCalledOnce()
    expect(form()).toBeNull()
    const saved = useTaskStore.getState().tasks[0]
    expect(saved).toMatchObject(expected)
    expect(saved).toMatchObject({ status: 'done', completionReturnStatus: 'waiting', completionId: 'original-completion', completedAt: task.completedAt, timerAccumulated: 125, timerStartedAt: null, xpReward: 72 })
    expect(saved.subTasks).toEqual(task.subTasks)
    expect(JSON.stringify(useGrowthEventStore.getState().events)).toBe(events)
    expect(JSON.stringify(useCharacterStore.getState().character)).toBe(character)
  },
)

it.each(['zh', 'en'] as const)('keeps Shift+Enter for a notes line break and Enter saves it (%s)', async language => {
  useSettingsStore.getState().setLanguage(language)
  const task = seed()
  await render(React.createElement(Harness, { task }))
  const notes = container.querySelector<HTMLTextAreaElement>('textarea')!
  expect((await enter(notes, { shiftKey: true })).defaultPrevented).toBe(false)
  expect(form()).not.toBeNull()
  await setInput(notes, 'Line one\nLine two')
  await enter(notes)
  expect(form()).toBeNull()
  expect(useTaskStore.getState().tasks[0].description).toBe('Line one\nLine two')
})

it.each(['native', '229', 'composition'] as const)('does not save or commit a tag during IME %s Enter', async mode => {
  const task = seed()
  await render(React.createElement(Harness, { task }))
  await click(button('+ ' + zh.tag_add))
  const tag = input(zh.tag_placeholder)
  await setInput(tag, '输入中')
  if (mode === 'composition') await act(async () => { tag.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true })) })
  await enter(tag, mode === 'native' ? { isComposing: true } : mode === '229' ? { keyCode: 229 } : {})
  expect(form()).not.toBeNull()
  expect(container.querySelector('input[placeholder="' + zh.tag_placeholder + '"]')).not.toBeNull()
  expect(useTaskStore.getState().tasks[0]).toEqual(task)
  if (mode === 'composition') await act(async () => { tag.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true })) })
  await enter(tag)
  expect(form()).not.toBeNull()
  expect(document.activeElement).toBe(form())
  await enter(form())
  expect(form()).toBeNull()
  expect(useTaskStore.getState().tasks[0].tags).toEqual(['client', '输入中'])
})

it('saves from an empty tag editor and never activates the focused delete or milestone button', async () => {
  const task = seed('done')
  await render(React.createElement(Harness, { task }))
  await click(button('+ ' + zh.tag_add))
  await enter(input(zh.tag_placeholder))
  expect(form()).toBeNull()
  expect(useTaskStore.getState().tasks[0].tags).toEqual(task.tags)
  expect(useGrowthEventStore.getState().events).toEqual([])
  await render(React.createElement(TaskDrawer, { open: true, editTask: task, onClose: vi.fn() }))
  await enter(button('⭐ ' + zh.task_inscribe))
  expect(useGrowthEventStore.getState().events).toEqual([])
})

it('includes uncommitted tag and top-level child drafts when Enter saves from another setting', async () => {
  const task = seed()
  await render(React.createElement(Harness, { task }))
  await click(button('+ ' + zh.tag_add))
  await setInput(input(zh.tag_placeholder), 'Draft tag')
  await setInput(input(zh.subtask_placeholder), 'Draft child')
  await enter(button(zh.taskPriority_medium))
  const saved = useTaskStore.getState().tasks[0]
  expect(saved.tags).toEqual(['client', 'Draft tag'])
  expect(saved.subTasks.map(sub => sub.title)).toEqual(['Original child', 'Draft child'])
  expect(saved.status).toBe('waiting')
  expect(form()).toBeNull()
})

it('adds a child locally on first Enter and saves the task on the next empty-input Enter', async () => {
  const task = seed()
  await render(React.createElement(Harness, { task }))
  const child = input(zh.subtask_placeholder)
  await setInput(child, 'One new child')
  await enter(child)
  expect(form()).not.toBeNull()
  expect(useTaskStore.getState().tasks[0].subTasks).toHaveLength(2)
  expect(child.value).toBe('')
  await enter(child)
  expect(form()).toBeNull()
  expect(useTaskStore.getState().tasks[0].subTasks).toHaveLength(2)
})

it('keeps inline child editing local, then saves on the next Enter', async () => {
  const task = seed()
  await render(React.createElement(Harness, { task }))
  const title = [...container.querySelectorAll('span')].find(element => element.textContent === 'Original child')!
  await click(title)
  const edit = [...container.querySelectorAll<HTMLInputElement>('input')].find(element => element.value === 'Original child')!
  await setInput(edit, 'Renamed child')
  await enter(edit, { keyCode: 229 })
  expect(useTaskStore.getState().tasks[0].subTasks[0].title).toBe('Original child')
  await enter(edit)
  expect(useTaskStore.getState().tasks[0].subTasks[0].title).toBe('Renamed child')
  expect(form()).not.toBeNull()
  expect(document.activeElement).toBe(form())
  await enter(form())
  expect(form()).toBeNull()
})

it('includes an unfinished nested child draft and preserves newer task state when saving', async () => {
  const task = seed()
  await render(React.createElement(Harness, { task }))
  const add = container.querySelector('button[title="' + zh.subtask_add + '"]')!
  await click(add)
  const draft = container.querySelector<HTMLInputElement>('[data-task-child-draft]')!
  await setInput(draft, 'Nested draft')
  await act(async () => {
    useTaskStore.getState().updateTask(task.id, { status: 'doing', timerStartedAt: '2026-10-23T12:00:00Z', timerAccumulated: 222 })
    useTaskStore.getState().addSubTask(task.id, 'Another source child')
  })
  await enter(button(zh.taskPriority_low))
  const saved = useTaskStore.getState().tasks[0]
  expect(saved.subTasks.map(sub => sub.title)).toEqual(['Original child', 'Another source child'])
  expect(saved.subTasks[0].subTasks.map(sub => sub.title)).toEqual(['Nested draft'])
  expect(saved).toMatchObject({ status: 'doing', timerStartedAt: '2026-10-23T12:00:00Z', timerAccumulated: 222 })
  expect(form()).toBeNull()
})

it('handles category creation in its own dialog and saves the selected category on the next Enter', async () => {
  const task = seed()
  await render(React.createElement(Harness, { task }))
  await click(container.querySelector('[data-create-category]')!)
  const categoryForm = document.querySelector<HTMLFormElement>('[data-category-creator]')!
  await setInput(categoryForm.querySelector('input')!, 'Custom category')
  await act(async () => { categoryForm.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })) })
  expect(document.querySelector('[data-category-creator]')).toBeNull()
  expect(form()).not.toBeNull()
  await enter(button('Custom category'))
  expect(form()).toBeNull()
  const category = useTaskStore.getState().tasks[0].category
  expect(useAreaStore.getState().areas.find(area => area.category === category)?.name).toBe('Custom category')
})

it('rejects an empty title, ignores held Enter, and only submits once for back-to-back Enter', async () => {
  const close = vi.fn()
  await render(React.createElement(Harness, { onClose: close }))
  const title = input(zh.taskDrawer_titlePlaceholder)
  await enter(title)
  expect(close).not.toHaveBeenCalled()
  expect(useTaskStore.getState().tasks).toHaveLength(0)
  await setInput(title, 'Create once')
  await enter(title, { repeat: true })
  expect(useTaskStore.getState().tasks).toHaveLength(0)
  await act(async () => {
    title.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }))
    title.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }))
  })
  expect(useTaskStore.getState().tasks).toHaveLength(1)
  expect(close).toHaveBeenCalledOnce()
})

it('retains a failed edit draft and retries the same task, preserving late actual minutes', async () => {
  const task = seed('done')
  let fail = true
  useTaskStore.setState({ updateTask: (id, patch) => {
    if (fail) { fail = false; throw new Error('Synthetic failure') }
    originalActions.updateTask(id, patch)
  } })
  await render(React.createElement(Harness, { task }))
  const title = input(zh.taskDrawer_titlePlaceholder)
  await setInput(title, 'Retained draft')
  await enter(title)
  expect(form()).not.toBeNull()
  expect(title.value).toBe('Retained draft')
  expect(showToast).toHaveBeenCalledWith(zh.activity_actionFailed)
  await act(async () => originalActions.updateTask(task.id, { actualMinutes: 99 }))
  await enter(title)
  expect(form()).toBeNull()
  expect(useTaskStore.getState().tasks).toHaveLength(1)
  expect(useTaskStore.getState().tasks[0]).toMatchObject({ title: 'Retained draft', actualMinutes: 99, completionReturnStatus: 'waiting' })
})

it('rolls back a failed new task write and retries once with every pending child and draft', async () => {
  await render(React.createElement(Harness))
  const title = input(zh.taskDrawer_titlePlaceholder)
  await setInput(title, 'Atomic create')
  const child = input(zh.subtask_placeholder)
  await setInput(child, 'Staged child')
  await enter(child)
  await setInput(child, 'Uncommitted child')
  const storage = useTaskStore.persist.getOptions().storage!
  const setItem = storage.setItem.bind(storage)
  let fail = true
  vi.spyOn(storage, 'setItem').mockImplementation((key, value) => {
    if (key.endsWith('-tasks') && fail) { fail = false; throw new Error('Synthetic disk full') }
    setItem(key, value)
  })
  await enter(title)
  expect(form()).not.toBeNull()
  expect(title.value).toBe('Atomic create')
  expect(useTaskStore.getState().tasks).toHaveLength(0)
  expect(showToast).toHaveBeenCalledWith(zh.activity_actionFailed)
  await enter(title)
  expect(form()).toBeNull()
  expect(useTaskStore.getState().tasks).toHaveLength(1)
  expect(useTaskStore.getState().tasks[0].subTasks.map(sub => sub.title)).toEqual(['Staged child', 'Uncommitted child'])
})


it('clicking remove-tag stays inside the draft and Enter on that control saves without removing it again', async () => {
  const task = seed()
  await render(React.createElement(Harness, { task }))
  const remove = [...container.querySelectorAll('button')].find(element => element.textContent === '×')!
  expect(remove.type).toBe('button')
  await enter(remove)
  expect(form()).toBeNull()
  expect(useTaskStore.getState().tasks[0].tags).toEqual(['client'])
  await render(React.createElement(TaskDrawer, { open: true, editTask: task, onClose: vi.fn() }))
  await click([...container.querySelectorAll('button')].find(element => element.textContent === '×')!)
  expect(form()).not.toBeNull()
  expect(useTaskStore.getState().tasks[0].tags).toEqual(['client'])
  await enter(form())
  expect(useTaskStore.getState().tasks[0].tags).toEqual([])
})

it('does not duplicate draft children after an edit write fails after changing memory', async () => {
  const task = seed()
  await render(React.createElement(Harness, { task }))
  await setInput(input(zh.subtask_placeholder), 'Retry child')
  const storage = useTaskStore.persist.getOptions().storage!
  const setItem = storage.setItem.bind(storage)
  let fail = true
  vi.spyOn(storage, 'setItem').mockImplementation((key, value) => {
    if (key.endsWith('-tasks') && fail) { fail = false; throw new Error('Synthetic disk full') }
    setItem(key, value)
  })
  await enter(button(zh.taskPriority_medium))
  expect(form()).not.toBeNull()
  expect(useTaskStore.getState().tasks[0].subTasks.map(sub => sub.title)).toEqual(['Original child', 'Retry child'])
  await enter(button(zh.taskPriority_medium))
  expect(form()).toBeNull()
  expect(useTaskStore.getState().tasks[0].subTasks.map(sub => sub.title)).toEqual(['Original child', 'Retry child'])
})

it('does not close or recreate a task that another operation deleted while its drawer was open', async () => {
  const task = seed()
  await render(React.createElement(Harness, { task }))
  await act(async () => useTaskStore.getState().deleteTask(task.id))
  await enter(input(zh.taskDrawer_titlePlaceholder))
  expect(form()).not.toBeNull()
  expect(showToast).toHaveBeenCalledWith(zh.activity_actionFailed)
  expect(useTaskStore.getState().tasks).toHaveLength(1)
  expect(useTaskStore.getState().tasks[0].deletedAt).not.toBeNull()
})


it.each((['top-level', 'nested'] as const).flatMap(level => (['local', 'whole-task'] as const).map(retry => ({ level, retry }))))(
  'retries a failed $level child addition through $retry without duplicate IDs or losing late edits',
  async ({ level, retry }) => {
    const task = seed()
    await render(React.createElement(Harness, { task }))
    let draft: HTMLInputElement
    if (level === 'nested') {
      await click(container.querySelector('button[title="' + zh.subtask_add + '"]')!)
      draft = container.querySelector<HTMLInputElement>('[data-task-child-draft]')!
    } else draft = input(zh.subtask_placeholder)
    await setInput(draft, 'Retry local child')
    const storage = useTaskStore.persist.getOptions().storage!
    const setItem = storage.setItem.bind(storage)
    let fail = true
    vi.spyOn(storage, 'setItem').mockImplementation((key, value) => {
      if (key.endsWith('-tasks') && fail) { fail = false; throw new Error('Synthetic disk full') }
      setItem(key, value)
    })
    await enter(draft)
    expect(form()).not.toBeNull()
    expect(draft.value).toBe('Retry local child')
    expect(showToast).toHaveBeenCalledWith(zh.activity_actionFailed)
    const afterFailure = useTaskStore.getState().tasks[0]
    const added = level === 'nested' ? afterFailure.subTasks[0].subTasks[0] : afterFailure.subTasks[1]
    expect(added.title).toBe('Retry local child')
    await act(async () => {
      useTaskStore.getState().addSubTask(task.id, 'Late external child')
      useTaskStore.getState().updateTask(task.id, { status: 'done', actualMinutes: 88, completionReturnStatus: 'waiting', completionId: 'late-completion' })
    })
    if (retry === 'local') {
      await enter(draft)
      expect(form()).not.toBeNull()
      await enter(form())
    } else await enter(button(zh.taskPriority_medium))
    expect(form()).toBeNull()
    const saved = useTaskStore.getState().tasks[0]
    const siblings = level === 'nested' ? saved.subTasks[0].subTasks : saved.subTasks
    expect(siblings.filter(sub => sub.title === 'Retry local child').map(sub => sub.id)).toEqual([added.id])
    expect(saved.subTasks.some(sub => sub.title === 'Late external child')).toBe(true)
    expect(saved).toMatchObject({ status: 'done', actualMinutes: 88, completionReturnStatus: 'waiting', completionId: 'late-completion' })
  },
)

it('retains an inline title after persistence failure and retries even when memory already has that title', async () => {
  const task = seed()
  await render(React.createElement(Harness, { task }))
  await click([...container.querySelectorAll('span')].find(element => element.textContent === 'Original child')!)
  const edit = [...container.querySelectorAll<HTMLInputElement>('input')].find(element => element.value === 'Original child')!
  await setInput(edit, 'Retained inline edit')
  const storage = useTaskStore.persist.getOptions().storage!
  const setItem = storage.setItem.bind(storage)
  let fail = true
  const writes = vi.spyOn(storage, 'setItem').mockImplementation((key, value) => {
    if (key.endsWith('-tasks') && fail) { fail = false; throw new Error('Synthetic disk full') }
    setItem(key, value)
  })
  await enter(edit)
  expect(form()).not.toBeNull()
  expect(edit.isConnected).toBe(true)
  expect(edit.value).toBe('Retained inline edit')
  expect(showToast).toHaveBeenCalledWith(zh.activity_actionFailed)
  expect(useTaskStore.getState().tasks[0].subTasks[0].title).toBe('Retained inline edit')
  const failedWrites = writes.mock.calls.length
  await enter(edit)
  expect(writes.mock.calls.length).toBeGreaterThan(failedWrites)
  expect(edit.isConnected).toBe(false)
  expect(form()).not.toBeNull()
  await enter(form())
  expect(form()).toBeNull()
})
