// @vitest-environment happy-dom
import React, { act, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { Task } from '@/types/task'

vi.hoisted(() => {
  vi.stubGlobal('window', document.defaultView)
  vi.stubGlobal('localStorage', document.defaultView!.localStorage)
})
vi.mock('framer-motion', async importOriginal => ({
  ...await importOriginal<typeof import('framer-motion')>(),
  AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
}))

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
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  localStorage.clear()
  useTaskStore.setState({ tasks: [], lastCategory: 'home', customTaskGroups: [] })
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
})
async function render(node: React.ReactNode) { await act(async () => { root.render(node) }) }
async function click(element: Element) {
  await act(async () => { element.dispatchEvent(new MouseEvent('click', { bubbles: true })) })
}
function textButton(text: string) {
  const result = [...container.querySelectorAll('button')].find(element => element.textContent === text)
  expect(result).toBeDefined()
  return result!
}
function labeledButton(label: string) {
  const result = [...container.querySelectorAll('button')].find(element => element.getAttribute('aria-label') === label)
  expect(result).toBeDefined()
  return result!
}
async function setInput(input: HTMLInputElement, value: string) {
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value)
    input.dispatchEvent(new Event('input', { bubbles: true }))
    input.dispatchEvent(new Event('change', { bubbles: true }))
  })
}
async function save() {
  await act(async () => { container.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })) })
}
function Harness({ task }: { task?: Task }) {
  const [open, setOpen] = useState(true)
  return React.createElement(React.Fragment, null,
    React.createElement('button', { type: 'button', 'data-reopen-task': true, onClick: () => setOpen(true) }, 'Reopen'),
    React.createElement(TaskDrawer, { open, editTask: task, initialCategory: 'forge', onClose: () => setOpen(false) }))
}
function seed(status: 'waiting' | 'done', backgroundColor?: string) {
  const task = useTaskStore.getState().addTask({ title: 'Preserve original work', category: 'home', priority: 'urgent' })
  useTaskStore.getState().addSubTask(task.id, 'Existing nested work')
  useTaskStore.getState().updateTask(task.id, {
    status, backgroundColor, actualMinutes: 37, timerAccumulated: 125,
    completedAt: status === 'done' ? '2026-10-21T10:00:00Z' : null,
    completionId: status === 'done' ? 'previous-completion' : undefined,
    xpReward: status === 'done' ? 72 : 0, tags: ['client'],
  })
  return useTaskStore.getState().tasks.find(item => item.id === task.id)!
}

it.each(['zh', 'en'] as const)('keeps manual color when priority changes and saves waiting work unchanged (%s)', async lang => {
  const t = dictionaries[lang]
  useSettingsStore.getState().setLanguage(lang)
  const task = seed('waiting')
  const characterBefore = JSON.stringify(useCharacterStore.getState().character)
  const eventsBefore = JSON.stringify(useGrowthEventStore.getState().events)
  await render(React.createElement(Harness, { task }))
  expect(textButton(t.task_colorAuto).getAttribute('aria-pressed')).toBe('true')
  await click(labeledButton(t.task_colorPurple))
  expect(useTaskStore.getState().tasks[0].backgroundColor).toBeUndefined()
  await click(textButton(t.taskPriority_low))
  expect(labeledButton(t.task_colorPurple).getAttribute('aria-pressed')).toBe('true')
  expect(container.textContent).toContain(t.task_colorManualHint)
  expect(container.querySelector('[data-task-background-preview]')).toBeNull()
  expect(container.textContent).not.toContain(t.task_colorHint)
  await save()
  const saved = useTaskStore.getState().tasks[0]
  expect(saved).toMatchObject({ backgroundColor: TASK_COLOR_PRESETS.find(color => color.labelKey === 'task_colorPurple')!.value, priority: 'low' })
  for (const field of ['category', 'status', 'subTasks', 'timerStartedAt', 'timerAccumulated', 'actualMinutes', 'xpReward', 'completionId', 'completedAt', 'tags'] as const) {
    expect(saved[field]).toEqual(task[field])
  }
  expect(JSON.stringify(useCharacterStore.getState().character)).toBe(characterBefore)
  expect(JSON.stringify(useGrowthEventStore.getState().events)).toBe(eventsBefore)
})

it.each(['zh', 'en'] as const)('cancels a color draft without writing and resets it when reopened (%s)', async lang => {
  const t = dictionaries[lang]
  useSettingsStore.getState().setLanguage(lang)
  const task = seed('waiting', '#123456')
  const before = JSON.stringify(useTaskStore.getState().tasks)
  await render(React.createElement(Harness, { task }))
  await click(labeledButton(t.task_colorRed))
  expect(labeledButton(t.task_colorRed).getAttribute('aria-pressed')).toBe('true')
  await click(textButton(t.taskDrawer_cancel))
  expect(JSON.stringify(useTaskStore.getState().tasks)).toBe(before)
  await click(container.querySelector('[data-reopen-task]')!)
  expect(container.querySelector<HTMLInputElement>('input[type="color"]')!.value).toBe('#123456')
  expect(labeledButton(t.task_colorRed).getAttribute('aria-pressed')).toBe('false')
})

