import type { SOP, SOPFolder, SOPStep } from '@/types/sop'
import { getSystemFolder, getSystemSOPs, SYSTEM_FOLDER_ID } from '@/data/systemSOPs'
import { generateId } from './id'

export type SOPLanguage = 'zh' | 'en'
export interface SOPLibraryState {
  folders: readonly SOPFolder[]
  sops: readonly SOP[]
  deletedSystemFolderIds?: readonly string[]
  deletedSystemSOPIds?: readonly string[]
}

/** Resolve built-ins lazily so untouched templates keep following the UI language. */
export function resolveSOPLibrary(state: SOPLibraryState, lang: SOPLanguage): { folders: SOPFolder[]; sops: SOP[] } {
  const folders = new Map<string, SOPFolder>([[SYSTEM_FOLDER_ID, getSystemFolder(lang)]])
  for (const folder of state.folders) folders.set(folder.id, folder)
  const deleted = new Set(state.deletedSystemFolderIds ?? [])
  function isDeleted(id: string): boolean {
    const visited = new Set<string>()
    let current: string | null = id
    while (current && !visited.has(current)) {
      if (deleted.has(current)) return true
      visited.add(current)
      current = folders.get(current)?.parentId ?? null
    }
    return false
  }
  const visibleFolders = [...folders.values()].filter(folder => !isDeleted(folder.id))
  const sops = new Map<string, SOP>(getSystemSOPs(lang).map(sop => [sop.id, sop]))
  for (const sop of state.sops) sops.set(sop.id, sop)
  const deletedSOPs = new Set(state.deletedSystemSOPIds ?? [])
  return {
    folders: visibleFolders,
    sops: [...sops.values()].filter(sop => !deletedSOPs.has(sop.id) && !isDeleted(sop.folderId)),
  }
}

/** User-created folders inside System Templates share the same copy-out rule. */
export function isSystemTemplateFolder(folderId: string, folders: readonly SOPFolder[]): boolean {
  const byId = new Map(folders.map(folder => [folder.id, folder]))
  const visited = new Set<string>()
  let current: string | null = folderId
  while (current && !visited.has(current)) {
    if (current === SYSTEM_FOLDER_ID) return true
    visited.add(current)
    current = byId.get(current)?.parentId ?? null
  }
  return false
}

/** Copies must not share nested steps, rich-text attributes, or node IDs. */
export function cloneSOPSteps(steps: readonly SOPStep[], renewIds = false): SOPStep[] {
  return steps.map(step => ({
    ...step, id: renewIds ? generateId() : step.id,
    content: step.content == null ? null : JSON.parse(JSON.stringify(step.content)),
    childSteps: cloneSOPSteps(step.childSteps ?? [], renewIds),
  }))
}
