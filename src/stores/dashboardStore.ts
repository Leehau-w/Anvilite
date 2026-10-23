import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { getStoragePrefix } from './accountManager'

export type BaseCardId = 'quickAdd' | 'stats' | 'tasks' | 'character' | 'habits' | 'growth' | 'inspiration' | 'flows' | 'waiting'
export type TaskCardId = 'tasks' | `tasks:${string}`
export type HabitCardId = 'habits' | `habits:${string}`
export type CardId = BaseCardId | TaskCardId | HabitCardId

export type TaskCardFilter = {
  mode: 'all' | 'single' | 'multiple'
  categories: string[]
}

export function isTaskCardId(id: string): id is TaskCardId {
  return id === 'tasks' || id.startsWith('tasks:') && id.length > 6
}

export function isHabitCardId(id: string): id is HabitCardId {
  return id === 'habits' || id.startsWith('habits:') && id.length > 7
}

function normalizeCategoryFilter(filter: TaskCardFilter): TaskCardFilter {
  const categories = [...new Set(filter.categories)]
  return { mode: filter.mode, categories: filter.mode === 'all' ? []
    : filter.mode === 'single' ? categories.slice(0, 1) : categories }
}

export const ALL_CARD_IDS: BaseCardId[] = ['quickAdd', 'stats', 'tasks', 'character', 'habits', 'growth', 'inspiration', 'flows', 'waiting']

export interface CardLayout {
  id: CardId
  col: number
  row: number
  colSpan: number
  rowSpan: number
  taskFilter?: TaskCardFilter
  habitFilter?: TaskCardFilter
}

export const COLS = 24
export const ROW_H = 44    // px per row
export const GAP = 8       // px gap between cells

export const DEFAULT_LAYOUT: CardLayout[] = [
  { id: 'quickAdd',     col: 0,  row: 0,  colSpan: 16, rowSpan: 2 },
  { id: 'stats',        col: 16, row: 0,  colSpan: 8,  rowSpan: 2 },
  { id: 'tasks',        col: 0,  row: 2,  colSpan: 8,  rowSpan: 8 },
  { id: 'habits',       col: 8,  row: 2,  colSpan: 8,  rowSpan: 8 },
  { id: 'character',    col: 16, row: 2,  colSpan: 8,  rowSpan: 3 },
  { id: 'growth',       col: 16, row: 5,  colSpan: 8,  rowSpan: 5 },
  { id: 'inspiration',  col: 0,  row: 10, colSpan: 8,  rowSpan: 5 },
  { id: 'flows',        col: 8,  row: 10, colSpan: 8,  rowSpan: 5 },
  { id: 'waiting',      col: 16, row: 10, colSpan: 8,  rowSpan: 5 },
]

interface DashboardStore {
  layout: CardLayout[]
  visibleCards: CardId[]
  updateCard: (id: CardId, patch: Partial<Omit<CardLayout, 'id'>>) => void
  removeCard: (id: CardId) => void
  addCard: (id: CardId) => void
  addTaskCard: () => CardId
  addHabitCard: () => CardId
  setTaskCardFilter: (id: CardId, filter: TaskCardFilter) => void
  setHabitCardFilter: (id: CardId, filter: TaskCardFilter) => void
  resetLayout: () => void
}

