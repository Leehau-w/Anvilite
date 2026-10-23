import { beforeEach, afterEach, expect, it, vi } from 'vitest'
import type { CardLayout } from './dashboardStore'

const memoryStorage = localStorage
let module: typeof import('./dashboardStore')
beforeEach(async () => {
  vi.resetModules()
  vi.stubGlobal('localStorage', memoryStorage)
  vi.stubGlobal('window', { localStorage: memoryStorage })
  localStorage.clear()
  module = await import('./dashboardStore')
})
afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

function legacyLayout(): CardLayout[] {
  return module.DEFAULT_LAYOUT.filter(card => card.id !== 'waiting').map(card => ({ ...card,
    ...(card.id === 'tasks' ? { col: 7, row: 22, colSpan: 13, rowSpan: 9 } : {}),
    ...(card.id === 'habits' ? { col: 0, row: 16, colSpan: 9, rowSpan: 6 } : {}),
  }))
}
async function reload(state: { layout: CardLayout[]; visibleCards?: string[] }, version = 3) {
  localStorage.setItem('anvilite-dashboard', JSON.stringify({ state, version }))
  vi.resetModules()
  return (await import('./dashboardStore')).useDashboardStore
}

it('adds only the waiting card to new profile defaults and keeps persistence version 3', () => {
  expect(module.useDashboardStore.persist.getOptions().version).toBe(3)
  expect(module.DEFAULT_LAYOUT.find(card => card.id === 'waiting')).toEqual({
    id: 'waiting', col: 16, row: 10, colSpan: 8, rowSpan: 5,
  })
  expect(module.useDashboardStore.getState().visibleCards).toContain('waiting')
  expect(module.DEFAULT_LAYOUT.find(card => card.id === 'tasks')).toEqual({
    id: 'tasks', col: 0, row: 2, colSpan: 8, rowSpan: 8,
  })
})

it('puts a newly introduced waiting card below the saved bottom without moving or unhiding old cards', async () => {
  const oldLayout = legacyLayout()
  const oldVisibility = ['tasks', 'habits']
  const store = await reload({ layout: oldLayout, visibleCards: oldVisibility })
  expect(store.getState().layout.filter(card => card.id !== 'waiting')).toEqual(oldLayout)
  expect(store.getState().layout.find(card => card.id === 'waiting')).toEqual({
    id: 'waiting', col: 0, row: 31, colSpan: 8, rowSpan: 5,
  })
  expect(store.getState().visibleCards).toEqual([...oldVisibility, 'waiting'])
  expect(JSON.parse(localStorage.getItem('anvilite-dashboard')!).version).toBe(3)
})

it('keeps the newly introduced card hidden if the saved visibility list explicitly hides every card', async () => {
  const oldLayout = legacyLayout()
  const store = await reload({ layout: oldLayout, visibleCards: [] })
  expect(store.getState().visibleCards).toEqual([])
  expect(store.getState().layout.filter(card => card.id !== 'waiting')).toEqual(oldLayout)
  expect(store.getState().layout.filter(card => card.id === 'waiting')).toHaveLength(1)
})

it('keeps a waiting card hidden and in its saved position after the user hides it and restarts', async () => {
  const store = await reload({ layout: legacyLayout(), visibleCards: ['tasks'] })
  store.getState().updateCard('waiting', { col: 12, row: 40, colSpan: 12, rowSpan: 7 })
  store.getState().removeCard('waiting')
  const original = JSON.parse(localStorage.getItem('anvilite-dashboard')!)
  vi.resetModules()
  const restored = (await import('./dashboardStore')).useDashboardStore
  expect(restored.getState().visibleCards).toEqual(['tasks'])
  expect(restored.getState().layout).toEqual(original.state.layout)
  expect(restored.getState().layout.filter(card => card.id === 'waiting')).toHaveLength(1)
})

it('does not unhide a preexisting waiting card when another old card must be supplemented', async () => {
  const current = module.DEFAULT_LAYOUT.filter(card => card.id !== 'flows').map(card => ({ ...card }))
  const store = await reload({ layout: current, visibleCards: ['tasks'] })
  expect(store.getState().visibleCards).toEqual(['tasks'])
  expect(store.getState().layout.find(card => card.id === 'waiting')).toEqual(current.find(card => card.id === 'waiting'))
  expect(store.getState().layout.some(card => card.id === 'flows')).toBe(true)
})

it('migrates historical version-zero geometry while introducing waiting below it', async () => {
  const oldLayout = legacyLayout()
  const store = await reload({ layout: oldLayout, visibleCards: ['tasks'] }, 0)
  expect(store.getState().layout.filter(card => card.id !== 'waiting')).toEqual(oldLayout)
  expect(store.getState().visibleCards).toEqual(['tasks', 'waiting'])
  expect(store.getState().layout.find(card => card.id === 'waiting')?.row).toBe(31)
  expect(JSON.parse(localStorage.getItem('anvilite-dashboard')!).version).toBe(3)
})
