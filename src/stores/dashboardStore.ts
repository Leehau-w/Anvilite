import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type CardId = 'quickAdd' | 'stats' | 'tasks' | 'character' | 'habits' | 'growth'

export interface CardLayout {
  id: CardId
  col: number
  row: number
  colSpan: number
  rowSpan: number
}

export const COLS = 12
export const ROW_H = 88   // px per row
export const GAP = 12     // px gap between cells

export const DEFAULT_LAYOUT: CardLayout[] = [
  { id: 'quickAdd',  col: 0, row: 0, colSpan: 8, rowSpan: 1 },
  { id: 'stats',     col: 8, row: 0, colSpan: 4, rowSpan: 1 },
  { id: 'tasks',     col: 0, row: 1, colSpan: 8, rowSpan: 4 },
  { id: 'character', col: 8, row: 1, colSpan: 4, rowSpan: 2 },
  { id: 'habits',    col: 8, row: 3, colSpan: 4, rowSpan: 2 },
  { id: 'growth',    col: 8, row: 5, colSpan: 4, rowSpan: 2 },
]

interface DashboardStore {
  layout: CardLayout[]
  updateCard: (id: CardId, patch: Partial<Omit<CardLayout, 'id'>>) => void
  resetLayout: () => void
}

export const useDashboardStore = create<DashboardStore>()(
  persist(
    (set) => ({
      layout: DEFAULT_LAYOUT,
      updateCard: (id, patch) =>
        set((s) => ({
          layout: s.layout.map((c) => (c.id === id ? { ...c, ...patch } : c)),
        })),
      resetLayout: () => set({ layout: DEFAULT_LAYOUT }),
    }),
    {
      name: 'anvilite-dashboard',
      onRehydrateStorage: () => (state) => {
        if (!state) return
        // Ensure all default cards exist (handles new card additions)
        const ids = new Set(state.layout.map((c) => c.id))
        const missing = DEFAULT_LAYOUT.filter((c) => !ids.has(c.id))
        if (missing.length) state.layout = [...state.layout, ...missing]
      },
    }
  )
)

// ─── Grid math helpers ────────────────────────────────────────────────────────

/** Compute pixel rect from card grid position */
export function gridRect(card: CardLayout, cw: number) {
  const colW = (cw - GAP * (COLS + 1)) / COLS
  return {
    x: GAP + card.col * (colW + GAP),
    y: GAP + card.row * (ROW_H + GAP),
    w: card.colSpan * colW + (card.colSpan - 1) * GAP,
    h: card.rowSpan * ROW_H + (card.rowSpan - 1) * GAP,
  }
}

/** Snap pixel position to nearest grid col/row */
export function snapPos(px: number, py: number, cw: number) {
  const colW = (cw - GAP * (COLS + 1)) / COLS
  return {
    col: Math.max(0, Math.min(COLS - 1, Math.round((px - GAP) / (colW + GAP)))),
    row: Math.max(0, Math.round((py - GAP) / (ROW_H + GAP))),
  }
}

/** Compute new spans after resize by delta pixels */
export function snapSpan(
  dw: number,
  dh: number,
  card: CardLayout,
  cw: number,
  minColSpan = 2,
  minRowSpan = 1,
) {
  const colW = (cw - GAP * (COLS + 1)) / COLS
  const curRect = gridRect(card, cw)
  const colSpan = Math.max(
    minColSpan,
    Math.min(COLS - card.col, Math.round((curRect.w + dw + GAP) / (colW + GAP))),
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
