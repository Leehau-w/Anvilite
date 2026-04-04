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
 * 计算任务完成后获得的 XP（v2 乘法公式）
 * 最终XP = round( base × 按时系数 × 连续系数 × 高难系数 )
 * 矿石 = 最终XP（1:1）
 */
export function calculateTaskXP(task: Task, streakDays: number): { xp: number; ore: number } {
  const base = BASE_XP[task.difficulty]

  // 按时完成系数 ×1.2，无截止日或已过期 ×1.0
  const onTime = task.dueDate
    ? task.dueDate >= new Date().toISOString().split('T')[0]
    : false
  const onTimeMultiplier = onTime ? 1.2 : 1.0

  // 连续阶梯系数
  const streakMultiplier = 1 + getStreakBonusRate(streakDays)

  // 高难度系数 ×1.5（难度4-5）
  const difficultyMultiplier = task.difficulty >= 4 ? 1.5 : 1.0

  const xp = Math.round(base * onTimeMultiplier * streakMultiplier * difficultyMultiplier)
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
