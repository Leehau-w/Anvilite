# Phase 4 — 已完成项展示优化 + 习惯撤销机制

> **前置**：先阅读 `OVERVIEW.md` 了解架构规范和编码约定
> **依赖**：Phase 1-2 完成后开始（依赖 BUG-05 排序逻辑、FEAT-01 拖拽排序、PATCH-03 习惯灵活次数）

---

## 总览

| 编号 | 事项 | 优先级 |
|------|------|--------|
| FEAT-06 | 已完成任务分组视图（按月/按区域/自定义） | P1 |
| FEAT-07 | 已完成习惯分组视图（按区域/自定义） | P1 |
| FEAT-08 | 仪表盘已完成项展示优化 | P1 |
| FEAT-09 | 习惯完成撤销机制 | P0 |

---

## FEAT-06：已完成任务分组视图

**优先级**：P1
**需求**：任务页签中，已完成任务支持按完成月份、按区域、按自定义分组三种展示方式，用户可切换。

### 数据模型

自定义分组需要新增数据结构：

```typescript
// src/types/task.ts — 新增
interface TaskGroup {
  id: string
  name: string           // 分组名称
  type: 'custom'         // 区分系统分组和自定义分组
  taskIds: string[]       // 关联的已完成任务 ID
  createdAt: string
}
```

在 `taskStore` 中新增：

```typescript
// taskStore 新增字段
interface TaskState {
  // ...existing
  completedViewMode: 'month' | 'area' | 'custom'  // 展示模式
  customTaskGroups: TaskGroup[]                     // 自定义分组
}
```

`onRehydrateStorage` 兼容：

```typescript
state.completedViewMode = state.completedViewMode ?? 'month'
state.customTaskGroups = state.customTaskGroups ?? []
```

### 视图模式切换

在已完成任务列表顶部添加切换控件：

```tsx
// TaskList.tsx — 已完成区域头部

<div className="flex items-center justify-between py-2">
  <h3 className="font-medium text-[var(--color-text-secondary)]">
    {t.task_completed} ({completedTasks.length})
  </h3>
  <div className="flex gap-1 bg-[var(--color-bg-secondary)] rounded-lg p-0.5">
    <ViewToggleButton
      active={viewMode === 'month'}
      onClick={() => setViewMode('month')}
      label={t.task_groupByMonth}
    />
    <ViewToggleButton
      active={viewMode === 'area'}
      onClick={() => setViewMode('area')}
      label={t.task_groupByArea}
    />
    <ViewToggleButton
      active={viewMode === 'custom'}
      onClick={() => setViewMode('custom')}
      label={t.task_groupCustom}
    />
  </div>
</div>
```

### 按月份分组

```typescript
const groupByMonth = useMemo(() => {
  const groups = new Map<string, Task[]>()

  completedTasks.forEach(task => {
    if (!task.completedAt) return
    const date = new Date(task.completedAt)
    // key 格式："2026-04" → 确保排序正确
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
    const arr = groups.get(key) ?? []
    arr.push(task)
    groups.set(key, arr)
  })

  // 按月份倒序（最近的在前）
  return Array.from(groups.entries())
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([key, tasks]) => ({
      key,
      label: formatMonthLabel(key),  // "2026年4月" / "April 2026"
      tasks: tasks.sort((a, b) =>
        new Date(b.completedAt!).getTime() - new Date(a.completedAt!).getTime()
      )
    }))
}, [completedTasks])
```

月份显示格式化：

```typescript
function formatMonthLabel(key: string): string {
  const [year, month] = key.split('-').map(Number)
  // 根据当前语言格式化
  // zh: "2026年4月"
  // en: "April 2026"
  const date = new Date(year, month - 1)
  return date.toLocaleDateString(language === 'zh' ? 'zh-CN' : 'en-US', {
    year: 'numeric',
    month: 'long'
  })
}
```

### 按区域分组

