# Phase 4 — SOP 模块 MVP

> **前置**：先阅读 `OVERVIEW.md`。Phase 3 完成后再开始。
> **MVP 范围**：数据模型 + Store + 目录树 + 流程型/清单型视图 + 创建编辑 + 转为任务 + i18n
> **不包含**（Phase 5）：日程型、检查型、执行模式、系统预设

---

## SOP-1：数据模型 + Store + 目录树

### 数据模型

新建 `src/types/sop.ts`：

```typescript
interface SOPFolder {
  id: string
  name: string
  sortOrder: number
  isSystem: boolean       // 系统预设文件夹（只读）
  createdAt: string
}

interface SOP {
  id: string
  folderId: string        // 所属文件夹
  title: string
  type: 'schedule' | 'workflow' | 'checklist' | 'itemlist'
  steps: SOPStep[]
  isSystem: boolean       // 系统预设（只读）
  lastUsedAt: string | null  // 最近一次转为任务的时间
  sortOrder: number
  createdAt: string
  updatedAt: string
}

interface SOPStep {
  id: string
  title: string
  note: string            // 备注（💡）
  warning: string         // 警告（⚠️）
  time: string | null     // 时间点（仅日程型，如 "07:00"）
  sortOrder: number
  childSteps: SOPStep[]   // 子步骤（UI 限制最多 2 层）
}
```

### Store

新建 `src/stores/sopStore.ts`：

```typescript
interface SOPState {
  folders: SOPFolder[]
  sops: SOP[]
  selectedSOPId: string | null

  // 文件夹 CRUD
  addFolder: (name: string) => void
  renameFolder: (id: string, name: string) => void
  deleteFolder: (id: string) => void
  reorderFolders: (ids: string[]) => void

  // SOP CRUD
  addSOP: (sop: Omit<SOP, 'id' | 'createdAt' | 'updatedAt' | 'lastUsedAt' | 'sortOrder'>) => string
  updateSOP: (id: string, updates: Partial<SOP>) => void
  deleteSOP: (id: string) => void
  duplicateSOP: (id: string) => string  // 用于复制系统预设
  moveSOP: (sopId: string, targetFolderId: string) => void
  reorderSOPs: (folderId: string, ids: string[]) => void

  selectSOP: (id: string | null) => void
}
```

使用 `persist` 中间件，key：`${getStoragePrefix()}-sops`。

### 目录树组件

新建 `src/components/sop/SOPTree.tsx`：

```tsx
function SOPTree() {
  const { folders, sops, selectedSOPId, selectSOP } = useSOPStore()

  // 按文件夹分组
  const tree = useMemo(() =>
    folders
      .sort((a, b) => {
        // 系统模板文件夹始终在最上方
        if (a.isSystem !== b.isSystem) return a.isSystem ? -1 : 1
        return a.sortOrder - b.sortOrder
      })
      .map(folder => ({
        folder,
        items: sops
          .filter(s => s.folderId === folder.id)
          .sort((a, b) => a.sortOrder - b.sortOrder)
      })),
    [folders, sops]
  )

  return (
    <div className="w-[30%] min-w-[200px] border-r border-[var(--color-border)] overflow-y-auto">
      {tree.map(({ folder, items }) => (
        <div key={folder.id}>
          {/* 文件夹标题 — 可折叠 */}
          <div className="flex items-center gap-2 px-3 py-2 text-sm font-medium">
            <span>📁</span>
            <span>{folder.name}</span>
            {!folder.isSystem && (
              <span className="ml-auto opacity-0 group-hover:opacity-100">⋯</span>
            )}
          </div>

          {/* SOP 条目 */}
          {items.map(sop => (
            <div
              key={sop.id}
              onClick={() => selectSOP(sop.id)}
              className={`px-6 py-1.5 text-sm cursor-pointer ${
                selectedSOPId === sop.id ? 'bg-[var(--color-accent)]/10 text-[var(--color-accent)]' : ''
              }`}
            >
              <span>{getSOPTypeIcon(sop.type)}</span>
              <span className="ml-2">{sop.title}</span>
            </div>
          ))}
        </div>
      ))}

      {/* 新建文件夹 */}
      <button className="px-3 py-2 text-sm text-[var(--color-text-secondary)]">
        + {t.sop_newFolder}
      </button>
    </div>
  )
}

function getSOPTypeIcon(type: SOP['type']): string {
  const icons = { schedule: '⏰', workflow: '🔄', checklist: '☑️', itemlist: '📝' }
  return icons[type]
}
```

