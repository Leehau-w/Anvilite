# Phase 1 — Bug 修复（BUG-01 ~ BUG-08）

> **前置**：先阅读 `OVERVIEW.md` 了解架构规范和编码约定

---

## BUG-01：高难度任务确认弹窗不居中

**优先级**：P0
**现象**：4-5 星任务完成时的二次确认弹窗位置偏移，未居中显示。

**根因方向**：大概率是 Framer Motion 的 `transform` 覆盖了 CSS 定位的 `transform`（v0.1 已知模式）。

**修复规格**：

```
正确结构：
<div className="fixed inset-0 z-50 flex items-center justify-center">  ← 定位层
  <div className="fixed inset-0 bg-black/50" onClick={onClose} />       ← 遮罩层
  <motion.div                                                            ← 动画层
    initial={{ opacity: 0, scale: 0.95 }}
    animate={{ opacity: 1, scale: 1 }}
    exit={{ opacity: 0, scale: 0.95 }}
    className="relative z-10 bg-[var(--color-card)] rounded-xl p-6 ..."
  >
    弹窗内容
  </motion.div>
</div>
```

**关键点**：
- 外层 `<div>` 做 `fixed` + `flex` 居中定位
- `motion.div` 只做 `opacity` 和 `scale` 动画，不参与定位
- 检查是否有 `transform: translate(-50%, -50%)` + `top: 50%` 的旧写法，如有则替换为 flex 居中

**影响文件**：`src/components/feedback/` 下的确认弹窗组件

**验收标准**：
- [ ] 4-5 星任务完成时，确认弹窗在视口正中
- [ ] 弹窗有进入/退出动画
- [ ] 点击遮罩可关闭
- [ ] 不同窗口尺寸下均居中

---

## BUG-02：时光卷轴未显示区域升级和徽章获得事件

**优先级**：P0
**现象**：`area_level_up` 和 `badge_earned` 事件在时光卷轴中不显示。

**排查路径**（按顺序检查）：

1. **事件是否被记录**：检查繁荣度升级和徽章颁发的代码路径中是否调用了 `growthEventStore.getState().addEvent()`
   - 繁荣度升级：在 `areaStore` 或调用 `prosperityEngine` 后，是否有 `addEvent({ type: 'area_level_up', ... })`
   - 徽章颁发：在 `badgeStore` 的 badge 解锁逻辑中，是否有 `addEvent({ type: 'badge_earned', ... })`

2. **事件类型是否被过滤**：检查时光卷轴组件中的事件列表过滤逻辑，确保 `type` 白名单包含 `area_level_up` 和 `badge_earned`

3. **渲染模板是否存在**：检查事件卡片组件中是否有这两种 type 的渲染分支

**修复规格**：

如果是问题 1（未记录事件），在对应位置补充：
```typescript
// 繁荣度升级时
growthEventStore.getState().addEvent({
  type: 'area_level_up',
  title: t.event_areaLevelUp(areaName, newLevel),  // 需确认 i18n key 是否存在
  details: { areaId, oldLevel, newLevel, category },
  timestamp: new Date().toISOString()
})

// 徽章获得时
growthEventStore.getState().addEvent({
  type: 'badge_earned',
  title: t.event_badgeEarned(badgeName),  // 需确认 i18n key 是否存在
  details: { badgeId },
  timestamp: new Date().toISOString()
})
```

如果缺少 i18n key，在 `zh.ts` 和 `en.ts` 中同步添加。

**影响文件**：`src/stores/growthEventStore.ts`, `src/stores/badgeStore.ts`, `src/stores/areaStore.ts` 或 `src/engines/prosperityEngine.ts` 的调用方, `src/components/timeline/`, `src/i18n/zh.ts`, `src/i18n/en.ts`

**验收标准**：
- [ ] 区域繁荣度升级后，时光卷轴显示对应事件卡片
- [ ] 获得新徽章后，时光卷轴显示对应事件卡片
- [ ] 事件卡片有对应的视觉样式（图标/颜色区分）
- [ ] 中英文均正确显示

---

