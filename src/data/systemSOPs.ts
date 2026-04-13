import type { SOP, SOPFolder, SOPStep } from '@/types/sop'

export const SYSTEM_FOLDER_ID = '__system'

type Lang = 'zh' | 'en'

type BilingualStep = {
  id: string
  zh: string
  en: string
  noteZh?: string
  noteEn?: string
  warnZh?: string
  warnEn?: string
  time?: string
  sortOrder: number
}

function resolveStep(s: BilingualStep, lang: Lang): SOPStep {
  return {
    id: s.id,
    title: lang === 'zh' ? s.zh : s.en,
    note: (lang === 'zh' ? s.noteZh : s.noteEn) ?? '',
    warning: (lang === 'zh' ? s.warnZh : s.warnEn) ?? '',
    time: s.time ?? null,
    sortOrder: s.sortOrder,
    childSteps: [],
  }
}

// ─── 1. 工作日日程 ─────────────────────────────────────────────────────────────
const WORKDAY_STEPS: BilingualStep[] = [
  { id: 'wd1', zh: '起床、喝水', en: 'Wake up, drink water', time: '07:00', sortOrder: 0 },
  { id: 'wd2', zh: '晨练 / 拉伸', en: 'Morning exercise / stretch', time: '07:15', sortOrder: 1 },
  { id: 'wd3', zh: '早餐', en: 'Breakfast', time: '07:45', sortOrder: 2 },
  { id: 'wd4', zh: '开始工作，处理优先任务', en: 'Start work, handle priority tasks', time: '09:00', noteZh: '避免先看邮件', noteEn: 'Avoid checking email first', sortOrder: 3 },
  { id: 'wd5', zh: '午餐 & 短暂休息', en: 'Lunch & short break', time: '12:00', sortOrder: 4 },
  { id: 'wd6', zh: '下午工作块', en: 'Afternoon work block', time: '13:00', sortOrder: 5 },
  { id: 'wd7', zh: '收尾当日任务，记录明日待办', en: 'Wrap up tasks, note tomorrow\'s todos', time: '17:30', sortOrder: 6 },
  { id: 'wd8', zh: '放松 & 就寝准备', en: 'Relax & prepare for sleep', time: '22:00', sortOrder: 7 },
]

// ─── 2. 休息日日程 ─────────────────────────────────────────────────────────────
const DAYOFF_STEPS: BilingualStep[] = [
  { id: 'do1', zh: '自然醒，做简单早餐', en: 'Wake naturally, make a simple breakfast', time: '08:00', sortOrder: 0 },
  { id: 'do2', zh: '运动或户外散步', en: 'Exercise or outdoor walk', time: '09:30', sortOrder: 1 },
  { id: 'do3', zh: '自由时间（阅读 / 爱好）', en: 'Free time (reading / hobbies)', time: '11:00', sortOrder: 2 },
  { id: 'do4', zh: '午餐', en: 'Lunch', time: '12:30', sortOrder: 3 },
  { id: 'do5', zh: '午休 / 社交 / 出行', en: 'Nap / socialising / outing', time: '13:30', sortOrder: 4 },
  { id: 'do6', zh: '晚餐 & 家人时间', en: 'Dinner & family time', time: '18:30', sortOrder: 5 },
  { id: 'do7', zh: '回顾本日，放松就寝', en: 'Reflect on the day, wind down', time: '22:00', sortOrder: 6 },
]

// ─── 3. 每周复盘 ──────────────────────────────────────────────────────────────
const WEEKLY_REVIEW_STEPS: BilingualStep[] = [
  { id: 'wr1', zh: '回顾本周目标完成情况', en: 'Review this week\'s goal completion', sortOrder: 0 },
  { id: 'wr2', zh: '记录本周亮点与成就', en: 'Record highlights and achievements', sortOrder: 1 },
  { id: 'wr3', zh: '识别未完成事项及原因', en: 'Identify unfinished items and reasons', sortOrder: 2 },
  { id: 'wr4', zh: '记录本周学习与洞察', en: 'Log learnings and insights', sortOrder: 3 },
  { id: 'wr5', zh: '设定下周 3 个重点目标', en: 'Set 3 focus goals for next week', sortOrder: 4 },
  { id: 'wr6', zh: '调整习惯计划（如需）', en: 'Adjust habit plan if needed', sortOrder: 5 },
  { id: 'wr7', zh: '整理工作区 & 清空收件箱', en: 'Tidy workspace & clear inbox', sortOrder: 6 },
]

