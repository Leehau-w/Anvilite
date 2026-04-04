import { describe, it, expect } from 'vitest'
import { checkNewBadges, type BadgeCheckInput } from './badgeEngine'

function makeInput(overrides: Partial<BadgeCheckInput> = {}): BadgeCheckInput {
  return {
    tasks: [],
    habits: [],
    areas: [],
    level: 1,
    streakDays: 0,
    unlockedThemeCount: 1,
    prestigeLevel: 0,
    earnedIds: new Set(),
    ...overrides,
  }
}

function makeTask(overrides: object = {}) {
  return {
    id: 'task1',
    title: '任务',
    category: 'other',
    difficulty: 3 as const,
    priority: 'medium' as const,
    dueDate: null,
    description: '',
    estimatedMinutes: null,
    status: 'done' as const,
    parentId: null,
    childIds: [],
    nestingLevel: 0,
    xpReward: 5,
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

describe('checkNewBadges', () => {
  describe('起步类', () => {
    it('完成第一个任务 → 解锁 start_first_task', () => {
      const input = makeInput({ tasks: [makeTask()] })
      expect(checkNewBadges(input)).toContain('start_first_task')
    })

    it('无完成任务 → 不解锁', () => {
      const input = makeInput({ tasks: [makeTask({ status: 'todo' })] })
      expect(checkNewBadges(input)).not.toContain('start_first_task')
    })
  })

  describe('等级类', () => {
    it('等级 ≥ 5 → 解锁 level_5', () => {
      const input = makeInput({ level: 5 })
      expect(checkNewBadges(input)).toContain('level_5')
    })

    it('等级 < 5 → 不解锁', () => {
      const input = makeInput({ level: 4 })
      expect(checkNewBadges(input)).not.toContain('level_5')
    })

    it('等级 ≥ 10 → 解锁 level_10', () => {
      const input = makeInput({ level: 10 })
      expect(checkNewBadges(input)).toContain('level_10')
    })
  })

  describe('连续天数类', () => {
    it('7天 → 解锁 streak_7', () => {
      const input = makeInput({ streakDays: 7 })
      expect(checkNewBadges(input)).toContain('streak_7')
    })

    it('30天 → 解锁 streak_30', () => {
      const input = makeInput({ streakDays: 30 })
      expect(checkNewBadges(input)).toContain('streak_30')
    })

    it('6天 → 不解锁 streak_7', () => {
      const input = makeInput({ streakDays: 6 })
      expect(checkNewBadges(input)).not.toContain('streak_7')
    })
  })

  describe('主题类', () => {
    it('解锁 ≥ 8 个主题 → 解锁 theme_collect', () => {
      const input = makeInput({ unlockedThemeCount: 8 })
      expect(checkNewBadges(input)).toContain('theme_collect')
    })

    it('解锁 < 8 个主题 → 不解锁', () => {
      const input = makeInput({ unlockedThemeCount: 7 })
      expect(checkNewBadges(input)).not.toContain('theme_collect')
    })
  })

  describe('已获得不重复', () => {
    it('已有的徽章不再出现', () => {
      const input = makeInput({
        tasks: [makeTask()],
        earnedIds: new Set(['start_first_task']),
      })
      expect(checkNewBadges(input)).not.toContain('start_first_task')
    })
  })
})
