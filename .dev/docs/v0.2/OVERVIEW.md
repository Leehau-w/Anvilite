# Anvilite v0.2 — Claude Code 开发总纲

> **用途**：这是 v0.2 开发的主控文档。每次开始新任务前先阅读本文档了解全局规则，再根据任务编号查阅对应的子文档。
> **子文档索引**：见第五节

---

## 一、项目概况

Anvilite 是一款游戏化个人生产力 Electron 桌面应用。用户通过完成任务和习惯获得 XP 与矿石，驱动角色升级、区域繁荣、徽章解锁等成长体系。

### 技术栈

- **运行环境**：Electron 41 + Vite 8
- **前端**：React 19 + TypeScript 5.9（严格模式）
- **状态管理**：Zustand 5 + persist 中间件（localStorage）
- **动画**：Framer Motion 12
- **样式**：Tailwind CSS 3 + CSS Variables（8 套主题）
- **测试**：Vitest（v0.2 新引入）
- **国际化**：自研 i18n（类型安全，609 key × 2 语言）

### 架构分层（严格单向依赖）

```
types/       → 纯类型定义，零运行时代码
engines/     → 纯函数业务逻辑，无副作用，不 import stores 或 components
stores/      → Zustand 状态管理，可 import types 和 engines
components/  → React 组件，可 import 以上所有层
i18n/        → 翻译文件，被 components 和 stores 引用
utils/       → 工具函数，被任意层引用
```

**铁律**：engines 永远不 import stores。如果需要 store 数据，由调用方（component 或 store action）传入参数。

### 项目结构

```
anvilite/
├── electron/          # Electron 主进程 + preload
├── src/
│   ├── main.tsx       # React 入口
│   ├── App.tsx        # 路由：TopBar + Sidebar + main + StatusBar
│   ├── index.css      # CSS 变量（8 主题）+ 全局样式
│   ├── types/         # Task, Habit, Character, Area, Badge, Decoration, Settings, GrowthEvent, Account
│   ├── engines/       # xpEngine, levelEngine, prosperityEngine, badgeEngine, habitEngine
│   ├── stores/        # characterStore, taskStore, habitStore, areaStore, badgeStore, decorationStore, dashboardStore, settingsStore, growthEventStore, accountManager
│   ├── components/
│   │   ├── layout/    # TopBar, Sidebar, StatusBar, SettingsModal
│   │   ├── dashboard/ # TaskCard, HabitCard, CharacterMini, Heatmap
│   │   ├── tasks/     # TaskItem, TaskDrawer, QuickInput, TaskList
│   │   ├── worldmap/  # WorldMap, AreaNode, AreaInfoBar
│   │   ├── interior/  # InteriorSpace, ArchiveSpace, DecoShop
│   │   ├── milestone/ # MilestoneHall, SkillRadarChart, CharacterPanel
│   │   ├── timeline/  # 时光卷轴
│   │   ├── feedback/  # Toast, LevelUp, Badge, Prestige, Streak
│   │   └── ui/        # Drawer, CategorySelect, StarRating 等基础组件
│   ├── i18n/          # zh.ts, en.ts, index.ts (useT hook)
│   └── utils/         # time.ts, area.ts, id.ts
└── docs/              # 文档
```

---

## 二、编码规范

### 2.1 TypeScript

- **严格模式**，零 `any`，零编译错误
- 所有接口定义在 `types/` 目录，不在组件中内联定义 interface
- 新增字段必须在 `onRehydrateStorage` 中提供 `?? defaultValue` 兼容旧数据
- 使用 `const` 断言和联合类型替代 enum

### 2.2 React

- 函数式组件 + Hooks，不使用 class 组件
- 用 `useCallback` 包裹传递给子组件的回调函数
- 用 `useMemo` 做计算开销大的派生状态
- 条件渲染用 `&&` 或三元，不用 `if` 块
- 列表渲染必须提供稳定的 `key`（使用 item.id，不用 index）

### 2.3 Zustand Store

- 每个 Store 使用 `persist` 中间件，key 格式：`${getStoragePrefix()}-storeName`
- `onRehydrateStorage` 负责数据迁移和版本兼容
- 跨 Store 读取用 `useXxxStore.getState()`（在 action 内部），不在 Store 定义中 import 其他 Store 的 hook
- 新增 Store 字段时同步更新 `onRehydrateStorage` 的兼容逻辑

### 2.4 样式

