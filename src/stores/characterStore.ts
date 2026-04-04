import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Character } from '@/types/character'
import { getStoragePrefix } from './accountManager'
import { applyXP, getTitle } from '@/engines/levelEngine'
import { calculateTaskXP } from '@/engines/xpEngine'
import { getTodayString } from '@/utils/time'
import { useGrowthEventStore } from './growthEventStore'
import { useTaskStore } from './taskStore'

interface CharacterStore {
  character: Character
  setName: (name: string) => void
  gainXPAndOre: (xp: number, ore: number) => { leveledUp: boolean; oldLevel: number; newLevel: number; prestigeUnlocked: boolean }
  revokeXP: (xp: number) => void
  spendOre: (amount: number) => boolean   // 返回 true=成功, false=矿石不足
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

      gainXPAndOre: (xp, ore) => {
        const { character } = get()
        const oldLevel = character.level
        const { newLevel, newCurrentXP, leveledUp } = applyXP(
          character.level,
          character.currentXP,
          xp
        )
        // 首次达到 Lv.51 且尚未转生
        const prestigeUnlocked = oldLevel < 51 && newLevel >= 51 && (character.prestigeLevel ?? 0) === 0
        set((s) => ({
          character: {
            ...s.character,
            level: newLevel,
            currentXP: newCurrentXP,
            totalXP: s.character.totalXP + xp,
            ore: s.character.ore + ore,
            totalOreEarned: s.character.totalOreEarned + ore,
          },
        }))
        if (leveledUp) {
          useGrowthEventStore.getState().addEvent({
            type: 'level_up',
            title: `升至 Lv.${newLevel}`,
            details: { oldLevel, newLevel },
            isMilestone: newLevel % 10 === 0,
          })
        }
        return { leveledUp, oldLevel, newLevel, prestigeUnlocked }
      },

      spendOre: (amount) => {
        const { character } = get()
        if (character.ore < amount) return false
        set((s) => ({ character: { ...s.character, ore: s.character.ore - amount } }))
        return true
      },

      revokeXP: (xp) => {
        const { character } = get()
        const { newLevel, newCurrentXP } = applyXP(
          character.level,
          character.currentXP,
          -xp
        )
        set((s) => ({
          character: {
            ...s.character,
            level: newLevel,
            currentXP: newCurrentXP,
            totalXP: Math.max(0, s.character.totalXP - xp),
            // 矿石不收回
          },
        }))
      },

      setGlobalStatus: (status) =>
        set((s) => ({ character: { ...s.character, globalStatus: status } })),

      setTitlePreset: (preset) =>
        set((s) => ({ character: { ...s.character, titlePreset: preset } })),

      setCustomTitles: (titles) =>
        set((s) => ({ character: { ...s.character, customTitles: titles } })),

      recordActivity: () => {
        const { character } = get()
        const oldStreak = character.streakDays
        const today = getTodayString()
        if (character.lastActiveDate === today) return { oldStreak, newStreak: oldStreak }

        const yesterday = new Date()
        yesterday.setDate(yesterday.getDate() - 1)
        const yesterdayStr = yesterday.toISOString().split('T')[0]
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

      prestige: () => {
        const newPrestigeLevel = (get().character.prestigeLevel ?? 0) + 1
        set((s) => ({
          character: {
            ...s.character,
            level: 1,
            currentXP: 0,
            prestigeLevel: newPrestigeLevel,
          },
        }))
        useGrowthEventStore.getState().addEvent({
          type: 'prestige',
          title: `淬火重铸 ×${newPrestigeLevel}`,
          details: {},
          isMilestone: true,
        })
      },

      getTitle: () => {
        const { character } = get()
        return getTitle(character.level, character.titlePreset, character.customTitles)
      },
    }),
    {
      name: `${getStoragePrefix()}-character`,
      onRehydrateStorage: () => (state) => {
        if (!state) return
        // 填充新字段默认值
        if (state.character.xpFormulaVersion === undefined) {
          state.character.xpFormulaVersion = 0
        }
        // 追溯重算：v2 乘法公式上线，重算所有已完成任务的 XP
        if ((state.character.xpFormulaVersion ?? 0) < 2) {
          const tasks = useTaskStore.getState().tasks
          const doneTasks = tasks.filter((t) => t.status === 'done' && !t.deletedAt && !t.parentId)
          let totalXP = 0
          doneTasks.forEach((task) => {
            const { xp } = calculateTaskXP(task, 0) // 历史记录无 streakDays，用 0
            totalXP += xp
          })
          // 用重算后的 XP 重置等级
          let lvl = 1, curXP = totalXP
          while (true) {
            const needed = Math.round(5 * Math.log(lvl + 1) * lvl)
            if (curXP < needed) break
            curXP -= needed
            lvl++
          }
          state.character.level = lvl
          state.character.currentXP = curXP
          state.character.totalXP = totalXP
          state.character.xpFormulaVersion = 2
        }
      },
    }
  )
)
