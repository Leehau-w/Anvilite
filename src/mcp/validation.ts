import type { Task } from '@/types/task'
import type { Habit } from '@/types/habit'
import type { SOP, SOPStep } from '@/types/sop'
import type { JSONContent } from '@tiptap/react'
import { generateId } from '@/utils/id'
import { getTodayString } from '@/utils/time'

export class McpError extends Error {
  readonly code: string
  readonly details?: unknown
  constructor(code: string, message: string, details?: unknown) { super(message); this.code = code; this.details = details }
}
export function invalid(message: string): never { throw new McpError('invalid_arguments', message) }
export function object(value: unknown, label = 'arguments'): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) invalid(label + ' must be an object')
  return value as Record<string, unknown>
}
export function keys(value: Record<string, unknown>, allowed: readonly string[]) {
  if (Object.keys(value).some(key => !allowed.includes(key))) invalid('Unknown or protected field')
}
export function text(value: unknown, label: string, max = 500, empty = false): string {
  if (typeof value !== 'string' || value.length > max || !empty && !value.trim()) invalid(label + ' must be a bounded string')
  return value
}
export function id(value: unknown, label = 'id'): string { return text(value, label, 128) }
export function number(value: unknown, label: string, min = 0, max = 1e9, integer = false): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max || integer && !Number.isInteger(value)) invalid('Invalid ' + label)
  return value
}
export function oneOf<T extends string | number>(value: unknown, choices: readonly T[], label: string): T {
  if (!choices.includes(value as T)) invalid('Invalid ' + label)
  return value as T
}
export function date(value: unknown, label: string): string {
  const result = text(value, label, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(result)) invalid('Invalid ' + label)
  const parsed = new Date(result + 'T00:00:00Z')
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== result) invalid('Invalid ' + label)
  return result
}
function category(value: unknown) { const result = text(value, 'category', 200); if (result.startsWith('_')) invalid('Reserved category'); return result }
function nullableDate(value: unknown, label: string) { return value === null ? null : date(value, label) }
function strings(value: unknown, label: string): string[] {
  if (!Array.isArray(value) || value.length > 32) invalid('Invalid ' + label)
  const result = value.map(item => text(item, label, 100))
  if (new Set(result).size !== result.length) invalid('Duplicate ' + label)
  return result
}
export type TaskPatch = Partial<Pick<Task, 'title' | 'category' | 'description' | 'priority' | 'difficulty' | 'dueDate' | 'backgroundColor' | 'actualMinutes' | 'tags'>>
export function taskFields(input: unknown, create: boolean): TaskPatch & { title?: string } {
  const raw = object(input, create ? 'record' : 'patch')
  keys(raw, ['title','category','description','priority','difficulty','dueDate','backgroundColor','actualMinutes','tags'])
  if (create && raw.title === undefined || !create && !Object.keys(raw).length) invalid('A title or a nonempty patch is required')
  const result: TaskPatch = {}
  if ('title' in raw) result.title = text(raw.title, 'title')
  if ('category' in raw) result.category = category(raw.category)
  if ('description' in raw) result.description = text(raw.description, 'description', 20000, true)
  if ('priority' in raw) result.priority = oneOf(raw.priority, ['urgent','high','medium','low'] as const, 'priority')
  if ('difficulty' in raw) result.difficulty = oneOf(raw.difficulty, [1,2,3,4,5] as const, 'difficulty')
  if ('dueDate' in raw) result.dueDate = nullableDate(raw.dueDate, 'dueDate')
  if ('actualMinutes' in raw) result.actualMinutes = number(raw.actualMinutes, 'actualMinutes')
  if ('backgroundColor' in raw) {
    if (raw.backgroundColor !== null && (typeof raw.backgroundColor !== 'string' || !/^#[\da-f]{6}$/i.test(raw.backgroundColor))) invalid('Invalid backgroundColor')
    result.backgroundColor = raw.backgroundColor as string | null
  }
  if ('tags' in raw) result.tags = strings(raw.tags, 'tags')
  return result
}
export type HabitPatch = Partial<Pick<Habit, 'title' | 'category' | 'description' | 'difficulty' | 'actualMinutes' | 'estimatedMinutes' | 'repeatType' | 'customIntervalDays' | 'weeklyDays' | 'weeklyMode' | 'weeklyFlexibleCount' | 'monthlyDays' | 'targetCount' | 'startDate' | 'endDate' | 'reminderTime'>>
function days(value: unknown, monthly = false): number[] | null {
  if (value === null) return null
  if (!Array.isArray(value) || value.length > (monthly ? 32 : 7)) invalid('Invalid schedule days')
  const result = value.map(day => monthly && day === -1 ? -1 : number(day, 'schedule day', 1, monthly ? 31 : 7, true))
  if (new Set(result).size !== result.length) invalid('Duplicate schedule days')
  return result
}
export function habitFields(input: unknown, current?: Habit): HabitPatch {
  const raw = object(input, current ? 'patch' : 'record')
  keys(raw, ['title','category','description','difficulty','actualMinutes','estimatedMinutes','repeatType','customIntervalDays','weeklyDays','weeklyMode','weeklyFlexibleCount','monthlyDays','targetCount','startDate','endDate','reminderTime'])
  if (!current && raw.title === undefined || current && !Object.keys(raw).length) invalid('A title or a nonempty patch is required')
  const result: HabitPatch = {}
  if ('title' in raw) result.title = text(raw.title, 'title')
  if ('category' in raw) result.category = category(raw.category)
  if ('description' in raw) result.description = text(raw.description, 'description', 20000, true)
  if ('difficulty' in raw) result.difficulty = oneOf(raw.difficulty, [1,2,3,4,5] as const, 'difficulty')
  if ('actualMinutes' in raw) result.actualMinutes = number(raw.actualMinutes, 'actualMinutes')
  if ('estimatedMinutes' in raw) result.estimatedMinutes = number(raw.estimatedMinutes, 'estimatedMinutes')
  if ('repeatType' in raw) result.repeatType = oneOf(raw.repeatType, ['daily','weekdays','weekly','biweekly','monthly','custom','monthly_fixed'] as const, 'repeatType')
  if ('customIntervalDays' in raw) result.customIntervalDays = raw.customIntervalDays === null ? null : number(raw.customIntervalDays, 'customIntervalDays', 1, 3660, true)
  if ('weeklyDays' in raw) result.weeklyDays = days(raw.weeklyDays)
  if ('monthlyDays' in raw) result.monthlyDays = days(raw.monthlyDays, true)
  if ('weeklyMode' in raw) result.weeklyMode = raw.weeklyMode === null ? null : oneOf(raw.weeklyMode, ['strict','flexible'] as const, 'weeklyMode')
  if ('weeklyFlexibleCount' in raw) result.weeklyFlexibleCount = raw.weeklyFlexibleCount === null ? null : number(raw.weeklyFlexibleCount, 'weeklyFlexibleCount', 1, 7, true)
  if ('targetCount' in raw) result.targetCount = number(raw.targetCount, 'targetCount', 1, 1000, true)
  if ('startDate' in raw) result.startDate = date(raw.startDate, 'startDate')
  if ('endDate' in raw) result.endDate = nullableDate(raw.endDate, 'endDate')
  if ('reminderTime' in raw) {
    if (raw.reminderTime !== null && (typeof raw.reminderTime !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(raw.reminderTime))) invalid('Invalid reminderTime')
    result.reminderTime = raw.reminderTime as string | null
  }
  const effective = { ...habitDefaults(), ...current, ...result }
  if (effective.endDate && effective.endDate < effective.startDate) invalid('endDate precedes startDate')
  if (effective.repeatType === 'weekly' && (effective.weeklyMode === 'flexible' ? !effective.weeklyFlexibleCount : !effective.weeklyDays?.length)) invalid('Weekly schedule requires days or a flexible count')
  if (effective.repeatType === 'custom' && !effective.customIntervalDays) invalid('Custom schedule requires interval days')
  if (effective.repeatType === 'monthly_fixed' && !effective.monthlyDays?.length) invalid('Monthly schedule requires days')
  return result
}
export function habitDefaults() {
  return { category: 'other', difficulty: 3 as const, description: '', estimatedMinutes: 0,
    repeatType: 'daily' as const, customIntervalDays: null, weeklyDays: null, weeklyMode: null,
    weeklyFlexibleCount: null, monthlyDays: null, targetCount: 1, startDate: getTodayString(), endDate: null, reminderTime: null }
}

// Rich text is data, never HTML or executable attributes. Keep the editor's supported nodes.
function richText(input: unknown, depth = 0): JSONContent {
  if (depth > 20) invalid('Rich text is too deep')
  const raw = object(input, 'rich text')
  keys(raw, ['type','text','attrs','content','marks'])
  const type = oneOf(raw.type, ['doc','paragraph','text','heading','bulletList','orderedList','listItem','blockquote','codeBlock','horizontalRule','hardBreak','callout','sopLink','table','tableRow','tableCell','tableHeader'] as const, 'rich text node')
  const result: JSONContent = { type }
  if (raw.text !== undefined) result.text = text(raw.text, 'text', 20000, true)
  if (raw.attrs !== undefined) {
    const attrs = object(raw.attrs, 'attributes')
    keys(attrs, ['level','start','language','variant','sopId','sopTitle','colspan','rowspan','colwidth'])
    for (const [key, value] of Object.entries(attrs)) {
      if (['level','start','colspan','rowspan'].includes(key)) number(value, key, 1, key === 'level' ? 6 : 100, true)
      else if (key === 'colwidth') { if (value !== null && (!Array.isArray(value) || value.length > 20 || value.some(v => typeof v !== 'number' || v < 1 || v > 10000))) invalid('Invalid colwidth') }
      else if (value !== null) text(value, key, 500, true)
    }
    result.attrs = JSON.parse(JSON.stringify(attrs))
  }
  if (raw.marks !== undefined) {
    if (!Array.isArray(raw.marks) || raw.marks.length > 12) invalid('Invalid marks')
    result.marks = raw.marks.map(mark => {
      const item = object(mark, 'mark'); keys(item, ['type','attrs'])
      const markType = oneOf(item.type, ['bold','italic','strike','code','underline','link'] as const, 'mark')
      if (markType !== 'link') { if (item.attrs !== undefined) invalid('Unexpected mark attributes'); return { type: markType } }
      const attrs = object(item.attrs, 'link'); keys(attrs, ['href','target','rel','class'])
      const href = text(attrs.href, 'href', 4096)
      if (!/^(https?:|mailto:)/i.test(href)) invalid('Unsupported link protocol')
      return { type: markType, attrs: { href, target: '_blank', rel: 'noopener noreferrer nofollow' } }
    })
  }
  if (raw.content !== undefined) {
    if (!Array.isArray(raw.content) || raw.content.length > 500) invalid('Too many rich-text nodes')
    result.content = raw.content.map(child => richText(child, depth + 1))
  }
  return result
}
function steps(input: unknown, current?: SOPStep[]): SOPStep[] {
  const editing = current !== undefined
  const seen = new Set<string>()
  let count = 0
  function content(input: unknown) {
    if (input === null) return null
    const parsed = richText(input)
    if (parsed.type !== 'doc') invalid('Step rich text must have a doc root')
    return parsed
  }
  function visit(input: unknown, siblings: SOPStep[], depth: number): SOPStep[] {
    if (!Array.isArray(input) || input.length > 100 || depth > 2 && input.length > 0) invalid('Invalid or excessive flow steps')
    const replacements = new Map<string, SOPStep>(), additions: SOPStep[] = []
    for (const item of input) {
      if (++count > 500) invalid('Too many flow steps')
      const raw = object(item, 'step'); keys(raw, ['id','title','content','time','childSteps', ...(!editing ? ['sortOrder'] : [])])
      const stepId = raw.id === undefined ? generateId() : id(raw.id, 'step id')
      const source = raw.id === undefined ? undefined : siblings.find(step => step.id === stepId)
      if (raw.id !== undefined && !source || seen.has(stepId)) invalid('Unknown, moved, or duplicate step id; omit id for a new step')
      seen.add(stepId)
      if (raw.sortOrder !== undefined && (number(raw.sortOrder, 'step sortOrder', 0, 1000000, true), source && raw.sortOrder !== source.sortOrder)) invalid('Step reordering is not supported')
      const next: SOPStep = {
        id: stepId,
        title: raw.title === undefined && source ? source.title : text(raw.title, 'step title'),
        content: 'content' in raw ? content(raw.content) : source?.content == null ? null : JSON.parse(JSON.stringify(source.content)),
        time: 'time' in raw ? raw.time === null ? null : text(raw.time, 'step time', 100) : source?.time ?? null,
        sortOrder: source?.sortOrder ?? Math.max(-1, ...siblings.map(step => step.sortOrder)) + additions.length + 1,
        childSteps: 'childSteps' in raw ? visit(raw.childSteps, source?.childSteps ?? [], depth + 1)
          : source ? JSON.parse(JSON.stringify(source.childSteps)) : [],
      }
      if (source) replacements.set(stepId, next)
      else additions.push(next)
    }
    // A patch cannot silently delete, move, or reorder omitted user content.
    return [...siblings.map(step => replacements.get(step.id) ?? JSON.parse(JSON.stringify(step)) as SOPStep), ...additions]
  }
  return visit(input, current ?? [], 0)
}

export function flowFields(input: unknown, current?: SOP): Partial<Pick<SOP, 'title' | 'folderId' | 'displayStyle' | 'steps'>> {
  const raw = object(input, current ? 'patch' : 'record')
  keys(raw, current ? ['title','displayStyle','steps'] : ['title','folderId','displayStyle','steps'])
  if (!current && (raw.title === undefined || raw.folderId === undefined) || current && !Object.keys(raw).length) invalid('Flow title and folderId or a nonempty patch are required')
  return {
    ...('title' in raw ? { title: text(raw.title, 'title') } : {}),
    ...('folderId' in raw ? { folderId: id(raw.folderId, 'folderId') } : {}),
    ...('displayStyle' in raw ? { displayStyle: oneOf(raw.displayStyle, ['numbered','bullet','timeline'] as const, 'displayStyle') } : {}),
    ...('steps' in raw ? { steps: steps(raw.steps, current?.steps) } : {}),
  }
}
