# Agent B — SOP 模块开发规格

> **角色**：Agent B，负责 F3-a 类型改造 + F3-b Tiptap 富文本 + F3-c 子步骤编辑 + F3-d SOP 链接 + F3-e 子文件夹 + F3-f 新建文件夹
> **独占文件**：见 `PARALLEL-GUIDE.md` Agent B 独占列表
> **执行顺序**：Phase 3（F3-a + F3-b + 迁移）→ Phase 4（F3-c + F3-d）→ Phase 5（F3-e + F3-f）

---

## Phase 3 — 类型改造 + Tiptap 富文本 + 迁移（5-7 天）

### 前置：安装 Tiptap 依赖

```bash
npm install @tiptap/react @tiptap/starter-kit @tiptap/extension-table @tiptap/extension-code-block-lowlight @tiptap/extension-link @tiptap/extension-placeholder lowlight
```

**不安装** `@tiptap/extension-image`（推迟到 v0.4）。

---

### F3-a：类型系统改造 — 4 type → 3 displayStyle

#### 步骤 1：类型定义变更

**文件**：`src/types/sop.ts`

```typescript
// 旧
export interface SOP {
  // ...
  type: 'schedule' | 'workflow' | 'checklist' | 'itemlist'
  // ...
}

// 新
export interface SOP {
  // ...
  displayStyle: 'numbered' | 'bullet' | 'timeline'  // 替换 type
  // ...
}
```

同时变更 `SOPStep`（F3-b 需要）和 `SOPFolder`（Phase 5 需要，类型现在就加上）：

```typescript
export interface SOPStep {
  id: string
  title: string
  content: JSONContent | null  // 替换 note + warning
  time: string | null
  sortOrder: number
  childSteps: SOPStep[]
}

export interface SOPFolder {
  id: string
  name: string
  parentId: string | null   // 新增
  sortOrder: number
  isSystem: boolean
  createdAt: string
}
```

`JSONContent` 来自 Tiptap：`import type { JSONContent } from '@tiptap/react'`。在 `sop.ts` 顶部加上此 import。

**注意**：修改类型后会产生大量 TypeScript 错误。这些错误全部在 Agent B 独占文件中，后续步骤逐一修复。

#### 步骤 2：sopStore 迁移

**文件**：`src/stores/sopStore.ts`

在 `onRehydrateStorage` 回调中新增迁移：

```typescript
const SOP_MIGRATION_V031 = 'anvilite-migration-sop-v031'
if (!localStorage.getItem(SOP_MIGRATION_V031)) {
  // 1. type → displayStyle
  state.sops = state.sops.map((sop) => {
    const legacy = sop as any
    const oldType = legacy.type
    const displayStyle: SOP['displayStyle'] =
      oldType === 'schedule' ? 'timeline'
      : oldType === 'itemlist' ? 'bullet'
      : 'numbered'
    const { type: _, ...rest } = legacy
    return { ...rest, displayStyle }
  })

  // 2. step.note/warning → step.content (Tiptap JSON)
  state.sops = state.sops.map((sop) => ({
    ...sop,
    steps: sop.steps.map(migrateStepContent),
  }))

  // 3. folder.parentId 默认 null
  state.folders = state.folders.map((f) => ({
    ...f,
    parentId: (f as any).parentId ?? null,
  }))

  localStorage.setItem(SOP_MIGRATION_V031, new Date().toISOString())
}

// 兼容兜底
state.sops = state.sops.map((sop) => ({
  ...sop,
  displayStyle: sop.displayStyle ?? 'numbered',
}))
state.folders = state.folders.map((f) => ({
  ...f,
  parentId: f.parentId ?? null,
}))
```

**迁移函数** `migrateStepContent`（在 sopStore 文件顶部或单独文件中）：

