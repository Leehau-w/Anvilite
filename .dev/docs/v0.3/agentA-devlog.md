# Agent A — v0.3 开发日志

**日期**：2026-04-13 ~ 2026-04-14  
**角色**：Agent A（主线会话，负责 Phase 5 SOP 完整版 + 交互打磨）

---

## 一、Phase 5 — SOP 完整版

### 5.1 系统预设数据层

**新建 `src/data/systemSOPs.ts`**

8 个双语系统预设，不使用 i18n key，直接在数据中嵌入中英文字符串对，按 `lang` 参数在渲染时解析：

| 预设 ID | 中文名 | 类型 |
|---------|--------|------|
| `__sys_workday` | 工作日日程 | schedule |
| `__sys_dayoff` | 休息日日程 | schedule |
| `__sys_weeklyReview` | 每周复盘 | checklist |
| `__sys_meetingPrep` | 会议准备检查 | checklist |
| `__sys_projectKickoff` | 项目启动流程 | workflow |
| `__sys_learnSkill` | 学习新技能流程 | workflow |
| `__sys_travelPacking` | 出差准备清单 | itemlist |
| `__sys_deepClean` | 大扫除清单 | itemlist |

导出 `getSystemFolder(lang)` 和 `getSystemSOPs(lang: 'zh' | 'en')`，两者均在渲染时调用，确保切换语言时预设内容同步更新。步骤内容储存为 `[zh, en]` 字符串元组，规避了 60+ 个 i18n key 的膨胀问题。

---

### 5.2 SOPScheduleView

**新建 `src/components/sop/SOPScheduleView.tsx`**

竖向时间轴布局：
- 左侧 2px 竖线（`var(--color-border)`）
- 时间圆点（accent 色，absolute 定位）
- 时间列（48px 固定宽，`tabular-nums`）
- 步骤内容列（标题 + 💡 备注 + ⚠️ 警告）
- 步骤按 `time` 字段排序，无 time 按 `sortOrder` 兜底

---

### 5.3 SOPChecklistView

**新建 `src/components/sop/SOPChecklistView.tsx`**

带编号的检查列表：
- 非执行模式：序号 + 标题，注释/警告行
- 执行模式：序号左侧加 checkbox，勾选后标题删除线 + 变暗

---

### 5.4 SOPItemListView — 执行模式支持

**更新 `src/components/sop/SOPItemListView.tsx`**

新增可选 props：`executionMode`、`checkedIds`、`onToggle`，执行模式下每行出现 checkbox，与 SOPChecklistView 保持一致的交互风格。

---

### 5.5 SOPEditor — 扩展至全 4 类型

**更新 `src/components/sop/SOPEditor.tsx`**

类型选择器从 `workflow / itemlist` 扩展为全 4 种类型：
- schedule：步骤编辑增加时间点输入（`time` 字段，HH:MM 格式）
- checklist：步骤编辑增加警告字段输入

---

### 5.6 SOPTree — 合并系统文件夹

**更新 `src/components/sop/SOPTree.tsx`**

引入 `useSettingsStore` 获取 `lang`，`useMemo` 中将 `getSystemFolder(lang)` 和 `getSystemSOPs(lang)` 与用户数据合并。系统文件夹 `sortOrder: -1`，始终排在最上方。

---

### 5.7 SOPContent — 纯展示组件

**更新 `src/components/sop/SOPContent.tsx`**

重构为纯展示组件，执行状态上移至父组件 `SOPPage`：

```typescript
interface Props {
  sop: SOP
  executionMode: boolean
  checkedIds: Set<string>
  onToggle: (stepId: string) => void
}
```

---

### 5.8 SOPPage — 执行状态管理

**更新 `src/components/sop/SOPPage.tsx`**

- `executionMode`、`checkedIds` 状态在此管理
- 切换 SOP 时重置执行状态（`useRef` + render-phase 比较）
- `EXECUTION_SUPPORTED: ['checklist', 'itemlist']`，不支持的类型隐藏「开始执行」按钮
- 系统 SOP 展示「复制为我的」按钮，调用 `addSOP` 写入用户文件夹
- 底部 action bar 独立于滚动区域，紧贴窗口底部

---

### 5.9 i18n 新增

`zh.ts` / `en.ts` 同步新增：

| key | zh | en |
|-----|----|----|
| `sop_type_schedule` | 日程型 | Schedule |
| `sop_type_workflow` | 流程型 | Workflow |
| `sop_type_checklist` | 检查型 | Checklist |
| `sop_type_itemlist` | 清单型 | Item List |
| `sop_warningPlaceholder` | 警告提示… | Warning note… |
| `sop_systemFolder` | 系统模板 | System Templates |
| `sop_systemBadge` | 系统模板 | System |
| `sop_startExecution` | 开始执行 | Start Execution |
| `sop_endExecution` | 结束执行 | End Execution |
| `sop_progress` | (d,t) => `${d}/${t} 已完成` | (d,t) => `${d}/${t} completed` |
| `sop_copyToMine` | 复制为我的 | Copy to Mine |

