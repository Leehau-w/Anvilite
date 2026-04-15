# Agent B — v0.3.1 开发日志

**日期**：2026-04-15（持续更新）
**角色**：Agent B

---

## fix5（追加）— Electron 图标打包后不生效

**文件**：`build/icon.ico`、`electron/main.ts`、`electron-builder.json`

### 问题

release 后应用窗口/任务栏显示默认 Electron 图标，自定义图标不生效。

### 排查

1. `electron/main.ts` 打包模式下引用 `path.join(process.resourcesPath, 'build/icon.ico')`
2. 检查 `release/win-unpacked/resources/build/` 实际内容，发现**只有 `icon.png`，没有 `icon.ico`**
3. 原因：electron-builder 处理 `build/` 目录时自动将图标以 `icon.png` 形式复制到 resources，而 `extraResources` 中指定的 `icon.ico` 未生效（被覆盖或静默跳过）
4. 另外，原 `icon.ico` 仅包含 48x48 和 32x32 两个尺寸，缺少 256x256，导致大图标场景（桌面、资源管理器）显示模糊

### 修复

1. **重新生成 ico**：使用 `npx electron-icon-builder --input=build/icon.png --output=build/icons --flatten` 从 1045x1045 的源 PNG 生成包含 7 个尺寸（16/24/32/48/64/128/256）的完整 ico，替换原文件
2. **保留 `extraResources`**：确保 `icon.ico` 被复制到打包资源目录

```json
// electron-builder.json
"extraResources": [
  { "from": "build/icon.ico", "to": "build/icon.ico" }
]
```

3. **`main.ts` 保持引用 `icon.ico`**：

```typescript
icon: app.isPackaged
  ? path.join(process.resourcesPath, 'build/icon.ico')
  : path.join(process.cwd(), 'build/icon.ico'),
```

### ICO 格式说明

ICO 是 Windows 专用图标格式，一个文件内打包多个尺寸，系统按场景自动选用：

| 场景 | 尺寸 |
|------|------|
| 任务栏 | 16x16 / 24x24 |
| Alt+Tab | 32x32 / 48x48 |
| 桌面图标 | 48x48 |
| 资源管理器大图标 | 256x256 |

**转换命令**：`npx electron-icon-builder --input=build/icon.png --output=build/icons --flatten`，从一张大 PNG 自动生成多尺寸 ico。

### 验证

下次 `npm run pack` 后需确认：
- [ ] `release/win-unpacked/resources/build/icon.ico` 存在且为 7 尺寸版本
- [ ] 运行安装版 / portable 版，任务栏图标正确显示
- [ ] 桌面快捷方式图标清晰（256x256）

---

## Phase 3 — SOP 类型改造 + Tiptap 富文本 + 数据迁移

### F3-a：4 type → 3 displayStyle

**变更文件**：
- `src/types/sop.ts` — `SOP.type` → `SOP.displayStyle`; `SOPStep.note/warning` → `SOPStep.content: JSONContent | null`; `SOPFolder` 新增 `parentId: string | null`
- `src/stores/sopStore.ts` — 新增 `migrateStepContent()` 迁移函数 + `onRehydrateStorage` 中的 `SOP_MIGRATION_V031` 迁移逻辑 + 兼容兜底; 新增 actions: `setDisplayStyle`, `moveSOP`, `moveFolder`, `getFolderDepth`, `deleteFolderRecursive`
- `src/data/systemSOPs.ts` — 所有 8 个系统预设 SOP 适配新类型：`resolveStep()` 将双语 `noteZh/noteEn/warnZh/warnEn` 构建为 Tiptap JSONContent callout 结构; `getSystemFolder()` 返回对象补 `parentId: null`
- `src/components/sop/SOPContent.tsx` — 删除旧 4 视图 import，统一使用 `<SOPStepListView>`; `getSOPTypeIcon` → `getDisplayStyleIcon`; 标题右侧新增 3 按钮风格切换组（numbered/bullet/timeline）
- `src/components/sop/SOPEditor.tsx` — `type` state → `displayStyle` state; 类型选择 UI 改为 3 按钮组; `time` 输入仅 `displayStyle === 'timeline'` 时显示; `makeStep()` 返回 `content: null`
- `src/components/sop/SOPPage.tsx` — 删除 `EXECUTION_SUPPORTED` 限制，所有 SOP 均可执行; `handleCopySystemSOP` 适配 `displayStyle`
- `src/components/sop/SOPToTaskModal.tsx` — 适配 `displayStyle` 类型

