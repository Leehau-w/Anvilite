# 开发记录 — 2026-04-05

> 本次会话涵盖时光卷轴多项 Bug 修复、Phase 4 功能验收、以及自定义分组拖放新功能。

---

## 一、时光卷轴（ScrollTimeline / ArchiveSpace）Bug 修复

### 1. 区域升级图标颜色变灰

**现象**：卡片底部的事件数量统计中，🏘 `area_level_up` 符号颜色显示为灰色而非绿色。

**根因**：`EVENT_SYMBOL_COLORS` 的颜色查找使用 `string[0]`，对于 🏘（U+1F3D8，UTF-16 代理对）只取到第一个 surrogate，无法命中 Map key。

**修复**：`src/components/interior/ArchiveSpace.tsx`
```ts
// Before
const sym = p[0]
// After
const sym = [...p][0]
```

### 2. 档案馆（_milestone 区域）升级未记录到时光卷轴

**现象**：角色升级后档案馆的繁荣度应随之提升，但时光卷轴里没有 `area_level_up` 事件。

**根因**：`useProsperityWatcher` 早期版本跳过了 `_milestone` 区域（因为它不来自 `areaStore`）；`characterStore` 里的触发点也因时序问题不可靠。

**修复**：`src/hooks/useProsperityWatcher.ts`
- 新增 `getMilestoneProsperityLevel(characterLevel)` 函数，根据角色等级映射档案馆繁荣度（Lv1-3→1，Lv4-8→2，Lv9-15→3，Lv16-25→4，Lv26-40→5，Lv41+→6）
- Hook 额外订阅 `characterLevel`，当角色升级时同步检测档案馆繁荣度变化并写入 GrowthEvent

### 3. 档案馆初始就是 2 星

**现象**：新用户/角色 Lv.1，档案馆却显示 2 星。

**根因**：两处阈值都写错了：
1. `useProsperityWatcher`：旧判断 `lvl <= 0 → 1`，Lv.1 走到了 2
2. `src/components/worldmap/WorldMap.tsx` 第 108 行有硬编码的内联三元链，同样错误

**修复**：两处统一改为 `charLevel <= 3 → 1`。

### 4. 徽章通知中区域名称显示英文 key

**现象**：解锁区域徽章时通知里显示 `combat`、`study` 等英文 key，而非中文区域名。

**根因**：`BadgeNotification.tsx` 调用 `makeAreaBadgeDef(category, level)` 时直接传入原始 category key，未经翻译/用户重命名解析。

**修复**：
- `src/types/badge.ts`：`makeAreaBadgeDef` 新增可选参数 `displayName?: string`
- `src/components/feedback/BadgeNotification.tsx`：`resolveBadgeDef` 接收 `areas` 和 `t`，查找对应 area 后通过 `getAreaDisplayName(area, t)` 获取显示名传入

### 5. 时光卷轴图例 / 统计顺序调整

将图例和卡片底部统计的事件类型顺序统一改为：**里程碑 → 徽章 → 升级 → 区域升级**。

### 6. 卡片上下交替布局

`ArchiveSpace.tsx` 中，相邻月份卡片按 `idx % 2 === 0` 交替排布在时间轴上下两侧（`isAbove` prop），减少竖向占用，视觉更紧凑。

### 7. 卡片 hover 展开溢出窗口

**现象**：在小窗口下，悬停展开的卡片内容超出视口底部。

**修复**：
- 使用 `min-height: 0` + `flex: 1` 让事件列表在卡片内部滚动
- 上下两半容器始终 `overflow: hidden`，展开高度由内容驱动而非固定值

---

## 二、Phase 4 功能验收

阅读更新后的 `docs/v0.2/OVERVIEW.md` 和 `phase4-tasks.md` 后，逐项核查代码，确认四个功能均已完整实现：

