# v0.3.0 → v0.3.1 代码修复日志

> 日期：2026-04-15
> 基于 `code-review-v0.3.0.md` 审查报告，修复全部问题
> 修复后状态：`tsc --noEmit` 0 errors | `vitest run` 169/169 pass
> 涉及文件：50 files changed, +167 -116

---

## A. Critical Bugs（3 项）

### A1. `addHabit` 缺少 `sortOrder` 导致类型契约错误

| 文件 | 行 |
|------|-----|
| `src/stores/habitStore.ts` | 25 |

`addHabit` 参数的 Omit 列表未包含 `sortOrder`，类型要求调用方传入但实际未传。

**修复**：在 Omit 列表中添加 `'sortOrder'`。

### A2. `Area.emoji` 幽灵属性，区域图标始终回退 📁

| 文件 | 行 |
|------|-----|
| `src/components/interior/ArchiveSpace.tsx` | 346 |
| `src/components/milestone/MilestoneHall.tsx` | 150 |

`Area` 类型无 `emoji` 字段，代码读取 `area?.emoji` 恒为 `undefined`，始终显示 `'📁'`。

**修复**：改为 `AREA_TEMPLATES[area.templateId]?.prosperityEmojis[0]` 查找正确 emoji。

### A3. `Habit.parentId` 已移除字段的死代码过滤

| 文件 | 行 |
|------|-----|
| `src/components/interior/InteriorSpace.tsx` | 73, 76 |
| `src/components/tasks/TaskList.tsx` | 1045–1048 |

v0.3 子任务重构后 `parentId` 已从 `Habit` 类型移除，`!h.parentId` 恒为 `true`，过滤无效。

**修复**：删除所有 `&& !h.parentId` 条件。

---

## B. 类型系统（5 项）

### B1. `ReturnType<typeof useStore>` 解析为 `unknown`

| 文件 | 行 |
|------|-----|
| `src/components/interior/ArchiveSpace.tsx` | 多处 |
| `src/components/tasks/TaskList.tsx` | 多处 |
| `src/hooks/useProsperityWatcher.ts` | 15 |

Zustand v5 + `persist()` 中间件导致 `ReturnType<typeof useStore>` 丢失类型。

**修复**：替换为直接接口引用（`Task[]`、`TaskGroup[]`、`HabitGroup[]`、`Area[]` 等）。

### B2. 25 个文件残留无用 `import React`

React 19 + `jsx: "react-jsx"` 不再需要显式导入 React。

**修复**：移除所有 25 个文件的 `import React` / `import React, {...}` 中的 React 部分。

<details>
<summary>完整文件列表</summary>

- `src/App.tsx`
- `src/components/dashboard/CharacterMiniCard.tsx`
- `src/components/dashboard/FlowsSummaryCard.tsx`
- `src/components/dashboard/HabitCard.tsx` → 同时移除旧 `getNextRefreshText`
- `src/components/dashboard/Heatmap.tsx`
- `src/components/dashboard/InspirationCard.tsx`
- `src/components/feedback/AnimatedXPBar.tsx`
- `src/components/feedback/BadgeNotification.tsx`
- `src/components/feedback/LevelUpCelebration.tsx`
- `src/components/feedback/PrestigeModal.tsx`
- `src/components/feedback/StreakMilestonePopup.tsx`
- `src/components/feedback/UndoToast.tsx`
- `src/components/interior/ArchiveSpace.tsx`
- `src/components/interior/DecoShop.tsx`
- `src/components/layout/StatusBar.tsx`
- `src/components/milestone/SkillRadarChart.tsx`
- `src/components/sop/SOPChecklistView.tsx`
- `src/components/sop/SOPContent.tsx`
- `src/components/sop/SOPItemListView.tsx`
- `src/components/sop/SOPScheduleView.tsx`
- `src/components/sop/SOPToTaskModal.tsx`
- `src/components/sop/SOPTree.tsx`
- `src/components/sop/SOPWorkflowView.tsx`
- `src/components/ui/CategorySelect.tsx`
- `src/components/ui/PriorityBadge.tsx`
- `src/components/ui/StarRating.tsx`
- `src/components/worldmap/AddAreaModal.tsx`
- `src/components/worldmap/AreaCard.tsx`

</details>

### B3. `ErrorBoundary` — `ReactNode` 需 type-only import