```typescript
const groupByArea = useMemo(() => {
  const areas = useAreaStore.getState().areas
  const groups = new Map<string, { label: string; tasks: Task[] }>()

  // 初始化所有区域
  areas.forEach(area => {
    groups.set(area.category, { label: area.name, tasks: [] })
  })
  // 加一个"未分类"
  groups.set('__uncategorized', { label: t.task_uncategorized, tasks: [] })

  completedTasks.forEach(task => {
    const key = task.category ?? '__uncategorized'
    const group = groups.get(key) ?? groups.get('__uncategorized')!
    group.tasks.push(task)
  })

  return Array.from(groups.entries())
    .filter(([, g]) => g.tasks.length > 0)
    .map(([key, g]) => ({
      key,
      label: g.label,
      tasks: g.tasks.sort((a, b) =>
        new Date(b.completedAt!).getTime() - new Date(a.completedAt!).getTime()
      )
    }))
}, [completedTasks])
```

### 自定义分组

用户可以创建自己的分组，然后把已完成任务拖入或手动分配。

```typescript
// taskStore 新增 actions
addCustomTaskGroup: (name: string) => {
  const group: TaskGroup = {
    id: generateId(),
    name,
    type: 'custom',
    taskIds: [],
    createdAt: new Date().toISOString()
  }
  set(state => ({
    customTaskGroups: [...state.customTaskGroups, group]
  }))
}

renameCustomTaskGroup: (groupId: string, name: string) => {
  set(state => ({
    customTaskGroups: state.customTaskGroups.map(g =>
      g.id === groupId ? { ...g, name } : g
    )
  }))
}

deleteCustomTaskGroup: (groupId: string) => {
  set(state => ({
    customTaskGroups: state.customTaskGroups.filter(g => g.id !== groupId)
  }))
}

moveTaskToGroup: (taskId: string, groupId: string) => {
  set(state => ({
    customTaskGroups: state.customTaskGroups.map(g => ({
      ...g,
      taskIds: g.id === groupId
        ? [...new Set([...g.taskIds, taskId])]          // 添加到目标
        : g.taskIds.filter(id => id !== taskId)         // 从其他组移除
    }))
  }))
}

removeTaskFromGroup: (taskId: string) => {
  set(state => ({
    customTaskGroups: state.customTaskGroups.map(g => ({
      ...g,
      taskIds: g.taskIds.filter(id => id !== taskId)
    }))
  }))
}
```

UI 交互：

```tsx
// 自定义分组视图

{/* 创建分组按钮 */}
<button onClick={() => setShowCreateGroup(true)} className="...">
  + {t.task_newGroup}
</button>

{/* 创建分组 inline 输入 */}
{showCreateGroup && (
  <div className="flex gap-2 py-2">
    <input
      autoFocus
      value={newGroupName}
      onChange={e => setNewGroupName(e.target.value)}
      onKeyDown={e => {
        if (e.key === 'Enter' && newGroupName.trim()) handleCreateGroup()
        if (e.key === 'Escape') setShowCreateGroup(false)
      }}
      placeholder={t.task_groupNamePlaceholder}
      className="flex-1 px-3 py-1.5 rounded-lg border border-[var(--color-border)] bg-transparent"
    />
    <button onClick={handleCreateGroup}>{t.common_confirm}</button>
  </div>
)}

{/* 分组列表 */}
{customGroups.map(group => (
  <CollapsibleGroup key={group.id} group={group}>
    {group.tasks.map(task => (
      <TaskItem key={task.id} task={task} compact />
    ))}
  </CollapsibleGroup>
))}

{/* 未分组的已完成任务 */}
{ungroupedTasks.length > 0 && (
  <CollapsibleGroup label={t.task_ungrouped}>
    {ungroupedTasks.map(task => (
      <TaskItem key={task.id} task={task} compact />
    ))}
  </CollapsibleGroup>
)}
```