```typescript
import type { JSONContent } from '@tiptap/react'

function migrateStepContent(step: any): SOPStep {
  // 如果已经有 content 字段，说明已迁移
  if ('content' in step && !('note' in step)) return step

  const blocks: JSONContent[] = []

  if (step.warning) {
    blocks.push({
      type: 'callout',
      attrs: { variant: 'warning' },
      content: [{ type: 'paragraph', content: [{ type: 'text', text: step.warning }] }],
    })
  }

  if (step.note) {
    blocks.push({
      type: 'callout',
      attrs: { variant: 'info' },
      content: [{ type: 'paragraph', content: [{ type: 'text', text: step.note }] }],
    })
  }

  const { note: _n, warning: _w, ...rest } = step
  return {
    ...rest,
    content: blocks.length > 0 ? { type: 'doc', content: blocks } : null,
    childSteps: (step.childSteps ?? []).map(migrateStepContent),
  }
}
```

**Store actions 变更**：

1. `addSOP`：原 `type` 参数改为 `displayStyle`，默认值 `'numbered'`
2. 新增 `setDisplayStyle(sopId: string, style: SOP['displayStyle'])`

#### 步骤 3：systemSOPs 适配

**文件**：`src/data/systemSOPs.ts`

1. 所有 `type: 'schedule'` → `displayStyle: 'timeline'`
2. 所有 `type: 'workflow'` → `displayStyle: 'numbered'`
3. 所有 `type: 'checklist'` → `displayStyle: 'numbered'`
4. 所有 `type: 'itemlist'` → `displayStyle: 'bullet'`
5. 类型引用 `SOP['type']` → `SOP['displayStyle']`
6. `resolveStep` 函数：返回值改为 `content` 字段（将 `note/warning` 转为 Tiptap JSON），或直接返回 `content: null`（系统预设查看时可用 i18n 渲染，不依赖 content）
7. `getSystemFolder` 返回对象加 `parentId: null`

**注意**：系统预设的 `note`/`warning` 数据是双语元组，迁移后需要转为 Tiptap JSON 结构。简单做法是在 `resolveStep` 中直接构建 `content: { type: 'doc', content: [...] }` 或保持 `content: null`，让查看模式根据 lang 渲染原始数据。推荐后者更简洁：系统预设保持自有的双语渲染逻辑，不经过 Tiptap。

#### 步骤 4：创建 Callout 自定义扩展

**文件**：`src/components/sop/CalloutExtension.ts`（新建）

Tiptap 自定义 block node，用于提示（info）和警告（warning）callout：

```typescript
import { Node, mergeAttributes } from '@tiptap/core'

export const CalloutExtension = Node.create({
  name: 'callout',
  group: 'block',
  content: 'block+',

  addAttributes() {
    return {
      variant: {
        default: 'info',
        parseHTML: (el) => el.getAttribute('data-variant') || 'info',
        renderHTML: (attrs) => ({ 'data-variant': attrs.variant }),
      },
    }
  },

  parseHTML() {
    return [{ tag: 'div[data-callout]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-callout': '' }), 0]
  },
})
```

配套 CSS（在 SOPRichEditor 或全局 CSS 中）：

```css
div[data-callout] {
  padding: 8px 12px;
  border-radius: var(--radius-sm);
  margin: 4px 0;
  font-size: 13px;
}
div[data-callout][data-variant="info"] {
  background: color-mix(in srgb, var(--color-accent) 8%, transparent);
  border-left: 3px solid var(--color-accent);
}
div[data-callout][data-variant="warning"] {
  background: color-mix(in srgb, var(--color-warning) 8%, transparent);
  border-left: 3px solid var(--color-warning);
}
```

#### 步骤 5：创建 SOPRichEditor 组件

**文件**：`src/components/sop/SOPRichEditor.tsx`（新建）

封装 Tiptap 编辑器，编辑模式使用（`React.lazy` 按需加载）：

