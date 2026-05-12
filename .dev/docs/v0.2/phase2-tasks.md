# Phase 2 — 功能增强 + PRD Patch + 数据导出

> **前置**：先阅读 `OVERVIEW.md` 了解架构规范和编码约定
> **依赖**：Phase 1 全部完成后再开始 Phase 2

---

## FEAT-03：角色状态混合模式

**优先级**：P1
**需求**：有 doing 任务时自动判定角色状态，无 doing 任务时可手动切换。

### 实现规格

在 `characterStore` 中新增派生状态计算：

```typescript
// characterStore.ts — 新增 action 或 getter
getDisplayStatus: () => {
  const tasks = useTaskStore.getState().tasks
  const doingTasks = tasks.filter(t => t.status === 'doing' && !t.deletedAt)
  
  if (doingTasks.length > 0) {
    // 自动模式：按最高优先级的 doing 任务的分类判定
    const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 }
    const topTask = doingTasks.sort((a, b) =>
      (priorityOrder[a.priority] ?? 2) - (priorityOrder[b.priority] ?? 2)
    )[0]
    
    return {
      mode: 'auto' as const,
      status: categoryToStatus(topTask.category),
    }
  }
  
  // 手动模式：使用用户选择的 globalStatus
  return {
    mode: 'manual' as const,
    status: get().globalStatus,
  }
}
```

分类 → 状态映射函数：

```typescript
function categoryToStatus(category: string): { emoji: string; label_key: string } {
  const map: Record<string, { emoji: string; label_key: string }> = {
    library:    { emoji: '📚', label_key: 'status_studying' },
    forge:      { emoji: '💼', label_key: 'status_working' },
    arena:      { emoji: '🏃', label_key: 'status_exercising' },
    workshop:   { emoji: '✨', label_key: 'status_creating' },
    home:       { emoji: '🏠', label_key: 'status_living' },
  }
  return map[category] ?? { emoji: '📌', label_key: 'status_busy' }
}
```

### UI 变更

**CharacterMini / CharacterPanel**：
- 自动状态时：状态文字旁显示小标签"自动"（用 i18n key），状态不可点击
- 手动状态时：状态文字可点击，弹出下拉选择（active/charging/resting/traveling/returning）

### i18n 新增 key

| key | zh | en |
|-----|----|----|
| `status_studying` | 学习中 | Studying |
| `status_working` | 工作中 | Working |
| `status_exercising` | 运动中 | Exercising |
| `status_creating` | 创作中 | Creating |
| `status_living` | 生活中 | At Home |
| `status_busy` | 忙碌中 | Busy |
| `status_auto` | 自动 | Auto |

### 影响文件

- `src/stores/characterStore.ts`
- `src/components/dashboard/CharacterMini.tsx`
- `src/components/milestone/CharacterPanel.tsx`
- `src/i18n/zh.ts`, `src/i18n/en.ts`

### 验收标准

- [ ] 有 doing 任务时，角色状态自动按分类显示，不可手动切换
- [ ] 同时有多个 doing 任务时，显示最高优先级那个的分类状态
- [ ] 无 doing 任务时，恢复为手动模式，可点击切换
- [ ] 状态旁有"自动"/"手动"标识

---

## FEAT-04：软件图标

**优先级**：P1
**需求**：添加应用程序图标。

### 实现步骤

1. **准备图标文件**（放在 `build/` 目录）：
   - `icon.ico` — Windows（256×256 多尺寸合一）
   - `icon.icns` — macOS
   - `icon.png` — Linux（512×512）

2. **electron-builder 配置**：
   ```yaml
   # electron-builder.yml
   directories:
     buildResources: build
   win:
     icon: build/icon.ico
   mac:
     icon: build/icon.icns
   linux:
     icon: build/icon.png
   ```

3. **BrowserWindow 配置**：
   ```typescript
   // electron/main.ts
   import path from 'path'
   
   const win = new BrowserWindow({
     icon: path.join(__dirname, '../build/icon.png'),
     // ...other options
   })
   ```

### 图标设计说明

等距像素风格的铁砧（Anvil），配合发光矿石/锤子元素，使用默认主题的 accent 橙色（#e8600a）。图标需要由设计师或外部工具生成，本任务负责配置集成部分。

### 验收标准

- [ ] Windows 任务栏和标题栏显示图标
- [ ] macOS Dock 显示图标
- [ ] 安装包使用自定义图标

---

## FEAT-05：仪表盘卡片滚动优化

**优先级**：P1
**需求**：合并 BUG-04，仪表盘任务和习惯卡片内容超出时可滚动。

