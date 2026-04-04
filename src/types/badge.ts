/** 运行时徽章状态（存储在 badgeStore） */
export interface Badge {
  id: string
  category: BadgeCategory
  name: string
  description: string
  icon: string
  earned: boolean
  earnedAt: string | null
  isNew: boolean
}

/** 静态徽章定义（不变的元数据） */
export interface BadgeDef {
  id: string
  category: BadgeCategory
  name: string
  description: string
  icon: string
}

export type BadgeCategory =
  | '起步'
  | '等级'
  | '坚持'
  | '区域'
  | '习惯'
  | '任务量'
  | '投入'
  | '收集'

/** 所有静态徽章定义（不含动态区域徽章） */
export const STATIC_BADGE_DEFS: BadgeDef[] = [
  // ── 起步 ──────────────────────────────────────────────────────────
  {
    id: 'start_first_task',
    category: '起步',
    name: '万事起头难',
    description: '完成第一个任务',
    icon: '🌱',
  },

  // ── 等级 ──────────────────────────────────────────────────────────
  { id: 'level_5',   category: '等级', name: '初露锋芒',  description: '达到 Lv.5',   icon: '⚔️' },
  { id: 'level_10',  category: '等级', name: '磨砺中',    description: '达到 Lv.10',  icon: '🗡️' },
  { id: 'level_15',  category: '等级', name: '锻炼有成',  description: '达到 Lv.15',  icon: '🛡️' },
  { id: 'level_20',  category: '等级', name: '匠心初现',  description: '达到 Lv.20',  icon: '⚒️' },
  { id: 'level_25',  category: '等级', name: '登堂入室',  description: '达到 Lv.25',  icon: '🏛️' },
  { id: 'level_30',  category: '等级', name: '炉火纯青',  description: '达到 Lv.30',  icon: '🔥' },
  { id: 'level_40',  category: '等级', name: '淬火成钢',  description: '达到 Lv.40',  icon: '💎' },
  { id: 'level_50',  category: '等级', name: '锻石不朽',  description: '达到 Lv.50',  icon: '👑' },
  { id: 'level_75',  category: '等级', name: '超凡入圣',  description: '达到 Lv.75',  icon: '🌟' },
  { id: 'level_100', category: '等级', name: '传说已成',  description: '达到 Lv.100', icon: '✨' },
  { id: 'prestige_origin', category: '等级', name: '起源之火', description: '完成淬火重铸，在炉火中重生', icon: '🔥' },

  // ── 坚持 ──────────────────────────────────────────────────────────
  { id: 'streak_7',   category: '坚持', name: '一周之计',  description: '连续活跃 7 天',   icon: '🔆' },
  { id: 'streak_30',  category: '坚持', name: '月有所成',  description: '连续活跃 30 天',  icon: '📅' },
  { id: 'streak_100', category: '坚持', name: '百日磨砺',  description: '连续活跃 100 天', icon: '💯' },
  { id: 'streak_365', category: '坚持', name: '岁月锻造',  description: '连续活跃 365 天', icon: '🗓️' },

  // ── 习惯 ──────────────────────────────────────────────────────────
  { id: 'habit_30',  category: '习惯', name: '习惯成自然',  description: '单个习惯连续完成 30 次',  icon: '🌿' },
  { id: 'habit_100', category: '习惯', name: '百炼成钢',    description: '单个习惯连续完成 100 次', icon: '🌳' },
  { id: 'habit_365', category: '习惯', name: '恒心如铁',    description: '单个习惯连续完成 365 次', icon: '⚡' },

  // ── 任务量 ────────────────────────────────────────────────────────
  { id: 'tasks_100',  category: '任务量', name: '百事俱备',  description: '累计完成 100 个任务',   icon: '📋' },
  { id: 'tasks_500',  category: '任务量', name: '五百壮举',  description: '累计完成 500 个任务',   icon: '📜' },
  { id: 'tasks_1000', category: '任务量', name: '千锤百炼',  description: '累计完成 1000 个任务',  icon: '🏆' },

  // ── 投入 ──────────────────────────────────────────────────────────
  { id: 'hours_100',  category: '投入', name: '百时专注',  description: '累计投入 100 小时',   icon: '⏱️' },
  { id: 'hours_500',  category: '投入', name: '五百沉浸',  description: '累计投入 500 小时',   icon: '⌛' },
  { id: 'hours_1000', category: '投入', name: '千时磨剑',  description: '累计投入 1000 小时',  icon: '🕰️' },

  // ── 收集 ──────────────────────────────────────────────────────────
  {
    id: 'theme_collect',
    category: '收集',
    name: '色彩收藏家',
    description: '解锁全部 8 套主题',
    icon: '🎨',
  },
]

/** 区域繁荣等级 2~6 对应的徽章名称 */
export const AREA_PROSPERITY_BADGE_NAMES: Record<number, { name: string; description: string; icon: string }> = {
  2: { name: '聚落初立', description: '区域达到繁荣等级「聚落」',  icon: '🏘️' },
  3: { name: '丰饶之地', description: '区域达到繁荣等级「丰饶」',  icon: '🌾' },
  4: { name: '繁荣鼎盛', description: '区域达到繁荣等级「繁荣」',  icon: '🏙️' },
  5: { name: '鼎盛荣光', description: '区域达到繁荣等级「鼎盛」',  icon: '🌠' },
  6: { name: '辉煌传世', description: '区域达到繁荣等级「辉煌」',  icon: '🌟' },
}

/** 生成区域徽章ID，格式：area_{category}_{level} */
export function makeAreaBadgeId(category: string, level: number): string {
  return `area_${category}_${level}`
}

/** 从区域徽章ID生成 BadgeDef。displayName 为用户可见名称，缺省时回退到 category。 */
export function makeAreaBadgeDef(category: string, level: number, displayName?: string): BadgeDef {
  const info = AREA_PROSPERITY_BADGE_NAMES[level]
  const label = displayName ?? category
  return {
    id: makeAreaBadgeId(category, level),
    category: '区域',
    name: `${label}·${info.name}`,
    description: `「${label}」${info.description}`,
    icon: info.icon,
  }
}

/** 所有徽章分类排序 */
export const BADGE_CATEGORY_ORDER: BadgeCategory[] = [
  '起步', '等级', '坚持', '任务量', '投入', '习惯', '区域', '收集',
]
