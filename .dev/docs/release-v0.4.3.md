# v0.4.3 发布记录

日期：2026-10-29（Europe/Berlin）。用户明确要求删除思维导图节点标题下的保存按钮，并将当前支线修改打包发布到 GitHub。本次按 v0.4.2 后的补丁版本 v0.4.3 交付，包含该版之后已完成的全部界面改进。来源为 codex/legacy-review，不合并 main，不带入 D 盘 main 工作区的未提交改造。

## 发布内容

- 思维导图分支可拖到中心节点另一侧空白区域换边；嵌套分支可提升为根分支，保留整支后代、折叠状态和任务/子任务引用。保留原生节点间拖动，取消及画布外落点不保存，实际任务归属保持。
- 右侧节点标题按 Enter 保存，Shift+Enter 换行，保留输入法组合输入和修订冲突检查；删除标题下的保存按钮、任务联动说明及画布操作提示。
- 底栏简化为“今日完成 x 用时 x”，超过60分钟换算为时/分，保留原统计范围和一位小数规则。
- 分类卡片、分类详情和档案馆分类汇总统一使用同样的本地化时/分格式，仅改变展示。
- 应用版本更新为 0.4.3，MCP 独立版本不变。无数据结构迁移，继续支持 v0.3.0 及以后版本，沿用此前兼容与备份规则。

## 已有验证证据

本轮删除按钮后的回归及此前各功能验收如下：

- 2026-10-29删除标题保存按钮后，导图UI既有21项通过，全量71文件/1040项通过；Enter保存、Shift+Enter换行、输入法和任务标题同步继续使用原表单路径。
- 2026-10-29发布构建隔离Edge中/英×900×600/1280×800四组/四张截图通过：节点标题保存按钮不存在，普通/任务/子任务Enter保存、Shift+Enter、IME、提示移除及底栏用时边界均正常，无页面错误。脚本为`.dev/audit/verify-mindmap-editor-statusbar-ui.cjs`，本轮生成目录为`.dev/audit/release-0.4.3-editor-ui-2026-10-29/`，已核对浅/深主题截图。
- 分支换边完成时，全量 71 文件 / 1037 项及 app/node 类型检查、应用/主进程/preload/MCP 构建通过；隔离 Edge 中英文、最小/常用窗口、浅/深主题4组通过，覆盖换边、嵌套分支、折叠、重载、取消及原生节点间拖动。
- 标题 Enter 与底栏改进完成时，全量 71 文件 / 1040 项、app/node 类型检查及应用/MCP 构建通过；隔离 Edge 4组验证标题、关联任务/子项同步、Shift+Enter、IME及0/60/61/90分钟显示。
- 分类格式完成时，既有分类 UI 11项、app/node 类型检查及应用/MCP 构建通过；隔离 Edge 4组/12截图覆盖0/60/61/90/120分钟、分类详情及档案馆汇总，任务业务记录完整JSON保持。该次未重复全量测试。
- 上述浏览器验证均使用合成数据和隔离上下文，没有访问或覆盖真实账号数据。

明细见[分支换边](mindmap-side-drag-2026-10-28.md)、[标题编辑与底栏](mindmap-editor-statusbar-2026-10-28.md)、[分类用时](category-time-2026-10-28.md)和[v0.3+兼容性验收](release-compatibility-2026-10-23.md)。

## 发布状态

版本v0.4.3，源码以codex/legacy-review的v0.4.3标签对应提交为准。正式发布状态及附件以[GitHub Release](https://github.com/Leehau-w/Anvilite/releases/tag/v0.4.3)为准；保留v0.4.2及更早标签和资产，不合并main。

`npm run pack`已成功（exit 0）：app/node类型检查、应用/主进程/preload/MCP构建、Windows x64 NSIS安装版及便携版均完成。根package/lock、包内package及exe FileVersion/ProductVersion均为0.4.3；13个dist/dist-electron文件逐一SHA256一致，导图JS/CSS分块、Mind Elixir MIT许可及resources/mcp两文件完整。沿用既有无Authenticode签名配置；未执行安装程序或真实资料运行。

发布附件：

| 文件 | 字节 | SHA256 |
|---|---:|---|
| Anvilite-Setup-0.4.3.exe | 110079950 | 6c621e23e814ec7110a49446c624f9ad0228429057dd5280263bad0804ffa0cd |
| Anvilite-0.4.3-portable.exe | 109499132 | 657852be38d47e93b1dce2e6c5c42b1ab988cf6d70fb76ddb98a66deea7ec922 |
| Anvilite-Setup-0.4.3.exe.blockmap | 116242 | a9bba62542044198329b4bc01c57e00699c70f7ecc32add501dba0383d27bc6a |

另附`SHA256SUMS-v0.4.3.txt`。本地产物清单为`release/release-manifest-v0.4.3.json`（生成物，不提交）；发布时按本表核对远程资产大小与SHA256。

- [Windows x64安装版](https://github.com/Leehau-w/Anvilite/releases/download/v0.4.3/Anvilite-Setup-0.4.3.exe)
- [Windows x64便携版](https://github.com/Leehau-w/Anvilite/releases/download/v0.4.3/Anvilite-0.4.3-portable.exe)

用户说明见[v0.4.3发布说明](../../docs/releases/v0.4.3.md)。
