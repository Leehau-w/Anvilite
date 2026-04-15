# Agent A — 任务体系开发规格

> **角色**：Agent A，负责 X1-X4 修复 + F1 计时 + F2 标签 + F4 子项入口
> **独占文件**：见 `PARALLEL-GUIDE.md` Agent A 独占列表
> **执行顺序**：Phase 1（修复 + F4）→ Phase 2（F1 + F2）

---

## Phase 1 — 修复 + F4 子项入口（2-3 天）

### X2 — 编辑抽屉点击添加子项时自动关闭

**文件**：`src/components/ui/Drawer.tsx`

**根因**：第 22 行遮罩层 `onClick={onClose}` 捕获了子元素的冒泡事件。

**修复**：

```typescript
// 旧
onClick={onClose}

// 新
onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
```

仅当直接点击遮罩层本身时才关闭。

**验收**：在编辑抽屉中点击任何按钮（包括「+」添加子项），抽屉不关闭；点击遮罩层空白区域，抽屉正常关闭。

---

### X3 — 切换分类 Tab 时任务卡片飞出动画

**文件**：`src/components/tasks/TaskList.tsx`

**根因**：切换分类 Tab 时，`Reorder.Group` 中的 `TaskItem` 触发了 `AnimatePresence` 的 exit 动画（fly-out）。分类切换应该是列表整体替换，不是单项退出。

**修复**：在 doing 区和 todo 区的 `Reorder.Group`（或其外层容器）加上 `key={activeCategory}`：

```tsx
// 找到变量 activeCategory 的使用位置（约第 35 行定义）
// 在 Reorder.Group 的外层加 key

<div key={activeCategory}>
  <Reorder.Group ...>
    {localDoing.map(task => (
      <Reorder.Item key={task.id} value={task} ...>
        <TaskItem task={task} onEdit={openEdit} />
      </Reorder.Item>
    ))}
  </Reorder.Group>
</div>
```

切换分类时整个容器重渲染，不触发单项退出动画。

**注意**：doing 区和 todo 区都需要加。如果 doing 区和 todo 区在同一个滚动容器内，把 key 加在它们的共同父级即可。

**验收**：切换分类 Tab 时，任务列表直接切换内容，无飞出/淡出动画；勾选完成任务时，飞出动画仍然正常。

---

### X4 — 子项选框完成后样式不统一

**文件**：
- `src/components/ui/Checkbox.tsx`（**新建**）
- `src/components/tasks/SubTaskItem.tsx`（修改）

**步骤 1**：创建共享 Checkbox 组件

```typescript
// src/components/ui/Checkbox.tsx
import React from 'react'

interface CheckboxProps {
  checked: boolean
  onChange: () => void
  size?: number  // 默认 13（子项尺寸）
  disabled?: boolean
}

export function Checkbox({ checked, onChange, size = 13, disabled }: CheckboxProps) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onChange() }}
      disabled={disabled}
      style={{
        width: size,
        height: size,
        borderRadius: 'var(--radius-sm)',
        border: checked ? 'none' : '1.5px solid var(--color-border)',
        background: checked ? 'var(--color-success)' : 'transparent',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: disabled ? 'default' : 'pointer',
        padding: 0,
        flexShrink: 0,
        transition: 'all 0.15s ease',
      }}
    >
      {checked && (
        <svg width={size * 0.6} height={size * 0.6} viewBox="0 0 10 10" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M2 5 L4.5 7.5 L8 3" />
        </svg>
      )}
    </button>
  )
}
```

**步骤 2**：在 `SubTaskItem.tsx` 中替换原生 checkbox

找到 `<input type="checkbox">` 或类似的原生选框，替换为 `<Checkbox checked={subTask.completed} onChange={...} size={13} />`。

**验收**：子项选框与父任务勾选按钮在风格上一致（绿色背景 + 白色勾号），尺寸为 13×13px。

---

