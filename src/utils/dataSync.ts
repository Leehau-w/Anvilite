import { buildExportPayload, serializeExportData, applyImportPayload, type ExportData } from './dataExport'
import { getCurrentAccountId, getStoragePrefix } from '@/stores/accountManager'

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
  localStorage.setItem(SYNC_DIR_KEY, dir)
}

export function getLastSyncExportedAt(): string | null {
  return localStorage.getItem(LAST_SYNC_KEY)
}

function setLastSyncExportedAt(value: string): void {
  localStorage.setItem(LAST_SYNC_KEY, value)
}

export function getSyncFileName(): string {
  return `anvilite-sync-${getCurrentAccountId()}.json`
}

function makeBackupFileName(): string {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  return `backups/anvilite-before-sync-restore-${stamp}.json`
}

export async function chooseSyncDir(): Promise<{ success: boolean; dir?: string; error?: string }> {
  if (!hasNativeSyncSupport()) return { success: false, error: 'unsupported' }
  const result = await window.electronAPI!.selectSyncDirectory()
  if (!result.success || !result.path) return { success: false, error: result.error ?? 'canceled' }
  setSyncDir(result.path)
  return { success: true, dir: result.path }
}

export async function readSyncMetadata(dir = getSyncDir()): Promise<{
  success: boolean
  exists?: boolean
  metadata?: SyncMetadata
  error?: string
}> {
  if (!dir) return { success: false, error: 'no_dir' }
  if (!hasNativeSyncSupport()) return { success: false, error: 'unsupported' }
  const result = await window.electronAPI!.readSyncFile(dir, getSyncFileName())
  if (!result.success) return { success: false, error: result.error ?? 'read_failed' }
  if (!result.exists || !result.content) return { success: true, exists: false }
  try {
    const data = JSON.parse(result.content) as ExportData
    return {
      success: true,
      exists: true,
      metadata: {
        appVersion: data.appVersion,
        exportedAt: data.exportedAt,
        accountId: data.accountId,
      },
    }
  } catch {
    return { success: false, error: 'parse_error' }
  }
}

export async function writeSyncSnapshot(dir = getSyncDir()): Promise<{ success: boolean; metadata?: SyncMetadata; error?: string }> {
  if (!dir) return { success: false, error: 'no_dir' }
  if (!hasNativeSyncSupport()) return { success: false, error: 'unsupported' }
  const payload = buildExportPayload()
  const result = await window.electronAPI!.writeSyncFile(dir, getSyncFileName(), serializeExportData(payload))
  if (!result.success) return { success: false, error: result.error ?? 'write_failed' }
  setLastSyncExportedAt(payload.exportedAt)
  return {
    success: true,
    metadata: {
      appVersion: payload.appVersion,
      exportedAt: payload.exportedAt,
      accountId: payload.accountId,
    },
  }
}

export async function restoreFromSync(dir = getSyncDir()): Promise<{ success: boolean; error?: string }> {
  if (!dir) return { success: false, error: 'no_dir' }
  if (!hasNativeSyncSupport()) return { success: false, error: 'unsupported' }

  const read = await window.electronAPI!.readSyncFile(dir, getSyncFileName())
  if (!read.success) return { success: false, error: read.error ?? 'read_failed' }
  if (!read.exists || !read.content) return { success: false, error: 'not_found' }

  const currentPayload = buildExportPayload()
  const backup = await window.electronAPI!.writeSyncFile(
    dir,
    makeBackupFileName(),
    serializeExportData(currentPayload),
  )
  if (!backup.success) return { success: false, error: backup.error ?? 'backup_failed' }

  try {
    const incoming = JSON.parse(read.content) as ExportData
    const result = applyImportPayload(incoming)
    if (!result.success) return result
    setLastSyncExportedAt(incoming.exportedAt)
    window.location.reload()
    return { success: true }
  } catch {
    return { success: false, error: 'parse_error' }
  }
}
