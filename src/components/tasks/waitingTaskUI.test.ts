// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import type { Task } from '@/types/task'
vi.hoisted(() => { vi.stubGlobal('window', document.defaultView) })
import { TaskItem } from './TaskItem'
import { TaskList } from './TaskList'
import { TaskDrawer } from './TaskDrawer'
import { TaskDragHandle } from './TaskDragHandle'
import { InteriorSpace } from '@/components/interior/InteriorSpace'
import { AreaCard } from '@/components/worldmap/AreaCard'
import { useTaskStore } from '@/stores/taskStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { useAreaStore } from '@/stores/areaStore'
import { useHabitStore } from '@/stores/habitStore'
import { useCharacterStore } from '@/stores/characterStore'
import { useGrowthEventStore } from '@/stores/growthEventStore'
import { endTaskDrag, isTaskDrag, takeDraggedTask, TASK_DRAG_MIME } from '@/utils/taskDrag'
import { zh } from '@/i18n/zh'
import { en } from '@/i18n/en'

let container: HTMLDivElement
let root: Root
const dictionaries = { zh, en }
const now = '2026-10-22T10:00:00Z'
function task(id: string, patch: Partial<Task> = {}): Task {
  return { id, title: `Task ${id}`, category: 'home', difficulty: 2, priority: 'medium',
    dueDate: null, description: '', actualMinutes: 0, status: 'todo', xpReward: 0,
    completedAt: null, deletedAt: null, isHidden: false, sortOrder: 0,
    timerStartedAt: null, timerAccumulated: 0, tags: [], subTasks: [], createdAt: now, updatedAt: now, ...patch }
}
function LiveTask({ id, compact = true, onEdit }: { id: string; compact?: boolean; onEdit?: (item: Task) => void }) {
  const value = useTaskStore((state) => state.tasks.find((item) => item.id === id))
  return value ? React.createElement(TaskItem, { task: value, compact, onEdit }) : null
}
function button(label: string, scope: ParentNode = document): HTMLButtonElement {
  const found = Array.from(scope.querySelectorAll('button')).find((node) => node.textContent?.trim() === label || node.getAttribute('aria-label') === label)
  expect(found, `Missing button: ${label}`).toBeDefined()
  return found!
}
async function click(node: Element) {
  await act(async () => { node.dispatchEvent(new MouseEvent('click', { bubbles: true })) })
}
async function context(node: Element) {
  await act(async () => { node.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, button: 2 })) })
}
async function type(input: HTMLInputElement, value: string) {
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value)
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
}
async function render(node: React.ReactNode) { await act(async () => { root.render(node) }) }
function row(id: string) { return container.querySelector<HTMLElement>(`[data-task-id="${id}"]`)! }
function transfer(): DataTransfer {
  const values = new Map<string, string>()
  return { get types() { return [...values.keys()] }, effectAllowed: 'none',
    setData: (format: string, value: string) => { values.set(format, value) },
    getData: (format: string) => values.get(format) ?? '',
  } as unknown as DataTransfer
}
async function nativeDrag(node: Element, name: string, dataTransfer: DataTransfer) {
  await act(async () => {
    const event = new Event(name, { bubbles: true, cancelable: true })
    Object.defineProperty(event, 'dataTransfer', { value: dataTransfer })
    node.dispatchEvent(event)
  })
}
beforeEach(() => {
  vi.stubGlobal('window', document.defaultView)
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  localStorage.clear(); window.localStorage.clear()
  useSettingsStore.getState().setLanguage('zh')
  useTaskStore.setState({ tasks: [], customTaskGroups: [], completedViewMode: 'area', lastCategory: 'home' })
  useHabitStore.setState({ habits: [] })
  useAreaStore.setState({ areas: useAreaStore.getInitialState().areas })
  useCharacterStore.setState({ character: { ...useCharacterStore.getInitialState().character } })
  useGrowthEventStore.setState({ events: [] })
  container = document.createElement('div'); document.body.append(container); root = createRoot(container)
})
afterEach(async () => {
  endTaskDrag()
  await act(async () => { root.unmount() })
  container.remove()
  vi.restoreAllMocks()
})