### X1 — 应用图标未生效

**文件**：
- `electron-builder.json`
- `electron/main.ts`
- `build/icon.ico`（新建）

**步骤**：

1. 检查 `build/icon.png` 是否存在且分辨率 ≥ 256×256
2. 使用 sharp 或在线工具从 `icon.png` 生成 `icon.ico`（包含 16/32/48/256 四个分辨率）。如果无法在终端中生成 ico，提示用户手动转换后放到 `build/icon.ico`
3. 修改 `electron-builder.json`：

```json
"win": {
  "icon": "build/icon.ico",
  ...
},
"nsis": {
  ...,
  "installerIcon": "build/icon.ico",
  "uninstallerIcon": "build/icon.ico"
}
```

4. 修改 `electron/main.ts` 中 `BrowserWindow` 的 `icon` 路径：

```typescript
icon: app.isPackaged
  ? path.join(process.resourcesPath, 'build/icon.ico')
  : path.join(process.cwd(), 'build/icon.ico'),
```

5. `extraResources` 也同步改为 `icon.ico`：

```json
"extraResources": [
  { "from": "build/icon.ico", "to": "build/icon.ico" }
]
```

**验收**：打包后安装，任务栏和桌面快捷方式显示 Anvilite 图标。

---

### F4 — 子项入口优化

**文件**：
- `src/components/tasks/TaskItem.tsx`
- `src/components/tasks/TaskDrawer.tsx`

#### TaskItem 变更

找到子项折叠按钮区域（`▾ N/M` 的渲染位置）。

**有子项时**：在折叠按钮旁边新增 `+` 图标按钮，**常显**（不需要 hover）：

```tsx
{/* 折叠按钮 */}
<button onClick={toggleCollapse}>▾ {completedCount}/{totalCount}</button>

{/* 新增：添加子项按钮，常显 */}
{!compact && (
  <button
    onClick={(e) => { e.stopPropagation(); setShowSubTaskInput(true) }}
    style={{
      width: 16, height: 16,
      borderRadius: 'var(--radius-sm)',
      color: 'var(--color-text-dim)',
      fontSize: 14,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'transparent', border: 'none', cursor: 'pointer',
      padding: 0,
    }}
    onMouseEnter={(e) => { (e.target as HTMLElement).style.color = 'var(--color-accent)' }}
    onMouseLeave={(e) => { (e.target as HTMLElement).style.color = 'var(--color-text-dim)' }}
    title={t.task_addSubtask}
  >
    +
  </button>
)}
```

**无子项时**：常显文字按钮 `+ 添加子项`：

```tsx
{task.subTasks.length === 0 && !compact && (
  <button
    onClick={(e) => { e.stopPropagation(); setShowSubTaskInput(true) }}
    style={{
      color: 'var(--color-text-dim)',
      fontSize: 12,
      background: 'transparent', border: 'none', cursor: 'pointer',
      padding: '2px 0',
    }}
  >
    + {t.task_addSubtask}
  </button>
)}
```

**移除**：原来 hover 时才显示的 `+ 添加子项` 链接（找到 `showSubTaskInput` 相关的 hover 守卫并去掉）。

#### TaskDrawer 变更

找到编辑抽屉的表单布局，将子项区域从当前位置（备注下方）移到**截止日期下方、备注上方**。

布局顺序（从上到下）：
1. 标题
2. 分类按钮组
3. 标签（F2 新增，Phase 2 实现）
4. 难度
5. 优先级
6. 截止日期
7. **─── 分割线 ───**
8. **子项列表 + 添加子项输入框**（移到这里）
9. **─── 分割线 ───**
10. 备注
11. 实际用时（已完成时显示）

**验收**：
- 有子项的任务卡片，折叠按钮旁边常显 `+` 按钮
- 无子项的任务卡片，标题下方常显 `+ 添加子项` 文字按钮
- 编辑抽屉中，子项区域在截止日期和备注之间
- 仪表盘（compact 模式）不显示 `+` 按钮

