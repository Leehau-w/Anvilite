import { useCharacterStore } from '@/stores/characterStore'
import { useTaskStore } from '@/stores/taskStore'
import { useHabitStore } from '@/stores/habitStore'
import { useAreaStore } from '@/stores/areaStore'
import { useBadgeStore } from '@/stores/badgeStore'
import { useDashboardStore } from '@/stores/dashboardStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { useGrowthEventStore } from '@/stores/growthEventStore'
import { getCurrentAccountId, getStoragePrefix } from '@/stores/accountManager'

export const EXPORT_VERSION = 1
export const APP_VERSION = '0.2.0'

export interface ExportData {
  exportVersion: typeof EXPORT_VERSION
  appVersion: string
  exportedAt: string
  accountId: string
  data: {
    character: ReturnType<typeof useCharacterStore.getState>
    tasks: ReturnType<typeof useTaskStore.getState>
    habits: ReturnType<typeof useHabitStore.getState>
    areas: ReturnType<typeof useAreaStore.getState>
    badges: ReturnType<typeof useBadgeStore.getState>
    dashboard: ReturnType<typeof useDashboardStore.getState>
    settings: ReturnType<typeof useSettingsStore.getState>
    growthEvents: ReturnType<typeof useGrowthEventStore.getState>
  }
}

export async function exportData(): Promise<void> {
  const payload: ExportData = {
    exportVersion: EXPORT_VERSION,
    appVersion: APP_VERSION,
    exportedAt: new Date().toISOString(),
    accountId: getCurrentAccountId(),
    data: {
      character: useCharacterStore.getState(),
      tasks: useTaskStore.getState(),
      habits: useHabitStore.getState(),
      areas: useAreaStore.getState(),
      badges: useBadgeStore.getState(),
      dashboard: useDashboardStore.getState(),
      settings: useSettingsStore.getState(),
      growthEvents: useGrowthEventStore.getState(),
    },
  }

  const json = JSON.stringify(payload, null, 2)
  const filename = `anvilite-backup-${new Date().toISOString().slice(0, 10)}.json`

  // Electron: 使用系统保存对话框
  if (window.electronAPI?.saveFile) {
    await window.electronAPI.saveFile(json, filename)
    return
  }

  // 降级：浏览器下载
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export async function importData(file: File): Promise<{ success: boolean; error?: string }> {
  try {
    const text = await file.text()
    const data = JSON.parse(text) as ExportData

    if (!data.exportVersion || !data.data) {
      return { success: false, error: 'invalid_format' }
    }
    if (data.exportVersion > EXPORT_VERSION) {
      return { success: false, error: 'version_too_new' }
    }

    const requiredKeys = ['character', 'tasks', 'habits', 'areas', 'badges', 'dashboard', 'settings', 'growthEvents'] as const
    for (const key of requiredKeys) {
      if (!(key in data.data)) {
        return { success: false, error: `missing_key:${key}` }
      }
    }

    // 写入 localStorage，然后 reload
    const prefix = getStoragePrefix()
    const storeKeyMap: Record<string, string> = {
      character: 'character',
      tasks: 'tasks',
      habits: 'habits',
      areas: 'areas',
      badges: 'badges',
      dashboard: 'dashboard',
      settings: 'settings',
      growthEvents: 'growth-events',
    }

    for (const [dataKey, storeSuffix] of Object.entries(storeKeyMap)) {
      const value = data.data[dataKey as keyof typeof data.data]
      if (value !== undefined) {
        localStorage.setItem(`${prefix}-${storeSuffix}`, JSON.stringify({ state: value, version: 0 }))
      }
    }

    window.location.reload()
    return { success: true }
  } catch {
    return { success: false, error: 'parse_error' }
  }
}
