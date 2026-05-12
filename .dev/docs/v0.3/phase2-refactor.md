# Phase 2 — Vitest + 子任务重构 + 功能改进

> **前置**：先阅读 `OVERVIEW.md`。Phase 1 全部完成后再开始。
> **执行顺序**：Vitest → feature6（重构）→ 其余改进项（可并行）

---

## Vitest 引入（P0，feature6 的前置任务）

### 配置

```bash
npm install -D vitest
```

在 `vite.config.ts` 中添加：
```typescript
/// <reference types="vitest" />
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
  }
})
```

`package.json`：
```json
{ "scripts": { "test": "vitest run", "test:watch": "vitest" } }
```

### 引擎测试

为以下 5 个引擎写测试，**先读源文件确认实际函数签名**：

| 文件 | 测试重点 |
|------|---------|
| `xpEngine.test.ts` | 各难度 XP、连续加成阶梯、频率折算、按时加成、子任务返回 0 |
| `levelEngine.test.ts` | 升级阈值公式、称号映射、prestige 判定 |
| `habitEngine.test.ts` | 8 种重复模式调度、连续计算（完成/跳过/缺席）、容错充能、灵活次数 |
| `prosperityEngine.test.ts` | 技能 XP → 等级 → 繁荣等级映射、边界值 |
| `badgeEngine.test.ts` | 各类别徽章条件判定、已获得不重复 |

**测试编写原则**：
- 先读源码确认函数签名，不假设
- 测边界值：0、1、阈值、阈值±1
- 日期相关用固定日期字符串，不用 `new Date()`
- 浮点数用 `toBeCloseTo`

---

## feature6：子任务重构为内嵌 checklist（P0）

**这是 v0.3 最大的变更。** fix1/fix3/fix4 在此一并解决。

### Step 1：类型变更

修改 `src/types/task.ts`：

```typescript
// 移除 parentId, childIds, nestingLevel
// 新增 subTasks

interface Task {
  id: string
  title: string
  category: string
  difficulty: 1 | 2 | 3 | 4 | 5
  priority: 'urgent' | 'high' | 'medium' | 'low'
  dueDate: string | null
  description: string
  estimatedMinutes?: number | null  // 保留字段，UI 不再使用
  actualMinutes: number
  status: 'todo' | 'doing' | 'done'
  xpReward: number
  completedAt: string | null
  deletedAt: string | null
  isHidden: boolean
  sortOrder: number
  createdAt: string
  updatedAt: string
  subTasks: SubTask[]  // ★ 新增
}

interface SubTask {
  id: string
  title: string
  completed: boolean
  sortOrder: number
  subTasks: SubTask[]  // 递归，最多 3 层
  createdAt: string
}
```

同步修改 `src/types/habit.ts`：

```typescript
interface Habit {
  // ...（移除 parentId, childIds, nestingLevel）
  subHabits: SubHabit[]  // ★ 新增
}

interface SubHabit {
  id: string
  title: string
  completed: boolean
  sortOrder: number
  subHabits: SubHabit[]
  createdAt: string
}
```

### Step 2：数据迁移

在 `taskStore.ts` 的 `onRehydrateStorage` 中：

```typescript
const SUBTASK_MIGRATION_KEY = 'anvilite-subtask-migration-v3'

onRehydrateStorage: () => (state) => {
  if (!state) return

  if (!localStorage.getItem(SUBTASK_MIGRATION_KEY)) {
    // 分离根任务和子任务
    const rootTasks = state.tasks.filter(t => !(t as any).parentId)
    const childTasks = state.tasks.filter(t => (t as any).parentId)

    // 按 parentId 建立映射
    const childrenMap = new Map<string, any[]>()
    childTasks.forEach(child => {
      const pid = (child as any).parentId
      const siblings = childrenMap.get(pid) || []
      siblings.push(child)
      childrenMap.set(pid, siblings)
    })

    // 递归组装
    function buildSubTasks(parentId: string): SubTask[] {
      const children = childrenMap.get(parentId) || []
      return children
        .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
        .map(child => ({
          id: child.id,
          title: child.title,
          completed: child.status === 'done',
          sortOrder: child.sortOrder ?? 0,
          subTasks: buildSubTasks(child.id),
          createdAt: child.createdAt,
        }))
    }

    // 重组
    state.tasks = rootTasks.map(root => ({
      ...root,
      subTasks: buildSubTasks(root.id),
    }))

    localStorage.setItem(SUBTASK_MIGRATION_KEY, new Date().toISOString())
  }

  // 兼容：确保所有任务都有 subTasks 字段
  state.tasks.forEach(t => {
    t.subTasks = t.subTasks ?? []
  })
}
```

习惯系统同理，在 `habitStore.ts` 中实现 `migrateToEmbeddedSubhabits`。

### Step 3：Store actions 重写

`taskStore.ts` 中替换子任务相关 actions：