---

## Phase 2 — F1 计时 + F2 标签（3-4 天）

### F1 — 任务计时

#### 步骤 1：前置清理

**文件**：`src/stores/taskStore.ts`

找到 `onRehydrateStorage` 回调中的这段代码（约第 415 行）：

```typescript
if ('timerStartedAt' in legacy) delete legacy.timerStartedAt
if ('timerElapsed' in legacy) delete legacy.timerElapsed
```

**删除这两行**。这是 v0.3 清理旧 timer 字段的代码，v0.3.1 重新引入 timer 后不再需要。

#### 步骤 2：创建 timerEngine

**文件**：`src/engines/timerEngine.ts`（新建）

```typescript
/** 4 小时阈值（秒），超过则自动暂停 */
export const TIMER_STALE_THRESHOLD = 4 * 60 * 60

/** 返回当前已流逝的总秒数 */
export function getElapsedSeconds(startedAt: string | null, accumulated: number): number {
  if (!startedAt) return accumulated
  const elapsed = Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000)
  return accumulated + Math.max(0, elapsed)
}

/** 格式化为 HH:MM:SS 或 MM:SS */
export function formatElapsed(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  const s = totalSeconds % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${m}:${String(s).padStart(2, '0')}`
}
```

**文件**：`src/engines/timerEngine.test.ts`（新建）

覆盖用例：
- `getElapsedSeconds`: startedAt 为 null → 返回 accumulated
- `getElapsedSeconds`: 正在计时 → 返回 accumulated + 已流逝秒数
- `formatElapsed`: 0 → `0:00`
- `formatElapsed`: 65 → `1:05`
- `formatElapsed`: 3661 → `1:01:01`

#### 步骤 3：Task 类型新增字段

**文件**：`src/types/task.ts`

在 `Task` interface 中新增：

```typescript
timerStartedAt: string | null
timerAccumulated: number
tags: string[]                    // F2 用，一起加
```

#### 步骤 4：taskStore 新增 timer actions + 迁移

**文件**：`src/stores/taskStore.ts`

**新增 actions（在 store 定义中）**：

```typescript
startTimer: (taskId: string) => void
pauseTimer: (taskId: string) => void
stopTimer: (taskId: string) => void
// tag actions 在 F2 部分添加
```

**实现**：

```typescript
startTimer: (taskId) => {
  set((s) => ({
    tasks: s.tasks.map((t) =>
      t.id === taskId && !t.timerStartedAt
        ? { ...t, timerStartedAt: new Date().toISOString() }
        : t
    ),
  }))
},

pauseTimer: (taskId) => {
  const task = get().tasks.find((t) => t.id === taskId)
  if (!task || !task.timerStartedAt) return
  const elapsed = Math.floor((Date.now() - new Date(task.timerStartedAt).getTime()) / 1000)
  set((s) => ({
    tasks: s.tasks.map((t) =>
      t.id === taskId
        ? { ...t, timerAccumulated: t.timerAccumulated + Math.max(0, elapsed), timerStartedAt: null }
        : t
    ),
  }))
},