## BUG-03：子任务创建时的显示问题

**优先级**：P0
**现象**：创建子任务时 UI 显示异常（缩进错位/不立即出现等）。

**排查路径**：

1. 检查 `taskStore.addTask({ parentId })` 是否正确更新了父任务的 `childIds` 数组
2. 检查是否使用了 immutable 更新：`childIds: [...parent.childIds, newTask.id]`（而非 `push`）
3. 检查 `TaskItem` 组件中递归渲染 children 时，`nestingLevel` 是否正确传递
4. 检查缩进计算：子任务缩进应为 `marginLeft: nestingLevel * indentPx`

**修复规格**：

```typescript
// taskStore.addTask 中
addTask: (params) => {
  const newTask = { ...params, id: generateId(), childIds: [] }
  
  if (params.parentId) {
    const parent = get().tasks.find(t => t.id === params.parentId)
    if (!parent || parent.nestingLevel >= 2) return  // 最多 3 层
    newTask.nestingLevel = parent.nestingLevel + 1
    newTask.category = parent.category
    newTask.difficulty = parent.difficulty
    
    // 更新父任务的 childIds — 必须 immutable
    set(state => ({
      tasks: state.tasks.map(t =>
        t.id === params.parentId
          ? { ...t, childIds: [...t.childIds, newTask.id] }
          : t
      ).concat(newTask)  // 同时添加新任务
    }))
  } else {
    set(state => ({ tasks: [...state.tasks, newTask] }))
  }
}
```

**影响文件**：`src/stores/taskStore.ts`, `src/components/tasks/TaskItem.tsx`

**验收标准**：
- [ ] 创建子任务后立即出现在父任务下方，正确缩进
- [ ] 子任务继承父任务的分类和难度
- [ ] 最多创建到第 3 层（根 → 子 → 孙），超出时创建按钮不可用或不出现
- [ ] 删除父任务时子孙任务级联删除

---

## BUG-04：仪表盘任务卡片无法滚轮滚动

**优先级**：P0
**现象**：仪表盘的任务卡片内容超出时无法滚轮滚动。

**修复规格**：

给任务卡片的内容容器添加滚动支持：

```tsx
// TaskCard.tsx 内容区域
<div
  className="flex-1 overflow-y-auto"
  style={{
    scrollbarWidth: 'thin',
    scrollbarColor: 'var(--color-border) transparent'
  }}
>
  {/* 任务列表 */}
</div>
```

**关键点**：
- 卡片容器必须有明确的高度约束（`flex-1` 配合父级 flex 布局，或 `max-height`）
- 不能用 `overflow: visible`（会破坏 flex 子元素高度约束，v0.1 已知问题）
- 滚动条样式跟随主题使用 CSS 变量

**影响文件**：`src/components/dashboard/TaskCard.tsx`

**验收标准**：
- [ ] 任务数量超出卡片高度时可滚轮滚动
- [ ] 滚动条为细条半透明样式
- [ ] 滚动不影响外层仪表盘网格

---

## BUG-05：任务更改后未自动重新排序

**优先级**：P0
**现象**：修改任务的优先级、截止日期等属性后，列表顺序不更新。

**修复规格**：

在任务列表渲染时使用 `useMemo` 计算排序：

```typescript
const sortedTasks = useMemo(() => {
  const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 }
  
  return [...tasks]
    .filter(t => t.parentId === null && !t.deletedAt && !t.isHidden)
    .sort((a, b) => {
      // 1. 状态分组：doing → todo → done
      const statusOrder = { doing: 0, todo: 1, done: 2 }
      const statusDiff = (statusOrder[a.status] ?? 1) - (statusOrder[b.status] ?? 1)
      if (statusDiff !== 0) return statusDiff
      
      // 2. 同状态内：有 sortOrder 则按 sortOrder（拖拽排序结果）
      if (a.sortOrder !== undefined && b.sortOrder !== undefined) {
        return a.sortOrder - b.sortOrder
      }
      
      // 3. 无 sortOrder：按优先级 → 截止日期
      const priDiff = (priorityOrder[a.priority] ?? 2) - (priorityOrder[b.priority] ?? 2)
      if (priDiff !== 0) return priDiff
      
      if (a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate)
      if (a.dueDate) return -1
      if (b.dueDate) return 1
      
      return 0
    })
}, [tasks])
```