### 实现规格

```tsx
// TaskCard.tsx / HabitCard.tsx 内容区域结构

<div className="flex flex-col h-full">
  {/* 卡片标题栏 — 固定 */}
  <div className="flex-shrink-0 px-4 py-3 border-b border-[var(--color-border)]">
    <h3>{t.dashboard_tasks}</h3>
  </div>
  
  {/* 快速创建 — sticky 固定在滚动区域顶部 */}
  <div className="flex-shrink-0 sticky top-0 z-10 bg-[var(--color-card)]">
    <QuickInput />
  </div>
  
  {/* 内容区域 — 可滚动 */}
  <div
    className="flex-1 overflow-y-auto px-4"
    style={{
      scrollbarWidth: 'thin',
      scrollbarColor: 'var(--color-border) transparent'
    }}
  >
    {tasks.map(task => <TaskItem key={task.id} task={task} />)}
  </div>
</div>
```

### 关键点

- 卡片容器必须有 `h-full` 和 `flex flex-col`，让 `flex-1` 区域获得正确的高度约束
- 快速创建输入框用 `sticky top-0` 固定在滚动区域顶部
- 习惯卡片同样处理
- Webkit 滚动条样式：
  ```css
  .scrollable::-webkit-scrollbar { width: 4px; }
  .scrollable::-webkit-scrollbar-thumb { background: var(--color-border); border-radius: 2px; }
  ```

### 影响文件

- `src/components/dashboard/TaskCard.tsx`
- `src/components/dashboard/HabitCard.tsx`
- `src/index.css`（自定义滚动条样式，如需要）

### 验收标准

- [ ] 任务/习惯数量超出卡片高度时可滚轮滚动
- [ ] 快速创建输入框固定在滚动区域顶部
- [ ] 滚动条为细条半透明，跟随主题
- [ ] 所有 8 个主题下滚动条样式正常

---

## PATCH-01：XP 计算公式修订 + 追溯重算

**优先级**：P1

### 公式变更

**连续活跃加成**（从线性改为阶梯式）：

```typescript
// 已经是阶梯式的话核对数值是否匹配：
function getStreakBonusRate(days: number): number {
  if (days >= 30) return 0.50
  if (days >= 14) return 0.30
  if (days >= 7)  return 0.20
  if (days >= 3)  return 0.10
  return 0
}
```

**计算公式改为先汇总倍率后统一 round**：

```typescript
function calculateTaskXP(task: Task, streakDays: number): { xp: number; ore: number } {
  const base = DIFFICULTY_MAP[task.difficulty]  // {1:1, 2:2, 3:3, 4:5, 5:8}
  
  const onTimeMultiplier = isOnTime(task) ? 1.2 : 1.0
  const streakMultiplier = 1 + getStreakBonusRate(streakDays)
  const difficultyMultiplier = task.difficulty >= 4 ? 1.5 : 1.0
  
  // 先乘后 round（一次性取整）
  const xp = Math.round(base * onTimeMultiplier * streakMultiplier * difficultyMultiplier)
  return { xp, ore: xp }
}
```

**新增频率折算系数**（高频习惯）：

```typescript
function calculateHabitXP(habit: Habit, streakDays: number): { xp: number; ore: number } {
  const base = DIFFICULTY_MAP[habit.difficulty]
  
  // 频率折算：每天出现的习惯 ×0.5，其他 ×1.0
  const frequencyMultiplier = habit.repeatType === 'daily' ? 0.5 : 1.0
  
  const streakMultiplier = 1 + getStreakBonusRate(streakDays)
  
  const xp = Math.round(base * frequencyMultiplier * streakMultiplier)
  return { xp, ore: xp }
}
```

### 追溯重算

在 `characterStore` 的 `onRehydrateStorage` 中实现：

