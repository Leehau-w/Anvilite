// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { GrowthEvent } from '@/types/growthEvent'
import type { Task } from '@/types/task'
import type { Habit } from '@/types/habit'

vi.hoisted(() => {
  vi.stubGlobal('window', document.defaultView)
  vi.stubGlobal('localStorage', document.defaultView!.localStorage)
})
import { MilestoneHall } from './MilestoneHall'
import { useGrowthEventStore } from '@/stores/growthEventStore'
import { useCharacterStore } from '@/stores/characterStore'
import { useTaskStore } from '@/stores/taskStore'
import { useHabitStore } from '@/stores/habitStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { useAreaStore } from '@/stores/areaStore'
import { zh } from '@/i18n/zh'
import { en } from '@/i18n/en'
import { formatDateKey } from '@/utils/time'

let container: HTMLDivElement
let root: Root
const dictionaries = { zh, en }
function event(id: string, type: GrowthEvent['type'], title = id): GrowthEvent {
  return { id, type, title, details: { description: 'Original note', actualMinutes: 42, xpGained: 500, oreGained: 200 },
    isMilestone: true, timestamp: '2026-10-23T10:00:00Z' }
}
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  localStorage.clear()
  useGrowthEventStore.setState({ events: [] })
  useTaskStore.setState({ tasks: [], customTaskGroups: [] })
  useHabitStore.setState({ habits: [], customHabitGroups: [] })
  useAreaStore.setState({ areas: useAreaStore.getInitialState().areas })
  useCharacterStore.setState({ character: { ...useCharacterStore.getInitialState().character, totalXP: 12345, ore: 678, level: 35 } })
  useSettingsStore.getState().setLanguage('zh')
  container = document.createElement('div'); document.body.append(container); root = createRoot(container)
})
afterEach(async () => {
  await act(async () => root.unmount())
  container.remove(); vi.useRealTimers(); vi.restoreAllMocks()
})
async function render() { await act(async () => root.render(React.createElement(MilestoneHall))) }
async function click(node: Element) { await act(async () => { node.dispatchEvent(new MouseEvent('click', { bubbles: true })) }) }
function button(text: string) {
  const node = [...container.querySelectorAll('button')].find(item => item.textContent?.trim() === text)
  expect(node, text).toBeDefined(); return node!
}
async function input(node: HTMLInputElement | HTMLTextAreaElement, value: string) {
  await act(async () => {
    const prototype = node.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype
    Object.getOwnPropertyDescriptor(prototype, 'value')!.set!.call(node, value)
    node.dispatchEvent(new Event('input', { bubbles: true }))
  })
}
async function save() { await act(async () => { container.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })) }) }

it.each(['zh', 'en'] as const)('shows marked milestones while preserving ordinary activity and reward-only history in storage (%s)', async lang => {
  const t = dictionaries[lang]
  useSettingsStore.getState().setLanguage(lang)
  const realTypes: GrowthEvent['type'][] = ['task_complete', 'habit_complete', 'habit_skip', 'habit_miss', 'milestone', 'custom_milestone']
  const rewardTypes: GrowthEvent['type'][] = ['badge_earned', 'level_up', 'area_level_up', 'prestige']
  const unmarked = { ...event('ordinary-task', 'task_complete', 'Ordinary completed task'), isMilestone: false }
  const original = [...realTypes.map(type => event(type, type)), unmarked,
    ...rewardTypes.map(type => ({ ...event(type, type, 'Legacy reward ' + type), details: {} }))]
  useGrowthEventStore.setState({ events: original })
  const persisted = localStorage.getItem('anvilite-growth-events')!
  await render()
  expect(container.textContent).toContain(t.milestone_pageTitle)
  expect(container.querySelectorAll('[data-activity-id]')).toHaveLength(6)
  for (const type of realTypes) expect(container.querySelector('[data-activity-id="' + type + '"]')).not.toBeNull()
  for (const type of rewardTypes) expect(container.querySelector('[data-activity-id="' + type + '"]')).toBeNull()
  expect(container.querySelector('[data-activity-id="ordinary-task"]')).toBeNull()
  expect(container.textContent).toContain(t.activity_taskComplete)
  expect(container.textContent).toContain(t.activity_habitComplete)
  expect(container.textContent).toContain(t.activity_habitSkip)
  expect(container.textContent).toContain(t.heatmap_minutes(42))
  for (const type of ['milestone', 'custom_milestone']) {
    const card = container.querySelector('[data-activity-id="' + type + '"]')!
    expect(card.textContent).not.toContain(t.activity_manual)
    const date = card.querySelector('time')!
    const localDay = formatDateKey(new Date(original[0].timestamp))
    expect(date.getAttribute('datetime')).toBe(localDay)
    expect(date.textContent).toBe(new Date(localDay + 'T12:00:00').toLocaleDateString(lang === 'zh' ? 'zh-CN' : 'en-US'))
    expect(date.textContent).not.toContain(':')
  }
  expect(container.textContent).not.toMatch(/Legacy reward|Ordinary completed task|\bXP\b|Lv\.|⛏/)
  expect(useGrowthEventStore.getState().events).toEqual(original)
  await act(async () => {
    useGrowthEventStore.setState({ events: [] })
    localStorage.setItem('anvilite-growth-events', persisted)
    await useGrowthEventStore.persist.rehydrate()
  })
  expect(useGrowthEventStore.getState().events).toEqual(original)
  expect(container.querySelectorAll('[data-activity-id]')).toHaveLength(6)
  expect(container.querySelector('[data-activity-id="ordinary-task"]')).toBeNull()
})