任务分配到分组的交互方式：
- 已完成任务卡片右键菜单或 hover 出现 "移至分组" 下拉
- 下拉列出所有自定义分组名称 + "移出分组" 选项

### 分组折叠组件

```tsx
// src/components/ui/CollapsibleGroup.tsx

function CollapsibleGroup({
  label,
  count,
  children,
  defaultOpen = true,
  onRename,
  onDelete
}: {
  label: string
  count: number
  children: ReactNode
  defaultOpen?: boolean
  onRename?: (name: string) => void
  onDelete?: () => void
}) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div className="mb-3">
      <div
        className="flex items-center gap-2 py-1.5 cursor-pointer select-none group"
        onClick={() => setOpen(!open)}
      >
        <motion.span
          animate={{ rotate: open ? 90 : 0 }}
          className="text-xs text-[var(--color-text-secondary)]"
        >
          ▶
        </motion.span>
        <span className="text-sm font-medium text-[var(--color-text-secondary)]">
          {label}
        </span>
        <span className="text-xs text-[var(--color-text-tertiary)]">
          ({count})
        </span>
        {/* 自定义分组的编辑/删除按钮 */}
        {(onRename || onDelete) && (
          <div className="ml-auto opacity-0 group-hover:opacity-100 flex gap-1">
            {onRename && <button onClick={e => { e.stopPropagation(); /* 触发重命名 */ }}>✏️</button>}
            {onDelete && <button onClick={e => { e.stopPropagation(); onDelete() }}>🗑</button>}
          </div>
        )}
      </div>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
```

### i18n 新增 key

| key | zh | en |
|-----|----|----|
| `task_completed` | 已完成 | Completed |
| `task_groupByMonth` | 按月 | By Month |
| `task_groupByArea` | 按区域 | By Area |
| `task_groupCustom` | 自定义 | Custom |
| `task_newGroup` | 新建分组 | New Group |
| `task_groupNamePlaceholder` | 输入分组名称 | Group name |
| `task_ungrouped` | 未分组 | Ungrouped |
| `task_uncategorized` | 未分类 | Uncategorized |
| `task_moveToGroup` | 移至分组 | Move to Group |
| `task_removeFromGroup` | 移出分组 | Remove from Group |

### 影响文件

- `src/types/task.ts`（新增 `TaskGroup` 接口）
- `src/stores/taskStore.ts`（新增 `completedViewMode`、`customTaskGroups`、相关 actions）
- `src/components/tasks/TaskList.tsx`（已完成区域重构为分组视图）
- 新建 `src/components/ui/CollapsibleGroup.tsx`
- `src/i18n/zh.ts`, `src/i18n/en.ts`

### 验收标准

- [ ] 已完成任务区域顶部有三种视图切换按钮
- [ ] 按月模式：已完成任务按完成月份倒序分组，组标题为月份名
- [ ] 按区域模式：已完成任务按所属区域分组
- [ ] 自定义模式：显示用户创建的分组 + 未分组区域
- [ ] 可创建/重命名/删除自定义分组
- [ ] 可将已完成任务移入/移出自定义分组
- [ ] 分组可折叠展开
- [ ] 分组内任务按完成时间倒序
- [ ] 切换视图模式后刷新保持选择
- [ ] 子任务不独立显示，跟随父任务

---

## FEAT-07：已完成习惯分组视图

**优先级**：P1
**需求**：习惯页签中，已归档/已精通的习惯支持按区域分组（默认）和自定义分组。

### 说明

"已完成的习惯"在 Anvilite 的语境下指 `status === 'mastered'`（精通标记）或 `status === 'archived'`（归档）的习惯，而非 `completed_today`（今日完成，次日恢复）。

### 数据模型

复用与 FEAT-06 相似的分组结构：

```typescript
// src/types/habit.ts — 新增
interface HabitGroup {
  id: string
  name: string
  type: 'custom'
  habitIds: string[]
  createdAt: string
}
```

