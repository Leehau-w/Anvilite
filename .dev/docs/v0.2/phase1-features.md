# Phase 1 — 功能实现（FEAT-01, FEAT-02）

> **前置**：先阅读 `OVERVIEW.md` 了解架构规范和编码约定

---

## FEAT-01：任务拖拽排序

**优先级**：P0
**需求**：用户可在任务列表中拖拽调整任务顺序。

### 技术方案选择

**优先使用 Framer Motion `Reorder`**（项目已依赖 Framer Motion，无新依赖）：

```tsx
import { Reorder } from 'framer-motion'
```

如果 Reorder 功能不满足需求（如需要跨分组拖拽），再切换到 `@dnd-kit/core` + `@dnd-kit/sortable`。

### 数据模型变更

在 `Task` 类型中新增字段：

```typescript
// src/types/task.ts
interface Task {
  // ...existing fields
  sortOrder: number  // 拖拽排序序号，越小越靠前
}
```

在 `taskStore` 的 `onRehydrateStorage` 中兼容：

```typescript
state.tasks.forEach((t, i) => {
  t.sortOrder = t.sortOrder ?? i  // 旧数据按原有顺序赋初值
})
```

### 实现规格

```tsx
// TaskList.tsx
const [orderedTasks, setOrderedTasks] = useState(sortedTasks)

// 同步外部变化
useEffect(() => { setOrderedTasks(sortedTasks) }, [sortedTasks])

<Reorder.Group
  axis="y"
  values={orderedTasks}
  onReorder={(newOrder) => {
    setOrderedTasks(newOrder)
    // 更新每个 task 的 sortOrder
    const updates = newOrder.map((task, index) => ({
      id: task.id,
      sortOrder: index
    }))
    taskStore.getState().batchUpdateSortOrder(updates)
  }}
>
  {orderedTasks.map(task => (
    <Reorder.Item key={task.id} value={task}>
      <TaskItem task={task} />
    </Reorder.Item>
  ))}
</Reorder.Group>
```

在 `taskStore` 新增 action：

```typescript
batchUpdateSortOrder: (updates: { id: string; sortOrder: number }[]) => {
  set(state => ({
    tasks: state.tasks.map(t => {
      const update = updates.find(u => u.id === t.id)
      return update ? { ...t, sortOrder: update.sortOrder } : t
    })
  }))
}
```

### 拖拽交互

- 只在同状态分组内拖拽（doing 组内拖拽、todo 组内拖拽，不跨组）
- 拖拽时卡片轻微抬起：`whileDrag={{ scale: 1.02, boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}`
- 子任务不参与拖拽排序（子任务顺序跟随 `childIds` 数组顺序）
- 仪表盘 TaskCard 中的任务列表也支持拖拽（复用相同逻辑）

### 影响文件

- `src/types/task.ts`（新增 `sortOrder` 字段）
- `src/stores/taskStore.ts`（`batchUpdateSortOrder` action + `onRehydrateStorage` 兼容）
- `src/components/tasks/TaskList.tsx`（Reorder 容器）
- `src/components/tasks/TaskItem.tsx`（Reorder.Item 包裹）
- `src/components/dashboard/TaskCard.tsx`（同步支持拖拽）

### 验收标准

- [ ] 鼠标按住任务卡片可上下拖拽
- [ ] 拖拽时卡片抬起（scale + shadow）
- [ ] 松手后顺序更新并持久化
- [ ] 刷新应用后顺序保持
- [ ] 子任务不可独立拖拽
- [ ] 拖拽不跨状态分组

---

## FEAT-02：移除自动计时器，改为手动填写实际时长

**优先级**：P0
**需求**：去掉任务的自动计时功能，完成时改为手动填写实际投入时长。

### 移除清单

逐项检查并移除以下内容：

| 要移除的内容 | 位置 | 操作 |
|-------------|------|------|
| `timerStartedAt` 字段 | `src/types/task.ts` | 从 Task interface 中删除 |
| `timerElapsed` 字段（如有） | `src/types/task.ts` | 从 Task interface 中删除 |
| 实时跳动的计时器 UI（⏱ HH:MM:SS） | `src/components/tasks/TaskItem.tsx` | 删除计时器显示和 setInterval |
| 计时器恢复逻辑 | `src/stores/taskStore.ts` | 删除 onRehydrateStorage 中的计时器恢复代码 |
| `timerStore.ts`（如果存在） | `src/stores/` | 整个文件删除 |
| 计时相关 i18n key | `src/i18n/zh.ts`, `en.ts` | 删除（但不急，可保留避免编译报错，后续清理） |

