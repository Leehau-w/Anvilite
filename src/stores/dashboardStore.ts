import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { getStoragePrefix } from './accountManager'

export type CardId = 'quickAdd' | 'stats' | 'tasks' | 'character' | 'habits' | 'growth'

export const ALL_CARD_IDS: CardId[] = ['quickAdd', 'stats', 'tasks', 'character', 'habits', 'growth']

export interface CardLayout {
  id: CardId
  col: number
  row: number
  colSpan: number
  rowSpan: number
}

export const COLS = 24
export const ROW_H = 44    // px per row
export const GAP = 8       // px gap between cells

export const DEFAULT_LAYOUT: CardLayout[] = [
  { id: 'quickAdd',  col: 0,  row: 0,  colSpan: 16, rowSpan: 2 },
  { id: 'stats',     col: 16, row: 0,  colSpan: 8,  rowSpan: 2 },
  { id: 'tasks',     col: 0,  row: 2,  colSpan: 8,  rowSpan: 8 },
  { id: 'habits',    col: 8,  row: 2,  colSpan: 8,  rowSpan: 8 },
  { id: 'character', col: 16, row: 2,  colSpan: 8,  rowSpan: 3 },
  { id: 'growth',    col: 16, row: 5,  colSpan: 8,  rowSpan: 5 },
]

interface DashboardStore {
  layout: CardLayout[]
  visibleCards: CardId[]
  updateCard: (id: CardId, patch: Partial<Omit<CardLayout, 'id'>>) => void
  removeCard: (id: CardId) => void
  addCard: (id: CardId) => void
  resetLayout: () => void
}

export const useDashboardStore = create<DashboardStore>()(
  persist(
    (set) => ({
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
          if (s.visibleCards.includes(id)) return s
          return { visibleCards: [...s.visibleCards, id] }
        }),
      resetLayout: () => set({ layout: DEFAULT_LAYOUT, visibleCards: ALL_CARD_IDS }),
    }),
    {
      name: `${getStoragePrefix()}-dashboard`,
      version: 3,
      onRehydrateStorage: () => (state) => {
        if (!state) return
        const ids = new Set(state.layout.map((c) => c.id))
        const missing = DEFAULT_LAYOUT.filter((c) => !ids.has(c.id))
        if (missing.length) state.layout = [...state.layout, ...missing]
        if (!state.visibleCards) state.visibleCards = ALL_CARD_IDS
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