在 `habitStore` 中新增：

```typescript
interface HabitState {
  // ...existing
  completedHabitViewMode: 'area' | 'custom'   // 默认 'area'
  customHabitGroups: HabitGroup[]
}
```

### 展示逻辑

```typescript
// 筛选已完成的习惯
const completedHabits = useMemo(() =>
  habits.filter(h =>
    (h.status === 'mastered' || h.status === 'archived') && !h.parentId
  ),
  [habits]
)
```

**按区域分组**（默认）：逻辑与 FEAT-06 的按区域分组一致，用习惯的 `category` 字段分组。

**自定义分组**：与 FEAT-06 的自定义分组逻辑一致，在 `habitStore` 中新增对应的 actions：

```typescript
addCustomHabitGroup: (name: string) => { /* 同 FEAT-06 模式 */ }
renameCustomHabitGroup: (groupId: string, name: string) => { /* ... */ }
deleteCustomHabitGroup: (groupId: string) => { /* ... */ }
moveHabitToGroup: (habitId: string, groupId: string) => { /* ... */ }
removeHabitFromGroup: (habitId: string) => { /* ... */ }
```

### UI

在习惯页签的已完成区域，复用 `CollapsibleGroup` 组件和视图切换控件。

```tsx
<div className="flex items-center justify-between py-2">
  <h3>{t.habit_completed} ({completedHabits.length})</h3>
  <div className="flex gap-1 ...">
    <ViewToggleButton active={viewMode === 'area'} label={t.task_groupByArea} ... />
    <ViewToggleButton active={viewMode === 'custom'} label={t.task_groupCustom} ... />
  </div>
</div>
```

### i18n 新增 key

| key | zh | en |
|-----|----|----|
| `habit_completed` | 已完成习惯 | Completed Habits |

其他 key 复用 FEAT-06（`task_groupByArea` 等可提取为通用 key，或保持原样也可接受）。

### 影响文件

- `src/types/habit.ts`（新增 `HabitGroup`）
- `src/stores/habitStore.ts`（新增分组相关字段和 actions）
- 习惯列表组件（添加分组视图）
- 复用 `src/components/ui/CollapsibleGroup.tsx`
- `src/i18n/zh.ts`, `src/i18n/en.ts`

### 验收标准

- [ ] 已归档/精通的习惯默认按区域分组展示
- [ ] 可切换到自定义分组模式
- [ ] 可创建/重命名/删除自定义分组
- [ ] 可将习惯移入/移出分组
- [ ] 子习惯跟随父习惯，不独立显示

---

## FEAT-08：仪表盘已完成项展示优化

**优先级**：P1
**需求**：仪表盘任务卡片只展示今日已完成的任务；习惯卡片展示本周期内已完成的习惯。

### 任务卡片 — 今日已完成

当前问题：任务卡片显示所有已完成任务，随时间增长列表越来越长。

修改后逻辑：

```typescript
// TaskCard.tsx

const todayStr = new Date().toDateString()

const activeTasks = useMemo(() =>
  tasks.filter(t => !t.parentId && !t.deletedAt && !t.isHidden && t.status !== 'done'),
  [tasks]
)

const todayCompletedTasks = useMemo(() =>
  tasks.filter(t =>
    !t.parentId &&
    !t.deletedAt &&
    t.status === 'done' &&
    t.completedAt &&
    new Date(t.completedAt).toDateString() === todayStr
  ),
  [tasks, todayStr]
)
```

展示结构：

```tsx
{/* 进行中 + 待办（维持原有展示） */}
{activeTasks.map(task => <TaskItem key={task.id} task={task} />)}

{/* 今日已完成 — 分隔线 + 折叠 */}
{todayCompletedTasks.length > 0 && (
  <CollapsibleGroup
    label={t.dashboard_todayCompleted}
    count={todayCompletedTasks.length}
    defaultOpen={true}
  >
    {todayCompletedTasks.map(task => (
      <TaskItem key={task.id} task={task} compact />
    ))}
  </CollapsibleGroup>
)}
```

