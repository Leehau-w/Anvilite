type Obj = Record<string, unknown>
const object = (v: unknown): v is Obj => !!v && typeof v === 'object' && !Array.isArray(v)
const string = (v: unknown) => typeof v === 'string'
const number = (v: unknown) => typeof v === 'number' && Number.isFinite(v)
const strings = (v: unknown) => Array.isArray(v) && v.every(string)
const has = (v: Obj, keys: string[], check: (x: unknown) => boolean) => keys.every(k => check(v[k]))
const optional = (v: Obj, keys: string[], check: (x: unknown) => boolean) => keys.every(k => v[k] === undefined || check(v[k]))
const nullableString = (v: unknown) => v === null || string(v)
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
    ['todo', 'doing', 'done'].includes(t.status as string) && [1, 2, 3, 4, 5].includes(t.difficulty as number) &&
    ['urgent', 'high', 'medium', 'low'].includes(t.priority as string) &&
    optional(t, ['actualMinutes', 'xpReward', 'timerAccumulated', 'sortOrder'], number) &&
    (t.subTasks === undefined || tree(t.subTasks, 'subTasks')) && (t.tags === undefined || strings(t.tags)))) return 'invalid_tasks'
  if (!records('habits', 'habits', h => has(h, ['title', 'category', 'startDate', 'createdAt', 'updatedAt'], string) &&
    ['active', 'completed_today', 'paused', 'archived', 'mastered'].includes(h.status as string) &&
    ['daily', 'weekdays', 'weekly', 'biweekly', 'monthly', 'custom', 'monthly_fixed'].includes(h.repeatType as string) &&
    [1, 2, 3, 4, 5].includes(h.difficulty as number) &&
    optional(h, ['targetCount', 'currentCycleCount', 'consecutiveCount', 'totalCompletions', 'actualMinutes', 'timerAccumulated'], number) &&
    (h.subHabits === undefined || tree(h.subHabits, 'subHabits')) &&
    (h.lastAction == null || (object(h.lastAction) && has(h.lastAction, ['id', 'at'], string) &&
      ['skip', 'complete'].includes(h.lastAction.kind as string) && number(h.lastAction.xp) &&
      object(h.lastAction.before) && tree(h.lastAction.before.subHabits, 'subHabits') &&
      Object.keys(h.lastAction.before).every(k => snapshotKeys.includes(k)) &&
      has(h.lastAction.before, ['lastCompletedAt', 'lastDueAt'], nullableString) &&
      has(h.lastAction.before, ['consecutiveCount', 'totalCompletions', 'toleranceCharges', 'toleranceNextAt',
        'weeklyCompletionCount', 'currentCycleCount', 'actualMinutes'], number))))) return 'invalid_habits'
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
    has(c, ['col', 'row', 'colSpan', 'rowSpan'], number) && (c.colSpan as number) > 0 && (c.rowSpan as number) > 0))) return 'invalid_dashboard'
  if (data.sops !== undefined && (!records('sops', 'sops', s => string(s.title) && string(s.folderId) && steps(s.steps)) ||
    !records('sops', 'folders', f => string(f.name)))) return 'invalid_sops'
  if (data.inspirations !== undefined && !records('inspirations', 'inspirations', i => string(i.content) && string(i.createdAt))) return 'invalid_inspirations'
  return null
}