### 导航入口

修改 `Sidebar.tsx`：新增第 5 个 Tab（📋 SOP）。
修改 `App.tsx`：新增 SOP 页面路由。

### 主页面

新建 `src/components/sop/SOPPage.tsx`：

```tsx
function SOPPage() {
  const selectedSOPId = useSOPStore(s => s.selectedSOPId)
  const selectedSOP = useSOPStore(s => s.sops.find(sop => sop.id === s.selectedSOPId))

  return (
    <div className="flex h-full">
      <SOPTree />
      <div className="flex-1 overflow-y-auto p-6">
        {selectedSOP ? (
          <SOPContent sop={selectedSOP} />
        ) : (
          <div className="flex items-center justify-center h-full text-[var(--color-text-secondary)]">
            {t.sop_emptyState}
          </div>
        )}
      </div>
    </div>
  )
}
```

---

## SOP-2：流程型 + 清单型视图

### 内容区路由

新建 `src/components/sop/SOPContent.tsx`：

```tsx
function SOPContent({ sop }: { sop: SOP }) {
  return (
    <div>
      {/* 标题栏 */}
      <div className="mb-6">
        <h2 className="text-xl font-bold">{sop.title}</h2>
        <div className="text-sm text-[var(--color-text-secondary)] mt-1">
          {getSOPTypeIcon(sop.type)} {t[`sop_type_${sop.type}`]} · {sop.steps.length}{t.sop_steps}
        </div>
      </div>

      {/* 根据类型渲染 */}
      {sop.type === 'workflow' && <SOPWorkflowView steps={sop.steps} />}
      {sop.type === 'itemlist' && <SOPItemListView steps={sop.steps} />}
      {/* schedule 和 checklist 在 Phase 5 */}
      {(sop.type === 'schedule' || sop.type === 'checklist') && (
        <div className="text-[var(--color-text-secondary)]">{t.sop_viewComingSoon}</div>
      )}

      {/* 底部操作栏 */}
      <div className="flex gap-3 mt-8 pt-4 border-t border-[var(--color-border)]">
        <button onClick={() => handleConvertToTask(sop)}>→ {t.sop_convertToTask}</button>
        <button onClick={() => handleEdit(sop.id)}>{t.common_edit}</button>
        {!sop.isSystem && <button onClick={() => handleDelete(sop.id)}>{t.common_delete}</button>}
        {sop.isSystem && <button onClick={() => handleDuplicate(sop.id)}>{t.sop_copyToMine}</button>}
      </div>

      {sop.lastUsedAt && (
        <div className="text-xs text-[var(--color-text-secondary)] mt-2">
          {t.sop_lastUsed}: {formatRelativeTime(sop.lastUsedAt)}
        </div>
      )}
    </div>
  )
}
```

### 流程型视图

新建 `src/components/sop/SOPWorkflowView.tsx`：

```tsx
function SOPWorkflowView({ steps }: { steps: SOPStep[] }) {
  return (
    <div className="space-y-3">
      {steps.sort((a, b) => a.sortOrder - b.sortOrder).map((step, idx) => (
        <div key={step.id} className="flex gap-3">
          {/* 序号 */}
          <div className="flex-shrink-0 w-7 h-7 rounded-full bg-[var(--color-accent)]/10
                          text-[var(--color-accent)] flex items-center justify-center text-sm font-medium">
            {idx + 1}
          </div>

          <div className="flex-1">
            <div className="font-medium">{step.title}</div>

            {step.note && (
              <div className="text-sm text-[var(--color-text-secondary)] mt-1">
                💡 {step.note}
              </div>
            )}
            {step.warning && (
              <div className="text-sm text-amber-600 mt-1">
                ⚠️ {step.warning}
              </div>
            )}

            {/* 子步骤 */}
            {step.childSteps.length > 0 && (
              <div className="ml-4 mt-2 space-y-1">
                {step.childSteps.map((child, ci) => (
                  <div key={child.id} className="text-sm">
                    {idx + 1}.{ci + 1} {child.title}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
```

