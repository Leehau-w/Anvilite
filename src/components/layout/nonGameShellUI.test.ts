// @vitest-environment happy-dom
import React, { act, useEffect } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { Task } from '@/types/task'
import type { Habit } from '@/types/habit'

vi.hoisted(() => {
  vi.stubGlobal('window', document.defaultView)
  vi.stubGlobal('localStorage', document.defaultView!.localStorage)
})
vi.mock('framer-motion', async importOriginal => ({
  ...await importOriginal<typeof import('framer-motion')>(),
  AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
}))

import App from '@/App'
import { SettingsModal } from './SettingsModal'
import { StatusBar } from './StatusBar'
import { CharacterMiniCard } from '@/components/dashboard/CharacterMiniCard'
import { Dashboard } from '@/components/dashboard/Dashboard'
import { FeedbackProvider, useFeedback } from '@/components/feedback/FeedbackContext'
import { BadgeNotificationLayer } from '@/components/feedback/BadgeNotification'
import { ToastProvider } from '@/components/feedback/Toast'
import { useSettingsStore } from '@/stores/settingsStore'
import { useTaskStore } from '@/stores/taskStore'
import { useHabitStore } from '@/stores/habitStore'
import { useCharacterStore } from '@/stores/characterStore'
import { useBadgeStore } from '@/stores/badgeStore'
import { useGrowthEventStore } from '@/stores/growthEventStore'
import { useDashboardStore, DEFAULT_LAYOUT } from '@/stores/dashboardStore'
import { THEMES } from '@/types/settings'
import { getTodayString } from '@/utils/time'
import { zh } from '@/i18n/zh'
import { en } from '@/i18n/en'

let container: HTMLDivElement
let root: Root
const dictionaries = { zh, en }
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-10-23T12:00:00'))
  localStorage.clear()
  useTaskStore.setState({ tasks: [], customTaskGroups: [] })
  useHabitStore.setState({ habits: [], customHabitGroups: [] })
  useCharacterStore.setState({ character: { ...useCharacterStore.getInitialState().character,
    name: 'Synthetic person', level: 45, totalXP: 87654, currentXP: 321, ore: 0,
    titlePreset: 'custom', customTitles: Array(8).fill('Old reward title'), prestigeLevel: 3 } })
  useBadgeStore.setState({ earnedIds: { 'first-task': '2026-01-01T12:00:00Z' }, notifyQueue: ['first-task'] })
  useGrowthEventStore.setState({ events: [] })
  useDashboardStore.setState({ layout: DEFAULT_LAYOUT.map(card => ({ ...card })), visibleCards: ['character', 'stats'] })
  useSettingsStore.setState({ settings: { ...useSettingsStore.getInitialState().settings,
    language: 'zh', theme: 'dawn-white', unlockedThemes: ['dawn-white'] } })
  container = document.createElement('div'); document.body.append(container); root = createRoot(container)
})
afterEach(async () => {
  await act(async () => root.unmount())
  container.remove(); vi.useRealTimers(); vi.restoreAllMocks()
})
async function render(node: React.ReactNode) { await act(async () => { root.render(node) }) }
async function click(node: Element) { await act(async () => { node.dispatchEvent(new MouseEvent('click', { bubbles: true })) }) }
function textButton(text: string) {
  const result = [...container.querySelectorAll('button')].find(button => button.textContent?.trim() === text)
  expect(result, text).toBeDefined(); return result!
}
function noGameText(node: Element = container) {
  expect(node.textContent).not.toMatch(/Lv\.|\bXP\b|⛏|Old reward title|Prestige|重铸/)
}
function addTask(title: string, patch: Partial<Task> = {}) {
  const task = useTaskStore.getState().addTask({ title })
  useTaskStore.getState().updateTask(task.id, patch)
  return useTaskStore.getState().tasks.find(item => item.id === task.id)!
}
function addHabit(title: string, patch: Partial<Habit> = {}) {
  useHabitStore.getState().addHabit({ title, category: 'home', difficulty: 2, estimatedMinutes: 0,
    repeatType: 'daily', customIntervalDays: null, weeklyDays: null, weeklyMode: null, weeklyFlexibleCount: null,
    monthlyDays: null, targetCount: 1, startDate: getTodayString(), endDate: null, reminderTime: null, description: '' })
  const habit = useHabitStore.getState().habits.at(-1)!
  useHabitStore.getState().updateHabit(habit.id, patch)
  return habit.id
}

