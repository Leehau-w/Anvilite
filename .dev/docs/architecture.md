# 当前代码结构

核对日期：2026-09-11；版本：0.3.3；基线：b55d380。

## 运行和持久化

src/main.tsx 挂载 React；App.tsx 组织页面、反馈 Provider 和日期刷新。electron/main.ts 创建窗口，preload.ts 暴露 IPC。业务 store 使用 Zustand persist/localStorage；Electron 提供 JSON 保存和同步目录读写。账号切换通过 reload 完成。

## 模块索引

| 范围 | 实际入口（省略 src/ 和扩展名） | 关注点 |
| --- | --- | --- |
| 任务 | components/tasks；stores/taskStore | 完成结算仍在组件；子项内嵌，共用 SubTaskList 编辑排序；撤销入口 utils/taskCompletion |
| 习惯 | dashboard/HabitCard、HabitDrawer、HabitContextMenu；TaskList 内习惯视图；stores/habitStore | 子项复用 SubHabitList；utils/habitCycle 处理周期；lastAction 保存撤销快照 |
| Dashboard | dashboard/Dashboard；stores/dashboardStore | 24 列布局，persist version 3 |
| SOP | components/sop；stores/sopStore；types/sop | Tiptap JSON、嵌套步骤、转任务 |
| 分类/档案馆 | worldmap/WorldMap、interior/InteriorSpace、ArchiveSpace；stores/areaStore | 历史目录名；档案馆特殊视图 |
| 成长 | characterStore、growthEventStore；engines；Heatmap | 多 store 结算，事件关联 |
| 数据恢复 | utils/dataExport、dataSync；electron/main.ts（根目录下） | 全量 JSON 覆盖，未合并 |
| 日期 | utils/time、dateWatcher；engines/habitEngine | 本地日历、周期刷新、UI 更新 |

类型集中在 src/types，文案在 src/i18n，样式变量见 src/index.css。

## 重构建议

先修备份恢复和完成/撤销的数据一致性，再统一任务/习惯操作及子项交互，最后按用户的新设想设计管理面板。不要为共享 UI 提前强行合并任务和习惯的数据模型。

新完成事件通过 entityId 和 completionId 关联，不靠标题。习惯 lastAction 记录完成/跳过和操作前状态，撤销按原始 XP 回退。旧版无快照的习惯无法可靠撤销，界面会提示。任务完成结算仍散布在多个组件，后续可在独立变更中收敛；本轮没有引入跨 store 持久化事务。

## 验证边界

正常配置收集 src/**/*.test.ts，使用 Node 环境。审查回归在 src/stores/reviewRegression.test.ts，直接调用生产 store；内存存储同时接入 window.localStorage，以覆盖实际 hydration。浏览器交互仍需单独验收，不能由 store 测试代替。
