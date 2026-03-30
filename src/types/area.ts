export type AreaTemplateId =
  | 'home' | 'arena' | 'library' | 'workshop' | 'forge' | 'milestone'
  | 'spring' | 'council' | 'expedition' | 'observatory' | 'garden' | 'plaza'

export interface Area {
  id: string
  templateId: AreaTemplateId | null  // null = 空白自定义
  name: string
  category: string   // 对应任务/习惯分类；里程碑殿堂用 '_milestone'
  position: { x: number; y: number }
  isPreset: boolean  // 预设区域（不可移动）
  canDelete: boolean // 家园 + 里程碑殿堂不可删；其余均可删
  canMove: boolean   // 用户新增区域可拖拽
  createdAt: string
}

export interface AreaTemplateInfo {
  name: string
  category: string
  description: string
  prosperityEmojis: [string, string, string, string, string, string]
}

export const AREA_TEMPLATES: Record<AreaTemplateId, AreaTemplateInfo> = {
  home: {
    name: '家园',
    category: 'home',
    description: '生活与日常',
    prosperityEmojis: ['🪨', '⛺', '🏡', '🏠', '🏰', '✨'],
  },
  arena: {
    name: '竞技场',
    category: 'arena',
    description: '运动与健身',
    prosperityEmojis: ['🌿', '🥊', '⚔️', '🏟️', '🛡️', '⚡'],
  },
  library: {
    name: '藏书阁',
    category: 'library',
    description: '学习与阅读',
    prosperityEmojis: ['🗿', '📖', '📚', '🏛️', '🔭', '⭐'],
  },
  workshop: {
    name: '灵感工坊',
    category: 'workshop',
    description: '兴趣与创造',
    prosperityEmojis: ['🕸️', '🔨', '🎨', '🏗️', '🎭', '💫'],
  },
  forge: {
    name: '锻造坊',
    category: 'forge',
    description: '工作与效率',
    prosperityEmojis: ['🔩', '🔥', '⚙️', '🏭', '⚒️', '💎'],
  },
  milestone: {
    name: '里程碑殿堂',
    category: '_milestone',
    description: '成就展示',
    prosperityEmojis: ['🌑', '🕯️', '📜', '🏆', '👑', '🌟'],
  },
  spring: {
    name: '泉水',
    category: '泉水',
    description: '恢复·冥想·自我关怀',
    prosperityEmojis: ['💧', '🌊', '⛲', '🏞️', '🌈', '💫'],
  },
  council: {
    name: '议事厅',
    category: '议事厅',
    description: '目标规划·复盘管理',
    prosperityEmojis: ['🪑', '📋', '🗓️', '🏛️', '👑', '🌐'],
  },
  expedition: {
    name: '远征大厅',
    category: '远征大厅',
    description: '中长期项目·挑战',
    prosperityEmojis: ['⛺', '🎒', '🗺️', '⛵', '🚀', '🌌'],
  },
  observatory: {
    name: '观测站',
    category: '观测站',
    description: '数据追踪·记账·反思',
    prosperityEmojis: ['🌫️', '🔭', '📊', '🌠', '🌌', '👁️'],
  },
  garden: {
    name: '植物园',
    category: '植物园',
    description: '情绪打卡·耐心培养',
    prosperityEmojis: ['🌵', '🌱', '🌿', '🌺', '🌸', '🌳'],
  },
  plaza: {
    name: '广场',
    category: '广场',
    description: '碎片化习惯·轻度日常',
    prosperityEmojis: ['🪨', '🪑', '🏪', '🎪', '🏙️', '✨'],
  },
}

export const PROSPERITY_NAMES = ['荒芜', '聚落', '丰饶', '繁荣', '鼎盛', '辉煌'] as const