it.each(['zh', 'en'] as const)('creates notes only on save and preserves IME/cancel drafts (%s)', async lang => {
  const t = dictionaries[lang]
  useSettingsStore.getState().setLanguage(lang)
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 9, 23, 0, 5))
  await render(); await click(button(t.activity_add))
  expect(container.querySelector<HTMLInputElement>('[data-milestone-date]')!.value).toBe('2026-10-23')
  await input(container.querySelector('[data-milestone-date]')!, '2025-12-31')
  const title = container.querySelector<HTMLInputElement>('[data-activity-title]')!
  await input(title, '  Personal milestone  ')
  await input(container.querySelector('[data-activity-notes]')!, '  Important details  ')
  let composed!: KeyboardEvent
  await act(async () => {
    composed = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key: 'Enter', isComposing: true })
    title.dispatchEvent(composed)
  })
  expect(composed.defaultPrevented).toBe(true)
  expect(useGrowthEventStore.getState().events).toHaveLength(0)
  await click(button(t.common_cancel))
  expect(useGrowthEventStore.getState().events).toHaveLength(0)
  await click(button(t.activity_add))
  expect(container.querySelector<HTMLInputElement>('[data-activity-title]')!.value).toBe('')
  expect(container.querySelector<HTMLInputElement>('[data-milestone-date]')!.value).toBe('2026-10-23')
  await input(container.querySelector('[data-milestone-date]')!, '2026-01-09')
  await input(container.querySelector('[data-activity-title]')!, '  Saved memory  ')
  await input(container.querySelector('[data-activity-notes]')!, '  Saved details  ')
  await save()
  expect(useGrowthEventStore.getState().events).toHaveLength(1)
  expect(useGrowthEventStore.getState().events[0]).toMatchObject({ type: 'custom_milestone', title: 'Saved memory', details: { description: 'Saved details', milestoneDate: '2026-01-09' }, isMilestone: true })
  expect(container.querySelector('[data-activity-editor]')).toBeNull()
  expect(useCharacterStore.getState().character).toMatchObject({ totalXP: 12345, ore: 678, level: 35 })
})

