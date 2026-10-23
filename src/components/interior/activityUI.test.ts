// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
vi.hoisted(() => { vi.stubGlobal('window', document.defaultView) })
import { AreaCard } from '@/components/worldmap/AreaCard'
import { InteriorSpace } from './InteriorSpace'
import { ArchiveSpace } from './ArchiveSpace'
import { TaskList } from '@/components/tasks/TaskList'
import { TaskItem } from '@/components/tasks/TaskItem'
import { HabitCard } from '@/components/dashboard/HabitCard'
import { ToastProvider } from '@/components/feedback/Toast'
import { useTaskStore } from '@/stores/taskStore'
import { useHabitStore } from '@/stores/habitStore'
import { useAreaStore } from '@/stores/areaStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { useCharacterStore } from '@/stores/characterStore'
import { useDecorationStore } from '@/stores/decorationStore'
import { useGrowthEventStore } from '@/stores/growthEventStore'
import type { Task } from '@/types/task'
import type { GrowthEvent } from '@/types/growthEvent'
import { zh } from '@/i18n/zh'
import { en } from '@/i18n/en'

let container: HTMLDivElement, root: Root
const dictionaries = { zh, en }
function task(id: string, patch: Partial<Task> = {}): Task {
  const now = new Date().toISOString()
  return { id, title: `Task ${id}`, category: 'home', status: 'done', difficulty: 2, priority: 'medium', dueDate: null,
    description: '', actualMinutes: 30, xpReward: 640, completedAt: now, deletedAt: null, isHidden: false,
    timerStartedAt: null, timerAccumulated: 0, tags: [], subTasks: [], sortOrder: 0, createdAt: now, updatedAt: now, ...patch }
}
function event(id: string, type: GrowthEvent['type']): GrowthEvent {
  return { id, type, title: id, timestamp: new Date().toISOString(), details: {}, isMilestone: type === 'custom_milestone' }
}
async function render(node: React.ReactNode) { await act(async () => root.render(node)) }
async function click(node: Element) { await act(async () => node.dispatchEvent(new MouseEvent('click', { bubbles: true }))) }
beforeEach(() => {
  vi.stubGlobal('window', document.defaultView)
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  localStorage.clear(); window.localStorage.clear()
  useTaskStore.setState({ tasks: [], customTaskGroups: [], lastCategory: 'home' })
  useHabitStore.setState({ habits: [] })
  useAreaStore.setState({ areas: useAreaStore.getInitialState().areas })
  useCharacterStore.setState({ character: { ...useCharacterStore.getInitialState().character, level: 9, totalXP: 1234, currentXP: 34, ore: 78 } })
  useDecorationStore.setState({ owned: { 'area-home': ['home_1'] } })
  useGrowthEventStore.setState({ events: [] })
  container = document.createElement('div'); document.body.append(container); root = createRoot(container)
})
afterEach(async () => {
  await act(async () => root.unmount()); container.remove(); vi.restoreAllMocks()
})

it.each(['zh', 'en'] as const)('shows real category completion/time stats and retains owned decorations without levels or shopping (%s)', async lang => {
  const t = dictionaries[lang]
  useSettingsStore.getState().setLanguage(lang)
  const area = useAreaStore.getState().areas.find(item => item.category === 'home')!
  useTaskStore.setState({ tasks: [task('visible'), task('hidden', { isHidden: true, actualMinutes: 45 }),
    task('deleted', { deletedAt: new Date().toISOString(), actualMinutes: 999 }), task('other', { category: 'forge', actualMinutes: 500 }),
    task('open', { status: 'todo', completedAt: null, actualMinutes: 999 })] })
  const oldCharacter = JSON.stringify(useCharacterStore.getState().character)
  await render(React.createElement(AreaCard, { area, editMode: false, onClick: vi.fn(), onRename: vi.fn(), onDelete: vi.fn() }))
  expect(container.textContent).toContain(t.worldmap_cardCompleted)
  expect(container.textContent).toContain(t.heatmap_minutes(75))
  const completedLabel = [...container.querySelectorAll('div')].find(node => node.textContent === t.worldmap_cardCompleted)!
  expect(completedLabel.parentElement!.textContent).toBe(t.worldmap_cardCompleted + '2')
  expect(container.textContent).not.toMatch(/XP|Lv\.|★|☆/)
  await render(React.createElement(InteriorSpace, { area, onExit: vi.fn() }))
  expect(container.textContent).toContain(t.interior_statTasks)
  expect(container.textContent).toContain('1h 15m')
  expect(container.textContent).not.toMatch(/XP|Lv\.|★|☆/)
  expect(container.textContent).not.toContain(t.interior_decoShopBtn)
  expect(container.textContent).not.toContain(t.interior_oreBalance)
  expect(container.querySelector('[title="小木椅"]')?.textContent).toBe('🪑')
  expect(JSON.stringify(useCharacterStore.getState().character)).toBe(oldCharacter)
  expect(useDecorationStore.getState().owned['area-home']).toEqual(['home_1'])
})