it.each(['zh', 'en'] as const)('selects all eight themes directly without buying, including restored locked themes (%s)', async lang => {
  const t = dictionaries[lang]
  useSettingsStore.getState().setLanguage(lang)
  const character = structuredClone(useCharacterStore.getState().character)
  const badgeState = structuredClone({ earnedIds: useBadgeStore.getState().earnedIds, notifyQueue: useBadgeStore.getState().notifyQueue })
  const layout = structuredClone(useDashboardStore.getState().layout)
  await render(React.createElement(ToastProvider, null, React.createElement(SettingsModal, { open: true, onClose: vi.fn() })))
  expect(container.querySelectorAll('[data-theme-option]')).toHaveLength(8)
  expect(container.textContent).toContain(t.account_section)
  expect(container.textContent).toContain(t.data_syncTitle)
  expect(container.querySelector('input[placeholder="' + t.settings_charName + '"]')).not.toBeNull()
  noGameText()
  for (const theme of THEMES) {
    const button = container.querySelector('[data-theme-option="' + theme.id + '"]')!
    await click(button)
    expect(button.getAttribute('aria-pressed')).toBe('true')
    expect(useSettingsStore.getState().settings.theme).toBe(theme.id)
    expect(document.documentElement.getAttribute('data-theme')).toBe(theme.id === 'dawn-white' ? '' : theme.id)
    expect(container.textContent).not.toContain(t.settings_confirmBuy(500))
  }
  expect(useCharacterStore.getState().character).toEqual(character)
  expect(useBadgeStore.getState()).toMatchObject(badgeState)
  expect(useDashboardStore.getState().layout).toEqual(layout)
  const saved = localStorage.getItem('anvilite-settings')!
  await act(async () => {
    useSettingsStore.setState({ settings: { ...useSettingsStore.getState().settings, theme: 'dawn-white' } })
    localStorage.setItem('anvilite-settings', saved)
    await useSettingsStore.persist.rehydrate()
  })
  expect(useSettingsStore.getState().settings.theme).toBe('jade-forest')
  expect(container.querySelector('[data-theme-option="jade-forest"]')!.getAttribute('aria-pressed')).toBe('true')
  expect(useCharacterStore.getState().character).toEqual(character)
})

it.each(['zh', 'en'] as const)('shows real daily completion and task minutes without counting habit lifetime minutes (%s)', async lang => {
  const t = dictionaries[lang]
  useSettingsStore.getState().setLanguage(lang)
  const completedAt = new Date().toISOString()
  addTask('Today visible', { status: 'done', completedAt, actualMinutes: 15, xpReward: 120 })
  addTask('Today hidden', { status: 'done', completedAt, actualMinutes: 20, isHidden: true })
  addTask('Deleted', { status: 'done', completedAt, actualMinutes: 999, deletedAt: completedAt })
  addTask('Undone old completion', { status: 'todo', completedAt, actualMinutes: 888 })
  addTask('Invalid completion date', { status: 'done', completedAt: 'invalid', actualMinutes: 777 })
  addTask('Yesterday', { status: 'done', completedAt: '2026-10-22T12:00:00', actualMinutes: 666 })
  addTask('Waiting', { status: 'waiting' })
  addHabit('Daily habit', { status: 'completed_today', lastCompletedAt: completedAt, actualMinutes: 9999 })
  addHabit('Deleted habit', { status: 'completed_today', lastCompletedAt: completedAt, deletedAt: completedAt })
  const before = JSON.stringify({ tasks: useTaskStore.getState().tasks, habits: useHabitStore.getState().habits, character: useCharacterStore.getState().character })
  await render(React.createElement(React.Fragment, null, React.createElement(Dashboard), React.createElement(StatusBar)))
  const stats = container.querySelector('[data-dashboard-card="stats"]')!
  expect(stats.textContent).toContain('3' + t.dash_statDone)
  expect(stats.textContent).toContain(t.heatmap_minutes(35) + t.stats_todayMinutes)
  const bar = container.querySelector('[data-status-bar]')!
  expect(bar.textContent).toContain(t.dash_statDone + ' 3')
  expect(bar.textContent).toContain(t.milestone_statTime + ' ' + t.milestone_timeValue(0, 35))
  expect(bar.textContent).not.toContain(t.stats_todayMinutes)
  expect(container.querySelector('[data-personal-overview]')!.textContent).toContain(t.overview_pending)
  noGameText()
  expect(JSON.stringify({ tasks: useTaskStore.getState().tasks, habits: useHabitStore.getState().habits, character: useCharacterStore.getState().character })).toBe(before)
})

it.each(['zh', 'en'] as const)('formats the status bar time compactly without changing its daily data (%s)', async lang => {
  const t = dictionaries[lang]
  useSettingsStore.getState().setLanguage(lang)
  await render(React.createElement(StatusBar))
  const bar = container.querySelector('[data-status-bar]')!
  expect(bar.textContent).toContain(t.dash_statDone + ' 0')
  expect(bar.textContent).toContain(t.milestone_statTime + ' ' + t.milestone_timeValue(0, 0))
  const task = addTask('Completed today', { status: 'done', completedAt: new Date().toISOString() })
  for (const [minutes, hours, rest] of [[59, 0, 59], [60, 0, 60], [61, 1, 1], [61.2, 1, 1.2], [120, 2, 0]]) {
    await act(async () => useTaskStore.getState().updateTask(task.id, { actualMinutes: minutes }))
    expect(bar.textContent).toContain(t.milestone_statTime + ' ' + t.milestone_timeValue(hours, rest))
    expect(bar.textContent).toContain(t.dash_statDone + ' 1')
    expect(bar.textContent).not.toContain(t.stats_todayMinutes)
  }
  await act(async () => {
    useTaskStore.getState().updateTask(task.id, { actualMinutes: 0.1 })
    addTask('Fractional second', { status: 'done', completedAt: new Date().toISOString(), actualMinutes: 0.2 })
  })
  expect(bar.textContent).toContain(t.milestone_timeValue(0, 0.3))
  expect(bar.textContent).not.toContain('0.30000000000000004')
})

