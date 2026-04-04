# PRD.md — Anvilite 锻石 产品需求文档

> 本文档是 Anvilite 的完整产品需求，供 Claude Code 开发参考。
> 所有参数均为最终确认值，不可自行调整。
> 项目概述和编码规范见 CLAUDE.md。

---

## 第一章 导航与布局

### 1.1 整体结构

```
┌──────────────────────────────────────────┐
│  Anvilite · 锻石                  [设置]  │ ← TopBar 44px
├──────┬───────────────────────────────────┤
│  🏠  │                                   │
│  📝  │       主内容区域                    │
│  🗺️  │                                   │
│  📈  │                                   │
│      │                                   │ ← Sidebar 56px
├──────┴───────────────────────────────────┤
│  Lv.X · 称号 | ████░░ 320/1500 | 🔥14天  │ ← StatusBar 32px
└──────────────────────────────────────────┘
```

4个导航Tab：仪表盘(默认) / 任务 / 世界地图 / 时间线

### 1.2 TopBar
- 高度44px，背景surface色，底边框1px
- 左侧："Anvilite" accent色 16px weight800 + " · 锻石" dim色 12px
- 右侧：设置图标

### 1.3 Sidebar
- 宽度56px，背景surface色，右边框1px
- 图标36×36容器，圆角md(8px)，选中态accent-15%背景
- 图标间距gap 16px

### 1.4 StatusBar
- 高度32px，背景surface色，顶边框1px
- 内容：`Lv.X · 称号 | 经验条(100px宽,4px高) 当前/总XP | 🔥连续X天`

---

## 第二章 数据类型定义

### 2.1 Task

```typescript
interface Task {
  id: string;                        // UUID v4
  title: string;                     // 必填
  category: string;                  // 默认=上次使用的分类
  difficulty: 1 | 2 | 3 | 4 | 5;    // 默认=3
  priority: 'urgent' | 'high' | 'medium' | 'low';  // 默认='medium'
  dueDate: string | null;            // 默认=明天，可设null
  description: string;               // 默认=''
  estimatedMinutes: number | null;   // 默认=null
  status: 'todo' | 'doing' | 'done';
  parentId: string | null;
  childIds: string[];
  nestingLevel: number;              // 0=顶层，最大=5
  xpReward: number;
  actualMinutes: number;             // 计时器累计
  timerStartedAt: string | null;     // 进行中时有值
  completedAt: string | null;
  deletedAt: string | null;          // 软删除时间
  isHidden: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}
```

### 2.2 Habit

```typescript
interface Habit {
  id: string;
  title: string;
  category: string;
  difficulty: 1 | 2 | 3 | 4 | 5;
  estimatedMinutes: number;
  repeatType: 'daily' | 'weekdays' | 'weekly' | 'biweekly' | 'monthly' | 'custom';
  customIntervalDays: number | null;
  weeklyDays: number[] | null;       // [1,3,5] = 周一三五
  weeklyMode: 'strict' | 'flexible' | null;
  startDate: string;
  endDate: string | null;
  reminderTime: string | null;       // HH:mm
  description: string;
  status: 'active' | 'completed_today' | 'paused' | 'archived';
  consecutiveCount: number;
  totalCompletions: number;
  toleranceCharges: number;          // 0或1
  toleranceNextAt: number;           // 下次获得容错所需连续次数
  lastCompletedAt: string | null;
  lastDueAt: string | null;
  createdAt: string;
  updatedAt: string;
}
```

### 2.3 Character

```typescript
interface Character {
  name: string;
  level: number;
  currentXP: number;                 // 当前等级内的XP
  totalXP: number;                   // 历史累计总XP
  ore: number;                       // 当前矿石余额
  totalOreEarned: number;            // 历史累计矿石
  titlePreset: 'forge' | 'rpg' | 'custom';
  customTitles: string[] | null;     // 8个自定义称号
  streakDays: number;
  lastActiveDate: string | null;
  globalStatus: 'active' | 'charging' | 'resting' | 'traveling' | 'returning';
  createdAt: string;
}
```

### 2.4 Area

