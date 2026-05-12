# Phase 1 — v0.2 遗留补全 + 基础修复

> **前置**：先阅读 `OVERVIEW.md`

---

## v0.2-legacy-1：Error Boundary

**优先级**：P0

**实现规格**：

新建 `src/components/ui/ErrorBoundary.tsx`（class 组件，React 的 Error Boundary 不支持函数式）：

```tsx
class ErrorBoundary extends Component<Props, State> {
  state = { hasError: false, error: null }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-full gap-4 p-8">
          <div className="text-4xl">⚒️</div>
          <div className="text-lg font-medium">Something went wrong / 出错了</div>
          <div className="flex gap-3">
            <button onClick={() => this.setState({ hasError: false })}>Retry / 重试</button>
            <button onClick={() => window.location.reload()}>Reload / 重载</button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
```

**注意**：降级 UI 使用硬编码双语文字，不依赖 i18n（因为 i18n 本身可能是崩溃源）。

**包裹位置**（修改 `App.tsx`）：

```tsx
<ErrorBoundary>              {/* 全局兜底 */}
  <TopBar />
  <div className="flex flex-1">
    <Sidebar />
    <main>
      <ErrorBoundary>        {/* 主视图独立隔离 */}
        {/* Dashboard / TaskList / WorldMap / MilestoneHall / SOP */}
      </ErrorBoundary>
    </main>
  </div>
  <StatusBar />
</ErrorBoundary>
```

**验收**：
- [ ] 主视图组件抛异常时显示降级界面，不白屏
- [ ] TopBar/Sidebar/StatusBar 不受主视图崩溃影响
- [ ] 点击"重试"可尝试恢复，点击"重载"刷新应用

---

## v0.2-legacy-2：跨午夜习惯刷新

**优先级**：P0

**第一步：检查现有代码**。在 `habitStore.ts` 中搜索 `visibilitychange` 或 `setInterval` 或 `dateWatcher`。如果已存在且逻辑正确，标记为"已实现"跳过。

**如果未实现**，按以下规格实现：

新建 `src/utils/dateWatcher.ts`：

```typescript
export function startDateWatcher(onDateChange: () => void) {
  let lastDate = new Date().toDateString()

  const check = () => {
    const current = new Date().toDateString()
    if (current !== lastDate) {
      lastDate = current
      onDateChange()
    }
  }

  const intervalId = setInterval(check, 60_000)
  const handleVisibility = () => {
    if (document.visibilityState === 'visible') check()
  }
  document.addEventListener('visibilitychange', handleVisibility)

  return () => {
    clearInterval(intervalId)
    document.removeEventListener('visibilitychange', handleVisibility)
  }
}
```

在 `habitStore` 中新增 `resetDailyHabits` action（复用 `onRehydrateStorage` 中已有的日期检查逻辑，提取为共享函数）。

在 `App.tsx` 顶层 `useEffect` 中启动：

```typescript
useEffect(() => {
  return startDateWatcher(() => {
    useHabitStore.getState().resetDailyHabits()
  })
}, [])
```

**验收**：
- [ ] 应用跨午夜后习惯自动重置为 active
- [ ] 从后台切回前台时立即检查
- [ ] 跨周后 weeklyCompletionCount 重置

---

## fix2：热力图统计/显示错误

**优先级**：P0

**排查路径**：

1. 打开 `GrowthTrend.tsx`（或对应热力图组件）
2. 找到周视图的数据聚合逻辑
3. 检查时段划分：
   - 从 `GrowthEvent.timestamp` 提取小时：`new Date(event.timestamp).getHours()`
   - 时段归类：`hour >= 1 && hour < 6` → 行1，`hour >= 6 && hour < 12` → 行2，`hour >= 12 && hour < 18` → 行3，`hour >= 18 || hour < 1` → 行4
4. 检查网格渲染：应为 7 列（周一~日）× 4 行（时段）
5. 检查颜色映射阈值

**验收**：
- [ ] 周视图正确显示 7×4 网格
- [ ] 每个单元格的 XP 数据与实际完成时间段对应
- [ ] 颜色深浅正确反映 XP 量

---

## fix5：软件图标（修复快捷方式和任务栏）

**优先级**：P1

**问题**：安装包图标正常，但应用快捷方式和运行时任务栏没有图标。

**排查路径**：

1. 检查 `electron/main.ts` 中 `BrowserWindow` 的 `icon` 路径：
   ```typescript
   // 路径必须是绝对路径，且在打包后仍能正确解析
   import path from 'path'
   const iconPath = path.join(__dirname, '../build/icon.png')
   // 或使用 app.isPackaged 区分开发/生产路径
   ```

2. 检查 `electron-builder.yml`：
   ```yaml
   win:
     icon: build/icon.ico
     # 确保 extraResources 或 files 包含 build/ 目录
   ```

3. 关键点：开发模式下 `__dirname` 指向 `electron/`，打包后指向 `app.asar` 内部，路径需要适配两种场景

**验收**：
- [ ] 开发模式：任务栏显示自定义图标
- [ ] 打包后：桌面快捷方式显示自定义图标
- [ ] 打包后：运行时任务栏显示自定义图标

---

## fix8：编辑抽屉补充实际时长字段

**优先级**：P1

**问题**：实际时长只能在任务卡片上填写，编辑抽屉（TaskDrawer）里没有。

**实现**：在 `TaskDrawer.tsx` 中添加：

```tsx
{/* 实际用时 — 放在描述字段附近 */}
{task.status === 'done' ? (
  <div>
    <label>{t.task_actualMinutes}</label>
    <input
      type="number"
      min={0}
      value={task.actualMinutes ?? 0}
      onChange={e => updateTask(task.id, { actualMinutes: Number(e.target.value) })}
    />
    <span>{t.task_minuteUnit}</span>
  </div>
) : (
  <div className="text-[var(--color-text-secondary)]">
    {t.task_actualMinutesPlaceholder}
  </div>
)}
```

检查 i18n key `task_actualMinutes`、`task_minuteUnit`、`task_actualMinutesPlaceholder` 是否已存在（v0.2 可能已添加），没有则补充。

**验收**：
- [ ] 已完成任务打开抽屉显示实际用时（可编辑）
- [ ] 未完成任务显示灰色占位
- [ ] 修改后数据正确保存
