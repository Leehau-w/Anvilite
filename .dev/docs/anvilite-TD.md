# Anvilite · 锻石 — 技术总监交接文档

> **编写日期**：2026-04-15
> **编写人**：前任技术总监
> **用途**：供新任技术总监全面掌握技术架构、已做决策的深层理由、技术债务、工程实践和风险判断

---

## 一、你需要立刻知道的事

### 1.1 项目是什么

Anvilite 是一款游戏化个人生产力 Electron 桌面应用。用户完成任务/习惯 → 获得 XP/矿石 → 角色升级 → 区域繁荣 → 徽章收集。当前为**试用版**，无真实外部用户，团队内部使用。

### 1.2 当前状态

- **v0.2 已发布**，功能基本完整
- **v0.3 方案已批准**，Claude Code 指导文档已产出，尚未开始编码
- 后端（Supabase）推迟到 v0.4，当前纯前端 + localStorage
- 开发方式：**Claude Code（AI agent）驱动**，通过指导文档控制开发质量

### 1.3 最紧迫的三件事

1. **Error Boundary 还没有**。任何组件异常都会导致整个 Electron 应用白屏，用户无法恢复。v0.3 Phase 1 第一任务。
2. **Vitest 测试还没有**。5 个纯函数引擎（XP、等级、繁荣度、徽章、习惯）完全没有测试覆盖，v0.3 要重构子任务架构，没有测试就是盲改。
3. **跨午夜习惯刷新不确定是否已实现**。需要检查代码确认。如果没有，应用跨过 12 点后习惯不会自动重置，直接打断核心循环。

---

## 二、架构全景

### 2.1 技术栈

| 层级 | 技术 | 版本 | 选型理由 |
|------|------|------|---------|
| 运行环境 | Electron | 41.1.0 | 桌面应用需求，localStorage 持久化 |
| 前端 | React | 19.2.4 | 生态成熟 |
| 类型 | TypeScript | 5.9.3 | 严格模式，零 any |
| 状态 | Zustand | 5.0.12 | 零 boilerplate，persist 中间件开箱即用，比 Redux 轻量 |
| 动画 | Framer Motion | 12.38.0 | 声明式 API，AnimatePresence 支持 exit 动画 |
| 样式 | Tailwind + CSS Variables | 3.4.19 | 原子类效率高，CSS Variables 主题切换无运行时成本 |
| 构建 | Vite | 8.0.1 | 快，与 Electron 通过 vite-plugin-electron 集成 |
| 国际化 | 自研 | - | 609 key 规模下无需 i18next，自研方案类型安全更好 |

### 2.2 分层架构

```
types/       → 纯类型定义，零运行时
    ↓
engines/     → 纯函数，零副作用，不 import stores
    ↓
stores/      → Zustand，调用 engines，persist 到 localStorage
    ↓
components/  → React 组件，消费 stores
```

**核心约束**：依赖方向严格单向向下。engines 永远不 import stores，这是确保引擎层可测试、可复用的基础。我在 v0.2 审核中把这条写成了铁律，后续所有开发文档都强调了这一点。如果有人想在 engine 里读 store 数据，正确做法是让调用方传参。

### 2.3 状态管理

9 个 Zustand Store + 1 个纯函数模块：

| Store | 职责 | 特殊说明 |
|-------|------|---------|
| characterStore | 角色等级/XP/矿石/连续天数 | 全局唯一角色 |
| taskStore | 任务 CRUD + 子任务操作 | v0.3 将重构子任务为内嵌模型 |
| habitStore | 习惯 CRUD + 完成结算 + 撤销 | 8 种重复模式，连续/容错机制复杂 |
| areaStore | 区域管理 + 繁荣度 | v0.3 将 position_x/y → sortOrder |
| badgeStore | 徽章获取记录 | |
| decorationStore | 装饰物所有权 | |
| dashboardStore | 仪表盘网格布局 | 24 列 + 44px 行高 |
| settingsStore | 主题/语言 | |
| growthEventStore | 成长事件流水 | 只增不减，是 localStorage 容量的主要消费者 |
| inspirationStore | 灵感记录 | v0.2 新增 |
| accountManager | 多账号 | **非 Store**，纯函数 + 直接 localStorage 操作，避免循环依赖 |