describe('waiting task UI', () => {
  it.each(['zh', 'en'] as const)('moves a running task to waiting from its menu, then resumes to todo (%s)', async (lang) => {
    const t = dictionaries[lang]
    useSettingsStore.getState().setLanguage(lang)
    useTaskStore.setState({ tasks: [task('running', { status: 'doing', timerStartedAt: new Date(Date.now() - 65000).toISOString(), timerAccumulated: 120 })] })
    const onEdit = vi.fn()
    await render(React.createElement(LiveTask, { id: 'running', onEdit }))
    await context(row('running'))
    await click(button(t.task_waitingAction))
    const waiting = useTaskStore.getState().tasks[0]
    expect(waiting.status).toBe('waiting')
    expect(waiting.timerStartedAt).toBeNull()
    expect(waiting.timerAccumulated).toBeGreaterThanOrEqual(185)
    expect(row('running').textContent).not.toContain(t.task_waiting)
    expect(row('running').querySelector(`[title="${t.task_startDoing}"]`)).toBeNull()
    expect(Array.from(row('running').querySelectorAll('button')).some((node) => /\d+:\d+/.test(node.textContent ?? ''))).toBe(false)
    await click(Array.from(row('running').querySelectorAll('span')).find((node) => node.textContent === waiting.title)!)
    expect(onEdit).toHaveBeenCalledWith(expect.objectContaining({ status: 'waiting' }))
    await click(button(t.task_resumeWaiting, row('running')))
    expect(useTaskStore.getState().tasks[0]).toMatchObject({ status: 'todo', timerStartedAt: null, timerAccumulated: waiting.timerAccumulated })
    expect(row('running').textContent).not.toContain(t.task_waiting)
  })

  it.each(['zh', 'en'] as const)('groups waiting tasks and preserves category and tag filtering (%s)', async (lang) => {
    const t = dictionaries[lang]
    useSettingsStore.getState().setLanguage(lang)
    useTaskStore.setState({ tasks: [
      task('home-alpha', { status: 'waiting', tags: ['alpha'] }),
      task('home-beta', { status: 'waiting', tags: ['beta'] }),
      task('library-alpha', { status: 'waiting', category: 'library', tags: ['alpha'] }),
      task('hidden', { status: 'waiting', isHidden: true }), task('deleted', { status: 'waiting', deletedAt: now }),
    ] })
    await render(React.createElement(TaskList))
    expect(container.textContent).toContain(t.tasklist_waiting)
    expect(row('home-alpha')).not.toBeNull(); expect(row('library-alpha')).not.toBeNull()
    expect(row('hidden')).toBeNull(); expect(row('deleted')).toBeNull()
    await click(button(t.areaName_home))
    expect(row('library-alpha')).toBeNull()
    await click(button('alpha'))
    await vi.waitFor(() => expect(row('home-beta')).toBeNull())
    expect(row('home-alpha')).not.toBeNull()
    await click(button(t.tag_clearFilter))
    expect(row('home-beta')).not.toBeNull()
  })

  it.each(['zh', 'en'] as const)('edits waiting details, resumes, and omits the drawer move-to-waiting action (%s)', async (lang) => {
    const t = dictionaries[lang]
    useSettingsStore.getState().setLanguage(lang)
    const original = task('drawer', { status: 'waiting', timerAccumulated: 120, subTasks: [{ id: 'child', title: 'child', completed: true, sortOrder: 0, subTasks: [], createdAt: now }] })
    useTaskStore.setState({ tasks: [original] })
    const close = vi.fn()
    await render(React.createElement(TaskDrawer, { open: true, onClose: close, editTask: original }))
    await type(container.querySelector<HTMLInputElement>('form input')!, 'Edited waiting')
    await act(async () => { container.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })) })
    expect(close).toHaveBeenCalled()
    expect(useTaskStore.getState().tasks[0]).toMatchObject({ title: 'Edited waiting', status: 'waiting', timerAccumulated: 120, subTasks: original.subTasks })
    await click(button(t.task_resumeWaiting))
    expect(useTaskStore.getState().tasks[0].status).toBe('todo')
    expect(Array.from(container.querySelectorAll('button')).some(node => node.textContent?.trim() === t.task_waitingAction)).toBe(false)
  })

  it('can complete a waiting task, edit its completed duration, undo and recycle it', async () => {
    useTaskStore.setState({ tasks: [task('complete', { status: 'waiting', timerAccumulated: 120 })] })
    await render(React.createElement(LiveTask, { id: 'complete' }))
    await click(row('complete').querySelector('button:not([draggable])')!)
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 700)) })
    expect(useTaskStore.getState().tasks[0].status).toBe('done')
    expect(useCharacterStore.getState().character.totalXP).toBe(0)
    const completed = useTaskStore.getState().tasks[0]
    await render(React.createElement(TaskDrawer, { open: true, onClose: vi.fn(), editTask: completed }))
    expect(Array.from(container.querySelectorAll('button')).some((node) => node.textContent === zh.task_waitingAction)).toBe(false)
    const duration = Array.from(container.querySelectorAll<HTMLInputElement>('input[type="number"]')).find((node) => node.min === '0')!
    await type(duration, '12')
    await act(async () => { container.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })) })
    expect(useTaskStore.getState().tasks[0]).toMatchObject({ status: 'done', actualMinutes: 12 })
    await render(React.createElement(LiveTask, { id: 'complete' }))
    await click(row('complete').querySelector('button:not([draggable])')!)
    expect(useTaskStore.getState().tasks[0].status).toBe('todo')
    expect(useCharacterStore.getState().character.totalXP).toBe(0)
    await act(async () => { useTaskStore.getState().waitTask('complete') })
    await context(row('complete'))
    await click(button(zh.task_delete))
    expect(useTaskStore.getState().tasks[0]).toMatchObject({ status: 'waiting', deletedAt: expect.any(String) })
    await render(React.createElement(TaskList))
    await click(container.querySelector(`[title="${zh.tasklist_trashTooltip}"]`)!)
    await click(button(zh.tasklist_restore))
    expect(useTaskStore.getState().tasks[0]).toMatchObject({ status: 'waiting', deletedAt: null })
  })

  it('uses a separate native drag grip and cancels its document token on drag end', async () => {
    const outerPointer = vi.fn(), outerDrag = vi.fn(), outerClick = vi.fn()
    const value = task('drag')
    await render(React.createElement('div', { onPointerDown: outerPointer, onDragStart: outerDrag, onClick: outerClick }, React.createElement(TaskDragHandle, { task: value })))
    const grip = button(zh.task_dragToWaiting)
    await act(async () => { grip.dispatchEvent(new Event('pointerdown', { bubbles: true })) })
    await click(grip)
    const dataTransfer = transfer()
    await nativeDrag(grip, 'dragstart', dataTransfer)
    expect(outerPointer).not.toHaveBeenCalled(); expect(outerDrag).not.toHaveBeenCalled(); expect(outerClick).not.toHaveBeenCalled()
    expect(dataTransfer.types).toContain(TASK_DRAG_MIME)
    expect(isTaskDrag({ dataTransfer })).toBe(true)
    await nativeDrag(grip, 'dragend', dataTransfer)
    expect(takeDraggedTask({ dataTransfer })).toBeNull()
    await nativeDrag(grip, 'dragstart', dataTransfer)
    expect(takeDraggedTask({ dataTransfer })).toBe(value.id)
  })

  it.each([{ status: 'done' as const }, { isHidden: true }, { deletedAt: now }])('does not expose native dragging for inactive tasks: %j', async (patch) => {
    await render(React.createElement(TaskDragHandle, { task: task('inactive', patch) }))
    expect(container.querySelector('[draggable]')).toBeNull()
  })

  it.each(['zh', 'en'] as const)('shows and resumes waiting tasks inside their category, and counts them on its card (%s)', async (lang) => {
    const t = dictionaries[lang]
    useSettingsStore.getState().setLanguage(lang)
    useTaskStore.setState({ tasks: [task('interior', { status: 'waiting', timerAccumulated: 120 })] })
    const area = useAreaStore.getState().areas.find((value) => value.category === 'home')!
    await render(React.createElement(AreaCard, { area, editMode: false, onClick: vi.fn(), onRename: vi.fn(), onDelete: vi.fn() }))
    expect(container.querySelector(`[aria-label="${t.task_waiting}: 1"]`)).not.toBeNull()
    await render(React.createElement(InteriorSpace, { area, onExit: vi.fn() }))
    expect(container.textContent).toContain('Task interior')
    expect(container.textContent).not.toContain(t.task_waiting)
    expect(container.querySelector(`[title="${t.task_timerStart}"]`)).toBeNull()
    await click(button(t.task_resumeWaiting))
    expect(useTaskStore.getState().tasks[0]).toMatchObject({ status: 'todo', timerStartedAt: null, timerAccumulated: 120 })
    expect(container.querySelector(`[title="${t.task_timerStart}"]`)).not.toBeNull()
  })
})
