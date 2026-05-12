# Agent A — v0.3.1 开发日志

**日期**：2026-04-15（持续更新）
**角色**：Agent A

---

## Phase 1 — 修复 + F4 子项入口

### X2 — 编辑抽屉点击添加子项时自动关闭

**文件**：`src/components/ui/Drawer.tsx`

**根因**：遮罩层 `onClick={onClose}` 捕获了子元素冒泡事件，点击抽屉内任何按钮都会关闭。

**修复**：

```typescript
// 旧
onClick={onClose}

// 新
onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
```

仅直接点击遮罩层本身时才关闭。

### X3 — 切换分类 Tab 时任务卡片飞出动画

**文件**：`src/components/tasks/TaskList.tsx`

**根因**：切换分类 Tab 时 `Reorder.Group` 内 `TaskItem` 触发 `AnimatePresence` 的 exit 动画。分类切换应整体替换列表，不是逐项退出。

**修复**：在 `Reorder.Group` 外层容器加 `key={activeCategory}`，切换时整个容器重渲染，跳过单项退出动画。勾选完成时飞出动画不受影响。

### X4 — 子项选框样式不统一

**新建文件**：`src/components/ui/Checkbox.tsx`（37 行）

共享 Checkbox 组件，样式与父任务勾选按钮统一（绿色背景 + 白色勾号 SVG），替换 `SubTaskItem` 中原生 `<input type="checkbox">`。

### X1 — 应用图标未生效

**文件**：`electron/main.ts`、`electron-builder.json`

1. `electron-builder.json` 的 `win.icon` / `nsis.installerIcon` / `nsis.uninstallerIcon` 均指向 `build/icon.ico`
2. 新增 `extraResources` 配置，确保 `icon.ico` 被复制到打包资源目录
3. `main.ts` 打包模式 icon 路径从 `icon.png` 改为 `icon.ico`

**追加修复**（验收阶段发现）：

`main.ts` 硬编码 `http://localhost:5173`，当端口被占用 Vite 回落到其他端口时 Electron 加载空页面导致白屏。

改为读取 `vite-plugin-electron` 提供的环境变量：

```typescript
const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL

// ...
if (isDev && VITE_DEV_SERVER_URL) {
  win.loadURL(VITE_DEV_SERVER_URL)
```

### F4 — 子项入口优化

**文件**：`src/components/tasks/TaskItem.tsx`、`src/components/tasks/TaskDrawer.tsx`

**TaskItem**：
- 统一为主行中一个带边框的 `+` 小按钮，有无子项交互一致
- 所有模式（含仪表盘 compact）常显，已完成任务不显示
- hover 时边框+文字变 accent 色

**TaskDrawer**：布局调整为 标题 → 分类 → 标签 → 难度 → 优先级 → 截止日期 → **分割线** → **子项列表 + 输入框** → **分割线** → 备注 → 实际用时

---

## Phase 2 — F1 计时 + F2 标签

### F1 — 任务计时

#### timerEngine（纯函数）

**新建文件**：`src/engines/timerEngine.ts`、`src/engines/timerEngine.test.ts`

- `getElapsedSeconds(startedAt, accumulated)` — 返回当前已流逝总秒数
- `formatElapsed(totalSeconds)` — 格式化为 `MM:SS` 或 `HH:MM:SS`
- `TIMER_STALE_THRESHOLD` — 4 小时阈值常量

测试覆盖：startedAt 为 null、正在计时、格式化 0/65/3661。

#### Task 类型扩展

**文件**：`src/types/task.ts`

```typescript
timerStartedAt: string | null   // 计时开始 ISO 时间戳
timerAccumulated: number        // 暂停前已累计秒数
tags: string[]                  // 标签数组
```

#### taskStore timer actions

**文件**：`src/stores/taskStore.ts`

| Action | 行为 |
|--------|------|
| `startTask` | status → doing, timerStartedAt = now（已有则保留） |
| `pauseTask` | status → todo, accumulated += elapsed, timerStartedAt = null |
| `completeTask` | 结算 accumulated + elapsed → actualMinutes, 重置 timer |
| `startTimer` | 仅设 timerStartedAt（独立于 status） |
| `pauseTimer` | 仅暂停累计（独立于 status） |
| `stopTimer` | 结算 → actualMinutes, 重置 timer |