stopTimer: (taskId) => {
  const task = get().tasks.find((t) => t.id === taskId)
  if (!task) return
  let totalSeconds = task.timerAccumulated
  if (task.timerStartedAt) {
    totalSeconds += Math.max(0, Math.floor((Date.now() - new Date(task.timerStartedAt).getTime()) / 1000))
  }
  set((s) => ({
    tasks: s.tasks.map((t) =>
      t.id === taskId
        ? { ...t, actualMinutes: Math.round(totalSeconds / 60), timerAccumulated: 0, timerStartedAt: null }
        : t
    ),
  }))
},
```

**completeTask 增强**：在现有 `completeTask` 逻辑中，完成任务时如果有活跃计时或暂停的累计时间，自动写入 `actualMinutes`：

```typescript
// 在 completeTask 的任务状态更新前：
let taskActualMinutes = task.actualMinutes
if (task.timerStartedAt || task.timerAccumulated > 0) {
  let totalSec = task.timerAccumulated
  if (task.timerStartedAt) {
    totalSec += Math.max(0, Math.floor((Date.now() - new Date(task.timerStartedAt).getTime()) / 1000))
  }
  taskActualMinutes = Math.round(totalSec / 60)
}
// 然后在更新任务时用 taskActualMinutes
// 同时重置: timerStartedAt: null, timerAccumulated: 0
```

**onRehydrateStorage 迁移**：

```typescript
// 在现有 rehydrate 回调中新增：
const TIMER_TAGS_MIGRATION = 'anvilite-migration-timer-tags-v031'
if (!localStorage.getItem(TIMER_TAGS_MIGRATION)) {
  state.tasks = state.tasks.map((t) => ({
    ...t,
    timerStartedAt: t.timerStartedAt ?? null,
    timerAccumulated: t.timerAccumulated ?? 0,
    tags: t.tags ?? [],
  }))
  localStorage.setItem(TIMER_TAGS_MIGRATION, new Date().toISOString())
}

// 4 小时过期自动暂停（每次 rehydrate 都执行，不需要版本标记）
const STALE_THRESHOLD = 4 * 60 * 60
const now = Date.now()
let staleCount = 0
state.tasks = state.tasks.map((t) => {
  if (!t.timerStartedAt) return t
  const elapsed = (now - new Date(t.timerStartedAt).getTime()) / 1000
  if (elapsed > STALE_THRESHOLD) {
    staleCount++
    return { ...t, timerAccumulated: t.timerAccumulated + STALE_THRESHOLD, timerStartedAt: null }
  }
  return t
})
// staleCount 存到 state 或 sessionStorage 以便 UI 显示 toast
if (staleCount > 0) {
  sessionStorage.setItem('anvilite-stale-timers', String(staleCount))
}
```

#### 步骤 5：habitStore 增强

**文件**：`src/types/habit.ts`

在 `Habit` interface 中新增：

```typescript
timerAccumulated: number
```

**文件**：`src/stores/habitStore.ts`

1. `addHabit` 的 Omit 列表加入 `timerAccumulated`
2. `addHabit` 默认值加 `timerAccumulated: 0`
3. 修改 `pauseHabitTimer`：

```typescript
// 旧（bug：丢失计时数据）
pauseHabitTimer: (id) => {
  get().updateHabit(id, { timerStartedAt: null })
},

// 新
pauseHabitTimer: (id) => {
  const habit = get().habits.find((h) => h.id === id)
  if (!habit || !habit.timerStartedAt) return
  const elapsed = Math.floor((Date.now() - new Date(habit.timerStartedAt).getTime()) / 1000)
  get().updateHabit(id, {
    timerAccumulated: (habit.timerAccumulated ?? 0) + Math.max(0, elapsed),
    timerStartedAt: null,
  })
},
```

4. `completeHabit` 增强：完成时如有计时，自动写入 `actualMinutes`（逻辑同 taskStore）
5. `onRehydrateStorage` 迁移：新增 `timerAccumulated: h.timerAccumulated ?? 0` + 4 小时过期自动暂停

#### 步骤 6：TimerBadge 组件

**文件**：`src/components/tasks/TimerBadge.tsx`（新建）

```typescript
interface TimerBadgeProps {
  startedAt: string | null
  accumulated: number
  onToggle: () => void  // 点击切换暂停/继续
}
```

- 计时中：`var(--color-accent)` 10% 背景 + accent 文字 + 脉冲圆点
- 暂停态：`var(--color-text-dim)` 文字，无脉冲
- 每秒更新：`useEffect` + `setInterval(1000)`，在 `startedAt` 变化时重置
- 使用 `getElapsedSeconds` 和 `formatElapsed` 计算显示值

**脉冲动画**：

```tsx
<motion.span
  animate={{ scale: [1, 1.3, 1], opacity: [1, 0.5, 1] }}
  transition={{ duration: 1.5, repeat: Infinity }}
  style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--color-accent)', display: 'inline-block' }}
