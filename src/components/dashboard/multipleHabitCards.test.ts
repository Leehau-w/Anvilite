// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { Habit } from '@/types/habit'

const { reorderHandlers } = vi.hoisted(() => {
  vi.stubGlobal('window', document.defaultView)
  vi.stubGlobal('localStorage', document.defaultView!.localStorage)
  return { reorderHandlers: new Map<string, (habits: Habit[]) => void>() }
})
vi.mock('framer-motion', async importOriginal => ({
  ...await importOriginal<typeof import('framer-motion')>(),
  AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
  Reorder: {
    Group: ({ children, onReorder, ...props }: { children: React.ReactNode; onReorder: (habits: Habit[]) => void; 'data-habit-card-group'?: string }) => {
      if (props['data-habit-card-group']) reorderHandlers.set(props['data-habit-card-group'], onReorder)
      return React.createElement('div', { 'data-habit-card-group': props['data-habit-card-group'] }, children)
    },
    Item: ({ children, onDragEnd }: { children: React.ReactNode; onDragEnd: () => void }) => React.createElement('div', { 'data-sort-habit': true, onMouseUp: onDragEnd }, children),
  },
}))

import { Dashboard } from './Dashboard'
import { useHabitStore } from '@/stores/habitStore'
import { useTaskStore } from '@/stores/taskStore'
import { useDashboardStore, DEFAULT_LAYOUT } from '@/stores/dashboardStore'
import { useAreaStore } from '@/stores/areaStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { useCharacterStore } from '@/stores/characterStore'
import { useGrowthEventStore } from '@/stores/growthEventStore'
import { zh } from '@/i18n/zh'
import { en } from '@/i18n/en'
import { getTodayString } from '@/utils/time'

let container: HTMLDivElement
let root: Root
const dictionaries = { zh, en }
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  localStorage.clear()
  reorderHandlers.clear()
  useTaskStore.setState({ tasks: [], customTaskGroups: [] })
  useHabitStore.setState({ habits: [], customHabitGroups: [] })
  useAreaStore.setState({ areas: useAreaStore.getInitialState().areas.map(area => ({ ...area })) })
  useDashboardStore.setState({ layout: DEFAULT_LAYOUT.map(card => ({ ...card })), visibleCards: ['habits'] })
  useCharacterStore.setState({ character: { ...useCharacterStore.getInitialState().character } })
  useGrowthEventStore.setState({ events: [] })
  useSettingsStore.getState().setLanguage('zh')
  container = document.createElement('div'); document.body.append(container); root = createRoot(container)
})
afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
  vi.restoreAllMocks()
})
async function render() { await act(async () => root.render(React.createElement(Dashboard))) }
async function click(element: Element) { await act(async () => element.dispatchEvent(new MouseEvent('click', { bubbles: true }))) }
function button(text: string) {
  const node = [...container.querySelectorAll('button')].find(element => element.textContent?.trim() === text)
  expect(node).toBeDefined(); return node!
}
function card(id: string) {
  const node = container.querySelector(`[data-dashboard-card="${id}"]`)
  expect(node).not.toBeNull(); return node!
}
function dialog(id: string) {
  const node = document.body.querySelector(`[data-task-card-filter="${id}"]`)
  expect(node).not.toBeNull(); return node!
}
async function mode(id: string, value: string) { await click(dialog(id).querySelector(`input[name="filter-mode-${id}"][value="${value}"]`)!) }
async function choose(id: string, value: string) { await click(dialog(id).querySelector(`input[name="filter-category-${id}"][value="${value}"]`)!) }
async function close(id: string) { await click(dialog(id).querySelector('button')!) }
function add(title: string, category = 'home', sortOrder = 0, patch: Partial<Habit> = {}) {
  useHabitStore.getState().addHabit({ title, category, difficulty: 2, estimatedMinutes: 0,
    repeatType: 'daily', customIntervalDays: null, weeklyDays: null, weeklyMode: null, weeklyFlexibleCount: null,
    monthlyDays: null, targetCount: 1, startDate: getTodayString(), endDate: null, reminderTime: null, description: '' })
  const created = useHabitStore.getState().habits.at(-1)!
  useHabitStore.getState().updateHabit(created.id, { sortOrder, ...patch })
  return useHabitStore.getState().habits.find(item => item.id === created.id)!
}
function current(id: string) { return useHabitStore.getState().habits.find(item => item.id === id)! }
function row(cardId: string, habitId: string) { return card(cardId).querySelector(`[data-habit-id="${habitId}"]`)! }

