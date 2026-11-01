# v0.4.5 发布记录

日期：2026-11-01（Europe/Berlin）。用户明确要求打包发布，并强调避免再次报毒。当前支线 codex/legacy-review，基于v0.4.4；仅发布导图Ctrl+Z、同步目录记忆及交付文档，不合并main，不带入D盘其他改动。

## 范围和兼容

- 实现及1060项回归、真实Electron重启/账号隔离与两组视觉验证见[撤回与目录记忆](mindmap-undo-sync-2026-10-30.md)，本轮沿用已完成证据，不重复扩大测试。
- 应用/package-lock版本改为0.4.5，MCP独立版本不变。继续支持v0.3.0及以后数据；旧同步路径升级后必须重新选择一次建立本机授权，此后按账号记住。
- 保留v0.4.4的显式打包范围、实际bundle许可证和安全依赖，不重新纳入完整node_modules或构建工具，不调整保护设置或添加排除。

## 本地交付门禁

- 本轮完整 npm run pack exit 0：app/node类型检查、Vite renderer/main/preload、MCP构建、Windows安装版/便携版生成和强制安全扫描均完成。日志 .dev/audit/pack-0.4.5.log。
- Defender官方情报更新命令正常结束。扫描实际使用平台4.18.26100.4、引擎1.1.26100.4、情报1.463.76.0；防病毒及实时防护前后均开启，扫描工具微软签名有效。应用目录、Setup、portable三项均明确no threats、exit 0。扫描时间 2026-11-01T18:22:48.017Z 至 2026-11-01T18:22:51.717Z，原始报告 release/security-scan-v0.4.5.json。
- ASAR 1920151字节，无node_modules和app.asar.unpacked；14个业务bundle文件和独立MCP资源SHA256一致，前端/Mind Elixir/MCP许可完整；应用exe和asar版本均为0.4.5。
- 两个安装器提取的业务文件与打包目录一致；隔离、隐藏窗口的实际打包运行与MCP 10项通过、零错误。覆盖权限拒写、持久去重、重载吊销、完整重启后任务/旧奖励字段/首页布局保留。报告 .dev/audit/release-0.4.5/report.json，脚本 .dev/audit/verify-packaged-release.cjs。
- 没有执行安装程序或改写现有注册安装，没有访问真实账号资料。打包运行使用字节相同的复制payload，仅以启动bootstrap指定隔离profile并隐藏窗口；不能写成已实际安装验证。

## 资产

| 文件 | 字节 | SHA256 |
|---|---:|---|
| Anvilite-Setup-0.4.5.exe | 100985014 | 08b98182728e18f12aaa74b3a41cdaa3d66a5c2a97e46b9b5de9618110e7350c |
| Anvilite-0.4.5-portable.exe | 100404279 | 0f8182d6e5640cb6626442bf0d678a394dc5363019573ee6d3ec600d86ad58f6 |
| Anvilite-Setup-0.4.5.exe.blockmap | 105921 | 0b76d55425f480babe4242b320fe04bf943639cdc47f3d826a3ba8c16be65352 |
| security-scan-v0.4.5.json | 2668 | 08aa34f141dbba2bed3d00775d4c24b0cf84d5ecb86d6b326c81ce3d364b1507 |
| SHA256SUMS-v0.4.5.txt | 377 | b977ac1178af38c7eab355004391c6a7043c9d545ad920d96c58bd07965ea8fd |

不提交二进制。源码、tag与资产绑定记录在 release/release-manifest-v0.4.5.json。正式发布状态以[GitHub Release](https://github.com/Leehau-w/Anvilite/releases/tag/v0.4.5)为准；创建草稿后必须先核对远程5件附件的字节数/摘要、下载并复核SHA256，对带Internet Zone标记的两个下载件复扫明确通过后才能发布，结果写入本地manifest。未通过不能改成正式发布。

## 安全边界

安装版和便携版均未签名，Windows未知发布者/信誉提示可能仍出现；不能保证所有引擎或未来情报一致，也不把v0.4.3原始检测视为已确认误报。保留旧版标签、附件及v0.4.3警告，不恢复隔离样本、不以改名或字节填充规避检测。用户说明见[v0.4.5发布说明](../../docs/releases/v0.4.5.md)。