| 文件 | 行 |
|------|-----|
| `src/components/ui/ErrorBoundary.tsx` | 1 |

`verbatimModuleSyntax` 要求类型引用使用 `type` 前缀。

**修复**：`import { Component, ReactNode }` → `import { Component, type ReactNode }`

### B4. `TaskItem` — Framer Motion `ease` 需元组类型

| 文件 | 行 |
|------|-----|
| `src/components/tasks/TaskItem.tsx` | 209 |

`[0.4, 0, 1, 1]` 被推断为 `number[]`，不匹配 `Variants.ease` 的元组签名。

**修复**：添加 `as [number, number, number, number]` 类型断言。

### B5. 多个文件存在未使用的变量 / 导入

| 文件 | 修复内容 |
|------|---------|
| `src/components/dashboard/Dashboard.tsx` | 移除 `BigStat` 未使用的 `unit` prop 及 3 处调用 |
| `src/components/dashboard/CharacterMiniCard.tsx` | 移除未使用的 `AnimatedXPBar` 导入 |
| `src/components/feedback/AnimatedXPBar.tsx` | 移除未使用的 `progress` 变量和 `getXPProgress` 导入 |
| `src/components/dashboard/InspirationCard.tsx` | `{ onOpenModal: _onOpenModal }` 前缀标记 |
| `src/components/tasks/TaskDrawer.tsx` | 移除未使用的 `deleteTask`、`removeSubTask` |
| `src/components/tasks/TaskList.tsx` | `_moveHabitToGroup`、`_removeHabitFromGroup` 前缀标记 |
| `src/components/timeline/Timeline.tsx` | 移除未使用的 `useRef`、`useCallback`、`removeEvent`、`today` |
| `src/components/sop/SOPToTaskModal.tsx` | 移除未使用的 `SOPStep` 导入 |
| `src/components/milestone/MilestoneHall.tsx` | 移除未使用的 `makeAreaBadgeId` 导入 |

---

## C. 逻辑问题（1 项）

### C3. `HabitDrawer` 模块级 `TODAY` 常量跨午夜过期

| 文件 | 行 |
|------|-----|
| `src/components/dashboard/HabitDrawer.tsx` | 14 |

桌面应用长时间运行后，模块级 `const TODAY = new Date().toISOString().split('T')[0]` 不会刷新，导致跨午夜后新建习惯 startDate 使用旧日期。

**修复**：移除模块级常量，在 `makeDefault()` 函数内内联 `new Date().toISOString().split('T')[0]`。

---

## D. 代码质量（2 项）

### D3. `APP_VERSION` 硬编码 `'0.0.0'`

| 文件 | 行 |
|------|-----|
| `src/utils/dataExport.ts` | 4 |
| `vite.config.ts` | — |

导出备份中 `appVersion` 始终为 `'0.0.0'`。

**修复**：
- `vite.config.ts` 添加 `define: { __APP_VERSION__: JSON.stringify(process.env.npm_package_version ?? '0.0.0') }`
- `dataExport.ts` 改为 `declare const __APP_VERSION__: string`，运行时读取注入值

### D5. `habitEngine.getNextRefreshText` 中文硬编码

| 文件 | 行 |
|------|-----|
| `src/engines/habitEngine.ts` | 67–108 |
| `src/components/dashboard/HabitCard.tsx` | 10, 311 |
| `src/i18n/zh.ts` | 250–257 |
| `src/i18n/en.ts` | 253–260 |

Engine 层直接返回 `'下次：周三'` 等中文字符串，切英文后仍显中文。

**修复**：
- `getNextRefreshText` → `getNextRefreshInfo`，返回结构化 `NextRefreshInfo` 类型
- 新增 8 个 i18n 键（`habitNext_*`），中英文各一套
- `HabitCard.tsx` 新增 `formatRefreshInfo()` 使用 i18n 格式化

---

## E. tsc 编译期间发现的额外问题（8 项）

以下问题在运行 `tsc --noEmit` 验证修复时发现并一并修复：