it.each(['zh', 'en'] as const)('independently filters multiple habit cards and shows selected category names without a prefix (%s)', async lang => {
  const t = dictionaries[lang]
  useSettingsStore.getState().setLanguage(lang)
  add('Home habit')
  add('Forge habit', 'forge')
  useAreaStore.getState().addArea(null, 'Client calls')
  add('Client habit', 'Client calls')
  add('Hidden habit', 'home', 5, { isHidden: true })
  add('Deleted habit', 'home', 6, { deletedAt: new Date().toISOString() })
  add('Future habit', 'home', 7, { startDate: '2099-12-31' })
  add('Completed home', 'home', 8, { status: 'completed_today' })
  add('Completed forge', 'forge', 9, { status: 'completed_today' })
  const second = useDashboardStore.getState().addHabitCard()
  const before = JSON.stringify(useHabitStore.getState().habits)
  await render()
  expect(card('habits').querySelector('[data-card-title]')!.textContent).toBe(t.dash_habits)
  expect(card(second).querySelector('[data-card-title]')!.textContent).toBe(t.dash_habits)
  await click(container.querySelector('[data-filter-trigger="habits"]')!)
  expect(dialog('habits').getAttribute('data-habit-card-filter')).toBe('habits')
  expect(dialog('habits').closest('[data-dashboard-card]')).toBeNull()
  await mode('habits', 'single'); await choose('habits', 'home'); await close('habits')
  expect(card('habits').textContent).toContain('Home habit')
  expect(card('habits').textContent).toContain('Completed home')
  for (const title of ['Forge habit', 'Client habit', 'Completed forge', 'Hidden habit', 'Deleted habit', 'Future habit']) expect(card('habits').textContent).not.toContain(title)
  await click(container.querySelector(`[data-filter-trigger="${second}"]`)!)
  await mode(second, 'multiple'); await choose(second, 'forge'); await choose(second, 'Client calls'); await close(second)
  const trigger = container.querySelector(`[data-filter-trigger="${second}"]`)!
  expect(trigger.textContent).toBe(t.areaName_forge + ' / Client calls ▾')
  expect(trigger.textContent).not.toContain(t.dash_taskCardCategories)
  expect(trigger.getAttribute('title')).toBe(t.areaName_forge + ' / Client calls')
  expect(card(second).textContent).toContain('Forge habit')
  expect(card(second).textContent).toContain('Completed forge')
  expect(card(second).textContent).toContain('Client habit')
  expect(card(second).textContent).not.toContain('Home habit')
  expect(JSON.stringify(useHabitStore.getState().habits)).toBe(before)
})

