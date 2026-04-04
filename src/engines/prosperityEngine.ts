import { xpToNextLevel } from './levelEngine'
import type { Task } from '@/types/task'
import { PROSPERITY_NAMES } from '@/types/area'

/** 计算区域的技能XP（该分类所有已完成任务的XP之和） */
export function getAreaSkillXP(tasks: Task[], category: string): number {
  return tasks
    .filter((t) => t.category === category && t.status === 'done' && !t.deletedAt)
    .reduce((sum, t) => sum + (t.xpReward ?? 0), 0)
}

/** 将累计XP换算为技能等级（0开始） */
export function skillXPToLevel(totalXP: number): number {
  if (totalXP <= 0) return 0
  let level = 1
  let remaining = totalXP
  while (remaining >= xpToNextLevel(level)) {
    remaining -= xpToNextLevel(level)
    level++
    if (level > 200) break
  }
  return level - 1
}

/** 技能等级 → 繁荣等级（1-6） */
export function getProsperityLevel(skillLevel: number): number {
  if (skillLevel === 0) return 1
  if (skillLevel <= 3) return 2
  if (skillLevel <= 8) return 3
  if (skillLevel <= 15) return 4
  if (skillLevel <= 25) return 5
  return 6
}

export interface ProsperityInfo {
  skillLevel: number
  prosperityLevel: number   // 1-6
  prosperityName: string
  subLevelCurrent: number   // 在当前技能等级内已积累XP
  subLevelTotal: number     // 升级到下一技能等级所需XP
  subLevelFraction: number  // 0-1
  totalSkillXP: number
}

/** 完整繁荣信息 */
export function getProsperityInfo(totalXP: number): ProsperityInfo {
  const skillLevel = skillXPToLevel(totalXP)
  const prosperityLevel = getProsperityLevel(skillLevel)
  const prosperityName = PROSPERITY_NAMES[prosperityLevel - 1]

  // 计算当前技能等级内的进度
  let accumulated = 0
  for (let l = 1; l <= skillLevel; l++) {
    accumulated += xpToNextLevel(l)
  }
  const subLevelCurrent = totalXP - accumulated
  const subLevelTotal = xpToNextLevel(skillLevel + 1)
  const subLevelFraction = subLevelTotal > 0 ? Math.min(1, subLevelCurrent / subLevelTotal) : 1

  return {
    skillLevel,
    prosperityLevel,
    prosperityName,
    subLevelCurrent,
    subLevelTotal,
    subLevelFraction,
    totalSkillXP: totalXP,
  }
}
