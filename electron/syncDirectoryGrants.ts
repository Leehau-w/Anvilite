import fs from 'fs'
import path from 'path'

export interface SyncDirectoryGrant { selected: string; root: string; dev: bigint; ino: bigint }

/** Native-only grants never come from renderer preferences or imported backups. */
export function readSyncDirectoryGrants(file: string): Map<string, SyncDirectoryGrant> {
  const grants = new Map<string, SyncDirectoryGrant>()
  try {
    const stat = fs.lstatSync(file)
    if (stat.isSymbolicLink() || !stat.isFile() || stat.size > 512 * 1024) return grants
    const data = JSON.parse(fs.readFileSync(file, 'utf8'))
    if (data?.version !== 1 || !Array.isArray(data.grants) || data.grants.length > 1000) return grants
    for (const entry of data.grants) {
      if (!entry || typeof entry.accountId !== 'string' || !entry.accountId || entry.accountId.length > 256 ||
        typeof entry.selected !== 'string' || !path.isAbsolute(entry.selected) ||
        typeof entry.root !== 'string' || !path.isAbsolute(entry.root) ||
        typeof entry.dev !== 'string' || !/^\d{1,30}$/.test(entry.dev) ||
        typeof entry.ino !== 'string' || !/^\d{1,30}$/.test(entry.ino)) continue
      grants.set(entry.accountId, { selected: entry.selected, root: entry.root, dev: BigInt(entry.dev), ino: BigInt(entry.ino) })
    }
  } catch { /* Missing or damaged authorization requires an explicit native choice. */ }
  return grants
}

export function serializeSyncDirectoryGrants(grants: Map<string, SyncDirectoryGrant>): string {
  if (grants.size > 1000) throw new Error('sync_directory_grants_full')
  const content = JSON.stringify({ version: 1, grants: [...grants].map(([accountId, grant]) => ({
    accountId, selected: grant.selected, root: grant.root, dev: grant.dev.toString(), ino: grant.ino.toString(),
  })) })
  if (Buffer.byteLength(content, 'utf8') > 512 * 1024) throw new Error('sync_directory_grants_full')
  return content
}