it.each(['zh', 'en'] as const)('retains a failed new milestone draft and retries without duplicate records (%s)', async lang => {
  const t = dictionaries[lang]
  useSettingsStore.getState().setLanguage(lang)
  const original = event('existing-memory', 'custom_milestone', 'Existing memory')
  useGrowthEventStore.setState({ events: [original] })
  const persisted = localStorage.getItem('anvilite-growth-events')
  const business = JSON.stringify({ tasks: useTaskStore.getState().tasks, habits: useHabitStore.getState().habits,
    character: useCharacterStore.getState().character })
  await render(); await click(button(t.activity_add))
  await input(container.querySelector('[data-activity-title]')!, '  Retry memory  ')
  await input(container.querySelector('[data-milestone-date]')!, '2024-02-29')
  await input(container.querySelector('[data-activity-notes]')!, '  Retained draft  ')
  const realSet = localStorage.setItem.bind(localStorage)
  let unavailable = true
  vi.spyOn(localStorage, 'setItem').mockImplementation((key, value) => {
    if (unavailable && key === 'anvilite-growth-events') throw new Error('Storage unavailable')
    realSet(key, value)
  })
  await save()
  expect(useGrowthEventStore.getState().events).toEqual([original])
  expect(localStorage.getItem('anvilite-growth-events')).toBe(persisted)
  expect(container.querySelector('[role="alert"]')!.textContent).toBe(t.activity_actionFailed)
  expect(container.querySelector<HTMLInputElement>('[data-activity-title]')!.value).toBe('  Retry memory  ')
  expect(container.querySelector<HTMLInputElement>('[data-milestone-date]')!.value).toBe('2024-02-29')
  expect(container.querySelector<HTMLTextAreaElement>('[data-activity-notes]')!.value).toBe('  Retained draft  ')
  unavailable = false
  await save()
  expect(container.querySelector('[data-activity-editor]')).toBeNull()
  expect(useGrowthEventStore.getState().events).toHaveLength(2)
  const saved = useGrowthEventStore.getState().events.filter(item => item.title === 'Retry memory')
  expect(saved).toHaveLength(1)
  expect(saved[0]).toMatchObject({ type: 'custom_milestone', isMilestone: true,
    details: { milestoneDate: '2024-02-29', description: 'Retained draft' } })
  expect(useGrowthEventStore.getState().events.find(item => item.id === original.id)).toEqual(original)
  expect(JSON.parse(localStorage.getItem('anvilite-growth-events')!).state.events).toEqual(useGrowthEventStore.getState().events)
  expect(JSON.stringify({ tasks: useTaskStore.getState().tasks, habits: useHabitStore.getState().habits,
    character: useCharacterStore.getState().character })).toBe(business)
})

it.each(['zh', 'en'] as const)('edits milestone notes and confirms deletion without changing the task, habit or legacy rewards (%s)', async lang => {
  const t = dictionaries[lang]
  useSettingsStore.getState().setLanguage(lang)
  const task = useTaskStore.getState().addTask({ title: 'Original completed work' })
  useTaskStore.getState().updateTask(task.id, { status: 'done', completedAt: new Date().toISOString(), completionId: 'original-completion', actualMinutes: 42, xpReward: 500 })
  const originalEvent = event('actual-completion', 'task_complete', 'Original completed work')
  originalEvent.details.entityId = task.id
  originalEvent.details.completionId = 'original-completion'
  const legacyReward = { ...event('old-reward', 'level_up'), details: {} }
  useGrowthEventStore.setState({ events: [originalEvent, legacyReward] })
  const business = JSON.stringify({ tasks: useTaskStore.getState().tasks, habits: useHabitStore.getState().habits, character: useCharacterStore.getState().character })
  await render()
  await click(container.querySelector('[data-activity-id="actual-completion"]')!)
  await input(container.querySelector('[data-activity-notes]')!, 'Draft note')
  expect(useGrowthEventStore.getState().events[0].details.description).toBe('Original note')
  await click(button(t.common_cancel))
  await click(container.querySelector('[data-activity-id="actual-completion"]')!)
  expect(container.querySelector<HTMLTextAreaElement>('[data-activity-notes]')!.value).toBe('Original note')
  await input(container.querySelector('[data-activity-notes]')!, '  Revised note  '); await save()
  expect(useGrowthEventStore.getState().events[0]).toEqual({ ...originalEvent, details: { ...originalEvent.details, description: 'Revised note', milestoneDate: formatDateKey(new Date(originalEvent.timestamp)) } })
  await click(container.querySelector('[data-activity-id="actual-completion"]')!)
  await click(button(t.common_delete))
  expect(useGrowthEventStore.getState().events).toHaveLength(2)
  await click(button(t.activity_deleteConfirm))
  expect(useGrowthEventStore.getState().events).toEqual([legacyReward])
  expect(container.textContent).toContain(t.milestone_empty1)
  expect(JSON.stringify({ tasks: useTaskStore.getState().tasks, habits: useHabitStore.getState().habits, character: useCharacterStore.getState().character })).toBe(business)
})