**迁移**：`onRehydrateStorage` 中 `MIGRATION_TIMER_TAGS_V031` 为旧任务补默认值 + 4 小时过期自动暂停。

#### habitStore 增强

**文件**：`src/types/habit.ts`、`src/stores/habitStore.ts`

- `Habit` 新增 `timerAccumulated: number`
- `addHabit` Omit 列表 + 默认值补 `timerAccumulated: 0`
- `pauseHabitTimer` — 暂停只累加 accumulated，不结算到 actualMinutes（仅 `completeHabit` 结算）
- `completeHabit` — 完成时自动将 accumulated + elapsed 写入 actualMinutes
- `onRehydrateStorage` — `MIGRATION_HABIT_TIMER_V031` + 4 小时过期自动暂停

#### TimerBadge 组件

**新建文件**：`src/components/tasks/TimerBadge.tsx`（63 行）

- 计时中：accent 10% 背景 + accent 文字 + 脉冲圆点动画
- 暂停态：dim 文字，无脉冲
- 每秒 `setInterval` 更新，`startedAt` 变化时重置
- `motion.span` 脉冲：`scale [1→1.3→1]`, `opacity [1→0.5→1]`, 1.5s 循环

#### UI 集成

**TaskItem**：
- doing 状态：显示 TimerBadge（点击 = pauseTask）
- todo + accumulated > 0（暂停态）：显示暗色 TimerBadge（点击 = startTask 恢复）
- 空闲态：显示 ▶ 按钮

**HabitCard（仪表盘）+ TaskList 习惯卡**：同步适配三态。

**Stale timer toast**：`App.tsx` 中 `StaleTimerWatcher` 组件，读取 `sessionStorage('anvilite-stale-timers')` 弹提示。

### F2 — 标签系统

#### tagColor 工具

**新建文件**：`src/utils/tagColor.ts`、`src/utils/tagColor.test.ts`

- `TAG_PALETTE` — 10 色调色板
- `getTagColor(tagName)` — hash 取模，相同标签名稳定返回同一颜色

#### TagPill 组件

**新建文件**：`src/components/tasks/TagPill.tsx`（49 行）

- 背景：`color-mix(in srgb, ${color} 15%, transparent)`
- 文字：纯色
- sm（卡片）：11px / 2px 8px；md（抽屉）：12px / 4px 12px
- 可选 `onRemove` 显示 × 按钮

#### TagInput 组件

**新建文件**：`src/components/tasks/TagInput.tsx`（134 行）

- `+ 添加标签` 虚线按钮 → 展开内联输入框
- 输入时过滤 `allTags` 显示下拉建议（最多 5 条）
- 去重、上限 5 个、截断 20 字符
- Enter / 点击建议 → 添加；Escape → 取消

#### TagFilterBar 组件

**新建文件**：`src/components/tasks/TagFilterBar.tsx`（62 行）

- 胶囊按钮排列，选中态高亮（背景色 + 边框色）
- 右侧「清除筛选」下划线文字按钮
- 无标签时不渲染

#### 集成

| 位置 | 变更 |
|------|------|
| `TaskDrawer` | 分类下方添加 `TagInput`，allTags 从 taskStore 聚合 |
| `TaskItem` | 标题下方最多显示 3 个 `TagPill` + `+N`，compact 不显示 |
| `TaskList` | 分类 Tab 下方渲染 `TagFilterBar`（有标签时），并集筛选 |
| `taskStore` | `addTag`（去重 + 上限 5 + 截断 20）、`removeTag` |

---

## i18n 新增

`src/i18n/zh.ts` 和 `src/i18n/en.ts` 各新增 ~62 行，覆盖：

- Timer：`timer_start/pause/resume/stop/running/paused/autoRecorded/stalePaused`
- Tags：`tag_add/placeholder/maxReached/clearFilter/more`
- 子项：`subtask_add/placeholder`

---

## 验收阶段修复

### Timer 累计丢失

**问题**：`pauseTask` 将当前计时写入 `actualMinutes` 并重置 `timerAccumulated=0`。多次 start→pause 循环只保留最后一次的时间。