所有 Store 使用 `persist` 中间件，key 格式 `${getStoragePrefix()}-storeName`。`getStoragePrefix()` 根据当前账号返回 `anvilite`（默认）或 `anvilite-{uuid}`（新账号）。

### 2.4 数据持久化

localStorage，通过 Zustand persist 中间件自动序列化/反序列化。

**数据迁移**全部在 `onRehydrateStorage` 回调中处理：

```typescript
onRehydrateStorage: () => (state) => {
  if (!state) return
  // 新增字段兼容
  state.items.forEach(item => {
    item.newField = item.newField ?? defaultValue
  })
  // 版本迁移
  if ((state.someVersion ?? 0) < 2) {
    // 执行迁移逻辑
    state.someVersion = 2
  }
}
```

这个模式贯穿整个项目。v0.3 的子任务重构和世界地图坐标迁移也在这里做。任何新增字段都必须在这里加 `?? defaultValue`，否则旧数据会崩。

### 2.5 5 个引擎

| 引擎 | 核心函数 | 复杂度 |
|------|---------|--------|
| xpEngine | `calculateTaskXP(task, streakDays)` → `{xp, ore}` | 中。阶梯式连续加成、频率折算、高难度/按时加成，先乘后统一 round |
| levelEngine | `xpForLevel(level)` → 升级阈值（`5 × ln(level+1) × level`）；称号映射 | 低 |
| prosperityEngine | `skillXPToLevel(xp)` → 技能等级；技能等级 → 繁荣等级（6 级映射） | 低 |
| badgeEngine | `checkBadges(inputs)` → 新解锁 badge ID 列表 | 中。31+ 枚徽章，8 个类别的条件检测 |
| habitEngine | `isHabitDueToday(habit, date)`；连续计算（完成+1/跳过-10%/缺席-50%）；容错充能 | **高**。8 种重复模式 × 连续/容错/灵活次数逻辑交织 |

habitEngine 是最复杂的引擎，也是最需要测试覆盖的。月固定日期的月末边界处理（设定 31 号，2 月按 28/29 号触发）是一个容易出 bug 的点。

---

## 三、我做过的关键决策和背后的理由

### 3.1 v0.2 审核：版本范围控制

**决策**：把 PM 原方案中的后端（Supabase）、Web 版、社交功能从 v0.2 拆出到 v0.3+。

**理由**：PM 把至少三个版本的工作量塞进了一个版本号。前端 Phase 1 的 bug 修复会被后端架构需求倒逼——"这个修法跟 Supabase 兼容吗？"这种犹豫会拖慢每一个简单决策。拆开后每个版本有明确的交付边界。

**结果**：后续 v0.3 PM 主动写了"暂缓后端开发"，说明这个决策被认可了。

### 3.2 v0.2 审核：XP 公式追溯重算

**决策**：v0.2 修改 XP 公式时做全量追溯重算（遍历所有完成记录用新公式重新累加）。

**限制条件**：**仅限试用阶段**。我在审核意见中明确写了"如果 v0.3 后有真实用户，后续公式调整不得追溯重算"。正式上线后改公式只能"新公式向前生效 + 旧数据保留"。

**理由**：试用版没有真实用户数据需要保护，追溯重算能保证数据一致性更干净。

### 3.3 v0.3 审核：子任务内嵌方案

**决策**：SubTask 内嵌在 Task 对象中（`Task.subTasks: SubTask[]`），而非与 Task 平铺在同一数组。

**理由**：
1. SubTask 字段极简（id/title/completed/sortOrder），内嵌不会造成序列化性能问题
2. 父子关系天然体现在数据结构中，不需要 `parentId` 反向查找
3. 删除父任务时子项自动级联（不需要 BFS 收集子孙）
4. 与 SOP 的 `SOPStep` 结构一致（也是内嵌），SOP 转任务时映射自然

**权衡**：平铺方案的优势是与 v0.1/v0.2 结构兼容（迁移简单），但会导致两种类型混存、代码中大量类型守卫。长期维护成本更高。

### 3.4 v0.3 审核：SOP 分两期交付

**决策**：MVP（流程型 + 清单型）先交付，完整版（日程型 + 检查型 + 执行模式 + 系统预设）后交付。

