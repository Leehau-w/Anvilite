# v0.4.2 发布记录

日期：2026-10-23（Europe/Berlin）。用户明确要求将本次思维导图功能与 bug 修复一起推送 GitHub，并提供 v0.4.2 安装包。来源为当前 codex/legacy-review 支线，不合并到 main，也不带入 D 盘 main 工作区的未提交工作台改造。

## 发布内容

- Mind Elixir 首版：多张导图、分支展开折叠与拖拽、关联已有任务及节点转任务，标题双向同步和任务状态实时显示。
- 普通后代按原层级转为实际嵌套子任务，后续新增分支继续转换，最多三层；深度超限在写入前整体拒绝。保留原有子项，通过稳定任务/子项 ID 和来源身份去重，失败重试及冷启动不重复创建。删除图节点、导图或解除关联均保留实际任务和子任务。
- 待反馈卡片支持正文 pointer 和原生拖柄排序；保留其他分类位置，多卡同步和重载保留，取消、布局编辑或任务外部变化不提交旧状态。
- 任务弹窗 Enter 保存成功后关闭，备注 Shift+Enter 换行；输入法组合输入、标签/子项/分类局部编辑保持。未添加草稿随整表单保存，失败重试不重复创建任务或子项。
- 导图持久化按账号隔离，纳入 JSON 备份和同步恢复。兼容范围继续为 v0.3.0 及以后；旧备份无导图时恢复为空图，其余资料和布局按既有规则保留。
- Mind Elixir 5.15.1 使用 MIT 许可，随包保留 public/licenses/mind-elixir.txt。

## 已有验证证据

以下结果来自本轮功能和修复完成时的已执行验收，发布阶段不得将打包成功描述为安装运行通过：

- 全量 70 文件 / 1019 项通过，含导图任务关联、待反馈排序、Enter 保存、备份及 v0.3+ 数据迁移回归。
- app/node 类型检查、应用/主进程/preload 生产构建及 MCP 构建通过。
- 最新导图任务关联隔离浏览器验证：中文/英文 × 900×600/1280×800、浅/深主题，4 组 / 8 截图，无页面或控制台错误。覆盖标题同步、三层转换、新分支、任务内改名与完成、节点删除保留、重试去重、过深拒绝、重载和 JSON 文件导出恢复。
- 此前待反馈排序与 Enter 保存、Mind Elixir 首版各有 4 组 / 8 截图验证；实际正文/拖柄拖拽、分类位置、取消/布局编辑、任务设置回车及草稿保留均通过。
- 全部使用合成资料和隔离浏览器，未覆盖真实账号。尚未宣称 Windows 安装运行验收通过。

明细见[导图任务关联](mindmap-task-links-2026-10-23.md)、[待反馈排序与 Enter 保存](waiting-sort-enter-2026-10-23.md)、[Mind Elixir 首版](mindmap-2026-10-23.md)及[v0.3+ 兼容性验收](release-compatibility-2026-10-23.md)。

## 发布状态

版本 v0.4.2，源码以 codex/legacy-review 的 v0.4.2 标签对应提交为准；GitHub 页面提供正式发布状态及附件。保留 v0.4.1 及更早标签和资产，不合并 main。

npm run pack 已成功（exit 0）：包含 app/node 类型检查、应用/主进程/preload/MCP 构建、Windows x64 NSIS 安装版和便携版。包内 package.version、exe FileVersion/ProductVersion 均为 0.4.2；已核对导图分块、Mind Elixir MIT 许可及 resources/mcp/server.cjs/THIRD-PARTY-NOTICES.txt。沿用无 Authenticode 签名配置；未执行安装程序或真实资料运行。

发布附件：

| 文件 | 字节 | SHA256 |
|---|---:|---|
| Anvilite-Setup-0.4.2.exe | 110079451 | 3f3ff36313f2be73997a00116639e3a52e2a3531a53279f063ff35305037c29c |
| Anvilite-0.4.2-portable.exe | 109498617 | 2ffaefd5239f3aaf5db051e3880b94a0f9e3c38c0732b959c0369e80541a0bb9 |
| Anvilite-Setup-0.4.2.exe.blockmap | 116233 | 8cde5034d8cf22e085732ca0eeb8f87b757854d42045917bb750171d7e7507c4 |

- [GitHub Release / v0.4.2 标签](https://github.com/Leehau-w/Anvilite/releases/tag/v0.4.2)
- [Windows x64 安装版](https://github.com/Leehau-w/Anvilite/releases/download/v0.4.2/Anvilite-Setup-0.4.2.exe)
- [Windows x64 便携版](https://github.com/Leehau-w/Anvilite/releases/download/v0.4.2/Anvilite-0.4.2-portable.exe)

用户说明见[v0.4.2 发布说明](../../docs/releases/v0.4.2.md)。
