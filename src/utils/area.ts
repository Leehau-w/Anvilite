import type { Area } from '@/types/area'
import type { Translations } from '@/i18n'

const TEMPLATE_TO_AREA_KEY: Record<string, keyof Translations> = {
  home: 'areaName_home',
  arena: 'areaName_arena',
  library: 'areaName_library',
  workshop: 'areaName_workshop',
  forge: 'areaName_forge',
  milestone: 'areaName_archive',
}

export function getAreaDisplayName(area: Area, t: Translations): string {
  if (!area.isPreset || !area.templateId) return area.name
  const key = TEMPLATE_TO_AREA_KEY[area.templateId]
  if (!key) return area.name
  return (t[key] as string) ?? area.name
}
