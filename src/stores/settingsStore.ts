import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Settings, DashboardCardLayout } from '@/types/settings'

interface SettingsStore {
  settings: Settings
  setTheme: (theme: string) => void
  setLanguage: (lang: 'zh' | 'en') => void
  unlockTheme: (themeId: string) => void
  updateDashboardLayout: (layout: DashboardCardLayout[]) => void
  setCharacterName: (name: string) => void
}

const DEFAULT_LAYOUT: DashboardCardLayout[] = [
  { id: 'tasks', visible: true, order: 0 },
  { id: 'habits', visible: true, order: 1 },
  { id: 'stats', visible: true, order: 2 },
  { id: 'character', visible: true, order: 3 },
  { id: 'quick-create', visible: true, order: 4 },
  { id: 'growth-trend', visible: true, order: 5 },
]

const DEFAULT_SETTINGS: Settings = {
  theme: 'dawn-white',
  language: 'zh',
  dashboardLayout: DEFAULT_LAYOUT,
  unlockedThemes: ['dawn-white'],
  characterName: '旅行者',
}

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      settings: DEFAULT_SETTINGS,

      setTheme: (theme) => {
        document.documentElement.setAttribute('data-theme', theme === 'dawn-white' ? '' : theme)
        set((s) => ({ settings: { ...s.settings, theme } }))
      },

      setLanguage: (language) =>
        set((s) => ({ settings: { ...s.settings, language } })),

      unlockTheme: (themeId) =>
        set((s) => ({
          settings: {
            ...s.settings,
            unlockedThemes: [...new Set([...s.settings.unlockedThemes, themeId])],
          },
        })),

      updateDashboardLayout: (layout) =>
        set((s) => ({ settings: { ...s.settings, dashboardLayout: layout } })),

      setCharacterName: (name) =>
        set((s) => ({ settings: { ...s.settings, characterName: name } })),
    }),
    {
      name: 'anvilite-settings',
      onRehydrateStorage: () => (state) => {
        if (state) {
          const theme = state.settings.theme
          if (theme && theme !== 'dawn-white') {
            document.documentElement.setAttribute('data-theme', theme)
          }
        }
      },
    }
  )
)
