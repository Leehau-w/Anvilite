/**
 * 升级所需XP = round(5 × ln(level + 1) × level)
 * level: 当前等级（从1开始）
 */
export function xpToNextLevel(level: number): number {
  return Math.round(5 * Math.log(level + 1) * level)
}

/**
 * 根据新增XP计算等级变化
 * 返回: { newLevel, newCurrentXP, leveledUp }
 */
export function applyXP(
  currentLevel: number,
  currentXP: number,
  xpGained: number
): { newLevel: number; newCurrentXP: number; leveledUp: boolean; newLevelTitle?: string } {
  let level = currentLevel
  let xp = currentXP + xpGained
  let leveledUp = false

  // 升级循环
  while (xp >= xpToNextLevel(level)) {
    xp -= xpToNextLevel(level)
    level++
    leveledUp = true
  }

  // 降级处理（xp为负时）
  while (xp < 0 && level > 1) {
    level--
    xp += xpToNextLevel(level)
  }
  if (level === 1 && xp < 0) xp = 0

  return { newLevel: level, newCurrentXP: xp, leveledUp }
}

/**
 * 根据等级和称号预设返回当前称号
 */
const FORGE_TITLES = ['破壳', '熔炼', '锤炼', '锋芒', '极意', '铸魂', '锻石', '不朽'] as const
const RPG_TITLES = ['新手', '学徒', '冒险者', '游侠', '英雄', '大师', '史诗', '传奇'] as const

const TITLE_THRESHOLDS = [1, 6, 11, 16, 21, 31, 41, 51] as const

function getTitleIndex(level: number): number {
  for (let i = TITLE_THRESHOLDS.length - 1; i >= 0; i--) {
    if (level >= TITLE_THRESHOLDS[i]) return i
  }
  return 0
}

export function getTitle(
  level: number,
  preset: 'forge' | 'rpg' | 'custom',
  customTitles?: string[] | null
): string {
  const idx = getTitleIndex(level)
  if (preset === 'forge') return FORGE_TITLES[idx]
  if (preset === 'rpg') return RPG_TITLES[idx]
  if (preset === 'custom' && customTitles && customTitles[idx]) return customTitles[idx]
  return FORGE_TITLES[idx]
}

export function getXPProgress(currentXP: number, level: number): number {
  const needed = xpToNextLevel(level)
  return needed > 0 ? Math.min(currentXP / needed, 1) : 0
}
