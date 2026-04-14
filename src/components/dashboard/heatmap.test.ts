import { describe, it, expect } from 'vitest'

// ── 从 Heatmap.tsx 提取的纯函数（直接复制以保持测试独立） ──────────────

function hourToSlot(hour: number): 0 | 1 | 2 | 3 {
  if (hour >= 1 && hour < 6)   return 0  // 凌晨 01-05
  if (hour >= 6 && hour < 12)  return 1  // 上午 06-11
  if (hour >= 12 && hour < 18) return 2  // 下午 12-17
  return 3                                // 晚上 18-00
}

function getHeatLevel(xp: number, max: number): 0 | 1 | 2 | 3 | 4 {
  if (xp === 0 || max === 0) return 0
  const ratio = xp / max
  if (ratio < 0.2) return 1
  if (ratio < 0.45) return 2
  if (ratio < 0.75) return 3
  return 4
}

// ── hourToSlot ────────────────────────────────────────────────────────────

describe('hourToSlot', () => {
  it('0时（午夜）→ 晚上(3)', () => expect(hourToSlot(0)).toBe(3))
  it('1时 → 凌晨(0)', () => expect(hourToSlot(1)).toBe(0))
  it('5时 → 凌晨(0)', () => expect(hourToSlot(5)).toBe(0))
  it('6时 → 上午(1)', () => expect(hourToSlot(6)).toBe(1))
  it('11时 → 上午(1)', () => expect(hourToSlot(11)).toBe(1))
  it('12时 → 下午(2)', () => expect(hourToSlot(12)).toBe(2))
  it('17时 → 下午(2)', () => expect(hourToSlot(17)).toBe(2))
  it('18时 → 晚上(3)', () => expect(hourToSlot(18)).toBe(3))
  it('23时 → 晚上(3)', () => expect(hourToSlot(23)).toBe(3))
})

// ── getHeatLevel ──────────────────────────────────────────────────────────

describe('getHeatLevel', () => {
  it('xp=0 → level 0', () => expect(getHeatLevel(0, 100)).toBe(0))
  it('max=0 → level 0', () => expect(getHeatLevel(0, 0)).toBe(0))
  it('ratio=0.1 → level 1', () => expect(getHeatLevel(10, 100)).toBe(1))
  it('ratio=0.19 → level 1（临界值）', () => expect(getHeatLevel(19, 100)).toBe(1))
  it('ratio=0.2 → level 2', () => expect(getHeatLevel(20, 100)).toBe(2))
  it('ratio=0.44 → level 2', () => expect(getHeatLevel(44, 100)).toBe(2))
  it('ratio=0.45 → level 3', () => expect(getHeatLevel(45, 100)).toBe(3))
  it('ratio=0.74 → level 3', () => expect(getHeatLevel(74, 100)).toBe(3))
  it('ratio=0.75 → level 4', () => expect(getHeatLevel(75, 100)).toBe(4))
  it('ratio=1.0（等于 max）→ level 4', () => expect(getHeatLevel(100, 100)).toBe(4))
})