```typescript
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Table from '@tiptap/extension-table'
import TableRow from '@tiptap/extension-table-row'
import TableCell from '@tiptap/extension-table-cell'
import TableHeader from '@tiptap/extension-table-header'
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight'
import Link from '@tiptap/extension-link'
import Placeholder from '@tiptap/extension-placeholder'
import { common, createLowlight } from 'lowlight'
import { CalloutExtension } from './CalloutExtension'
import type { JSONContent } from '@tiptap/react'

const lowlight = createLowlight(common)

interface Props {
  content: JSONContent | null
  onChange: (content: JSONContent | null) => void
  placeholder?: string
}

export function SOPRichEditor({ content, onChange, placeholder }: Props) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ codeBlock: false }),
      Table.configure({ resizable: false }),
      TableRow,
      TableCell,
      TableHeader,
      CodeBlockLowlight.configure({ lowlight }),
      Link.configure({ openOnClick: false }),
      Placeholder.configure({ placeholder: placeholder ?? '' }),
      CalloutExtension,
    ],
    content: content ?? undefined,
    onUpdate: ({ editor }) => {
      const json = editor.getJSON()
      const isEmpty = !editor.state.doc.textContent.trim()
      onChange(isEmpty ? null : json)
    },
  })

  if (!editor) return null

  return (
    <div style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)' }}>
      <Toolbar editor={editor} />
      <EditorContent
        editor={editor}
        style={{ padding: '8px 12px', minHeight: 80, fontSize: 13, color: 'var(--color-text)' }}
      />
    </div>
  )
}
```

**Toolbar 组件**（同文件内或拆分）：

工具栏按钮列表：
- **B** 粗体、*I* 斜体、~~S~~ 删除线
- `</>` 代码块
- 表 插入表格（默认 3×3）
- 链 插入链接
- • 无序列表、1. 有序列表
- 💡 插入 info callout、⚠️ 插入 warning callout

每个按钮调用对应 editor chain 命令：

```typescript
editor.chain().focus().toggleBold().run()
editor.chain().focus().toggleCodeBlock().run()
editor.chain().focus().insertTable({ rows: 3, cols: 3 }).run()
// callout:
editor.chain().focus().insertContent({
  type: 'callout',
  attrs: { variant: 'info' },
  content: [{ type: 'paragraph' }],
}).run()
```

**查看模式渲染**（不初始化编辑器实例）：

```typescript
import { generateHTML } from '@tiptap/html'

// 在 SOPStepListView 的查看模式中：
const html = content ? generateHTML(content, [
  StarterKit.configure({ codeBlock: false }),
  Table, TableRow, TableCell, TableHeader,
  CodeBlockLowlight.configure({ lowlight }),
  Link,
  CalloutExtension,
]) : ''

// 渲染: <div dangerouslySetInnerHTML={{ __html: html }} />
```

**注意**：`generateHTML` 需要传入与编辑器相同的 extensions 列表才能正确渲染自定义节点。提取一个 `sopEditorExtensions` 常量在编辑和查看之间共享。

#### 步骤 6：创建统一步骤视图

**文件**：`src/components/sop/SOPStepListView.tsx`（新建）

替换原来的 4 个视图组件。根据 `displayStyle` 渲染不同前缀：

```typescript
interface Props {
  sop: SOP
  executionMode: boolean
  checkedIds: Set<string>
  onToggle: (stepId: string) => void
}
```

**StepRow 渲染**：

| displayStyle | 前缀 | 特殊处理 |
|-------------|------|---------|
| `numbered` | `{index + 1}.` | 子步骤 `1.1`, `1.2` |
| `bullet` | `•` | 子步骤同样 `•` |
| `timeline` | `step.time ?? ''` | 时间用 `tabular-nums`，无 time 的按序号 |

**富文本内容渲染**：每个步骤的 `content` 用 `generateHTML` 转为 HTML 显示。

**执行模式**：所有 displayStyle 都支持。步骤前出现勾选框，已勾选文字灰色+删除线。

**子步骤渲染**：递归渲染 `step.childSteps`，每层缩进 24px。

#### 步骤 7：SOPContent 更新

**文件**：`src/components/sop/SOPContent.tsx`

1. 删除 4 个旧 import（SOPWorkflowView/SOPItemListView/SOPScheduleView/SOPChecklistView）
2. import `SOPStepListView`
3. 删除 `getSOPTypeIcon`，替换为 displayStyle 映射：

```typescript
function getDisplayStyleIcon(style: SOP['displayStyle']): string {
  return { numbered: '≡', bullet: '•', timeline: '⏰' }[style]
}
```

4. 渲染统一使用 `<SOPStepListView>`
5. 标题右侧添加风格切换按钮组（3 个图标按钮，选中高亮 accent 色）