// ─── 4. 项目启动流程 ───────────────────────────────────────────────────────────
const PROJECT_KICKOFF_STEPS: BilingualStep[] = [
  { id: 'pk1', zh: '明确项目目标与成功标准', en: 'Define project goal and success criteria', sortOrder: 0 },
  { id: 'pk2', zh: '确认资源：人员、预算、时间', en: 'Confirm resources: people, budget, timeline', sortOrder: 1 },
  { id: 'pk3', zh: '分解任务为可执行子项', en: 'Break down tasks into actionable subtasks', sortOrder: 2 },
  { id: 'pk4', zh: '设定关键里程碑和截止日期', en: 'Set key milestones and deadlines', sortOrder: 3 },
  { id: 'pk5', zh: '分配责任人', en: 'Assign owners', sortOrder: 4 },
  { id: 'pk6', zh: '建立项目跟踪机制（周报 / 看板）', en: 'Set up tracking mechanism (weekly report / kanban)', sortOrder: 5 },
]

// ─── 5. 学习新技能流程 ─────────────────────────────────────────────────────────
const LEARN_SKILL_STEPS: BilingualStep[] = [
  { id: 'ls1', zh: '调研：找优质资料和学习路线', en: 'Research: find quality resources and learning path', sortOrder: 0 },
  { id: 'ls2', zh: '制定每日 / 每周学习计划', en: 'Create daily / weekly study plan', sortOrder: 1 },
  { id: 'ls3', zh: '完成基础学习（理论为主）', en: 'Complete foundational learning (theory-focused)', sortOrder: 2 },
  { id: 'ls4', zh: '动手实践：完成 1 个小项目', en: 'Hands-on practice: finish one small project', noteZh: '边做边学效果最好', noteEn: 'Learning-by-doing is most effective', sortOrder: 3 },
  { id: 'ls5', zh: '复盘：总结心得，记录难点', en: 'Review: summarize takeaways, log difficulties', sortOrder: 4 },
  { id: 'ls6', zh: '进阶学习：深入某一方向', en: 'Advanced learning: go deeper in one direction', sortOrder: 5 },
]

// ─── 6. 出差准备清单 ───────────────────────────────────────────────────────────
const TRAVEL_PACKING_STEPS: BilingualStep[] = [
  { id: 'tp1', zh: '确认交通票据（机票 / 车票）', en: 'Confirm travel tickets (flight / train)', sortOrder: 0 },
  { id: 'tp2', zh: '预订酒店 / 检查住宿', en: 'Book hotel / check accommodation', sortOrder: 1 },
  { id: 'tp3', zh: '准备证件（身份证 / 护照 / 名片）', en: 'Prepare documents (ID / passport / business cards)', sortOrder: 2 },
  { id: 'tp4', zh: '打包电脑及全部充电器', en: 'Pack laptop and all chargers', warnZh: '别忘转换插头', warnEn: 'Don\'t forget adapter plugs', sortOrder: 3 },
  { id: 'tp5', zh: '换洗衣物（按天数 +1）', en: 'Clothes changes (days + 1)', sortOrder: 4 },
  { id: 'tp6', zh: '现金 / 银行卡 / 发票', en: 'Cash / bank card / receipts', sortOrder: 5 },
  { id: 'tp7', zh: '常用药品', en: 'Common medications', sortOrder: 6 },
  { id: 'tp8', zh: '提前通知团队出差安排', en: 'Notify team of travel schedule in advance', sortOrder: 7 },
]

// ─── 7. 大扫除清单 ─────────────────────────────────────────────────────────────
const DEEP_CLEAN_STEPS: BilingualStep[] = [
  { id: 'dc1', zh: '整理杂物，清除不需要的物品', en: 'Declutter and remove unneeded items', sortOrder: 0 },
  { id: 'dc2', zh: '擦拭家具和书架', en: 'Wipe furniture and bookshelves', sortOrder: 1 },
  { id: 'dc3', zh: '清洁地板（扫 + 拖）', en: 'Clean floors (sweep + mop)', sortOrder: 2 },
  { id: 'dc4', zh: '清洁窗户和窗台', en: 'Clean windows and sills', sortOrder: 3 },
  { id: 'dc5', zh: '清洁厨房（台面、油烟机、冰箱）', en: 'Clean kitchen (counters, hood, fridge)', sortOrder: 4 },
  { id: 'dc6', zh: '清洁卫浴（马桶、洗手台、淋浴）', en: 'Clean bathroom (toilet, sink, shower)', sortOrder: 5 },
  { id: 'dc7', zh: '整理收纳、归位物品', en: 'Organise and put things back', sortOrder: 6 },
  { id: 'dc8', zh: '处理垃圾和回收物', en: 'Dispose of trash and recyclables', sortOrder: 7 },
]

