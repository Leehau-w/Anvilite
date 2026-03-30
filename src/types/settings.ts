export interface DashboardCardLayout {
  id: string
  visible: boolean
  order: number
  size?: 'small' | 'medium' | 'large'
}

export interface Settings {
  theme: string
  language: 'zh' | 'en'
  dashboardLayout: DashboardCardLayout[]
  unlockedThemes: string[]
  characterName: string
}

export const THEMES = [
  { id: 'dawn-white', name: '晨光白', dark: false },
  { id: 'mint-paper', name: '薄荷纸', dark: false },
  { id: 'parchment', name: '羊皮卷', dark: false },
  { id: 'slate-cloud', name: '云石灰', dark: false },
  { id: 'forge-purple', name: '锻铁紫', dark: true },
  { id: 'ore-cyan', name: '矿石青', dark: true },
  { id: 'flame-cast', name: '烈焰铸', dark: true },
  { id: 'jade-forest', name: '翠林绿', dark: true },
] as const

export type ThemeId = typeof THEMES[number]['id']
