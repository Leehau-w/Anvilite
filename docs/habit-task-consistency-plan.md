# 习惯系统一致性改造 + 里程碑铭刻 + 习惯归档

> 2026-03-31 需求分析

---

## 一、习惯隐藏/删除交互改为与任务完全一致

### 当前差异

| 功能 | 任务系统 | 习惯系统（当前） |
|------|---------|----------------|
| 隐藏入口 | 右上角 👁 图标按钮，点击切换到隐藏视图 | 页面内折叠列表（▶ 已隐藏），点击展开 |
| 隐藏视图 | 独立全屏视图，显示所有隐藏任务，可取消隐藏 | 内嵌在主列表底部，折叠/展开 |
| 删除入口 | 右上角 🗑 图标按钮，点击切换到回收站视图 | 习惯行内直接双击删除，无回收站 |
| 删除恢复 | 软删除（`deletedAt`），回收站可恢复/永久删除 | 硬删除，不可恢复 |

### 改造目标

习惯 Tab 的隐藏和删除交互与任务 Tab **完全一致**：

1. **右上角图标按钮**
   - 👁 按钮 + 数字角标 → 点击切换到「已隐藏习惯」视图
   - 🗑 按钮 + 数字角标 → 点击切换到「已删除习惯」视图（回收站）
   - 两个按钮互斥，与任务 Tab 的 `hiddenMode` / `trashMode` 完全一致

2. **习惯软删除**
   - `types/habit.ts`：添加 `deletedAt: string | null` 字段
   - `habitStore.ts`：
     - `deleteHabit` 改为软删除（设 `deletedAt = now`）
     - 新增 `restoreHabit(id)` — 清除 `deletedAt`
     - 新增 `permanentlyDeleteHabit(id)` — 真正从数组移除
   - 所有列表过滤补充 `!h.deletedAt` 条件

3. **隐藏视图**
   - 移除 HabitsTab 内的折叠式隐藏列表
   - 改为独立视图（与任务的 `hiddenMode` 一致）
   - 每个隐藏习惯行：显示标题、分类、重复类型 + 「取消隐藏」按钮

4. **回收站视图**
   - 每个已删除习惯行：标题 + 删除时间 + 「恢复」/「永久删除」按钮
   - 永久删除需双击确认

5. **仪表盘习惯管理弹窗（HabitManageModal）同步更新**
   - 隐藏区改为与 TaskList 一致的 icon 入口模式
   - 增加回收站入口

### 涉及文件
- `src/types/habit.ts` — 添加 `deletedAt`
- `src/stores/habitStore.ts` — 软删除、恢复、永久删除、过滤条件
- `src/components/tasks/TaskList.tsx` — HabitsTab 重构
- `src/components/dashboard/HabitManageModal.tsx` — 同步更新
- `src/i18n/zh.ts` + `en.ts` — 回收站相关 key

---

## 二、任务/习惯铭刻为里程碑

### 需求

用户可以在里程碑殿堂中，将某个**已完成的任务**或**某个习惯**铭刻为里程碑，留下永久记录。

### 任务铭刻

- 入口：已完成任务的操作菜单中增加「⭐ 铭刻为里程碑」按钮
- 铭刻内容：
  - 标题：任务名称
  - 详情：分类、难度、获得的 XP、实际用时
  - 用户可添加感想（选填）
- 产出：创建一个 `GrowthEvent { type: 'custom_milestone' }` 记录

### 习惯铭刻

- 入口：习惯管理列表中增加「⭐ 铭刻为里程碑」按钮
- 铭刻内容：
  - 标题：习惯名称
  - 详情：
    - 分类、重复类型、难度
    - **坚持时长**：从 `createdAt` 到当前，按「X年X月X日」格式计算
    - 连续完成次数（`consecutiveCount`）
    - 总完成次数（`totalCompletions`）
  - 用户可添加感想（选填）
- 产出：创建一个 `GrowthEvent { type: 'custom_milestone' }` 记录

### 里程碑展示

在里程碑殿堂的里程碑列表中，铭刻的里程碑需要清晰展示来源（任务/习惯）和关键数据：
- 任务里程碑：显示 ⭐ + 任务标题 + XP + 用时
- 习惯里程碑：显示 ⭐ + 习惯标题 + 坚持时长 + 连续次数

### 涉及文件
- `src/types/growthEvent.ts` — details 扩展（duration、source type）
- `src/stores/growthEventStore.ts` — 铭刻方法
- `src/components/tasks/TaskItem.tsx` — 已完成任务增加铭刻按钮
- `src/components/tasks/TaskList.tsx` — 习惯行增加铭刻按钮
- `src/components/dashboard/HabitManageModal.tsx` — 习惯行增加铭刻按钮
- `src/components/milestone/MilestoneHall.tsx` — 铭刻里程碑展示增强
- `src/i18n/zh.ts` + `en.ts` — 铭刻相关 key

---

## 三、习惯「完成并归档」功能

### 需求

对于已养成的习惯，用户可以执行「完成并归档」操作，表示这个习惯已经内化，不再需要追踪。

### 交互流程

1. 入口：习惯管理列表/弹窗中，活跃习惯增加「✅ 完成并归档」按钮
2. 点击后弹出确认弹窗：
   - 标题：「将 {习惯名} 标记为已养成」
   - 显示坚持数据：坚持时长、连续次数、总完成次数
   - 可选：自动铭刻为里程碑（默认勾选）
   - 可选：添加感想
   - 确认/取消按钮
3. 确认后：
   - 习惯 `status` 设为 `'mastered'`（新状态）
   - 习惯不再出现在今日习惯、活跃列表中
   - 如果勾选了铭刻，自动创建里程碑事件
   - 弹 Toast 祝贺

### 数据变更

- `types/habit.ts`：status 类型扩展为 `'active' | 'completed_today' | 'paused' | 'archived' | 'mastered'`
- `habitStore.ts`：新增 `masterHabit(id)` 方法
- 已养成的习惯在管理列表中以独立区域展示（金色/特殊样式）

### 涉及文件
- `src/types/habit.ts` — status 扩展
- `src/stores/habitStore.ts` — masterHabit 方法
- `src/components/tasks/TaskList.tsx` — HabitsTab 已养成区域
- `src/components/dashboard/HabitManageModal.tsx` — 已养成区域
- `src/i18n/zh.ts` + `en.ts` — 相关 key

---

## 实施顺序建议

```
第一步：习惯隐藏/删除交互一致性改造（核心，影响面最大）
  - 习惯软删除 + 回收站
  - HabitsTab 右上角 icon 入口
  - HabitManageModal 同步

第二步：习惯「完成并归档」
  - mastered 状态 + 确认弹窗 + 数据展示

第三步：任务/习惯铭刻为里程碑
  - 铭刻入口 + 确认弹窗 + 里程碑展示增强
```
