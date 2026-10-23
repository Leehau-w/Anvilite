// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

vi.hoisted(() => {
  vi.stubGlobal('window', document.defaultView)
  vi.stubGlobal('localStorage', document.defaultView!.localStorage)
})
import { Heatmap } from './Heatmap'
import { useTaskStore } from '@/stores/taskStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { zh } from '@/i18n/zh'
import { en } from '@/i18n/en'

let root: Root
let container: HTMLDivElement
beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date(2026, 9, 22, 14, 0))
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  localStorage.clear()
  useTaskStore.setState({ tasks: [], lastCategory: 'other' })
  useSettingsStore.getState().setLanguage('zh')
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
})
afterEach(async () => {
  await act(async () => { root.unmount() })
  container.remove()
  vi.restoreAllMocks()
  vi.useRealTimers()
})
async function render() { await act(async () => { root.render(React.createElement(Heatmap)) }) }
async function click(label: string) {
  const button = [...container.querySelectorAll('button')].find(node => node.textContent === label)
  expect(button).toBeDefined()
  await act(async () => { button!.dispatchEvent(new MouseEvent('click', { bubbles: true })) })
}
function complete(minutes: number) {
  const task = useTaskStore.getState().addTask({ title: 'Completed zero-XP task', difficulty: 1 })
  useTaskStore.getState().updateTask(task.id, { actualMinutes: minutes })
  useTaskStore.getState().completeTask(task.id)
  return task.id
}
function day(slot?: number) {
  return container.querySelector<HTMLElement>('[data-trend-date="2026-10-22"]' + (slot === undefined ? '' : '[data-trend-slot="' + slot + '"]'))!
}

it.each(['zh', 'en'] as const)('switches month/week and completed-count/time metrics with accessible local values (%s)', async language => {
  const t = language === 'zh' ? zh : en
  useSettingsStore.getState().setLanguage(language)
  const first = complete(30)
  useTaskStore.getState().hideTask(first)
  complete(15)
  await render()
  expect(container.querySelector('[data-trend-metric]')?.getAttribute('data-trend-metric')).toBe('count')
  expect(container.querySelectorAll('[data-trend-date]')).toHaveLength(31)
  expect(day().getAttribute('data-trend-value')).toBe('2')
  expect(day().title).toContain(t.heatmap_taskCount(2))
  expect(day().getAttribute('aria-label')).toContain(t.heatmap_minutes(45))
  expect(day().title).not.toContain('XP')
  expect(container.querySelector('[data-trend-summary]')).toBeNull()
  await click(t.heatmap_timeMetric)
  expect(day().getAttribute('data-trend-value')).toBe('45')
  expect(container.querySelector('[data-trend-metric]')?.getAttribute('data-trend-metric')).toBe('time')
  await click(t.heatmap_week)
  expect(container.querySelector('[data-trend-range]')?.getAttribute('data-trend-range')).toBe('week')
  expect(container.querySelector('[data-trend-summary]')).toBeNull()
  expect(container.querySelectorAll('[data-trend-date]')).toHaveLength(28)
  expect(day(2).getAttribute('data-trend-value')).toBe('45')
  expect(day(2).title).toContain(t.heatmap_slots[2])
  expect(day(0).getAttribute('data-trend-value')).toBe('0')
  await click(t.heatmap_countMetric)
  expect(day(2).getAttribute('data-trend-value')).toBe('2')
  await click(t.heatmap_month)
  expect(day().getAttribute('data-trend-value')).toBe('2')
  expect(container.querySelectorAll('button[aria-pressed="true"]')).toHaveLength(2)
})

it('updates the mounted trend immediately after time editing, undo and deletion through real actions', async () => {
  const first = complete(5)
  const second = complete(10)
  await render()
  await click(zh.heatmap_timeMetric)
  expect(day().getAttribute('data-trend-value')).toBe('15')
  await act(async () => { useTaskStore.getState().updateTask(first, { actualMinutes: 25 }) })
  expect(day().getAttribute('data-trend-value')).toBe('35')
  await act(async () => { useTaskStore.getState().undoComplete(first) })
  expect(day().getAttribute('data-trend-value')).toBe('10')
  await act(async () => { useTaskStore.getState().deleteTask(second) })
  expect(day().getAttribute('data-trend-value')).toBe('0')
  expect(day().getAttribute('data-trend-count')).toBe('0')
})

it('renders an explicit zero count and zero minutes for an empty period without XP labels', async () => {
  await render()
  expect(day().title).toContain(zh.heatmap_taskCount(0))
  expect(day().title).toContain(zh.heatmap_minutes(0))
  expect(day().getAttribute('data-trend-level')).toBe('0')
  expect(container.textContent).not.toContain('XP')
})