### 保留内容

- 任务三态流转：`todo` → `doing` → `done`
- 点击切换为 `doing` 时，卡片显示"进行中"标识（纯状态标记，无计时器）
- `actualMinutes` 字段保留

### 新增内容

#### 1. 完成时填写面板

任务完成时（`doing` → `done` 或 `todo` → `done`），弹出时长填写面板：

```tsx
// 可以是 inline 展开或小型 modal
<div className="flex items-center gap-3 p-4 bg-[var(--color-bg-secondary)] rounded-lg">
  <span>{t.task_howLong}</span>   {/* 本次用了多久？ */}
  <input
    type="number"
    min={0}
    placeholder="0"
    className="w-20 text-center ..."
    autoFocus
    onKeyDown={e => e.key === 'Enter' && handleConfirm()}
  />
  <span>{t.task_minuteUnit}</span>  {/* 分钟 */}
  <button onClick={handleConfirm}>{t.common_confirm}</button>
  <button onClick={handleSkip}>{t.task_skipDuration}</button>  {/* 跳过 */}
</div>
```

- 用户输入分钟数后确认 → 写入 `actualMinutes`
- 点击"跳过" → `actualMinutes` 保持为 0，不强制填写
- Enter 键可确认

#### 2. 编辑抽屉实际用时（合并 BUG-06）

TaskDrawer 中添加实际用时字段，规格见 `phase1-bugs.md` BUG-06。

#### 3. 角色迷你卡状态显示简化

```
修改前：📚 学习中 · 32分钟
修改后：📚 学习中
```

移除状态旁的时长显示（因为不再有实时计时数据）。

### 数据迁移

在 `taskStore` 的 `onRehydrateStorage` 中：

```typescript
onRehydrateStorage: () => (state) => {
  if (!state) return
  state.tasks.forEach(t => {
    // 清理旧版计时字段
    if ('timerStartedAt' in t) {
      delete (t as any).timerStartedAt
    }
    if ('timerElapsed' in t) {
      delete (t as any).timerElapsed
    }
    // doing 状态保持不变，只是不再有计时器
    // actualMinutes 兼容
    t.actualMinutes = t.actualMinutes ?? 0
  })
}
```

### i18n 新增 key

| key | zh | en |
|-----|----|----|
| `task_howLong` | 本次用了多久？ | How long did it take? |
| `task_skipDuration` | 跳过 | Skip |
| `task_minuteUnit` | 分钟 | min |
| `task_actualMinutes` | 实际用时 | Actual Duration |
| `task_actualMinutesPlaceholder` | 完成后可填写 | Available after completion |

### 影响文件

- `src/types/task.ts`（删除计时字段）
- `src/stores/taskStore.ts`（移除计时逻辑 + 数据迁移 + 完成时写入 actualMinutes）
- `src/components/tasks/TaskItem.tsx`（移除计时器 UI，新增完成时长填写面板）
- `src/components/tasks/TaskDrawer.tsx`（新增实际用时字段，合并 BUG-06）
- `src/components/dashboard/CharacterMini.tsx`（移除状态旁的时长显示）
- `src/i18n/zh.ts`, `src/i18n/en.ts`（新增 key）
- 删除 `src/stores/timerStore.ts`（如果存在）

### 验收标准

- [ ] 应用中无任何实时跳动的计时器 UI
- [ ] 任务切换为 doing 时显示"进行中"标识，无计时
- [ ] 任务完成时弹出时长填写面板
- [ ] 填写分钟数后正确存入 actualMinutes
- [ ] 可跳过不填
- [ ] TaskDrawer 中已完成任务显示实际用时（可编辑）
- [ ] TaskDrawer 中未完成任务显示灰色占位
- [ ] 角色迷你卡状态不显示时长
- [ ] 旧数据升级后 timerStartedAt 被清理，doing 状态保持
- [ ] TypeScript 编译零错误
