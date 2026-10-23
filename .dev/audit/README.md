# 旧版支线验证

首轮“缺陷存在”测试已移入默认回归并改为断言正确行为，不再保留需要故障继续存在的绿色测试。

```powershell
npm test
npm run build
```

六份新增默认回归分别位于 src/utils/legacyDataRegression.test.ts、src/components/layout/legacySettingsRegression.test.ts、src/stores/legacyTaskHabitRegression.test.ts、src/components/sop/legacySopRegression.test.ts、src/test/mainFileAccess.test.ts、src/test/mainFileAtomic.test.ts。

额外浏览器探针：在已有 Playwright 和 Microsoft Edge 的开发环境运行 `node .dev/audit/verify-legacy-ui.cjs`。脚本只用回环静态页面和独立合成上下文，阻止页面外网请求，不启动正式 Electron 或使用用户浏览器资料。结果与截图存 ui-2026-10-22/；该工具没有引入新的 Playwright 安装依赖。

逐项结果和限制见 ../docs/legacy-fixes-2026-10-22.md。首轮历史发现见 ../docs/review-2026-10-22-legacy-branch.md。

待反馈功能的浏览器回归：`node .dev/audit/verify-waiting-ui.cjs`。相同环境要求和隔离规则，覆盖真实拖入/取消、计时暂停、任务列表恢复、文件导出与导入冷重载，以及旧布局保留；四组双语/尺寸结果与八张截图保存至 waiting-ui-2026-10-22/。详细范围与默认测试结果见 [waiting-tasks-2026-10-22.md](../docs/waiting-tasks-2026-10-22.md)。

多任务卡片与底色浏览器验收：`node .dev/audit/verify-task-cards-ui.cjs`。复用已有 Playwright/Edge，独立合成数据、回环页面，结果保存在 task-cards-ui-2026-10-22/。覆盖独立单/多/全部分类、快速及完整创建、优先级及手动底色、新卡片与隐藏恢复、备份重载；详细记录见 [task-cards-2026-10-22.md](../docs/task-cards-2026-10-22.md)。

多习惯卡片与完成任务趋势：`node .dev/audit/verify-habits-trend-ui.cjs`。使用已有 Edge/Playwright 和隔离合成上下文，输出 habits-trend-ui-2026-10-22/；检查精简文案、同名多卡片、习惯分类/奖励同步、完成数量/用时及备份恢复。详细规则见 [dashboard-followups-2026-10-22.md](../docs/dashboard-followups-2026-10-22.md)。

莫兰迪任务底色：`node .dev/audit/verify-morandi-ui.cjs`。使用独立Edge合成上下文，通过真实设置切换8个主题，检查中英/两种尺寸、对比度、预设和自选色、旧hex保留及任务零写入。结果在 morandi-ui-2026-10-22/，详见 [morandi-task-colors-2026-10-22.md](../docs/morandi-task-colors-2026-10-22.md)。

模板与自定义分类：`node .dev/audit/verify-templates-categories-ui.cjs`。使用独立Edge合成上下文，覆盖真实流程拖放、系统菜单/新建/编辑/删除、三级富文本副本、快速分类创建、任务趋势与弹窗简化、文件备份往返及布局/奖励保留。中英×900/1280结果与截图在 templates-categories-ui-2026-10-22/；详见 [templates-categories-2026-10-22.md](../docs/templates-categories-2026-10-22.md)。

任务配色界面精简：`node .dev/audit/verify-templates-categories-ui.cjs --color-drawer-only`仅检查中英/两尺寸的说明和预览移除、选色与恢复自动控件及布局，结果单独写入task-color-simplification-ui-2026-10-22/，保留模板验收报告。

分类标签入口与月周汇总：`node .dev/audit/verify-category-trend-summary-ui.cjs`。独立Edge中检查快速创建无新建分类按钮、任务页标签末尾创建/选中/草稿、月周汇总与实时任务变更、跨月周及宽窄卡布局，使用Europe/Berlin固定合成日期2026-11-01。结果独立写入category-trend-summary-ui-2026-10-23/，规则见 [category-trend-summary-2026-10-23.md](../docs/category-trend-summary-2026-10-23.md)。

月周汇总已按用户后续要求移除。`node .dev/audit/verify-category-trend-summary-ui.cjs --trend-only`仅验证当前热力图无汇总、四种范围/指标组合及中英宽窄界面，输出trend-summary-removal-ui-2026-10-23/；此前汇总报告为历史记录。


去游戏化当前验收：node .dev/audit/verify-degamification-ui.cjs。使用合成旧数据、回环页面和隔离Edge，验证完成/撤销不改旧余额、8主题直切、概览/活动记录/人工纪念、分类真实统计及布局隐藏设置冷恢复。结果与28张截图位于degamification-ui-2026-10-23/，规则和默认658项回归见[去游戏化验收](../docs/degamification-2026-10-23.md)。此前带奖励预期的浏览器报告属于历史阶段，不作为去游戏化后的验收口径。


本机MCP原生链路：node .dev/audit/verify-mcp-native.cjs。要求先npm run build，使用临时合成Electron profile、实际业务renderer、官方stdio Client及Windows管道；涵盖只读/分域授权、任务状态与版本、习惯跨进程去重、流程富文本局部修改及转任务、撤销和reload。报告mcp-native-2026-10-23/report.json；不捕获隐藏窗口截图，凭据不进入报告。独立协议回归npm run mcp:test；完整结果见[本机MCP验收](../docs/mcp-2026-10-23.md)。

## v0.4.0 当前发布验收

此前带活动记录、奖励或月周汇总的探针属于历史阶段；当前里程碑排版以 verify-milestone-personal-layout.cjs 为准。旧数据正式兼容范围为v0.3.0及以后，冻结夹具由generate-release-legacy-fixtures.cjs和release-legacy-scenario.txt从原Git标签生产store生成，对应默认releaseCompatibility.test.ts。

发布包验收运行 node .dev/audit/verify-packaged-release.cjs，前提是已生成release/win-unpacked及两个EXE；需要已有Playwright、Edge和打包工具。脚本只在副本与临时合成profile运行，解包比较发行载荷，验证真实打包版MCP及冷重启。不会执行会修改本机现有安装注册的NSIS安装器；该限制明确记录在发布报告。输出子目录均被Git忽略。