**理由**：SOP 是一个从零开始的完整模块（12+ 新文件），PM 原方案标注 2-3 周但范围偏大。分两期后 MVP 先交付可用版本，如果工期紧张至少有东西能用。

### 3.5 v0.3 审核：feature7 模糊匹配缩减

**决策**：高频行为统计只做"去数字/序号后的精确匹配"，不做前缀模糊。

**理由**：PM 原方案的"前缀匹配 70% 或最少 4 字符"会产生大量误判——"阅读论文"和"阅读小说"会被归为同组。要做准确的模糊匹配需要 token 化 + 相似度阈值，这在 v0.3 的纯前端架构里不值得引入。

### 3.6 暂缓后端的 LWW 冲突策略标注

**决策**：在 v0.2 审核中明确标注 Last-Write-Wins 对生产力应用不可接受，v0.4 设计阶段必须重新评估。

**具体场景**：用户在手机离线完成三个任务，同时在电脑编辑任务标题。恢复网络后 LWW 可能用电脑的编辑覆盖手机的完成记录。对生产力工具来说，丢失完成记录是致命的。

**要求**：至少"完成任务""获得徽章""获得 XP"等不可逆操作用 append-only 合并；"编辑标题""调整排序"等可逆操作可以 LWW。

---

## 四、技术债务清单

### 4.1 必须在近期偿还的

| # | 债务 | 风险 | 偿还计划 |
|---|------|------|---------|
| 1 | **无 Error Boundary** | 任何组件异常 → 全应用白屏 | v0.3 Phase 1，P0 |
| 2 | **无测试** | 改引擎/store 逻辑全靠人肉验证 | v0.3 Phase 2，Vitest + 5 个引擎测试 |
| 3 | **跨午夜不刷新（疑似）** | 习惯核心循环断裂 | v0.3 Phase 1 检查并修复 |
| 4 | **growthEvent 只增不减** | localStorage 5MB 上限，活跃用户几个月撞线 | v0.2 已做容量监控 + 95% 自动清理（保留 500 条），但治标不治本，v0.4 迁移 Supabase 才彻底解决 |

### 4.2 可以容忍但要注意的

| # | 债务 | 说明 |
|---|------|------|
| 5 | accountManager 非 Store | 纯函数 + 直接操作 localStorage，绕开了 Zustand。当初是为了避免循环依赖，但如果后续需要多账号状态联动会受限 |
| 6 | 切换账号用 reload | 简单但粗暴。9 个 Store 在 module 初始化时读取 prefix，切换账号必须 reload 重新初始化。热切换需要改所有 Store 的初始化逻辑，复杂度高，目前不值得 |
| 7 | `estimatedMinutes` 废弃字段 | v0.3 UI 层删除预估时间，但数据模型中保留字段。不影响功能，但长期是噪声 |
| 8 | preload 强制 CJS | Electron 不支持 ESM preload，Vite 默认输出 ESM 会导致窗口控制失效。`vite.config.ts` 中 preload 构建必须配置 `lib.formats: ['cjs']`，不能随便改 |
| 9 | 自研 i18n | 609 key 规模下足够，但如果后续要做复数形式、日期格式本地化、RTL 语言支持，就需要换 i18next 或类似方案。目前中英双语没有这个需求 |

### 4.3 v0.3 重构会产生的新债务

| # | 债务 | 说明 |
|---|------|------|
| 10 | Area 保留 position_x/y 废弃字段 | 世界地图重构后只用 sortOrder，旧字段保留避免复杂迁移 |
| 11 | 世界地图旧代码完全丢弃 | v0.1 投入的画布自动缩放、鼠标拖拽、ResizeObserver 逻辑全部废弃。产品判断卡片网格更好，但如果后续想恢复自由布局需要从 git 历史翻 |

---

## 五、反复出现的 Bug 模式

以下 bug 在项目中多次出现，每次新建组件都要警惕：

### 5.1 Framer Motion transform 覆盖 CSS transform

**模式**：给一个元素同时用 CSS `transform: translate(-50%, -50%)` 做定位，又用 Framer Motion 的 `animate={{ scale, opacity }}` 做动画。Motion 执行动画时会整体替换 `transform` 属性，覆盖 CSS 的定位 transform。

**表现**：弹窗偏移、元素不居中、动画中途位置跳变。

