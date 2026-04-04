# Anvilite · 锻石 — 设计规范文档

> **版本**: v1.0
> **日期**: 2026-03-27
> **状态**: 已锁定

---

## 一、主题体系

### 1.1 主题列表

共8套主题，用户可在设置中自由切换。

**暗色系（4套）：**

| 主题名 | 底色 | 面板色 | 边框色 | 正文色 | 辅助文字 | 强调色 | 辅助强调 | 成功 | 危险 | XP色 |
|--------|------|--------|--------|--------|---------|--------|---------|------|------|------|
| 锻铁紫 | #0c0a1a | #16132b | #2a2548 | #e8e4f0 | #8b82a8 | #a78bfa | #f59e0b | #34d399 | #f87171 | #fbbf24 |
| 矿石青 | #0a1218 | #111d28 | #1e3448 | #dce8f0 | #7a96ad | #22d3ee | #a78bfa | #34d399 | #f87171 | #22d3ee |
| 烈焰铸 | #111010 | #1c1917 | #3d3530 | #f5f0eb | #a8998a | #f97316 | #ef4444 | #4ade80 | #f87171 | #fbbf24 |
| 翠林绿 | #0a120e | #12201a | #254035 | #e0efe8 | #7faa96 | #34d399 | #fbbf24 | #4ade80 | #f87171 | #fbbf24 |

**亮色系（4套）：**

| 主题名 | 底色 | 面板色 | 边框色 | 正文色 | 辅助文字 | 强调色 | 辅助强调 | 成功 | 危险 | XP色 |
|--------|------|--------|--------|--------|---------|--------|---------|------|------|------|
| 晨光白 ★默认 | #faf8f5 | #ffffff | #e6e0d6 | #2c2520 | #8c8078 | #e8600a | #8b5cf6 | #16a34a | #dc2626 | #d97706 |
| 薄荷纸 | #f3faf6 | #ffffff | #d0e6da | #1a2e24 | #6a8f7c | #0d9462 | #e8600a | #16a34a | #dc2626 | #d97706 |
| 羊皮卷 | #f8f2e8 | #fefcf5 | #ddd2bc | #3d2e1e | #8c7a64 | #a13820 | #b8860b | #3a7d44 | #a13820 | #b8860b |
| 云石灰 | #f4f5f7 | #ffffff | #d5d8de | #1e2530 | #727d8f | #2563eb | #7c3aed | #16a34a | #dc2626 | #d97706 |

### 1.2 主题切换规则

- 默认主题：**晨光白**
- 用户在设置中切换，立即生效
- 亮色主题使用阴影区分层级，暗色主题使用边框区分层级

### 1.3 优先级颜色规则

- **紧急**：#dc2626（红色），**跨所有主题固定不变**
- **高/中/低**：跟随主题的强调色体系变化

---

## 二、字体体系

### 2.1 字体栈

| 用途 | 字体 | 备用字体 | 授权 |
|------|------|---------|------|
| 中文正文/标签 | Noto Sans SC（思源黑体） | PingFang SC, Microsoft YaHei, sans-serif | 开源 (OFL) |
| 英文正文 | Inter | Noto Sans SC, sans-serif | 开源 (OFL) |
| 数字（XP/等级/日期/时长） | Inter | monospace | 开源 (OFL) |
| 标题（中英文共用） | Noto Sans SC / Inter | — | 同上 |

### 2.2 数字字体特殊规则

- font-weight: **600**（Semi Bold，不用800避免过粗）
- font-feature-settings: **'tnum'**（表格数字，等宽对齐）
- letter-spacing: **0.02em**

适用范围：XP数值（+46 XP）、等级（Lv.5）、经验条数字（320/1500）、子任务进度（3/5）、时间（45min）、日期（2026-03-27）、连续天数（14天）、统计大数字（1,247）

### 2.3 标签字体特殊规则

- font-size: **12px**
- letter-spacing: **0.03em**
- padding: **5px 16px**（加大内边距，小字号下不紧凑）

