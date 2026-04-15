# 仪表盘 vs 任务Tab — 不一致性调查报告

> 日期：2026-04-15
> 范围：Dashboard（仪表盘）与 TaskList（任务Tab）中任务/习惯的功能实现差异
> 目的：识别两套视图中同一功能的实现碎片化问题，为后续重构提供决策依据

---

## 一、架构总览

```
仪表盘 (Dashboard.tsx)                  任务Tab (TaskList.tsx)
├── TaskItem (复用 tasks/TaskItem)      ├── TaskItem (同一组件 ✓)
├── HabitCard (dashboard/)              ├── HabitsTab → HabitRow (tasks/TaskList.tsx 内部)
│   ├── HabitItem (内部)                │   ├── SubHabitItem (内部)
│   ├── DashSubHabitItem (内部)         │   └── ... 
│   ├── CompletedHabitItem (内部)       │
│   └── ProgressButton (内部)           │
├── HabitDrawer (dashboard/)            ├── HabitDrawer (复用 dashboard/HabitDrawer ✓)
├── HabitManageModal (dashboard/)       └── (无管理模态框，内联在 HabitsTab)
└── TaskDrawer (复用 tasks/TaskDrawer)  └── TaskDrawer (同一组件 ✓)
```

**关键发现**：任务（Task）复用良好——仪表盘和任务Tab共享同一个 `TaskItem` 和 `TaskDrawer`。但习惯（Habit）完全碎片化——两边各自实现了一套渲染和交互逻辑。

---

## 二、具体不一致点

### 1. 习惯行组件：3 套独立实现

| 组件 | 位置 | 职责 |
|------|------|------|
| `HabitItem` | `dashboard/HabitCard.tsx:319` | 仪表盘内习惯行（可完成、可跳过） |
| `HabitRow` | `tasks/TaskList.tsx:1509` | 任务Tab 习惯管理行（暂停/恢复/铭刻/隐藏/删除） |
| `CompletedHabitItem` | `dashboard/HabitCard.tsx:211` | 仪表盘已完成习惯行 |

**差异明细**：

| 功能 | HabitItem（仪表盘） | HabitRow（任务Tab） |
|------|---------------------|---------------------|
| 完成操作 | ✓ 按钮 / ProgressButton | 无 |
| 跳过操作 | ✓ | 无 |
| 开始/暂停计时 | ✓ TimerBadge | ✓ TimerBadge（代码独立） |
| 连续次数 🔥 | ✓ | ✓ |
| 下次刷新时间 | ✓ (`getNextRefreshInfo`) | 无 |
| 分类/重复标签 | 无 | ✓ (`catLabel` + `repeatLabel`) |
| 暂停/恢复 | 无 | ✓ hover 操作 |
| 铭刻 ⭐ | 无 | ✓ hover 操作 |
| 铭刻为精通 | 无 | ✓ hover 操作 |
| 隐藏 | 无 | ✓ hover 操作 |
| 删除（二次确认） | 无 | ✓ hover 操作 |
| 子项展示 | ✓ `DashSubHabitItem` | ✓ `SubHabitItem` |
| 子项编辑/删除/嵌套 | 无（仅 toggle） | 无（仅 toggle） |
| 点击编辑 | ✓ `onEdit` | ✓ `onEdit` |

**问题**：用户在仪表盘能看到"下次刷新时间"但看不到分类标签；在任务Tab能看到分类标签但看不到刷新时间。两种视图的信息密度和操作集完全不同，但展示的是同一条习惯数据。

### 2. 子项组件：3 套独立实现

| 组件 | 用于 | 功能 |
|------|------|------|
| `SubTaskItem` | `tasks/SubTaskItem.tsx` — Task 子任务 | checkbox + 编辑 + 删除 + 添加子项（max 3层）|
| `DashSubHabitItem` | `dashboard/HabitCard.tsx:480` — 仪表盘 Habit 子项 | checkbox only |
| `SubHabitItem` | `tasks/TaskList.tsx:1698` — 任务Tab Habit 子项 | checkbox only |

**问题**：
- `DashSubHabitItem` 和 `SubHabitItem` 代码几乎一模一样（复制粘贴），唯一区别是传参方式
- 任务的 `SubTaskItem` 支持编辑/删除/添加嵌套子项，但习惯的子项两处均不支持——功能断层
- 任务子项使用 `<Checkbox>` UI 组件，习惯子项直接用原生 `<input type="checkbox">`——样式不统一

### 3. 完成/撤销流程

| 维度 | 任务 (TaskItem) | 习惯 (HabitCard) |
|------|----------------|-----------------|
| 完成动画 | scale 1.02 → 250ms delay → 飞出 | 无动画 |
| 撤销机制 | toast 内 undo 按钮 | UndoToast 独立浮层 + CompletedHabitItem hover undo |
| XP 回收 | `revokeXP` + `removeEvent` | 仅 `undoComplete`（无 XP 回收、无 event 移除） |
| 高难度确认 | difficulty >= 4 二次确认 | 无（直接完成） |
| 完成后耗时输入 | 弹出输入框记录 actualMinutes | 无 |
| 事件记录 | `task_complete` event | `habit_complete` event |

**问题**：习惯撤销不回收 XP 和 ore，也不移除 GrowthEvent，导致撤销后数据不一致。这是一个**逻辑 bug**。

