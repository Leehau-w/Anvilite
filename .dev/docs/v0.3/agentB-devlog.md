# Agent B — v0.3 开发日志

**日期**：2026-04-13 ~ 2026-04-14（持续更新）
**角色**：Agent B（并行开发，负责 Phase 1B / Phase 2B 改进 / Phase 4 SOP MVP）
**Commit**：`c1350c2`（初版），后续迭代未单独 commit

---

## 一、开发前准备

读取了 `docs/v0.3/` 下的全部文档（OVERVIEW、PARALLEL-GUIDE、phase1-4），确认 Agent B 的独占文件范围，避免与 Agent A 产生冲突。

扫描现有代码后发现以下项目已提前完成，本次跳过：

| 项目 | 状态 |
|------|------|
| Error Boundary（legacy-1） | ✅ Agent A 已实现 |
| 跨午夜习惯刷新（legacy-2） | ✅ Agent A 已实现 |
| feature6 子任务重构 | ✅ `Task` 类型已迁移至内嵌 `subTasks` |
| Vitest 配置 + 引擎测试 | ✅ 91 个 case 全部通过 |
| fix8 编辑抽屉实际时长 | ⚠️ v0.2 已有 UI，但存在 bug，本次修复 |

---

## 二、实现内容

### fix2 — WeekHeatmap 时段聚合

**文件**：`src/components/dashboard/Heatmap.tsx`

**问题**：原代码用 `Math.floor(dayXP / 4)` 将每天 XP 均分到 4 个时段，数据完全失真。

**修复**：在 `useMemo` 中遍历所有 `GrowthEvent`，用 `new Date(event.timestamp).getHours()` 提取小时，按规则分类后聚合到 `slotMap`：

```
凌晨  hour >= 1  && hour < 6   → slot 0
上午  hour >= 6  && hour < 12  → slot 1
下午  hour >= 12 && hour < 18  → slot 2
晚上  hour >= 18 || hour < 1   → slot 3
```

`WeekHeatmap` 改为消费 `slotMap: Map<"${date}-${slotIdx}", xp>`，颜色归一化基于本周内单时段最大 XP。

---

### fix5 — Electron 图标路径

**文件**：`electron/main.ts`、`electron-builder.json`

**问题**：原代码用 `process.cwd()` 查找图标，打包后工作目录改变导致任务栏/快捷方式无图标。

**修复**：

```typescript
// electron/main.ts
icon: app.isPackaged
  ? path.join(process.resourcesPath, 'build/icon.png')
  : path.join(process.cwd(), 'build/icon.png'),
```

同时在 `electron-builder.json` 添加 `extraResources`，将图标复制到打包资源目录：

```json
"extraResources": [
  { "from": "build/icon.png", "to": "build/icon.png" }
]
```

---

### feature1 — MonthHeatmap 轴向交换 + 热力图响应式

**文件**：`src/components/dashboard/Heatmap.tsx`

**轴向变更**：月视图从 7 rows（DOW）× N cols（周次）改为 N rows（周次）× 7 cols（DOW）。顶部渲染周一~日列标题行，外层 flex 改为 `flex-direction: column`，内层每行渲染一周 7 格。

**响应式重构**（后续补丁）：

- 原固定 16px 格子在大窗口下留白明显。改用 `ResizeObserver` 量容器宽高，`useContainerCellSize(cols, rows, gap, headerH, labelW)` 同时根据宽度和高度计算最大可用格子尺寸，取两者的 `min`，确保：
  - 宽度：格子自动撑满卡片宽度
  - 高度：整体不超出卡片高度，避免溢出
- 月视图传入 `rows = weeks.length`（5 或 6），周视图传入 `rows = 4`
- 容器用 `height: 100%; display: flex; flex-column` 撑满卡片，子组件用 `flex: 1`

**WeekHeatmap 细节修复**：

- 去掉格子上的 `isToday` 边框（整列出现 outline 影响可读性），仅在 DOW 列标题用 accent 色高亮今天
- 时段标签增加时间范围注释（凌晨 1–5 / 上午 6–11 / 下午 12–17 / 晚上 18–0），标签列宽从 28px 扩到 40px

---

### fix8 — 编辑抽屉实际时长可输入（补丁）

**文件**：`src/components/tasks/TaskDrawer.tsx`

**问题**：v0.2 已存在实际时长输入框 UI，但无法实际输入数字。

**根本原因**：input 使用 `value={editTask.actualMinutes ?? 0}`，绑定的是父组件传入的 prop 快照，而非响应式 store 值。每次按键触发 `updateTask` 写入 store，但 React 随即用旧的 prop 值将 input 重置，导致输入内容被瞬间覆盖。

