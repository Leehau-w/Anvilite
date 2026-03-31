# Anvilite v0.1 - 技术架构文档

## 一、技术栈

| 层级 | 技术 | 版本 | 用途 |
|------|------|------|------|
| 运行环境 | Electron | 41.1.0 | 桌面应用壳 |
| 前端框架 | React | 19.2.4 | UI 渲染 |
| 类型系统 | TypeScript | 5.9.3 | 静态类型检查 |
| 状态管理 | Zustand | 5.0.12 | 全局状态 + localStorage 持久化 |
| 动画 | Framer Motion | 12.38.0 | 过渡、手势、布局动画 |
| 样式 | Tailwind CSS + CSS Variables | 3.4.19 | 原子类 + 主题变量 |
| 构建 | Vite | 8.0.1 | 开发服务器 + 生产构建 |
| 打包 | electron-builder | 26.8.1 | 跨平台安装包 |
| 国际化 | 自研 i18n | - | 类型安全的翻译函数 |

---

## 二、项目结构

```
anvilite/
├── electron/
│   ├── main.ts          # Electron 主进程（窗口管理、IPC）
│   └── preload.ts       # 上下文桥接（暴露 window.electronAPI）
├── src/
│   ├── main.tsx         # React 入口（StrictMode）
│   ├── App.tsx          # 路由：TopBar + Sidebar + main + StatusBar
│   ├── index.css        # CSS 变量（8 主题）+ 全局样式
│   │
│   ├── types/           # 纯类型定义（零运行时）
│   │   ├── task.ts      # Task 接口
│   │   ├── habit.ts     # Habit 接口（含周弹性追踪）
│   │   ├── character.ts # Character 接口
│   │   ├── area.ts      # Area 模板 + 繁荣度常量
│   │   ├── badge.ts     # 31 枚徽章定义
│   │   ├── decoration.ts# 72 个装饰物定义
│   │   ├── settings.ts  # 设置 + 8 主题常量
│   │   ├── growthEvent.ts# 成长事件类型
│   │   └── account.ts   # 账号类型
│   │
│   ├── engines/         # 纯函数业务逻辑（无副作用）
│   │   ├── xpEngine.ts  # XP/矿石计算
│   │   ├── levelEngine.ts# 等级曲线、称号系统
│   │   ├── prosperityEngine.ts # 区域繁荣度引擎
│   │   ├── badgeEngine.ts# 徽章解锁检测
│   │   └── habitEngine.ts# 习惯调度、连续计算、容错
│   │
│   ├── stores/          # Zustand 状态管理
│   │   ├── accountManager.ts # 多账号管理（纯函数，非 Store）
│   │   ├── characterStore.ts # 角色状态
│   │   ├── taskStore.ts     # 任务 CRUD
│   │   ├── habitStore.ts    # 习惯 CRUD + 完成结算
│   │   ├── areaStore.ts     # 区域管理
│   │   ├── badgeStore.ts    # 徽章获取
│   │   ├── decorationStore.ts# 装饰物所有权
│   │   ├── dashboardStore.ts # 仪表盘网格布局
│   │   ├── settingsStore.ts  # 主题/语言设置
│   │   └── growthEventStore.ts# 成长事件记录
│   │
│   ├── components/      # React 组件
│   │   ├── layout/      # 顶级布局（TopBar, Sidebar, StatusBar, SettingsModal）
│   │   ├── dashboard/   # 仪表盘卡片（Task, Habit, Character, Heatmap）
│   │   ├── tasks/       # 任务列表（TaskItem, TaskDrawer, QuickInput）
│   │   ├── worldmap/    # 世界地图画布（WorldMap, AreaNode, AreaInfoBar）
│   │   ├── interior/    # 区域内部（InteriorSpace, ArchiveSpace, DecoShop）
│   │   ├── milestone/   # 里程碑殿堂（MilestoneHall, SkillRadarChart）
│   │   ├── timeline/    # 时光卷轴
│   │   ├── feedback/    # 反馈系统（Toast, LevelUp, Badge, Prestige, Streak）
│   │   └── ui/          # 基础组件（Drawer, CategorySelect, StarRating）
│   │
│   ├── i18n/            # 国际化
│   │   ├── zh.ts        # 中文翻译（609 key）
│   │   ├── en.ts        # 英文翻译（609 key）
│   │   └── index.ts     # useT() hook + LanguageProvider
│   │
│   └── utils/           # 工具函数
│       ├── time.ts      # 日期格式化、计时器
│       ├── area.ts      # 区域名称解析、分类迁移
│       └── id.ts        # UUID 生成
└── docs/                # 文档
```