```typescript
interface Area {
  id: string;
  templateId: string | null;        // 模板ID，空白自定义=null
  name: string;
  category: string;                  // 对应的任务分类名
  skillLevel: number;                // 技能维度等级
  skillXP: number;                   // 技能维度累计XP
  prosperityLevel: 1 | 2 | 3 | 4 | 5 | 6;
  position: { x: number; y: number }; // 地图上的位置
  isDefault: boolean;                // 是否默认显示
  isFixed: boolean;                  // 是否不可删除（家园+里程碑殿堂）
  canRename: boolean;                // 是否可改名（里程碑殿堂=false）
  createdAt: string;
}
```

### 2.5 GrowthEvent

```typescript
interface GrowthEvent {
  id: string;
  type: 'task_complete' | 'habit_complete' | 'habit_skip' | 'habit_miss'
      | 'level_up' | 'badge_earned' | 'area_level_up'
      | 'milestone' | 'custom_milestone';
  title: string;
  details: {
    xpGained?: number;
    oreGained?: number;
    actualMinutes?: number;
    categoryName?: string;
    oldLevel?: number;
    newLevel?: number;
    badgeId?: string;
    areaName?: string;
    prosperityLevel?: number;
    consecutiveCount?: number;
    description?: string;            // 用户感想（里程碑）
  };
  isMilestone: boolean;              // 是否被标记为里程碑
  timestamp: string;                 // ISO 8601
}
```

### 2.6 Badge

```typescript
interface Badge {
  id: string;
  category: string;                  // 起步/等级/坚持/区域/习惯/任务量/投入/收集
  name: string;
  description: string;
  condition: string;
  icon: string;
  earned: boolean;
  earnedAt: string | null;
  isNew: boolean;
}
```

### 2.7 CustomMilestone

```typescript
interface CustomMilestone {
  id: string;
  title: string;
  date: string;
  description: string;
  linkedEventId: string | null;
  createdAt: string;
}
```

### 2.8 Settings

```typescript
interface Settings {
  theme: string;                     // 'dawn-white' 默认
  language: 'zh' | 'en';
  dashboardLayout: DashboardCardLayout[];
  unlockedThemes: string[];          // 已解锁主题ID列表
}
```

---

## 第三章 XP与等级系统

### 3.1 基础XP

★=1, ★★=2, ★★★=3, ★★★★=5, ★★★★★=8

矿石(Ore)与XP 1:1同时获得。

### 3.2 加成（可叠加，基于基础XP独立计算后相加）

| 加成类型 | 条件 | 比率 |
|---------|------|------|
| 按时完成 | 有截止日期且按时完成 | +20% |
| 连续活跃 | 连续天数×3%，上限50% | +3%/天 cap 50% |
| 高难度 | 难度≥4星 | +50% |

```
最终XP = 基础XP + floor(基础×0.20) + floor(基础×min(streak×0.03, 0.50)) + floor(基础×0.50)
最终矿石 = 最终XP
```

### 3.3 等级公式

```
升级所需XP = round(5 × ln(level + 1) × level)
```

不封顶。约束：第一年每2周至少升1级，后续每月至少升1级。

### 3.4 称号（8级 × 2套预设 + 用户自定义）

**锻造主题（默认）**：破壳(1-5) / 熔炼(6-10) / 锤炼(11-15) / 锋芒(16-20) / 极意(21-30) / 铸魂(31-40) / 锻石(41-50) / 不朽(51+)

**经典RPG**：新手 / 学徒 / 冒险者 / 游侠 / 英雄 / 大师 / 史诗 / 传奇

### 3.5 连续活跃

每天完成≥1个任务/习惯算活跃。中断后归零，不惩罚。

### 3.6 矿石规则

与XP 1:1获得。用于购买装饰和解锁主题。**撤销/删除任务时矿石不收回**。

---

## 第四章 任务系统

### 4.1 创建

**快速创建**：列表顶部常驻输入框，回车创建，使用默认值。
**完整创建**：右侧抽屉表单。分类选择器用**按钮组**（[家园][竞技场][书阁高塔][灵感工坊][锻造坊][其他▼]），一行放不下换行。

### 4.2 状态流转

todo → doing（启动计时器）→ done（停止计时器）。可直接 todo → done（不计时）。