it.each(['zh', 'en'] as const)('keeps earlier personal inscriptions visible without exposing their reward titles or metadata (%s)', async lang => {
  const t = dictionaries[lang]
  useSettingsStore.getState().setLanguage(lang)
  const oldTypes: GrowthEvent['type'][] = ['level_up', 'badge_earned', 'area_level_up', 'prestige']
  const notes = oldTypes.map(type => ({ ...event('personal-' + type, type, 'Old game headline ' + type),
    details: { description: 'Personal memory for ' + type, actualMinutes: 99999, xpGained: 88888, oreGained: 77777,
      newLevel: 98, categoryName: 'Old game category', badgeId: 'old-badge', prosperityLevel: 6 } }))
  const taskNote = { ...event('task-note', 'task_complete', 'Marked task'), isMilestone: true }
  const habitNote = { ...event('habit-note', 'habit_complete', 'Marked habit'), isMilestone: true }
  const plainTask = { ...event('plain-task', 'task_complete', 'Plain completed task'), isMilestone: false }
  const emptyReward = { ...event('blank-reward', 'level_up', 'Empty game headline'), details: { description: '  ' } }
  const unmarkedReward = { ...event('unmarked-reward', 'badge_earned', 'Unmarked game headline'), isMilestone: false }
  const original = [...notes, taskNote, habitNote, plainTask, emptyReward, unmarkedReward]
  useGrowthEventStore.setState({ events: original })
  const persisted = localStorage.getItem('anvilite-growth-events')!
  await render()
  expect(container.querySelectorAll('[data-activity-id]')).toHaveLength(6)
  expect(container.textContent?.split(t.activity_legacyNote)).toHaveLength(5)
  expect(container.textContent).not.toMatch(/game headline|Old game category|99999|88888|77777|old-badge/)
  expect(useGrowthEventStore.getState().events).toEqual(original)
  expect(container.querySelector('[data-activity-id="task-note"]')).not.toBeNull()
  expect(container.querySelector('[data-activity-id="habit-note"]')).not.toBeNull()
  expect(container.querySelector('[data-activity-id="plain-task"]')).toBeNull()
  await click(container.querySelector('[data-activity-id="personal-level_up"]')!)
  expect(container.querySelector<HTMLInputElement>('[data-activity-title]')!.value).toBe(t.activity_legacyNote)
  expect(container.querySelector('[data-activity-editor]')!.textContent).not.toContain('Old game headline')
  await input(container.querySelector('[data-activity-notes]')!, '  Updated personal memory  '); await save()
  const updated = useGrowthEventStore.getState().events.find(item => item.id === notes[0].id)!
  expect(updated).toEqual({ ...notes[0], details: { ...notes[0].details, description: 'Updated personal memory', milestoneDate: formatDateKey(new Date(notes[0].timestamp)) } })
  await act(async () => {
    useGrowthEventStore.setState({ events: [] })
    localStorage.setItem('anvilite-growth-events', persisted)
    await useGrowthEventStore.persist.rehydrate()
  })
  expect(useGrowthEventStore.getState().events).toEqual(original)
  expect(container.querySelectorAll('[data-activity-id]')).toHaveLength(6)
  expect(container.textContent).toContain('Personal memory for level_up')
  expect(container.textContent).not.toContain('Old game headline')
})


