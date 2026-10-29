# v0.4.4 发布记录

日期：2026-10-29（Europe/Berlin）。用户明确授权继续排查 v0.4.3 安装包检测问题，完成必要修复和安全检查后重新打包发布到 GitHub。本轮采用 v0.4.4，不覆盖旧标签和资产，不合并 main，不带入 D 盘主工作区的未提交改造。

## 当前状态

本地构建、扫描及运行验收已完成。源码以codex/legacy-review的v0.4.4标签对应提交为准；正式发布状态与下载附件以[GitHub Release](https://github.com/Leehau-w/Anvilite/releases/tag/v0.4.4)为准，发布前须核对远程附件并对下载件复扫。

v0.4.3 已在 GitHub 添加检测警告、改为 prerelease 并取消 latest；保留其标签和附件。Defender 原始检测名为 Program:Win32/Contebrew.A!ml，未获微软误报确认。详细调查、来源校验和边界见[安装包安全排查](installer-security-2026-10-29.md)。

## 本轮变更

- electron-builder 交付范围显式排除完整生产 node_modules，移除不需要的依赖副本及 esbuild.exe。renderer/main/preload/MCP 继续使用各自 bundle，MCP 仍作为独立资源交付；最终包已核对运行依赖完整性。
- Vite 根据实际前端构建模块保留第三方许可，移除完整依赖目录后仍交付对应声明和 Mind Elixir 许可；MCP 保留其独立通告。
- 增加 `npm run pack:scan`，并在 `npm run pack` 最后执行。门禁检查 Defender 和实时防护开启、情报版本及更新时间、微软扫描工具的有效签名，逐一扫描 win-unpacked、当前版 Setup 和 portable；任何检测、错误、超时、缺失或无明确 no-threats 结果均阻止交付。
- 使用 `MpCmdRun -Scan -ScanType 3 -File <target> -DisableRemediation` 进行诊断扫描：忽略文件排除项并扫描归档，诊断命令本身不处置样本，不修改实时防护或排除配置。扫描报告记录引擎/情报、时间、范围和资产 SHA256，日志去除本机工作区绝对路径。
- 应用所有 Tiptap 包统一解析到 3.32.1、prosemirror-view 锁定 1.42.8，纳入上游粘贴 HTML XSS 等安全修补；没有把未复现的自定义属性入口写成已利用漏洞。[ProseMirror 公告](https://github.com/advisories/GHSA-c8x8-7fp4-3x9w)、[Tiptap 公告](https://github.com/advisories/GHSA-cp6q-959q-f8rh)
- 根应用及 MCP 均通过关闭安装生命周期脚本的 `npm ci` 进行干净安装；安装生命周期默认关闭，随后只执行经来源核对的 Electron 官方安装脚本恢复运行时。未以 --force 或 legacy-peer-deps 绕过依赖约束。
- 应用版本 0.4.4，MCP 独立版本保持 0.1.0。功能与数据格式保持，继续支持 v0.3.0 及以后版本，沿用原账号、备份与布局恢复规则。

## 已完成验证与边界

- 本轮 Tiptap 更新及干净安装后的 71 个文件 / 1040 项应用回归通过。
- app/node 类型检查、Vite 前端/主进程/preload 及 MCP 构建通过。
- 新安全门禁的语法、帮助及结果判定分支检查通过。首轮 `npm run pack` 的构建及安装器生成完成，但门禁因 Windows PowerShell 模块自动加载错误返回非0，整体命令未成功；按设计阻止了交付。随后仅修正 helper 显式导入 WinPS 原生 Security 模块，签名验证及防护要求保持，单独重跑 `npm run pack:scan` 返回 exit 0；未重新运行整套打包命令，不能把首轮 pack 写成 exit 0。
- 工具链来源已按调查记录核对官方 npm integrity、Electron 官方 SHA256 及 NSIS 官方归档 SHA512；这排除了已检查文件的本地差异，不构成供应链绝对安全结论。
- `release/security-scan-v0.4.4.json` 记录本轮 2026-10-29T13:32:10Z 至 13:32:13Z 的诊断扫描；平台4.18.26100.4、引擎1.1.26100.4、情报1.463.23.0，Defender及实时防护在前后快照中均开启。应用目录、Setup、portable三项均 exit 0、明确 no threats，扫描工具的微软签名有效。命令日志 `.dev/audit/av-2026-10-29/security-scan-044.log`。
- 最终ASAR为1,908,084字节，无node_modules和app.asar.unpacked；14个dist/dist-electron文件逐一SHA256一致，前端第三方许可、Mind Elixir许可及MCP资源完整。安装版和便携版提取的业务文件与打包目录一致。
- 隔离合成profile的打包运行及MCP共10项通过：权限拒写、请求去重、完成与重启持久化、旧记录和布局保留、重载吊销及receipt跨重启生效。窗口保持隐藏，无页面错误，生产业务asar/exe字节不变。没有执行安装程序、修改真实注册安装或访问真实账号。报告`.dev/audit/release-0.4.4/report.json`。
- 真实Edge前端中文900×600浅色、英文1280×800深色2组/2截图通过：SOP普通/加粗/链接/嵌套列表编辑保存后重开和冷重载一致，三层业务子步骤保留；经过生产粘贴处理器的通用危险HTML探针无执行、无危险属性留存，零页面错误及非本地请求。未声称复现未公开CVE专用PoC。报告`.dev/audit/editor-security-ui-2026-10-29/report.json`。
- 没有关闭防护、添加排除项、恢复已隔离安装包或通过改名、填充等方式规避检测。未签名仍可能触发未知发布者提醒；本次扫描结果不能保证所有杀毒产品通过，不能声称 v0.4.3 误报已获确认。

## 发布产物

| 文件 | 字节 | SHA256 |
|---|---:|---|
| Anvilite-Setup-0.4.4.exe | 100982395 | 912c5446f387004d9a85aeec2d318782ce031e3e2fe10593f8be42434af547fb |
| Anvilite-0.4.4-portable.exe | 100401575 | a25a7e773e31a6fc072c6f978d10316dd7361f00e33059af97f55066dc31636a |
| Anvilite-Setup-0.4.4.exe.blockmap | 105961 | 561459f31f824ac133f3bd989f3782dd33e81597881ff183fed65c02734565d5 |
| SHA256SUMS-v0.4.4.txt | 377 | 485e91352654483e3f942d30bdae8d46f9d84b6638c54b89b58d5fb6c20dc9a9 |
| security-scan-v0.4.4.json | 2668 | 50a2c0e7e066cf553cd975071a547a5ba9b7ffee94c8e4c46ea01b6412e75c72 |

安全扫描报告及SHA256文件随安装版、便携版和blockmap一并上传。生成物留在release/，本地manifest记录源码提交及远程附件检查；不提交二进制，不覆盖旧版本资产。下载件复扫与正式发布状态以GitHub和本地交付记录为准。

用户说明见[v0.4.4发布说明](../../docs/releases/v0.4.4.md)。