**解法**：CSS 定位放外层 `<div>`，`motion.div` 放内层只做动画。

**出现过的地方**：装饰商店弹窗、高难度确认弹窗、StreakMilestonePopup 的 FloatingBadge、LevelUpCelebration。几乎每个需要居中 + 动画的场景都踩过。

### 5.2 useEffect 闭包陈旧引用

**模式**：`useEffect` 依赖数组不完整，定时器或事件回调捕获了旧版 props/state。

**表现**：自动关闭计时器调用旧版 `onDismiss`；`titleChanged` 为 true 时计时器仍用旧时长。

**解法**：依赖数组必须包含回调函数和所有条件变量。ESLint 的 exhaustive-deps 规则应该开启（目前没开，这也是技术债）。

### 5.3 render 期间调用 Math.random()

**模式**：粒子效果组件在渲染期间直接 `Math.random()` 生成参数。每次父组件重渲染，随机值重新生成，粒子位置跳变闪烁。

**解法**：用 `useMemo(() => [...], [count])` 缓存粒子参数。

### 5.4 overflow: hidden 裁剪边框

**模式**：容器设了 `overflow: hidden`，子元素的左侧边框或阴影被裁掉。

**解法**：给容器加 `paddingLeft: 4`（或对应方向的内边距）。不能改成 `overflow: visible`，那会破坏 flex 子元素高度约束导致滚动失效。

### 5.5 UTF-16 代理对取字符

**模式**：`string[0]` 对 emoji 字符（如 🏘）只取到第一个 surrogate，无法命中 Map key。

**解法**：用 `[...string][0]` 解构。

---

## 六、工程实践

### 6.1 开发方式

项目使用 **Claude Code** 作为主要开发工具。我建立了一套文档驱动的开发流程：

```
PM 出方案 → 技术总监审核出意见 → PM 修订 → 批准
    ↓
产出 Claude Code 指导文档（OVERVIEW + Phase 子文档）
    ↓
指定任务编号 → Claude Code 读文档 → 按规格实现
```

每个子文档包含：实现规格（含代码片段）、影响文件列表、验收标准（checkbox）。这种结构化指令能让 AI agent 产出质量稳定的代码。

v0.3 还制定了**多 agent 并行方案**（`PARALLEL-GUIDE.md`），Phase 3 和 Phase 4 可双终端同时开发，文件独占分配明确，i18n 文件用"先 commit 先得"协调。

### 6.2 质量门禁

| 检查 | 命令 | 标准 |
|------|------|------|
| 类型检查 | `tsc --noEmit` | 零错误 |
| 测试 | `npm test` | 全通过（v0.3 起） |
| 零 any | TypeScript strict | 编译器强制 |
| 零硬编码中文 | 代码审查 | 组件中无中文字面量 |
| i18n 一致性 | TypeScript 类型推导 | zh/en key 数量和类型完全匹配 |

建议后续补充的门禁：ESLint exhaustive-deps、import 顺序、文件命名规范 lint。

### 6.3 Git 规范

分支命名：`v03/feature6-subtask-refactor`、`v03/fix2-heatmap`

提交信息：`[编号] 类型: 简述`
```
[feature6] feat: refactor subtasks to embedded checklist model
[fix2] fix: correct heatmap time slot calculation
[TEST] test: add vitest config and engine unit tests
```

### 6.4 文档体系

| 文档 | 位置 |
|------|------|
| 用户指南 | `docs/user-guide.md` |
| 更新日志 | `docs/CHANGELOG.md` |
| v0.2 开发文档 | `docs/v0.2/`（6 个文件） |
| v0.3 开发文档 | `docs/v0.3/`（7 个文件，含并行指南） |
| v0.1 历史 | git 归档，`git show 624caa8:docs/v0.1_history/` |
| PM 审核意见 | `anvilite-v02-review.md`、`anvilite-v03-review.md` |
| 项目交接 | `anvilite-project-handover.md`（PM 版） |

---

## 七、v0.3 执行建议

### 7.1 优先级判断

如果工期紧张需要砍需求，按以下优先级保留：