```typescript
// 添加子任务
addSubTask: (taskId: string, title: string, parentSubTaskId?: string) => {
  const newSub: SubTask = {
    id: generateId(),
    title,
    completed: false,
    sortOrder: 0,
    subTasks: [],
    createdAt: new Date().toISOString(),
  }

  set(state => ({
    tasks: state.tasks.map(t => {
      if (t.id !== taskId) return t
      if (!parentSubTaskId) {
        // 添加到根级子任务
        return { ...t, subTasks: [...t.subTasks, { ...newSub, sortOrder: t.subTasks.length }] }
      }
      // 添加到嵌套子任务（递归查找）
      return { ...t, subTasks: addNestedSubTask(t.subTasks, parentSubTaskId, newSub) }
    })
  }))
}

// 切换子任务完成状态
toggleSubTask: (taskId: string, subTaskId: string) => {
  set(state => ({
    tasks: state.tasks.map(t => {
      if (t.id !== taskId) return t
      return { ...t, subTasks: toggleNested(t.subTasks, subTaskId) }
    })
  }))
}

// 删除子任务
removeSubTask: (taskId: string, subTaskId: string) => {
  set(state => ({
    tasks: state.tasks.map(t => {
      if (t.id !== taskId) return t
      return { ...t, subTasks: removeNested(t.subTasks, subTaskId) }
    })
  }))
}

// 编辑子任务标题
editSubTask: (taskId: string, subTaskId: string, title: string) => { /* 同模式 */ }

// 子任务排序
reorderSubTasks: (taskId: string, parentSubTaskId: string | null, newOrder: string[]) => { /* ... */ }
```

递归工具函数（建议放在 `src/utils/subTaskUtils.ts`）：

```typescript
function addNestedSubTask(subs: SubTask[], parentId: string, newSub: SubTask): SubTask[] {
  return subs.map(s => {
    if (s.id === parentId) {
      // 检查嵌套层级限制（最多 3 层）
      return { ...s, subTasks: [...s.subTasks, { ...newSub, sortOrder: s.subTasks.length }] }
    }
    return { ...s, subTasks: addNestedSubTask(s.subTasks, parentId, newSub) }
  })
}

function toggleNested(subs: SubTask[], targetId: string): SubTask[] {
  return subs.map(s => {
    if (s.id === targetId) return { ...s, completed: !s.completed }
    return { ...s, subTasks: toggleNested(s.subTasks, targetId) }
  })
}

function removeNested(subs: SubTask[], targetId: string): SubTask[] {
  return subs
    .filter(s => s.id !== targetId)
    .map(s => ({ ...s, subTasks: removeNested(s.subTasks, targetId) }))
}
```

### Step 4：组件重写

**TaskItem.tsx** — 子任务内联展示：

```tsx
<div className="task-card">
  {/* 父任务内容 */}
  <div className="flex items-center gap-2">
    <Checkbox checked={task.status === 'done'} onChange={...} />
    <span>{task.title}</span>
    {task.subTasks.length > 0 && (
      <span className="text-xs text-[var(--color-text-secondary)]">
        {task.subTasks.filter(s => s.completed).length}/{task.subTasks.length}
      </span>
    )}
  </div>

  {/* 子任务 checklist */}
  {visibleSubTasks.map(sub => (
    <SubTaskItem key={sub.id} subTask={sub} taskId={task.id} depth={0} />
  ))}

  {/* 折叠/展开 */}
  {task.subTasks.length > maxVisible && !expanded && (
    <button onClick={() => setExpanded(true)}>
      {t.task_showMore(task.subTasks.length - maxVisible)}
    </button>
  )}

  {/* 添加步骤 */}
  <AddSubTaskInput taskId={task.id} />
</div>
```

**SubTaskItem.tsx** — 新建组件：

```tsx
function SubTaskItem({ subTask, taskId, depth }: Props) {
  const [editing, setEditing] = useState(false)
  const maxDepth = 2  // 最多 3 层（0, 1, 2）

  return (
    <div style={{ marginLeft: depth * 20 }} className="flex items-center gap-2 py-0.5 group">
      <input
        type="checkbox"
        checked={subTask.completed}
        onChange={() => toggleSubTask(taskId, subTask.id)}
      />
      {editing ? (
        <input autoFocus value={subTask.title}
          onBlur={() => setEditing(false)}
          onKeyDown={e => e.key === 'Enter' && setEditing(false)} />
      ) : (
        <span
          onClick={() => setEditing(true)}
          className={subTask.completed ? 'line-through text-[var(--color-text-secondary)]' : ''}
        >
          {subTask.title}
        </span>
      )}
      {depth < maxDepth && (
        <button className="opacity-0 group-hover:opacity-50" onClick={() => addNestedSubTask(...)}>+</button>
      )}
      <button className="opacity-0 group-hover:opacity-50" onClick={() => removeSubTask(taskId, subTask.id)}>×</button>

      {/* 递归渲染子项的子项 */}
      {subTask.subTasks.map(child => (
        <SubTaskItem key={child.id} subTask={child} taskId={taskId} depth={depth + 1} />
      ))}
    </div>
  )
}
```