**迁移规则**：
| 旧 `type` | 新 `displayStyle` |
|-----------|-------------------|
| `schedule` | `timeline` |
| `workflow` | `numbered` |
| `checklist` | `numbered` |
| `itemlist` | `bullet` |

**step 迁移**：`warning` → `callout[variant=warning]`，`note` → `callout[variant=info]`，两者都为空时 `content: null`。递归处理 `childSteps`。

**测试**：`src/data/systemSOPs.test.ts` + `src/stores/createTaskFromSOP.test.ts` 均已适配新类型。

### F3-b：Tiptap 富文本编辑器

**新建文件**：

1. **`src/components/sop/CalloutExtension.ts`**（25 行）— Tiptap 自定义 block node，支持 `info` / `warning` 两种 variant，渲染为 `<div data-callout data-variant="...">`。

2. **`src/components/sop/SOPRichEditor.tsx`**（439 行）— 核心富文本编辑器组件，包含：
   - `getSopEditorExtensions()` — 共享 extensions 列表（StarterKit + Table 4件套 + CodeBlockLowlight + Link + Placeholder + CalloutExtension + SOPLinkNode），编辑器和 `generateHTML` 共用
   - `renderContentHTML()` — 静态 HTML 生成（查看模式用，不初始化编辑器实例）
   - `preprocessContent()` — 内容预处理：遍历 JSON tree，将 `sopLink` 节点目标已删除时替换为灰色斜体文本
   - `SOPRichEditor` 组件 — 包含 Toolbar + EditorContent，`React.lazy` 按需加载
   - `Toolbar` 组件 — 工具栏按钮：**B**/I/~~S~~ | `</>` 代码块 / ⊞ 表格(3×3) / 🔗 链接 | • 无序 / 1. 有序 | 💡 info callout / ⚠️ warning callout | 📋 SOP 链接搜索
   - Callout CSS — 内联 `<style>` 注入，info 用 accent 色 8% 底 + 3px 左线，warning 用 warning 色

**依赖安装**：`@tiptap/react`, `@tiptap/starter-kit`, `@tiptap/extension-table` (+ table-row/cell/header), `@tiptap/extension-code-block-lowlight`, `@tiptap/extension-link`, `@tiptap/extension-placeholder`, `@tiptap/html`, `lowlight`

### 统一步骤视图

**新建文件**：**`src/components/sop/SOPStepListView.tsx`**（344 行）

替代原来的 4 个视图组件（`SOPWorkflowView` / `SOPItemListView` / `SOPScheduleView` / `SOPChecklistView`）。

- `StepRow` 递归渲染：根据 `displayStyle` 生成不同前缀（numbered: `1.` / `1.1`，bullet: `•`，timeline: 无前缀）
- `StepContentView` — 将 `step.content` 用 `preprocessContent` + `renderContentHTML` 转 HTML，`dangerouslySetInnerHTML` 渲染; 点击事件委托处理 `[data-sop-link]` 跳转
- `TimelineLayout` — timeline 风格专属布局，左侧 2px 竖线 + 圆点节点 + 时间列（`tabular-nums`）
- 执行模式：所有 `displayStyle` 均支持，步骤前出现勾选框，已勾选文字灰色 + 删除线

### 删除的旧文件

```
src/components/sop/SOPChecklistView.tsx  (56 行)
src/components/sop/SOPItemListView.tsx   (55 行)
src/components/sop/SOPScheduleView.tsx   (82 行)
src/components/sop/SOPWorkflowView.tsx   (101 行)
```

---

## Phase 4 — 子步骤编辑 + SOP 链接

### F3-c：子步骤编辑 UI

**文件**：`src/components/sop/SOPEditor.tsx`（从原 ~150 行扩展至 727 行）

编辑器支持 3 层嵌套步骤编辑，UI 限制最多 2 层子步骤：

- **步骤层操作**：`handleAddStep` / `handleRemoveStep` / `handleUpdateStep` / `handleMoveStep`
- **子步骤操作**：`addChildStep` / `updateChildStep` / `removeChildStep` / `moveChildStep`
- **孙步骤操作**：`addGrandChildStep` / `updateGrandChildStep` / `removeGrandChildStep` / `moveGrandChildStep`

每层步骤均有独立的 `SOPRichEditor` 实例（`React.lazy` 按需加载），支持富文本编辑。

