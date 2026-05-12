# CLAUDE.md — Anvilite 锻石 项目上下文

> 这是 Claude Code 的项目上下文文件，每次会话自动读取。
> 包含项目概述、技术规范、编码规范和关键约束。
> 详细产品需求见 PRD.md。

---

## 项目概述

Anvilite（锻石）是一个RPG游戏化的桌面任务管理应用。核心理念：角色是用户真实成长的镜像，不是脱离现实的游戏壳。

**核心公式**：认真的任务管理 × 角色即镜像 × 温和正向引导 × 完整成长记录

---

## 技术栈

| 技术 | 版本 | 用途 |
|------|------|------|
| Electron | latest | 桌面应用框架 |
| React | 18 | UI框架 |
| TypeScript | 5.x | 类型安全 |
| Zustand | latest | 状态管理 |
| Framer Motion | latest | 动画系统 |
| Tailwind CSS | 3.x | 样式 |
| electron-store | latest | 本地JSON持久化 |

运行环境：Windows优先，后续跨平台。

---

## 项目结构

```
anvilite/
├── electron/
│   ├── main.ts
│   └── preload.ts
├── src/
│   ├── main.tsx
│   ├── App.tsx
│   ├── components/
│   │   ├── layout/             # Sidebar, TopBar, StatusBar
│   │   ├── dashboard/          # Dashboard, TaskCard, HabitCard, StatsCard, CharacterMini, QuickCreate, GrowthTrend
│   │   ├── tasks/              # TaskList, TaskItem, TaskDrawer, QuickInput, CategoryTabs, SubtaskView
│   │   ├── worldmap/           # WorldMap, AreaNode, AreaInfoBar, MapControls, AddAreaModal
│   │   ├── interior/           # InteriorSpace, SceneBackground, LeftPanel, RightPanel, DecoShop, HabitManager
│   │   ├── milestone/          # MilestoneHall, CharacterPanel, StoneList, BadgeWall, TitleCabinet
│   │   ├── timeline/           # Timeline, TimelineFilters, DayGroup, EventCard, MilestoneCard
│   │   ├── feedback/           # XPFloat, OreFloat, LevelUpCelebration, BadgeNotification, Toast
│   │   └── ui/                 # Button, Input, StarRating, PrioritySelect, CategorySelect, Drawer, Modal, ProgressBar, Heatmap
│   ├── stores/                 # taskStore, habitStore, characterStore, areaStore, badgeStore, milestoneStore, growthEventStore, settingsStore, timerStore
│   ├── engines/                # xpEngine, levelEngine, streakEngine, prosperityEngine, habitEngine, badgeEngine
│   ├── types/                  # task.ts, habit.ts, character.ts, area.ts, badge.ts, growthEvent.ts, theme.ts
│   ├── themes/                 # 8套主题定义文件
│   ├── i18n/                   # zh.ts, en.ts
│   ├── utils/                  # time.ts, format.ts, id.ts
│   └── assets/                 # 像素素材（palette, map, character, decorations, badges, ui）
├── PRD.md
├── CLAUDE.md
├── package.json
├── tsconfig.json
├── tailwind.config.ts
└── electron-builder.yml
```

---

## 编码规范

### TypeScript
- 严格模式 (`strict: true`)
- 所有组件使用函数式组件 + Hooks
- 类型定义集中在 `src/types/`
- 业务逻辑抽取到 `src/engines/`（纯函数，可测试）
- 状态管理使用 Zustand，每个领域一个store

### React
- 组件命名：PascalCase，文件名与组件名一致
- Props定义使用 `interface XxxProps {}`
- 避免在组件内写复杂计算逻辑，抽取到engine或hooks

### Tailwind CSS
- 使用CSS变量实现主题切换
- 不直接使用Tailwind颜色类（如 `bg-red-500`），改用 `bg-[var(--color-danger)]`
- 间距使用设计token

### 动画
- 所有动画使用 Framer Motion
- 动画参数严格遵循 PRD.md 中的定义，不自行调整
- 使用 `AnimatePresence` 管理列表增删动画
- 使用 `layout` 属性实现列表重排

---

## 设计Token（CSS变量）

```css
:root {
  /* 晨光白主题（默认） */
  --color-bg: #faf8f5;
  --color-surface: #ffffff;
  --color-surface-hover: #f5f2ed;
  --color-border: #e6e0d6;
  --color-text: #2c2520;
  --color-text-dim: #8c8078;
  --color-accent: #e8600a;
  --color-accent-hover: #f5780e;
  --color-secondary: #8b5cf6;
  --color-success: #16a34a;
  --color-danger: #dc2626;
  --color-warning: #d97706;
  --color-xp: #d97706;

  --spacing-xs: 4px;
  --spacing-sm: 8px;
  --spacing-md: 12px;
  --spacing-lg: 16px;
  --spacing-xl: 24px;
  --spacing-2xl: 32px;

  --radius-sm: 4px;
  --radius-md: 8px;
  --radius-lg: 12px;
  --radius-xl: 16px;
  --radius-full: 9999px;

  --font-zh: 'Noto Sans SC', 'PingFang SC', 'Microsoft YaHei', sans-serif;
  --font-en: 'Inter', var(--font-zh);
  --font-num: 'Inter', monospace;
}
```

字号：H1=28px/800, H2=20px/700, H3=16px/600, Body=14px/400, Small=12px/400, Tiny=10px/400

数字字体：font-weight: 600, font-feature-settings: 'tnum', letter-spacing: 0.02em

标签字体：12px, letter-spacing: 0.03em, padding: 5px 16px

---

## 关键约束（不可违反）

1. **不做任何惩罚机制** — 不存在HP损失、角色死亡、连击惩罚
2. **矿石不收回** — 撤销/删除任务时XP收回但矿石保留
3. **紧急=红色固定** — #dc2626 跨所有主题不变
4. **等级允许降级** — XP不足时等级降低
5. **分类选择器用按钮组** — 不用下拉菜单
6. **动画参数严格执行** — 核心动画不自由发挥
7. **区域上限12个**
8. **全量记录GrowthEvent** — 不自动清理
9. **温和中断表达** — 5种正向状态（充电/休憩/远行等）

---

## 数据持久化

electron-store 存储JSON。详细类型定义见 PRD.md。

---

## 开发优先级

1. **P0**：任务CRUD + XP计算 + 等级系统 + 基本UI布局 + 主题系统
2. **P1**：习惯系统 + 仪表盘 + 时间线 + 反馈动画
3. **P2**：世界地图 + 区域内部空间 + 繁荣度
4. **P3**：里程碑殿堂 + 徽章系统 + 装饰商店 + 矿石消费
5. **P4**：像素素材替换占位图