---

## 三、数据层架构

### 3.1 状态管理模式

```
           ┌─────────────────────────────────┐
           │         localStorage             │
           │  anvilite-{accountId}-character   │
           │  anvilite-{accountId}-tasks       │
           │  anvilite-{accountId}-habits      │
           │  ...（9 个 Store 的持久化 key）    │
           └─────────┬───────────────┬────────┘
                     │  rehydrate    │  persist
           ┌─────────▼───────────────▼────────┐
           │     Zustand Stores (9 个)         │
           │  characterStore  taskStore        │
           │  habitStore      areaStore        │
           │  badgeStore      decorationStore  │
           │  dashboardStore  settingsStore    │
           │  growthEventStore                 │
           └─────────┬───────────────┬────────┘
                     │  useXxxStore()│
           ┌─────────▼───────────────▼────────┐
           │     React Components              │
           │  (读取状态 + 调用 action)          │
           └──────────────────────────────────┘
```

### 3.2 多账号隔离

```
accountManager.ts（非 Zustand，直接操作 localStorage）

全局 key：
  anvilite-accounts          → Account[] 列表
  anvilite-current-account   → 当前账号 ID

每账号 key（通过 getStoragePrefix() 生成）：
  默认账号：anvilite-character, anvilite-tasks, ...
  新账号：  anvilite-{uuid}-character, anvilite-{uuid}-tasks, ...

切换账号 → 写入 current-account → window.location.reload()
         → 所有 Store 重新初始化，读取对应 prefix 的数据
```

### 3.3 数据流示意（完成任务为例）

```
用户点击完成 → TaskItem.handleComplete()
  │
  ├─ taskStore.completeTask(id)     → 更新任务状态、记录完成时间
  ├─ xpEngine.calculateTaskXP()    → 计算 XP 和矿石
  ├─ characterStore.gainXPAndOre()  → 累加 XP/矿石，检测升级
  ├─ characterStore.recordActivity()→ 更新连续活跃天数
  ├─ growthEventStore.addEvent()    → 记录成长事件
  ├─ FeedbackContext.triggerFeedback()
  │     ├─ XPFloat      → 浮动 +XP 数字
  │     ├─ LevelUp      → 升级庆祝弹窗（如果升级）
  │     └─ StreakPopup   → 连续天数里程碑（如果达标）
  └─ BadgeChecker (useEffect)
        └─ badgeEngine.checkBadges() → 检测新徽章
              └─ BadgeNotification   → 徽章通知
```

---

## 四、引擎层设计

所有引擎为**纯函数**，无副作用，输入数据 → 输出结果。

### 4.1 XP 引擎

```
基础 XP = DIFFICULTY_MAP[difficulty]  // {1:1, 2:2, 3:3, 4:5, 5:8}
连续加成 = getStreakBonusRate(streakDays)  // 3d→10%, 7d→20%, 14d→30%, 30d→50%
按时加成 = isOnTime ? 1.2 : 1.0
难度加成 = difficulty >= 4 ? 1.5 : 1.0
最终 XP = round(基础 × 按时 × (1 + 连续) × 难度)
矿石 = XP（1:1）
```

### 4.2 等级引擎

```
升级所需 XP = round(5 × ln(level + 1) × level)
  Lv.1→5, Lv.5→16, Lv.10→30, Lv.20→60, Lv.50→147

称号阶梯 = [Lv.1, 6, 11, 16, 21, 31, 41, 51]
  锻造系: 破壳 → 熔炼 → 锤炼 → 锋芒 → 极意 → 铸魂 → 锻石 → 不朽
  RPG 系: 新手 → 学徒 → 冒险者 → 游侠 → 英雄 → 大师 → 史诗 → 传说
```