适用范围：区域标签（智慧塔/工坊）、状态标签（紧急/已完成）、Tab栏、分类标签

### 2.4 字号层级

| 层级 | 大小 | 粗细 | 用途 |
|------|------|------|------|
| H1 | 28px | 800 | 页面标题（Anvilite · 锻石） |
| H2 | 20px | 700 | 区块标题（成长时间线） |
| H3 | 16px | 600 | 小标题（今日任务） |
| Body | 14px | 400 | 正文内容 |
| Small | 12px | 400 | 辅助文字、标签 |
| Tiny | 10px | 400 | 极小辅助信息 |

---

## 三、间距体系

基于 **4px 网格**，6级间距：

| Token | 值 | 用途 |
|-------|-----|------|
| xs | 4px | 图标与文字间距、紧凑元素 |
| sm | 8px | 卡片内元素间距、标签间距 |
| md | 12px | 卡片内边距、分组间距 |
| lg | 16px | 区块间距、侧边栏padding |
| xl | 24px | 页面边距、大区块间距 |
| 2xl | 32px | 页面顶部间距、模块间距 |

---

## 四、圆角体系

| Token | 值 | 用途 |
|-------|-----|------|
| sm | 4px | 勾选框、小图标 |
| md | 8px | 按钮、标签、输入框、Tab项 |
| lg | 12px | 卡片、面板、任务列表容器 |
| xl | 16px | 弹窗、抽屉 |
| full | 9999px | 头像、圆形按钮 |

---

## 五、阴影体系

**亮色主题使用阴影，暗色主题改用边框。**

| Token | 亮色主题值 | 暗色主题替代 | 用途 |
|-------|-----------|-------------|------|
| sm | 0 1px 2px rgba(0,0,0,0.05) | 1px solid border-color | 卡片默认 |
| md | 0 2px 8px rgba(0,0,0,0.08) | 1px solid accent-color-20% | 卡片悬停、下拉菜单 |
| lg | 0 4px 16px rgba(0,0,0,0.12) | 1px solid accent-color-40% | 弹窗、抽屉 |

---

## 六、按钮组件

### 6.1 三种类型

| 类型 | 背景 | 文字 | 边框 | 用途 |
|------|------|------|------|------|
| Primary | accent色 | 白色 | 无 | 主操作（新建任务、完成、确认） |
| Secondary | 透明 | accent色 | 1.5px solid accent | 次要操作（取消、筛选） |
| Ghost | 透明 | accent色 | 无 | 轻量操作（查看更多、链接式按钮） |

### 6.2 三种尺寸

| 尺寸 | 高度 | 水平padding | 字号 | 圆角 |
|------|------|-------------|------|------|
| sm | 28px | 12px | 12px | md (8px) |
| md | 36px | 20px | 14px | md (8px) |
| lg | 44px | 28px | 15px | md (8px) |

### 6.3 特殊状态

- **危险按钮**：背景=danger色，用于删除、收回XP等破坏性操作
- **禁用状态**：背景=border色，文字=dim色，opacity=0.6，cursor=not-allowed
- **悬停状态**：Primary → 亮度+10%；Secondary → 背景填充accent-10%；Ghost → 背景填充accent-5%

### 6.4 按钮内字体

- font-weight: 600
- letter-spacing: 0.03em
- font-family: 继承主字体

---

## 七、输入框组件

### 7.1 基础样式

| 属性 | 值 |
|------|-----|
| 高度 | 36px（与md按钮一致） |
| padding | 8px 12px |
| 背景 | bg色（比面板色深一级） |
| 边框 | 1.5px solid border-color |
| 圆角 | md (8px) |
| 字号 | 14px (Body) |

### 7.2 状态

| 状态 | 边框 | 额外效果 |
|------|------|---------|
| 默认 | 1.5px solid border-color | 无 |
| 聚焦 | 2px solid accent-color | box-shadow: 0 0 0 3px accent-color-15% |
| 错误 | 2px solid danger-color | box-shadow: 0 0 0 3px danger-color-15% |
| 禁用 | 1.5px solid border-color | opacity: 0.5 |