```typescript
onRehydrateStorage: () => (state) => {
  if (!state) return
  
  // 检查 XP 公式版本
  if ((state.xpFormulaVersion ?? 0) < 2) {
    // 触发全量重算
    recalculateAllXP(state)
    state.xpFormulaVersion = 2
  }
}

function recalculateAllXP(state: CharacterState) {
  const taskStore = useTaskStore.getState()
  const habitStore = useHabitStore.getState()
  const areaStore = useAreaStore.getState()
  
  let totalXP = 0
  let totalOre = 0
  const categoryXP: Record<string, number> = {}
  
  // 1. 重算所有已完成任务的 XP
  taskStore.tasks
    .filter(t => t.status === 'done' && !t.parentId)
    .forEach(task => {
      const { xp, ore } = calculateTaskXP(task, /* 使用完成时的 streakDays，如果没有记录则用 0 */ 0)
      totalXP += xp
      totalOre += ore
      if (task.category) {
        categoryXP[task.category] = (categoryXP[task.category] ?? 0) + xp
      }
    })
  
  // 2. 重算习惯完成的 XP（如果有完成记录）
  // 注意：习惯的历史完成记录可能不完整（v0.1 的限制），
  // 如果没有足够的历史数据，可以用 totalCompletions * averageXP 估算
  
  // 3. 更新角色数据
  state.totalXP = totalXP
  state.totalOreEarned = totalOre
  state.ore = totalOre  // 简化处理：试用版不考虑已消费矿石
  state.level = calculateLevelFromXP(totalXP)
  state.currentXP = calculateCurrentXP(totalXP, state.level)
  
  // 4. 更新区域繁荣度
  Object.entries(categoryXP).forEach(([category, xp]) => {
    const area = areaStore.areas.find(a => a.category === category)
    if (area) {
      // 通过 areaStore 更新
      useAreaStore.getState().updateAreaXP(area.id, xp)
    }
  })
}
```

**注意**：重算逻辑的具体实现取决于现有数据模型中是否有足够的历史记录。如果历史记录不完整，需要做合理近似。在 `recalculateAllXP` 开始前显示 loading 状态。

### 类型变更

```typescript
// src/types/character.ts
interface Character {
  // ...existing fields
  xpFormulaVersion: number  // 新增
}
```

### 测试要求

**必须先更新 `xpEngine.test.ts`**，确认新公式的所有测试用例通过后再合并。

### 影响文件

- `src/engines/xpEngine.ts`
- `src/engines/xpEngine.test.ts`（更新断言值）
- `src/types/character.ts`（新增 `xpFormulaVersion`）
- `src/stores/characterStore.ts`（`onRehydrateStorage` 重算逻辑）

### 验收标准

- [ ] 新公式正确应用于新完成的任务/习惯
- [ ] 旧数据启动时自动触发全量重算
- [ ] 重算后等级和区域繁荣度与新公式一致
- [ ] 重算只执行一次（xpFormulaVersion 标记）
- [ ] 所有 xpEngine 测试通过

---

## PATCH-02：导航结构调整

**优先级**：P1

### 变更内容

| 变更 | 修改前 | 修改后 |
|------|--------|--------|
| 侧边栏第 4 个 Tab | 时间线 | 里程碑殿堂 |
| 世界地图里程碑殿堂区域名 | 里程碑殿堂 | 档案馆 |
| 时间线入口 | 侧边栏独立 Tab | 移入档案馆内部 |

### 实现步骤

1. **Sidebar.tsx**：第 4 个导航项从 `timeline` 改为 `milestone`

2. **App.tsx**：路由调整
   - 移除 timeline 作为独立视图的路由
   - 点击侧边栏第 4 个 Tab → 显示 MilestoneHall

3. **AreaNode.tsx** / 区域模板：里程碑殿堂区域改名为"档案馆"
   - 修改 `src/types/area.ts` 中的模板 `milestone` → 改显示名称为"档案馆/Archive"
   - i18n key 更新

4. **档案馆内部**：时间线移入档案馆内部空间（PATCH-04 会进一步完善，此处先做基础迁移）

### i18n 变更

| key | 修改前 zh | 修改后 zh | 修改后 en |
|-----|----------|----------|----------|
| `sidebar_milestone` | (新增) | 里程碑殿堂 | Milestone Hall |
| `area_archive` | (新增) | 档案馆 | Archive |
| `sidebar_timeline` | 时间线 | (删除或保留但不用) | - |

### 影响文件

- `src/components/layout/Sidebar.tsx`
- `src/App.tsx`
- `src/types/area.ts`（区域模板名称）
- `src/i18n/zh.ts`, `src/i18n/en.ts`

### 验收标准

- [ ] 侧边栏第 4 个 Tab 显示"里程碑殿堂"，点击进入 MilestoneHall
- [ ] 世界地图上原"里程碑殿堂"区域显示为"档案馆"
- [ ] 时间线不再是独立的侧边栏入口

---

## PATCH-03：习惯灵活次数 + 每月固定日期

**优先级**：P1

### 类型变更

```typescript
// src/types/habit.ts
interface Habit {
  // ...existing fields
  targetCount: number       // 新增：灵活次数目标（默认 1）
  currentCycleCount: number // 新增：当前周期已完成次数（默认 0）
  monthlyDays: number[]     // 新增：每月固定日期（如 [1, 15, 28]）
}
```

`repeatType` 联合类型新增 `'monthly_fixed'`。

