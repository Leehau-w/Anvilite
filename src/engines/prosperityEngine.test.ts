import { describe, it, expect } from 'vitest'
import { skillXPToLevel, getProsperityLevel, getProsperityInfo } from './prosperityEngine'

describe('skillXPToLevel', () => {
  it('0 XP → 技能等级 0', () => {
    expect(skillXPToLevel(0)).toBe(0)
  })

  it('负数 XP → 技能等级 0', () => {
    expect(skillXPToLevel(-1)).toBe(0)
  })

  it('积累足够XP达到等级 1', () => {
    // xpToNextLevel(1) = round(5 × ln(2) × 1) = 3
    expect(skillXPToLevel(3)).toBeGreaterThanOrEqual(1)
  })

  it('XP越多等级越高', () => {
    expect(skillXPToLevel(100)).toBeGreaterThan(skillXPToLevel(50))
  })
})

describe('getProsperityLevel', () => {
  it('技能等级 0 → 荒芜 (1)', () => expect(getProsperityLevel(0)).toBe(1))
  it('技能等级 1 → 聚落 (2)', () => expect(getProsperityLevel(1)).toBe(2))
  it('技能等级 3 → 聚落 (2)', () => expect(getProsperityLevel(3)).toBe(2))
  it('技能等级 4 → 丰饶 (3)', () => expect(getProsperityLevel(4)).toBe(3))
  it('技能等级 8 → 丰饶 (3)', () => expect(getProsperityLevel(8)).toBe(3))
  it('技能等级 9 → 繁荣 (4)', () => expect(getProsperityLevel(9)).toBe(4))
  it('技能等级 15 → 繁荣 (4)', () => expect(getProsperityLevel(15)).toBe(4))
  it('技能等级 16 → 鼎盛 (5)', () => expect(getProsperityLevel(16)).toBe(5))
  it('技能等级 25 → 鼎盛 (5)', () => expect(getProsperityLevel(25)).toBe(5))
  it('技能等级 26 → 辉煌 (6)', () => expect(getProsperityLevel(26)).toBe(6))
  it('技能等级 100 → 辉煌 (6)', () => expect(getProsperityLevel(100)).toBe(6))
})

describe('getProsperityInfo', () => {
  it('0 XP → 荒芜', () => {
    const info = getProsperityInfo(0)
    expect(info.prosperityLevel).toBe(1)
    expect(info.skillLevel).toBe(0)
  })

  it('返回结构完整', () => {
    const info = getProsperityInfo(50)
    expect(typeof info.skillLevel).toBe('number')
    expect(typeof info.prosperityLevel).toBe('number')
    expect(typeof info.subLevelFraction).toBe('number')
    expect(info.subLevelFraction).toBeGreaterThanOrEqual(0)
    expect(info.subLevelFraction).toBeLessThanOrEqual(1)
  })
})