### 清单型视图

新建 `src/components/sop/SOPItemListView.tsx`：

```tsx
function SOPItemListView({ steps }: { steps: SOPStep[] }) {
  return (
    <div className="space-y-1">
      {steps.sort((a, b) => a.sortOrder - b.sortOrder).map(step => (
        <div key={step.id} className="flex items-center gap-2 py-1">
          <span className="text-[var(--color-text-secondary)]">•</span>
          <span>{step.title}</span>
        </div>
      ))}
    </div>
  )
}
```

清单型在查看模式下只显示列表，不显示勾选框（勾选是"执行模式"的功能，Phase 5 实现）。

---

## SOP-3：创建/编辑表单

新建 `src/components/sop/SOPEditor.tsx`：

```tsx
function SOPEditor({ sopId, onSave, onCancel }: Props) {
  // sopId 为 null 时为新建模式
  const existingSOP = useSOPStore(s => sopId ? s.sops.find(sop => sop.id === sopId) : null)

  const [title, setTitle] = useState(existingSOP?.title ?? '')
  const [type, setType] = useState<SOP['type']>(existingSOP?.type ?? 'workflow')
  const [folderId, setFolderId] = useState(existingSOP?.folderId ?? '')
  const [steps, setSteps] = useState<SOPStep[]>(existingSOP?.steps ?? [])

  const handleAddStep = () => {
    setSteps([...steps, {
      id: generateId(),
      title: '',
      note: '',
      warning: '',
      time: null,
      sortOrder: steps.length,
      childSteps: [],
    }])
  }

  const handleSave = () => {
    if (!title.trim()) return
    if (sopId) {
      updateSOP(sopId, { title, type, folderId, steps, updatedAt: new Date().toISOString() })
    } else {
      addSOP({ title, type, folderId, steps, isSystem: false })
    }
    onSave()
  }

  return (
    <div className="p-6">
      <h2>{sopId ? t.sop_edit : t.sop_create}</h2>

      <input value={title} onChange={e => setTitle(e.target.value)} placeholder={t.sop_titlePlaceholder} />

      {/* 类型选择（MVP 只有 workflow/itemlist） */}
      <select value={type} onChange={e => setType(e.target.value as SOP['type'])}>
        <option value="workflow">{t.sop_type_workflow}</option>
        <option value="itemlist">{t.sop_type_itemlist}</option>
      </select>

      {/* 文件夹选择 */}
      <FolderSelect value={folderId} onChange={setFolderId} />

      {/* 步骤编辑列表 */}
      {steps.map((step, idx) => (
        <div key={step.id} className="flex gap-2 items-start mb-3">
          {type !== 'itemlist' && <span className="text-sm font-medium mt-2">①②③...[{idx + 1}]</span>}
          <div className="flex-1">
            <input
              value={step.title}
              onChange={e => updateStep(idx, { title: e.target.value })}
              placeholder={t.sop_stepPlaceholder}
            />
            {type !== 'itemlist' && (
              <input
                value={step.note}
                onChange={e => updateStep(idx, { note: e.target.value })}
                placeholder={t.sop_notePlaceholder}
                className="text-sm mt-1"
              />
            )}
          </div>
          <button onClick={() => removeStep(idx)}>×</button>
        </div>
      ))}

      <button onClick={handleAddStep}>+ {t.sop_addStep}</button>

      <div className="flex justify-end gap-3 mt-6">
        <button onClick={onCancel}>{t.common_cancel}</button>
        <button onClick={handleSave}>{t.common_save}</button>
      </div>
    </div>
  )
}
```

入口：SOPPage 右上角「+ 新建 ▼」按钮，点击后内容区切换为编辑模式。

---

## SOP-4：转为任务功能

新建 `src/components/sop/SOPToTaskModal.tsx`：

确认面板让用户选择要包含的步骤，然后调用 `taskStore.createTaskFromSOP()`。

在 `taskStore.ts` 新增 action：