### 4.3 繁荣度引擎

```
技能等级 = skillXPToLevel(分类累计XP)  // 对数增长
繁荣等级 = 技能等级映射:
  0→荒芜(1), 1-3→聚落(2), 4-8→丰饶(3),
  9-15→繁荣(4), 16-25→鼎盛(5), 26+→辉煌(6)
```

### 4.4 徽章引擎

输入：tasks, habits, areas, character, streak, themeCount, prestigeCount, earnedSet
检查 8 类条件，返回新解锁的 badge ID 列表。

### 4.5 习惯引擎

- 调度判断：`isHabitDueToday(habit)` — 支持 8 种重复模式
- 连续计算：完成+1、跳过-10%、缺席-50%（或消耗容错）
- 容错充能：首次 7 连续获得，之后每 14 连续获得，上限 1 次

---

## 五、UI 架构

### 5.1 布局结构

```
┌─────────────────────────────────────────┐
│  TopBar (44px, -webkit-app-region:drag) │
├────┬────────────────────────────────────┤
│    │                                    │
│ S  │        main (flex: 1)              │
│ i  │   ┌──────────────────────────┐     │
│ d  │   │ Dashboard / TaskList /   │     │
│ e  │   │ WorldMap / MilestoneHall │     │
│ b  │   └──────────────────────────┘     │
│ a  │                                    │
│ r  │                                    │
├────┴────────────────────────────────────┤
│  StatusBar (32px, XP bar + title)       │
└─────────────────────────────────────────┘
```

### 5.2 主题系统

通过 CSS 变量 + `data-theme` 属性实现：
```css
:root { --color-bg: #faf8f5; --color-accent: #e8600a; ... }
[data-theme="forge-purple"] { --color-bg: #0c0a1a; --color-accent: #a78bfa; ... }
```

切换主题 = `document.documentElement.setAttribute('data-theme', id)`

### 5.3 动画体系

- **页面过渡**：AnimatePresence + mapVariants/interiorVariants（opacity + scale）
- **列表动画**：motion.div initial/animate/exit + stagger
- **微交互**：hover scale、按钮 whileHover/whileTap
- **庆祝效果**：LevelUp 弹窗（scale bounce）、XPFloat（translateY fade）、Badge toast（slideIn）
- **图表动画**：雷达图 polygon scale-in、进度条 width transition

### 5.4 国际化方案

```typescript
// zh.ts: 定义翻译对象（含函数类型的动态翻译）
const zh = {
  settings_title: '设置',
  task_toastDone: (xp: number) => `完成！+${xp} XP`,
  ...
}
export type Translations = typeof zh

// en.ts: 实现相同接口
const en: Translations = { ... }

// 使用: const t = useT(); t.settings_title / t.task_toastDone(10)
```

类型完全推导，新增 key 缺翻译立即报编译错误。

---

## 六、Electron 集成

```
main.ts:
  BrowserWindow({ frame: false, titleBarStyle: 'hidden' })
  IPC: window-minimize / window-maximize / window-close

preload.ts:
  contextBridge.exposeInMainWorld('electronAPI', {
    minimize: () => ipcRenderer.send('window-minimize'),
    maximize: () => ipcRenderer.send('window-maximize'),
    close:    () => ipcRenderer.send('window-close'),
  })

安全: contextIsolation: true, nodeIntegration: false
```

---

## 七、关键设计决策

| 决策 | 理由 |
|------|------|
| Zustand 而非 Redux | 轻量、零 boilerplate、天然支持 persist 中间件 |
| localStorage 而非 SQLite | 首版简单可靠，数据量小（单用户），无需安装依赖 |
| CSS Variables 而非 CSS-in-JS | 主题切换性能好，无运行时开销 |
| 纯函数引擎层 | 可测试、可复用、与 UI 解耦 |
| 多账号用 key 前缀隔离 | 零迁移成本，默认账号完全兼容旧数据 |
| window.location.reload 切换账号 | 避免 Store 热切换的复杂度和状态泄漏 |
| Framer Motion 而非 CSS Animation | 声明式、支持 AnimatePresence exit 动画、手势集成 |