**修复**：

1. `FormData` 新增 `actualMinutes: string` 字段
2. 抽屉打开时（`useEffect`）从 `editTask.actualMinutes` 初始化本地状态
3. input 改为受控于 `form.actualMinutes`，`onChange` 只更新本地状态
4. `handleSubmit` 在 `status === 'done'` 时将 `actualMinutes` 一并传入 `updateTask`

---

### Phase 4 — 流程模块 MVP

全新模块，从零搭建。中文名称"流程"（原命名 SOP，后统一改为用户友好的"流程"）。

#### 数据层

**`src/types/sop.ts`**

```typescript
SOPFolder  // 文件夹：id / name / sortOrder / isSystem / createdAt
SOPStep    // 步骤：id / title / note / warning / time / sortOrder / childSteps（递归）
SOP        // id / folderId / title / type / steps / isSystem / lastUsedAt / sortOrder / createdAt / updatedAt
```

类型 `type` 枚举：`'schedule' | 'workflow' | 'checklist' | 'itemlist'`

**`src/stores/sopStore.ts`**

- 文件夹 CRUD：`addFolder / renameFolder / deleteFolder / reorderFolders`
- SOP CRUD：`addSOP / updateSOP / deleteSOP / duplicateSOP / moveSOP / reorderSOPs`
- 选中：`selectSOP`
- 折叠状态：`collapsedFolderIds: string[]` + `toggleFolderCollapsed`（持久化，流程 Tab 和仪表盘卡片共用）
- `zustand persist`，key：`${getStoragePrefix()}-sops`

**`src/stores/taskStore.ts`（追加）**

新增 `createTaskFromSOP` action，将 SOP 步骤映射为任务子任务（第 3 层及更深层忽略）。

#### 视图层

| 组件 | 路径 | 说明 |
|------|------|------|
| `SOPPage` | `src/components/sop/SOPPage.tsx` | 双栏布局（目录树 30% + 内容区 70%），底部 action bar 融入背景色，无分割线 |
| `SOPTree` | `src/components/sop/SOPTree.tsx` | 文件夹折叠/展开（持久化）、行内重命名、空文件夹删除、每文件夹内新建入口、底部新建文件夹 |
| `SOPContent` | `src/components/sop/SOPContent.tsx` | 标题区、按类型路由视图、最近转化时间 |
| `SOPWorkflowView` | `src/components/sop/SOPWorkflowView.tsx` | 有序步骤（编号圆圈）+ 备注 + 警告 + 子步骤；支持执行模式（checkbox + 划线淡化） |
| `SOPItemListView` | `src/components/sop/SOPItemListView.tsx` | 无序列表；支持执行模式 |
| `SOPChecklistView` | `src/components/sop/SOPChecklistView.tsx` | 检查清单视图；支持执行模式 |
| `SOPEditor` | `src/components/sop/SOPEditor.tsx` | 新建/编辑表单：类型选择、文件夹选择、步骤增删改 |
| `SOPToTaskModal` | `src/components/sop/SOPToTaskModal.tsx` | 步骤多选、标题/分类/难度/优先级/截止日期，调用 `createTaskFromSOP` |

**执行模式**：`checklist` / `itemlist` / `workflow` 三种类型均支持，`schedule` 暂不加（时间驱动型不适合逐步确认）。`EXECUTION_SUPPORTED` 数组控制哪些类型显示"开始执行"按钮。

#### 系统预设

**`src/data/systemSOPs.ts`**：8 个内置模板（`isSystem: true`），按类型分组排序：
- 日程型（2）：工作日日程、休息日日程
- 检查型（2）：每周复盘、会议准备检查（相邻排列）
- 流程型（2）：项目启动流程、学习新技能流程
- 清单型（2）：出差准备清单、大扫除清单

#### 基础设施

- **i18n**：`zh.ts` + `en.ts` 补充 `common_*` 和 `sop_*` 共 20+ key；"SOP" 全部替换为中文"流程"（en 改为 Flow/Flows）
- **`Sidebar.tsx`**：流程 Tab 插入任务后、世界地图前（第 3 位）
- **`App.tsx`**：`activeTab === 'sop'` 路由分支

#### 测试

`src/stores/createTaskFromSOP.test.ts`，6 个 case 覆盖步骤映射、嵌套、边界情况。

---

### fix6 — 灵感列表拖拽排序

**文件**：`src/components/dashboard/InspirationCard.tsx`、`src/stores/inspirationStore.ts`

