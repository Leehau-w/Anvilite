const CARD_ASPECT = 1
const CARD_GAP = 16
const MIN_CARD_W = 120

/** 给定容器内容区尺寸和卡片数量，求最大化卡片面积的列数 */
export function computeOptimalCols(W: number, H: number, n: number): number {
  if (W <= 0 || H <= 0 || n === 0) return 3
  let best = 0
  let bestArea = 0
  for (let c = 1; c <= n; c++) {
    const rows = Math.ceil(n / c)
    const w = (W - (c - 1) * CARD_GAP) / c
    if (w < MIN_CARD_W) break
    const h = w / CARD_ASPECT
    const totalH = rows * h + (rows - 1) * CARD_GAP
    if (totalH <= H) {
      const area = w * h
      if (area > bestArea) { bestArea = area; best = c }
    }
  }
  // 若容器太矮，无任何布局能不滚动时，选最多列（最小行数）
  if (best === 0) {
    for (let c = n; c >= 1; c--) {
      const w = (W - (c - 1) * CARD_GAP) / c
      if (w >= MIN_CARD_W) { best = c; break }
    }
  }
  return Math.max(1, best || 1)
}