```typescript
createTaskFromSOP: (params: {
  title: string
  category: string
  difficulty: number
  dueDate: string | null
  steps: SOPStep[]       // 用户勾选的步骤
}) => {
  const task: Task = {
    id: generateId(),
    title: params.title,
    category: params.category,
    difficulty: params.difficulty,
    priority: 'medium',
    dueDate: params.dueDate,
    description: '',
    actualMinutes: 0,
    status: 'todo',
    xpReward: 0,
    completedAt: null,
    deletedAt: null,
    isHidden: false,
    sortOrder: get().tasks.length,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    subTasks: params.steps.map((step, i) => mapStepToSubTask(step, i)),
  }

  set(state => ({ tasks: [...state.tasks, task] }))
  return task.id
}

// 嵌套映射规则
function mapStepToSubTask(step: SOPStep, index: number): SubTask {
  return {
    id: generateId(),
    title: step.title,
    completed: false,
    sortOrder: index,
    subTasks: step.childSteps.map((child, ci) => ({
      id: generateId(),
      title: child.title,
      completed: false,
      sortOrder: ci,
      subTasks: [],  // 第 3 层及更深层忽略
      createdAt: new Date().toISOString(),
    })),
    createdAt: new Date().toISOString(),
  }
}
```

转化后更新 SOP 的 `lastUsedAt`。

### 测试

```typescript
// createTaskFromSOP.test.ts
describe('createTaskFromSOP', () => {
  it('步骤正确映射为子任务', () => { /* ... */ })
  it('子步骤映射为嵌套子任务', () => { /* ... */ })
  it('第 3 层子步骤被忽略', () => { /* ... */ })
  it('部分勾选时只生成勾选的步骤', () => { /* ... */ })
})
```

---

## SOP-6：i18n

所有 SOP 相关 key 列表（在 `zh.ts` 和 `en.ts` 中同步添加）：

| key | zh | en |
|-----|----|----|
| `sop_title` | SOP | SOP |
| `sop_newFolder` | 新建文件夹 | New Folder |
| `sop_create` | 新建 SOP | New SOP |
| `sop_edit` | 编辑 SOP | Edit SOP |
| `sop_type_workflow` | 流程型 | Workflow |
| `sop_type_itemlist` | 清单型 | Item List |
| `sop_type_schedule` | 日程型 | Schedule |
| `sop_type_checklist` | 检查型 | Checklist |
| `sop_steps` | 个步骤 | steps |
| `sop_emptyState` | 选择一个 SOP 查看，或创建新的 | Select an SOP or create a new one |
| `sop_convertToTask` | 转为任务 | Convert to Task |
| `sop_copyToMine` | 复制为我的 SOP | Copy to My SOPs |
| `sop_lastUsed` | 最近转化 | Last used |
| `sop_titlePlaceholder` | SOP 标题 | SOP title |
| `sop_stepPlaceholder` | 步骤内容 | Step content |
| `sop_notePlaceholder` | 备注（可选） | Note (optional) |
| `sop_addStep` | 添加步骤 | Add step |
| `sop_confirmConvert` | 从 SOP 创建任务 | Create task from SOP |
| `sop_selectSteps` | 包含以下步骤 | Include these steps |
| `sop_viewComingSoon` | 该视图类型即将推出 | This view type is coming soon |

### 验收（SOP MVP 整体）

- [ ] 侧边栏第 5 个 Tab 进入 SOP 页面
- [ ] 左侧目录树正确展示文件夹和 SOP 条目
- [ ] 可创建/重命名/删除文件夹
- [ ] 可创建流程型和清单型 SOP
- [ ] 流程型视图正确显示有序步骤 + 备注/警告
- [ ] 清单型视图正确显示无序列表
- [ ] 可编辑已有 SOP（标题、步骤增删改）
- [ ] 转为任务：弹出确认面板，可选择步骤，生成任务+子任务
- [ ] 转化后 SOP 显示"最近转化"时间
- [ ] 日程型/检查型显示"即将推出"占位
- [ ] i18n 中英文均正确
- [ ] TypeScript 编译零错误
- [ ] createTaskFromSOP 测试通过