**计时器**：doing时自动计时，显示 ⏱ HH:MM:SS。多任务可同时doing。应用关闭暂停，重开继续。

### 4.3 完成交互

- 勾选框完成，1-3星直接完成，4-5星需二次确认
- 卡片向右飞出（参数见第十章）
- Toast "已完成·撤销" 5秒
- 获得XP+矿石

### 4.4 撤销

Toast(5秒内) + 已完成列表永久撤销按钮。撤销=XP收回+GrowthEvent删除+允许降级。**矿石不收回**。

### 4.5 删除

进回收站30天自动清除。已完成任务删除：XP收回矿石不收回。分类有任务时不允许删除分类。

### 4.6 子任务

最多6层。第一层缩进展示，更深层点击进入。父任务进度=已完成/总子任务数。

### 4.7 列表

按状态分组（进行中→待办→已完成）。已完成不折叠带撤销。分类Tab筛选+优先级/状态/日期筛选。可拖拽排序。过期任务淡红背景。

### 4.8 卡片信息

任务Tab完整版：勾选框 + 标题 + 优先级 + 子任务进度 + 截止日期 + 预估时长(淡化)。进行中额外显示计时器。

仪表盘简化版：勾选框 + 标题 + 优先级 + 截止日期。

---

## 第五章 习惯系统

### 5.1 入口

主要管理入口在**区域内部空间**。仪表盘习惯卡片为快捷操作入口。

### 5.2 周期

每天 / 工作日 / 每周(可指定天+严格/灵活) / 每两周 / 每月 / 自定义间隔

### 5.3 连续性

完成→+1。跳过→-floor(当前×10%)(最少-1)，不消耗容错。错过→有容错则抵消，无容错则减半。

### 5.4 容错

首次：连续7次得1个。之后：每14次得1个。最多持有1个。仅用于错过。

### 5.5 XP

基础由难度决定(1/2/3/5/8)。连续加成：floor(基础×min(连续次数×0.03, 0.50))。矿石1:1。

### 5.6 操作

暂停(冻结连续)/归档(保留数据)/删除(用户选保留或收回XP，矿石不收回)。

### 5.7 显示

区域内部：默认显示未完成，可切换全部+管理功能。仪表盘：只显示当前周期未完成，非每日显示下次刷新时间（dim色 Tiny字号）。

---

## 第六章 仪表盘

### 6.1 布局

卡片式自由布局（拖拽+调大小+可隐藏+可添加回来）。默认：任务卡片左侧2/3，其余右侧1/3。

### 6.2 问候语

固定顶部。早上好(5-12)/下午好(12-18)/晚上好(18-5) + 角色名(accent色)。不显示日期。

### 6.3 五张卡片

**任务卡片**：所有任务简化版。按状态分组，已完成不折叠带撤销。进行中显示计时器。

**习惯卡片**：当前周期未完成的。完成/跳过按钮。非每日显示刷新时间。

**统计卡片**：今日完成数 / 今日XP / 连续天数🔥。数字H2 weight800。

**角色迷你卡**：状态图标+文字（有doing任务→分类状态+计时"📚学习中·32分钟"；无doing→全局状态"⚡就绪"）。Lv.X·称号。经验条。点击跳转里程碑殿堂。

**快速创建卡片**：独立输入框+展开分类按钮组。

**成长趋势卡片**：本周/本月Tab切换。数据摘要(完成任务数+习惯数)。热力图：月视图=每天精度(GitHub式7行×4-5列)，周视图=每天4时段(7列×4行，时段1-6/6-12/12-18/18-24)。颜色跟随主题accent，阈值动态计算。格子正方形16-20px圆角sm间距2px。悬停tooltip。

---

## 第七章 世界地图

### 7.1 基础

等距像素风，羊皮纸背景。自由散布村落式。可滑动+可缩放(50%-200%)。装饰性连接（河流/树木/路）不可交互。

### 7.2 区域

**默认显示6个**：家园(核心不可删) + 竞技场 + 书阁高塔 + 灵感工坊 + 锻造坊 + 里程碑殿堂(固定)。

**隐藏模板6个**：泉水 / 议事厅 / 远征大厅 / 观测站 / 植物园 / 广场。用户手动添加。

