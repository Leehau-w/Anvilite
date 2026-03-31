# Anvilite v0.1 - 技术总结

## 一、项目规模

| 指标 | 数值 |
|------|------|
| TypeScript 源文件 | ~60 个 |
| 组件数 | 35+ |
| Zustand Store | 9 个 + 1 账号管理模块 |
| 引擎（纯函数模块） | 5 个 |
| i18n 翻译键 | 609 个 × 2 语言 |
| 主题 | 8 套（4 亮 + 4 暗） |
| 徽章 | 31 静态 + 动态区域徽章 |
| 区域模板 | 12 种 |
| 装饰物 | 72 个 |

---

## 二、核心技术实现

### 2.1 状态持久化

采用 Zustand `persist` 中间件，所有 Store 自动序列化到 localStorage。`onRehydrateStorage` 回调处理版本迁移：

- **习惯状态重置**：`completed_today` 在次日自动恢复为 `active`
- **周弹性习惯**：`weeklyCompletionCount` 跨周重置为 0
- **分类迁移**：中文分类名 → 英文 key（向后兼容）
- **字段补丁**：新增字段通过 `?? defaultValue` 兼容旧数据

### 2.2 多账号系统

非 Store 实现（纯函数 + 直接 localStorage 操作），避免循环依赖：

```
getStoragePrefix() → 'anvilite' (默认) 或 'anvilite-{uuid}' (新账号)
```

所有 Store 在模块初始化时读取 prefix，作为 `persist({ name })` 参数。切换账号通过 `window.location.reload()` 重新初始化所有 Store。

**默认账号无需迁移**：prefix = `anvilite`，与旧版 key 完全一致。

### 2.3 世界地图画布

- 自定义实现的无限画布：`transform: translate(x, y) scale(s)` + 鼠标拖拽平移 + 滚轮缩放
- 区域节点使用 `position: absolute` + `transform: translate(-50%, -50%)` 居中
- 编辑模式：pointer event 拖拽区域定位 + 改名弹窗 + 删除确认
- 光标管理：React state 驱动（`isGrabbing` state 替代直接 DOM 操作）
- 过渡动画：地图 ↔ 区域内部通过 AnimatePresence + opacity/scale variants

### 2.4 雷达图（SkillRadarChart）

纯 SVG 实现，支持 3+ 维度雷达图和 1-2 维度自动降级为柱状图：

- 极坐标计算：`polar(cx, cy, r, angleDeg)` 从正上方起始
- 自适应标签距离：`calcLabelR()` 按文字宽高 + 轴角度三角投影计算间距
- 多行标签：`splitLabel()` 中文按字数分行，英文按空格断词
- 动态刻度：`gridMax = ceil(maxVal / 5) * 5`，至少 5

### 2.5 仪表盘网格

24 列等宽网格 + 44px 行高 + 8px 间距：
- 卡片拖拽 + 吸附：`snapPos()` / `snapSpan()` 对齐网格
- 响应式：列宽 = `(containerWidth - 23 * gap) / 24`
- 持久化：布局数据存 `dashboardStore`，支持重置

### 2.6 反馈系统

FeedbackContext 统一调度所有视觉反馈：

```
triggerFeedback({ xp, ore, leveledUp, oldLevel, newLevel, streakDays, prestigeUnlocked })
  → XPFloat（浮动数字，1.1s）
  → LevelUpCelebration（升级弹窗，1.2s 延迟）
  → StreakMilestonePopup（连续里程碑）
  → PrestigeModal（淬火重铸确认）
```

BadgeChecker 通过 `useEffect` 监听任务/习惯/角色变化，自动触发徽章检测。

### 2.7 i18n 类型安全

翻译对象的类型从 `zh.ts` 推导 (`typeof zh`)，`en.ts` 必须满足该类型。动态翻译（带参数）使用函数类型：

```typescript
task_toastDone: (xp: number) => `完成！+${xp} XP`  // zh
task_toastDone: (xp: number) => `Done! +${xp} XP`  // en
```

装饰物 i18n 使用运行时 key 查找 + fallback：
```typescript
function decoT(deco, t, field) {
  const key = `deco_${field}_${deco.id}`
  return (t as Record<string, unknown>)[key] ?? deco[field]
}
```

### 2.8 Electron 窗口管理

- 无边框窗口 (`frame: false`)，自定义 TopBar 作为标题栏
- `-webkit-app-region: drag` 实现窗口拖拽
- IPC 通信：渲染进程 → preload → 主进程（minimize/maximize/close）
- 安全：`contextIsolation: true`，`nodeIntegration: false`

---

## 三、已解决的技术难点

| 问题 | 解决方案 |
|------|----------|
| Framer Motion transform 与 CSS transform 冲突 | 用外层 div 做 CSS 定位，motion.div 只做动画 |
| 编辑模式点击白屏 | 用 React state 替代直接 DOM cursor 操作 + isTransitioning 安全超时 |
| `overflow: hidden` 裁剪卡片左边框 | 给列容器加 `paddingLeft: 4` |
| `overflow: visible` 破坏滚动 | 保持 `overflow: hidden`，通过内边距避免裁剪 |
| 英文雷达标签逐字换行 | `splitLabel()` 检测英文后按空格分词 |
| 习惯 `completed_today` 不重置 | `onRehydrateStorage` 检查 `lastCompletedAt` 日期 |
| 周弹性习惯完成计数永为 0 | 新增 `weeklyCompletionCount` 字段 + 周一重置 |
| 删除任务事件泄漏 | 统一使用 `t.task_eventTitle()` 替代硬编码中文 |
| 装饰商店弹窗偏移 | 外层 div 做 CSS 居中，motion.div 做动画 |
| 多账号无需数据迁移 | 默认账号 prefix 与旧版 key 相同 |

---

## 四、代码质量

| 指标 | 状态 |
|------|------|
| TypeScript 严格模式 | 零编译错误 |
| i18n 键一致性 | zh/en 各 609 key，完全对应 |
| 硬编码中文 | 组件中无残留 |
| console.log 残留 | 无 |
| 死代码 | 已清理 |
| `any` 类型 | 无 |
| 错误边界 | Store rehydrate 有 null 检查 |

---

## 五、已知限制（v0.1）

| 限制 | 影响 | 计划 |
|------|------|------|
| 无云同步 | 数据仅在本机 | v0.2 考虑 |
| 无 Error Boundary | 组件异常导致白屏 | v0.2 添加 |
| 周弹性习惯 N>1 时无精确周计数 | 完成 1 次后仍每天显示 | 需增加完成历史记录 |
| 长期运行不重启时 completed_today 不重置 | 跨午夜后习惯不刷新 | 需添加定时检查 |
| localStorage 容量限制（~5MB） | 大量数据可能溢出 | 考虑 IndexedDB |
| 无数据导出/导入 | 无法备份迁移 | v0.2 添加 |