### 7.3 快速创建输入框（特殊）

| 属性 | 值 |
|------|-----|
| padding | 10px 14px |
| 边框 | 1.5px **dashed** border-color |
| 左侧图标 | "+" accent色 16px bold |
| 占位文字 | "快速创建任务..." dim色 |

### 7.4 分类选择器（按钮组，非下拉）

```
[智慧塔] [工坊] [竞技场] [星光阁] [家园] [其他 ▼]
```

- 预设区域（最多5个）直接显示为按钮
- 用户自定义区域收纳在「其他 ▼」按钮中，点击出下拉菜单
- 区域总数上限：**12个**（含里程碑殿堂）
- 按钮样式：与优先级选择器一致
  - 未选中：透明背景，dim色文字，1.5px solid border-color
  - 选中：accent-15%背景，accent色文字，1.5px solid accent-color
- 一行放不下自动换行
- 单选，选中一个自动取消其他

### 7.5 难度选择器（星级）

- 5颗星横排，点击选择
- 未选中星：border-color
- 选中星：xp-color（金色系）
- 选中星右侧显示文字描述：「很简单/简单/需要专注/有挑战/硬核」dim色
- 星星大小：22px

### 7.6 优先级选择器（按钮组）

```
[紧急] [高] [中] [低]
```

- 单选按钮组，样式同分类选择器
- 「紧急」选中时：danger色（红色固定），其他跟随主题
- 默认选中「中」

---

## 八、卡片组件

### 8.1 任务卡片基础样式

| 属性 | 值 |
|------|-----|
| padding | 10px 14px |
| 背景 | surface色 |
| 边框 | 1px solid border-color |
| 圆角 | lg (12px) |
| 阴影 | sm（亮色主题）/ 无（暗色主题，边框代替） |
| 悬停 | 阴影升至md / 边框变为accent-20%（暗色） |

### 8.2 卡片信息布局

```
[勾选框 18×18] [间距8px] [标题 flex:1] ... [优先级标签] [子任务进度] [截止日期] [预估时长(淡化)]
```

- 勾选框：18×18px，圆角sm (4px)，边框2px solid accent-40%
- 标题：14px，weight 500，超长省略号
- 优先级标签：12px标签样式（见7.4），紧急=红色固定
- 子任务进度：12px，accent色，Inter tabular-nums
- 截止日期：12px，dim色（过期时danger色）
- 预估时长：12px，dim色80%透明度

### 8.3 卡片变体

**高优先级卡片（优先级=高）：**
- 左边框：3px solid 主题辅助强调色（如晨光白下=xp色）
- 其余同基础样式

**过期任务卡片：**
- 背景：danger-6%
- 边框：1px solid danger-20%
- 截止日期文字：danger色，显示「已过期X天」

**已完成任务卡片：**
- 背景：hover色
- 整体透明度：0.7
- 标题：加删除线，颜色改为dim色
- 勾选框：背景success-20%，边框2px solid success色，内显示 ✓
- 右侧显示「+XX XP」success色
- 右侧有「撤销」按钮（Ghost按钮sm尺寸，accent色）

**子任务展开状态：**
- 父任务卡片左侧有展开/折叠箭头 ▶/▼
- 父任务标题weight改为600
- 子任务在父任务下方缩进（padding-left: 44px）
- 子任务之间用1px border-color分隔线
- 子任务卡片高度略小（padding: 8px 14px）

---

## 九、侧边栏

| 属性 | 值 |
|------|-----|
| 宽度 | 56px |
| 背景 | surface色 |
| 右边框 | 1px solid border-color |
| padding | 16px 0 |
| 图标大小 | 18px，在36×36px的容器内居中 |
| 图标容器圆角 | md (8px) |
| 选中状态 | 背景accent-15% |
| 间距 | 图标之间gap 16px |

四个导航项：仪表盘 / 任务 / 世界地图 / 时间线

---

## 十、顶栏