**TaskDrawer.tsx** — 底部子任务编辑区：

- 显示所有子项（可编辑标题、排序、删除、添加）
- 支持拖拽排序（Framer Motion Reorder，同级内）
- 添加入口在列表底部

**各位置展示规则**：

| 位置 | 默认显示数 | 折叠行为 |
|------|-----------|---------|
| 任务系统列表 | 全部，>5 个折叠 | 展开更多按钮 |
| 仪表盘 TaskCard | >3 个折叠 | 展开更多按钮 |
| 编辑抽屉 | 全部 | 不折叠 |

### Step 5：测试

```typescript
// src/utils/subTaskUtils.test.ts
describe('addNestedSubTask', () => {
  it('添加到根级子任务', () => { /* ... */ })
  it('添加到嵌套子任务', () => { /* ... */ })
  it('3 层嵌套限制', () => { /* ... */ })
})

describe('toggleNested', () => {
  it('切换指定子任务的完成状态', () => { /* ... */ })
  it('深层嵌套切换', () => { /* ... */ })
})

describe('migrateToEmbeddedSubtasks', () => {
  it('平铺结构正确转为内嵌', () => { /* ... */ })
  it('多层嵌套正确递归', () => { /* ... */ })
  it('无子任务的根任务不受影响', () => { /* ... */ })
  it('迁移后数组中只有根任务', () => { /* ... */ })
})
```

### 影响文件

- `src/types/task.ts`、`src/types/habit.ts`
- `src/stores/taskStore.ts`、`src/stores/habitStore.ts`
- 新建 `src/utils/subTaskUtils.ts` + `subTaskUtils.test.ts`
- `src/components/tasks/TaskItem.tsx`（重写子任务展示）
- 新建 `src/components/tasks/SubTaskItem.tsx`
- `src/components/tasks/TaskDrawer.tsx`（底部子任务编辑区）
- `src/components/dashboard/TaskCard.tsx`（内联子任务 + 折叠）
- 习惯相关组件同步修改

### 验收

- [ ] tasks[] 中只存根任务，无 parentId 条目
- [ ] 子任务内联显示在父任务卡片内（checkbox + 文字）
- [ ] 勾选子任务有动画，不获得 XP
- [ ] 行内编辑子任务标题（点击 → 输入框 → 回车保存）
- [ ] 添加步骤（行内输入框 → 回车创建）
- [ ] 删除子任务（× 按钮，无二次确认）
- [ ] 3 层嵌套正常工作
- [ ] 仪表盘 >3 个子项折叠
- [ ] 任务系统 >5 个子项折叠
- [ ] v0.2 旧数据迁移后子任务正确内嵌
- [ ] 习惯子项同步改为 checklist
- [ ] TypeScript 编译零错误
- [ ] 所有测试通过

---

## feature1：热力图月视图 xy 轴交换（P1）

**变更**：月视图从 7 行×4-5 列改为 4-5 行×7 列。X 轴为星期（周一~日），Y 轴为周次。

找到 `GrowthTrend.tsx` 中月视图的网格渲染逻辑，交换行列即可。

**验收**：
- [ ] 月视图横向显示 7 列（周一~日），纵向显示每周

---

## feature2：仪表盘所有卡片可调位置（P1）

确认所有卡片（任务、习惯、统计、角色迷你卡、快速创建、成长趋势、灵感）均注册到 `dashboardStore` 的网格系统，每张卡片有拖拽手柄。

**验收**：
- [ ] 所有卡片均可拖拽移动和调整大小
- [ ] 布局变更实时持久化

---

## feature5：删除预估时间（P1）

- 从 `TaskDrawer.tsx` 移除预估时间输入框
- 从 `TaskItem.tsx` 移除预估时间显示
- `Task` 类型中 `estimatedMinutes` 字段保留但标注为废弃（`@deprecated`），UI 不再使用
- 不需要数据迁移

**验收**：
- [ ] 创建/编辑任务时无预估时间字段
- [ ] 任务卡片不显示预估时间
- [ ] TypeScript 编译零错误

---

## fix6：灵感列表拖拽（P1）

检查灵感列表的拖拽排序：事件绑定、`sortOrder` 持久化、拖拽视觉反馈。

**验收**：
- [ ] 灵感条目可拖拽排序
- [ ] 排序持久化（刷新后保持）

---

## fix7：仪表盘拖拽吸附（P1）

检查 `snapPos()` / `snapSpan()` 的网格计算。列宽 = `(containerWidth - 23 * gap) / 24`。

**验收**：
- [ ] 拖拽卡片准确对齐网格线
- [ ] 不同窗口尺寸下吸附正常