**修复**：
- `pauseTask` — 暂停时只累加 `timerAccumulated`，不结算到 `actualMinutes`、不重置
- `pauseHabitTimer` — 同理
- 仅 `completeTask` / `completeHabit` 最终结算写入 `actualMinutes`
- `TaskItem` / `HabitCard` / `TaskList` 习惯卡 — todo 状态下若 `timerAccumulated > 0` 显示暗色 TimerBadge（点击恢复计时）

### @tiptap/extension-table 导入错误

**问题**：`SOPRichEditor.tsx` 使用 `import Table from '@tiptap/extension-table'`，该包无 default export，导致运行时 SyntaxError 白屏。

**修复**：改为 `import { Table } from '@tiptap/extension-table'`。

### 子项入口 UI 统一

**问题**：有/无子项使用不同 UI 入口（`+` 图标 vs `+ 添加子项` 文字），仪表盘 compact 模式无入口，文字按钮质感差。

**修复**：
- 统一为主行中一个带边框的 `+` 小按钮，所有模式常显
- 移除底部 `+ 添加子项` 纯文字按钮
- hover 时边框+文字变 accent 色

### 折叠按钮 hover 效果

在 `TaskItem`、`TaskList` 习惯卡、`HabitCard` 三处折叠按钮加 hover 变色：收起态 hover → 边框+文字变 accent 色（展开态本身 accent 不变）。

---

## 变更文件清单

### 新建（7 个）

| 文件 | 行数 | 用途 |
|------|------|------|
| `src/engines/timerEngine.ts` | ~15 | 计时纯函数 |
| `src/engines/timerEngine.test.ts` | ~30 | timerEngine 测试 |
| `src/utils/tagColor.ts` | ~15 | 标签颜色 hash |
| `src/utils/tagColor.test.ts` | ~20 | tagColor 测试 |
| `src/components/tasks/TimerBadge.tsx` | 63 | 计时徽章组件 |
| `src/components/tasks/TagPill.tsx` | 49 | 标签胶囊组件 |
| `src/components/tasks/TagInput.tsx` | 134 | 标签输入 + 建议 |
| `src/components/tasks/TagFilterBar.tsx` | 62 | 标签筛选栏 |
| `src/components/ui/Checkbox.tsx` | 37 | 统一选框组件 |

### 修改（主要）

| 文件 | 主要变更 |
|------|---------|
| `src/types/task.ts` | +3 字段（timerStartedAt, timerAccumulated, tags） |
| `src/types/habit.ts` | +1 字段（timerAccumulated） |
| `src/stores/taskStore.ts` | timer/tag actions + 迁移 + completeTask 增强（+160 行） |
| `src/stores/habitStore.ts` | pauseHabitTimer 重写 + completeHabit 增强 + 迁移（+52 行） |
| `src/components/tasks/TaskItem.tsx` | timer 三态 + tags 显示 + 子项入口统一 + hover 效果（+139 行） |
| `src/components/tasks/TaskDrawer.tsx` | TagInput 集成 + 子项区域布局调整（+129 行） |
| `src/components/tasks/TaskList.tsx` | TagFilterBar + 标签筛选 + 习惯卡 timer/hover（+107 行） |
| `src/components/tasks/SubTaskItem.tsx` | 原生 checkbox → Checkbox 组件 |
| `src/components/dashboard/HabitCard.tsx` | timer 三态 + 折叠 hover（+71 行） |
| `src/components/ui/Drawer.tsx` | 遮罩层 click 修复 |
| `electron/main.ts` | icon.ico + VITE_DEV_SERVER_URL |
| `electron-builder.json` | extraResources |
| `src/App.tsx` | StaleTimerWatcher 组件 |
| `src/i18n/zh.ts` / `en.ts` | 各 +62 行 timer/tag/subtask 键 |

### 测试适配

| 文件 | 变更 |
|------|------|
| `src/engines/badgeEngine.test.ts` | Task mock 补新字段 |
| `src/engines/habitEngine.test.ts` | Habit mock 补 timerAccumulated |
| `src/engines/xpEngine.test.ts` | Task mock 补新字段 |

---

## 质量状态

| 检查 | 结果 |
|------|------|
| `tsc --noEmit` | 0 errors |
| `npx vitest run` | 185/185 pass |
| 净变更 | +2832 -964（65 files，含 Agent B 部分） |
