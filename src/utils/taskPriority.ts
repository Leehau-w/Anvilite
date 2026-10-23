import type { TaskPriority } from '@/types/task'

export type TaskColorPresetId = 'red' | 'orange' | 'sand' | 'blue' | 'purple' | 'gray' | 'brown'
export interface TaskColorPreset {
  id: TaskColorPresetId
  value: string
  labelKey: 'task_colorRed' | 'task_colorOrange' | 'task_colorSand' | 'task_colorBlue' | 'task_colorPurple' | 'task_colorGray' | 'task_colorBrown'
  tone: string
  legacyValues: readonly string[]
}

// Canonical hex values remain compatible with existing backups. Theme variables
// determine their appearance without rewriting the stored task color.
export const TASK_COLOR_PRESETS: readonly TaskColorPreset[] = [
  { id: 'red', value: '#b97878', labelKey: 'task_colorRed', tone: 'var(--task-tone-red)', legacyValues: ['#ef4444'] },
  { id: 'orange', value: '#b78d70', labelKey: 'task_colorOrange', tone: 'var(--task-tone-orange)', legacyValues: ['#f97316'] },
  { id: 'sand', value: '#b1a185', labelKey: 'task_colorSand', tone: 'var(--task-tone-sand)', legacyValues: ['#eab308'] },
  { id: 'blue', value: '#8599ab', labelKey: 'task_colorBlue', tone: 'var(--task-tone-blue)', legacyValues: ['#3b82f6'] },
  { id: 'purple', value: '#9c8fa7', labelKey: 'task_colorPurple', tone: 'var(--task-tone-purple)', legacyValues: ['#a855f7'] },
  { id: 'gray', value: '#a49b92', labelKey: 'task_colorGray', tone: 'var(--task-tone-gray)', legacyValues: ['#64748b', '#22c55e'] },
  { id: 'brown', value: '#9e8377', labelKey: 'task_colorBrown', tone: 'var(--task-tone-brown)', legacyValues: [] },
]

export function getTaskColorPreset(color?: string | null): TaskColorPreset | undefined {
  if (typeof color !== 'string') return undefined
  const normalized = color.toLowerCase()
  return TASK_COLOR_PRESETS.find(preset => preset.value === normalized || preset.legacyValues.includes(normalized))
}

export const TASK_PRIORITY_COLORS: Record<TaskPriority, string> = {
  urgent: 'var(--task-priority-urgent)',
  high: 'var(--task-priority-high)',
  medium: 'var(--task-priority-medium)',
  low: 'var(--task-priority-low)',
}
const PRIORITY_TONES: Record<TaskPriority, string> = {
  urgent: 'var(--task-tone-red)', high: 'var(--task-tone-orange)',
  medium: 'var(--task-tone-blue)', low: 'var(--task-tone-gray)',
}

export function taskPriorityBackground(priority: TaskPriority, completed = false, backgroundColor?: string | null): string {
  const color = getTaskColorPreset(backgroundColor)?.tone ?? (
    typeof backgroundColor === 'string' && /^#[0-9a-f]{6}$/i.test(backgroundColor) ? backgroundColor : PRIORITY_TONES[priority])
  return 'color-mix(in srgb, ' + color + ' var(--task-tint-' + (completed ? 'completed-strength' : 'strength') + '), var(--task-tint-base))'
}