it.each(['zh', 'en'] as const)('edits milestone titles and calendar days without rewriting linked completions, including after reload (%s)', async lang => {
  const t = dictionaries[lang]
  useSettingsStore.getState().setLanguage(lang)
  const task = syntheticTask('linked-task', { completedAt: '2026-10-22T23:35:47.123Z', completionId: 'task-completion' })
  const habit = syntheticHabit('linked-habit', { lastCompletedAt: '2026-10-21T22:25:32.456Z', totalCompletions: 7 })
  useTaskStore.setState({ tasks: [task] })
  useHabitStore.setState({ habits: [habit] })
  const originals = [
    { ...event('task-memory', 'task_complete', 'Original task title'), timestamp: task.completedAt!,
      details: { entityId: task.id, completionId: 'task-completion', actualMinutes: 20.5, description: 'Task notes', categoryName: 'home' } },
    { ...event('habit-memory', 'habit_complete', 'Original habit title'), timestamp: habit.lastCompletedAt!,
      details: { entityId: habit.id, completionId: 'habit-completion', actualMinutes: 17, description: 'Habit notes', categoryName: 'home' } },
  ]
  useGrowthEventStore.setState({ events: originals })
  const business = JSON.stringify({ tasks: useTaskStore.getState().tasks, habits: useHabitStore.getState().habits,
    character: useCharacterStore.getState().character })
  await render()
  for (const [index, original] of originals.entries()) {
    await click(container.querySelector('[data-activity-id="' + original.id + '"]')!)
    const date = container.querySelector<HTMLInputElement>('[data-milestone-date]')!
    expect(date.type).toBe('date')
    expect(date.value).toBe(formatDateKey(new Date(original.timestamp)))
    expect(container.querySelector<HTMLInputElement>('[data-activity-title]')!.value).toBe(original.title)
    const nextDay = index === 0 ? '2024-02-29' : '2025-12-31'
    await input(container.querySelector('[data-activity-title]')!, '  Revised personal title ' + index + '  ')
    await input(date, nextDay)
    await input(container.querySelector('[data-activity-notes]')!, '  Revised personal note ' + index + '  ')
    expect(useGrowthEventStore.getState().events.find(item => item.id === original.id)).toEqual(original)
    await save()
    expect(useGrowthEventStore.getState().events.find(item => item.id === original.id)).toEqual({ ...original,
      details: { ...original.details, milestoneTitle: 'Revised personal title ' + index, milestoneDate: nextDay,
        description: 'Revised personal note ' + index } })
    const card = container.querySelector('[data-activity-id="' + original.id + '"]')!
    expect(card.textContent).toContain('Revised personal title ' + index)
    expect(card.textContent).not.toContain(original.title)
    expect(card.querySelector('time')!.getAttribute('datetime')).toBe(nextDay)
    expect(card.querySelector('time')!.textContent).not.toContain(':')
    expect(JSON.stringify({ tasks: useTaskStore.getState().tasks, habits: useHabitStore.getState().habits,
      character: useCharacterStore.getState().character })).toBe(business)
  }
  // Presentation order follows the edited day, while persisted completion records keep their original timestamps.
  expect([...container.querySelectorAll<HTMLElement>('[data-activity-id]')].map(item => item.dataset.activityId)).toEqual(['habit-memory', 'task-memory'])
  const edited = useGrowthEventStore.getState().events
  const persisted = localStorage.getItem('anvilite-growth-events')!
  await act(async () => {
    useGrowthEventStore.setState({ events: [] })
    localStorage.setItem('anvilite-growth-events', persisted)
    await useGrowthEventStore.persist.rehydrate()
  })
  expect(useGrowthEventStore.getState().events).toEqual(edited)
  await click(container.querySelector('[data-activity-id="task-memory"]')!)
  expect(container.querySelector<HTMLInputElement>('[data-activity-title]')!.value).toBe('Revised personal title 0')
  expect(container.querySelector<HTMLInputElement>('[data-milestone-date]')!.value).toBe('2024-02-29')
  await click(button(t.common_cancel))
  expect(useGrowthEventStore.getState().events).toEqual(edited)
})

it.each(['zh', 'en'] as const)('keeps title/date edits as drafts and rejects empty or invalid calendar fields (%s)', async lang => {
  const t = dictionaries[lang]
  useSettingsStore.getState().setLanguage(lang)
  const original = event('manual-memory', 'custom_milestone', 'Saved title')
  useGrowthEventStore.setState({ events: [original] })
  await render()
  const card = container.querySelector('[data-activity-id="manual-memory"]')!
  expect(card.textContent).not.toContain(t.activity_manual)
  await click(card)
  const title = container.querySelector<HTMLInputElement>('[data-activity-title]')!
  const date = container.querySelector<HTMLInputElement>('[data-milestone-date]')!
  await input(title, 'Unsaved title')
  await input(date, '2020-06-15')
  await click(button(t.common_cancel))
  expect(useGrowthEventStore.getState().events).toEqual([original])
  await click(container.querySelector('[data-activity-id="manual-memory"]')!)
  expect(container.querySelector<HTMLInputElement>('[data-activity-title]')!.value).toBe('Saved title')
  expect(container.querySelector<HTMLInputElement>('[data-milestone-date]')!.value).toBe(formatDateKey(new Date(original.timestamp)))
  await input(container.querySelector('[data-activity-title]')!, '  ')
  expect(button(t.common_save).disabled).toBe(true)
  await save()
  expect(container.querySelector('[data-activity-editor]')).not.toBeNull()
  expect(useGrowthEventStore.getState().events).toEqual([original])
  await input(container.querySelector('[data-activity-title]')!, 'Valid title')
  await input(container.querySelector('[data-milestone-date]')!, '')
  expect(button(t.common_save).disabled).toBe(true)
  await save()
  expect(useGrowthEventStore.getState().events).toEqual([original])
  await input(container.querySelector('[data-milestone-date]')!, '2026-02-30')
  expect(button(t.common_save).disabled).toBe(true)
  await save()
  expect(useGrowthEventStore.getState().events).toEqual([original])
  await input(container.querySelector('[data-milestone-date]')!, '2026-02-28')
  expect(button(t.common_save).disabled).toBe(false)
  await click(button(t.common_cancel))
  expect(useGrowthEventStore.getState().events).toEqual([original])
})