it.each(['zh', 'en'] as const)('restores automatic color on a completed task without changing rewards or timing (%s)', async lang => {
  const t = dictionaries[lang]
  useSettingsStore.getState().setLanguage(lang)
  const task = seed('done', TASK_COLOR_PRESETS.find(color => color.labelKey === 'task_colorGray')!.value)
  const characterBefore = JSON.stringify(useCharacterStore.getState().character)
  await render(React.createElement(Harness, { task }))
  expect(labeledButton(t.task_colorGray).getAttribute('aria-pressed')).toBe('true')
  expect(container.querySelector<HTMLInputElement>('input[type="color"]')!.value).toBe(TASK_COLOR_PRESETS.find(color => color.labelKey === 'task_colorGray')!.value)
  expect(container.querySelector(`button[aria-label="${t.task_colorGreen}"]`)).toBeNull()
  await click(textButton(t.task_colorAuto))
  await click(textButton(t.taskPriority_high))
  expect(textButton(t.task_colorAuto).getAttribute('aria-pressed')).toBe('true')
  expect(container.textContent).toContain(t.task_priorityColorHint)
  await save()
  const saved = useTaskStore.getState().tasks[0]
  expect(saved).toMatchObject({ backgroundColor: null, priority: 'high', status: 'done', xpReward: 72, completionId: 'previous-completion', actualMinutes: 37, timerAccumulated: 125 })
  expect(saved.subTasks).toEqual(task.subTasks)
  expect(saved.completedAt).toBe(task.completedAt)
  expect(JSON.stringify(useCharacterStore.getState().character)).toBe(characterBefore)
  expect(useGrowthEventStore.getState().events).toEqual([])
})

it.each(['zh', 'en'] as const)('creates a task with a custom six-digit color and the selected category (%s)', async lang => {
  const t = dictionaries[lang]
  useSettingsStore.getState().setLanguage(lang)
  await render(React.createElement(Harness))
  await setInput(container.querySelector<HTMLInputElement>(`input[placeholder="${t.taskDrawer_titlePlaceholder}"]`)!, 'Custom colored task')
  await setInput(container.querySelector<HTMLInputElement>('input[type="color"]')!, '#1a2b3c')
  expect(textButton(t.task_colorAuto).getAttribute('aria-pressed')).toBe('false')
  expect(useTaskStore.getState().tasks).toHaveLength(0)
  await save()
  expect(useTaskStore.getState().tasks).toHaveLength(1)
  expect(useTaskStore.getState().tasks[0]).toMatchObject({ title: 'Custom colored task', category: 'forge', backgroundColor: '#1a2b3c', status: 'todo', xpReward: 0 })
})


it.each(['zh', 'en'] as const)('creates with the selected preset canonical value without changing priority (%s)', async lang => {
  const t = dictionaries[lang]
  useSettingsStore.getState().setLanguage(lang)
  await render(React.createElement(Harness))
  await setInput(container.querySelector<HTMLInputElement>('input[placeholder="' + t.taskDrawer_titlePlaceholder + '"]')!, 'Preset task')
  const preset = TASK_COLOR_PRESETS.find(color => color.labelKey === 'task_colorBrown')!
  await click(labeledButton(t[preset.labelKey]))
  expect(labeledButton(t[preset.labelKey]).getAttribute('aria-pressed')).toBe('true')
  expect(container.querySelector<HTMLInputElement>('input[type="color"]')!.value).toBe(preset.value)
  await save()
  expect(useTaskStore.getState().tasks[0]).toMatchObject({ title: 'Preset task', backgroundColor: preset.value, priority: 'medium', status: 'todo', xpReward: 0 })
})


it('shows the replacement gray for legacy green without rewriting its stored hex on an unrelated edit', async () => {
  const task = seed('waiting', '#22c55e')
  const gray = TASK_COLOR_PRESETS.find(color => color.labelKey === 'task_colorGray')!
  await render(React.createElement(Harness, { task }))
  expect(labeledButton(zh.task_colorGray).getAttribute('aria-pressed')).toBe('true')
  expect(container.querySelector<HTMLInputElement>('input[type="color"]')!.value).toBe(gray.value)
  await setInput(container.querySelector<HTMLInputElement>('input[placeholder="' + zh.taskDrawer_titlePlaceholder + '"]')!, 'Only edit the title')
  await save()
  expect(useTaskStore.getState().tasks[0]).toMatchObject({ title: 'Only edit the title', backgroundColor: '#22c55e', priority: task.priority, status: 'waiting', xpReward: task.xpReward, actualMinutes: task.actualMinutes })
})