**空白自定义**：用户可创建，无繁荣度视觉。总上限12个。

预设区域固定位置，用户新增可拖拽。

### 7.3 区域标注

常驻：名称(Small/600) + 繁荣★☆(accent/border色) + 微型进度条(60px×3px)。

### 7.4 交互

单击→区域高亮+底部信息栏滑入(250ms)。信息栏内容：名称、繁荣等级★、任务数/习惯数、累计XP、进度条、进行中任务(最多2个)、「进入区域→」按钮。点空白处关闭。

### 7.5 繁荣度

6级：荒芜(Lv.0) / 聚落(1-3) / 丰饶(4-8) / 繁荣(9-15) / 鼎盛(16-25) / 辉煌(26+)。由技能维度等级驱动（与角色等级用相同对数公式独立计算）。

每个区域有独特的6级视觉变化（详见世界地图规格文档）。所有辉煌级融入锻石元素。里程碑殿堂繁荣度由角色总等级驱动。

### 7.6 进入动画

点击「进入区域」→信息面板收起(200ms)→其他区域淡出(200ms)→镜头zoom推进(800ms, cubic-bezier(0.4,0,0.2,1))→建筑淡出内部空间淡入(最后200ms交叉)。

退出：「← 返回地图」按钮(左上角Ghost sm) 或 ESC。反向动画。

---

## 第八章 区域内部空间

### 8.1 布局

像素场景全屏背景。功能面板半透明磨砂玻璃覆盖（rgba 75% + blur 8px + border）。面板默认隐藏，按钮展开/收起(滑入300ms/滑出250ms)。

展开后：左面板~35%(任务+习惯) + 中间~30%(角色可见) + 右面板~35%(数据+收藏)。

### 8.2 角色行为

有doing任务在**本区域**→工作动作(各区域独特)+场景动态效果。无doing→空闲idle。角色状态只反映当前区域。

### 8.3 左侧面板

该区域任务列表(简化+计时器) + 习惯列表(默认未完成，可切换全部+管理)。底部创建按钮，分类自动填入当前区域。

### 8.4 右侧面板

数据：技能等级+进度条、4统计网格(累计XP/完成数/投入时长/繁荣等级)、繁荣进度条、周对比(↑↓)、迷你热力图(最近4周)。

收藏：矿石余额(⛏ X)、装饰商店按钮(模态框)、已拥有装饰网格。

### 8.5 装饰商店

模态框。按繁荣等级分组。低于当前繁荣可购买，高于锁定(灰色)。矿石支付，确认弹窗。每区域独特装饰。

### 8.6 主题解锁

晨光白免费，其余7套矿石解锁。入口在设置中。

---

## 第九章 里程碑殿堂

### 9.1 布局

专属展厅式，非通用内部空间布局。殿堂场景背景+三栏磨砂面板。

左~30%：角色大图+能力雷达图+属性面板(Lv/称号/经验条/总XP/总矿石/使用天数)+称号展示柜(8级已解锁/当前/未解锁)。

中~30%：碑石装饰图形+里程碑列表(时间倒序，系统+自定义混排)。底部「+ 刻碑」按钮。

右~30%：成长统计总览(2×4网格：总完成/总投入/总XP/总矿石/使用天数/最长习惯/最长连击/徽章数) + 成就徽章墙(按系列分组)。

### 9.2 能力雷达图

每个已激活区域一个维度(最多12，不含里程碑殿堂)。维度值=技能等级。蛛网式，填充accent-20%，边线accent。1-2个区域时改为柱状图。

### 9.3 自定义里程碑

入口一：碑石底部「+ 刻碑」→标题(必填)+日期(默认今天)+感想(选填)。
入口二：时间线中悬停事件→⭐标记→可追加感想。

### 9.4 系统徽章（8类~28+个）

起步(1)：首次完成任务。等级(10)：Lv.5/10/15/20/25/30/40/50/75/100。坚持(4)：连续7/30/100/365天。区域(动态)：每区域×5级(聚落~辉煌)。习惯(3)：连续30/100/365次。任务量(3)：100/500/1000个。投入(3)：100/500/1000小时。收集(1)：全主题解锁。