#### 步骤 8：SOPEditor 更新

**文件**：`src/components/sop/SOPEditor.tsx`

1. `type` state → `displayStyle` state，默认 `'numbered'`
2. 类型选择 UI 改为 3 个风格按钮组
3. 步骤编辑区：标题下方展开 `SOPRichEditor`（`React.lazy` 按需加载）
4. `time` 输入仅当 `displayStyle === 'timeline'` 时显示
5. `makeStep` 返回 `content: null` 而非 `note: '', warning: ''`
6. 保存时将 `displayStyle` 和 `content` 传入 `addSOP` / `updateSOP`

#### 步骤 9：SOPPage 执行模式统一

**文件**：`src/components/sop/SOPPage.tsx`

删除 `EXECUTION_SUPPORTED` 限制。所有 SOP 底部都显示「开始执行」按钮。

执行模式顶部显示进度：`t.sop_progress(checkedIds.size, totalStepCount)`，`totalStepCount` 递归计算所有步骤+子步骤总数。

#### 步骤 10：删除旧视图文件

```
rm src/components/sop/SOPChecklistView.tsx
rm src/components/sop/SOPItemListView.tsx
rm src/components/sop/SOPWorkflowView.tsx
rm src/components/sop/SOPScheduleView.tsx
```

---

### Phase 3 测试

**文件**：`src/stores/sopStore.test.ts`（新建或扩展）

```
sop migration v031:
  - workflow → numbered 映射正确
  - checklist → numbered 映射正确
  - itemlist → bullet 映射正确
  - schedule → timeline 映射正确
  - step.note 迁移为 content callout info
  - step.warning 迁移为 content callout warning
  - note+warning 同时存在时都保留
  - note/warning 都为空时 content 为 null
  - 子步骤递归迁移正确
  - 迁移标记防止重复执行
  - folder.parentId 默认为 null

sop displayStyle:
  - setDisplayStyle 正确持久化
  - 新建 SOP 默认 displayStyle 为 numbered
```

---

## Phase 4 — 子步骤编辑 + SOP 链接（2-3 天）

### F3-c：子步骤编辑 UI

**文件**：`src/components/sop/SOPEditor.tsx`

在步骤编辑卡片中新增子步骤的增删改 UI。

#### 数据操作函数

```typescript
function addChildStep(parentIndex: number) {
  setSteps((prev) => prev.map((s, i) =>
    i === parentIndex ? { ...s, childSteps: [...s.childSteps, makeStep(s.childSteps.length)] } : s
  ))
}

function updateChildStepTitle(parentIndex: number, childIndex: number, title: string) {
  setSteps((prev) => prev.map((s, i) =>
    i === parentIndex ? {
      ...s,
      childSteps: s.childSteps.map((c, ci) => ci === childIndex ? { ...c, title } : c),
    } : s
  ))
}

function updateChildStepContent(parentIndex: number, childIndex: number, content: JSONContent | null) {
  setSteps((prev) => prev.map((s, i) =>
    i === parentIndex ? {
      ...s,
      childSteps: s.childSteps.map((c, ci) => ci === childIndex ? { ...c, content } : c),
    } : s
  ))
}

function removeChildStep(parentIndex: number, childIndex: number) {
  setSteps((prev) => prev.map((s, i) =>
    i === parentIndex ? { ...s, childSteps: s.childSteps.filter((_, ci) => ci !== childIndex) } : s
  ))
}

function moveChildStep(parentIndex: number, childIndex: number, direction: 'up' | 'down') {
  setSteps((prev) => prev.map((s, i) => {
    if (i !== parentIndex) return s
    const arr = [...s.childSteps]
    const target = direction === 'up' ? childIndex - 1 : childIndex + 1
    if (target < 0 || target >= arr.length) return s
    ;[arr[childIndex], arr[target]] = [arr[target], arr[childIndex]]
    return { ...s, childSteps: arr.map((c, ci) => ({ ...c, sortOrder: ci })) }
  }))
}
```

二级子步骤需要类似的嵌套函数。限制最多 2 层。

#### UI 结构

