/**
 * Storage usage monitor for electron-store persisted data.
 * electron-store saves to %APPDATA%/anvilite/. We estimate size from
 * localStorage (renderer) since we can't directly stat files from the renderer.
 * All zustand/persist stores write to localStorage with their configured keys.
 */

export interface StorageUsage {
  usedBytes: number
  totalBytes: number
  usageRatio: number
  isWarning: boolean
}

/** Default budget: 50 MB — generous for a desktop app backed by electron-store */
const STORAGE_BUDGET = 50 * 1024 * 1024

export function getStorageUsage(): StorageUsage {
  let usedBytes = 0
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (!key) continue
      const value = localStorage.getItem(key) ?? ''
      // 2 bytes per UTF-16 char (conservative estimate)
      usedBytes += (key.length + value.length) * 2
    }
  } catch {
    // localStorage may be unavailable in some contexts
  }

  const usageRatio = usedBytes / STORAGE_BUDGET
  return {
    usedBytes,
    totalBytes: STORAGE_BUDGET,
    usageRatio,
    isWarning: usageRatio >= 0.8,
  }
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