export const useDashboardStore = create<DashboardStore>()(
  persist(
    (set, get) => ({
      layout: DEFAULT_LAYOUT,
      visibleCards: ALL_CARD_IDS,
      updateCard: (id, patch) =>
        set((s) => ({
          layout: s.layout.map((c) => (c.id === id ? { ...c, ...patch } : c)),
        })),
      removeCard: (id) =>
        set((s) => ({ visibleCards: s.visibleCards.filter((c) => c !== id) })),
      addCard: (id) =>
        set((s) => {
          if (s.visibleCards.includes(id) || !s.layout.some(card => card.id === id)) return s
          return { visibleCards: [...s.visibleCards, id] }
        }),
      addTaskCard: () => {
        const state = get()
        let id: CardId
        do { id = `tasks:${crypto.randomUUID()}` } while (state.layout.some(card => card.id === id))
        const row = Math.max(0, ...state.layout.map(card => card.row + card.rowSpan))
        set({
          layout: [...state.layout, { id, col: 0, row, colSpan: 8, rowSpan: 8 }],
          visibleCards: [...state.visibleCards, id],
        })
        return id
      },
      addHabitCard: () => {
        const state = get()
        let id: CardId
        do { id = `habits:${crypto.randomUUID()}` } while (state.layout.some(card => card.id === id))
        const row = Math.max(0, ...state.layout.map(card => card.row + card.rowSpan))
        set({
          layout: [...state.layout, { id, col: 0, row, colSpan: 8, rowSpan: 8 }],
          visibleCards: [...state.visibleCards, id],
        })
        return id
      },
      setHabitCardFilter: (id, filter) => {
        if (!isHabitCardId(id)) return
        set(s => ({ layout: s.layout.map(card => card.id === id
          ? { ...card, habitFilter: normalizeCategoryFilter(filter) } : card) }))
      },
      setTaskCardFilter: (id, filter) => {
        if (!isTaskCardId(id)) return
        set(s => ({ layout: s.layout.map(card => card.id === id
          ? { ...card, taskFilter: normalizeCategoryFilter(filter) } : card) }))
      },
      resetLayout: () => set({ layout: DEFAULT_LAYOUT, visibleCards: ALL_CARD_IDS }),
    }),
    {
      name: `${getStoragePrefix()}-dashboard`,
      version: 3,
      migrate: (persisted) => {
        const old = persisted as Partial<DashboardStore>
        return {
          layout: old.layout ?? DEFAULT_LAYOUT,
          visibleCards: old.visibleCards ?? ALL_CARD_IDS,
        }
      },
      onRehydrateStorage: () => (state) => {
        if (!state) return
        const ids = new Set(state.layout.map((c) => c.id))
        const missing = DEFAULT_LAYOUT.filter((c) => c.id !== 'waiting' && !ids.has(c.id))
        if (missing.length) state.layout = [...state.layout, ...missing]
        if (!state.visibleCards) state.visibleCards = ALL_CARD_IDS
        if (!ids.has('waiting')) {
          // Add the new card below the saved layout without moving any old card.
          const bottom = Math.max(0, ...state.layout.map(c => c.row + c.rowSpan))
          state.layout = [...state.layout, { id: 'waiting', col: 0, row: bottom, colSpan: 8, rowSpan: 5 }]
          // An explicitly empty list means the user hid every card. Once the
          // layout contains waiting, later user hiding must survive reloads.
          if (state.visibleCards.length && !state.visibleCards.includes('waiting')) {
            state.visibleCards = [...state.visibleCards, 'waiting']
          }
        }
      },
    }
  )
)

// ─── Grid math helpers ────────────────────────────────────────────────────────

/** Column width in pixels for a given container width */
function colWidth(cw: number) {
  return (cw - GAP * (COLS + 1)) / COLS
}

/** Compute pixel rect from card grid position */
export function gridRect(card: CardLayout, cw: number) {
  const cW = colWidth(cw)
  return {
    x: GAP + card.col * (cW + GAP),
    y: GAP + card.row * (ROW_H + GAP),
    w: card.colSpan * cW + (card.colSpan - 1) * GAP,
    h: card.rowSpan * ROW_H + (card.rowSpan - 1) * GAP,
  }
}

/** Snap pixel position to nearest grid col/row */
export function snapPos(px: number, py: number, cw: number) {
  const cW = colWidth(cw)
  return {
    col: Math.max(0, Math.min(COLS - 1, Math.round((px - GAP) / (cW + GAP)))),
    row: Math.max(0, Math.round((py - GAP) / (ROW_H + GAP))),
  }
}

/** Compute new spans after resize by delta pixels */
export function snapSpan(
  dw: number,
  dh: number,
  card: CardLayout,
  cw: number,
  minColSpan = 4,
  minRowSpan = 2,
) {
  const cW = colWidth(cw)
  const curRect = gridRect(card, cw)
  const colSpan = Math.max(
    minColSpan,
    Math.min(COLS - card.col, Math.round((curRect.w + dw + GAP) / (cW + GAP))),
  )
  const rowSpan = Math.max(
    minRowSpan,
    Math.round((curRect.h + dh + GAP) / (ROW_H + GAP)),
  )
  return { colSpan, rowSpan }
}

/** Total grid height in px for a given layout */
export function gridHeight(layout: CardLayout[]) {
  const maxRow = Math.max(...layout.map((c) => c.row + c.rowSpan))
  return GAP + maxRow * (ROW_H + GAP)
}
