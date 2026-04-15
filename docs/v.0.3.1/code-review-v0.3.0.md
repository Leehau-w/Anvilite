# Anvilite v0.3.0 Code Review Report

> 审查日期：2026-04-15
> 审查范围：全量代码（types / engines / stores / components / utils）
> 测试状态：169/169 pass | TypeScript: ~80 errors (tsc --noEmit)

---

## A. Critical Bugs

### A1. `HabitDrawer` — `addHabit` 缺少 `sortOrder`

**文件**: `src/stores/habitStore.ts:25`, `src/components/dashboard/HabitDrawer.tsx:91-107`

`addHabit` 的参数类型 Omit 列表未包含 `sortOrder`，导致调用方必须传入但实际未传。运行时 `makeDefaultHabit` 用 `Date.now()` 覆盖，不崩溃但类型契约错误。

**修复**: 在 Omit 列表中添加 `'sortOrder'`。

### A2. `Area.emoji` — 幽灵属性，始终回退默认值

**文件**: `src/components/interior/ArchiveSpace.tsx:346`, `src/components/milestone/MilestoneHall.tsx:150`

代码读取 `area?.emoji`，但 `Area` 类型无 `emoji` 字段。所有区域始终显示回退值 `'📁'`，丢失了模板 emoji。应使用 `AREA_TEMPLATES[area.templateId]?.prosperityEmojis` 查找。

### A3. `Habit.parentId` — 已移除字段的死代码过滤

**文件**: `src/components/interior/InteriorSpace.tsx:73,76`, `src/components/tasks/TaskList.tsx:1045-1048`

v0.3 子任务重构后 `parentId` 已从 `Habit` 类型移除，但组件仍用 `!h.parentId` 过滤。该字段恒为 `undefined`，过滤无效。

---

## B. Type System Issues

### B1. `ReturnType<typeof useStore>` 解析为 `unknown`

Zustand v5 + `persist()` 中间件导致 `ReturnType<typeof useTaskStore>` 丢失类型信息，波及 ~20 个错误：
- `ArchiveSpace.tsx`（`.tasks` on `unknown`）
- `TaskList.tsx`（`.customTaskGroups`, `.customHabitGroups`, `.areas`）
- `useProsperityWatcher.ts`（`.tasks`）

**修复**: 用 Store 的 state interface 直接引用（如 `Task[]`）替代 `ReturnType` 推导。

### B2. ~30 处多余的 `import React`

React 19 + `jsx: "react-jsx"` 不需要 React 在作用域内。

### B3. `ErrorBoundary.tsx` — `ReactNode` 需 type-only import

`verbatimModuleSyntax` 要求类型导入使用 `type` 关键字。

### B4. `TaskItem.tsx:209` — Framer Motion `ease` 类型不匹配

`ease: [0.4, 0, 1, 1]` 被推断为 `number[]` 而非元组，需加 `as const`。

### B5. ~15 处未使用变量

涉及 `Dashboard`, `CharacterMiniCard`, `AnimatedXPBar`, `InspirationCard`, `Timeline`, `MilestoneHall`, `TaskDrawer`, `LevelUpCelebration`, `TaskList`, `ArchiveSpace` 等。

---

## C. Logic / Data Integrity

### C1. `characterStore.prestige` — totalXP 不重置（设计确认）

`prestige()` 重置 `level/currentXP` 但保留 `totalXP`。结合 rehydrate 时的 XP 重算逻辑，需确认是否符合预期。

### C2. `habitStore.undoComplete` — 事件匹配脆弱

使用 `e.title.includes(habit.title)` 匹配要删除的 growth event。若两个习惯名称有包含关系，可能误删。

### C3. `HabitDrawer` — `TODAY` 常量跨午夜过期

模块级 `const TODAY` 在模块加载时计算，应用跨午夜运行后新建习惯会拿到昨天日期。

### C4. `BadgeChecker` — `earnedIds` 不在依赖数组中

当前无害（徽章只增不减），但若未来加入撤销功能会出问题。

---

## D. Code Quality

### D1. `FeedbackContext` — 模块级 `let _id = 0`

建议改为 `useRef` 避免 HMR 累积。

### D2. `ArchiveSpace` — 接受 `area`/`prosperity` props 但未使用

子组件从 store 自行获取数据，props 形同虚设。

### D3. `dataExport.ts` — `APP_VERSION` 硬编码 `'0.3.0'`

未与 `package.json` 同步。

### D4. `accountManager.deleteAccount` — 默认账号 key 检测依赖正则

使用 `/^[a-f0-9]{8}-/` 区分账号，有误匹配风险。

### D5. `habitEngine.getNextRefreshText` — 中文硬编码

返回 `下次：周一` 等中文字符串，绕过了 i18n 系统。

### D6. `storageMonitor.ts` — 注释与实现不一致

注释提到 electron-store/%APPDATA%，但实际测量 localStorage。

### D7. 全局大量 inline styles

导致无法使用 CSS 伪类、增加重渲染成本、响应式困难。

---

## E. 修复优先级

| 优先级 | 项目 | 状态 |
|--------|------|------|
| 立即 | A1 sortOrder Omit | 本次修复 |
| 立即 | A2 Area.emoji | 本次修复 |
| 立即 | A3 parentId 死代码 | 本次修复 |
| 立即 | B1-B5 类型修复 | 本次修复 |
| 立即 | C3 stale TODAY | 本次修复 |
| 立即 | D3 APP_VERSION | 本次修复 |
| 立即 | D5 habitEngine i18n | 本次修复 |
| v0.3.1 | C2 事件匹配 | 待排期 |
| v0.4 前 | D7 inline styles | 长期改进 |