**问题**：灵感列表无法手动调整顺序。

**实现**：

- `inspirationStore` 新增 `reorderInspirations(ids: string[])` action
- `InspirationCard` 改用 `Reorder.Group` + `Reorder.Item`（Framer Motion）
- 使用 `useDragControls`，拖拽把手（⠿，hover 时显示）触发拖拽，不影响点击编辑
- 同时移除了每行前面的 💡 图标

---

### 仪表盘流程卡片

**文件**：`src/components/dashboard/FlowsSummaryCard.tsx`、`src/stores/dashboardStore.ts`

- `dashboardStore` 新增 `'flows'` 卡片 ID，默认布局 `col:8, row:10, colSpan:8, rowSpan:5`
- `FlowsSummaryCard`：显示用户文件夹 + 系统模板前几条，点击条目直接 `selectSOP` + 跳转流程 Tab；底部"查看全部流程 →"跳转
- 文件夹可折叠，状态共用 `sopStore.collapsedFolderIds`（持久化）
- `Dashboard.tsx` 本地 `NavTab` 类型补充 `'sop'`，`CardPickerModal` 的 `CARD_LABELS` 补充 `flows` 和 `inspiration`

---

### Bug 修复与测试

#### sopStore 迁移 Bug（已修）

**问题**：`sopStore` 没有 `onRehydrateStorage`，已有存档的用户升级到含 `collapsedFolderIds` 字段的版本后，该字段为 `undefined`，调用 `.includes()` 直接崩溃。

**修复**：加入 `onRehydrateStorage` 兜底初始化：
```typescript
onRehydrateStorage: () => (state) => {
  if (!state) return
  if (!state.collapsedFolderIds) state.collapsedFolderIds = []
},
```

#### 新增测试（116 / 116 全通过）

新增 25 个测试用例，覆盖本次开发的核心纯函数：

**`src/components/dashboard/heatmap.test.ts`**
- `hourToSlot`：9 个边界用例（0时/1时/5-6临界/11-12临界/17-18临界/23时）
- `getHeatLevel`：10 个比例分级用例（含 0.19/0.20、0.44/0.45、0.74/0.75 临界值）

**`src/stores/inspirationStore.test.ts`**
- `reorderInspirations`：6 个用例（正常重排、已转化项追加末尾、ghost id 静默忽略、空列表、单项、原顺序不变）

---

### 导入导出补全

**文件**：`src/utils/dataExport.ts`

**问题**：`sopStore`（流程数据）和 `inspirationStore`（灵感列表）未包含在备份文件中，导出后丢失。

**修复**：
- `ExportData.data` 新增可选字段 `sops?` 和 `inspirations?`（可选，保持旧备份向前兼容）
- `exportData()` 加入两个 store 的 `getState()`
- `importData()` 的 `storeKeyMap` 加入 `sops → sops` 和 `inspirations → inspirations`
- `APP_VERSION` 更新为 `'0.3.0'`
- `requiredKeys` 校验不变，旧版备份文件仍可正常导入

---

## 三、质量验收

| 检查项 | 结果 |
|--------|------|
| `tsc --noEmit` | ✅ 零错误（每次改动后验证） |
| `npx vitest run` | ✅ 116 / 116 通过 |
| 独占文件无冲突 | ✅ 未触碰 Agent A 独占文件 |

---

## 四、遗留 / 待处理

| 项目 | 说明 |
|------|------|
| fix7 仪表盘卡片拖拽吸附精度 | 未在本次范围内 |
| feature2 仪表盘卡片自由位置 | `dashboardStore` 已有基础，UI 待完善 |
| 流程模块 schedule 视图 | 现有 `SOPScheduleView` 存在，执行模式未加（时间驱动型不适合） |

---

## 五、文档

### 用户指南 v0.3 更新

**文件**：`docs/user-guide.md`

- 版本标注从 v0.2 升至 v0.3
- 新增 **3.4 流程模块（Flows）** 完整章节：类型（流程型 / 检查型 / 清单型 / 日程型）、执行模式说明、转为任务流程、8 个系统模板、文件夹管理
- 仪表盘卡片表格新增「成长热力图」格子自适应描述、「灵感记录」拖拽排序说明、「我的流程」卡片入口
- 灵感速记快捷键补充：`Ctrl+Shift+N` 全局唤起、`Ctrl+Enter` 快速保存
- 数据导出章节补充备份内容清单（任务、习惯、流程、灵感等），注明 v0.2 备份文件可兼容导入 v0.3
- 原 §3.4–§3.10 各节顺延为 §3.5–§3.11