---

## 二、世界地图修复与响应式改造

### 2.1 AddAreaModal 渲染 Bug

**文件**：`src/components/worldmap/WorldMap.tsx`

**问题**：原写法 `<AddAreaModal open={showAddModal}/>` 始终挂载（`AddAreaModal` 无 `open` prop），导致覆盖层常驻。

**修复**：改为条件渲染 + `AnimatePresence`，传入正确 props：
```tsx
{showAddModal && (
  <AddAreaModal
    usedTemplateIds={getUsedTemplateIds()}
    areaCount={areas.length}
    onClose={() => setShowAddModal(false)}
    onAdd={handleAddArea}
  />
)}
```

---

### 2.2 响应式卡片网格

**文件**：`WorldMap.tsx`、`AreaCard.tsx`

**实现**：
- `CARD_ASPECT = 1`（正方形，为后期像素素材预留）
- `computeOptimalCols(W, H, n)` 函数：枚举 1~n 列数，找出卡片面积最大且所有行能放入容器高度的方案；极端情况回退到最小卡片宽度（120px）
- `containerRef` + `ResizeObserver` 监听容器尺寸变化，实时更新 `cols`
- `AreaCard` 内容尺寸全部改用 `clamp()` 随卡片等比缩放

---

### 2.3 WorldMap tab 缩放动画修复

**文件**：`src/components/worldmap/AreaCard.tsx`

**原因**：`motion.div` 上的 `layout` 属性在每次 WorldMap 挂载时触发 layout 动画。WorldMap 条件渲染（每次切换 tab 重新挂载），`cols` 从默认值更新到实际值触发了 layout 动画，视觉上表现为缩放。

**修复**：移除 `layout` 属性，静态网格不需要 layout 动画。

---

## 三、任务子任务交互改造

### 3.1 TaskDrawer 创建模式支持子任务

**文件**：`src/components/tasks/TaskDrawer.tsx`

- 新增 `pendingSubTasks: SubTask[]` 本地状态
- 创建模式下可添加/删除待定子任务（列表预览：`• title ×`）
- `handleSubmit` 在 `addTask()` 返回新任务后，批量调用 `addSubTask(newTask.id, sub.title)` 写入

---

### 3.2 TaskItem 文案更新

**文件**：`src/components/tasks/TaskItem.tsx`

`+ 添加步骤` → `+ {t.subtask_add}`（对应 i18n key `subtask_add`：「添加子项」）

---

## 四、持久化折叠状态与仪表盘子项显示

### 4.1 uiStore

**新建 `src/stores/uiStore.ts`**

```typescript
interface UIStore {
  collapsedTaskIds: string[]       // 收起的 task/subtask/habit id
  toggleTaskCollapse: (id: string) => void
  isTaskCollapsed: (id: string) => boolean
}
```

Zustand persist，key：`${getStoragePrefix()}-ui`。同一个 store 被 `TaskItem`、`SubTaskItem`、`HabitRow`、`HabitCard` 四处复用，ID 不冲突（task id / subtask id / habit id / subhabit id 均独立）。

---

### 4.2 TaskItem — 子任务显示与折叠

**文件**：`src/components/tasks/TaskItem.tsx`

- `subTasksExpanded` 从 `useState(true)` 改为 `useUIStore.isTaskCollapsed(task.id)`，实现持久化
- 移除 `!compact &&` 子任务列表守卫，仪表盘（compact 模式）也显示子项
- 勾选框右侧增加专用折叠按钮：高 20px，显示 `▾/▸ N/M`，展开时橙色背景
- 添加子项输入框保留 `!compact &&` 守卫，仪表盘不出现输入框
- compact 模式 exit 动画：改为淡出（`opacity: 0, 0.15s`），不再触发飞出右侧动画
- 移除 `MAX_VISIBLE_SUBTASKS` 常量，折叠即全隐，展开即全显

---

### 4.3 SubTaskItem — compact 模式 + 折叠

**文件**：`src/components/tasks/SubTaskItem.tsx`

- 新增 `compact?: boolean` prop
- compact 模式：隐藏编辑/删除/添加子项按钮，标题不可点击编辑，输入框不渲染
- 子项的子项折叠按钮：位于 checkbox 右侧，高 16px（比任务级小一号）
- 使用 `useUIStore.isTaskCollapsed(subTask.id)` 持久化嵌套折叠状态

