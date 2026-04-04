# Anvilite · 锻石

> *经过锤炼的，才是真正的自己。*
> *What has been forged is truly yours.*

**Anvilite** is a gamified personal productivity desktop app. Your character is a mirror of your real growth — not a separate game shell.

**锻石**是一款游戏化个人生产力桌面应用。角色是用户真实成长的镜像，不是脱离现实的游戏壳。

---

## English

### What is Anvilite?

Anvilite turns your daily tasks and habits into an RPG growth system. Every task you complete earns XP, levels up your character, and develops the world around you. The philosophy is simple: **your character reflects who you are becoming, not a fantasy avatar you play.**

No punishment mechanics. No HP loss. No streak death. Only forward momentum.

### Core Features

**Task Management**
- One-time tasks with difficulty (1–5 ★), priority (urgent / high / medium / low), due dates, subtasks (up to 3 levels), and time tracking
- Quick capture via top input bar; full editing in a side drawer
- Drag-to-reorder, category tabs, smart auto-sort by status → priority → due date
- Soft delete with 30-day trash; undo within 5 seconds via toast

**Habit System**
- Recurring habits with flexible cycles: daily, weekdays, weekly, bi-weekly, monthly, or custom
- Streak tracking with tiered XP bonuses (up to +50% at 30-day streaks)
- Undo last completion within the same day
- Pause / archive / delete with optional XP refund

**XP & Level System**
- Base XP: ★=1, ★★=2, ★★★=3, ★★★★=5, ★★★★★=8
- Bonuses stack: on-time +20%, streak +3%/day (cap 50%), high difficulty (4–5★) +50%
- Level formula: `round(5 × ln(level+1) × level)` — fast early, sustainable long-term
- Level-down is allowed when XP decreases (honest feedback)
- Two title presets (Forging / Classic RPG, 8 tiers each) + fully custom titles
- Ore currency (1:1 with XP earned) for decorations and theme unlocks — never taken back on undo

**World Map**
- Isometric pixel-art map with up to 12 regions
- Each region has 6 prosperity levels (Barren → Illustrious), driven by your skill XP
- Enter any region to access its interior space
- Default regions: Home, Arena, Library Tower, Inspiration Workshop, Forge, Archive Hall

**Interior Space**
- Each region has a full-screen pixel scene with a translucent glass panel overlay
- Task list, habit list, skill progress, time investment stats, decoration shop — all per-region
- Ore-funded decoration system; purchase decorations unlocked by prosperity level

**Archive Hall**
- Two-tab interior: Data Overview (5 lifetime stats + skill radar chart) + Timeline (Chronicle)
- Timeline shows all growth events: task completions, level-ups, area upgrades, badges earned
- Full event history, never auto-purged

**Dashboard**
- Free-layout card grid (drag, resize, hide)
- Cards: Tasks, Habits, Character Mini, Stats, Quick Create, Growth Heatmap, Inspirations
- Heatmap follows theme accent color; month and week views

**Quick Notes (Inspirations)**
- `Ctrl+Shift+N` to capture any passing thought
- One-click convert to task (pre-fills title and category)
- Inspiration card on the dashboard shows all unconverted ideas

**Visual Feedback**
- XP float animations on task completion
- Level-up celebration overlay with particle effects
- Streak milestone popups at 3 / 7 / 14 / 30 days
- Badge notifications when new badges are earned
- Toast undo system

**Themes & i18n**
- 8 themes: 4 dark (Forged Iron / Ore Teal / Blazing Cast / Forest Green) + 4 light (Morning White ★ default / Mint Paper / Parchment / Marble Gray)
- Full Chinese / English support, switchable at runtime

### Tech Stack

| Layer | Technology |
|-------|-----------|
| Desktop | Electron 41 |
| Frontend | React 19 + TypeScript 5.9 (strict mode) |
| State | Zustand 5 + persist middleware (localStorage) |
| Animation | Framer Motion 12 |
| Styling | Tailwind CSS 3 + CSS Variables |
| Testing | Vitest |
| i18n | Custom type-safe hook (609 keys × 2 languages) |

### Getting Started

```bash
# Install dependencies
npm install

# Development (Electron + Vite HMR)
npm run dev

# Build for production
npm run build
```

### Design Principles

1. **No punishment** — no HP loss, no streak death, no penalties
2. **Ore is permanent** — earned ore is never taken back on undo or delete
3. **Honest levels** — levels can decrease if XP decreases (real feedback)
4. **Complete record** — growth events are never auto-purged
5. **Gentle encouragement** — 5 positive work states, no negative framing

---

## 中文介绍

### 这是什么？