**关键点**：
- `useMemo` 的依赖是 `tasks` 数组引用，任何任务属性变更都会触发 Zustand 状态更新，从而触发 re-sort
- `sortOrder` 字段为 FEAT-01（拖拽排序）预留，此处先做自然排序，FEAT-01 实现后会补充 sortOrder 逻辑
- 仪表盘 TaskCard 和独立 TaskList 页面都需要应用此排序

**影响文件**：`src/components/tasks/TaskList.tsx`, `src/components/dashboard/TaskCard.tsx`

**验收标准**：
- [ ] 修改任务优先级后列表自动重排
- [ ] 修改截止日期后列表自动重排
- [ ] 状态变更（todo → doing → done）后任务移动到对应分组
- [ ] 排序对仪表盘和任务列表页均生效

---

## BUG-06：编辑抽屉中缺少实际时长字段

**优先级**：P0
**现象**：任务完成后的实际时长只显示在卡片上，打开编辑抽屉看不到。

**修复规格**：

在 TaskDrawer 中添加「实际用时」字段：

```tsx
// TaskDrawer.tsx — 在预估时间字段下方添加
{task.status === 'done' ? (
  <div>
    <label>{t.task_actualMinutes}</label>
    <input
      type="number"
      min={0}
      value={task.actualMinutes ?? 0}
      onChange={e => updateTask(task.id, { actualMinutes: Number(e.target.value) })}
      className="..."
    />
    <span>{t.task_minuteUnit}</span>
  </div>
) : (
  <div className="text-[var(--color-text-secondary)]">
    {t.task_actualMinutesPlaceholder}  {/* "完成后可填写" */}
  </div>
)}
```

**i18n 新增 key**：
- `task_actualMinutes`：实际用时 / Actual Duration
- `task_minuteUnit`：分钟 / min
- `task_actualMinutesPlaceholder`：完成后可填写 / Available after completion

**影响文件**：`src/components/tasks/TaskDrawer.tsx`, `src/i18n/zh.ts`, `src/i18n/en.ts`

**验收标准**：
- [ ] 已完成任务打开抽屉时显示实际用时输入框
- [ ] 未完成任务显示灰色提示文字
- [ ] 修改实际用时后数据正确保存
- [ ] 中英文正确显示

---

## BUG-07：添加 React Error Boundary（新增）

**优先级**：P0
**现象**：组件异常导致全应用白屏，Electron 下用户无法排查。

**实现规格**：

新建 `src/components/ui/ErrorBoundary.tsx`：

```tsx
import { Component, ReactNode } from 'react'

interface Props {
  children: ReactNode
  fallback?: ReactNode  // 自定义降级 UI
  onError?: (error: Error, info: React.ErrorInfo) => void
}

interface State {
  hasError: boolean
  error: Error | null
}

class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack)
    this.props.onError?.(error, info)
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null })
  }

  handleReload = () => {
    window.location.reload()
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback
      
      return (
        <div className="flex flex-col items-center justify-center h-full gap-4 p-8 text-[var(--color-text)]">
          <div className="text-4xl">⚒️</div>
          <div className="text-lg font-medium">{/* 使用硬编码因为 i18n 可能也崩了 */}
            Something went wrong / 出错了
          </div>
          <div className="flex gap-3">
            <button onClick={this.handleRetry} className="px-4 py-2 rounded-lg bg-[var(--color-accent)] text-white">
              Retry / 重试
            </button>
            <button onClick={this.handleReload} className="px-4 py-2 rounded-lg border border-[var(--color-border)]">
              Reload / 重载
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

export default ErrorBoundary
```

**注意**：降级 UI 中使用硬编码双语文字，不依赖 i18n 系统（因为 i18n 本身也可能是崩溃源）。