徽章永久保留不因降级收回。

---

## 第十章 时间线

### 10.1 布局

纵向时间轴，最新在最上。左侧2px轴线(accent-20%)。三级分组：月(H2粘性定位)→周(H3)→天(Body可展开/折叠)。

### 10.2 折叠

默认按天折叠。摘要："完成X个任务，获得 Y XP"。有里程碑的天标题高亮(accent-10%)。展开后显示所有事件。

### 10.3 卡片

里程碑=大卡片(accent-8%背景+边框+⭐图标+H3标题+感想)。普通事件=小卡片(一行，类型图标+内容+XP+时间)。

### 10.4 筛选

顶部固定。按类型(多选标签) + 按区域(下拉) + 按时间(本周/本月/全部) + 搜索框。可叠加。

### 10.5 里程碑标记

悬停事件→右侧出现⭐按钮→点击弹出小面板可填感想→确认后变大卡片同步到殿堂碑石。右上角「+ 创建里程碑」按钮。

### 10.6 性能

懒加载(初始30天)，向下滚动按月加载。折叠优化减少DOM。

---

## 第十一章 反馈动画（核心动画精确参数）

### 11.1 任务卡片飞出

```
勾选反馈(100ms): ✓出现, scale(1.02)
延迟(150ms): 保持
飞出(400ms): translateX 0→120%, opacity 1→0(最后100ms), rotate 0→3deg
  缓动: cubic-bezier(0.4, 0, 1, 1)
列表收拢(300ms): 上下卡片合拢
  缓动: cubic-bezier(0.4, 0, 0.2, 1)
```

### 11.2 XP飘字

```
内容: "+X XP", Inter 600 16px, xp色
起始: 卡片中心偏右
时长: 800ms
translateY: 0→-60px, 缓动: cubic-bezier(0, 0, 0.2, 1)
opacity: 0→1(0-200ms)→1(200-600ms)→0(600-800ms)
scale: 0.8→1.1(0-200ms)→1.0(200-400ms)→1.0
```

### 11.3 矿石飘字

```
内容: "+X ⛏", Inter 600 14px, secondary色
起始: XP飘字右侧偏移40px
延迟: 100ms
时长: 800ms
translateY: 0→-50px
其余参数同XP飘字但弹跳幅度更小(0.8→1.05→1.0)
```

### 11.4 经验条填充

```
延迟: XP飘字出现后300ms
时长: 600ms
width: oldPercent%→newPercent%
缓动: cubic-bezier(0.4, 0, 0.2, 1)
附加: 填充时box-shadow 0 0 8px accent, 完成后200ms淡出
数字实时递增(requestAnimationFrame)
```

### 11.5 升级庆祝

```
遮罩淡入(200ms): opacity 0→0.5, backdrop-filter blur(4px)
等级数字弹出(500ms): 屏幕中央, 48px accent色
  scale: 0→1.2→1.0, 缓动: cubic-bezier(0.34, 1.56, 0.64, 1)
粒子(1000ms): 20-30个, accent+xp混色, 3-6px, 从中心扩散带重力
消退(500ms): 数字上飘淡出, 遮罩淡出
跨称号额外: 称号文字从下方滑入, H2 accent, 停留1500ms
可跳过: 点击/ESC
```

### 11.6 完整时序

```
0ms    勾选
100ms  勾选完成
250ms  卡片飞出开始
300ms  XP飘字开始
400ms  矿石飘字开始
550ms  Toast出现
600ms  经验条填充开始
650ms  卡片飞出完成+列表收拢开始
950ms  列表收拢完成
1100ms 飘字淡出
1200ms 经验条填充完成
如果升级: 1200-3400ms升级庆祝
5550ms Toast消失
```

### 11.7 次要动画（方向定义，开发时调参）

- **习惯连续里程碑**：卡片位置弹出🔥大号数字，1000-1500ms，不阻塞
- **徽章解锁**：右上角滑入通知卡片(灰→彩色+发光)，停留3秒滑出
- **区域繁荣升级**：建筑发光渐变(500-800ms)+光晕扩散(1000ms)+Toast
- **角色状态切换**：旧状态淡出→过渡→新状态淡入(500-800ms)