it('keeps the original character card geometry, visibility and independent filters through hide, restore and hydration', async () => {
  const store = useDashboardStore.getState()
  store.updateCard('character', { col: 7, row: 16, colSpan: 9, rowSpan: 4 })
  const dynamic = store.addTaskCard()
  useDashboardStore.getState().setTaskCardFilter(dynamic, { mode: 'single', categories: ['Saved custom category'] })
  useDashboardStore.getState().removeCard(dynamic)
  const originalLayout = structuredClone(useDashboardStore.getState().layout)
  const saved = localStorage.getItem('anvilite-dashboard')!
  await render(React.createElement(Dashboard))
  expect(container.querySelector('[data-dashboard-card="character"]')).not.toBeNull()
  await act(async () => { useDashboardStore.getState().removeCard('character') })
  expect(container.querySelector('[data-dashboard-card="character"]')).toBeNull()
  await click(textButton(zh.dash_editLayout)); await click(textButton(zh.dash_addCard))
  await click(container.querySelector('[data-restore-card="character"]')!)
  expect(container.querySelector('[data-personal-overview]')).not.toBeNull()
  expect(useDashboardStore.getState().layout).toEqual(originalLayout)
  expect(useDashboardStore.getState().visibleCards).not.toContain(dynamic)
  await act(async () => {
    useDashboardStore.setState({ layout: DEFAULT_LAYOUT, visibleCards: [] })
    localStorage.setItem('anvilite-dashboard', saved)
    await useDashboardStore.persist.rehydrate()
  })
  expect(useDashboardStore.getState().layout).toEqual(originalLayout)
  expect(useDashboardStore.getState().visibleCards).not.toContain(dynamic)
  expect(container.querySelector('[data-personal-overview]')).not.toBeNull()
})

function LegacyFeedbackCaller() {
  const feedback = useFeedback()
  useEffect(() => {
    feedback.triggerFeedback({ xp: 9000, ore: 800, leveledUp: true, oldLevel: 1, newLevel: 20, oldStreakDays: 0, newStreakDays: 30, prestigeUnlocked: true })
    feedback.showPrestigeModal()
  }, [feedback])
  return React.createElement('span', null, 'Actual work remains visible')
}
it('keeps reward feedback and historical badge notifications inert without modifying stored legacy data', async () => {
  const character = structuredClone(useCharacterStore.getState().character)
  const badges = structuredClone({ earnedIds: useBadgeStore.getState().earnedIds, notifyQueue: useBadgeStore.getState().notifyQueue })
  await render(React.createElement(FeedbackProvider, null, React.createElement(LegacyFeedbackCaller), React.createElement(BadgeNotificationLayer)))
  expect(container.textContent).toBe('Actual work remains visible')
  expect(useCharacterStore.getState().character).toEqual(character)
  expect(useBadgeStore.getState()).toMatchObject(badges)
  expect(useGrowthEventStore.getState().events).toEqual([])
})

it.each(['zh', 'en'] as const)('opens milestones with the original star icon and keeps status controls usable (%s)', async lang => {
  const t = dictionaries[lang]
  useSettingsStore.getState().setLanguage(lang)
  await render(React.createElement(App))
  expect(container.querySelector('[data-personal-overview]')).not.toBeNull()
  expect(container.querySelector('nav button[title="' + t.sidebar_milestone + '"] polygon')).not.toBeNull()
  await click(container.querySelector('nav button[title="' + t.sidebar_milestone + '"]')!)
  expect(container.querySelector('[data-milestone-page]')!.textContent).toContain(t.milestone_pageTitle)
  noGameText()
  expect(useCharacterStore.getState().character.totalXP).toBe(87654)
  expect(useBadgeStore.getState().notifyQueue).toEqual(['first-task'])
  expect(useGrowthEventStore.getState().events).toEqual([])
})

it('retains the personal status selector without displaying legacy progression', async () => {
  await render(React.createElement(CharacterMiniCard))
  await click(container.querySelector('button[title="' + zh.charCard_clickToChangeStatus + '"]')!)
  expect(useCharacterStore.getState().character.globalStatus).toBe('charging')
  expect(container.textContent).toContain(zh.charCard_status_charging)
  expect(useCharacterStore.getState().character.totalXP).toBe(87654)
  noGameText()
})