**包裹位置**（修改 `App.tsx`）：

```tsx
// App.tsx
<ErrorBoundary>              {/* 全局兜底 */}
  <TopBar />
  <div className="flex flex-1">
    <Sidebar />
    <main className="flex-1">
      <ErrorBoundary>        {/* 主视图独立隔离 */}
        {currentView === 'dashboard' && <Dashboard />}
        {currentView === 'tasks' && <TaskList />}
        {currentView === 'worldmap' && <WorldMap />}
        {currentView === 'milestone' && <MilestoneHall />}
      </ErrorBoundary>
    </main>
  </div>
  <StatusBar />
</ErrorBoundary>
```

**影响文件**：新建 `src/components/ui/ErrorBoundary.tsx`，修改 `src/App.tsx`

**验收标准**：
- [ ] 主视图组件抛出异常时，显示错误降级界面而非白屏
- [ ] 点击"重试"可尝试恢复
- [ ] 点击"重载"可刷新整个应用
- [ ] TopBar/Sidebar/StatusBar 不受主视图崩溃影响
- [ ] 错误信息输出到 console.error

---

## BUG-08：跨午夜习惯状态不刷新（新增）

**优先级**：P0
**现象**：应用长期运行不重启时，`completed_today` 习惯在次日不自动恢复为 `active`。

**实现规格**：

新建 `src/utils/dateWatcher.ts`：

```typescript
type DateChangeCallback = () => void

export function startDateWatcher(onDateChange: DateChangeCallback) {
  let lastDate = new Date().toDateString()
  
  const check = () => {
    const currentDate = new Date().toDateString()
    if (currentDate !== lastDate) {
      lastDate = currentDate
      onDateChange()
    }
  }
  
  // 每分钟检查一次（兜底）
  const intervalId = setInterval(check, 60_000)
  
  // 页面从后台恢复时立即检查
  const handleVisibility = () => {
    if (document.visibilityState === 'visible') {
      check()
    }
  }
  document.addEventListener('visibilitychange', handleVisibility)
  
  // 返回清理函数
  return () => {
    clearInterval(intervalId)
    document.removeEventListener('visibilitychange', handleVisibility)
  }
}
```

在 `App.tsx` 或顶层组件中初始化：

```typescript
import { startDateWatcher } from '../utils/dateWatcher'
import { useHabitStore } from '../stores/habitStore'

useEffect(() => {
  const cleanup = startDateWatcher(() => {
    // 调用与 onRehydrateStorage 相同的习惯重置逻辑
    useHabitStore.getState().resetDailyHabits()
  })
  return cleanup
}, [])
```

在 `habitStore` 中新增 `resetDailyHabits` action：

```typescript
resetDailyHabits: () => {
  const today = new Date().toDateString()
  set(state => ({
    habits: state.habits.map(h => {
      // completed_today 且不是今天完成的 → 恢复 active
      if (h.status === 'completed_today') {
        const completedDate = h.lastCompletedAt
          ? new Date(h.lastCompletedAt).toDateString()
          : null
        if (completedDate !== today) {
          return { ...h, status: 'active' }
        }
      }
      // 跨周重置 weeklyCompletionCount
      // （如果今天是周一且上次完成不是本周）
      // ...根据现有 onRehydrateStorage 中的逻辑复用
      return h
    })
  }))
}
```

**关键点**：
- 重置逻辑必须与 `onRehydrateStorage` 中已有的日期检查逻辑保持一致，建议提取为共享函数
- 不要在 `dateWatcher` 中直接 import store，而是通过回调传入，保持工具函数的纯净性
- 日期变更时还需刷新仪表盘的统计数据（今日完成数等）

**影响文件**：新建 `src/utils/dateWatcher.ts`，修改 `src/stores/habitStore.ts`，修改 `src/App.tsx`

**验收标准**：
- [ ] 应用跨越午夜后，已完成的每日习惯自动恢复为 active
- [ ] 跨周后 weeklyCompletionCount 重置
- [ ] 从后台切回前台时立即检查
- [ ] 仪表盘统计数据同步刷新
