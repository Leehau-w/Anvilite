import { describe, it, expect } from 'vitest'
import { BASE_XP, getStreakBonusRate, calculateTaskXP, calculateHabitXP } from './xpEngine'
import type { Task } from '@/types/task'

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'test',
    title: '测试任务',
    category: 'other',
    difficulty: 3,
    priority: 'medium',
    dueDate: null,
    description: '',
    estimatedMinutes: null,
    status: 'done',
    parentId: null,
    childIds: [],
    nestingLevel: 0,
    xpReward: 0,
    actualMinutes: 0,
    completedAt: null,
    deletedAt: null,
    isHidden: false,
    sortOrder: 0,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

describe('BASE_XP 常量', () => {
  it('难度1 → 基础XP = 1', () => expect(BASE_XP[1]).toBe(1))
  it('难度2 → 基础XP = 2', () => expect(BASE_XP[2]).toBe(2))
  it('难度3 → 基础XP = 3', () => expect(BASE_XP[3]).toBe(3))
  it('难度4 → 基础XP = 5', () => expect(BASE_XP[4]).toBe(5))
  it('难度5 → 基础XP = 8', () => expect(BASE_XP[5]).toBe(8))
})

describe('getStreakBonusRate', () => {
  it('0天 → 0%', () => expect(getStreakBonusRate(0)).toBe(0))
  it('2天 → 0%', () => expect(getStreakBonusRate(2)).toBe(0))
  it('3天 → 10%', () => expect(getStreakBonusRate(3)).toBe(0.10))
  it('6天 → 10%', () => expect(getStreakBonusRate(6)).toBe(0.10))
  it('7天 → 20%', () => expect(getStreakBonusRate(7)).toBe(0.20))
  it('13天 → 20%', () => expect(getStreakBonusRate(13)).toBe(0.20))
  it('14天 → 30%', () => expect(getStreakBonusRate(14)).toBe(0.30))
  it('29天 → 30%', () => expect(getStreakBonusRate(29)).toBe(0.30))
  it('30天 → 50%', () => expect(getStreakBonusRate(30)).toBe(0.50))
  it('100天 → 50%（上限）', () => expect(getStreakBonusRate(100)).toBe(0.50))
})

describe('calculateTaskXP', () => {
  it('难度1 + 0天连续 + 无截止日 → 1 XP', () => {
    const { xp, ore } = calculateTaskXP(makeTask({ difficulty: 1 }), 0)
    expect(xp).toBe(1)
    expect(ore).toBe(1)
  })

  it('难度3 + 0天连续 + 无截止日 → 3 XP', () => {
    expect(calculateTaskXP(makeTask({ difficulty: 3 }), 0).xp).toBe(3)
  })

  it('高难度加成：难度4 + 0天连续 + 无截止日 → round(5 × 1.5) = 8', () => {
    expect(calculateTaskXP(makeTask({ difficulty: 4 }), 0).xp).toBe(8)
  })

  it('高难度加成：难度5 + 0天连续 + 无截止日 → round(8 × 1.5) = 12', () => {
    expect(calculateTaskXP(makeTask({ difficulty: 5 }), 0).xp).toBe(12)
  })

  it('按时完成：有未来截止日 → ×1.2', () => {
    const task = makeTask({ difficulty: 3, dueDate: '2099-12-31' })
    expect(calculateTaskXP(task, 0).xp).toBe(Math.round(3 * 1.2))
  })

  it('过期任务：无按时加成', () => {
    const task = makeTask({ difficulty: 3, dueDate: '2020-01-01' })
    expect(calculateTaskXP(task, 0).xp).toBe(3)
  })

  it('无截止日视为未按时 → 不加 20%', () => {
    const task = makeTask({ difficulty: 3, dueDate: null })
    expect(calculateTaskXP(task, 0).xp).toBe(3)
  })

  it('难度5 + 7天连续 + 按时完成 → 乘法公式', () => {
    const task = makeTask({ difficulty: 5, dueDate: '2099-12-31' })
    // v2 乘法: round(8 × 1.5_diff × 1.2_ontime × 1.2_streak) = round(17.28) = 17
    const expected = Math.round(8 * 1.5 * 1.2 * 1.2)
    expect(calculateTaskXP(task, 7).xp).toBe(expected)
  })

  it('矿石 = XP', () => {
    const { xp, ore } = calculateTaskXP(makeTask({ difficulty: 3 }), 5)
    expect(ore).toBe(xp)
  })
})

describe('calculateHabitXP', () => {
  it('每日习惯频率折算系数 0.5', () => {
    const { xp } = calculateHabitXP(2, 0, 'daily')
    expect(xp).toBe(Math.round(2 * 0.5))
  })

  it('工作日习惯频率折算系数 0.5', () => {
    const { xp } = calculateHabitXP(2, 0, 'weekdays')
    expect(xp).toBe(Math.round(2 * 0.5))
  })

  it('每周习惯不折算', () => {
    const { xp } = calculateHabitXP(2, 0, 'weekly')
    expect(xp).toBe(2)
  })

  it('连续加成应用于习惯', () => {
    // difficulty=3, weekly, 7天连续 → round(3 × 1.0 × 1.2) = 4
    const { xp } = calculateHabitXP(3, 7, 'weekly')
    expect(xp).toBe(Math.round(3 * 1.0 * 1.2))
  })
})
