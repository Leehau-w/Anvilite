# Anvilite v0.3 — 多 Agent 并行开发指南

---

## 一、并行规划总览

```
时间轴（周）  1        2        3        4        5        6        7
           ┌────────┬─────────────────┬─────────────────────────────────┐
Agent A    │Phase 1A│   feature6      │  Phase 3 世界地图重构            │
           │EB+午夜  │  子任务重构      │  WorldMap / AreaCard / areaStore │
           └────────┴─────────────────┴─────────────────────────────────┘
           ┌────────┬─────────────────┬─────────────────────────────────┐
Agent B    │Phase 1B│Vitest+改进项     │  Phase 4-5 SOP 模块             │
           │fix2/5/8│test+f1/f2/fix6/7│  全部 sop/ 文件                  │
           └────────┴─────────────────┴─────────────────────────────────┘
```

预计从 7-10 周压缩到 **5-7 周**。

---

## 二、Phase 1 并行（第 1 周）

### Agent A：框架层修复

| 任务 | 独占文件 |
|------|---------|
| Error Boundary | **新建** `src/components/ui/ErrorBoundary.tsx` |
| 跨午夜刷新 | **新建** `src/utils/dateWatcher.ts` |
| Error Boundary 包裹 | **改** `src/App.tsx` |
| 跨午夜初始化 | **改** `src/stores/habitStore.ts` |

### Agent B：独立组件修复

| 任务 | 独占文件 |
|------|---------|
| fix2 热力图 | **改** `src/components/dashboard/GrowthTrend.tsx` |
| fix5 图标 | **改** `electron/main.ts`, `electron-builder.yml` |
| fix8 编辑抽屉时长 | **改** `src/components/tasks/TaskDrawer.tsx` |

**文件冲突**：无。两个 agent 改的文件完全不交叉。

**同步点**：两个 agent 都完成后各自 `git commit`，然后合并到 `dev` 分支。

---

## 三、Phase 2 并行（第 2-3 周）

### Agent A：feature6 子任务重构（独占，不可分割）

| 步骤 | 独占文件 |
|------|---------|
| 类型变更 | `src/types/task.ts`, `src/types/habit.ts` |
| 迁移逻辑 | `src/stores/taskStore.ts`, `src/stores/habitStore.ts` |
| 工具函数 | **新建** `src/utils/subTaskUtils.ts` + `.test.ts` |
| 组件重写 | **新建** `src/components/tasks/SubTaskItem.tsx` |
| 组件修改 | `src/components/tasks/TaskItem.tsx`, `TaskDrawer.tsx`, `TaskList.tsx` |
| 仪表盘适配 | `src/components/dashboard/TaskCard.tsx`, `HabitCard.tsx` |
| feature5 一并处理 | 在改 TaskDrawer/TaskItem 时顺手删除预估时间 UI |

### Agent B：Vitest + 独立改进（不碰 task/habit 相关文件）

**第 2 周（与 feature6 同时进行）**：

| 任务 | 独占文件 |
|------|---------|
| Vitest 配置 | `vite.config.ts`（追加 test 配置）, `package.json`（追加 scripts） |
| xpEngine 测试 | **新建** `src/engines/xpEngine.test.ts` |
| levelEngine 测试 | **新建** `src/engines/levelEngine.test.ts` |
| habitEngine 测试 | **新建** `src/engines/habitEngine.test.ts` |
| prosperityEngine 测试 | **新建** `src/engines/prosperityEngine.test.ts` |
| badgeEngine 测试 | **新建** `src/engines/badgeEngine.test.ts` |

测试文件是纯新建，不改源代码，和 feature6 零冲突。

**第 3 周（feature6 完成后）**：

| 任务 | 独占文件 |
|------|---------|
| feature1 热力图轴交换 | `GrowthTrend.tsx` |
| feature2 仪表盘卡片位置 | `Dashboard.tsx`, `dashboardStore.ts` |
| fix6 灵感拖拽 | `InspirationCard.tsx`, `inspirationStore.ts` |
| fix7 仪表盘吸附 | `dashboardStore.ts`（与 feature2 同文件，合并做） |

**文件冲突**：Agent B 绝不碰 `task.ts`、`taskStore.ts`、`TaskItem.tsx`、`TaskDrawer.tsx`、`TaskCard.tsx`。这些全归 Agent A。

**同步点**：Agent A 的 feature6 完成并 commit 后，Agent B 才能开始第 3 周的任务（因为 `TaskCard.tsx` 等文件可能被 feature2 间接引用）。

---