/>
```

**徽章出现/消失**：

```tsx
<motion.div
  initial={{ opacity: 0, scale: 0.8 }}
  animate={{ opacity: 1, scale: 1 }}
  exit={{ opacity: 0 }}
  transition={{ duration: 0.2 }}
>
```

#### 步骤 7：TaskItem 集成 timer

**文件**：`src/components/tasks/TaskItem.tsx`

1. hover 操作栏新增 `⏱` 计时按钮（仅空闲态显示）
2. 有活跃计时或暂停累计时，卡片右上角常显 `TimerBadge`
3. 点击逻辑：
   - 空闲 → 点击 `⏱` → `startTimer(task.id)`
   - 计时中 → 点击 badge → `pauseTimer(task.id)`
   - 暂停 → 点击 badge → `startTimer(task.id)`

#### 步骤 8：Stale timer toast

在 `App.tsx` 或顶层组件中，`useEffect` 检查 `sessionStorage.getItem('anvilite-stale-timers')`，有值时弹 toast 提示并清除。

---

### F2 — 标签系统

#### 步骤 1：创建 tagColor 工具

**文件**：`src/utils/tagColor.ts`（新建）

```typescript
export const TAG_PALETTE = [
  '#e8600a', '#8b5cf6', '#16a34a', '#0891b2', '#d97706',
  '#ec4899', '#6366f1', '#14b8a6', '#f43f5e', '#84cc16',
]