**注意**：这里的 `todayStr` 要配合 BUG-08（跨午夜刷新）联动——当日期变更时，今日已完成列表自动清空（因为 `completedAt` 已不是今天了）。

### 习惯卡片 — 本周期已完成

当前问题：习惯卡片中 `completed_today` 的习惯展示不够清晰。

修改后逻辑：展示**当前周期内已完成的习惯**，"周期"取决于习惯的 `repeatType`：

```typescript
// HabitCard.tsx

function isCompletedInCurrentCycle(habit: Habit): boolean {
  if (habit.status !== 'completed_today') return false
  if (!habit.lastCompletedAt) return false

  const completedDate = new Date(habit.lastCompletedAt)
  const now = new Date()

  switch (habit.repeatType) {
    case 'daily':
    case 'workday':
      // 今日完成的
      return completedDate.toDateString() === now.toDateString()

    case 'weekly_strict':
    case 'weekly_flexible':
      // 本周完成的（周一为周起始）
      return isSameWeek(completedDate, now)

    case 'biweekly':
      // 本双周周期内完成的
      return isSameBiweek(completedDate, now, habit.startDate)

    case 'monthly':
    case 'monthly_fixed':
      // 本月完成的
      return completedDate.getMonth() === now.getMonth() &&
             completedDate.getFullYear() === now.getFullYear()

    case 'custom':
      // 当前自定义周期内完成的
      return isInCurrentCustomCycle(completedDate, now, habit)

    default:
      return completedDate.toDateString() === now.toDateString()
  }
}

// 工具函数
function isSameWeek(d1: Date, d2: Date): boolean {
  const getMonday = (d: Date) => {
    const day = d.getDay()
    const diff = d.getDate() - day + (day === 0 ? -6 : 1)
    return new Date(d.getFullYear(), d.getMonth(), diff).toDateString()
  }
  return getMonday(d1) === getMonday(d2)
}
```

展示结构：

```tsx
{/* 今日到期、待完成的习惯 */}
{dueHabits.map(habit => <HabitItem key={habit.id} habit={habit} />)}

{/* 本周期已完成 */}
{cycleCompletedHabits.length > 0 && (
  <CollapsibleGroup
    label={t.dashboard_cycleCompleted}
    count={cycleCompletedHabits.length}
    defaultOpen={true}
  >
    {cycleCompletedHabits.map(habit => (
      <HabitItem key={habit.id} habit={habit} compact showUndoButton />
    ))}
  </CollapsibleGroup>
)}
```

### i18n 新增 key

| key | zh | en |
|-----|----|----|
| `dashboard_todayCompleted` | 今日已完成 | Completed Today |
| `dashboard_cycleCompleted` | 本周期已完成 | Completed This Cycle |

### 影响文件

- `src/components/dashboard/TaskCard.tsx`
- `src/components/dashboard/HabitCard.tsx`
- 可能新增 `src/utils/cycle.ts`（周期判定工具函数）
- `src/i18n/zh.ts`, `src/i18n/en.ts`

### 验收标准

- [ ] 仪表盘任务卡片只展示今日已完成的任务，不展示历史已完成
- [ ] 今日已完成区域可折叠
- [ ] 跨午夜后今日已完成列表自动更新（配合 BUG-08）
- [ ] 仪表盘习惯卡片展示本周期内已完成的习惯
- [ ] 每日习惯显示今日完成的；每周习惯显示本周完成的；每月习惯显示本月完成的
- [ ] 完整的任务/习惯列表仍在任务页签中可查看

---

## FEAT-09：习惯完成撤销机制

**优先级**：P0（防误操作属于基础体验保障）
**需求**：习惯完成后提供撤销入口，防止用户误触。适用于仪表盘习惯卡片和习惯页签。