UI 结构：
```
┌─ 1. [标题] ─────────────────────────── [↑][↓][×] ─┐
│  [SOPRichEditor]                                    │
│  ┌─ 1.1 [子标题] ────────────── [↑][↓][×] ─┐      │
│  │  [SOPRichEditor]                         │      │
│  │  ┌─ 1.1.1 [孙标题] ──── [↑][↓][×] ─┐   │      │
│  │  └──────────────────────────────────┘   │      │
│  │  [+ 添加子步骤]                         │      │
│  └──────────────────────────────────────────┘      │
│  [+ 添加子步骤]                                     │
└─────────────────────────────────────────────────────┘
```

### F3-d：SOP 链接

**新建文件**：**`src/components/sop/SOPLinkNode.ts`**（30 行）

Tiptap 自定义 inline atom node：
- 属性：`sopId`（目标 SOP ID）、`sopTitle`（显示标题）
- 渲染：`<span data-sop-link style="color: accent; underline; cursor: pointer;">📋 {sopTitle}</span>`

**编辑器集成**（`SOPRichEditor.tsx` Toolbar）：
- 📋 按钮 → 弹出搜索下拉框（`showSOPSearch` state）
- 从 `sopStore.sops` 获取所有非系统 SOP，按标题模糊搜索
- 选中后插入 `sopLink` node 到编辑器光标位置

**查看模式跳转**（`SOPStepListView.tsx` `StepContentView`）：
- `generateHTML` 渲染 `sopLink` 为 `<span data-sop-link data-sopid="...">`
- 容器 `onClick` 事件委托：`closest('[data-sop-link]')` → `selectSOP(sopId)`

**目标被删降级**（`SOPRichEditor.tsx` `preprocessContent`）：
- 渲染前遍历 content JSON tree
- `sopLink` 节点的 `sopId` 不在 `existingSopIds` 集合中 → 替换为斜体文本 `[📋 已删除的流程]`
- 纯数据操作，不依赖 DOM

---

## Phase 5 — 子文件夹 + 右键菜单

### F3-e：子文件夹 + 右键菜单

**Store 新增 actions**（`src/stores/sopStore.ts`）：
- `addFolder(name, parentId?)` — 创建文件夹，支持指定父级
- `moveFolder(folderId, targetParentId)` — 移动文件夹到新父级
- `getFolderDepth(folderId)` — 计算文件夹深度（循环向上遍历）
- `deleteFolderRecursive(folderId)` — 递归收集子文件夹 ID → 批量删除文件夹和从属 SOP
- `moveSOP(sopId, targetFolderId)` — 移动 SOP 到目标文件夹

**`SOPTree` 改为递归渲染**（`src/components/sop/SOPTree.tsx`，291 行）：
- `renderFolder(folder, depth)` 递归渲染树结构
- 根级文件夹 = `parentId === null`，每层缩进 16px
- 系统文件夹排在最前
- 每个非系统文件夹行右侧显示 `⋯` 按钮（hover 时出现），触发右键菜单
- 非系统文件夹展开时底部显示 `+ 新建 SOP` 快捷入口
- 底部固定区域：`+ 新建文件夹` 按钮（内联输入框，Enter 创建）

**新建文件**：**`src/components/sop/SOPContextMenu.tsx`**（255 行）

fixed 定位菜单组件，自动调整位置避免超出视口，点击外部关闭。

文件夹菜单项：
- 新建 SOP
- 新建子文件夹（层级 < 3 时可用，否则灰色禁用 + 提示 `sop_maxDepth`）
- 内联子文件夹名输入框（Enter 创建 + Escape 取消）
- 重命名（委托给 SOPTree 的 `renamingId` state）
- 删除（空文件夹直接删除 / 非空文件夹 `window.confirm` 后 `deleteFolderRecursive`）

SOP 菜单项：
- 编辑（`selectSOP`）
- 复制为我的（仅系统 SOP，`duplicateSOP`）
- 移动到...（二级菜单，展示扁平化文件夹列表，缩进显示层级，当前所在文件夹置灰不可选）
- 删除

### F3-f：创建 SOP 时自动新建文件夹

**文件**：`src/components/sop/SOPEditor.tsx`

文件夹选择器下方新增 `+ 新建文件夹...` 按钮：
- 点击展开内联输入框
- Enter 调用 `addFolder(name)` 创建根级文件夹并自动选中
- Escape 取消

文件夹下拉中使用 `getFolderDepth` 缩进显示层级关系。

---

## i18n 新增

