import type { Task } from '@/types/task'

/** 基础XP: 难度1→1, 2→2, 3→3, 4→5, 5→8 */
export const BASE_XP = [0, 1, 2, 3, 5, 8] as const

/** 阶梯式连续天数加成率（任务与习惯共用） */
export function getStreakBonusRate(streakDays: number): number {
  if (streakDays >= 30) return 0.50
  if (streakDays >= 14) return 0.30
  if (streakDays >= 7)  return 0.20
  if (streakDays >= 3)  return 0.10
  return 0
}

/**
 * 计算任务完成后获得的 XP
 * 最终XP = round( 基础XP × (1 + 按时加成% + 连续加成% + 高难加成%) )
 * 矿石 = 最终XP（1:1）
 */
export function calculateTaskXP(task: Task, streakDays: number): { xp: number; ore: number } {
  const base = BASE_XP[task.difficulty]
  let bonusRate = 0

  // 按时完成加成 +20%
  if (task.dueDate) {
    const today = new Date().toISOString().split('T')[0]
    if (task.dueDate >= today) bonusRate += 0.20
  }

  // 连续阶梯加成
  bonusRate += getStreakBonusRate(streakDays)

  // 高难度加成 +50%
  if (task.difficulty >= 4) bonusRate += 0.50

  const xp = Math.round(base * (1 + bonusRate))
  return { xp, ore: xp }
}

/**
 * 计算习惯完成后获得的 XP
 * 最终XP = round( 基础XP × 频率折算系数 × (1 + 连续加成%) )
 * 频率折算：daily/weekdays → 0.5，其余 → 1.0
 */
export function calculateHabitXP(
  difficulty: 1 | 2 | 3 | 4 | 5,
  consecutiveCount: number,
  repeatType?: string
): { xp: number; ore: number } {
  const base = BASE_XP[difficulty]
  const freqCoeff = (repeatType === 'daily' || repeatType === 'weekdays') ? 0.5 : 1.0
  const streakRate = getStreakBonusRate(consecutiveCount)
  const xp = Math.round(base * freqCoeff * (1 + streakRate))
  return { xp, ore: xp }
}
