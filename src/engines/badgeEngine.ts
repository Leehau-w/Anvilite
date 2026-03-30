import type { Task } from '@/types/task'
import type { Habit } from '@/types/habit'
import type { Area } from '@/types/area'
import { makeAreaBadgeId } from '@/types/badge'
import { getAreaSkillXP, skillXPToLevel, getProsperityLevel } from './prosperityEngine'

export interface BadgeCheckInput {
  tasks: Task[]
  habits: Habit[]
  areas: Area[]
  level: number
  streakDays: number
  unlockedThemeCount: number   // settingsStore 中已解锁主题数
  prestigeLevel?: number       // 转生次数
  earnedIds: Set<string>       // 已获得的徽章ID集合
}

/**
 * 检查当前状态，返回所有新解锁的徽章ID列表。
 * 纯函数，不产生副作用。
 */
export function checkNewBadges(input: BadgeCheckInput): string[] {
  const { tasks, habits, areas, level, streakDays, unlockedThemeCount, prestigeLevel = 0, earnedIds } = input
  const newIds: string[] = []

  function check(id: string, condition: boolean) {
    if (condition && !earnedIds.has(id)) newIds.push(id)
  }

  // ── 统计 ─────────────────────────────────────────────────────────
  const totalDone = tasks.filter((t) => t.status === 'done' && !t.deletedAt).length
  const totalMinutes = tasks.reduce((sum, t) => sum + (t.actualMinutes ?? 0), 0)
  const totalHours = totalMinutes / 60
  const maxHabitStreak = Math.max(0, ...habits.map((h) => h.consecutiveCount))

  // ── 起步 ─────────────────────────────────────────────────────────
  check('start_first_task', totalDone >= 1)

  // ── 等级 ─────────────────────────────────────────────────────────
  check('level_5',   level >= 5)
  check('level_10',  level >= 10)
  check('level_15',  level >= 15)
  check('level_20',  level >= 20)
  check('level_25',  level >= 25)
  check('level_30',  level >= 30)
  check('level_40',  level >= 40)
  check('level_50',  level >= 50)
  check('level_75',  level >= 75)
  check('level_100', level >= 100)

  // ── 坚持 ─────────────────────────────────────────────────────────
  check('streak_7',   streakDays >= 7)
  check('streak_30',  streakDays >= 30)
  check('streak_100', streakDays >= 100)
  check('streak_365', streakDays >= 365)

  // ── 习惯 ─────────────────────────────────────────────────────────
  check('habit_30',  maxHabitStreak >= 30)
  check('habit_100', maxHabitStreak >= 100)
  check('habit_365', maxHabitStreak >= 365)

  // ── 任务量 ───────────────────────────────────────────────────────
  check('tasks_100',  totalDone >= 100)
  check('tasks_500',  totalDone >= 500)
  check('tasks_1000', totalDone >= 1000)

  // ── 投入时长 ─────────────────────────────────────────────────────
  check('hours_100',  totalHours >= 100)
  check('hours_500',  totalHours >= 500)
  check('hours_1000', totalHours >= 1000)

  // ── 收集 ─────────────────────────────────────────────────────────
  check('theme_collect', unlockedThemeCount >= 8)

  // ── 淬火重铸 ──────────────────────────────────────────────────────
  check('prestige_origin', prestigeLevel >= 1)

  // ── 区域繁荣 ─────────────────────────────────────────────────────
  for (const area of areas) {
    if (area.category === '_milestone') continue
    const skillXP = getAreaSkillXP(tasks, area.category)
    const skillLevel = skillXPToLevel(skillXP)
    const prosLevel = getProsperityLevel(skillLevel)
    for (let lvl = 2; lvl <= prosLevel; lvl++) {
      check(makeAreaBadgeId(area.category, lvl), true)
    }
  }

  return newIds
}
