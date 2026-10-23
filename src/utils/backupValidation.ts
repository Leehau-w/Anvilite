import { getSystemSOPs, SYSTEM_FOLDER_ID } from '@/data/systemSOPs'

type Obj = Record<string, unknown>
const object = (v: unknown): v is Obj => !!v && typeof v === 'object' && !Array.isArray(v)
const string = (v: unknown) => typeof v === 'string'
const number = (v: unknown) => typeof v === 'number' && Number.isFinite(v)
const strings = (v: unknown) => Array.isArray(v) && v.every(string)
const has = (v: Obj, keys: string[], check: (x: unknown) => boolean) => keys.every(k => check(v[k]))
const optional = (v: Obj, keys: string[], check: (x: unknown) => boolean) => keys.every(k => v[k] === undefined || check(v[k]))
const nonnegative = (v: unknown) => number(v) && (v as number) >= 0
const count = (v: unknown) => Number.isSafeInteger(v) && (v as number) >= 0
const positiveCount = (v: unknown) => count(v) && (v as number) > 0
const timestamp = (v: unknown) => string(v) && Number.isFinite(new Date(v as string).getTime())
const nullableTimestamp = (v: unknown) => v === null || timestamp(v)
const dateKey = (v: unknown) => {
  if (!string(v) || !/^\d{4}-\d{2}-\d{2}$/.test(v as string)) return false
  const date = new Date(`${v}T00:00:00.000Z`)
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === v
}
const nullableDate = (v: unknown) => v === null || dateKey(v)
const days = (v: unknown, monthly = false) => Array.isArray(v) && v.every(d =>
  Number.isInteger(d) && (monthly && d === -1 || d >= 1 && d <= (monthly ? 31 : 7))) &&
  new Set(v).size === v.length

function taskCardFilter(v: unknown): boolean {
  return object(v) && ['all', 'single', 'multiple'].includes(v.mode as string) &&
    strings(v.categories) && (v.mode !== 'single' || (v.categories as string[]).length <= 1)
}

function habitSchedule(h: Obj): boolean {
  if (!dateKey(h.startDate) || !optional(h, ['endDate'], nullableDate) ||
      !optional(h, ['lastMissCheckDate'], dateKey)) return false
  if (typeof h.endDate === 'string' && h.endDate < (h.startDate as string)) return false
  if (!optional(h, ['lastCompletedAt', 'lastDueAt', 'timerStartedAt', 'deletedAt'], nullableTimestamp) ||
      !optional(h, ['cycleKey', 'description'], string) ||
      !optional(h, ['isHidden'], v => typeof v === 'boolean') ||
      !optional(h, ['estimatedMinutes', 'actualMinutes', 'timerAccumulated'], nonnegative) ||
      !optional(h, ['targetCount'], positiveCount) ||
      !optional(h, ['currentCycleCount', 'consecutiveCount', 'totalCompletions', 'weeklyCompletionCount', 'toleranceNextAt'], count) ||
      !optional(h, ['toleranceCharges'], v => v === 0 || v === 1) ||
      !optional(h, ['customIntervalDays'], v => v === null || positiveCount(v)) ||
      !optional(h, ['weeklyFlexibleCount'], v => v === null || positiveCount(v) && (v as number) <= 7) ||
      !optional(h, ['weeklyMode'], v => v === null || v === 'strict' || v === 'flexible') ||
      !optional(h, ['weeklyDays'], v => v === null || days(v)) ||
      !optional(h, ['monthlyDays'], v => v === null || days(v, true)) ||
      !optional(h, ['reminderTime'], v => v === null || string(v) && /^([01]\d|2[0-3]):[0-5]\d$/.test(v as string))) return false
  if (h.repeatType === 'weekly' && h.weeklyMode === 'strict' && !days(h.weeklyDays)) return false
  if (h.repeatType === 'weekly' && h.weeklyMode === 'flexible' && !positiveCount(h.weeklyFlexibleCount)) return false
  if (h.repeatType === 'custom' && !positiveCount(h.customIntervalDays)) return false
  if (h.repeatType === 'monthly_fixed' && !days(h.monthlyDays, true)) return false
  return true
}
const snapshotKeys = ['consecutiveCount', 'totalCompletions', 'toleranceCharges', 'toleranceNextAt',
  'weeklyCompletionCount', 'currentCycleCount', 'actualMinutes', 'lastCompletedAt', 'lastDueAt', 'subHabits']

function tree(v: unknown, childKey: string, depth = 0): boolean {
  return depth <= 3 && Array.isArray(v) && v.every(n => object(n) && has(n, ['id', 'title'], string) &&
    (childKey === 'childSteps' || typeof n.completed === 'boolean') &&
    number(n.sortOrder) && tree(n[childKey], childKey, depth + 1))
}

function richText(v: unknown, depth = 0): boolean {
  if (v === null || v === undefined) return true
  if (depth > 50 || !object(v) || !string(v.type)) return false
  return v.content === undefined || (Array.isArray(v.content) && v.content.every(c => richText(c, depth + 1)))
}

function steps(v: unknown, depth = 0): boolean {
  return depth <= 3 && Array.isArray(v) && v.every(s => object(s) && has(s, ['id', 'title'], string) &&
    number(s.sortOrder) && richText(s.content) && steps(s.childSteps, depth + 1))
}