## 四、Phase 3 + Phase 4 完全并行（第 4-6 周）⭐ 最大收益

### Agent A：Phase 3 世界地图重构

| 任务 | 独占文件 |
|------|---------|
| WorldMap 重写 | `src/components/worldmap/WorldMap.tsx`（重写） |
| AreaCard 新建 | **新建** `src/components/worldmap/AreaCard.tsx` |
| 删除旧文件 | **删除** `MapControls.tsx`, `AreaInfoBar.tsx` |
| 数据迁移 | `src/stores/areaStore.ts` |
| feature7 标题规范化 | **新建** `src/utils/normalizeTitle.ts` + `.test.ts` |
| feature7 统计展示 | `src/components/interior/ArchiveStats.tsx` |
| **协调：路由+导航** | `src/App.tsx`（无需改，世界地图已有路由） |
| **协调：i18n** | `src/i18n/zh.ts`, `src/i18n/en.ts`（**先改先 commit**） |

### Agent B：Phase 4 SOP 模块 MVP

| 任务 | 独占文件 |
|------|---------|
| 类型定义 | **新建** `src/types/sop.ts` |
| Store | **新建** `src/stores/sopStore.ts` |
| 主页面 | **新建** `src/components/sop/SOPPage.tsx` |
| 目录树 | **新建** `src/components/sop/SOPTree.tsx` |
| 内容区 | **新建** `src/components/sop/SOPContent.tsx` |
| 编辑器 | **新建** `src/components/sop/SOPEditor.tsx` |
| 流程型视图 | **新建** `src/components/sop/SOPWorkflowView.tsx` |
| 清单型视图 | **新建** `src/components/sop/SOPItemListView.tsx` |
| 转任务弹窗 | **新建** `src/components/sop/SOPToTaskModal.tsx` |
| 转任务 action | `src/stores/taskStore.ts`（新增 `createTaskFromSOP`） |
| 转任务测试 | **新建** `src/stores/createTaskFromSOP.test.ts` |

**协调文件**（两个 agent 都需要改的）：

| 文件 | 处理方式 |
|------|---------|
| `src/App.tsx` | **Agent A 不需要改**（世界地图路由已存在）。**Agent B 负责**添加 SOP 路由。 |
| `src/components/layout/Sidebar.tsx` | **Agent B 独占**，添加第 5 个 Tab。 |
| `src/i18n/zh.ts` + `en.ts` | **Agent A 先改先 commit**（世界地图相关 key 较少）。Agent B 后改（SOP key 较多），基于 Agent A 的 commit 继续添加。 |
| `src/stores/taskStore.ts` | **Agent B 独占**（只追加 `createTaskFromSOP` action，不改现有逻辑）。Agent A 不碰 taskStore。 |

**同步协议**：
1. **i18n 文件**：Agent A 先完成世界地图的 i18n key 并 commit → Agent B pull 后再添加 SOP 的 key
2. 其余文件各自独占，无需等待

---

## 五、Phase 5（第 6-7 周）

单 agent 即可：SOP 完整版（日程型/检查型视图、执行模式、系统预设）+ feature4（如 PM 已确认）。

---

## 六、操作方法

### 6.1 准备工作

确保项目已 git 初始化，建好 `dev` 分支：

```bash
git checkout -b dev
```

### 6.2 启动并行 agent

打开两个终端窗口（或 VS Code 的多个终端面板），分别运行：

**终端 1（Agent A）**：
```bash
cd /path/to/anvilite
claude
```

进入后发指令：
```
请阅读 docs/v03/OVERVIEW.md 和 docs/v03/phase1-fixes.md。
你是 Agent A，只负责以下任务：Error Boundary 和跨午夜习惯刷新。
不要修改 GrowthTrend.tsx、TaskDrawer.tsx、electron/main.ts、electron-builder.yml，这些由另一个 agent 负责。
开始实现 Error Boundary。
```

**终端 2（Agent B）**：
```bash
cd /path/to/anvilite
claude
```

进入后发指令：
```
请阅读 docs/v03/OVERVIEW.md 和 docs/v03/phase1-fixes.md。
你是 Agent B，只负责以下任务：fix2 热力图、fix5 图标、fix8 编辑抽屉时长。
不要修改 App.tsx、habitStore.ts、ErrorBoundary.tsx、dateWatcher.ts，这些由另一个 agent 负责。
开始实现 fix2。
```

### 6.3 同步流程

每个 agent 完成一个任务后：

```bash
# 在对应终端中让 agent 提交
git add -A
git commit -m "[fix2] fix: correct heatmap time slot calculation"
```