| 属性 | 值 |
|------|-----|
| 高度 | 44px |
| 背景 | surface色 |
| 底边框 | 1px solid border-color |
| padding | 0 20px |
| 左侧 | "Anvilite" accent色 16px weight 800 + " · 锻石" dim色 12px |
| 右侧 | 设置图标 14px dim色 |

---

## 十一、底部状态栏

| 属性 | 值 |
|------|-----|
| 高度 | 32px |
| 背景 | surface色 |
| 顶边框 | 1px solid border-color |
| padding | 0 20px |
| 字号 | 12px |
| 内容 | Lv.X · 称号 | 经验条(100px宽) 当前/总XP | 🔥 连续 X 天 |

经验条：高度4px，背景=border色，填充=accent色，圆角2px

---

## 十二、右侧抽屉（详情/编辑面板）

| 属性 | 值 |
|------|-----|
| 宽度 | 400px |
| 背景 | surface色 |
| 左边框 | 1px solid border-color |
| 阴影 | lg（亮色）/ 无（暗色） |
| 圆角 | 左上xl 左下xl 右侧0 |
| padding | 24px |
| 动画 | 从右侧滑入，时长250ms，ease-out |
| 遮罩 | 半透明黑色覆盖主内容区，点击遮罩关闭抽屉 |

---

## 十三、Toast通知

| 属性 | 值 |
|------|-----|
| 位置 | 屏幕底部居中，距底部24px |
| 背景 | text色（深色，反转显示） |
| 文字 | bg色（浅色） |
| padding | 10px 20px |
| 圆角 | md (8px) |
| 阴影 | lg |
| 动画 | 从下方滑入+淡入，300ms ease-out |
| 消失 | 5秒后自动淡出，200ms |
| 内容 | "已完成 · [撤销]"，撤销为Ghost按钮accent色 |

---

## 十四、分类Tab栏

| 属性 | 值 |
|------|-----|
| 容器背景 | hover色 |
| 容器padding | 3px |
| 容器圆角 | md (8px) |
| 每项padding | 5px 16px |
| 每项圆角 | 6px |
| 每项字号 | 12px |
| 每项letter-spacing | 0.03em |
| 未选中 | 透明背景，dim色文字 |
| 选中 | accent-15%背景，accent色文字，weight 600 |
| 布局 | flex，每项flex:1，文字居中 |
| Tab数量 | 最多12个（与区域上限一致） |

---

## 十五、CSS变量命名规范

所有颜色通过CSS变量引用，切换主题时只需更换变量值：

```css
:root {
  /* 基础色 */
  --color-bg: #faf8f5;
  --color-surface: #ffffff;
  --color-surface-hover: #f5f2ed;
  --color-border: #e6e0d6;

  /* 文字 */
  --color-text: #2c2520;
  --color-text-dim: #8c8078;

  /* 强调 */
  --color-accent: #e8600a;
  --color-accent-hover: #f5780e;
  --color-secondary: #8b5cf6;

  /* 语义色 */
  --color-success: #16a34a;
  --color-danger: #dc2626;  /* 跨主题固定 - 紧急优先级 */
  --color-warning: #d97706;
  --color-xp: #d97706;

  /* 间距 */
  --spacing-xs: 4px;
  --spacing-sm: 8px;
  --spacing-md: 12px;
  --spacing-lg: 16px;
  --spacing-xl: 24px;
  --spacing-2xl: 32px;

  /* 圆角 */
  --radius-sm: 4px;
  --radius-md: 8px;
  --radius-lg: 12px;
  --radius-xl: 16px;
  --radius-full: 9999px;

  /* 字体 */
  --font-zh: 'Noto Sans SC', 'PingFang SC', 'Microsoft YaHei', sans-serif;
  --font-en: 'Inter', var(--font-zh);
  --font-num: 'Inter', monospace;
}
```

---

## 十六、多语言支持

- 界面支持中文/英文切换
- 预留后续增加其他语言的接口
- 所有界面文字抽取为语言包（i18n）
- 区域数量上限：12个（含里程碑殿堂，不含里程碑殿堂用户可用11个自定义槽位）

---

*Anvilite · 锻石 — 设计规范 v1.0*