```
┌─ 步骤 1: [标题输入] ────────────────────────┐
│  [SOPRichEditor: 富文本内容]                  │
│                                              │
│  ┌─ 1.1 [标题输入] ───────────────────────┐  │
│  │  [SOPRichEditor: 子步骤内容]           │  │
│  │  [↑] [↓]                       [删除]  │  │
│  └────────────────────────────────────────┘  │
│                                              │
│  [+ 添加子步骤]                       [删除]  │
└──────────────────────────────────────────────┘
```

- 子步骤缩进 24px
- 每个子步骤有 `[↑]` `[↓]` `[删除]` 按钮
- 二级子步骤不再显示 `+ 添加子步骤`（限制 2 层）
- 每个子步骤都有独立的 `SOPRichEditor` 实例

---

### F3-d：链接到别的流程

#### 步骤 1：创建 SOPLinkNode

**文件**：`src/components/sop/SOPLinkNode.tsx`（新建）

Tiptap 自定义 inline node：

```typescript
import { Node, mergeAttributes } from '@tiptap/core'

export const SOPLinkNode = Node.create({
  name: 'sopLink',
  group: 'inline',
  inline: true,
  atom: true,

  addAttributes() {
    return {
      sopId: { default: null },
      sopTitle: { default: '' },
    }
  },

  parseHTML() {
    return [{ tag: 'span[data-sop-link]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes(HTMLAttributes, {
      'data-sop-link': '',
      style: 'color: var(--color-accent); cursor: pointer; text-decoration: underline;',
    }), `📋 ${HTMLAttributes.sopTitle}`]
  },
})
```

#### 步骤 2：注册到编辑器

**文件**：`src/components/sop/SOPRichEditor.tsx`

在 extensions 列表中添加 `SOPLinkNode`。

#### 步骤 3：工具栏「链接 SOP」按钮

在 Toolbar 中新增 📋 按钮：

1. 点击 → 弹出搜索下拉框
2. 列出当前账号所有 SOP（从 `sopStore.sops` 获取），支持按标题搜索
3. 选择目标 SOP → 在编辑器光标位置插入 `sopLink` node：

```typescript
editor.chain().focus().insertContent({
  type: 'sopLink',
  attrs: { sopId: selectedSOP.id, sopTitle: selectedSOP.title },
}).run()
```

#### 步骤 4：查看模式点击跳转

在 `SOPStepListView` 的渲染中，`sopLink` 被 `generateHTML` 渲染为 `<span data-sop-link>📋 标题</span>`。

给查看容器加 click 事件委托：

```typescript
function handleContentClick(e: React.MouseEvent) {
  const target = e.target as HTMLElement
  const link = target.closest('[data-sop-link]')
  if (link) {
    const sopId = link.getAttribute('data-sopid') // 从 HTML attributes 读
    if (sopId) {
      selectSOP(sopId)  // 跳转到目标 SOP
    }
  }
}
```

#### 步骤 5：目标被删时的降级

在查看渲染时，检查 `sopId` 是否存在于 `sops` 列表中。如果不存在，渲染为灰色 `[📋 已删除的流程]`。

这需要在 `SOPStepListView` 渲染 HTML 后做一次 DOM 后处理，或者在 `generateHTML` 之前预处理 content JSON，将不存在的 sopId 的 node 替换为纯文本。推荐后者（纯数据操作，不依赖 DOM）：

```typescript
function preprocessContent(content: JSONContent, existingSopIds: Set<string>): JSONContent {
  // 遍历 content tree，找到 type: 'sopLink' 的节点
  // 如果 sopId 不在 existingSopIds 中，替换为灰色文本
  // ...
}
```

---

### Phase 4 测试

```
sop childSteps editing:
  - 添加子步骤正确插入 childSteps 数组
  - 子步骤 content 正确保存 Tiptap JSON
  - 删除子步骤正确移除
  - 排序上移/下移正确
  - 2 层限制生效

sop link:
  - 插入 sopLink node 正确存储 sopId/sopTitle
  - 查看模式正确渲染链接样式
  - 目标被删时显示灰色提示文字
```

---

## Phase 5 — 子文件夹 + 右键菜单（3-4 天）

### F3-e：子文件夹 + 右键菜单

