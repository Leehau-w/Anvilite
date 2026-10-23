# 当前代码结构

核对日期：2026-10-23；当前为基于 18a9108（v0.3.3）的 codex/legacy-review，v0.4.0发布准备；与main未提交工作台改造隔离。

## 运行和持久化

src/main.tsx 挂载 React；App.tsx 组织页面、反馈 Provider 和日期刷新。electron/main.ts 创建窗口，preload.ts 暴露 IPC。业务 store 使用 Zustand persist/localStorage；Electron 提供 JSON 保存和同步目录读写。账号切换通过 reload 完成。

## 模块索引

| 范围 | 实际入口（省略 src/ 和扩展名） | 关注点 |
| --- | --- | --- |
| 任务 | components/tasks；stores/taskStore | 完成与撤销及对应真实历史集中在 store；子项内嵌，共用 SubTaskList 编辑排序；UI撤销入口 utils/taskCompletion |
| 习惯 | dashboard/HabitCard、HabitDrawer、HabitContextMenu；TaskList 内习惯视图；stores/habitStore | 子项复用 SubHabitList；utils/habitCycle 处理周期；lastAction 保存撤销快照 |
| Dashboard | dashboard/Dashboard；stores/dashboardStore | 24 列布局，persist version 3 |
| SOP | components/sop；stores/sopStore；types/sop | Tiptap JSON、嵌套步骤、转任务 |
| 分类/档案馆 | worldmap/WorldMap、interior/InteriorSpace、ArchiveSpace；stores/areaStore | 历史目录名；档案馆特殊视图 |
| 里程碑/个人数据 | growthEventStore；milestone/MilestoneHall、SkillRadarChart；interior/ArchiveSpace；Heatmap | 里程碑只展示个人纪念和人工标记；档案馆保留日常历史；能力图谱/个人数据使用真实业务统计，旧奖励仅兼容存储 |
| 数据恢复 | utils/dataExport、dataSync；electron/main.ts（根目录下） | 全量 JSON 覆盖，未合并 |
| 日期 | utils/time、dateWatcher；engines/habitEngine | 本地日历、周期刷新、UI 更新 |

类型集中在 src/types，文案在 src/i18n，样式变量见 src/index.css。

## 重构建议

先修备份恢复和完成/撤销的数据一致性，再统一任务/习惯操作及子项交互，最后按用户的新设想设计管理面板。不要为共享 UI 提前强行合并任务和习惯的数据模型。

新完成事件通过 entityId 和 completionId 关联，不靠标题。任务完成、习惯完成及跳过由 store 写入真实事件，UI不重复添加。习惯 lastAction 保留操作前周期、次数、用时与子项快照；旧版无快照的习惯不能推测撤销。完成、撤销和任务删除在持久化异常时回滚本次实体与对应事件，允许重试；这不等于跨进程崩溃的持久事务。

称号、成就、经验、矿石及等级运行逻辑已停用；旧 character/badges 字段和纯奖励事件保留供旧版备份往返，hydrate不重算。新事件不记录奖励字段，旧奖励API为无副作用兼容入口。App不再挂载奖励观察器或庆祝Provider；旧engine和未挂载组件保留，不作无关目录重构。

主题直接开放全部8种。原character首页卡片继续使用同一ID、位置与隐藏设置，内容改为概览；task/habit多卡筛选和旧备份缺布局字段时的保留规则不变。分类真实统计由utils/activityStats与areaStats提供；任务趋势仍基于有效done主任务和实际分钟数。

## 本机 MCP

main.tsx在React StrictMode之外、7个相关store完成hydration后安装mcp/rendererBootstrap。electron/main.ts的LocalMcpBridge默认关闭，只在设置明确启用后创建有凭据的本机named pipe；stdio server位于独立mcp/包，经官方SDK提供19个Tools，不开放TCP、通用脚本或底层存储接口。

主进程只允许当前可信main frame；每次请求检查域权限、绑定账号/文档session与lease。重载、崩溃、关闭及换号撤销旧会话；权限更改轮换连接凭据。renderer卸载与相关storage变化设置不可通过重新授权清除的本页失效标记。

mcp/service复用现有store actions，写入队列在renderer内串行。expectedVersion覆盖完整业务内容、会话、日期、分类及本机持久状态的opaque摘要，摘要原始资料不会返回给agent。版本计算await之后再次校验lease、权限、内存和持久基准，拒绝导入或其它更新后旧内存继续覆盖。流程步骤通过ID合并；习惯操作显式校验周期与状态。

操作前先在账号隔离的mcp-receipts侧存储写pending意图，确认业务持久化后写committed及结果。同requestId不同参数拒绝，已成功回执只重放原结果。未知结果保留pending并暂停该renderer session新写入；operations_get继续按原domain读取回执。普通备份不含MCP凭据和回执，新会话版本失效保护旧连接；无跨应用崩溃的原子事务保证。首版上限2000回执，满额停止新写入而不静默清除去重记录。

独立依赖安装在mcp/node_modules，避免改动本支线根node_modules junction指向的主checkout。build-mcp将官方SDK打包为dist-mcp/server.cjs；开发配置使用当前Electron运行时的Node模式，打包配置从resources/mcp加载该产物。打包运行与安装包载荷验收见v0.4.0发布记录；实际覆盖安装未在现有用户机器上执行。

## 验证边界

正常配置收集 src/**/*.test.ts，使用 Node 环境。审查回归在 src/stores/reviewRegression.test.ts，直接调用生产 store；内存存储同时接入 window.localStorage，以覆盖实际 hydration。浏览器交互仍需单独验收，不能由 store 测试代替。