切换 agent 前，另一个 agent 先拉取：

```bash
git pull --rebase origin dev
# 或者如果在本地同分支工作：
git stash && git pull && git stash pop
```

### 6.4 Phase 3+4 并行时的 i18n 协调

这是唯一需要手动协调的文件。操作步骤：

1. **Agent A 先做世界地图**，完成后 commit 包含 `zh.ts` 和 `en.ts` 的改动
2. 在 Agent B 的终端中：
   ```
   先执行 git pull，拉取 Agent A 对 i18n 文件的修改，然后继续添加 SOP 的 i18n key。
   ```
3. 如果两边同时改了 i18n 且产生冲突，冲突很容易解决——两边都是在文件末尾追加新 key，手动合并即可

### 6.5 冲突处理

如果 `git pull --rebase` 提示冲突：

```bash
# 查看冲突文件
git status

# 手动编辑冲突文件（保留两边的改动）
# 然后：
git add <冲突文件>
git rebase --continue
```

或者让 Claude Code 帮忙解决：
```
git pull 后 zh.ts 有冲突，请帮我解决，保留两边的所有新增 key。
```

---

## 七、风险控制

| 风险 | 预防措施 |
|------|---------|
| 两个 agent 改了同一个文件 | 每个 agent 的指令中**明确列出禁碰的文件** |
| 合并后编译报错 | 每次合并后跑 `tsc --noEmit`，有错立刻修 |
| 测试挂了 | 每次合并后跑 `npm test` |
| Agent 忘了规则改了别人的文件 | commit 前 `git diff --name-only` 检查改了哪些文件 |
| i18n key 重名 | Agent A 用 `worldmap_` 前缀，Agent B 用 `sop_` 前缀，不会冲突 |

---

## 八、每个 Phase 给 Agent 的启动指令模板

### Phase 1

**Agent A**：
```
阅读 docs/v03/OVERVIEW.md 和 docs/v03/phase1-fixes.md。
你是 Agent A，负责：Error Boundary（v0.2-legacy-1）和跨午夜习惯刷新（v0.2-legacy-2）。
你独占的文件：App.tsx、habitStore.ts、新建 ErrorBoundary.tsx、新建 dateWatcher.ts。
禁止修改：GrowthTrend.tsx、TaskDrawer.tsx、electron/main.ts、electron-builder.yml。
```

**Agent B**：
```
阅读 docs/v03/OVERVIEW.md 和 docs/v03/phase1-fixes.md。
你是 Agent B，负责：fix2（热力图）、fix5（图标）、fix8（编辑抽屉时长）。
你独占的文件：GrowthTrend.tsx、electron/main.ts、electron-builder.yml、TaskDrawer.tsx。
禁止修改：App.tsx、habitStore.ts。
```

### Phase 2

**Agent A**：
```
阅读 docs/v03/OVERVIEW.md 和 docs/v03/phase2-refactor.md。
你是 Agent A，负责 feature6（子任务重构为内嵌 checklist）。这包含 fix1/fix3/fix4 和 feature5（删除预估时间）。
按文档中的 Step 1-5 顺序执行。
你独占所有 task/habit 相关文件。
```

**Agent B**：
```
阅读 docs/v03/OVERVIEW.md 和 docs/v03/phase2-refactor.md。
你是 Agent B，负责 Vitest 配置和 5 个引擎测试文件。
只新建 .test.ts 文件和修改 vite.config.ts、package.json。不修改任何 engine 源文件。
不修改任何 task、habit、TaskItem、TaskDrawer、TaskCard 相关文件。
```

### Phase 3+4（并行收益最大）

**Agent A**：
```
阅读 docs/v03/OVERVIEW.md 和 docs/v03/phase3-worldmap.md。
你是 Agent A，负责 Phase 3 全部：feature3（世界地图重构）和 feature7（高频行为统计）。
你独占 worldmap/ 目录、areaStore.ts、ArchiveStats.tsx、normalizeTitle.ts。
完成后立即 commit，包含 i18n 改动。不要修改 Sidebar.tsx 和 sop/ 目录。
```

**Agent B**：
```
阅读 docs/v03/OVERVIEW.md 和 docs/v03/phase4-sop-mvp.md。
你是 Agent B，负责 Phase 4 全部：SOP 模块 MVP。
你独占 sop/ 目录（全部新建）、types/sop.ts、sopStore.ts、Sidebar.tsx。
在修改 i18n 文件前，先执行 git pull 拉取 Agent A 的最新改动，避免冲突。
taskStore.ts 只追加 createTaskFromSOP action，不改现有逻辑。
```