### 灵活次数打卡逻辑

适用于 `repeatType === 'weekly_flexible'` 等有多次目标的模式：

```typescript
// 习惯卡片上显示进度环按钮
// 点击 → currentCycleCount + 1
// 达到 targetCount → 结算 XP，触发 completed_today
// 未达标 → 仅增加计数，不结算

completeHabitOnce: (id: string) => {
  set(state => ({
    habits: state.habits.map(h => {
      if (h.id !== id) return h
      const newCount = h.currentCycleCount + 1
      if (newCount >= h.targetCount) {
        // 达标：结算 XP + 标记完成
        return {
          ...h,
          currentCycleCount: newCount,
          status: 'completed_today',
          lastCompletedAt: new Date().toISOString(),
          consecutiveCount: h.consecutiveCount + 1,
          totalCompletions: h.totalCompletions + 1,
        }
      }
      // 未达标：仅增加计数
      return { ...h, currentCycleCount: newCount }
    })
  }))
}
```

### 每月固定日期判定

```typescript
// habitEngine.ts — isHabitDueToday 新增分支
case 'monthly_fixed': {
  const today = currentDate.getDate()
  const lastDayOfMonth = new Date(
    currentDate.getFullYear(),
    currentDate.getMonth() + 1,
    0
  ).getDate()
  
  return habit.monthlyDays.some(day => {
    // 月末边界：如果设定日期超过当月天数，视为月末
    if (day > lastDayOfMonth) return today === lastDayOfMonth
    return today === day
  })
}
```

### UI 变更

- 习惯编辑表单新增：目标次数输入框（targetCount）、月固定日期多选
- 习惯卡片：灵活次数模式下显示进度环（如 2/5）
- `onRehydrateStorage`：新字段兼容
  ```typescript
  h.targetCount = h.targetCount ?? 1
  h.currentCycleCount = h.currentCycleCount ?? 0
  h.monthlyDays = h.monthlyDays ?? []
  ```

### 测试要求

更新 `habitEngine.test.ts`，覆盖 `monthly_fixed` 调度和灵活次数逻辑。

### 影响文件

- `src/types/habit.ts`
- `src/stores/habitStore.ts`
- `src/engines/habitEngine.ts`
- `src/engines/habitEngine.test.ts`
- `src/components/dashboard/HabitCard.tsx`
- 习惯编辑表单组件
- `src/i18n/zh.ts`, `src/i18n/en.ts`

### 验收标准

- [ ] 每月固定日期模式正确判定是否 due
- [ ] 月末边界处理正确（设定 31 号，2 月按 28/29 号触发）
- [ ] 灵活次数打卡逐次增加计数
- [ ] 达到目标次数后结算 XP
- [ ] 未达标不结算 XP
- [ ] 跨周期自动重置 currentCycleCount
- [ ] habitEngine 测试全部通过

---

## PATCH-07：子任务状态联动

**优先级**：P1

### 实现规格

在 `taskStore` 中修改任务状态切换逻辑：

```typescript
// 子任务切换为 doing → 父任务自动跟随
setTaskStatus: (id: string, status: TaskStatus) => {
  set(state => {
    let tasks = [...state.tasks]
    const task = tasks.find(t => t.id === id)
    if (!task) return state
    
    // 更新当前任务
    tasks = tasks.map(t => t.id === id ? { ...t, status } : t)
    
    // 子任务 → doing：父任务也切换为 doing
    if (status === 'doing' && task.parentId) {
      tasks = tasks.map(t =>
        t.id === task.parentId && t.status === 'todo'
          ? { ...t, status: 'doing' }
          : t
      )
    }
    
    // 子任务 → done：检查是否所有子任务都完成
    if (status === 'done' && task.parentId) {
      const parent = tasks.find(t => t.id === task.parentId)
      if (parent) {
        const allChildrenDone = parent.childIds.every(childId => {
          const child = tasks.find(t => t.id === childId)
          return child?.status === 'done'
        })
        if (allChildrenDone) {
          // 标记需要提示用户（不自动完成父任务）
          // 通过返回值或额外 state 通知 UI 层弹出提示
        }
      }
    }
    
    return { tasks }
  })
}
```

### 全部子任务完成提示

当所有子任务都标记为 done 时，在 UI 层弹出提示：

```
"所有子任务已完成，是否完成父任务「{parentTitle}」？"
[完成] [稍后]
```

- 点击"完成" → 正常走父任务的完成流程（XP 计算等）
- 点击"稍后" → 不操作

### 影响文件

- `src/stores/taskStore.ts`
- `src/components/tasks/TaskItem.tsx`（提示 UI）