| 编号 | 功能 | 状态 | 关键文件 |
|------|------|------|---------|
| FEAT-06 | 已完成任务分组视图（按月/按区域/自定义） | ✅ 已完成 | `TaskList.tsx` — `CompletedSection` |
| FEAT-07 | 已完成习惯分组视图（按区域/自定义） | ✅ 已完成 | `TaskList.tsx` — `CompletedHabitsSection` |
| FEAT-08 | 仪表盘已完成项展示优化 | ✅ 已完成 | `Dashboard.tsx`（只展示今日完成）、`HabitCard.tsx`（本周期完成） |
| FEAT-09 | 习惯完成撤销机制 | ✅ 已完成 | `HabitCard.tsx`、`habitStore.ts` — `undoComplete` |

所有相关 i18n key（`task_groupByMonth`、`dashboard_todayCompleted`、`dashboard_cycleCompleted`、`common_undo`、`habit_undoneToast` 等）均已在 `zh.ts` / `en.ts` 中同步。

`tsc --noEmit` 零错误。

---

## 三、自定义分组拖放支持（新增）

**需求**：在已完成任务的自定义分组视图下，支持通过拖拽将任务移入/移出分组，替代或补充原有的 `⋯` 菜单操作。

**实现**：`src/components/tasks/TaskList.tsx`

### 交互设计

- 任务行整体可拖动（`draggable`，`cursor: grab`）
- 每个自定义分组 + "未分组"区域均为有效 drop zone
- 拖入分组时：橙色虚线边框 + 淡橙背景高亮
- 拖入未分组区域时：灰色虚线边框 + 浅背景高亮
- 向空分组内拖入时，显示"拖放到此处"占位提示
- 即使当前没有未分组任务，拖动状态下"未分组"区域也会显示，方便移出分组

### 数据流

```
onDragStart: dataTransfer.set('taskId', id) + dataTransfer.set('fromGroupId', groupId|'')
onDrop(targetGroupId):
  if targetGroupId === '__ungrouped' && fromGroupId → removeTaskFromGroup
  if targetGroupId !== fromGroupId           → moveTaskToGroup
  if same group                              → no-op
```

### i18n 新增

| key | zh | en |
|-----|----|----|
| `task_dropHere` | 拖放到此处 | Drop here |

---

## 四、涉及文件汇总

| 文件 | 改动类型 |
|------|---------|
| `src/components/interior/ArchiveSpace.tsx` | Bug 修复（代理对、图例顺序、交替布局、溢出） |
| `src/hooks/useProsperityWatcher.ts` | Bug 修复（_milestone 区域、档案馆初始星级） |
| `src/components/worldmap/WorldMap.tsx` | Bug 修复（档案馆初始星级阈值） |
| `src/components/feedback/BadgeNotification.tsx` | Bug 修复（区域名显示） |
| `src/types/badge.ts` | Bug 修复（makeAreaBadgeDef 添加 displayName 参数） |
| `src/components/tasks/TaskList.tsx` | 新增拖放逻辑（DragState + drop zones + draggable rows） |
| `src/i18n/zh.ts` | 新增 `task_dropHere` |
| `src/i18n/en.ts` | 新增 `task_dropHere` |

---

## 五、Bug 修复（同日第二次会话）

本次对已有功能进行了 code review，发现并修复 6 个 bug。

### BUG-A：StreakMilestonePopup — FloatingBadge 水平居中失效

**文件**：`src/components/feedback/StreakMilestonePopup.tsx`

**现象**：3/7/14 天连击的浮动徽章向左偏移，不在屏幕水平中央。

**根因**：`FloatingBadge` 的 `motion.div` 在 `style` 中同时设置了 `transform: translateX(-50%)` 和 Framer Motion 的 `y` 动画。Framer Motion 执行动画时会整体替换 `transform` 属性，覆盖 CSS 的 `translateX(-50%)`。这是项目已知的 v0.1 历史 Bug 模式（Framer Motion 的 transform 覆盖 CSS 定位 transform）。

