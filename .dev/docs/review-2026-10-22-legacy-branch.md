# 旧版新支线代码审查 — 2026-10-22

> 后续状态：12 项问题已在本支线完成修复与回归，见[修复验收](legacy-fixes-2026-10-22.md)。下文保留修复前证据；临时缺陷断言已迁入默认正确行为回归。

## 起点与结论

用户要求从大改和重构前的版本分出新支线，先审查。本次基线为 `18a9108acd30ad1989d1f128a9f1233b89c9bef4`（2026-09-11，版本号仍为 0.3.3）。

- 新分支：`codex/legacy-review`。
- 独立工作目录：`C:\Users\surpass\.codex\worktrees\legacy-review\Anvilite`。
- 原工作目录 `D:\Project\Anvilite` 继续留在 main；未提交工作台源码没有复制、暂存、覆盖或回退。
- 本轮只增加审查报告和隔离复现测试，未修生产代码、改版本、提交、推送或发布。
- 发现 12 项问题：6 项 P1、6 项 P2。P1 优先处理数据丢失、错误扣奖、备份校验和写入权限；并不表示已证明真实远程攻击或真实双实例事故。

## P1

### R01 损坏的习惯周期能通过导入，重载后今日列表抛错

位置：`src/utils/backupValidation.ts:50–55`；下游 `src/engines/habitEngine.ts:23–24`、`src/components/dashboard/HabitCard.tsx:26`。

触发：导出合法的每周固定日期习惯，将 `weeklyDays` 改为 `{}`，再导入。校验没有检查此字段，解析和写入均返回成功；重新 hydrate 后 `getTodayHabits()` 调用 `.includes` 抛错。用户有效存档被无效状态替换，习惯卡片无法正常读取。

证据：`data-review.test.ts` 调用真实导出、解析、导入、hydrate 和生产 selector，已复现。验收：周期参数的类型、范围和相互关系必须在任何写入前完整验证；失败保持所有原切片。

### R02 撤销习惯完成覆盖之后的子项编辑

位置：`src/stores/habitStore.ts:265–270`；编辑入口 `src/components/dashboard/HabitDrawer.tsx:391–422`。

触发：完成习惯后修改子项标题、添加新子项，再撤销完成。`...action.before` 恢复整个旧 `subHabits` 数组，后续修改的文字和新增子项都消失。

证据：`task-habit-review.test.ts` 直接调用生产完成、编辑、新增和撤销 action，已复现。验收：撤销那次完成仅恢复执行状态及相应计数，保留之后的结构和文字编辑；并验证删除、重排与多层子项。

### R03 删除完成任务后恢复，可再次扣同一笔 XP

位置：`src/components/tasks/TaskItem.tsx:237–241`；`src/stores/taskStore.ts:152`；`src/utils/taskCompletion.ts:6–13`。

触发：完成任务有 3 XP 奖励、角色共有 103 XP。删除完成任务先扣至 100，但任务仍保留 `done` 和 `xpReward=3`；从回收站恢复，再撤销完成，会扣至 97。也可以通过恢复后再删除重扣。

证据：`task-habit-review.test.ts` 调用实际 TaskItem 删除处理函数及真实 store/撤销函数，已复现 103→100→97；React 生命周期在该探针中被替换，没有实测浏览器点击。

验收：完成、删除、恢复、撤销的奖励所有权需一致；同一次奖励最多撤回一次，不能扣到其他记录的经验值。

### R04 仅包含流程链接的详情被当作空内容保存

位置：`src/components/sop/SOPRichEditor.tsx:88–91`。

触发：步骤详情只插入一个关联流程，没有普通文字。`sopLink` 是无文本 atom，`doc.textContent` 为空；生产更新回调因此调用 `onChange(null)`。编辑器看似已插入链接，父级保存的却是空详情，重开会丢失。

证据：`sop-review.test.ts` 使用实际编辑扩展构建 schema/document，并调用生产 onUpdate 回调，已复现。验收：判空需识别有效非文字内容，纯链接、含链接段落和删除链接分别覆盖。

### R05 同步读写接口信任调用方指定的根目录，且不验证调用窗口

位置：`electron/main.ts:29–34,117–136`；桥接入口 `electron/preload.ts:12–15`。

触发：取得该桥接能力的调用方可以指定任意根目录和 JSON 相对路径。宿主只验证“目标位于传入根目录内”，没有保存或核对原生选目录的授权，也没有检查事件发送者/主 frame/文档。接口允许读取或覆盖进程有权限访问的 JSON 文件。

证据：`ipc-review.test.ts` 调用实际注册的处理函数，以错误发送者和未选择的目录，在全部模拟的 fs 中读写成功；未访问真实文件，未证明任意外部网页可取得该桥或已存在远程利用链。

验收：宿主绑定合法窗口/frame/文档和明确选中的目录，调用方不得自行扩大读写根；失败不能执行文件操作。

### R06 共享账号键变化后，旧窗口可把导入写入另一个账号（条件性）

位置：`src/utils/dataExport.ts:43,164–187`；对照 `src/stores/taskStore.ts:492`、`src/stores/accountManager.ts:75–77`。

触发前提：仍绑定账号 A 的旧窗口存活，而共享 `anvilite-current-account` 已由另一个实例改为 B。stores 的持久化前缀在加载时固定；导出标签和导入目标却动态读取这个共享键。结果是 A 数据被导出为 B 身份，或旧窗口导入覆盖 B 的记录。

证据：`data-review.test.ts` 在内存中模拟共享键改变，实际验证 B 切片被 A 导入内容覆盖。真实双实例、Chromium 存储同步和并发时序未实测；本项结论限于该前提成立时的账号绑定错误。