- 优先使用 Tailwind 原子类
- 主题相关颜色必须使用 CSS 变量（`var(--color-xxx)`），不硬编码色值
- 需要动态计算的样式用 inline style
- 动画优先用 Framer Motion 声明式 API，不直接操作 DOM

### 2.5 i18n

- 所有用户可见文字使用 `useT()` hook 获取翻译函数 `t`
- 新增翻译 key 必须同时在 `zh.ts` 和 `en.ts` 中添加
- `zh.ts` 是类型源（`typeof zh`），`en.ts` 必须满足该类型
- 动态翻译使用函数类型：`key: (param: type) => string`
- **零硬编码中文**：组件中不出现中文字符串字面量

### 2.6 Framer Motion

- CSS 定位（position/translate）用外层 `<div>` 做，`motion.div` 只做动画属性
- 这是 v0.1 已解决的 bug 模式：Framer Motion 的 transform 会覆盖 CSS transform，必须分层

### 2.7 文件命名

- 组件文件：PascalCase（`TaskItem.tsx`）
- 工具/引擎/Store 文件：camelCase（`xpEngine.ts`、`taskStore.ts`）
- 类型文件：camelCase（`task.ts`）
- 测试文件：与源文件同名 + `.test.ts` 后缀，放在同目录

---

## 三、v0.2 开发范围

### 包含

| Phase | 内容 | 时间 |
|-------|------|------|
| Phase 1 | 8 个 Bug 修复 + 2 个功能 + 测试基建 | 1.5~2 周 |
| Phase 2 | 3 个功能完善 + 4 个 PRD Patch + 数据导出 | 2~3 周 |
| Phase 3 | 2 个 PRD Patch + 灵感记录 + 存储监控 | 3~4 周 |
| Phase 4 | 已完成项展示优化 + 习惯撤销机制 | 2~3 周 |

### 不包含（移至 v0.3+）

- Supabase 后端架构
- Web 版本
- 社交功能（好友/排行榜）
- 推送通知
- 淬火重铸系统（PATCH-06）

---

## 四、全局开发规则

### 4.1 数据迁移约定

所有字段变更必须通过 `onRehydrateStorage` 做向后兼容：

```typescript
onRehydrateStorage: () => (state) => {
  if (!state) return
  // 新增字段兼容
  state.items.forEach(item => {
    item.newField = item.newField ?? defaultValue
  })
}
```

### 4.2 分支规则

- 每个任务编号（BUG-01、FEAT-01、PATCH-01 等）对应一个 feature branch
- branch 命名：`v02/bug-01-dialog-center`、`v02/feat-02-remove-timer`
- 每个 branch 完成后合并到 `dev`，Phase 结束后 `dev` 合并到 `main` 打 tag

### 4.3 提交信息

格式：`[编号] 简述`

```
[BUG-01] fix: center confirmation dialog for high-difficulty tasks
[FEAT-02] feat: remove auto timer, add manual duration input
[PATCH-01] refactor: revise XP formula with tiered streak bonus
[TEST] test: add vitest config and engine unit tests
```

### 4.4 测试要求

- 修改 `engines/` 中的任何函数，必须同步更新或新增对应测试
- 测试文件位置：`src/engines/xpEngine.test.ts`（与源文件同目录）
- 运行测试：`npx vitest run`
- 修改 PATCH-01（XP 公式）前先写测试固定旧行为，再改实现，再更新测试断言

### 4.5 i18n 同步检查

每次涉及 UI 文案变更时：
1. 在 `zh.ts` 添加/修改 key
2. 在 `en.ts` 同步添加/修改
3. 编译确认零错误（类型系统会自动检查遗漏）

---

## 五、子文档索引

根据任务编号查阅对应文档：

| 文档 | 包含任务 | 适用阶段 |
|------|---------|---------|
| `phase1-bugs.md` | BUG-01 ~ BUG-08 | Phase 1 |
| `phase1-features.md` | FEAT-01, FEAT-02 | Phase 1 |
| `phase1-testing.md` | Vitest 配置 + 5 个引擎测试 | Phase 1 |
| `phase2-tasks.md` | FEAT-03/04/05, PATCH-01/02/03/07, 数据导出 | Phase 2 |
| `phase3-tasks.md` | PATCH-04/05, NEW-01, 存储监控 | Phase 3 |
| `phase4-tasks.md` | FEAT-06/07/08/09, 已完成项分组 + 习惯撤销 | Phase 4 |

**使用方式**：接到任务时，先确认任务编号 → 查阅对应子文档 → 按文档中的实现规格执行。如有与本总纲冲突之处，以本总纲为准。