**修复**：将定位逻辑（`position: fixed`、`left: 50%`、`transform: translateX(-50%)`）移到外层普通 `<div>`，内层 `motion.div` 只保留动画属性。

### BUG-B：StreakMilestonePopup — useEffect 闭包陈旧引用

**文件**：`src/components/feedback/StreakMilestonePopup.tsx:40`

**根因**：`useEffect` 依赖数组只有 `[milestone]`，缺少 `cfg` 和 `onDismiss`。若父组件重渲染更新了 `onDismiss` 引用，自动关闭计时器会调用旧版回调。

**修复**：依赖数组改为 `[milestone, cfg, onDismiss]`。

### BUG-C：LevelUpCelebration — useEffect 闭包 + 计时器时长不响应 titleChanged

**文件**：`src/components/feedback/LevelUpCelebration.tsx:23`

**根因**：`useEffect` 依赖数组只有 `[visible]`，缺少 `onDismiss` 和 `titleChanged`。`titleChanged` 为 `true` 时计时器应延长至 3700ms（展示称号变化），但若 effect 捕获的是旧值则实际用 2200ms 提前关闭。

**修复**：依赖数组改为 `[visible, onDismiss, titleChanged]`。

### BUG-D：LevelUpCelebration — 硬编码中文字符串

**文件**：`src/components/feedback/LevelUpCelebration.tsx:87`

**根因**：升级弹窗底部"点击任意位置继续"为硬编码中文，违反"零硬编码中文"规范。

**修复**：改用已有翻译 key `t.streakPopup_dismiss`（中文"点击任意位置继续"/ 英文"Click anywhere to continue"）。同时为该组件补充了 `useT()` 和 `import { useT } from '@/i18n'`。

### BUG-E：粒子效果在 render 期间直接调用 Math.random()（闪烁）

**文件**：`src/components/feedback/LevelUpCelebration.tsx`、`src/components/feedback/StreakMilestonePopup.tsx`

**根因**：`Particles`、`MiniParticles`、`FireParticles` 组件在渲染期间直接调用 `Math.random()` 生成粒子参数（距离、大小、延迟）。每次父组件触发重渲染，这些随机值都会重新生成，导致粒子位置和大小在动画中途跳变闪烁。

**修复**：将粒子参数数组改为 `useMemo(() => [...], [count])` 缓存，只在 `count` 变化时重新生成。`Math.random()` 仅在 mount 时执行一次。

### BUG-F：InspirationCard — 全部转化后空状态文案语义错误

**文件**：`src/components/dashboard/InspirationCard.tsx:50`

**根因**：所有灵感均已转化为任务时，空状态提示复用了 `t.inspiration_converted`（"已转为任务"），语义为单条灵感的状态标签，用作整体空状态文案不准确。

**修复**：新增 i18n key `inspiration_allConverted`（中文"所有灵感已转为任务" / 英文"All ideas converted to tasks"），同步更新 `zh.ts`、`en.ts`，`InspirationCard` 改用新 key。

---

## 六、文档与 README 整理

- 重写 `README.md`，补充中英文双语项目介绍（功能概览、技术栈、快速开始、设计原则）
- 将 v0.1 开发文档归档至 `docs/v0.1_history/`
- 新建 `docs/user-guide.md`（v0.2 版用户指南）
- 新建 `docs/CHANGELOG.md`（版本更新记录）
- 清理 `docs/` 根目录，仅保留面向用户的文档（`user-guide.md`、`CHANGELOG.md`）
- `docs/v0.1_history/` 及 `docs/CLAUDE.md` 副本已从工作目录删除，但完整保留在 git 历史中
  - 溯源方式：`git show 624caa8:docs/v0.1_history/<文件名>`
  - 或在 GitHub 浏览：`https://github.com/Leehau-w/Anvilite/tree/624caa8/docs/v0.1_history`