`src/i18n/zh.ts` 和 `src/i18n/en.ts` 各新增 ~30 个 `sop_*` 前缀键，覆盖：
- 显示风格（`sop_displayStyle`, `sop_style_numbered/bullet/timeline`）
- 富文本编辑器（`sop_content_placeholder`, `sop_insertTable/Link/CalloutInfo/CalloutWarning/CodeBlock`）
- SOP 链接（`sop_linkSOP`, `sop_linkSOP_search`, `sop_linkedDeleted`）
- 子步骤（`sop_addChildStep`, `sop_moveUp/moveDown`）
- 子文件夹 + 右键菜单（`sop_newSubfolder`, `sop_newFolderInline`, `sop_maxDepth`, `sop_contextMenu_*`, `sop_confirmDeleteAll`）

---

## 变更文件清单

### 新建（5 个）
| 文件 | 行数 | 用途 |
|------|------|------|
| `src/components/sop/CalloutExtension.ts` | 25 | Tiptap callout 自定义 block node |
| `src/components/sop/SOPRichEditor.tsx` | 439 | 富文本编辑器 + 工具栏 + HTML 生成 + 内容预处理 |
| `src/components/sop/SOPStepListView.tsx` | 344 | 统一步骤视图（numbered/bullet/timeline + 执行模式） |
| `src/components/sop/SOPLinkNode.ts` | 30 | Tiptap SOP 链接 inline atom node |
| `src/components/sop/SOPContextMenu.tsx` | 255 | 右键菜单（文件夹 + SOP） |

### 修改（9 个）
| 文件 | 主要变更 |
|------|---------|
| `src/types/sop.ts` | `type` → `displayStyle`; `note/warning` → `content`; `SOPFolder.parentId` |
| `src/stores/sopStore.ts` | 迁移逻辑 + 6 个新 actions |
| `src/data/systemSOPs.ts` | `resolveStep` 构建 Tiptap JSON; 8 个预设适配 `displayStyle` |
| `src/components/sop/SOPContent.tsx` | 统一视图 + 风格切换按钮组 |
| `src/components/sop/SOPEditor.tsx` | displayStyle + 3 层子步骤编辑 + 新建文件夹 |
| `src/components/sop/SOPTree.tsx` | 递归渲染 + 右键菜单集成 |
| `src/components/sop/SOPPage.tsx` | 删除执行限制 + 适配 |
| `src/components/sop/SOPToTaskModal.tsx` | 适配 `displayStyle` |
| `src/i18n/zh.ts` / `en.ts` | 各 +30 个 sop_* 键 |

### 删除（4 个）
| 文件 | 原行数 |
|------|--------|
| `src/components/sop/SOPChecklistView.tsx` | 56 |
| `src/components/sop/SOPItemListView.tsx` | 55 |
| `src/components/sop/SOPScheduleView.tsx` | 82 |
| `src/components/sop/SOPWorkflowView.tsx` | 101 |

### 测试适配
| 文件 | 变更 |
|------|------|
| `src/data/systemSOPs.test.ts` | 断言适配 `displayStyle` + `content` |
| `src/stores/createTaskFromSOP.test.ts` | mock 数据适配新类型 |

---

## UI 微调（`SOPStepListView.tsx`）

### 步骤详细说明缩进

富文本内容（`StepContentView`）之前与编号前缀齐平，没有缩进到编号后面。

**修复**：调整 `indentLeft` 值：
- **StepRow**（numbered/bullet）：正常模式 0 → **24px**，执行模式 24 → **38px**，内容对齐到标题文字起始位置
- **TimelineLayout 子步骤**：正常模式 0 → **8px**

### 执行模式勾选框颜色

勾选框 `accentColor` 从 `var(--color-accent)`（橙色）改为 `var(--color-success)`（绿色 `#16a34a`），共 3 处。

### 时间轴执行模式勾选框与竖线重叠

原因：容器 `paddingLeft: 32`，竖线 `left: 12`，勾选框 `left: -32`（绝对位置 0），checkbox 宽 ~14px，右边缘与竖线重叠。

**修复**：执行模式下整体右移腾出空间：
- 容器 `paddingLeft`: 32 → **52**
- 时间轴竖线 `left`: 12 → **32**
- 圆点 `left: -22` 不变（相对步骤 div，自动跟移，与竖线对齐关系不变）
- 勾选框 `left`: -32 → **-48**（放到竖线左侧）
- 非执行模式完全不受影响

---

## 质量状态

| 检查 | 结果 |
|------|------|
| `tsc --noEmit` | 0 errors |
| `npx vitest run` | 185/185 pass |
| 净变更 | +1099 -662（14 files in SOP scope） |