export function validateBackupRecords(data: Obj): string | null {
  const records = (slice: string, field: string, check: (v: Obj) => boolean) => {
    const value = data[slice]
    if (!object(value) || !Array.isArray(value[field])) return false
    const ids = new Set<string>()
    return (value[field] as unknown[]).every(v => {
      if (!object(v) || !string(v.id) || ids.has(v.id as string) || !check(v)) return false
      ids.add(v.id as string)
      return true
    })
  }
  for (const [slice, field, ids] of [['tasks', 'customTaskGroups', 'taskIds'], ['habits', 'customHabitGroups', 'habitIds']]) {
    const value = data[slice] as Obj
    if (value[field] !== undefined && !records(slice, field, g => has(g, ['name', 'createdAt'], string) &&
      g.type === 'custom' && strings(g[ids]))) return `invalid_${slice}`
  }
  if (!records('tasks', 'tasks', t => has(t, ['title', 'category', 'createdAt', 'updatedAt'], string) &&
    ['todo', 'doing', 'waiting', 'done'].includes(t.status as string) && [1, 2, 3, 4, 5].includes(t.difficulty as number) &&
    ['urgent', 'high', 'medium', 'low'].includes(t.priority as string) &&
    optional(t, ['backgroundColor'], value => value === null || typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value)) &&
    optional(t, ['actualMinutes', 'xpReward', 'timerAccumulated', 'sortOrder'], number) &&
    (t.status !== 'waiting' || (t.timerStartedAt == null &&
      optional(t, ['actualMinutes', 'timerAccumulated'], nonnegative))) &&
    (t.subTasks === undefined || tree(t.subTasks, 'subTasks')) && (t.tags === undefined || strings(t.tags)))) return 'invalid_tasks'
  if (!records('habits', 'habits', h => has(h, ['title', 'category', 'startDate', 'createdAt', 'updatedAt'], string) &&
    ['active', 'completed_today', 'paused', 'archived', 'mastered'].includes(h.status as string) &&
    ['daily', 'weekdays', 'weekly', 'biweekly', 'monthly', 'custom', 'monthly_fixed'].includes(h.repeatType as string) &&
    [1, 2, 3, 4, 5].includes(h.difficulty as number) && habitSchedule(h) &&
    has(h, ['createdAt', 'updatedAt'], timestamp) &&
    (h.subHabits === undefined || tree(h.subHabits, 'subHabits')) &&
    (h.lastAction == null || (object(h.lastAction) && has(h.lastAction, ['id', 'at'], string) &&
      ['skip', 'complete'].includes(h.lastAction.kind as string) && nonnegative(h.lastAction.xp) && timestamp(h.lastAction.at) &&
      object(h.lastAction.before) && tree(h.lastAction.before.subHabits, 'subHabits') &&
      Object.keys(h.lastAction.before).every(k => snapshotKeys.includes(k)) &&
      has(h.lastAction.before, ['lastCompletedAt', 'lastDueAt'], nullableTimestamp) &&
      has(h.lastAction.before, ['consecutiveCount', 'totalCompletions', 'toleranceNextAt',
        'weeklyCompletionCount', 'currentCycleCount'], count) &&
      (h.lastAction.before.toleranceCharges === 0 || h.lastAction.before.toleranceCharges === 1) &&
      nonnegative(h.lastAction.before.actualMinutes))))) return 'invalid_habits'
  if (!records('areas', 'areas', a => has(a, ['name', 'category'], string))) return 'invalid_areas'
  if (!records('growthEvents', 'events', e => has(e, ['type', 'title', 'timestamp'], string) && object(e.details))) return 'invalid_events'
  const c = (data.character as Obj).character
  if (!object(c) || !has(c, ['name'], string) || !has(c, ['level', 'totalXP', 'currentXP', 'ore'], number)) return 'invalid_character'
  const s = (data.settings as Obj).settings
  if (!object(s) || !string(s.theme) || !['zh', 'en'].includes(s.language as string) || !strings(s.unlockedThemes)) return 'invalid_settings'
  const earned = (data.badges as Obj).earnedIds
  if (!object(earned) || !Object.values(earned).every(string)) return 'invalid_badges'
  const d = data.dashboard as Obj
  if (d.visibleCards !== undefined && !strings(d.visibleCards)) return 'invalid_dashboard'
  if (d.layout !== undefined && (!Array.isArray(d.layout) || !d.layout.every(c => object(c) && string(c.id) &&
    has(c, ['col', 'row', 'colSpan', 'rowSpan'], number) && (c.colSpan as number) > 0 && (c.rowSpan as number) > 0 &&
    optional(c, ['taskFilter', 'habitFilter'], taskCardFilter)) ||
    new Set(d.layout.map(c => (c as Obj).id)).size !== d.layout.length)) return 'invalid_dashboard'
  if (data.sops !== undefined) {
    if (!object(data.sops)) return 'invalid_sops'
    const slice = data.sops
    const knownSOPIds = new Set(getSystemSOPs('zh').map(sop => sop.id))
    const systemIds = (value: unknown, known: ReadonlySet<string>) =>
      strings(value) && new Set(value as string[]).size === (value as string[]).length &&
      (value as string[]).every(id => known.has(id))
    if (!records('sops', 'sops', sop => string(sop.title) && string(sop.folderId) && steps(sop.steps) &&
      optional(sop, ['displayStyle'], value => ['numbered', 'bullet', 'timeline'].includes(value as string))) ||
      !records('sops', 'folders', folder => string(folder.name)) ||
      !optional(slice, ['deletedSystemFolderIds'], value => systemIds(value, new Set([SYSTEM_FOLDER_ID]))) ||
      !optional(slice, ['deletedSystemSOPIds'], value => systemIds(value, knownSOPIds)) ||
      !optional(slice, ['collapsedFolderIds'], strings) ||
      !optional(slice, ['selectedSOPId'], value => value === null || string(value))) return 'invalid_sops'
  }
  if (data.inspirations !== undefined && !records('inspirations', 'inspirations', i => string(i.content) && string(i.createdAt))) return 'invalid_inspirations'
  return null
}
