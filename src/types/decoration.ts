import type { AreaTemplateId } from './area'

export interface DecorationDef {
  id: string
  templateId: AreaTemplateId
  name: string
  icon: string
  description: string
  requiredProsperityLevel: number   // 1-6
  cost: number                       // 矿石价格
}

/** 各繁荣等级对应的装饰价格 */
const LEVEL_COST: Record<number, number> = {
  1: 30,
  2: 80,
  3: 180,
  4: 380,
  5: 750,
  6: 1500,
}

function def(
  id: string,
  templateId: AreaTemplateId,
  name: string,
  icon: string,
  description: string,
  level: number
): DecorationDef {
  return { id, templateId, name, icon, description, requiredProsperityLevel: level, cost: LEVEL_COST[level] }
}

/** 所有区域模板的装饰定义 */
export const ALL_DECORATIONS: DecorationDef[] = [
  // ── 家园 (home) ────────────────────────────────────────────────
  def('home_1', 'home', '小木椅', '🪑', '朴素的手工木椅', 1),
  def('home_2', 'home', '盆栽', '🪴', '一盆绿意盎然的植物', 2),
  def('home_3', 'home', '挂画', '🖼️', '墙上精美的装饰画', 3),
  def('home_4', 'home', '暖炉', '🔥', '冬日里最温暖的角落', 4),
  def('home_5', 'home', '灯笼', '🏮', '红色灯笼映照家园', 5),
  def('home_6', 'home', '祥云屏风', '✨', '传说中的神圣屏风', 6),

  // ── 竞技场 (arena) ────────────────────────────────────────────
  def('arena_1', 'arena', '训练木桩', '🪵', '基础的击打训练桩', 1),
  def('arena_2', 'arena', '拳击袋', '🥊', '锻炼力量的沙袋', 2),
  def('arena_3', 'arena', '荣誉旗', '🚩', '胜利者的标志', 3),
  def('arena_4', 'arena', '奖杯架', '🏆', '陈列荣誉的展架', 4),
  def('arena_5', 'arena', '神兵铁架', '⚔️', '悬挂传奇武器的铁架', 5),
  def('arena_6', 'arena', '冠军王座', '👑', '只有强者才能就坐', 6),

  // ── 书阁高塔 (library) ──────────────────────────────────────
  def('library_1', 'library', '小书堆', '📚', '还没分类的书籍', 1),
  def('library_2', 'library', '阅读灯', '🕯️', '夜读时的明灯', 2),
  def('library_3', 'library', '世界地图', '🗺️', '探索知识的地图', 3),
  def('library_4', 'library', '天文仪', '🔭', '仰望星空的仪器', 4),
  def('library_5', 'library', '古典书柜', '🏛️', '精雕细琢的书柜', 5),
  def('library_6', 'library', '智慧之卷', '📜', '传说中包含一切知识的卷轴', 6),

  // ── 灵感工坊 (workshop) ─────────────────────────────────────
  def('workshop_1', 'workshop', '素描本', '📓', '记录灵感的本子', 1),
  def('workshop_2', 'workshop', '调色盘', '🎨', '斑斓的颜料盘', 2),
  def('workshop_3', 'workshop', '乐器架', '🎸', '各式乐器的展示架', 3),
  def('workshop_4', 'workshop', '创作画板', '🖌️', '大型创作画板', 4),
  def('workshop_5', 'workshop', '灵感水晶', '💎', '据说能激发创意', 5),
  def('workshop_6', 'workshop', '艺术神殿', '🎭', '创意无限的圣地', 6),

  // ── 锻造坊 (forge) ──────────────────────────────────────────
  def('forge_1', 'forge', '小锤子', '🔨', '最基础的锻造工具', 1),
  def('forge_2', 'forge', '齿轮架', '⚙️', '展示精密零件的架子', 2),
  def('forge_3', 'forge', '熔炉', '🔥', '高温锻造用的熔炉', 3),
  def('forge_4', 'forge', '铁砧', '⚒️', '坚固的铸铁砧台', 4),
  def('forge_5', 'forge', '宝石陈列台', '💎', '展示珍贵矿石的台座', 5),
  def('forge_6', 'forge', '锻石神柱', '🌟', '传说中锻造神器的神柱', 6),

  // ── 泉水 (spring) ────────────────────────────────────────────
  def('spring_1', 'spring', '鹅卵石', '🪨', '溪边光滑的石子', 1),
  def('spring_2', 'spring', '蜡烛台', '🕯️', '轻柔的烛光', 2),
  def('spring_3', 'spring', '茶具架', '🫖', '精致的茶道套具', 3),
  def('spring_4', 'spring', '喷泉', '⛲', '流水潺潺的小喷泉', 4),
  def('spring_5', 'spring', '冥想蒲团', '🧘', '静心冥想的蒲团', 5),
  def('spring_6', 'spring', '灵气之泉', '💫', '传说中的恢复圣泉', 6),

  // ── 议事厅 (council) ────────────────────────────────────────
  def('council_1', 'council', '留言板', '📋', '记录要事的公告栏', 1),
  def('council_2', 'council', '日历台', '🗓️', '规划时间的日历', 2),
  def('council_3', 'council', '古钟', '🕰️', '庄严的机械时钟', 3),
  def('council_4', 'council', '议事长桌', '🪑', '容纳多人的长桌', 4),
  def('council_5', 'council', '权杖台', '⚜️', '权威的象征', 5),
  def('council_6', 'council', '智谋水晶球', '🌐', '洞察全局的神器', 6),

  // ── 远征大厅 (expedition) ───────────────────────────────────
  def('expedition_1', 'expedition', '行囊', '🎒', '装满补给的旅行包', 1),
  def('expedition_2', 'expedition', '指南针', '🧭', '永远指向北方', 2),
  def('expedition_3', 'expedition', '远征地图', '🗺️', '标记着未知领地的地图', 3),
  def('expedition_4', 'expedition', '帆船模型', '⛵', '海上冒险的象征', 4),
  def('expedition_5', 'expedition', '火箭模型', '🚀', '飞向未知的勇气', 5),
  def('expedition_6', 'expedition', '星际圣石', '🌌', '从宇宙带回的神秘岩石', 6),

  // ── 观测站 (observatory) ────────────────────────────────────
  def('observatory_1', 'observatory', '数据板', '📊', '记录数据的展示板', 1),
  def('observatory_2', 'observatory', '天线', '📡', '接收信号的装置', 2),
  def('observatory_3', 'observatory', '望远镜台', '🔭', '精密观测仪器', 3),
  def('observatory_4', 'observatory', '星图', '🌠', '完整的星际地图', 4),
  def('observatory_5', 'observatory', '量子仪', '⚡', '测量极微粒子的仪器', 5),
  def('observatory_6', 'observatory', '全知之眼', '👁️', '传说中能看透一切的神眼', 6),

  // ── 植物园 (garden) ─────────────────────────────────────────
  def('garden_1', 'garden', '小仙人掌', '🌵', '顽强生长的小生命', 1),
  def('garden_2', 'garden', '嫩芽盆栽', '🌱', '破土而出的希望', 2),
  def('garden_3', 'garden', '樱花树', '🌸', '粉嫩的樱花树', 3),
  def('garden_4', 'garden', '花圃', '🌺', '色彩缤纷的花圃', 4),
  def('garden_5', 'garden', '神木', '🌳', '守护植物园的古树', 5),
  def('garden_6', 'garden', '蝴蝶仙境', '🦋', '蝴蝶翩翩起舞的仙境', 6),

  // ── 广场 (plaza) ─────────────────────────────────────────────
  def('plaza_1', 'plaza', '长椅', '🪑', '休息用的公共长椅', 1),
  def('plaza_2', 'plaza', '小摊位', '🏪', '热闹的集市摊位', 2),
  def('plaza_3', 'plaza', '圆顶帐篷', '🎪', '各种活动的场地', 3),
  def('plaza_4', 'plaza', '摩天轮', '🎡', '广场中心的地标', 4),
  def('plaza_5', 'plaza', '城市雕塑', '🏙️', '象征繁华的雕塑', 5),
  def('plaza_6', 'plaza', '璀璨华灯', '✨', '夜晚照亮广场的神灯', 6),
]

/** 按模板ID查找装饰 */
export function getDecorationsForTemplate(templateId: AreaTemplateId | null): DecorationDef[] {
  if (!templateId) return []
  return ALL_DECORATIONS.filter((d) => d.templateId === templateId)
}
