import { useMemo } from 'react'
import { useSOPStore } from '@/stores/sopStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { resolveSOPLibrary } from '@/utils/sopLibrary'

/** Resolve translated defaults and persisted user changes without writing storage. */
export function useSOPLibrary() {
  const state = useSOPStore()
  const lang = useSettingsStore(s => s.settings.language)
  return useMemo(() => resolveSOPLibrary(state, lang), [
    state.folders, state.sops, state.deletedSystemFolderIds, state.deletedSystemSOPIds, lang,
  ])
}
