export interface Character {
  name: string
  level: number
  currentXP: number
  totalXP: number
  ore: number
  totalOreEarned: number
  titlePreset: 'forge' | 'rpg' | 'custom'
  customTitles: string[] | null
  streakDays: number
  lastActiveDate: string | null
  globalStatus: 'active' | 'charging' | 'resting' | 'traveling' | 'returning'
  prestigeLevel: number   // 淬火重铸次数，默认0
  xpFormulaVersion: number  // XP公式版本，用于追溯重算（当前=2）
  createdAt: string
}

export type GlobalStatus = Character['globalStatus']
export type TitlePreset = Character['titlePreset']
