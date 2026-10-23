import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import old030 from '@/test/fixtures/release-v0.3.0-storage.json'
import old033 from '@/test/fixtures/release-v0.3.3-storage.json'

const storage = localStorage
const session = sessionStorage
const fixtures = [old030, old033]
beforeEach(() => {
  vi.resetModules()
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-10-23T10:00:00.000Z'))
  storage.clear()
  vi.stubGlobal('localStorage', storage)
  vi.stubGlobal('sessionStorage', session)
  vi.stubGlobal('window', { localStorage: storage, location: { reload: vi.fn() }, addEventListener: vi.fn() })
  vi.stubGlobal('document', { documentElement: { setAttribute: vi.fn() } })
})
afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); vi.unstubAllGlobals() })

function seed(fixture: typeof old030 | typeof old033, account = 'default') {
  const prefix = account === 'default' ? 'anvilite' : 'anvilite-' + account
  for (const [key, value] of Object.entries(fixture.storage)) {
    if (key.startsWith('anvilite-') && /-(character|tasks|habits|areas|badges|dashboard|settings|growth-events|sops|inspirations)$/.test(key)) {
      storage.setItem(prefix + key.slice('anvilite'.length), value)
    }
  }
  storage.setItem('anvilite-current-account', account)
}
async function load() {
  const data = await import('./dataExport')
  return { data,
    tasks: (await import('@/stores/taskStore')).useTaskStore,
    habits: (await import('@/stores/habitStore')).useHabitStore,
    character: (await import('@/stores/characterStore')).useCharacterStore,
    badges: (await import('@/stores/badgeStore')).useBadgeStore,
    dashboard: (await import('@/stores/dashboardStore')).useDashboardStore,
    areas: (await import('@/stores/areaStore')).useAreaStore,
    settings: (await import('@/stores/settingsStore')).useSettingsStore,
    events: (await import('@/stores/growthEventStore')).useGrowthEventStore,
    sops: (await import('@/stores/sopStore')).useSOPStore,
    inspirations: (await import('@/stores/inspirationStore')).useInspirationStore,
  }
}

it.each(fixtures)('cold upgrades original $provenance.tag data without resetting layout, notes or historical balances', async fixture => {
  seed(fixture)
  const fresh = await load()
  expect(fresh.character.getState().character).toEqual(fixture.payload.data.character.character)
  expect(fresh.badges.getState().earnedIds).toEqual(fixture.payload.data.badges.earnedIds)
  expect(fresh.events.getState().events).toEqual(fixture.payload.data.growthEvents.events)
  expect(fresh.areas.getState().areas).toMatchObject(fixture.payload.data.areas.areas)
  const dashboard = fresh.dashboard.getState()
  expect(dashboard.layout.filter(item => fixture.payload.data.dashboard.layout.some(saved=>saved.id===item.id))).toEqual(fixture.payload.data.dashboard.layout)
  expect(dashboard.visibleCards.filter(item => item !== 'waiting')).toEqual(fixture.payload.data.dashboard.visibleCards)
  expect(dashboard.layout.find(item => item.id === 'waiting')!.row).toBeGreaterThanOrEqual(29)
  const task = fresh.tasks.getState().tasks.find(item => item.title === 'Legacy task root')!
  expect(task).toMatchObject({actualMinutes:47,description:'Preserve root description',isHidden:true})
  expect(task.subTasks[0].title).toBe('Legacy task child')
  const habit = fresh.habits.getState().habits.find(item => item.title === 'Legacy habit root')!
  expect(habit).toMatchObject({actualMinutes:11,consecutiveCount:7,totalCompletions:19,currentCycleCount:1,isHidden:true})
  expect(habit.subHabits[0].title).toBe('Legacy habit child')
  expect(habit.subHabits[0].subHabits[0].title).toBe('Legacy habit grandchild')
  expect(fresh.data.parseImportText(fresh.data.serializeExportData()).success).toBe(true)
})

it('imports original v0.3.0 nested children and missing timer defaults even after another account has set migration markers', async () => {
  for (const key of ['anvilite-subtask-migration-v3','anvilite-subhabit-migration-v3','anvilite-migration-habit-timer-v031']) storage.setItem(key, 'another-account-already-migrated')
  const current = await load()
  expect(current.data.applyImportPayload(old030.payload as unknown as import('./dataExport').ExportData)).toEqual({success:true})
  vi.resetModules()
  const fresh = await load()
  expect(fresh.tasks.getState().tasks).toHaveLength(3)
  expect(fresh.tasks.getState().tasks.find(item=>item.title==='Legacy task root')!.subTasks[0].title).toBe('Legacy task child')
  const habit = fresh.habits.getState().habits.find(item=>item.title==='Legacy habit root')!
  expect(habit.subHabits[0].title).toBe('Legacy habit child')
  expect(habit.subHabits[0].completed).toBe(false)
  expect(habit.subHabits[0].subHabits[0].title).toBe('Legacy habit grandchild')
  expect(habit.timerAccumulated).toBe(0)
})

it('retains a newly archived habit across cold reload instead of silently changing it to paused', async () => {
  seed(old033)
  const current = await load()
  const id = current.habits.getState().habits[0].id
  current.habits.getState().archiveHabit(id)
  expect(current.habits.getState().habits[0].status).toBe('archived')
  vi.resetModules()
  const fresh = await load()
  expect(fresh.habits.getState().habits[0].status).toBe('archived')
})


