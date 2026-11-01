import { buildExportPayload, serializeExportData, applyImportPayload, parseImportText } from './dataExport'
import { assertAccountBindingCurrent, getBoundAccountId, getStoragePrefix, isAccountBindingCurrent } from '@/stores/accountManager'

const SYNC_DIR_KEY = `${getStoragePrefix()}-sync-dir`
const LAST_SYNC_KEY = `${getStoragePrefix()}-sync-last-exported-at`

export interface SyncMetadata {
  appVersion: string
  exportedAt: string
  accountId: string
}

export function hasNativeSyncSupport(): boolean {
  return !!window.electronAPI?.selectSyncDirectory &&
    !!window.electronAPI?.readSyncFile &&
    !!window.electronAPI?.writeSyncFile
}

export function getSyncDir(): string | null {
  return localStorage.getItem(SYNC_DIR_KEY)
}

export function setSyncDir(dir: string): void {
  assertAccountBindingCurrent()
  localStorage.setItem(SYNC_DIR_KEY, dir)
}

export function getLastSyncExportedAt(): string | null {
  return localStorage.getItem(LAST_SYNC_KEY)
}

function setLastSyncExportedAt(value: string): void {
  assertAccountBindingCurrent()
  localStorage.setItem(LAST_SYNC_KEY, value)
}

export function getSyncFileName(): string {
  return `anvilite-sync-${getBoundAccountId()}.json`
}

function makeBackupFileName(): string {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  return `backups/anvilite-before-sync-restore-${stamp}.json`
}

export async function chooseSyncDir(): Promise<{ success: boolean; dir?: string; error?: string }> {
  if (!isAccountBindingCurrent()) return { success: false, error: 'account_changed' }
  if (!hasNativeSyncSupport()) return { success: false, error: 'unsupported' }
  try {
    const result = await window.electronAPI!.selectSyncDirectory(getBoundAccountId())
    if (!isAccountBindingCurrent()) return { success: false, error: 'account_changed' }
    if (!result.success || !result.path) return { success: false, error: result.error ?? 'canceled' }
    setSyncDir(result.path)
    return { success: true, dir: result.path }
  } catch {
    return { success: false, error: isAccountBindingCurrent() ? 'select_failed' : 'account_changed' }
  }
}

export async function readSyncMetadata(dir = getSyncDir()): Promise<{
  success: boolean
  exists?: boolean
  metadata?: SyncMetadata
  error?: string
}> {
  if (!isAccountBindingCurrent()) return { success: false, error: 'account_changed' }
  if (!dir) return { success: false, error: 'no_dir' }
  if (!hasNativeSyncSupport()) return { success: false, error: 'unsupported' }
  try {
    const result = await window.electronAPI!.readSyncFile(dir, getSyncFileName(), getBoundAccountId())
    if (!isAccountBindingCurrent()) return { success: false, error: 'account_changed' }
    if (!result.success) return { success: false, error: result.error ?? 'read_failed' }
    if (!result.exists) return { success: true, exists: false }
    const parsed = parseImportText(result.content ?? '')
    if (!parsed.success || !parsed.data) return { success: false, error: parsed.error ?? 'invalid_format' }
    const data = parsed.data
    if (data.accountId !== getBoundAccountId()) return { success: false, error: 'account_mismatch' }
    return { success: true, exists: true, metadata: {
      appVersion: data.appVersion, exportedAt: data.exportedAt, accountId: data.accountId,
    } }
  } catch {
    return { success: false, error: isAccountBindingCurrent() ? 'read_failed' : 'account_changed' }
  }
}

export async function writeSyncSnapshot(dir = getSyncDir()): Promise<{ success: boolean; metadata?: SyncMetadata; error?: string }> {
  if (!isAccountBindingCurrent()) return { success: false, error: 'account_changed' }
  if (!dir) return { success: false, error: 'no_dir' }
  if (!hasNativeSyncSupport()) return { success: false, error: 'unsupported' }
  try {
    const payload = buildExportPayload()
    const result = await window.electronAPI!.writeSyncFile(dir, getSyncFileName(), serializeExportData(payload), getBoundAccountId())
    if (!isAccountBindingCurrent()) return { success: false, error: 'account_changed' }
    if (!result.success) return { success: false, error: result.error ?? 'write_failed' }
    setLastSyncExportedAt(payload.exportedAt)
    return { success: true, metadata: {
      appVersion: payload.appVersion, exportedAt: payload.exportedAt, accountId: payload.accountId,
    } }
  } catch {
    return { success: false, error: isAccountBindingCurrent() ? 'write_failed' : 'account_changed' }
  }
}

export async function restoreFromSync(dir = getSyncDir()): Promise<{ success: boolean; error?: string }> {
  if (!isAccountBindingCurrent()) return { success: false, error: 'account_changed' }
  if (!dir) return { success: false, error: 'no_dir' }
  if (!hasNativeSyncSupport()) return { success: false, error: 'unsupported' }
  try {
    const read = await window.electronAPI!.readSyncFile(dir, getSyncFileName(), getBoundAccountId())
    if (!isAccountBindingCurrent()) return { success: false, error: 'account_changed' }
    if (!read.success) return { success: false, error: read.error ?? 'read_failed' }
    if (!read.exists) return { success: false, error: 'not_found' }
    const parsed = parseImportText(read.content ?? '')
    if (!parsed.success || !parsed.data) return { success: false, error: parsed.error ?? 'invalid_format' }
    if (parsed.data.accountId !== getBoundAccountId()) return { success: false, error: 'account_mismatch' }

    const currentPayload = buildExportPayload()
    const backup = await window.electronAPI!.writeSyncFile(
      dir, makeBackupFileName(), serializeExportData(currentPayload), getBoundAccountId(),
    )
    if (!isAccountBindingCurrent()) return { success: false, error: 'account_changed' }
    if (!backup.success) return { success: false, error: backup.error ?? 'backup_failed' }

    const result = applyImportPayload(parsed.data)
    if (!result.success) return result
    if (!isAccountBindingCurrent()) return { success: false, error: 'account_changed' }
    // Import has succeeded. An optional timestamp must not strand the old stores
    // in memory if storage is now full; reload the restored records either way.
    try { setLastSyncExportedAt(parsed.data.exportedAt) } catch { /* metadata only */ }
    window.location.reload()
    return { success: true }
  } catch {
    return { success: false, error: isAccountBindingCurrent() ? 'restore_failed' : 'account_changed' }
  }
}