export function getTagColor(tagName: string): string {
  let hash = 0
  for (let i = 0; i < tagName.length; i++) {
    hash = ((hash << 5) - hash + tagName.charCodeAt(i)) | 0
  }
  return TAG_PALETTE[Math.abs(hash) % TAG_PALETTE.length]
}
```

**文件**：`src/utils/tagColor.test.ts`（新建）

覆盖：相同标签名稳定返回、不同名分布、空字符串不崩。

#### 步骤 2：taskStore 新增 tag actions

**文件**：`src/stores/taskStore.ts`

```typescript
addTag: (taskId: string, tag: string) => void
removeTag: (taskId: string, tag: string) => void
```

实现中注意：
- `addTag`：去重（`.includes` 检查）、上限 5 个、截断 20 字符
- `removeTag`：`.filter(t => t !== tag)`
- `tags` 字段的迁移已在 F1 步骤 4 中一并处理

#### 步骤 3：TagPill 组件

**文件**：`src/components/tasks/TagPill.tsx`（新建）

```typescript
interface TagPillProps {
  tag: string
  size?: 'sm' | 'md'       // sm=卡片上显示, md=编辑抽屉
  onRemove?: () => void     // 有则显示 × 按钮
}
```

- 背景：`getTagColor(tag)` + 15% 透明度
- 文字：`getTagColor(tag)` 纯色
- sm：字号 11px，padding 2px 8px
- md：字号 12px，padding 4px 12px

#### 步骤 4：TagInput 组件

**文件**：`src/components/tasks/TagInput.tsx`（新建）

```typescript
interface TagInputProps {
  tags: string[]
  allTags: string[]         // 建议列表（从 taskStore 获取）
  onChange: (tags: string[]) => void
  maxTags?: number          // 默认 5
}
```

- `+ 添加标签` 按钮 → 展开内联输入框
- 输入时过滤 `allTags` 显示下拉建议
- Enter / 点击建议 → 添加标签
- 重复标签忽略、超上限提示 `t.tag_maxReached`

#### 步骤 5：TagFilterBar 组件

**文件**：`src/components/tasks/TagFilterBar.tsx`（新建）

```typescript
interface TagFilterBarProps {
  tags: string[]              // 当前视图中所有出现的标签
  selectedTags: string[]      // 选中的筛选标签
  onToggle: (tag: string) => void
  onClear: () => void
}
```

- 胶囊样式排列
- 选中态：高亮（背景色加深）
- 右侧「清除筛选」按钮

#### 步骤 6：TaskDrawer 集成标签

**文件**：`src/components/tasks/TaskDrawer.tsx`

在分类按钮组下方添加 `TagInput` 组件。

获取建议列表：

```typescript
const allTags = useMemo(() => {
  const set = new Set<string>()
  tasks.forEach((t) => t.tags?.forEach((tag) => set.add(tag)))
  return [...set].sort()
}, [tasks])
```

#### 步骤 7：TaskItem 显示标签

**文件**：`src/components/tasks/TaskItem.tsx`

在标题下方、截止日期区域渲染标签：

```tsx
{!compact && task.tags.length > 0 && (
  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
    {task.tags.slice(0, 3).map((tag) => (
      <TagPill key={tag} tag={tag} size="sm" />
    ))}
    {task.tags.length > 3 && (
      <span style={{ fontSize: 11, color: 'var(--color-text-dim)' }}>
        {t.tag_more(task.tags.length - 3)}
      </span>
    )}
  </div>
)}
```

仪表盘（compact）不显示标签。

#### 步骤 8：TaskList 标签筛选

**文件**：`src/components/tasks/TaskList.tsx`

1. 新增状态 `selectedTags: string[]`
2. 从 `visible` 任务中提取所有标签
3. 在分类 Tab 栏下方渲染 `TagFilterBar`（仅当存在标签时显示）
4. 筛选逻辑（并集）：

```typescript
const filtered = useMemo(() => {
  if (selectedTags.length === 0) return visible
  return visible.filter((t) => t.tags?.some((tag) => selectedTags.includes(tag)))
}, [visible, selectedTags])
```

5. 用 `filtered` 替代 `visible` 作为 doing/todo 的数据源

---

### i18n 新增（Phase 1 + Phase 2 合并）

在 `src/i18n/zh.ts` 和 `src/i18n/en.ts` 中添加：

```typescript
// Timer
timer_start: '开始计时',                    // 'Start Timer'
timer_pause: '暂停计时',                    // 'Pause Timer'
timer_resume: '继续计时',                   // 'Resume Timer'
timer_stop: '停止计时',                     // 'Stop Timer'
timer_running: '计时中',                    // 'Timing'
timer_paused: '已暂停',                     // 'Paused'
timer_autoRecorded: '已自动记录用时',        // 'Time auto-recorded'
timer_stalePaused: (n: number) =>           // (n) => `${n} timer(s) auto-paused (away over 4 hours)`
  `${n} 个计时器已自动暂停（离开超过 4 小时）`,

// Tags
tag_add: '添加标签',                        // 'Add Tag'
tag_placeholder: '输入标签名',              // 'Tag name'
tag_maxReached: '最多 5 个标签',            // 'Max 5 tags'
tag_clearFilter: '清除筛选',                // 'Clear filter'
tag_more: (n: number) => `+${n}`,          // (n) => `+${n}`
```

---

## 质量验收（Phase 1 + Phase 2 全部完成后）

| 检查 | 命令 | 标准 |
|------|------|------|
| `tsc --noEmit` | 零错误 | |
| `npx vitest run` | 全通过 | |
| X2 | 抽屉内点击不关闭 | |
| X3 | 切换分类无飞出动画 | |
| X4 | 子项选框风格统一 | |
| X1 | 打包后图标正确 | |
| F4 | `+` 常显 + 抽屉位置 | |
| F1 | 计时启停暂停 + 完成自动记录 + stale toast | |
| F2 | 标签增删 + 卡片显示 + 筛选条 | |
