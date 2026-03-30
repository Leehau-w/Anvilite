import { useSettingsStore } from '@/stores/settingsStore'
import { zh } from './zh'
import { en } from './en'

export type { Translations } from './zh'

const dicts = { zh, en }

/** Returns the translation dictionary for the current language setting. */
export function useT() {
  const lang = useSettingsStore((s) => s.settings.language)
  return dicts[lang]
}