it.each(fixtures)('round trips original $provenance.tag through import, export and two cold reloads without duplicate children', async fixture => {
  const current = await load()
  expect(current.data.applyImportPayload(fixture.payload as unknown as import('./dataExport').ExportData)).toEqual({success:true})
  vi.resetModules()
  const migrated = await load()
  const first = JSON.parse(migrated.data.serializeExportData())
  expect(first.data.character.character).toEqual(fixture.payload.data.character.character)
  const sops = 'sops' in fixture.payload.data ? fixture.payload.data.sops : null
  if (sops) {
    expect(first.data.sops.sops).toHaveLength(sops.sops.length)
    expect(first.data.sops.folders).toMatchObject(sops.folders)
    if(fixture.provenance.tag==='v0.3.0') {
      const flow=first.data.sops.sops[0]
      expect(flow).toMatchObject({id:sops.sops[0].id,title:'Legacy rich flow',displayStyle:'timeline'})
      expect(JSON.stringify(flow.steps[0].content)).toContain('Parent note')
      expect(JSON.stringify(flow.steps[0].content)).toContain('Parent warning')
      expect(JSON.stringify(flow.steps[0].childSteps[0].content)).toContain('Nested note')
      expect(JSON.stringify(flow.steps[0].childSteps[0].content)).toContain('Nested warning')
      expect(flow.steps[0].time).toBe('07:00')
    } else expect(first.data.sops.sops).toEqual(sops.sops)
    expect(first.data.sops.selectedSOPId).toBe(sops.selectedSOPId)
    expect(first.data.sops.collapsedFolderIds).toEqual(sops.collapsedFolderIds)
  }
  expect(migrated.data.applyImportPayload(first)).toEqual({success:true})
  vi.resetModules()
  const next = await load()
  expect(next.tasks.getState().tasks).toEqual(first.data.tasks.tasks)
  expect(next.habits.getState().habits).toEqual(first.data.habits.habits)
  expect(next.dashboard.getState().layout).toEqual(first.data.dashboard.layout)
  expect(next.dashboard.getState().visibleCards).toEqual(first.data.dashboard.visibleCards)
  expect(next.events.getState().events).toEqual(first.data.growthEvents.events)
  expect(next.data.applyImportPayload(JSON.parse(next.data.serializeExportData()))).toEqual({success:true})
  vi.resetModules()
  const again = await load()
  expect(again.tasks.getState().tasks).toEqual(first.data.tasks.tasks)
  expect(again.habits.getState().habits).toEqual(first.data.habits.habits)
  const oldBalances = structuredClone(again.character.getState().character)
  const done = again.tasks.getState().tasks.find(item=>item.title==='Legacy done')!
  again.tasks.getState().undoComplete(done.id)
  again.tasks.getState().completeTask(done.id)
  again.tasks.getState().completeTask(done.id)
  for (const key of ['level','totalXP','currentXP','ore','totalOreEarned','xpFormulaVersion','titlePreset','customTitles'] as const) {
    expect(again.character.getState().character[key]).toEqual(oldBalances[key])
  }
  expect(again.events.getState().events.filter(event=>event.type==='task_complete'&&event.details.entityId===done.id)).toHaveLength(1)
})

it('hydrates a second v0.3.0 account independently of global markers and leaves first account bytes untouched', async () => {
  seed(old033)
  const first = await load()
  const firstTask = first.tasks.getState().tasks[0]
  first.tasks.getState().updateTask(firstTask.id,{title:'First account private edit'})
  const original = Object.keys(old033.storage).filter(key=>key.endsWith('-tasks')||key.endsWith('-habits')||key.endsWith('-character'))
    .map(key=>[key,storage.getItem(key)] as const)
  seed(old030,'synthetic-second')
  vi.resetModules()
  const second = await load()
  expect(second.tasks.persist.getOptions().name).toBe('anvilite-synthetic-second-tasks')
  const task = second.tasks.getState().tasks.find(item=>item.title==='Legacy task root')!
  const habit = second.habits.getState().habits.find(item=>item.title==='Legacy habit root')!
  expect(task.subTasks[0].title).toBe('Legacy task child')
  expect(habit.subHabits[0].subHabits[0].title).toBe('Legacy habit grandchild')
  expect(habit.timerAccumulated).toBe(0)
  second.tasks.getState().updateTask(task.id,{title:'Second account private edit'})
  await Promise.resolve()
  for (const [key,value] of original) expect(storage.getItem(key)).toBe(value)
  expect(second.data.buildExportPayload().accountId).toBe('synthetic-second')
})

it('restores every slice to its original bytes if importing a genuine older backup fails near the end', async () => {
  seed(old033)
  const current = await load()
  await Promise.resolve()
  const keys=['character','tasks','habits','areas','badges','dashboard','settings','growth-events','sops','inspirations'].map(suffix=>'anvilite-'+suffix)
  const before=keys.map(key=>storage.getItem(key))
  const write=storage.setItem.bind(storage)
  let fail=true
  vi.spyOn(storage,'setItem').mockImplementation((key,value)=>{
    if(key==='anvilite-inspirations'&&fail){fail=false;throw new Error('Synthetic legacy restore quota')}
    write(key,value)
  })
  expect(current.data.applyImportPayload(old030.payload as unknown as import('./dataExport').ExportData)).toEqual({success:false,error:'write_failed'})
  expect(keys.map(key=>storage.getItem(key))).toEqual(before)
})
