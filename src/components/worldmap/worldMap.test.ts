import { describe, it, expect } from 'vitest'
import { computeOptimalCols } from '@/utils/grid'

// CARD_ASPECT=1, CARD_GAP=16, MIN_CARD_W=120
// 宽高比 1:1，gap 16，最小卡片宽 120

describe('computeOptimalCols', () => {
  describe('边界 / 防御', () => {
    it('W=0 返回默认值 3', () => {
      expect(computeOptimalCols(0, 600, 4)).toBe(3)
    })

    it('H=0 返回默认值 3', () => {
      expect(computeOptimalCols(800, 0, 4)).toBe(3)
    })

    it('n=0 返回默认值 3', () => {
      expect(computeOptimalCols(800, 600, 0)).toBe(3)
    })

    it('n=1 始终返回 1', () => {
      expect(computeOptimalCols(800, 600, 1)).toBe(1)
    })
  })

  describe('正常布局', () => {
    it('宽容器 4 张卡：2 列可放下，面积最大', () => {
      // W=800, H=600, n=4
      // 1col: w=800, h=800, 4rows → totalH=4*800+3*16=3248 > 600 ✗
      // 2col: w=(800-16)/2=392, h=392, 2rows → totalH=2*392+16=800 > 600 ✗
      // 3col: w=(800-32)/3≈256, h=256, 2rows → totalH=2*256+16=528 ≤ 600 ✓ area=65536
      // 4col: w=(800-48)/4=188, h=188, 1row → totalH=188 ≤ 600 ✓ area=35344
      // 3col 面积最大
      expect(computeOptimalCols(800, 600, 4)).toBe(3)
    })

    it('宽容器高度充足 4 张卡：1 列面积最大', () => {
      // W=800, H=4000 → 1col: w=800, h=800, 4rows → totalH=3*800+3*16=3248 ≤ 4000 ✓
      // 2col: w=392, smaller area → 1col wins
      expect(computeOptimalCols(800, 4000, 4)).toBe(1)
    })

    it('窄容器强制最多列', () => {
      // W=500, H=100（极矮）, n=4
      // 任何布局 totalH 都超过 100，进入回退逻辑
      // 回退：找最大 c 使 w≥120
      // c=4: w=(500-48)/4=113 < 120 ✗
      // c=3: w=(500-32)/3≈156 ≥ 120 ✓
      expect(computeOptimalCols(500, 100, 4)).toBe(3)
    })

    it('极窄容器只能放 1 列', () => {
      // W=130, H=100, n=4
      // c=4: w=(130-48)/4=20.5 < 120 ✗
      // c=3: w=(130-32)/3≈32.7 < 120 ✗
      // c=2: w=(130-16)/2=57 < 120 ✗
      // c=1: w=130 ≥ 120 ✓
      expect(computeOptimalCols(130, 100, 4)).toBe(1)
    })

    it('单张卡，宽高足够，返回 1', () => {
      expect(computeOptimalCols(600, 600, 1)).toBe(1)
    })

    it('12 张卡（最大值），宽容器合理列数', () => {
      // W=1200, H=800, n=12 → 应该能放至少 3 列
      const cols = computeOptimalCols(1200, 800, 12)
      expect(cols).toBeGreaterThanOrEqual(2)
      expect(cols).toBeLessThanOrEqual(12)
    })
  })

  describe('列数始终合法', () => {
    const cases: [number, number, number][] = [
      [800, 600, 3],
      [400, 300, 6],
      [1920, 1080, 12],
      [200, 200, 2],
      [100, 100, 1],
    ]
    it.each(cases)('W=%i H=%i n=%i → cols ≥ 1', (W, H, n) => {
      expect(computeOptimalCols(W, H, n)).toBeGreaterThanOrEqual(1)
    })
  })
})
