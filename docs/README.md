# Anvilite · 锻石

Anvilite is a personal task and habit manager for desktop, with reusable flows, category views and a dashboard you can arrange yourself.

锻石是一款个人任务与习惯管理桌面应用，支持流程、分类、灵感和可自由布局的首页。

> 当前版本 v0.4.0，支持 v0.3.0 及后续 v0.3 系列数据升级。升级前建议导出 JSON 备份；如需降级，请使用升级前的备份。详细用法见 [用户指南](user-guide.md)。

## English

### Features

- Tasks with priorities, due dates, nested checklists, time tracking and a waiting-for-feedback state.
- Recurring habits with flexible schedules, cycle targets, skip, pause, archive and same-day undo.
- Multiple task and habit dashboard cards, each with independent category filters; drag, resize and hide cards.
- A task trend heatmap based on actual completed task counts or recorded minutes, with month and week views.
- Reusable flows with nested steps and rich text. Drag a system template into a folder to create a copy; ordinary flows move.
- Custom categories with completed task counts and actual time, plus preserved owned decorations.
- Milestones with personal notes, a capability chart of actual task counts or minutes, and personal statistics. Task and habit history remains in the archive.
- Quick inspiration capture with Ctrl+Shift+N and conversion into tasks.
- Eight directly selectable themes and Chinese / English support.
- Isolated local accounts, JSON backups and manual snapshots through a selected sync directory.
- Local stdio MCP with separate task, habit and flow permissions, guarded writes and durable retry receipts.

Titles, achievements, levels, XP and ore are inactive. Old backups retain their legacy fields for compatibility; completing or undoing work no longer changes those values. Existing records and dashboard layouts are preserved.

## 中文

### 功能

- 任务支持优先级、截止日期、多层子项、计时及待反馈状态。
- 习惯支持灵活周期、周期目标次数、跳过、暂停、归档及当天撤销。
- 首页可重复添加任务与习惯卡片，分别选择单个、多个或全部分类，并支持拖拽、缩放和隐藏。
- 任务趋势按真实已完成任务数量或实际分钟数显示，可切换本月和本周。
- 流程支持多层步骤与富文本；系统模板拖入文件夹创建副本，普通流程拖入则移动。
- 自定义分类展示真实完成任务数与用时，已有装饰保留。
- 里程碑保留个人纪念、能力图谱和个人数据；图谱可按任务完成数量或实际用时查看，日常历史保留在档案馆。
- Ctrl+Shift+N 捕捉灵感，支持转为任务。
- 8 套主题直接选择，支持中英文切换。
- 本地账号隔离、JSON 备份，以及通过指定同步目录手动保存和恢复快照。
- 本机 stdio MCP，分别控制任务、习惯与流程读写权限，修改带版本检查与持久请求回执。用法见 [MCP 使用说明](mcp.md)。

称号、成就、等级、经验和矿石系统已停用。旧备份中的奖励字段原样兼容，后续完成与撤销不再改变这些数值。已有记录与首页布局保留。

## Development

Electron 41 / React 19 / TypeScript / Zustand / Vite / Vitest.

源码开发需分别安装主项目和独立 MCP 包依赖：

```powershell
npm ci
npm --prefix mcp ci
```

之后使用下列项目脚本：

- npm run dev — 开发运行
- npm run test:all — 应用及 MCP 完整回归测试
- npm run typecheck — 类型检查
- npm run build — 生产构建

开发规范、架构与验收记录保存在 .dev/。