it.each(['zh', 'en'] as const)('omits old task XP rewards from list UI while preserving legacy task data (%s)', async lang => {
  useSettingsStore.getState().setLanguage(lang)
  useTaskStore.setState({ tasks: [task('legacy-reward')] })
  const before = JSON.stringify(useTaskStore.getState().tasks)
  await render(React.createElement(TaskList))
  expect(container.textContent).toContain('Task legacy-reward')
  expect(container.textContent).not.toContain('XP')
  expect(JSON.stringify(useTaskStore.getState().tasks)).toBe(before)
})

it.each(['zh', 'en'] as const)('shows real archive history and manual notes without displaying legacy reward events (%s)', async lang => {
  const t = dictionaries[lang]
  useSettingsStore.getState().setLanguage(lang)
  const area = useAreaStore.getState().areas.find(item => item.category === '_milestone')!
  useTaskStore.setState({ tasks: [task('completed-evidence')] })
  useGrowthEventStore.setState({ events: [event('Real task evidence', 'task_complete'), event('Real habit evidence', 'habit_complete'),
    event('Skipped habit evidence', 'habit_skip'), event('User note evidence', 'custom_milestone'), event('Legacy note evidence', 'milestone'),
    event('Old reward level', 'level_up'), event('Old reward badge', 'badge_earned'), event('Old reward prestige', 'prestige'), event('Old category level', 'area_level_up'),
    { ...event('Reward title from an old personal note', 'badge_earned'), isMilestone: true, details: { description: 'Preserved personal note text' } }] })
  const before = JSON.stringify(useGrowthEventStore.getState().events)
  await render(React.createElement(ArchiveSpace, { area, onExit: vi.fn() }))
  await click([...container.querySelectorAll('button')].find(node => node.textContent === t.archive_tabScroll)!)
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 300)) })
  expect(container.textContent).toContain(t.archive_eventTask)
  await click([...container.querySelectorAll('span')].find(node => node.textContent === t.archive_monthLabel(String(new Date().getFullYear()), new Date().getMonth() + 1))!)
  expect(container.textContent).toContain('Real task evidence')
  expect(container.textContent).toContain('Real habit evidence')
  expect(container.textContent).toContain('Skipped habit evidence')
  expect(container.textContent).toContain('User note evidence')
  expect(container.textContent).toContain('Legacy note evidence')
  expect(container.textContent).toContain(t.activity_legacyNote)
  expect(container.textContent).toContain('Preserved personal note text')
  expect(container.textContent).not.toContain('Reward title from an old personal note')
  for (const title of ['Old reward level', 'Old reward badge', 'Old reward prestige', 'Old category level']) expect(container.textContent).not.toContain(title)
  expect(container.textContent).not.toContain(t.archive_eventLevelUp)
  expect(container.textContent).not.toContain(t.archive_eventBadge)
  expect(JSON.stringify(useGrowthEventStore.getState().events)).toBe(before)
})

it.each(['zh', 'en'] as const)('completes and undoes interior tasks and habits through their actual records without touching legacy balances (%s)', async lang => {
  const t = dictionaries[lang]
  useSettingsStore.getState().setLanguage(lang)
  const area = useAreaStore.getState().areas.find(item => item.category === 'home')!
  useTaskStore.setState({ tasks: [task('interior-todo', { status: 'todo', completedAt: null, xpReward: 0, actualMinutes: 0, timerAccumulated: 120,
    subTasks: [{ id: 'child', title: 'Preserved child', completed: false, sortOrder: 0, subTasks: [], createdAt: new Date().toISOString() }] })] })
  const now = new Date(), today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  useHabitStore.getState().addHabit({ title: 'Interior habit evidence', category: 'home', difficulty: 2, estimatedMinutes: 0, repeatType: 'daily',
    customIntervalDays: null, weeklyDays: null, weeklyMode: null, weeklyFlexibleCount: null, monthlyDays: null, targetCount: 1,
    startDate: today, endDate: null, reminderTime: null, description: '' })
  const habit = useHabitStore.getState().habits[0]
  useHabitStore.getState().updateHabit(habit.id, { timerAccumulated: 120 })
  const { totalXP, currentXP, ore, level, prestigeLevel } = useCharacterStore.getState().character
  const legacy = { totalXP, currentXP, ore, level, prestigeLevel }
  await render(React.createElement(InteriorSpace, { area, onExit: vi.fn() }))
  const taskRow = () => container.querySelector(`[data-interior-task-id="interior-todo"]`)!
  await click(taskRow().querySelector('button:not([draggable])')!)
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 70)) })
  expect(useTaskStore.getState().tasks[0]).toMatchObject({ status: 'done', actualMinutes: 2, xpReward: 0 })
  expect(useTaskStore.getState().tasks[0].subTasks[0].completed).toBe(true)
  expect(useGrowthEventStore.getState().events.filter(event => event.type === 'task_complete')).toHaveLength(1)
  await click([...container.querySelectorAll('button')].find(node => node.textContent === t.interior_expandAll(1))!)
  await click(taskRow().querySelector('button:not([draggable])')!)
  expect(useTaskStore.getState().tasks[0].status).toBe('todo')
  // Parent undo retains the explicitly completed child state under the existing store contract.
  expect(useTaskStore.getState().tasks[0].subTasks[0].completed).toBe(true)
  expect(useGrowthEventStore.getState().events.filter(event => event.type === 'task_complete')).toHaveLength(0)
  const habitRow = () => container.querySelector(`[data-interior-habit-id="${habit.id}"]`)!
  await click(habitRow().querySelector('button')!)
  expect(useHabitStore.getState().habits[0]).toMatchObject({ status: 'completed_today', totalCompletions: 1 })
  expect(useGrowthEventStore.getState().events.filter(event => event.type === 'habit_complete')).toHaveLength(1)
  await click([...container.querySelectorAll('button')].find(node => node.textContent === t.interior_allHabits)!)
  await click(habitRow().querySelector('button')!)
  expect(useHabitStore.getState().habits[0]).toMatchObject({ status: 'active', totalCompletions: 0 })
  expect(useGrowthEventStore.getState().events.filter(event => event.type === 'habit_complete')).toHaveLength(0)
  expect(useCharacterStore.getState().character).toMatchObject(legacy)
})

