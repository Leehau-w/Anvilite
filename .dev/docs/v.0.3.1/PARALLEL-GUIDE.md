# Anvilite v0.3.1 — 并行开发指南

> **用途**：确保 Agent A / Agent B 同时开发不冲突。双方在开始前必须读完本文档。

---

## 一、Agent 职责划分

| | Agent A — 任务体系 | Agent B — SOP 模块 |
|---|---|---|
| **功能** | X1-X4 修复, F1 计时, F2 标签, F4 子项入口 | F3-a 类型改造, F3-b Tiptap 富文本, F3-c 子步骤, F3-d SOP 链接, F3-e 子文件夹+右键菜单, F3-f 新建文件夹 |
| **Phase** | Phase 1 → Phase 2 | Phase 3 → Phase 4 → Phase 5 |
| **核心文件区** | `src/components/tasks/`, `src/engines/`, `src/utils/tag*` | `src/components/sop/`, `src/data/systemSOPs.ts` |

---

## 二、文件独占分配

### Agent A 独占（Agent B 不得修改）

```
# 类型
src/types/task.ts                      # 新增 timerStartedAt / timerAccumulated / tags

# 引擎 / 工具
src/engines/timerEngine.ts             # 新建
src/engines/timerEngine.test.ts        # 新建
src/utils/tagColor.ts                  # 新建
src/utils/tagColor.test.ts            # 新建

# Store
src/stores/taskStore.ts                # timer actions, tag actions, 迁移
src/stores/habitStore.ts               # timerAccumulated 增强

# 组件 — 任务
src/components/tasks/TaskItem.tsx      # timer badge, tags 显示, subtask 入口
src/components/tasks/TaskDrawer.tsx    # tags 输入, 子项位置调整
src/components/tasks/TaskList.tsx      # tag filter bar, X3 动画修复
src/components/tasks/SubTaskItem.tsx   # X4 checkbox 替换

# 组件 — 新建
src/components/tasks/TimerBadge.tsx    # 新建
src/components/tasks/TagInput.tsx      # 新建
src/components/tasks/TagPill.tsx       # 新建
src/components/tasks/TagFilterBar.tsx  # 新建

# 组件 — UI
src/components/ui/Drawer.tsx           # X2 修复
src/components/ui/Checkbox.tsx         # 新建（共享选框组件）

# Electron
electron/main.ts                       # X1 图标路径
electron-builder.json                  # X1 图标配置
build/icon.ico                         # X1 新建（从 icon.png 生成）

# 习惯类型
src/types/habit.ts                     # 新增 timerAccumulated
```

### Agent B 独占（Agent A 不得修改）

```
# 类型
src/types/sop.ts                       # displayStyle 替换 type, folder.parentId

# Store
src/stores/sopStore.ts                 # 迁移 + subfolder actions + displayStyle

# 数据
src/data/systemSOPs.ts                 # 适配 displayStyle

# 组件 — SOP（修改）
src/components/sop/SOPContent.tsx      # 路由到新视图
src/components/sop/SOPEditor.tsx       # 风格切换 + textarea + 子步骤编辑
src/components/sop/SOPPage.tsx         # 执行模式统一
src/components/sop/SOPTree.tsx         # 子文件夹递归渲染 + 右键菜单触发

# 组件 — SOP（新建）
src/components/sop/SOPStepListView.tsx # 新建（统一步骤视图，替换 4 个旧视图）
src/components/sop/SOPRichEditor.tsx   # 新建（Tiptap 富文本编辑器封装）
src/components/sop/SOPLinkNode.tsx     # 新建（Tiptap SOP 链接自定义 inline node）
src/components/sop/CalloutExtension.ts # 新建（Tiptap callout 自定义 block node）
src/components/sop/SOPContextMenu.tsx  # 新建（右键菜单）

# 组件 — SOP（删除）
src/components/sop/SOPChecklistView.tsx  # 删除
src/components/sop/SOPItemListView.tsx   # 删除
src/components/sop/SOPWorkflowView.tsx   # 删除
src/components/sop/SOPScheduleView.tsx   # 删除

# SOP 相关测试
src/components/sop/sopContent.test.ts    # 如需更新
src/stores/sopStore.test.ts              # 新建或扩展
```

### 共享文件 — 协调规则

```
src/i18n/zh.ts                         # 双方都需要加 key
src/i18n/en.ts                         # 双方都需要加 key
```

---

## 三、i18n 协调规则

i18n 是唯一的冲突高风险区。采用以下策略：

### 3.1 Key 命名空间隔离

| Agent | 允许的 key 前缀 | 示例 |
|-------|-----------------|------|
| Agent A | `timer_*`, `tag_*` | `timer_start`, `tag_add` |
| Agent B | `sop_*` | `sop_displayStyle`, `sop_addChildStep` |

**不得跨命名空间添加 key。** 通用 key（`common_*`）如果不存在且确实需要，由先提交者添加。

### 3.2 添加位置

- Agent A 的 key 加在 `zh.ts` / `en.ts` 中 **`timer` 和 `tag` 区域**（按字母序找到合适位置插入，或在文件末尾 `}` 前新建区块）
- Agent B 的 key 加在 **`sop_` 区域**（现有 `sop_*` key 后面追加）

### 3.3 冲突处理

**先 commit 先得**。后提交者如果遇到 merge 冲突，手动合并（由于 key 前缀不同，冲突只可能是相邻行的上下文冲突，不会是同一 key 的内容冲突）。

---

## 四、共享组件约定

### Checkbox 组件（Agent A 创建，Agent B 可引用）

Agent A 在 Phase 1（X4 修复）时创建 `src/components/ui/Checkbox.tsx`。如果 Agent B 需要在 SOP 执行模式中使用统一选框，可以 import 这个组件，但**不修改它**。

如果 Agent B 需要 Checkbox 但 Agent A 尚未提交，Agent B 继续用现有方案（原生 checkbox 或内联 SVG），后续统一。

---

## 五、质量门禁

每个 Agent 在完成自己的全部任务后，必须通过：

| 检查 | 命令 | 标准 |
|------|------|------|
| 类型检查 | `tsc --noEmit` | 零错误 |
| 测试 | `npx vitest run` | 全通过 |
| 零硬编码中文 | 代码审查 | 组件中无中文字面量 |
| i18n 一致性 | TypeScript 编译 | zh/en key 完全匹配 |

---

## 六、Git 规范

### 分支命名

```
v031/agentA-fixes-tags-timer
v031/agentB-sop-enhance
```

### Commit 信息格式

```
[X2] fix: drawer overlay close only on direct click
[F1] feat: add timer engine with start/pause/stop
[F3-a] refactor: replace SOP type with displayStyle
```

### 合并顺序

1. Agent A 先合并（因为 Agent B 可能引用 Checkbox）
2. Agent B 合并时处理 i18n 冲突
3. 合并后运行完整 `tsc --noEmit` + `npx vitest run` 确认
