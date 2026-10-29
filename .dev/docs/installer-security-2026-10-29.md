# 安装包安全排查（2026-10-29）

范围：`codex/legacy-review` 支线的 v0.4.3 安装包。用户授权定位报毒问题，在完成安全检查后重新打包并以 v0.4.4 发布；不合并 main，不使用真实账号进行覆盖式验证。本记录为调查中的证据快照，未完成项目列在末尾。

## 已确认的检测与临时处理

- Windows Defender 实时事件将 `Anvilite-Setup-0.4.3.exe` 识别为 `Program:Win32/Contebrew.A!ml`，分类“设置修改程序”，严重性“高”；下载文件已被隔离，本地构建目录中的同版安装包也受到读取拦截。这证明发生了实际检测，不证明文件已经确认恶意，也不能据此认定误报。
- 微软该[检测说明](https://www.microsoft.com/en-us/wdsi/threats/malware-encyclopedia-description?Name=Program%3AWin32%2FContebrew.A%21ml)没有公开具体命中特征，当前尚未定位到触发检测的确定字节或行为。
- GitHub v0.4.3 已添加安全警告并改为 prerelease，取消 latest；旧标签及附件保留，避免将待调查包继续作为推荐下载。
- 未关闭实时防护、设置排除项、恢复隔离文件或通过改名、填充字节等方式规避检测。未将样本提交第三方分析服务。

## Defender 环境及初次诊断扫描

平台 `4.18.26100.4`，引擎 `1.1.26100.4`，安全情报 `1.463.21.0`；AntivirusEnabled 与 RealTimeProtectionEnabled 均为 true。SignatureUpdate 返回 exit 0，更新前后情报版本未变化；这仅记录本机当时可用版本，不保证全球检测结果固定。

云保护配置为 MAPSReporting=2、SubmitSamplesConsent=1、DisableBlockAtFirstSeen=false、DisableRealtimeMonitoring=false。主动 `-ValidateMapsConnection` 因管理员权限返回 `0x80070005`，不能记为主动联网验证通过；现有日志记录 14:14:51 云连接成功。

| 扫描对象 | 结果 | 边界 |
|---|---|---|
| v0.4.3 win-unpacked | exit 0，日志明确 no threats | 当前扫描环境与时刻 |
| v0.4.3 portable | exit 0，日志明确 no threats | 不能由此证明 NSIS 安装版无问题 |
| v0.4.3 Setup | Missing，未重新扫描 | 文件已隔离，未恢复 |
| v0.4.2 Setup | exit 0，日志明确 no threats | 对照样本，不等同本版通过 |

证据：`.dev/audit/av-2026-10-29/defender-before.json`、`initial-scans.json` 及其中记录的扫描日志。此前 1040 项回归属于功能验证，不能替代恶意软件扫描。

## 工具链来源与完整性

- 根锁文件 781 个包条目全部解析到 `https://registry.npmjs.org`，均有 integrity；没有非 HTTPS 或缺失校验值的包条目。
- 从官方 registry 重新取得下列锁定版本的 tarball，先验证锁文件 integrity，再将已发布文件逐一与现有安装内容比对，共 633 个文件，差异为 0。只解包比较，没有运行安装脚本。

| 包 | 版本 | 比对文件 |
|---|---|---:|
| electron | 41.1.0 | 9 |
| electron-builder | 26.8.1 | 25 |
| app-builder-lib | 26.8.1 | 433 |
| builder-util | 26.8.1 | 39 |
| builder-util-runtime | 9.5.1 | 42 |
| app-builder-bin | 5.0.0-alpha.12 | 16 |
| 7zip-bin | 5.2.0 | 17 |
| electron-winstaller | 5.4.0 | 52 |

- 本地两份 Electron 41.1.0 Windows x64 缓存 ZIP 均匹配[官方 SHASUMS256.txt](https://github.com/electron/electron/releases/download/v41.1.0/SHASUMS256.txt)：`bbb798d1817bc173a187c1de30432247e48046f737fa13ade126fe3788303b81`。解包后 75 个运行时文件与 `node_modules/electron/dist` 一致。
- 从[官方构建二进制仓库](https://github.com/electron-userland/electron-builder-binaries)下载 [NSIS 3.0.4.1](https://github.com/electron-userland/electron-builder-binaries/releases/tag/nsis-3.0.4.1) 与 [resources 3.4.1](https://github.com/electron-userland/electron-builder-binaries/releases/tag/nsis-resources-3.4.1)，两个归档 SHA512 均匹配已验证 app-builder-lib 内的固定值；NSIS 缓存 343 文件、资源缓存 22 文件逐一一致。
- 未设置 Electron 下载镜像、自定义文件名/目录、builder 二进制镜像或 NSIS 目录覆盖。7za、rcedit 和 app-builder 二进制包含在上述 npm 文件比对中。
- v0.4.2 到 v0.4.3 没有新增 Electron/MCP/安装脚本或依赖变更；既有 after-pack 只调用 rcedit 写入图标、版本等 PE 资源，没有自定义 NSIS 安装脚本或额外下载器。
- 应用及安装器没有有效代码签名。未签名可能影响发布者与下载信誉提示，但不能解释或消除本次病毒检测；代码签名也不能保证杀毒通过。参见[微软 SmartScreen 发布者说明](https://learn.microsoft.com/windows/apps/package-and-deploy/smartscreen-reputation)。

以上排除了已检查工具的本地内容差异，不是“供应链绝对安全”结论；未逐文件核对全部 781 个依赖。详细记录为 `toolchain-summary.json`、`toolchain-npm-integrity.json` 和 `toolchain-binaries-integrity.json`（同一审计目录）。

## 包内容收敛

旧包额外携带 `node_modules` 约 6281 个文件、46.2 MB，并存在约 11.38 MB 的 esbuild 构建二进制。应用已有 renderer/main/preload/MCP bundle，完整依赖目录不属于必要的运行交付物；已在 electron-builder files 中排除。新的包内容与许可证检查、Defender 扫描门禁仍在实施。

这是减少不必要交付内容的修正，尚未证明多余依赖或 esbuild 导致 Contebrew 检测。不能仅以文件变小、哈希变化或重打包后暂未报毒宣称根因已解决。

## npm 安全公告与运行路径

本轮 `npm audit --omit=dev` 原始结果为 14 项：low 1、moderate 2、high 11、critical 0。它按依赖分类统计，不等同 14 条可利用应用路径，也没有证据表明这些公告造成 Defender 检测。只读评估记录在 `audit-assessment.json`，官方公告元数据在 `audit-primary-advisories.json`。

| v0.4.3发现 | 当前运行路径及本轮处理 |
|---|---|
| prosemirror-view 1.41.8 | SOP 富文本编辑器可粘贴 HTML，命中上游公布的 paste XSS 使用场景。修补下限为 1.42.3（同 major），本轮已正常解析并锁定 1.42.8，已完成干净安装，原安全公告已退出新审计；功能回归及隔离浏览器编辑/通用危险HTML粘贴验证通过。[官方公告](https://github.com/advisories/GHSA-c8x8-7fp4-3x9w) |
| @tiptap/core 3.22.3 | mergeAttributes 位于自定义扩展中，但当前固定 schema 未复现不可信 own __proto__ 进入点；Markdown tokenizer 也未启用。修补参考下限为 3.30.5，其 peer 精确要求同版 @tiptap/pm。本轮应用所有 Tiptap 包已按正常依赖解析统一为 3.32.1，未使用 --force 或 legacy-peer-deps；已完成干净安装及既有功能回归，原安全公告已退出新审计。不能写成已复现 XSS。[属性合并公告](https://github.com/advisories/GHSA-cp6q-959q-f8rh)、[Markdown 公告](https://github.com/advisories/GHSA-j95f-988m-3j2f) |
| markdown-it / linkify-it | 旧版没有启用 @tiptap/pm 的 Markdown 路径；同 major 修补下限分别 14.3.3 / 5.0.2。本轮 Tiptap 更新后二者已不在应用锁文件中，实际前端模块清单也未包含二者。 |
| happy-dom / ws | happy-dom 因 @tiptap/html 的 peer 进入 prod 审计，实际 renderer 选用 html browser 入口及 window.document；main/MCP 不导入二者，当前 MCP 通告仅列 SDK core/server 和 zod。属于测试/SSR依赖，不能假称漏洞已修。happy-dom 20.14.6 仍落在 RCE/SSRF 受影响范围，完整下限为 21.0.4，涉及 major；ws 可同 major 到 8.21.0。[RCE公告](https://github.com/advisories/GHSA-834v-8h66-3h79)、[SSRF公告](https://github.com/advisories/GHSA-c8p4-j97h-3vg8) |
| postcss、nanoid、selector-parser、source-map-js、browserslist、baseline-browser-mapping、fast-uri | 构建依赖或未使用的 electron-store/AJV 依赖。未找到应用运行时导入；实际前端/MCP bundle 清单均不包含这些包，Electron main/preload仅引用Electron和Node内置模块，最终ASAR已确认无node_modules及app.asar.unpacked。各自同 major 修补下限见审计评估，不能把未携带说成已更新修复。 |
| esbuild 0.27.4 | 公告依赖 Windows 开发服务器路径；发布应用只在构建 MCP 时使用，不开启该服务器。修补下限 0.28.1 超出当前 ^0.27.x 兼容范围，不为本次安装器调查强行升级。 |

## v0.4.4 当前验证状态

- 根项目与 MCP 已完成干净 `npm ci --ignore-scripts --prefer-online`（本机分别安装697/19包）；随后仅单独执行已审计的官方 Electron `install.js`，恢复官方运行时。
- app/node 类型检查、Vite/main/preload/MCP 构建成功；新 Tiptap 依赖下全量71文件/1040项功能回归通过。此处不是病毒扫描结果。
- 新根项目 `npm audit --omit=dev` 为10项（low 1、moderate 2、high 7、critical 0），`@tiptap/core`、`prosemirror-view`、`markdown-it`、`linkify-it` 原告警已消失。残留为 baseline-browser-mapping、browserslist、esbuild、fast-uri、happy-dom、nanoid、postcss、postcss-selector-parser、source-map-js、ws；不能宣称开发依赖零漏洞。
- MCP 独立 `npm --prefix mcp audit --omit=dev` exit 0、0项告警（prod4）；其锁文件及实际bundle均不含fast-uri/AJV，无需为此更改MCP依赖。
- 从实际产物 `dist/licenses/THIRD-PARTY-NOTICES.txt` 的模块所属包清单核对前端56个包，以上10个残留包均不存在；`dist-mcp/THIRD-PARTY-NOTICES.txt` 仅包含 SDK core/server 2.3.1 与 zod4.6.7，也无这10项。此为已生成 bundle 的实证，不仅是搜索源代码导入。
- 对新 `dist-electron/main.js`、`preload.js` 静态 import/require 核对，仅引用Electron与Node内置模块，没有上述残留依赖。最终ASAR无node_modules，14个构建文件及两类安装产物payload一致性核对通过。

证据为 `npm-audit-after-runtime-fixes.json`、`npm-audit-mcp-production.json`、`runtime-audit-inventory.json`、`electron-external-imports.json`（同一审计目录）。

## 最终本地验证

- v0.4.4 Windows安装版和便携版生成；ASAR从49.5MB收敛到1.91MB，无多余生产依赖或解包工具。14个应用构建文件、MCP资源、第三方许可及两类payload逐一一致。
- 首轮打包在安全门禁的WinPS模块自动加载检查处正确中止，未视为安全通过。显式导入原生Security模块后，单独`npm run pack:scan` exit0；扫描工具微软签名有效，防护和实时防护开启，平台4.18.26100.4、引擎1.1.26100.4、情报1.463.23.0，三项均明确未检出威胁。没有降低签名/防护要求。报告`release/security-scan-v0.4.4.json`。
- 独立合成资料下的打包运行/MCP 10项、SOP真实浏览器2组通过；普通/格式化内容和三层子步骤保留，通用危险HTML粘贴无脚本执行/危险属性残留。没有运行安装程序或触碰真实用户资料。
- 源码tag、远程附件哈希与下载件复扫在正式发布前核对，记录见[v0.4.4发布记录](release-v0.4.4.md)及生成物manifest。旧v0.4.3检测记录继续保留警告；没有恢复旧隔离文件、关闭防护、增加排除或随机改字节规避检测。
- 结论范围为本次工具链比对、产物完整性、已执行回归及记录环境下的Defender未检出威胁；不宣称旧v0.4.3已由微软确认误报，也不保证所有产品/所有时间均给出相同结论。