### 4. 习惯管理入口：2 条路径

仪表盘提供两个管理入口：
1. `HabitManageModal`（335行）— Drawer 形式，含暂停/恢复/隐藏/删除/回收站
2. 任务Tab `HabitsTab`（253行）— 全页面，含暂停/恢复/铭刻/精通/隐藏/删除/回收站 + 分组管理

**问题**：
- `HabitManageModal` 是 `HabitsTab` 的子集，但各自维护独立的 state（hiddenMode/trashMode）和独立的事件处理函数
- `HabitManageModal` 不支持铭刻和精通，用户在仪表盘想铭刻必须切到任务Tab
- 两处的习惯过滤逻辑（active/paused/mastered/hidden/deleted）完全重复

### 5. 拖拽排序

| 维度 | 仪表盘任务 | 任务Tab任务 | 仪表盘习惯 | 任务Tab习惯 |
|------|-----------|-------------|-----------|-------------|
| 拖拽库 | Reorder | Reorder | Reorder | 无 |
| 本地状态同步 | ✓ isDraggingRef | ✓ isDraggingRef | ✓ isDraggingRef | — |
| 拖拽排序持久化 | ✓ reorderTasks | ✓ reorderTasks | ✓ reorderHabits | — |

任务Tab的习惯列表不支持拖拽排序。

### 6. 样式差异

| 元素 | 仪表盘 | 任务Tab |
|------|--------|--------|
| 习惯行容器 | borderBottom 分隔线 | 卡片式（border + borderRadius + boxShadow） |
| ▶ 按钮尺寸 | 24×24 | 26×26 |
| hover 操作栏 | 无（仅跳过按钮常驻） | hover 延迟 300ms 出现 |
| 完成按钮 | 圆角方按钮 28×28 / ProgressButton | 无 |

---

## 三、重复代码统计

| 重复代码块 | 出现位置 | 估计重复行数 |
|-----------|---------|------------|
| 子项 checkbox + 折叠按钮渲染 | `DashSubHabitItem`, `SubHabitItem`, `SubTaskItem` | ~50行 × 3 |
| 习惯过滤（active/paused/mastered/hidden/deleted） | `HabitsTab`, `HabitManageModal`, `HabitCard` | ~8行 × 3 |
| ▶ 播放按钮 SVG + 样式 | `TaskItem`, `HabitItem`, `HabitRow` | ~15行 × 3 |
| hover 延迟逻辑 (hoverTimer ref) | `TaskItem`, `HabitRow` | ~10行 × 2 |
| 删除二次确认逻辑 (deleteConfirm + timer) | `TaskItem`, `HabitRow` | ~15行 × 2 |
| TimerBadge 接入 | `HabitItem`, `HabitRow`, `TaskItem` | ~10行 × 3 |

**总计约 250+ 行重复代码**。

---

## 四、建议优先级

### P0 — Bug 修复（不涉及重构）

1. **习惯撤销应回收 XP/ore 并移除 GrowthEvent**
   - 文件：`dashboard/HabitCard.tsx` `handleUndoComplete`
   - 当前只调 `undoComplete`，缺少 `revokeXP` 和 `removeEvent`

### P1 — 建议统一（减少认知负担）

2. **统一子项组件**：将 `DashSubHabitItem` 和 `SubHabitItem` 合并为一个共享组件
   - 可以复用 `SubTaskItem` 的结构，加一个 `type: 'task' | 'habit'` 区分 store 调用
   - 减少约 100 行重复代码

3. **习惯管理入口统一**：让仪表盘的"管理"直接复用 `HabitsTab`（或简化为只用 HabitManageModal + 补齐铭刻/精通）
   - 当前用户需要记住"铭刻在任务Tab，管理在仪表盘管理弹窗"，违反直觉

### P2 — 可以考虑（用户体验提升）

4. **抽取共享的习惯行组件**：类似 `TaskItem` 支持 `compact` prop，让仪表盘和任务Tab都用同一个 `HabitItem`
   - compact=true：仪表盘样式（分隔线、完成按钮、跳过）
   - compact=false：管理样式（卡片、hover 操作栏）
   - 这是最大的重构，约影响 400+ 行，但收益也最大

5. **统一完成动画和撤销流程**：任务有完成动画和高难确认，习惯没有

### P3 — 风格对齐（视觉一致性）

6. 原生 checkbox → `<Checkbox>` 组件
7. ▶ 按钮尺寸 24/26 统一
8. 播放图标 SVG 抽为共享组件

---

## 五、总结

| 维度 | 任务 (Task) | 习惯 (Habit) |
|------|------------|-------------|
| 组件复用 | 高（TaskItem 跨视图共享） | 低（3 套独立渲染） |
| 逻辑复用 | 高（store action 统一） | 中（store 统一，但组件层各自处理） |
| 操作一致性 | 高 | 低（撤销流程有 bug） |
| 子项一致性 | — | 低（3 套实现，功能不齐） |

核心问题：**任务做到了"一个 `TaskItem` 走天下"，习惯没有做到等价的抽象**。仪表盘的 `HabitItem`、任务Tab 的 `HabitRow`、管理弹窗的行渲染各走各路，随着功能迭代差异只会越来越大。