it('keeps an empty selection empty and retains legacy categories after area deletion or rename', async () => {
  add('Legacy habit', 'Former category')
  add('Regular habit')
  const second = useDashboardStore.getState().addHabitCard()
  useDashboardStore.getState().setHabitCardFilter(second, { mode: 'single', categories: ['Former category'] })
  await render()
  expect(card(second).textContent).toContain('Legacy habit')
  await click(container.querySelector('[data-filter-trigger="habits"]')!)
  await mode('habits', 'multiple')
  expect(dialog('habits').textContent).toContain(zh.dash_filterEmpty)
  expect(dialog('habits').querySelector('input[value="Former category"]')).not.toBeNull()
  expect(dialog('habits').querySelector('input[value="_milestone"]')).toBeNull()
  expect(dialog('habits').querySelector('input[value="other"]')).not.toBeNull()
  await close('habits')
  expect(card('habits').querySelectorAll('[data-habit-id]')).toHaveLength(0)
  expect(container.querySelector('[data-filter-trigger="habits"]')!.textContent).toBe(zh.dash_filterNone + ' ▾')
  await act(async () => { useDashboardStore.getState().setHabitCardFilter('habits', { mode: 'single', categories: ['home'] }); useAreaStore.getState().updateArea('area-home', { name: 'Renamed household' }) })
  expect(container.querySelector('[data-filter-trigger="habits"]')!.textContent).toBe('Renamed household ▾')
  await act(async () => { useHabitStore.getState().updateHabit(useHabitStore.getState().habits[0].id, { category: 'home' }) })
  expect(card(second).textContent).not.toContain('Legacy habit')
})

it('adds and restores habit card instances without moving existing cards and creates into a single-category card', async () => {
  const original = JSON.stringify(useDashboardStore.getState().layout)
  await render()
  await click(button(zh.dash_editLayout)); await click(button(zh.dash_addCard))
  await click(container.querySelector('[data-add-habit-card]')!)
  const second = useDashboardStore.getState().layout.at(-1)!.id
  await click(button(zh.dash_addCard)); await click(container.querySelector('[data-add-habit-card]')!)
  const third = useDashboardStore.getState().layout.at(-1)!.id
  expect(third).not.toBe(second)
  expect(JSON.stringify(useDashboardStore.getState().layout.slice(0, DEFAULT_LAYOUT.length))).toBe(original)
  await act(async () => { useDashboardStore.getState().setHabitCardFilter(second, { mode: 'single', categories: ['forge'] }); useDashboardStore.getState().removeCard(second) })
  await click(button(zh.dash_addCard))
  const restore = container.querySelector(`[data-restore-card="${second}"]`)!
  expect(restore.textContent).toContain(zh.dash_habits + ' · ' + zh.areaName_forge)
  await click(restore)
  expect(useDashboardStore.getState().layout.find(item => item.id === second)?.habitFilter).toEqual({ mode: 'single', categories: ['forge'] })
  await click(button(zh.dash_doneEditing))
  await click(card(second).querySelector(`[title="${zh.dash_addHabit}"]`)!)
  const input = container.querySelector<HTMLInputElement>(`form input[placeholder="${zh.habitDrawer_namePlaceholder}"]`)!
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, 'New forge habit')
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
  await act(async () => container.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })))
  expect(useHabitStore.getState().habits[0]).toMatchObject({ title: 'New forge habit', category: 'forge' })
})

it('keeps interleaved category slots and non-today, hidden and completed habits unchanged when reordering', async () => {
  const a = add('Work A', 'home', 0)
  const b = add('Life B', 'forge', 1)
  const c = add('Work C', 'home', 2)
  const d = add('Life D', 'forge', 3)
  const hidden = add('Hidden', 'home', 12, { isHidden: true })
  const future = add('Future', 'home', 20, { startDate: '2099-12-31' })
  const done = add('Done', 'home', 32, { status: 'completed_today' })
  useDashboardStore.getState().setHabitCardFilter('habits', { mode: 'single', categories: ['home'] })
  const second = useDashboardStore.getState().addHabitCard()
  await render()
  await act(async () => reorderHandlers.get('habits')!([c, a]))
  await act(async () => card('habits').querySelector('[data-sort-habit]')!.dispatchEvent(new MouseEvent('mouseup', { bubbles: true })))
  const global = useHabitStore.getState().getTodayHabits().filter(habit => habit.status === 'active').sort((left, right) => left.sortOrder - right.sortOrder)
  expect(global.map(habit => habit.id)).toEqual([c.id, b.id, a.id, d.id])
  expect([...card(second).querySelectorAll('[data-habit-status="active"]')].map(node => node.getAttribute('data-habit-id'))).toEqual([c.id, b.id, a.id, d.id])
  expect(current(hidden.id).sortOrder).toBe(12)
  expect(current(future.id).sortOrder).toBe(20)
  expect(current(done.id).sortOrder).toBe(32)
})