#### 步骤 1：sopStore 新增 actions

**文件**：`src/stores/sopStore.ts`

```typescript
// 修改 addFolder：新增 parentId 参数
addFolder: (name: string, parentId?: string) => {
  const id = generateId()
  const newFolder: SOPFolder = {
    id, name,
    parentId: parentId ?? null,
    sortOrder: get().folders.length,
    isSystem: false,
    createdAt: new Date().toISOString(),
  }
  set((s) => ({ folders: [...s.folders, newFolder] }))
  return id
},

// 新增
moveFolder: (folderId: string, targetParentId: string | null) => {
  set((s) => ({
    folders: s.folders.map((f) =>
      f.id === folderId ? { ...f, parentId: targetParentId } : f
    ),
  }))
},

getFolderDepth: (folderId: string): number => {
  let depth = 0
  let current = get().folders.find((f) => f.id === folderId)
  while (current?.parentId) {
    depth++
    current = get().folders.find((f) => f.id === current!.parentId)
  }
  return depth
},

moveSOP: (sopId: string, targetFolderId: string) => {
  set((s) => ({
    sops: s.sops.map((sop) =>
      sop.id === sopId ? { ...sop, folderId: targetFolderId } : sop
    ),
  }))
},

deleteFolderRecursive: (folderId: string) => {
  const allFolderIds = new Set<string>()
  function collectChildren(id: string) {
    allFolderIds.add(id)
    get().folders.filter((f) => f.parentId === id).forEach((f) => collectChildren(f.id))
  }
  collectChildren(folderId)
  set((s) => ({
    folders: s.folders.filter((f) => !allFolderIds.has(f.id)),
    sops: s.sops.filter((sop) => !allFolderIds.has(sop.folderId)),
  }))
},
```

#### 步骤 2：SOPTree 子文件夹渲染

**文件**：`src/components/sop/SOPTree.tsx`

改为递归渲染树结构。根级文件夹 = `parentId === null`，每层缩进 16px。

```typescript
function renderFolder(folder: SOPFolder, depth: number) {
  const childFolders = allFolders.filter((f) => f.parentId === folder.id)
  const folderSOPs = allSOPs.filter((s) => s.folderId === folder.id)
  const isCollapsed = collapsedFolderIds.includes(folder.id)

  return (
    <div key={folder.id}>
      <div style={{ paddingLeft: depth * 16 }}
        onContextMenu={(e) => handleContextMenu(e, 'folder', folder)}
      >
        <button onClick={() => toggleFolderCollapsed(folder.id)}>
          {isCollapsed ? '▸' : '▾'} 📁 {folder.name}
        </button>
        <button onClick={(e) => handleContextMenu(e, 'folder', folder)}>⋯</button>
      </div>
      {!isCollapsed && (
        <>
          {childFolders.map((cf) => renderFolder(cf, depth + 1))}
          {folderSOPs.map((sop) => (
            <div key={sop.id} style={{ paddingLeft: (depth + 1) * 16 }}
              onContextMenu={(e) => handleContextMenu(e, 'sop', sop)}
              onClick={() => selectSOP(sop.id)}
            >
              {getDisplayStyleIcon(sop.displayStyle)} {sop.title}
            </div>
          ))}
        </>
      )}
    </div>
  )
}
```

#### 步骤 3：SOPContextMenu 组件

**文件**：`src/components/sop/SOPContextMenu.tsx`（新建）

```typescript
interface ContextMenuProps {
  x: number; y: number
  type: 'folder' | 'sop'
  target: SOPFolder | SOP
  onClose: () => void
}
```

**文件夹菜单项**：新建 SOP / 新建子文件夹（层级<3）/ 重命名 / 删除 / 删除含内容

**SOP 菜单项**：编辑 / 复制为我的（系统）/ 移动到... / 删除

菜单 UI：fixed 定位，白色背景 + 边框 + 阴影 + zIndex: 300。点击外部关闭（`useEffect` 监听 `mousedown`）。

「移动到...」弹出扁平化文件夹选择器。

#### 步骤 4：SOPTree 集成右键菜单

新增 `contextMenu` state，`handleContextMenu` 函数，在 SOPTree 底部渲染 `SOPContextMenu`。