### 验收标准

- [ ] 子任务切换为 doing 时，todo 状态的父任务自动变为 doing
- [ ] 父任务已经是 doing 时不重复操作
- [ ] 最后一个子任务完成时弹出提示
- [ ] 确认后父任务走完整的完成流程（包括 XP 计算）
- [ ] 取消后无操作

---

## 补充 1：数据导出/导入

**优先级**：P1

### 导出

```typescript
// src/utils/dataExport.ts

interface ExportData {
  exportVersion: 1
  appVersion: '0.2.0'
  exportedAt: string
  data: {
    character: CharacterState
    tasks: TaskState
    habits: HabitState
    areas: AreaState
    badges: BadgeState
    decorations: DecorationState
    dashboard: DashboardState
    settings: SettingsState
    growthEvents: GrowthEventState
  }
}

async function exportData(): Promise<void> {
  const exportData: ExportData = {
    exportVersion: 1,
    appVersion: '0.2.0',
    exportedAt: new Date().toISOString(),
    data: {
      character: useCharacterStore.getState(),
      tasks: useTaskStore.getState(),
      habits: useHabitStore.getState(),
      areas: useAreaStore.getState(),
      badges: useBadgeStore.getState(),
      decorations: useDecorationStore.getState(),
      dashboard: useDashboardStore.getState(),
      settings: useSettingsStore.getState(),
      growthEvents: useGrowthEventStore.getState(),
    }
  }
  
  const json = JSON.stringify(exportData, null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  
  // Electron 环境：使用 dialog.showSaveDialog
  if (window.electronAPI?.saveFile) {
    await window.electronAPI.saveFile(json, 'anvilite-backup.json')
  } else {
    // 降级：浏览器下载
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `anvilite-backup-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }
}
```

**Electron 侧**（如果需要新增 IPC）：
```typescript
// electron/preload.ts — 新增
saveFile: (content: string, defaultName: string) => 
  ipcRenderer.invoke('save-file', content, defaultName)

// electron/main.ts — 新增 handler
ipcMain.handle('save-file', async (_, content, defaultName) => {
  const { filePath } = await dialog.showSaveDialog({
    defaultPath: defaultName,
    filters: [{ name: 'JSON', extensions: ['json'] }]
  })
  if (filePath) {
    await fs.promises.writeFile(filePath, content, 'utf-8')
  }
})
```

### 导入

```typescript
async function importData(file: File): Promise<{ success: boolean; error?: string }> {
  try {
    const text = await file.text()
    const data = JSON.parse(text) as ExportData
    
    // 校验
    if (!data.exportVersion || !data.data) {
      return { success: false, error: 'Invalid file format' }
    }
    if (data.exportVersion > 1) {
      return { success: false, error: 'File version too new' }
    }
    
    // 必要字段检查
    const requiredKeys = ['character', 'tasks', 'habits', 'areas', 'badges',
                          'decorations', 'dashboard', 'settings', 'growthEvents']
    for (const key of requiredKeys) {
      if (!(key in data.data)) {
        return { success: false, error: `Missing data: ${key}` }
      }
    }
    
    // 写入各 Store
    // 注意：需要用各 Store 的 setState 直接替换数据
    // 然后 reload 确保数据一致
    const prefix = getStoragePrefix()
    Object.entries(data.data).forEach(([key, value]) => {
      localStorage.setItem(`${prefix}-${key}`, JSON.stringify({ state: value }))
    })
    
    window.location.reload()
    return { success: true }
  } catch (e) {
    return { success: false, error: 'Failed to parse file' }
  }
}
```

### UI

在设置页面添加两个按钮：

```
数据管理
  [📤 导出数据]  [📥 导入数据]
```

导入前显示确认弹窗：
```
⚠️ 导入将覆盖当前所有数据，此操作不可撤销。
建议先导出当前数据作为备份。
[取消] [确认导入]
```

### 影响文件

- 新建 `src/utils/dataExport.ts`
- `src/components/layout/SettingsModal.tsx`
- `electron/main.ts`（新增 IPC handler）
- `electron/preload.ts`（新增 API）
- `src/i18n/zh.ts`, `src/i18n/en.ts`

### 验收标准

- [ ] 点击导出 → 弹出系统保存对话框 → 保存 JSON 文件
- [ ] JSON 文件包含所有 9 个 Store 的数据
- [ ] 点击导入 → 选择 JSON 文件 → 确认后数据覆盖并 reload
- [ ] 导入格式错误的文件 → 显示错误提示
- [ ] 导入前有确认弹窗
