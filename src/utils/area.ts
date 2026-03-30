import type { Area } from '@/types/area'
import { AREA_TEMPLATES } from '@/types/area'
import type { Translations } from '@/i18n'

const TEMPLATE_TO_AREA_KEY: Record<string, keyof Translations> = {
  home: 'areaName_home',
  arena: 'areaName_arena',
  library: 'areaName_library',
  workshop: 'areaName_workshop',
  forge: 'areaName_forge',
  milestone: 'areaName_archive',
  spring: 'areaName_spring',
  council: 'areaName_council',
  expedition: 'areaName_expedition',
  observatory: 'areaName_observatory',
  garden: 'areaName_garden',
  plaza: 'areaName_plaza',
}

/** All known default names for preset templates (Chinese originals + all i18n variants) */
const KNOWN_DEFAULT_NAMES: Record<string, string[]> = {
  home: ['家园'],
  arena: ['竞技场'],
  library: ['藏书阁', '书阁高塔'],
  workshop: ['灵感工坊'],
  forge: ['锻造坊'],
  milestone: ['里程碑殿堂', '档案馆'],
  spring: ['泉水'],
  council: ['议事厅'],
  expedition: ['远征大厅'],
  observatory: ['观测站'],
  garden: ['植物园'],
  plaza: ['广场'],
}

/**
 * Display an area's name with i18n support.
 * - Preset areas with original/default names → show i18n translated name
 * - Preset areas renamed by user → show user's custom name
 * - Custom areas → show area.name as-is
 */
export function getAreaDisplayName(area: Area, t: Translations): string {
  if (!area.templateId) return area.name

  const key = TEMPLATE_TO_AREA_KEY[area.templateId]
  if (!key) return area.name

  const i18nName = (t[key] as string) ?? area.name
  const template = AREA_TEMPLATES[area.templateId as keyof typeof AREA_TEMPLATES]
  const knownNames = KNOWN_DEFAULT_NAMES[area.templateId] ?? []

  // If name matches template default OR any known historical default → show i18n
  if (area.name === template?.name || area.name === i18nName || knownNames.includes(area.name)) {
    return i18nName
  }

  // User renamed it — show their custom name
  return area.name
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
  '泉水': 'spring',
  '议事厅': 'council',
  '远征大厅': 'expedition',
  '观测站': 'observatory',
  '植物园': 'garden',
  '广场': 'plaza',
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