| 优先级 | 任务 | 理由 |
|--------|------|------|
| 必须做 | Error Boundary + 跨午夜 + Vitest | 基础工程保障，不做后续所有开发都有风险 |
| 必须做 | feature6 子任务重构 | v0.3 核心目标，fix1/3/4 全部依赖它 |
| 应该做 | 世界地图重构 | 产品方向已定，早做早了 |
| 应该做 | SOP MVP | 新功能亮点，但独立性高，延期不影响现有功能 |
| 可以延 | SOP 完整版 | 日程型/检查型/执行模式/系统预设可以 v0.4 再做 |
| 可以延 | feature4 hover 交互 | 等 PM 设计稿，不阻塞 |
| 可以延 | feature7 高频行为统计 | 档案馆的锦上添花功能 |

### 7.2 风险最高的两个任务

1. **feature6 子任务重构**：改动面最广（types + stores + 6+ 个组件），数据迁移逻辑必须正确否则用户丢子任务。建议先写迁移函数的测试，再动手重构。
2. **feature3 世界地图重构**：整个模块重写，旧代码全部废弃。如果做到一半发现卡片网格体验不好想退回，恢复成本极高。建议先做一个最小可用版本验证体验。

### 7.3 我留给你的开放问题

| # | 问题 | 我的倾向 | 你需要判断 |
|---|------|---------|-----------|
| 1 | v0.4 后端选型是否坚持 Supabase | 当前方案用 Supabase，选型理由充分（PostgreSQL 关系型匹配数据模型、开源不锁定、免费额度够）。但如果团队后续有 Firebase 经验或偏好，可以重新评估 | 在 v0.3 完成前不需要决定 |
| 2 | 是否引入 ESLint 严格规则 | 应该引入 exhaustive-deps 规则。目前闭包陈旧引用的 bug 已出现多次。但要控制规则数量，不做过度配置 | 可以在 v0.3 Vitest 引入时一并配置 |
| 3 | i18n 方案是否需要换 | 当前自研方案在 609 key + 中英双语的规模下完全够用且类型安全。但如果未来要支持日语/韩语或 RTL 语言，需要换成 i18next | 取决于产品国际化规划 |
| 4 | 是否需要 CI/CD | 当前没有。如果团队扩大或需要自动化发布，建议用 GitHub Actions 跑 `tsc --noEmit` + `vitest` + `electron-builder` | 团队规模决定 |

---

## 八、关键文件速查

### 8.1 改动频率最高的文件

| 文件 | 改动原因 | 风险等级 |
|------|---------|---------|
| `src/stores/taskStore.ts` | 任务相关的所有功能都经过它 | 高 |
| `src/stores/habitStore.ts` | 习惯逻辑最复杂（8 种模式 + 连续 + 容错） | 高 |
| `src/stores/characterStore.ts` | XP/等级/矿石结算 | 中 |
| `src/components/tasks/TaskItem.tsx` | 任务卡片，交互最密集的组件 | 中 |
| `src/i18n/zh.ts` | 几乎所有功能变更都需要加 key | 低（但合并冲突频繁） |
| `src/App.tsx` | 路由 + 全局 Provider | 中 |

### 8.2 容易被忽略但很重要的文件

| 文件 | 为什么重要 |
|------|-----------|
| `electron/preload.ts` | 必须编译为 CJS，改构建配置时极易遗漏 |
| `src/stores/accountManager.ts` | 非 Store 实现，直接操作 localStorage，所有 Store 的 persist key 依赖它的 `getStoragePrefix()` |
| `src/index.css` | 8 套主题的完整 CSS Variables 定义，新增主题色必须在这里改 |
| `src/hooks/useProsperityWatcher.ts` | 监听区域繁荣度变化 + 档案馆特殊处理，逻辑不直观 |

### 8.3 代码仓库

`https://github.com/Leehau-w/Anvilite`

---

## 九、与 PM 的协作备忘

- PM 方案需要经过技术总监审核再执行。v0.2 和 v0.3 都走了"PM 出方案 → 审核 → 修订 → 批准"的流程
- PM 倾向于把很多功能塞进一个版本，技术总监需要控制范围、拆分 Phase、标注阻塞项
- feature4（hover 交互）等了两个版本还没有设计稿，需要主动推动
- PM 对后端有较强意愿（v0.2 方案就包含了完整的 Supabase Schema），但当前共识是先打磨前端

---

*Anvilite · 锻石 — 技术总监交接文档*
*前任技术总监 · 2026-04-15*
