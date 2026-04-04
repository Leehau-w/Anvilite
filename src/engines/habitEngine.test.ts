import { describe, it, expect } from 'vitest'
import { calculateNewStreak, calculateToleranceUpdate } from './habitEngine'
import type { Habit } from '@/types/habit'

function makeHabit(overrides: Partial<Habit> = {}): Habit {
  return {
    id: 'h1',
    title: '测试习惯',
    description: '',
    category: 'other',
    difficulty: 3,
    repeatType: 'daily',
    weeklyMode: undefined,
    weeklyDays: undefined,
    weeklyFlexibleCount: undefined,
    monthlyDays: [],
    customIntervalDays: undefined,
    startDate: '2026-01-01',
    endDate: undefined,
    targetCount: 1,
    status: 'active',
    isHidden: false,
    deletedAt: null,
    timerStartedAt: null,
    actualMinutes: 0,
    consecutiveCount: 0,
    totalCompletions: 0,
    toleranceCharges: 0,
    toleranceNextAt: 0,
    weeklyCompletionCount: 0,
    currentCycleCount: 0,
    lastCompletedAt: null,
    lastDueAt: null,
    parentId: null,
    childIds: [],
    nestingLevel: 0,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

describe('calculateNewStreak', () => {
  it('complete → consecutiveCount + 1', () => {
    const habit = makeHabit({ consecutiveCount: 5 })
    expect(calculateNewStreak(habit, 'complete')).toBe(6)
  })

  it('skip → 扣除10% 下取整', () => {
    const habit = makeHabit({ consecutiveCount: 10 })
    // 扣 max(1, floor(10 * 0.1)) = 1 → 9
    expect(calculateNewStreak(habit, 'skip')).toBe(9)
  })

  it('skip → 最少扣1', () => {
    const habit = makeHabit({ consecutiveCount: 5 })
    // max(1, floor(5 * 0.1)) = max(1, 0) = 1 → 4
    expect(calculateNewStreak(habit, 'skip')).toBe(4)
  })

  it('skip → 0 保持0', () => {
    const habit = makeHabit({ consecutiveCount: 0 })
    expect(calculateNewStreak(habit, 'skip')).toBe(0)
  })

  it('miss 无容错 → 减半', () => {
    const habit = makeHabit({ consecutiveCount: 10, toleranceCharges: 0 })
    expect(calculateNewStreak(habit, 'miss')).toBe(5)
  })

  it('miss 有容错 → 不变', () => {
    const habit = makeHabit({ consecutiveCount: 10, toleranceCharges: 1 })
    expect(calculateNewStreak(habit, 'miss')).toBe(10)
  })

  it('miss 减半最小为0', () => {
    const habit = makeHabit({ consecutiveCount: 1, toleranceCharges: 0 })
    expect(calculateNewStreak(habit, 'miss')).toBe(0)
  })
})

describe('calculateToleranceUpdate', () => {
  it('首次达到7连续 → 获得容错充能', () => {
    const habit = makeHabit({ consecutiveCount: 6, toleranceCharges: 0, toleranceNextAt: 7 })
    const { charges } = calculateToleranceUpdate(habit, 'complete')
    expect(charges).toBe(1)
  })

  it('连续未到阈值 → 不获得充能', () => {
    const habit = makeHabit({ consecutiveCount: 3, toleranceCharges: 0, toleranceNextAt: 7 })
    const { charges } = calculateToleranceUpdate(habit, 'complete')
    expect(charges).toBe(0)
  })

  it('充能上限为1', () => {
    const habit = makeHabit({ consecutiveCount: 6, toleranceCharges: 1, toleranceNextAt: 7 })
    const { charges } = calculateToleranceUpdate(habit, 'complete')
    expect(charges).toBe(1) // 不超过1
  })

  it('miss 消耗容错', () => {
    const habit = makeHabit({ consecutiveCount: 10, toleranceCharges: 1, toleranceNextAt: 20 })
    const { charges } = calculateToleranceUpdate(habit, 'miss')
    expect(charges).toBe(0)
  })

  it('miss 无容错不变', () => {
    const habit = makeHabit({ consecutiveCount: 10, toleranceCharges: 0, toleranceNextAt: 7 })
    const { charges } = calculateToleranceUpdate(habit, 'miss')
    expect(charges).toBe(0)
  })
})