---

### 4.4 仪表盘任务条数限制去除

**文件**：`src/components/dashboard/Dashboard.tsx`

移除 `localTodo.slice(0, 10)` 硬编码限制，待办任务全量显示，容器已有 `overflowY: auto`。

---

## 五、习惯子项交互

### 5.1 任务 Tab — HabitRow

**文件**：`src/components/tasks/TaskList.tsx`

- 引入 `useUIStore`，`SubHabit` 类型
- 标题行：折叠按钮（`▾/▸ N/M`）替换原 `▶` 图标，点击 `stopPropagation` 防止触发打开抽屉
- 元信息行：去除「N 个子步骤」文字
- `SubHabitItem` 组件（同文件内）：checkbox 切换完成状态（`toggleSubHabit`），递归嵌套折叠，使用 `useUIStore` 持久化
- 子项列表移至卡片内部（`motion.div` 内，hover 操作栏下方），`onClick` stopPropagation 防止触发编辑

---

### 5.2 仪表盘 — HabitCard

**文件**：`src/components/dashboard/HabitCard.tsx`

- 引入 `useUIStore`、`SubHabit`
- `HabitItem` 改为列布局，主行 + 子项区域
- 折叠按钮位于完成按钮右侧，样式同 TaskItem
- `DashSubHabitItem` 组件：与 `SubHabitItem` 逻辑一致，`onToggle` 通过 prop 传入（避免 hook 嵌套问题）

---

## 六、交互细节修复

### 6.1 任务卡片 hover 延迟

**文件**：`src/components/tasks/TaskItem.tsx`

**问题**：`onMouseEnter` 立即触发，鼠标扫过时操作栏频繁弹出，干扰点击目标卡片。

**修复**：新增 `hoverTimer` ref，`onMouseEnter` 改为 300ms 后才设置 `hovered: true`；`onMouseLeave` 立即清除 timer 并收起操作栏。组件卸载时在 `useEffect` cleanup 中清除所有 timer。

---

### 6.2 习惯卡片 hover 延迟

**文件**：`src/components/tasks/TaskList.tsx`（`HabitRow` 组件）

同 TaskItem，`HabitRow` 的 `onMouseEnter` / `onMouseLeave` 改为 300ms 延迟显示操作栏。

**Bug**：新增 `useEffect` 时漏掉了在文件顶部导入，导致习惯列表运行时报错、卡片无法点击。已修复（补充 `useEffect` 至 import 列表）。

---

## 七、测试基建

### 7.1 新增测试文件（4 个）

| 文件 | 通过 |
|------|------|
| `src/data/systemSOPs.test.ts` | ✅ 17 cases |
| `src/utils/formatRelativeTime` via `src/components/sop/sopContent.test.ts` | ✅ 12 cases |
| `src/utils/grid` via `src/components/worldmap/worldMap.test.ts` | ✅ 11 cases |
| `src/stores/uiStore.test.ts` | ✅ 9 cases |

### 7.2 纯函数提取

- `src/utils/formatRelativeTime.ts`：从 `SOPContent.tsx` 提取，无 store 依赖
- `src/utils/grid.ts`：从 `WorldMap.tsx` 提取 `computeOptimalCols`，无 store 依赖
- `WorldMap.tsx` 保留 `export { computeOptimalCols }` 向后兼容，同时保留 `CARD_ASPECT` / `CARD_GAP` 本地常量（JSX 渲染仍需用）

### 7.3 Vitest 全局 localStorage Polyfill

**问题**：Node 测试环境没有 `localStorage`，但 `accountManager.ts` 在模块加载时（非测试时）同步调用 `localStorage.getItem`，导致 `vi.stubGlobal` 在测试体内调用时已经太晚。

**方案**：新建 `src/test/setup.ts`，在 `vitest.config.ts` 的 `setupFiles` 中注册，确保 `localStorage` polyfill 在所有模块导入之前生效。

---

## 八、质量验收

| 检查项 | 结果 |
|--------|------|
| `tsc --noEmit` | ✅ 零错误 |
| `npx vitest run` | ✅ 169 / 169 通过 |
| 折叠状态跨页面持久化 | ✅ uiStore persist |
| SOP 系统预设双语切换 | ✅ 渲染时按 lang 解析 |
| WorldMap tab 切换无缩放动画 | ✅ 移除 layout |
| 仪表盘任务全量显示 | ✅ 移除 slice(0,10) |
| 仪表盘 compact 任务无飞出动画 | ✅ fade exit |
| 任务/习惯 hover 延迟 300ms | ✅ hoverTimer ref |
