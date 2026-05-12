# Anvilite v0.3 — Claude Code 开发总纲

> **用途**：v0.3 开发主控文档。每次开始任务前先读本文档，再根据任务编号查阅子文档。
> **基准**：v0.2 已发布，v0.3 专注前端打磨，暂缓后端。

---

## 一、v0.3 核心变更

1. **子任务架构重构**：从独立卡片（平铺在 tasks 数组中）改为**内嵌 checklist**（SubTask 嵌在 Task 对象内）
2. **世界地图重构**：从自由画布 + 绝对定位改为 **CSS Grid 卡片网格**
3. **SOP 模板系统**：全新模块，分 MVP + 完整版两期交付
4. **v0.2 遗留项补全**：Error Boundary、跨午夜刷新、Vitest 引擎测试

---

## 二、架构与编码规范

沿用 v0.2 的所有规范（分层依赖、TypeScript 严格模式、零 any、i18n 零硬编码等），以下为 v0.3 新增/变更的要点：

### 2.1 子任务数据模型（v0.3 重大变更）

```typescript
// v0.2（旧）：子任务与父任务平铺在同一个 tasks[] 数组
interface OldTask {
  parentId: string | null
  childIds: string[]
  nestingLevel: number
  // ...
}

// v0.3（新）：子任务内嵌在父任务中
interface Task {
  // ...（移除 parentId, childIds, nestingLevel）
  subTasks: SubTask[]
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

**铁律**：
- `tasks[]` 数组中只存根任务，不再有 `parentId !== null` 的条目
- 子任务的增删改都通过父任务的 `subTasks` 字段操作
- 子任务完成不获得 XP/矿石

### 2.2 习惯子项同步变更

```typescript
interface Habit {
  // ...（移除 parentId, childIds, nestingLevel）
  subHabits: SubHabit[]
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

### 2.3 测试规范（v0.3 新增）

- 框架：Vitest
- 测试文件：与源文件同目录，`xxx.test.ts`
- 运行：`npm test`（单次）/ `npm run test:watch`（监听）
- **修改 engines/ 中的函数必须同步更新测试**
- **新增 store action 需要写对应测试**（至少覆盖正常路径 + 边界值）

### 2.4 数据迁移约定

v0.3 涉及两个迁移：
1. **子任务内嵌迁移**：`taskStore.onRehydrateStorage` 中检查 `MIGRATION_KEY`，未迁移则执行 `migrateToEmbeddedSubtasks()`
2. **世界地图坐标迁移**：`areaStore.onRehydrateStorage` 中将 `position_x/position_y` 转为 `sortOrder`

迁移必须有版本标记，执行一次后不再重复。

---

## 三、v0.3 开发范围

| Phase | 内容 | 时间 |
|-------|------|------|
| Phase 1 | v0.2 遗留补全 + 基础修复 | 1 周 |
| Phase 2 | 子任务重构 + Vitest + 功能改进 | 2-3 周 |
| Phase 3 | 世界地图重构 + 高频行为统计 | 1-2 周 |
| Phase 4 | SOP 模块 MVP（流程型 + 清单型） | 2 周 |
| Phase 5 | SOP 完整版 + 收尾 | 1-2 周 |

---

## 四、子文档索引

| 文档 | 包含任务 | Phase |
|------|---------|-------|
| `phase1-fixes.md` | Error Boundary、跨午夜刷新、fix2/5/8 | 1 |
| `phase2-refactor.md` | Vitest、feature6（子任务重构+迁移）、feature1/2/5、fix6/7 | 2 |
| `phase3-worldmap.md` | feature3（世界地图重构）、feature7（高频行为统计） | 3 |
| `phase4-sop-mvp.md` | SOP 数据模型/Store/目录树/流程型+清单型/编辑器/转任务/i18n | 4 |
| `phase5-sop-complete.md` | 日程型/检查型视图、执行模式、8个系统预设、feature4 | 5 |

**使用方式**：接到任务 → 确认编号 → 读本总纲 → 读对应子文档 → 按规格执行。冲突以本总纲为准。