### 撤销方案

采用**双重机制**：即时 toast 撤销 + 卡片内撤销按钮。

#### 机制 1：Toast 撤销（完成后立即出现）

习惯完成时，底部弹出 toast 通知，附带撤销按钮，持续 5 秒：

```tsx
// src/components/feedback/UndoToast.tsx

interface UndoToastProps {
  message: string
  onUndo: () => void
  duration?: number  // 默认 5000ms
}

function UndoToast({ message, onUndo, duration = 5000 }: UndoToastProps) {
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    const timer = setTimeout(() => setVisible(false), duration)
    return () => clearTimeout(timer)
  }, [duration])

  if (!visible) return null

  return (
    <motion.div
      initial={{ y: 50, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 50, opacity: 0 }}
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50
                 flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg
                 bg-[var(--color-card)] border border-[var(--color-border)]"
    >
      <span className="text-sm">{message}</span>
      <button
        onClick={() => { onUndo(); setVisible(false) }}
        className="text-sm font-medium text-[var(--color-accent)] hover:underline"
      >
        {t.common_undo}
      </button>
      {/* 倒计时进度条 */}
      <motion.div
        className="absolute bottom-0 left-0 h-0.5 bg-[var(--color-accent)] rounded-b-xl"
        initial={{ width: '100%' }}
        animate={{ width: '0%' }}
        transition={{ duration: duration / 1000, ease: 'linear' }}
      />
    </motion.div>
  )
}
```

#### 机制 2：卡片内撤销按钮（已完成习惯持续显示）

在仪表盘和习惯页签中，已完成习惯的卡片上显示一个撤销按钮：

```tsx
// HabitItem.tsx — 已完成状态时

{habit.status === 'completed_today' && (
  <button
    onClick={(e) => { e.stopPropagation(); handleUndo(habit.id) }}
    className="text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-accent)]
               px-2 py-0.5 rounded border border-[var(--color-border)] opacity-60 hover:opacity-100"
    title={t.habit_undoComplete}
  >
    ↩ {t.common_undo}
  </button>
)}
```

### 撤销逻辑

在 `habitStore` 中新增 `undoComplete` action：

```typescript
undoComplete: (habitId: string) => {
  const habit = get().habits.find(h => h.id === habitId)
  if (!habit || habit.status !== 'completed_today') return

  // 1. 恢复状态
  // 2. 回退连续次数
  // 3. 回退 totalCompletions
  // 4. 回退 XP/矿石
  // 5. 回退灵活次数计数（如果适用）

  set(state => ({
    habits: state.habits.map(h => {
      if (h.id !== habitId) return h
      return {
        ...h,
        status: 'active',
        consecutiveCount: Math.max(0, h.consecutiveCount - 1),
        totalCompletions: Math.max(0, h.totalCompletions - 1),
        // 灵活次数：回退 currentCycleCount
        currentCycleCount: h.targetCount > 1
          ? Math.max(0, h.currentCycleCount - 1)
          : h.currentCycleCount,
        // lastCompletedAt 不回退（保持上次完成时间，避免连续判定复杂化）
      }
    })
  }))

  // 回退 XP/矿石
  const { xp, ore } = calculateHabitXP(habit, useCharacterStore.getState().streakDays)
  useCharacterStore.getState().removeXPAndOre(xp, ore)

  // 删除对应的成长事件（最近一条匹配的习惯完成事件）
  const events = useGrowthEventStore.getState().events
  const latestEvent = events.find(e =>
    e.type === 'habit_complete' && e.details?.habitId === habitId
  )
  if (latestEvent) {
    useGrowthEventStore.getState().removeEvent(latestEvent.id)
  }
}
```

`characterStore` 新增 `removeXPAndOre` action：

