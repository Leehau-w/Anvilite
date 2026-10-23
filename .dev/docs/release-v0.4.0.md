# v0.4.0 发布验收

日期：2026-10-23（Europe/Berlin）。来源为codex/legacy-review，基于18a9108（v0.3.3后审查修复）。用户明确授权确认迁移兼容后将该支线代码及Windows安装包发布到GitHub；后续将兼容范围限定为v0.3.0及以后。未混入main工作区的未提交工作台改造，保留v0.3.3标签及安装包。

## 数据兼容

真实v0.3.0和v0.3.3标签源码在固定日期及内存存储中执行生产actions，生成冻结合成存档。验证冷启动、备份导入/导出/重复导入、双账号隔离、布局及隐藏设置、三级流程/富文本及旧奖励字段保留、写入失败全量回滚。新增8项回归均通过。修复归档习惯冷启动被改暂停、旧计时默认值被一次性标记跳过两项问题；没有扩展v0.2平铺迁移。详情见[兼容性验收](release-compatibility-2026-10-23.md)。

兼容方向是旧数据升级。降级使用升级前备份，不承诺旧程序识别待反馈、多卡筛选、底色、系统模板删除记录等新增语义。appId=com.anvilite.app、package.name=anvilite、productName=Anvilite及原数据目录规则保持。

## 验证证据

| 检查 | 结果 |
| --- | --- |
| 应用完整回归 | 61文件、754项全部通过 |
| MCP协议/分发回归 | 13项全部通过，含官方stdio客户端及运行依赖原始许可文本 |
| app/node/MCP类型检查 | 通过 |
| 生产打包 | Electron41.1.0、electron-builder26.8.1，Windowsx64安装版和便携版通过 |
| 安装包载荷与打包运行 | 9组通过、2个EXE载荷与win-unpacked一致，零页面异常 |
| 当前里程碑界面 | 中英×900×600/1280×800，4组通过，个人数据位于图谱上方；此前26项相关UI回归通过 |
| Git空白检查 | 通过 |

探针.dev/audit/verify-packaged-release.cjs解出安装版和便携版载荷，比对应用EXE、app.asar、MCP独立bundle与原始第三方许可。只修改副本启动入口以隔离profile，业务asar/EXE保持发行产物原字节。实际打包程序使用官方MCP客户端从无关工作目录启动；覆盖默认关闭、读取任务/习惯/流程、写权限拒绝/授权、创建及完成、重复请求、重载、完整应用重启和持久回执重放。所有测试使用合成资料，未读取用户个人数据。

本机有已注册的v0.3.3安装。正式NSIS安装即使改目标目录也会操作共享卸载注册，因此本次没有执行覆盖安装：采用安装包解包比对和隔离打包运行，不把这称为覆盖安装实测。

原始报告/截图/临时profile位于忽略的.dev/audit子目录；可复现脚本、冻结合成夹具和整理后的开发报告入库，不提交node_modules、构建目录、真实资料或连接凭据。构建环境复用node_modules junction导致npm collector报告extraneous/missing路径；最终包内仅有当前生产依赖，打包程序实际运行通过。既有Vite alias/freeze、Browserslist、Tiptap动态导入及体积提示不影响构建，本次未做无关依赖重构。

## 发布产物与来源

发布代码及用户文档见v0.4.0标签指向的提交。固定提交后重新执行npm run pack -- --publish never，并对最终产物再次运行相同打包探针。GitHub Release附Windowsx64安装版、便携版、安装包blockmap、SHA256SUMS.txt与release-manifest.json；manifest记录实际提交、兼容范围、测试计数和最终产物SHA-256。发布前核对本地与远端每个资产的大小和摘要。

用户版本说明见[发布说明](../../docs/releases/v0.4.0.md)。源码开发需要分别npm ci和npm --prefix mcp ci。