验收：操作账号和已加载 stores 必须绑定一致；共享账号失效后拒绝旧窗口导出、导入与同步，不能静默切换写入目标。

## P2

### R07 旧备份恢复留下当前 SOP 和灵感，形成混合存档

位置：`src/utils/dataExport.ts:180–187`；用户承诺 `docs/user-guide.md:279`。

触发：当前已有 SOP、灵感，导入缺少这两个可选切片的 v0.2 备份。`value === undefined` 直接跳过，恢复和重载后原记录仍存在，与指南“流程和灵感数据将为空”不一致。

证据：`data-review.test.ts` 真实导入和 hydrate 已复现。验收：明确旧备份缺省切片的恢复语义，若保持现有文档约定，则空切片也要纳入统一写入和失败回滚。

### R08 同步文件异常不能解除忙碌状态

位置：`electron/main.ts:134–135`；`src/utils/dataSync.ts:83`；`src/components/layout/SettingsModal.tsx:134–137`。

触发：磁盘写满、目录不可写等文件操作抛错时，IPC Promise 拒绝。工具层没有转换为失败结果；界面在 await 前设置 `syncBusy=true`，之后也没有 finally，异常路径无法清除忙碌状态和给出正常失败反馈。

证据：`data-review.test.ts` 用模拟原生写入拒绝复现工具层异常逃逸；按钮持续禁用的界面后果为静态确认。验收：所有失败路径清理忙碌状态，反馈准确，保留重试能力。

### R09 没有选中流程时，新建流程打开空白内容区

位置：`src/components/sop/SOPPage.tsx:64–81`。

触发：首次进入或当前无选中 SOP，点击文件夹内“新建流程”。创建状态已设置，但 `if (!selectedSOP) return null` 在创建分支前直接返回，没有渲染表单；随后选一个系统模板才会显示已请求的编辑器。

证据：`sop-review.test.ts` 实际合成 DOM 点击，新建后 0 个输入框，选模板后出现输入框。验收：创建分支不依赖已选中的已有流程。

### R10 日程风格遗漏三级步骤

位置：`src/components/sop/SOPStepListView.tsx:247–250`。

触发：同一份三级 SOP 切为日程风格。该视图只 map 一层 childSteps，没有递归渲染孙步骤。编号风格显示三层，日程风格只显示两层；进度统计仍按递归全部步骤计算。

证据：`sop-review.test.ts` 真实组件渲染：编号模式 3 个 checkbox 且包含三级文本，日程模式 2 个且三级文本缺失。验收：支持深度在各风格完整可见、可勾选，统计和实际可执行节点一致。

### R11 流程详情里的关联流程链接无法跳转

位置：`src/components/sop/SOPStepListView.tsx:138–144`；`src/components/sop/SOPLinkNode.ts:20–27`。

触发：点击已保存且含普通文字的关联流程链接。实际渲染属性是 `sopid`，点击处理却读取 `data-sopid`，永远取不到目标。

证据：`sop-review.test.ts` 核对实际 DOM 属性并点击，选中的流程 ID 保持不变。验收：节点输出和点击读取使用同一属性，并验证有效、失效及系统流程引用。

### R12 缺席处理未接入实际周期刷新

位置：`src/utils/habitCycle.ts:19–43`；`src/stores/habitStore.ts:306`；指南既有规则 `docs/user-guide.md:114` 附近。

触发：每日习惯漏做一天，隔日继续。刷新只重置周期数据，没有生产入口调用 `missHabit`。连续次数不下降，容错次数不消耗，随后完成仍继续累加。

证据：`task-habit-review.test.ts` 固定时钟：9/11 连续 11、容错 1，9/12 漏做，9/13 刷新仍为 11/1，再完成变为 12。验收前应明确保留或调整指南记载的既有规则；本审查不授权新增惩罚规则。

## 验证与限制

- `npm test`：18 文件、210 项通过。
- `npm run build`：app 和 node 类型检查通过，前端及 Electron 入口构建通过。原有 alias/customResolver、freeze、Browserslist、动态/静态混合导入、大 chunk 及插件耗时告警保留。
- `node node_modules/vitest/vitest.mjs run --config .dev/audit/vitest.config.ts`：4 文件、13 项通过。**这里的通过表示明确复现旧版缺陷，并非生产行为已正确或问题已修复。**
- 依赖通过目录 junction 复用原工作目录的现有 node_modules，没有下载、安装、修改锁文件。Vite 8.0.3、Vitest 4.1.2、React 19.2.4、Zustand 5.0.12 与基线锁定值相同；Tiptap Core 实装 3.31.3，基线锁定 3.22.3。不是原发布依赖集合的完全复刻。
- 只用内存 store、合成 DOM、模拟文件 API。没有启动正式用户 profile、读取私人数据、访问云盘、真实账号、真实同步目录，未进行安装/升级或完整原生窗口验收。
- 没有联网做依赖漏洞清单审计。本次审查不是全仓无遗漏或可立即发布的保证。

## 建议的后续顺序

1. 先处理 R01–R06：数据覆盖/丢失、奖励一致性、导入与宿主写入权限；把本轮证据改写成断言正确行为的回归测试。
2. 再处理 R07–R11：恢复语义、同步失败收尾和 SOP 主流程。
3. R12 先确认既有缺席规则；按明确规则补跨日、离线多日和不同周期验收。
4. 在上述稳定后再规划新支线的功能与界面，不带入未提交工作台的数据库或 AI 改造。
