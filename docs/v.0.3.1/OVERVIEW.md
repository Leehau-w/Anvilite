# Anvilite v0.3.1 — Claude Code 开发总纲

> **用途**：v0.3.1 开发主控文档。每次开始任务前先读本文档，再根据角色查阅子文档。
> **基准**：v0.3.0 已发布，v0.3.1 聚焦任务体验补全 + SOP 模块改进 + 体验修复。
> **并行策略**：2 个 Agent 独立并行开发，文件独占分配，详见 `PARALLEL-GUIDE.md`。

---

## 一、v0.3.1 最终范围

经 PM 出方案 → TD 审核 → PM 修订确认，最终范围如下：

### Feature

| 编号 | 名称 | 优先级 | 负责 |
|------|------|--------|------|
| F1 | 任务计时（start/pause/stop + 自动记录用时） | P0 | Agent A |
| F2 | 标签系统（自由标签 + 筛选） | P1 | Agent A |
| F3-a | SOP 类型→显示风格（4 type → 3 displayStyle） | P0 | Agent B |
| F3-b | SOP 富文本编辑器（Tiptap，不含图片） | P0 | Agent B |
| F3-c | SOP 子步骤编辑 UI | P0 | Agent B |
| F3-d | SOP 链接到别的流程（Tiptap 自定义 inline node） | P1 | Agent B |
| F3-e | SOP 子文件夹 + 右键菜单（不含拖拽） | P1 | Agent B |
| F3-f | 创建 SOP 时自动新建文件夹 | P1 | Agent B |
| F4 | 子项入口优化（`+` 常显 + 抽屉位置调整） | P1 | Agent A |

### Fix

| 编号 | 描述 | 负责 |
|------|------|------|
| X1 | 安装包应用图标未生效 | Agent A |
| X2 | 编辑抽屉点击添加子项时自动关闭 | Agent A |
| X3 | 切换分类 Tab 时任务卡片飞出动画 | Agent A |
| X4 | 子项选框完成后样式与父任务不统一 | Agent A |

### 推迟到 v0.4

- F3-b 图片插入 → base64 会撑爆 localStorage，等后端 CDN 就位
- F3-e 拖拽 → 需引入 dnd-kit，用右键菜单替代

---

## 二、架构与编码规范

沿用 v0.3.0 的所有规范（分层依赖、TypeScript 严格模式、零 any、i18n 零硬编码等），以下为 v0.3.1 新增要点：

### 2.1 数据模型变更

**Task 新增字段：**

```typescript
interface Task {
  // ... 已有字段 ...
  timerStartedAt: string | null   // 计时开始 ISO 时间戳，null 表示未在计时
  timerAccumulated: number        // 暂停前已累计秒数，默认 0
  tags: string[]                  // 标签数组，默认 []
}
```

**Habit 新增字段：**

```typescript
interface Habit {
  // ... 已有字段（已有 timerStartedAt）...
  timerAccumulated: number        // 新增，暂停前已累计秒数，默认 0
}
```

**SOP 变更：**

```typescript
interface SOP {
  // ...
  displayStyle: 'numbered' | 'bullet' | 'timeline'  // 替换原 type 字段
  // type 字段删除
}

interface SOPFolder {
  // ...
  parentId: string | null   // 新增，父文件夹 ID，null = 根级
}

interface SOPStep {
  id: string
  title: string
  content: JSONContent | null  // 新增：Tiptap JSON 富文本（替换 note + warning）
  time: string | null
  sortOrder: number
  childSteps: SOPStep[]
  // 删除的字段：note, warning（迁移到 content）
}
```

### 2.3 新增依赖（Agent B）

```
@tiptap/react, @tiptap/starter-kit, @tiptap/extension-table,
@tiptap/extension-code-block-lowlight, @tiptap/extension-link,
@tiptap/extension-placeholder, lowlight
```

总计约 365KB（gzip ~110KB），不含 `@tiptap/extension-image`（v0.4）。

### 2.2 数据迁移约定

v0.3.1 涉及 3 个 Store 的迁移，全部在 `onRehydrateStorage` 中执行：

| Store | 标记 Key | 内容 |
|-------|---------|------|
| taskStore | `MIGRATION_TIMER_TAGS_V031` | Task 新增 `timerStartedAt/timerAccumulated/tags` + 旧 timer 清理代码移除 + 4 小时过期自动暂停 |
| habitStore | `MIGRATION_HABIT_TIMER_V031` | Habit 新增 `timerAccumulated` + 4 小时过期自动暂停 |
| sopStore | `SOP_MIGRATION_V031` | `type` → `displayStyle` + `step.note/warning` → `step.content`（Tiptap JSON） + `folder.parentId` 默认 null |

### 2.3 新增引擎 / 工具函数

| 文件 | 内容 | 测试 |
|------|------|------|
| `src/engines/timerEngine.ts` | `getElapsedSeconds()`, `formatElapsed()` | `timerEngine.test.ts` |
| `src/utils/tagColor.ts` | `getTagColor()`, `TAG_PALETTE` | `tagColor.test.ts` |

### 2.4 测试规范

沿用 v0.3.0：Vitest，测试文件与源文件同目录 `xxx.test.ts`，运行 `npm test`。
修改 engines/utils 中的函数必须同步更新测试。

---

## 三、开发排期

| Phase | 内容 | Agent | 预估 |
|-------|------|-------|------|
| Phase 1 | X1-X4 修复 + F4 子项入口 | A | 2-3 天 |
| Phase 2 | F1 计时 + F2 标签 | A | 3-4 天 |
| Phase 3 | F3-a 类型改造 + F3-b Tiptap 富文本（无图片）+ 迁移 | B | 5-7 天 |
| Phase 4 | F3-c 子步骤编辑 + F3-d SOP 链接 | B | 2-3 天 |
| Phase 5 | F3-e 子文件夹 + 右键菜单 + F3-f 新建文件夹 | B | 3-4 天 |

Agent A 和 Agent B **同时启动**，各自从自己的 Phase 1 / Phase 3 开始。

---

## 四、子文档索引

| 文档 | 内容 | 读者 |
|------|------|------|
| `PARALLEL-GUIDE.md` | 文件独占分配表、i18n 协调规则、冲突预防 | 双方必读 |
| `agentA-tasks.md` | Agent A 详细开发规格（X1-X4, F1, F2, F4） | Agent A |
| `agentB-sop.md` | Agent B 详细开发规格（F3-a/b/c/d/e/f） | Agent B |
| `v0.3.1-prd.md` | PM 最终版 PRD | 需要时查阅 |
| `v0.3.1-td-review.md` | TD 审核意见 | 需要时查阅 |

**使用方式**：读本总纲 → 读 `PARALLEL-GUIDE.md` 确认独占文件 → 读自己的 agent 文档 → 按规格执行。冲突以本总纲为准。
