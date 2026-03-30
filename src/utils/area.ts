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

// ─── Category key system ──────────────────────────────────────────────────────

/** Map legacy Chinese category names → English keys */
const CATEGORY_MIGRATION: Record<string, string> = {
  '家园': 'home',
  '竞技场': 'arena',
  '藏书阁': 'library',
  '书阁高塔': 'library',
  '灵感工坊': 'workshop',
  '锻造坊': 'forge',
  '其他': 'other',
}

/** Migrate a category from Chinese to English key. Returns as-is if not a known preset. */
export function migrateCategory(cat: string): string {
  return CATEGORY_MIGRATION[cat] ?? cat
}

/** Display a category key using i18n. Falls back to raw string for custom categories. */
export function categoryDisplay(cat: string, t: Translations): string {
  const key = `areaName_${cat}` as keyof Translations
  const val = t[key]
  return typeof val === 'string' ? val : cat
}