### 11.8 通用UI过渡

- 右侧抽屉：打开translateX 100%→0 (250ms)，关闭反向(200ms)
- 内部面板展开：左右面板从两侧滑入(300ms)，收起反向(250ms)
- 底部信息栏：translateY 100%→0 (250ms)
- 模态弹窗：遮罩opacity+弹窗scale(0.95→1)(250ms)
- 卡片悬停：阴影sm→md(150ms)
- 新任务入场：translateY -10px→0 + opacity(250ms)

---

## 第十二章 主题系统

### 12.1 八套主题色值

**暗色系**

| 主题 | bg | surface | border | text | text-dim | accent | secondary | success | danger | xp |
|------|-----|---------|--------|------|----------|--------|-----------|---------|--------|-----|
| 锻铁紫 | #0c0a1a | #16132b | #2a2548 | #e8e4f0 | #8b82a8 | #a78bfa | #f59e0b | #34d399 | #f87171 | #fbbf24 |
| 矿石青 | #0a1218 | #111d28 | #1e3448 | #dce8f0 | #7a96ad | #22d3ee | #a78bfa | #34d399 | #f87171 | #22d3ee |
| 烈焰铸 | #111010 | #1c1917 | #3d3530 | #f5f0eb | #a8998a | #f97316 | #ef4444 | #4ade80 | #f87171 | #fbbf24 |
| 翠林绿 | #0a120e | #12201a | #254035 | #e0efe8 | #7faa96 | #34d399 | #fbbf24 | #4ade80 | #f87171 | #fbbf24 |

**亮色系**

| 主题 | bg | surface | border | text | text-dim | accent | secondary | success | danger | xp |
|------|-----|---------|--------|------|----------|--------|-----------|---------|--------|-----|
| 晨光白★ | #faf8f5 | #ffffff | #e6e0d6 | #2c2520 | #8c8078 | #e8600a | #8b5cf6 | #16a34a | #dc2626 | #d97706 |
| 薄荷纸 | #f3faf6 | #ffffff | #d0e6da | #1a2e24 | #6a8f7c | #0d9462 | #e8600a | #16a34a | #dc2626 | #d97706 |
| 羊皮卷 | #f8f2e8 | #fefcf5 | #ddd2bc | #3d2e1e | #8c7a64 | #a13820 | #b8860b | #3a7d44 | #a13820 | #b8860b |
| 云石灰 | #f4f5f7 | #ffffff | #d5d8de | #1e2530 | #727d8f | #2563eb | #7c3aed | #16a34a | #dc2626 | #d97706 |

### 12.2 规则

- 默认主题：晨光白
- 紧急优先级颜色 #dc2626 跨主题固定
- 亮色主题用阴影，暗色主题用边框
- 主题切换即时生效

---

## 第十三章 多语言

支持中文/英文切换。所有界面文字抽取为语言包（src/i18n/）。预留后续增加语言。

角色状态文字映射（示例）：

| 区域 | 中文 | 英文 |
|------|------|------|
| 书阁高塔 | 📚 学习中 | 📚 Studying |
| 锻造坊 | 💼 工作中 | 💼 Working |
| 竞技场 | 🏃 运动中 | 🏃 Exercising |
| 灵感工坊 | ✨ 创作中 | ✨ Creating |
| 家园 | 🏠 生活中 | 🏠 Living |
| 自定义 | 📌 忙碌中 | 📌 Busy |
| 无任务-活跃 | ⚡ 就绪 | ⚡ Ready |
| 充电中 | 🔋 充电中 | 🔋 Recharging |
| 休憩 | 💤 休憩中 | 💤 Resting |
| 远行 | 🌄 远行中 | 🌄 Traveling |
| 归来 | 🌅 归来 | 🌅 Returning |

---

## 附录 像素素材

首发约200张素材（占位图先行，后续替换）。详见 anvilite-pixel-assets-spec.md。

文件组织：`src/assets/` 下按 palette / map / character / decorations / badges / ui 分目录。

所有像素素材：等距视角(2:1)、左上方光源、统一调色板(32-48色)、无抗锯齿、PNG透明背景、nearest-neighbor缩放。