---

### F3-f：创建 SOP 时自动新建文件夹

**文件**：`src/components/sop/SOPEditor.tsx`

文件夹选择器底部新增 `+ 新建文件夹...` 选项。点击后内联输入框，Enter 创建根级文件夹并选中。

如果 `select` 元素不方便插入自定义选项，改为自定义下拉组件。

---

### Phase 5 测试

```
sop folder nesting:
  - addFolder with parentId 正确设置
  - getFolderDepth 返回正确层级（0/1/2）
  - 3 层限制：depth=2 时不允许创建子文件夹
  - deleteFolderRecursive 递归删除
  - moveSOP 正确更新 folderId
```

---

## i18n 新增（Phase 3 + 4 + 5 合并）

在 `src/i18n/zh.ts` 和 `src/i18n/en.ts` 的 `sop_*` 区域追加：

```typescript
// Display Style
sop_displayStyle: '显示风格',                    // 'Display Style'
sop_style_numbered: '编号',                      // 'Numbered'
sop_style_bullet: '圆点',                        // 'Bullet'
sop_style_timeline: '时间轴',                    // 'Timeline'

// Rich Editor
sop_content_placeholder: '添加详细说明...',        // 'Add details...'
sop_insertTable: '插入表格',                      // 'Insert Table'
sop_insertLink: '插入链接',                       // 'Insert Link'
sop_insertCalloutInfo: '插入提示',                // 'Insert Tip'
sop_insertCalloutWarning: '插入警告',             // 'Insert Warning'
sop_insertCodeBlock: '插入代码块',                // 'Insert Code Block'

// SOP Link
sop_linkSOP: '链接流程',                          // 'Link SOP'
sop_linkSOP_search: '搜索流程...',                // 'Search SOPs...'
sop_linkedDeleted: '已删除的流程',                // 'Deleted SOP'

// Child Steps
sop_addChildStep: '添加子步骤',                   // 'Add Sub-step'
sop_moveUp: '上移',                              // 'Move Up'
sop_moveDown: '下移',                            // 'Move Down'

// Subfolder + Context Menu
sop_newSubfolder: '新建子文件夹',                  // 'New Subfolder'
sop_newFolderInline: '新建文件夹...',              // 'New folder...'
sop_maxDepth: '最多支持 3 层文件夹',               // 'Max 3 folder levels'
sop_contextMenu_newSOP: '新建 SOP',               // 'New SOP'
sop_contextMenu_rename: '重命名',                  // 'Rename'
sop_contextMenu_delete: '删除',                    // 'Delete'
sop_contextMenu_deleteAll: '删除文件夹及内容',      // 'Delete with contents'
sop_contextMenu_moveTo: '移动到...',               // 'Move to...'
sop_contextMenu_edit: '编辑',                      // 'Edit'
sop_folderNotEmpty: '文件夹非空，无法直接删除',      // 'Folder is not empty'
sop_confirmDeleteAll: '确定删除该文件夹及其中所有内容？', // 'Delete this folder and all its contents?'
```

---

## 质量验收（Phase 3 + 4 + 5 全部完成后）

| 检查 | 命令/方法 | 标准 |
|------|----------|------|
| `tsc --noEmit` | 零错误 | |
| `npx vitest run` | 全通过 | |
| F3-a | 风格切换正常 + 执行模式全覆盖 | |
| F3-b | Tiptap 编辑器工作（粗体/斜体/删除线/代码块/表格/链接/列表/callout） | |
| F3-b | 查看模式 generateHTML 正确渲染 | |
| F3-c | 子步骤增删改排序 + 2 层限制 | |
| F3-d | SOP 链接插入 + 点击跳转 + 删除降级 | |
| F3-e | 子文件夹递归渲染 + 右键菜单完整 + 3 层限制 | |
| F3-f | 创建 SOP 时新建文件夹 | |
| 迁移 | v0.3.0 数据正确迁移（type→displayStyle, note/warning→content, parentId） | |
| 系统预设 | 8 个系统 SOP 正确适配 | |
| 旧文件删除 | 4 个旧视图文件已删除 | |