function syntheticTask(id: string, patch: Partial<Task> = {}): Task {
  const at = new Date(2026, 9, 23, 0, 5).toISOString()
  return { id, title: id, category: 'home', difficulty: 1, priority: 'medium', dueDate: null,
    description: '', actualMinutes: 20.5, status: 'done', xpReward: 999, completedAt: at,
    deletedAt: null, isHidden: false, sortOrder: 0, timerStartedAt: null, timerAccumulated: 900000,
    tags: [], subTasks: [], createdAt: at, updatedAt: at, ...patch }
}
function syntheticHabit(id: string, patch: Partial<Habit> = {}): Habit {
  const at = new Date(2026, 9, 23, 0, 5).toISOString()
  return { id, title: id, category: 'home', difficulty: 1, estimatedMinutes: 999, repeatType: 'daily',
    customIntervalDays: null, weeklyDays: null, weeklyMode: null, weeklyFlexibleCount: null, monthlyDays: null,
    targetCount: 1, currentCycleCount: 0, startDate: '2026-10-01', endDate: null, reminderTime: null,
    description: '', subHabits: [], status: 'active', isHidden: false, deletedAt: null,
    timerStartedAt: null, timerAccumulated: 900000, actualMinutes: 600, consecutiveCount: 3,
    totalCompletions: 5, toleranceCharges: 0, toleranceNextAt: 7, weeklyCompletionCount: 0,
    lastCompletedAt: null, lastDueAt: null, sortOrder: 0, createdAt: at, updatedAt: at, ...patch }
}
function personalStat(name: string): string {
  const node = container.querySelector('[data-personal-stat="' + name + '"]')
  expect(node, 'Personal statistic: ' + name).not.toBeNull()
  return node!.textContent!
}
function dimensionValue(category: string): number {
  const node = [...container.querySelectorAll<HTMLElement>('[data-capability-category]')]
    .find(item => item.dataset.capabilityCategory === category)
  expect(node, 'Capability category: ' + category).toBeDefined()
  return Number(node!.dataset.capabilityValue)
}
function businessSnapshot(): string {
  return JSON.stringify({ tasks: useTaskStore.getState().tasks, habits: useHabitStore.getState().habits,
    character: useCharacterStore.getState().character, events: useGrowthEventStore.getState().events,
    areas: useAreaStore.getState().areas })
}

