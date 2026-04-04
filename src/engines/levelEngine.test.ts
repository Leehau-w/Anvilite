import { describe, it, expect } from 'vitest'
import { xpToNextLevel, applyXP, getTitle } from './levelEngine'

describe('xpToNextLevel', () => {
  it('Lv.1 → round(5 × ln(2) × 1) = 3', () => {
    expect(xpToNextLevel(1)).toBe(Math.round(5 * Math.log(2) * 1))
  })

  it('Lv.5 → 正确值', () => {
    expect(xpToNextLevel(5)).toBe(Math.round(5 * Math.log(6) * 5))
  })

  it('等级越高所需XP越多', () => {
    expect(xpToNextLevel(10)).toBeGreaterThan(xpToNextLevel(5))
    expect(xpToNextLevel(20)).toBeGreaterThan(xpToNextLevel(10))
  })

  it('Lv.1 ≈ 3 XP', () => {
    expect(xpToNextLevel(1)).toBeGreaterThan(0)
  })
})

describe('applyXP 升级', () => {
  it('0 XP → Lv.1 不变', () => {
    const { newLevel, leveledUp } = applyXP(1, 0, 0)
    expect(newLevel).toBe(1)
    expect(leveledUp).toBe(false)
  })

  it('获得足够XP触发升级', () => {
    const needed = xpToNextLevel(1)
    const { newLevel, leveledUp } = applyXP(1, 0, needed)
    expect(newLevel).toBe(2)
    expect(leveledUp).toBe(true)
  })

  it('差1 XP不升级', () => {
    const needed = xpToNextLevel(1)
    const { newLevel, leveledUp } = applyXP(1, 0, needed - 1)
    expect(newLevel).toBe(1)
    expect(leveledUp).toBe(false)
  })

  it('一次获得大量XP可多级跳升', () => {
    const { newLevel } = applyXP(1, 0, 1000)
    expect(newLevel).toBeGreaterThan(5)
  })

  it('XP降为负时触发降级', () => {
    // Lv.3, currentXP=0, revokeXP → 应降到 Lv.2
    const { newLevel } = applyXP(3, 0, -1)
    expect(newLevel).toBe(2)
  })

  it('Lv.1 时XP不低于0', () => {
    const { newLevel, newCurrentXP } = applyXP(1, 0, -100)
    expect(newLevel).toBe(1)
    expect(newCurrentXP).toBe(0)
  })
})

describe('getTitle', () => {
  it('Lv.1 → 锻造系：破壳', () => {
    expect(getTitle(1, 'forge')).toBe('破壳')
  })

  it('Lv.6 → 锻造系：熔炼', () => {
    expect(getTitle(6, 'forge')).toBe('熔炼')
  })

  it('Lv.51 → 锻造系：不朽', () => {
    expect(getTitle(51, 'forge')).toBe('不朽')
  })

  it('Lv.1 → RPG系：新手', () => {
    expect(getTitle(1, 'rpg')).toBe('新手')
  })

  it('Lv.6 → RPG系：学徒', () => {
    expect(getTitle(6, 'rpg')).toBe('学徒')
  })

  it('Lv.51 → RPG系：传奇', () => {
    expect(getTitle(51, 'rpg')).toBe('传奇')
  })

  it('Lv.50 还不是最高称号', () => {
    expect(getTitle(50, 'forge')).toBe('锻石')
  })
})