```typescript
removeXPAndOre: (xp: number, ore: number) => {
  set(state => {
    const newTotalXP = Math.max(0, state.totalXP - xp)
    const newOre = Math.max(0, state.ore - ore)
    const newLevel = calculateLevelFromXP(newTotalXP)
    return {
      ...state,
      totalXP: newTotalXP,
      ore: newOre,
      totalOreEarned: Math.max(0, state.totalOreEarned - ore),
      level: newLevel,
      currentXP: calculateCurrentXP(newTotalXP, newLevel),
    }
  })
}
```

`growthEventStore` 新增 `removeEvent` action（如果没有的话）：

```typescript
removeEvent: (eventId: string) => {
  set(state => ({
    events: state.events.filter(e => e.id !== eventId)
  }))
}
```

### 触发流程

```
用户点击完成习惯
  → habitStore.completeHabit(id)    // 现有逻辑
  → XP/矿石结算                     // 现有逻辑
  → 弹出 UndoToast（5秒倒计时）      // 新增
      ↓
  用户点击"撤销"（5秒内）
      → habitStore.undoComplete(id)
      → characterStore.removeXPAndOre(xp, ore)
      → growthEventStore.removeEvent(eventId)
      → 习惯恢复 active 状态
      → Toast 消失
      ↓
  用户未操作（5秒后）
      → Toast 自动消失
      → 完成操作最终确认
```

### 边界情况

- **撤销后重新完成**：撤销后习惯恢复为 active，用户可以再次点击完成，走正常完成流程
- **灵活次数习惯**：撤销时 `currentCycleCount - 1`，如果之前刚好达标结算了 XP，撤销时 XP 也要回退
- **容错充能**：如果完成时触发了容错充能的获取（`consecutiveCount` 达到阈值），撤销时回退 `consecutiveCount` 后可能低于阈值，但 `toleranceCharges` 不主动回退（简化处理，可接受的小偏差）
- **连续多个习惯完成**：每个完成都有独立的 UndoToast，新 toast 替换旧 toast（避免堆叠）
- **跨午夜**：如果用户在 23:59 完成，00:01 撤销——此时习惯已被 BUG-08 的日期检查重置为 active，撤销操作发现 `status !== 'completed_today'` 直接跳过，不会出错

### i18n 新增 key

| key | zh | en |
|-----|----|----|
| `common_undo` | 撤销 | Undo |
| `habit_undoComplete` | 撤销完成 | Undo Completion |
| `habit_undoneToast` | (name) => \`已撤销「${name}」的完成\` | (name) => \`Undid completion of "${name}"\` |
| `habit_completedToast` | (name, xp) => \`${name} 完成！+${xp} XP\` | (name, xp) => \`${name} done! +${xp} XP\` |

### 影响文件

- 新建 `src/components/feedback/UndoToast.tsx`
- `src/stores/habitStore.ts`（新增 `undoComplete` action）
- `src/stores/characterStore.ts`（新增 `removeXPAndOre` action）
- `src/stores/growthEventStore.ts`（新增 `removeEvent` action）
- `src/components/dashboard/HabitCard.tsx`（习惯完成时触发 toast + 已完成项显示撤销按钮）
- 习惯页签中的习惯列表组件（同样添加撤销按钮和 toast）
- `src/i18n/zh.ts`, `src/i18n/en.ts`

### 验收标准

- [ ] 完成习惯后底部弹出 5 秒倒计时 UndoToast
- [ ] Toast 有进度条显示剩余时间
- [ ] 点击"撤销"后习惯恢复 active 状态
- [ ] 撤销时 XP、矿石、连续次数、完成计数均正确回退
- [ ] 撤销时删除对应的成长事件
- [ ] 已完成习惯卡片上有持续可见的撤销按钮
- [ ] 仪表盘和习惯页签均可撤销
- [ ] 连续完成多个习惯时，toast 不堆叠（新替旧）
- [ ] 等级因 XP 回退而降级时正确处理（虽然概率极低）
- [ ] 灵活次数习惯撤销时 currentCycleCount 正确回退
