# Anvilite v0.1 - 开发技能回顾

## 一、项目概览

Anvilite 是一款从零开始构建的游戏化个人生产力桌面应用，在一个完整的开发周期内完成了设计、实现、调试和发布准备。

---

## 二、技能清单

### 2.1 前端工程

| 技能 | 实践内容 |
|------|----------|
| **React 19** | 函数式组件、Hooks（useState/useEffect/useCallback/useRef/useMemo）、Context API、条件渲染、列表渲染 |
| **TypeScript** | 严格模式、接口设计、泛型、联合类型、类型推导、类型安全的 i18n |
| **Zustand** | 9 个 Store 设计、persist 中间件、onRehydrateStorage 数据迁移、跨 Store 交互（直接调用 getState） |
| **Framer Motion** | AnimatePresence 进出场动画、motion.div 属性动画、variants 模式、layout 动画、手势（whileHover/whileTap） |
| **CSS** | CSS Variables 主题系统（8 套）、Flexbox/Grid 布局、24 列网格系统、color-mix() 混色、radial-gradient 点阵背景 |
| **SVG** | 雷达图（极坐标 → 直角坐标）、多边形渲染、tspan 多行文本、环形进度条 |

### 2.2 桌面应用

| 技能 | 实践内容 |
|------|----------|
| **Electron** | 主进程/渲染进程架构、BrowserWindow 配置、IPC 通信 |
| **窗口管理** | 无边框窗口、自定义标题栏、-webkit-app-region 拖拽区域 |
| **安全模型** | contextIsolation + preload 桥接、禁用 nodeIntegration |
| **构建** | Vite + vite-plugin-electron 集成、esbuild 编译 |

### 2.3 架构设计

| 技能 | 实践内容 |
|------|----------|
| **分层架构** | types → engines → stores → components 单向依赖 |
| **引擎层** | 5 个纯函数引擎，零副作用，可独立测试 |
| **状态隔离** | 多账号 localStorage 前缀隔离，零迁移向后兼容 |
| **数据持久化** | Zustand persist + onRehydrateStorage 字段补丁 + 版本迁移 |

### 2.4 游戏系统设计

| 技能 | 实践内容 |
|------|----------|
| **经验曲线** | 对数增长公式 `5 × ln(level+1) × level`，平滑递增 |
| **经济系统** | XP/矿石双货币、矿石消费（主题解锁 + 装饰购买） |
| **成就系统** | 31+ 徽章、8 类别、静态 + 动态条件、里程碑铭刻 |
| **连续机制** | 活跃天数连击、习惯连续次数、容错充能（7 次获得，抵消 1 次缺席） |
| **繁荣度** | 6 级区域成长、关联装饰解锁、视觉反馈（emoji 升级 + 发光动画） |
| **Prestige** | Lv.51 淬火重铸、等级归一保留数据、记录重铸次数 |

### 2.5 国际化

| 技能 | 实践内容 |
|------|----------|
| **类型安全 i18n** | zh.ts 定义类型源 → en.ts 实现类型约束 → 609 key 零遗漏 |
| **动态翻译** | 函数类型 key 支持参数插值 |
| **运行时查找** | 装饰物 i18n 通过 `(t as Record)[key]` + fallback |
| **SVG 文本适配** | 中英文标签分行策略不同（中文按字数，英文按空格） |

### 2.6 调试与问题排查

| 问题类型 | 解决方法 |
|----------|----------|
| **CSS 裁剪** | 理解 overflow:hidden 在 content-box 边界裁剪 → paddingLeft 修复 |
| **动画冲突** | Framer Motion transform 覆盖 CSS transform → 分层包裹 |
| **滚动失效** | overflow:visible 破坏 flex 子元素高度约束 → 保持 hidden + 内边距 |
| **DOM 直操作闪屏** | e.currentTarget.style 直接操作 → React state 管理 |
| **数据不重置** | completed_today 跨日不恢复 → onRehydrateStorage 日期检查 |
| **硬编码字符串** | 事件查找用中文 literal → 统一用 i18n 函数 |
| **逻辑错误** | deleteAccount 正则反向匹配 → 简化为 UUID 前缀检测 |

---

## 三、架构决策与权衡

### 做了的取舍

| 选择 | 放弃 | 理由 |
|------|------|------|
| localStorage | SQLite/IndexedDB | 首版简单可靠，无原生依赖 |
| Zustand | Redux/MobX | 零 boilerplate，persist 中间件开箱即用 |
| CSS Variables | Styled-components | 主题切换无运行时成本 |
| reload 切换账号 | 热切换 | 避免 9 个 Store 状态泄漏的复杂度 |
| 自研 i18n | i18next | 609 key 规模下无需库，类型安全更好 |
| 无 Error Boundary | 有 | 首版优先功能，v0.2 补充 |

### 遵循的原则

1. **类型即文档**：所有接口定义在 types/ 目录，引擎层和 Store 通过类型约束
2. **引擎与 UI 分离**：计算逻辑在 engines/，UI 在 components/，Store 做桥梁
3. **向后兼容**：新字段 `?? defaultValue`、分类迁移 mapping、多账号默认 prefix 不变
4. **最小变更**：修 bug 只改必要代码，不做无关重构

---

## 四、数据统计

| 统计项 | 数值 |
|--------|------|
| 源代码文件 | ~60 |
| 组件总数 | 35+ |
| Store 数 | 10（含 accountManager） |
| 引擎数 | 5 |
| i18n 翻译键 | 1,218（609 × 2 语言） |
| 区域模板 | 12 |
| 装饰物 | 72 |
| 徽章 | 31+ |
| 主题 | 8 |
| 习惯重复模式 | 8 种 |
| 本次会话修复 bug | 8 个 |
| 本次新增功能 | 1 个（多账号） |

---

## 五、技能矩阵评估

```
React/TS       ████████████████████  高级 — 复杂状态管理、性能优化、类型体操
Zustand        ████████████████████  高级 — persist 中间件、跨 Store、数据迁移
Framer Motion  ████████████████░░░░  中高 — AnimatePresence、variants、手势
CSS/主题       ████████████████████  高级 — Variables 主题、Grid/Flex、SVG
Electron       ████████████░░░░░░░░  中等 — 基础窗口管理、IPC、安全模型
游戏设计       ████████████████░░░░  中高 — 经验曲线、经济平衡、成就体系
i18n           ████████████████████  高级 — 类型安全、609 key 零遗漏
调试           ████████████████████  高级 — CSS 裁剪、动画冲突、逻辑反转
架构           ████████████████████  高级 — 分层设计、数据隔离、向后兼容
```

---

## 六、v0.2 方向建议

1. 添加 React Error Boundary，防止白屏
2. 数据导出/导入（JSON 文件）
3. 习惯完成历史记录（精确周/月统计）
4. 跨午夜自动刷新习惯状态
5. 考虑 IndexedDB 替换 localStorage（突破 5MB 限制）
6. 任务子任务树形结构完善
7. 统计面板增加图表（周/月趋势、分类占比）
