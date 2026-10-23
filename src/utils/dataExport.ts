import { useCharacterStore } from '@/stores/characterStore'
import { useTaskStore } from '@/stores/taskStore'
import { useHabitStore } from '@/stores/habitStore'
import { useAreaStore } from '@/stores/areaStore'
import { useBadgeStore } from '@/stores/badgeStore'
import { useDashboardStore } from '@/stores/dashboardStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { useGrowthEventStore } from '@/stores/growthEventStore'
import { useSOPStore } from '@/stores/sopStore'
import { useInspirationStore } from '@/stores/inspirationStore'
import { assertAccountBindingCurrent, getBoundAccountId, getStoragePrefix, isAccountBindingCurrent } from '@/stores/accountManager'
import { validateBackupRecords } from './backupValidation'

export const EXPORT_VERSION = 1
declare const __APP_VERSION__: string
export const APP_VERSION: string = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '0.0.0'

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
    // v0.3 新增（旧备份中可能不存在，导入时做兼容）
    sops?: ReturnType<typeof useSOPStore.getState>
    inspirations?: ReturnType<typeof useInspirationStore.getState>
  }
}

export function buildExportPayload(): ExportData {
  assertAccountBindingCurrent()
  return {
    exportVersion: EXPORT_VERSION,
    appVersion: APP_VERSION,
    exportedAt: new Date().toISOString(),
    accountId: getBoundAccountId(),
    data: {
      character: useCharacterStore.getState(),
      tasks: useTaskStore.getState(),
      habits: useHabitStore.getState(),
      areas: useAreaStore.getState(),
      badges: useBadgeStore.getState(),
      dashboard: useDashboardStore.getState(),
      settings: useSettingsStore.getState(),
      growthEvents: useGrowthEventStore.getState(),
      sops: useSOPStore.getState(),
      inspirations: useInspirationStore.getState(),
    },
  }
}

export function serializeExportData(payload = buildExportPayload()): string {
  assertAccountBindingCurrent()
  return JSON.stringify(payload, null, 2)
}

export async function exportData(): Promise<{ success: boolean; canceled?: boolean; error?: string }> {
  if (!isAccountBindingCurrent()) return { success: false, error: 'account_changed' }
  try {
    const payload = buildExportPayload()
    const json = serializeExportData(payload)
    const filename = `anvilite-backup-${new Date().toISOString().slice(0, 10)}.json`

    if (window.electronAPI?.saveFile) {
      const result = await window.electronAPI.saveFile(json, filename)
      if (!isAccountBindingCurrent()) return { success: false, error: 'account_changed' }
      if (!result.success) return { success: false, canceled: result.canceled,
        error: result.error ?? (result.canceled ? 'canceled' : 'write_failed') }
      return { success: true }
    }

    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    try {
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      a.click()
    } finally { URL.revokeObjectURL(url) }
    return { success: true }
  } catch {
    return { success: false, error: isAccountBindingCurrent() ? 'write_failed' : 'account_changed' }
  }
}

/**
 * MED-09: Validate that each store slice is a non-null object with expected sub-keys.
 * Returns an error string if validation fails, or null if OK.
 */
export function validateStoreSlices(data: Record<string, unknown>): string | null {
  const expectedShape: Record<string, string[]> = {
    character: ['character'],
    tasks: ['tasks'],
    habits: ['habits'],
    areas: ['areas'],
    badges: ['earnedIds'],
    dashboard: [],
    settings: ['settings'],
    growthEvents: ['events'],
  }

  for (const [key, requiredSubKeys] of Object.entries(expectedShape)) {
    const value = data[key]
    if (value === null || value === undefined || typeof value !== 'object' || Array.isArray(value)) {
      return `invalid_value:${key}`
    }
    for (const sub of requiredSubKeys) {
      if (!(sub in (value as Record<string, unknown>))) {
        return `missing_subkey:${key}.${sub}`
      }
    }
  }

  // Validate critical field types
  const char = (data.character as Record<string, unknown>)?.character
  if (char && typeof char === 'object') {
    const c = char as Record<string, unknown>
    if (typeof c.level !== 'number' || typeof c.totalXP !== 'number') {
      return 'invalid_type:character.level_or_totalXP'
    }
  }
  const tasksSlice = (data.tasks as Record<string, unknown>)?.tasks
  if (tasksSlice !== undefined && !Array.isArray(tasksSlice)) {
    return 'invalid_type:tasks.tasks_not_array'
  }
  const habitsSlice = (data.habits as Record<string, unknown>)?.habits
  if (habitsSlice !== undefined && !Array.isArray(habitsSlice)) {
    return 'invalid_type:habits.habits_not_array'
  }
  const eventsSlice = (data.growthEvents as Record<string, unknown>)?.events
  if (eventsSlice !== undefined && !Array.isArray(eventsSlice)) {
    return 'invalid_type:growthEvents.events_not_array'
  }

  return validateBackupRecords(data)
}