function LiveTaskForRetry() {
  const value = useTaskStore(state => state.tasks[0])
  return React.createElement(TaskItem, { task: value })
}
it.each(['TaskItem', 'InteriorSpace', 'HabitCard'] as const)('reports one failed store write and permits a normal retry without a false completion toast (%s)', async surface => {
  useSettingsStore.getState().setLanguage('en')
  const t = en
  const area = useAreaStore.getState().areas.find(item => item.category === 'home')!
  const oldTaskAction = useTaskStore.getState().completeTask
  const oldHabitAction = useHabitStore.getState().completeHabit
  useTaskStore.setState({ tasks: [task('retry', { status: 'todo', completedAt: null, xpReward: 0, actualMinutes: 0 })] })
  const today = new Date(), date = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  useHabitStore.getState().addHabit({ title: 'Retry habit', category: 'home', difficulty: 2, estimatedMinutes: 0, repeatType: 'daily',
    customIntervalDays: null, weeklyDays: null, weeklyMode: null, weeklyFlexibleCount: null, monthlyDays: null, targetCount: 1,
    startDate: date, endDate: null, reminderTime: null, description: '' })
  const habitId = useHabitStore.getState().habits[0].id
  const failure = () => { throw new Error('Synthetic record write failure') }
  const action = surface === 'HabitCard'
    ? vi.fn(oldHabitAction).mockImplementationOnce(failure)
    : vi.fn(oldTaskAction).mockImplementationOnce(failure)
  if (surface === 'HabitCard') useHabitStore.setState({ completeHabit: action as typeof oldHabitAction })
  else useTaskStore.setState({ completeTask: action as typeof oldTaskAction })
  try {
    const child = surface === 'TaskItem' ? React.createElement(LiveTaskForRetry)
      : surface === 'InteriorSpace' ? React.createElement(InteriorSpace, { area, onExit: vi.fn() })
      : React.createElement(HabitCard)
    await render(React.createElement(ToastProvider, null, child))
    const completionButton = () => surface === 'HabitCard'
      ? container.querySelector(`[data-habit-complete="${habitId}"]`)!
      : surface === 'InteriorSpace'
        ? container.querySelector('[data-interior-task-id="retry"] button:not([draggable])')!
        : container.querySelector('[data-task-id="retry"] button:not([draggable])')!
    await click(completionButton())
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 300)) })
    expect(container.textContent).toContain(t.activity_actionFailed)
    expect(container.textContent).not.toContain(t.task_toastDone(0))
    expect(container.textContent).not.toContain(t.habit_completedToast('Retry habit', 0))
    expect(useGrowthEventStore.getState().events).toHaveLength(0)
    expect(surface === 'HabitCard' ? useHabitStore.getState().habits[0].status : useTaskStore.getState().tasks[0].status).toBe(surface === 'HabitCard' ? 'active' : 'todo')
    await click(completionButton())
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 600)) })
    expect(surface === 'HabitCard' ? useHabitStore.getState().habits[0].status : useTaskStore.getState().tasks[0].status).toBe(surface === 'HabitCard' ? 'completed_today' : 'done')
    expect(useGrowthEventStore.getState().events.filter(event => event.type === (surface === 'HabitCard' ? 'habit_complete' : 'task_complete'))).toHaveLength(1)
    expect(action).toHaveBeenCalledTimes(2)
    expect(useCharacterStore.getState().character).toMatchObject({ totalXP: 1234, currentXP: 34, ore: 78 })
  } finally {
    useTaskStore.setState({ completeTask: oldTaskAction })
    useHabitStore.setState({ completeHabit: oldHabitAction })
  }
})