it('immediately drops hidden or newly filtered habits during a gesture without writing stale rows', async () => {
  const a = add('Move out', 'home', 2)
  const b = add('Keep home', 'home', 4)
  add('Forge only', 'forge', 6)
  await render()
  await act(async () => reorderHandlers.get('habits')!([b, a]))
  await act(async () => { useHabitStore.getState().hideHabit(a.id); useDashboardStore.getState().setHabitCardFilter('habits', { mode: 'single', categories: ['forge'] }) })
  expect(card('habits').textContent).not.toContain('Move out')
  expect(card('habits').textContent).not.toContain('Keep home')
  expect(card('habits').textContent).toContain('Forge only')
  await act(async () => card('habits').querySelector('[data-sort-habit]')!.dispatchEvent(new MouseEvent('mouseup', { bubbles: true })))
  expect(current(a.id).sortOrder).toBe(2)
  expect(current(b.id).sortOrder).toBe(4)
  expect(useHabitStore.getState().habits).toHaveLength(3)
})

it.each([1, 2])('shares completion history across two cards and undoes only once without changing legacy balances (target %s)', async targetCount => {
  const habit = add('Shared completion', 'home', 0, { targetCount })
  useCharacterStore.setState({ character: { ...useCharacterStore.getState().character, totalXP: 345, currentXP: 45, ore: 27 } })
  const second = useDashboardStore.getState().addHabitCard()
  await render()
  const buttons = [card('habits'), card(second)].map(node => node.querySelector(`[data-habit-complete="${habit.id}"]`)!)
  // Simulate two handlers captured before React updates either card.
  await act(async () => { for (const node of buttons) node.dispatchEvent(new MouseEvent('click', { bubbles: true })) })
  expect(current(habit.id).status).toBe('completed_today')
  expect(current(habit.id).totalCompletions).toBe(1)
  expect(useGrowthEventStore.getState().events.filter(event => event.type === 'habit_complete')).toHaveLength(1)
  expect(useCharacterStore.getState().character).toMatchObject({ totalXP: 345, currentXP: 45, ore: 27 })
  expect(current(habit.id).lastAction!.xp).toBe(0)
  const completedRows = [row('habits', habit.id), row(second, habit.id)]
  await act(async () => { for (const node of completedRows) node.dispatchEvent(new MouseEvent('mouseover', { bubbles: true })) })
  const undoButtons = completedRows.map(node => [...node.querySelectorAll('button')].find(button => button.textContent?.includes(zh.common_undo))!)
  expect(undoButtons.every(Boolean)).toBe(true)
  await act(async () => { for (const node of undoButtons) node.dispatchEvent(new MouseEvent('click', { bubbles: true })) })
  expect(current(habit.id).status).toBe('active')
  expect(current(habit.id).totalCompletions).toBe(0)
  expect(useCharacterStore.getState().character).toMatchObject({ totalXP: 345, currentXP: 45, ore: 27 })
  expect(useGrowthEventStore.getState().events.filter(event => event.type === 'habit_complete')).toHaveLength(0)
})


it('does not start a timer from another card after that habit has just completed', async () => {
  const habit = add('Completed before old timer click', 'home', 0, { timerAccumulated: 60 })
  const second = useDashboardStore.getState().addHabitCard()
  await render()
  const complete = card('habits').querySelector('[data-habit-complete="' + habit.id + '"]')!
  // TimerBadge's toggle button, captured before either card re-renders.
  const timer = [...row(second, habit.id).querySelectorAll('button')].find(node => node.textContent === '1:00')
  expect(timer).not.toBeNull()
  await act(async () => {
    complete.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    timer!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  })
  expect(current(habit.id)).toMatchObject({ status: 'completed_today', timerStartedAt: null, timerAccumulated: 0, actualMinutes: 1 })
})
