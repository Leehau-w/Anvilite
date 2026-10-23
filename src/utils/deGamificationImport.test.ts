import { afterEach, beforeEach, expect, it, vi } from 'vitest'
const storage = localStorage
const session = sessionStorage
beforeEach(() => {
  vi.resetModules()
  vi.useFakeTimers()
  vi.setSystemTime(new Date(2026, 9, 23, 12))
  vi.stubGlobal('localStorage', storage)
  vi.stubGlobal('sessionStorage', session)
  storage.clear()
  vi.stubGlobal('window', { localStorage: storage, location: { reload: vi.fn() }, addEventListener: vi.fn() })
  vi.stubGlobal('document', { documentElement: { setAttribute: vi.fn() } })
})
afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); vi.unstubAllGlobals() })
async function stores() {
  const data = await import('./dataExport')
  return { data,
    tasks: (await import('@/stores/taskStore')).useTaskStore,
    habits: (await import('@/stores/habitStore')).useHabitStore,
    character: (await import('@/stores/characterStore')).useCharacterStore,
    badges: (await import('@/stores/badgeStore')).useBadgeStore,
    settings: (await import('@/stores/settingsStore')).useSettingsStore,
    dashboard: (await import('@/stores/dashboardStore')).useDashboardStore,
    events: (await import('@/stores/growthEventStore')).useGrowthEventStore,
    sops: (await import('@/stores/sopStore')).useSOPStore,
    inspirations: (await import('@/stores/inspirationStore')).useInspirationStore,
  }
}
async function legacyBackup() {
  const all = await stores()
  const { tasks, habits, dashboard, settings, sops, inspirations, data } = all
  const task = tasks.getState().addTask({ title: 'Old completed task', category: 'home', actualMinutes: 23 })
  tasks.getState().updateTask(task.id, { actualMinutes: 23 })
  tasks.getState().completeTask(task.id)
  tasks.getState().updateTask(task.id, { xpReward: 35 })
  const waiting = tasks.getState().addTask({ title: 'Waiting reply', category: 'work', actualMinutes: 7 })
  tasks.getState().updateTask(waiting.id, { actualMinutes: 7 })
  tasks.getState().waitTask(waiting.id)
  habits.getState().addHabit({ title: 'Daily follow-up', category: 'home', difficulty: 2, estimatedMinutes: 10,
    repeatType: 'daily', customIntervalDays: null, weeklyDays: null, weeklyMode: null, weeklyFlexibleCount: null,
    monthlyDays: null, targetCount: 2, startDate: '2026-10-23', endDate: null, reminderTime: null, description: '' })
  const habit = habits.getState().habits[0]
  habits.getState().completeHabit(habit.id)
  habits.getState().completeHabit(habit.id)
  dashboard.getState().updateCard('character', { col: 10, row: 30, colSpan: 12, rowSpan: 8 })
  dashboard.getState().removeCard('character')
  dashboard.getState().setTaskCardFilter('tasks', { mode: 'single', categories: ['work'] })
  settings.getState().setTheme('forge-purple')
  settings.getState().setCharacterName('Saved display name')
  const folder = sops.getState().addFolder('Preserved flows')
  sops.getState().addSOP({ folderId: folder, title: 'Preserved flow', displayStyle: 'bullet', isSystem: false, steps: [] })
  inspirations.getState().addInspiration('Preserved idea')
  const incoming = JSON.parse(data.serializeExportData())
  Object.assign(incoming.data.character.character, { name: 'Saved user', level: 17, totalXP: 987, currentXP: 32,
    ore: 321, totalOreEarned: 654, xpFormulaVersion: 1, titlePreset: 'custom', customTitles: ['Legacy title'] })
  incoming.data.badges = { earnedIds: { legacy: '2026-09-01T12:00:00.000Z' }, notifyQueue: ['legacy'] }
  incoming.data.settings.settings.unlockedThemes = ['dawn-white']
  incoming.data.growthEvents.events.push({ id: 'old-badge', type: 'badge_earned', title: 'Old badge', details: { badgeId: 'legacy' }, isMilestone: true, timestamp: '2026-09-01T12:00:00.000Z' })
  return { ...all, incoming, task, waiting, habit }
}
it('cold restores a legacy backup without recalculating rewards, losing business data or resetting the layout', async () => {
  const { data, incoming, task, waiting, habit } = await legacyBackup()
  expect(data.applyImportPayload(incoming)).toEqual({ success: true })
  vi.resetModules()
  const fresh = await stores()
  expect(fresh.character.getState().character).toEqual(incoming.data.character.character)
  expect(fresh.badges.getState().earnedIds).toEqual(incoming.data.badges.earnedIds)
  expect(fresh.tasks.getState().tasks).toEqual(incoming.data.tasks.tasks)
  expect(fresh.habits.getState().habits).toEqual(incoming.data.habits.habits)
  expect(fresh.dashboard.getState().layout).toEqual(incoming.data.dashboard.layout)
  expect(fresh.dashboard.getState().visibleCards).toEqual(incoming.data.dashboard.visibleCards)
  expect(fresh.settings.getState().settings).toMatchObject({ theme: 'forge-purple', characterName: 'Saved display name' })
  expect(fresh.settings.getState().settings.unlockedThemes).toHaveLength(8)
  expect(fresh.events.getState().events).toEqual(incoming.data.growthEvents.events)
  expect(fresh.sops.getState().sops).toEqual(incoming.data.sops.sops)
  expect(fresh.inspirations.getState().inspirations).toEqual(incoming.data.inspirations.inspirations)
  const balances = () => { const c = fresh.character.getState().character; return [c.level, c.totalXP, c.currentXP, c.ore, c.totalOreEarned] }
  const before = balances()
  fresh.tasks.getState().undoComplete(task.id)
  expect(fresh.habits.getState().undoComplete(habit.id)).toBe(true)
  fresh.tasks.getState().completeTask(waiting.id)
  fresh.habits.getState().completeHabit(habit.id)
  expect(balances()).toEqual(before)
  expect(fresh.events.getState().events.filter(e => e.type === 'task_complete' && e.details.entityId === waiting.id)).toHaveLength(1)
  expect(fresh.events.getState().events.some(e => e.id === 'old-badge')).toBe(true)
  const roundTrip = JSON.parse(fresh.data.serializeExportData())
  expect(roundTrip.data.character.character.totalXP).toBe(987)
  expect(roundTrip.data.character.character.ore).toBe(321)
  expect(roundTrip.data.badges.earnedIds).toEqual(incoming.data.badges.earnedIds)
})
it('restores all previous slices if writing a legacy backup fails partway through', async () => {
  const { data, incoming } = await legacyBackup()
  const keys = ['character','tasks','habits','areas','badges','dashboard','settings','growth-events','sops','inspirations']
  const before = keys.map(key => storage.getItem('anvilite-' + key))
  const write = storage.setItem.bind(storage)
  let failed = false
  vi.spyOn(storage, 'setItem').mockImplementation((key, value) => {
    if (key === 'anvilite-settings' && !failed) { failed = true; throw new Error('Synthetic quota') }
    write(key, value)
  })
  expect(data.applyImportPayload(incoming)).toEqual({ success: false, error: 'write_failed' })
  expect(keys.map(key => storage.getItem('anvilite-' + key))).toEqual(before)
})
it('switches every theme directly after legacy hydration without touching old balances or saved positions', async () => {
  const { data, incoming } = await legacyBackup()
  expect(data.applyImportPayload(incoming).success).toBe(true)
  vi.resetModules()
  const { settings, character, dashboard } = await stores()
  const { AVAILABLE_THEME_IDS } = await import('@/stores/settingsStore')
  const oldCharacter = structuredClone(character.getState().character)
  const oldLayout = structuredClone(dashboard.getState().layout)
  for (const theme of AVAILABLE_THEME_IDS) {
    settings.getState().setTheme(theme)
    expect(settings.getState().settings.theme).toBe(theme)
    expect(document.documentElement.setAttribute).toHaveBeenLastCalledWith('data-theme', theme === 'dawn-white' ? '' : theme)
  }
  expect(character.getState().character).toEqual(oldCharacter)
  expect(dashboard.getState().layout).toEqual(oldLayout)
})