锻石将你的日常任务和习惯转化为一套 RPG 成长系统。你完成的每一个任务都会为角色带来 XP、推动升级、让世界地图上的区域繁荣生长。核心理念只有一句话：**角色是你真实成长的镜像，不是你扮演的游戏壳。**

没有惩罚机制，没有血条损失，没有断签死亡。只有向前的动力。

### 核心功能

**任务系统**
- 一次性任务，支持难度（1–5 ★）、优先级（紧急 / 高 / 中 / 低）、截止日期、子任务（最多3层）和计时
- 顶部输入框快速创建；右侧抽屉完整编辑
- 拖拽排序、分类 Tab 筛选、按状态→优先级→截止日自动排序
- 软删除 + 30天回收站；5秒 Toast 撤销

**习惯系统**
- 周期性习惯，支持每天 / 工作日 / 每周 / 每两周 / 每月 / 自定义
- 连击追踪，阶梯 XP 加成（30天连击最高 +50%）
- 当天完成可撤销
- 支持暂停 / 归档 / 删除（可选择是否收回 XP）

**XP 与等级体系**
- 基础 XP：★=1, ★★=2, ★★★=3, ★★★★=5, ★★★★★=8
- 加成叠加：按时完成 +20%，连击 +3%/天（上限50%），高难度（4-5★）+50%
- 等级公式：`round(5 × ln(level+1) × level)` — 前期快、后期稳
- 等级允许降级（XP 真实反映你的状态）
- 两套预设称号（锻造路 / 经典 RPG，各8级）+ 完全自定义称号
- 矿石货币（与 XP 1:1 同步获得），用于购买装饰和解锁主题皮肤 — 撤销/删除时永不收回

**世界地图**
- 等距像素风地图，最多 12 个区域
- 每个区域有 6 级繁荣度（荒芜→辉煌），由该区域的技能 XP 驱动
- 双击进入区域内部空间
- 默认区域：家园、竞技场、书阁高塔、灵感工坊、锻造坊、档案馆

**区域内部空间**
- 全屏像素场景背景 + 半透明磨砂玻璃面板
- 按区域筛选的任务列表、习惯列表、技能进度、时间投入统计、装饰商店
- 矿石购买装饰，繁荣等级解锁新装饰

**档案馆**
- 两个 Tab：数据总览（5项终身统计 + 技能雷达图）+ 时光卷轴
- 时光卷轴记录全部成长事件：任务完成、升级、区域升级、获得徽章
- 完整事件历史，永不自动清理

**仪表盘**
- 卡片式自由布局（拖拽、调整大小、显示/隐藏）
- 卡片：任务、习惯、角色迷你卡、统计、快速创建、成长热力图、灵感记录
- 热力图颜色跟随主题 accent 色；支持月视图和周视图

**灵感速记**
- `Ctrl+Shift+N` 随时捕捉想法
- 一键转为任务（预填标题和分类）
- 仪表盘灵感卡片展示所有未转化的灵感

**视觉反馈**
- 任务完成时 XP 飘字动画
- 升级时全屏庆祝 + 粒子特效
- 连击阶梯提示（3 / 7 / 14 / 30天）
- 获得徽章时通知
- Toast 撤销系统

**主题与国际化**
- 8套主题：暗色4套（锻铁紫 / 矿石青 / 烈焰铸 / 翠林绿）+ 亮色4套（晨光白★默认 / 薄荷纸 / 羊皮卷 / 云石灰）
- 完整中英文支持，运行时切换

### 技术栈

| 层级 | 技术 |
|------|------|
| 桌面端 | Electron 41 |
| 前端 | React 19 + TypeScript 5.9（严格模式） |
| 状态管理 | Zustand 5 + persist 中间件（localStorage） |
| 动画 | Framer Motion 12 |
| 样式 | Tailwind CSS 3 + CSS 变量 |
| 测试 | Vitest |
| 国际化 | 自研类型安全 hook（609 key × 2 语言） |

### 快速开始

```bash
# 安装依赖
npm install

# 开发模式（Electron + Vite HMR）
npm run dev

# 生产构建
npm run build
```

### 设计原则

1. **不做任何惩罚** — 无血条损失、无断签惩罚、无任何负面机制
2. **矿石永久保留** — 撤销或删除任务时矿石绝不收回
3. **等级允许降级** — XP 减少时等级随之降低，真实反映你的状态
4. **完整成长记录** — 成长事件永不自动清理
5. **温和正向引导** — 5种正向工作状态表达，无负面措辞

---

*Built with [Claude Code](https://claude.ai/code) · Powered by Electron + React + TypeScript*