it.each(['zh', 'en'] as const)('restores actual personal statistics and a reactive count/time capability chart without reward writes (%s)', async lang => {
  const t = dictionaries[lang]
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 9, 23, 0, 5))
  useSettingsStore.getState().setLanguage(lang)
  useAreaStore.getState().addArea(null, 'Research')
  const tasks = [
    syntheticTask('home-one', { subTasks: [{ id: 'nested', title: 'Nested finished step', completed: true,
      sortOrder: 0, subTasks: [], createdAt: new Date().toISOString() }] }),
    syntheticTask('hidden-home', { isHidden: true, actualMinutes: 19.5 }),
    syntheticTask('custom-category', { category: 'Research', actualMinutes: 40.25 }),
    syntheticTask('missing-category', { category: 'Former category', actualMinutes: 9.75 }),
    syntheticTask('deleted', { deletedAt: new Date().toISOString(), actualMinutes: 700 }),
    syntheticTask('invalid-date', { completedAt: 'not-a-date', actualMinutes: 800 }),
    syntheticTask('missing-date', { completedAt: null, actualMinutes: 900 }),
    syntheticTask('open', { status: 'todo', completedAt: null }),
    syntheticTask('doing', { status: 'doing', completedAt: null }),
    syntheticTask('waiting', { status: 'waiting', completedAt: null }),
  ]
  const habits = [syntheticHabit('active'),
    syntheticHabit('archived', { status: 'archived', isHidden: true, totalCompletions: 7, consecutiveCount: 9 }),
    syntheticHabit('deleted', { deletedAt: new Date().toISOString(), totalCompletions: 100, consecutiveCount: 99 }),
    syntheticHabit('invalid-import', { totalCompletions: Infinity, consecutiveCount: NaN }),
    syntheticHabit('negative-import', { totalCompletions: -6, consecutiveCount: -2 })]
  useTaskStore.setState({ tasks })
  useHabitStore.setState({ habits })
  useCharacterStore.setState({ character: { ...useCharacterStore.getState().character,
    name: 'Personal profile', createdAt: new Date(2026, 9, 8, 23, 55).toISOString() } })
  const original = businessSnapshot()
  await render()
  expect(container.textContent).toContain(t.milestone_pageTitle)
  expect(container.querySelector('[data-personal-overview]')).toBeNull()
  expect(container.textContent).not.toContain('Personal profile')
  expect(container.textContent).toContain(t.milestone_abilityChart)
  expect(container.querySelector('[data-personal-stats]')).not.toBeNull()
  expect(personalStat('tasks')).toBe('4' + t.milestone_statTasksDone)
  expect(personalStat('minutes')).toContain(lang === 'zh' ? '1时30分' : '1h30m')
  expect(personalStat('habitCompletions')).toMatch(/(^|\D)12(\D|$)/)
  expect(personalStat('habitStreak')).toMatch(/(^|\D)9(\D|$)/)
  expect(personalStat('days')).toMatch(/(^|\D)16(\D|$)/)
  expect(personalStat('pending')).toBe('3' + t.overview_pending)
  const chart = container.querySelector<HTMLElement>('[data-capability-chart]')!
  expect(chart.dataset.capabilityMetric).toBe('count')
  expect(dimensionValue('home')).toBe(2)
  expect(dimensionValue('Research')).toBe(1)
  expect(dimensionValue('Former category')).toBe(1)
  expect(button(t.heatmap_countMetric).getAttribute('aria-pressed')).toBe('true')
  expect(container.textContent).not.toMatch(/\bXP\b|\bEXP\b|Lv\.|⛏|12345|678/)
  await click(button(t.heatmap_timeMetric))
  expect(chart.dataset.capabilityMetric).toBe('time')
  expect(button(t.heatmap_timeMetric).getAttribute('aria-pressed')).toBe('true')
  expect(dimensionValue('home')).toBe(40)
  expect(dimensionValue('Research')).toBe(40.25)
  expect(dimensionValue('Former category')).toBe(9.75)
  expect(businessSnapshot()).toBe(original)

  await act(async () => {
    useTaskStore.getState().updateTask('hidden-home', { status: 'todo', completedAt: null })
    useHabitStore.getState().updateHabit('archived', { totalCompletions: 8, consecutiveCount: 10 })
  })
  expect(personalStat('tasks')).toBe('3' + t.milestone_statTasksDone)
  expect(personalStat('minutes')).toContain(lang === 'zh' ? '1时10.5分' : '1h10.5m')
  expect(personalStat('pending')).toBe('4' + t.overview_pending)
  expect(personalStat('habitCompletions')).toMatch(/(^|\D)13(\D|$)/)
  expect(personalStat('habitStreak')).toMatch(/(^|\D)10(\D|$)/)
  expect(dimensionValue('home')).toBe(20.5)
  const afterUpdate = businessSnapshot()
  await click(button(t.heatmap_countMetric))
  expect(chart.dataset.capabilityMetric).toBe('count')
  expect(dimensionValue('home')).toBe(1)
  expect(businessSnapshot()).toBe(afterUpdate)
  expect(useCharacterStore.getState().character).toMatchObject({ totalXP: 12345, ore: 678, level: 35 })
})
