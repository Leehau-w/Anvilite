import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Character } from '@/types/character'
import { getStoragePrefix } from './accountManager'
import { formatDateKey, getTodayString } from '@/utils/time'

interface CharacterStore {
  character: Character
  setName: (name: string) => void
  gainXPAndOre: (xp: number, ore: number) => { leveledUp: boolean; oldLevel: number; newLevel: number; prestigeUnlocked: boolean }
  revokeXP: (xp: number) => void
  spendOre: (amount: number) => boolean   // Legacy purchase API is disabled and returns false.
  setGlobalStatus: (status: Character['globalStatus']) => void
  setTitlePreset: (preset: Character['titlePreset']) => void
  setCustomTitles: (titles: string[]) => void
  recordActivity: () => { oldStreak: number; newStreak: number }
  prestige: () => void
  getTitle: () => string
}

const DEFAULT_CHARACTER: Character = {
  name: '旅行者',
  level: 1,
  currentXP: 0,
  totalXP: 0,
  ore: 0,
  totalOreEarned: 0,
  titlePreset: 'forge',
  customTitles: null,
  streakDays: 0,
  lastActiveDate: null,
  globalStatus: 'active',
  prestigeLevel: 0,
  xpFormulaVersion: 2,
  createdAt: new Date().toISOString(),
}

export const useCharacterStore = create<CharacterStore>()(
  persist(
    (set, get) => ({
      character: DEFAULT_CHARACTER,

      setName: (name) =>
        set((s) => ({ character: { ...s.character, name } })),

      // Kept for legacy callers and backups; rewards no longer change stored balances.
      gainXPAndOre: () => {
        const level = get().character.level
        return { leveledUp: false, oldLevel: level, newLevel: level, prestigeUnlocked: false }
      },
      spendOre: () => false,
      revokeXP: () => {},

      setGlobalStatus: (status) =>
        set((s) => ({ character: { ...s.character, globalStatus: status } })),

      setTitlePreset: () => {},
      setCustomTitles: () => {},

      recordActivity: () => {
        const { character } = get()
        const oldStreak = character.streakDays
        const today = getTodayString()
        if (character.lastActiveDate === today) return { oldStreak, newStreak: oldStreak }

        const yesterday = new Date()
        yesterday.setDate(yesterday.getDate() - 1)
        const yesterdayStr = formatDateKey(yesterday)
        const isConsecutive = character.lastActiveDate === yesterdayStr
        const newStreak = isConsecutive ? character.streakDays + 1 : 1

        set((s) => ({
          character: {
            ...s.character,
            streakDays: newStreak,
            lastActiveDate: today,
          },
        }))
        return { oldStreak, newStreak }
      },

      prestige: () => {},
      getTitle: () => '',
    }),
    {
      name: `${getStoragePrefix()}-character`,
      // Historical reward values are compatibility data, never recalculated on hydration.
    }
  )
)