// ─── 8. 会议准备检查 ───────────────────────────────────────────────────────────
const MEETING_PREP_STEPS: BilingualStep[] = [
  { id: 'mp1', zh: '明确会议目的与期望产出', en: 'Clarify meeting purpose and expected outcomes', sortOrder: 0 },
  { id: 'mp2', zh: '撰写并发送议程', en: 'Write and send agenda', sortOrder: 1 },
  { id: 'mp3', zh: '发送会议邀请，确认出席', en: 'Send calendar invite, confirm attendance', sortOrder: 2 },
  { id: 'mp4', zh: '准备演示资料 / 数据报告', en: 'Prepare presentation / data report', sortOrder: 3 },
  { id: 'mp5', zh: '测试设备（麦克风、屏幕共享）', en: 'Test equipment (mic, screen share)', sortOrder: 4 },
  { id: 'mp6', zh: '提前 15 分钟到场 / 进入会议室', en: 'Arrive / join the room 15 min early', sortOrder: 5 },
]

// ─── 系统 SOP 数据 ─────────────────────────────────────────────────────────────

const SOP_META: Array<{
  id: string
  type: SOP['type']
  titleZh: string
  titleEn: string
  steps: BilingualStep[]
  sortOrder: number
}> = [
  { id: '__sys_workday',       type: 'schedule',  titleZh: '工作日日程',   titleEn: 'Workday Schedule',      steps: WORKDAY_STEPS,         sortOrder: 0 },
  { id: '__sys_dayoff',        type: 'schedule',  titleZh: '休息日日程',   titleEn: 'Day Off Schedule',      steps: DAYOFF_STEPS,          sortOrder: 1 },
  { id: '__sys_weeklyReview',  type: 'checklist', titleZh: '每周复盘',     titleEn: 'Weekly Review',         steps: WEEKLY_REVIEW_STEPS,   sortOrder: 2 },
  { id: '__sys_projectKickoff',type: 'workflow',  titleZh: '项目启动流程', titleEn: 'Project Kickoff',       steps: PROJECT_KICKOFF_STEPS, sortOrder: 3 },
  { id: '__sys_learnSkill',    type: 'workflow',  titleZh: '学习新技能流程',titleEn: 'Learn a New Skill',    steps: LEARN_SKILL_STEPS,     sortOrder: 4 },
  { id: '__sys_travelPacking', type: 'itemlist',  titleZh: '出差准备清单', titleEn: 'Business Trip Packing', steps: TRAVEL_PACKING_STEPS,  sortOrder: 5 },
  { id: '__sys_deepClean',     type: 'itemlist',  titleZh: '大扫除清单',   titleEn: 'Deep Cleaning',         steps: DEEP_CLEAN_STEPS,      sortOrder: 6 },
  { id: '__sys_meetingPrep',   type: 'checklist', titleZh: '会议准备检查', titleEn: 'Meeting Preparation',   steps: MEETING_PREP_STEPS,    sortOrder: 7 },
]

export function getSystemFolder(lang: Lang): SOPFolder {
  return {
    id: SYSTEM_FOLDER_ID,
    name: lang === 'zh' ? '系统模板' : 'System Templates',
    sortOrder: -1,
    isSystem: true,
    createdAt: '2026-01-01T00:00:00Z',
  }
}

export function getSystemSOPs(lang: Lang): SOP[] {
  return SOP_META.map((meta) => ({
    id: meta.id,
    folderId: SYSTEM_FOLDER_ID,
    title: lang === 'zh' ? meta.titleZh : meta.titleEn,
    type: meta.type,
    isSystem: true,
    lastUsedAt: null,
    sortOrder: meta.sortOrder,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    steps: meta.steps.map((s) => resolveStep(s, lang)),
  }))
}