function validateImportPayload(data: ExportData): { success: boolean; error?: string } {
  if (!data || typeof data !== 'object' || !Number.isInteger(data.exportVersion) || data.exportVersion < 1 ||
      !data.data || typeof data.data !== 'object' || Array.isArray(data.data)) {
    return { success: false, error: 'invalid_format' }
  }
  if (typeof data.appVersion !== 'string' || typeof data.accountId !== 'string' ||
      typeof data.exportedAt !== 'string' || !Number.isFinite(new Date(data.exportedAt).getTime())) {
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

  const schemaError = validateStoreSlices(data.data as unknown as Record<string, unknown>)
  if (schemaError) {
    return { success: false, error: schemaError }
  }

  return { success: true }
}

export function applyImportPayload(data: ExportData): { success: boolean; error?: string } {
  if (!isAccountBindingCurrent()) return { success: false, error: 'account_changed' }
  const validation = validateImportPayload(data)
  if (!validation.success) return validation

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
    sops: 'sops',
    inspirations: 'inspirations',
  }

  // Serialize and snapshot everything before touching storage. Never import store actions.
  const defaults = buildExportPayload().data
  const writes = Object.entries(storeKeyMap).flatMap(([dataKey, suffix]) => {
    const key = dataKey as keyof typeof data.data
    // Old backups predate these slices: a restore must replace, not merge, them.
    const value = data.data[key] ?? (key === 'sops'
      ? { folders: [], sops: [], selectedSOPId: null, collapsedFolderIds: [], deletedSystemFolderIds: [], deletedSystemSOPIds: [] }
      : key === 'inspirations' ? { inspirations: [] } : undefined)
    if (value === undefined) return []
    const shape = defaults[key] as unknown as Record<string, unknown>
    // Older backups can omit either dashboard field. Keep the current field in
    // that case; a cold reload must not merge an empty slice with factory defaults.
    // Explicit saved values, including an empty visibility list, remain authoritative.
    const savedDashboard = value as Partial<ExportData['data']['dashboard']>
    const savedSOPs = value as Partial<NonNullable<ExportData['data']['sops']>>
    const restored = key === 'dashboard' ? {
      ...value,
      layout: savedDashboard.layout ?? defaults.dashboard.layout,
      visibleCards: savedDashboard.visibleCards ?? defaults.dashboard.visibleCards,
    } : key === 'sops' ? {
      ...value, selectedSOPId: savedSOPs.selectedSOPId ?? null,
      collapsedFolderIds: savedSOPs.collapsedFolderIds ?? [],
      deletedSystemFolderIds: savedSOPs.deletedSystemFolderIds ?? [],
      deletedSystemSOPIds: savedSOPs.deletedSystemSOPIds ?? [],
    } : value
    const state = Object.fromEntries(Object.keys(shape).filter(k => typeof shape[k] !== 'function' &&
      Object.prototype.hasOwnProperty.call(restored, k)).map(k => [k, (restored as unknown as Record<string, unknown>)[k]]))
    const version = key === 'dashboard' ? (useDashboardStore.persist.getOptions().version ?? 0) : 0
    return [{ key: `${prefix}-${suffix}`, value: JSON.stringify({ state, version }) }]
  })
  const originals = writes.map(w => ({ key: w.key, value: localStorage.getItem(w.key) }))
  try {
    for (const write of writes) {
      assertAccountBindingCurrent()
      localStorage.setItem(write.key, write.value)
    }
    assertAccountBindingCurrent()
  } catch {
    let restored = true
    for (const original of originals.reverse()) {
      try {
        if (original.value === null) localStorage.removeItem(original.key)
        else localStorage.setItem(original.key, original.value)
      } catch { restored = false }
    }
    return { success: false, error: !restored ? 'rollback_failed'
      : isAccountBindingCurrent() ? 'write_failed' : 'account_changed' }
  }

  return { success: true }
}

export function parseImportText(text: string): { success: boolean; data?: ExportData; error?: string } {
  try {
    const data = JSON.parse(text) as ExportData
    const result = validateImportPayload(data)
    if (!result.success) return result
    return { success: true, data }
  } catch {
    return { success: false, error: isAccountBindingCurrent() ? 'parse_error' : 'account_changed' }
  }
}

export async function importData(file: File): Promise<{ success: boolean; error?: string }> {
  if (!isAccountBindingCurrent()) return { success: false, error: 'account_changed' }
  try {
    const text = await file.text()
    if (!isAccountBindingCurrent()) return { success: false, error: 'account_changed' }
    const result = parseImportText(text)
    if (!result.success) return result
    if (!result.data) return { success: false, error: 'invalid_format' }
    const applyResult = applyImportPayload(result.data)
    if (!applyResult.success) return applyResult

    window.location.reload()
    return { success: true }
  } catch {
    return { success: false, error: isAccountBindingCurrent() ? 'parse_error' : 'account_changed' }
  }
}