| 文件 | 问题 | 修复 |
|------|------|------|
| `src/i18n/zh.ts`, `src/i18n/en.ts` | `worldmap_rename` / `worldmap_delete` 键不存在，tooltip 使用 `??` 回退 | 添加对应 i18n 键 |
| `src/components/worldmap/AreaCard.tsx` | `whileHover` 的 `as object` 类型过宽 | → `as TargetAndTransition` |
| `src/components/worldmap/AreaCard.tsx` | 未使用的 `import React` | 移除 |
| `src/components/worldmap/AddAreaModal.tsx` | 未使用的 `AnimatePresence` 导入 | 移除 |
| `src/components/interior/ArchiveSpace.tsx` | `RoutineSection` 未使用的 `habits` 参数 | 从签名和调用处移除 |
| `src/stores/habitStore.ts` | 对象字面量中属性重复定义（spread 前后各一次） | 将默认值移至 spread 之后，用 `??` 合并 |
| `src/engines/*.test.ts`, `src/stores/*.test.ts` | 测试 mock 使用已移除的 `parentId`/`childIds`/`nestingLevel`、`undefined` vs `null` 不匹配 | 更新 mock 数据与当前 `Task`/`Habit` 类型对齐 |
| `src/stores/createTaskFromSOP.test.ts` | 未使用的 `beforeEach` 导入 | 移除 |

---

## 修复文件清单

共 50 个文件变更，按模块分组：

### stores
- `habitStore.ts` — A1 sortOrder Omit + 对象属性去重

### engines
- `habitEngine.ts` — D5 getNextRefreshInfo 重构
- `habitEngine.test.ts` — mock 数据对齐
- `badgeEngine.test.ts` — mock 数据对齐
- `xpEngine.test.ts` — mock 数据对齐

### i18n
- `zh.ts` — +10 keys（habitNext_* + worldmap_rename/delete）
- `en.ts` — +10 keys（同上英文版）

### components/dashboard
- `HabitCard.tsx` — D5 formatRefreshInfo + B2 React
- `HabitDrawer.tsx` — C3 TODAY 内联
- `Dashboard.tsx` — B5 unit prop
- `CharacterMiniCard.tsx` — B5 AnimatedXPBar
- `InspirationCard.tsx` — B5 onOpenModal
- `FlowsSummaryCard.tsx` — B2 React
- `Heatmap.tsx` — B2 React

### components/feedback
- `AnimatedXPBar.tsx` — B5 progress
- `BadgeNotification.tsx` — B2 React
- `LevelUpCelebration.tsx` — B2 React + useState
- `PrestigeModal.tsx` — B2 React
- `StreakMilestonePopup.tsx` — B2 React
- `UndoToast.tsx` — B2 React

### components/tasks
- `TaskList.tsx` — A3 parentId + B1 ReturnType + B5 unused
- `TaskDrawer.tsx` — B5 deleteTask/removeSubTask
- `TaskItem.tsx` — B4 ease tuple

### components/interior
- `ArchiveSpace.tsx` — A2 emoji + B1 + B2 + habits 参数
- `InteriorSpace.tsx` — A3 parentId
- `DecoShop.tsx` — B2 React

### components/milestone
- `MilestoneHall.tsx` — A2 emoji + B5 makeAreaBadgeId
- `SkillRadarChart.tsx` — B2 React

### components/worldmap
- `AreaCard.tsx` — whileHover 类型 + React + i18n 键
- `WorldMap.tsx` — i18n 键
- `AddAreaModal.tsx` — AnimatePresence

### components/sop
- `SOPChecklistView.tsx` — B2 React
- `SOPContent.tsx` — B2 React
- `SOPItemListView.tsx` — B2 React
- `SOPScheduleView.tsx` — B2 React
- `SOPToTaskModal.tsx` — B2 React + B5 SOPStep
- `SOPTree.tsx` — B2 React
- `SOPWorkflowView.tsx` — B2 React

### components/ui
- `ErrorBoundary.tsx` — B3 type-only import
- `CategorySelect.tsx` — B2 React
- `PriorityBadge.tsx` — B2 React
- `StarRating.tsx` — B2 React

### components/layout
- `StatusBar.tsx` — B2 React

### components/timeline
- `Timeline.tsx` — B5 useRef/useCallback/removeEvent/today

### hooks
- `useProsperityWatcher.ts` — B1 ReturnType

### utils
- `dataExport.ts` — D3 APP_VERSION

### config
- `vite.config.ts` — D3 define __APP_VERSION__

### tests
- `createTaskFromSOP.test.ts` — beforeEach
