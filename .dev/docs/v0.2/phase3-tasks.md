# Phase 3 — 新内容（PATCH-04/05, NEW-01, 存储监控）

> **前置**：先阅读 `OVERVIEW.md` 了解架构规范和编码约定
> **依赖**：Phase 2 全部完成后再开始 Phase 3（尤其是 PATCH-02 导航调整必须先完成）

---

## PATCH-04：档案馆模块

**优先级**：P2
**依赖**：PATCH-02（导航结构调整）已完成

### 需求

世界地图上的"档案馆"区域（原里程碑殿堂区域）内部空间，包含两个 Tab：数据总览 + 时光卷轴。

### 数据结构

档案馆作为特殊区域的内部视图，复用 InteriorSpace 框架，但内容替换为两个 Tab。

### 实现规格

#### 1. 档案馆内部容器

```tsx
// src/components/interior/ArchiveSpace.tsx

function ArchiveSpace() {
  const [activeTab, setActiveTab] = useState<'overview' | 'timeline'>('overview')
  const t = useT()
  
  return (
    <div className="flex flex-col h-full">
      {/* Tab 切换栏 */}
      <div className="flex gap-1 p-2 border-b border-[var(--color-border)]">
        <TabButton
          active={activeTab === 'overview'}
          onClick={() => setActiveTab('overview')}
          label={t.archive_overview}
        />
        <TabButton
          active={activeTab === 'timeline'}
          onClick={() => setActiveTab('timeline')}
          label={t.archive_timeline}
        />
      </div>
      
      {/* Tab 内容 */}
      <div className="flex-1 overflow-y-auto p-4">
        {activeTab === 'overview' && <ArchiveStats />}
        {activeTab === 'timeline' && <ScrollTimeline />}
      </div>
    </div>
  )
}
```

#### 2. 数据总览（ArchiveStats）

5 个维度的统计可视化：

| 维度 | 数据来源 | 可视化方式 |
|------|---------|-----------|
| 总完成任务数 | taskStore（status === 'done'） | 数字卡片 |
| 总完成习惯次数 | habitStore（totalCompletions 累加） | 数字卡片 |
| 累计 XP | characterStore.totalXP | 数字卡片 |
| 累计活跃天数 | characterStore.streakDays 历史最高 | 数字卡片 |
| 分类 XP 分布 | areaStore（各区域 skillXP） | 雷达图或柱状图 |

```tsx
// src/components/interior/ArchiveStats.tsx

function ArchiveStats() {
  const character = useCharacterStore()
  const tasks = useTaskStore(s => s.tasks)
  const habits = useHabitStore(s => s.habits)
  const areas = useAreaStore(s => s.areas)
  const t = useT()
  
  const completedTasks = useMemo(
    () => tasks.filter(t => t.status === 'done' && !t.parentId).length,
    [tasks]
  )
  const totalHabitCompletions = useMemo(
    () => habits.reduce((sum, h) => sum + (h.totalCompletions ?? 0), 0),
    [habits]
  )
  
  return (
    <div className="grid grid-cols-2 gap-4">
      <StatCard label={t.archive_totalTasks} value={completedTasks} icon="⚔️" />
      <StatCard label={t.archive_totalHabits} value={totalHabitCompletions} icon="🔄" />
      <StatCard label={t.archive_totalXP} value={character.totalXP} icon="✨" />
      <StatCard label={t.archive_streakRecord} value={character.bestStreak ?? character.streakDays} icon="🔥" />
      
      {/* 分类分布 — 复用 SkillRadarChart 或简单柱状图 */}
      <div className="col-span-2">
        <SkillRadarChart areas={areas} />
      </div>
    </div>
  )
}
```

#### 3. 时光卷轴（ScrollTimeline）

将现有的 Timeline 组件迁移到档案馆内部。如果现有 Timeline 组件可以直接复用，直接 import 即可：

```tsx
// src/components/interior/ScrollTimeline.tsx
// 可以是对现有 Timeline 组件的包装，或者直接重导出

import Timeline from '../timeline/Timeline'

export default function ScrollTimeline() {
  return <Timeline />
}
```

如果需要增强为横向时间轴 + 悬停放大效果，在此组件中实现。基础版本先保持现有的纵向列表布局，后续迭代优化。

### i18n 新增 key

| key | zh | en |
|-----|----|----|
| `archive_overview` | 数据总览 | Overview |
| `archive_timeline` | 时光卷轴 | Timeline |
| `archive_totalTasks` | 已完成任务 | Tasks Completed |
| `archive_totalHabits` | 习惯完成次数 | Habit Completions |
| `archive_totalXP` | 累计经验 | Total XP |
| `archive_streakRecord` | 最长连续 | Best Streak |

### 影响文件

- 新建 `src/components/interior/ArchiveSpace.tsx`
- 新建 `src/components/interior/ArchiveStats.tsx`
- 新建 `src/components/interior/ScrollTimeline.tsx`
- 修改 `src/components/interior/InteriorSpace.tsx`（档案馆区域渲染 ArchiveSpace）
- `src/i18n/zh.ts`, `src/i18n/en.ts`

### 验收标准

- [ ] 双击世界地图上的档案馆区域进入内部
- [ ] 内部有两个 Tab 可切换
- [ ] 数据总览显示 5 个统计维度，数据正确
- [ ] 时光卷轴显示所有成长事件（包括 BUG-02 修复后的区域升级和徽章事件）
- [ ] 从内部按 ESC 可退回世界地图

---

## PATCH-05：连击阶梯跃升动画

**优先级**：P2

### 需求

连续活跃天数跨越 3/7/14/30 天阈值时触发不同强度的视觉反馈。

### 阈值与动画等级

| 阈值 | 等级 | 动画描述 |
|------|------|---------|
| 3 天 | Lv.1 | 轻微光晕 + 数字弹跳 |
| 7 天 | Lv.2 | 光晕加强 + 火焰 emoji + 文字提示 |
| 14 天 | Lv.3 | 全屏光波 + 粒子效果 + 里程碑文字 |
| 30 天 | Lv.4 | 全屏震撼 + 称号特效 + 里程碑铭刻提示 |

### 实现规格

```tsx
// src/components/feedback/StreakMilestone.tsx

interface StreakMilestoneProps {
  streakDays: number
  previousStreak: number
  onComplete: () => void
}

function StreakMilestone({ streakDays, previousStreak, onComplete }: StreakMilestoneProps) {
  // 判断是否跨越阈值
  const milestones = [3, 7, 14, 30]
  const crossedMilestone = milestones.find(m => previousStreak < m && streakDays >= m)
  
  if (!crossedMilestone) {
    onComplete()
    return null
  }
  
  const level = milestones.indexOf(crossedMilestone) + 1  // 1-4
  
  useEffect(() => {
    const timer = setTimeout(onComplete, level <= 2 ? 2000 : 3000)
    return () => clearTimeout(timer)
  }, [])
  
  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        {/* 根据 level 渲染不同强度的动画 */}
        <motion.div
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', damping: 10 }}
          className="text-center"
        >
          <div className="text-6xl mb-2">🔥</div>
          <div className="text-2xl font-bold text-[var(--color-accent)]">
            {t.streak_milestone(streakDays)}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
```

### 触发时机

在 `FeedbackContext.triggerFeedback` 中，当 `streakDays` 跨越阈值时触发：

```typescript
// FeedbackContext 中
if (feedback.streakDays && feedback.previousStreak) {
  const milestones = [3, 7, 14, 30]
  const crossed = milestones.some(m => 
    feedback.previousStreak < m && feedback.streakDays >= m
  )
  if (crossed) {
    // 延迟 1.5s 显示（在 XPFloat 之后）
    setTimeout(() => setStreakMilestone(feedback), 1500)
  }
}
```

### i18n 新增 key

| key | zh | en |
|-----|----|----|
| `streak_milestone` | (n) => \`连续活跃 ${n} 天！\` | (n) => \`${n} Day Streak!\` |
| `streak_keepGoing` | 继续保持！ | Keep it up! |

### 影响文件

- 新建 `src/components/feedback/StreakMilestone.tsx`
- 修改 `src/components/feedback/FeedbackContext.tsx`（触发逻辑）
- `src/i18n/zh.ts`, `src/i18n/en.ts`

### 验收标准

- [ ] 连续天数从 2→3 时触发 Lv.1 动画
- [ ] 从 6→7 时触发 Lv.2 动画
- [ ] 从 13→14 时触发 Lv.3 动画
- [ ] 从 29→30 时触发 Lv.4 动画
- [ ] 非阈值跨越时不触发
- [ ] 动画结束后自动消失

---

## NEW-01：灵感记录功能

**优先级**：P2

### 数据模型

```typescript
// src/types/inspiration.ts
interface Inspiration {
  id: string
  content: string
  category: string | null
  linkedTaskId: string | null
  isConverted: boolean
  createdAt: string
  updatedAt: string
}
```

### Store

```typescript
// src/stores/inspirationStore.ts
interface InspirationState {
  inspirations: Inspiration[]
  addInspiration: (content: string, category?: string | null) => void
  deleteInspiration: (id: string) => void
  convertToTask: (id: string) => string  // 返回创建的 task ID
}

// persist key: `${getStoragePrefix()}-inspirations`
```

### 快捷键

**注意**：不使用 `Ctrl+Shift+I`（与 DevTools 冲突）。使用 `Ctrl+Shift+N` 或 `Ctrl+.`。

```typescript
// 在 App.tsx 或全局 hook 中
useEffect(() => {
  const handler = (e: KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'N') {
      e.preventDefault()
      setShowInspirationModal(true)
    }
  }
  window.addEventListener('keydown', handler)
  return () => window.removeEventListener('keydown', handler)
}, [])
```

### UI — 灵感浮窗

```tsx
// src/components/ui/InspirationModal.tsx

function InspirationModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [content, setContent] = useState('')
  const [category, setCategory] = useState<string | null>(null)
  const { addInspiration } = useInspirationStore()
  const t = useT()
  
  const handleSubmit = () => {
    if (!content.trim()) return
    addInspiration(content.trim(), category)
    setContent('')
    setCategory(null)
    onClose()
    // toast 提示
  }
  
  if (!open) return null
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 20 }}
        className="relative z-10 w-96 bg-[var(--color-card)] rounded-xl p-5 shadow-xl"
      >
        <div className="flex justify-between items-center mb-3">
          <h3 className="font-medium">💡 {t.inspiration_title}</h3>
          <button onClick={onClose}>×</button>
        </div>
        
        <textarea
          autoFocus
          value={content}
          onChange={e => setContent(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleSubmit()
          }}
          placeholder={t.inspiration_placeholder}
          className="w-full h-24 resize-none rounded-lg border border-[var(--color-border)] p-3 bg-transparent"
        />
        
        {/* 分类选择（可选） */}
        <div className="flex gap-2 mt-3 flex-wrap">
          <CategorySelect value={category} onChange={setCategory} optional />
        </div>
        
        <div className="flex justify-end mt-4">
          <button onClick={handleSubmit} className="px-4 py-2 bg-[var(--color-accent)] text-white rounded-lg">
            {t.inspiration_save}
          </button>
        </div>
      </motion.div>
    </div>
  )
}
```

### UI — 灵感列表卡片（仪表盘）

```tsx
// src/components/dashboard/InspirationCard.tsx

function InspirationCard() {
  const inspirations = useInspirationStore(s => s.inspirations)
  const unconverted = inspirations.filter(i => !i.isConverted)
  const t = useT()
  
  return (
    <div className="flex flex-col h-full">
      <div className="flex-shrink-0 px-4 py-3 border-b border-[var(--color-border)]">
        <h3>💡 {t.inspiration_list} ({unconverted.length})</h3>
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-2" style={{ scrollbarWidth: 'thin' }}>
        {unconverted.map(item => (
          <InspirationItem key={item.id} inspiration={item} />
        ))}
      </div>
    </div>
  )
}

function InspirationItem({ inspiration }: { inspiration: Inspiration }) {
  const t = useT()
  return (
    <div className="flex items-start gap-2 py-2 border-b border-[var(--color-border)]/30">
      <span className="flex-1 text-sm">{inspiration.content}</span>
      <button onClick={() => handleConvertToTask(inspiration.id)} title={t.inspiration_convertToTask}>
        →
      </button>
      <button onClick={() => handleDelete(inspiration.id)} title={t.common_delete}>
        ×
      </button>
    </div>
  )
}
```

### 转为任务

```typescript
// inspirationStore.ts
convertToTask: (id: string) => {
  const inspiration = get().inspirations.find(i => i.id === id)
  if (!inspiration) return ''
  
  // 调用 taskStore 创建任务
  const taskId = useTaskStore.getState().addTask({
    title: inspiration.content,
    category: inspiration.category ?? undefined,
    difficulty: 3,  // 默认中等
    priority: 'medium',
  })
  
  // 标记灵感为已转化
  set(state => ({
    inspirations: state.inspirations.map(i =>
      i.id === id ? { ...i, isConverted: true, linkedTaskId: taskId, updatedAt: new Date().toISOString() } : i
    )
  }))
  
  return taskId
}
```

点击"转为任务"后，打开 TaskDrawer 让用户进一步编辑任务详情（标题和分类已预填）。

### i18n 新增 key

| key | zh | en |
|-----|----|----|
| `inspiration_title` | 记录灵感 | Quick Note |
| `inspiration_placeholder` | 写下你的想法... | Write your idea... |
| `inspiration_save` | 记下来 ✓ | Save ✓ |
| `inspiration_list` | 灵感 | Ideas |
| `inspiration_convertToTask` | 转为任务 | Convert to Task |
| `inspiration_empty` | 还没有灵感记录 | No ideas yet |

### 影响文件

- 新建 `src/types/inspiration.ts`
- 新建 `src/stores/inspirationStore.ts`
- 新建 `src/components/ui/InspirationModal.tsx`
- 新建 `src/components/dashboard/InspirationCard.tsx`
- 修改 `src/App.tsx`（快捷键监听 + Modal 挂载）
- 修改 `src/components/dashboard/`（可选：添加灵感卡片入口）
- `src/i18n/zh.ts`, `src/i18n/en.ts`

### 验收标准

- [ ] `Ctrl+Shift+N`（或选定的快捷键）唤起灵感浮窗
- [ ] 输入内容 + 可选分类 → 保存
- [ ] `Ctrl+Enter` 可快捷保存
- [ ] 灵感列表显示未转化的灵感
- [ ] 点击"转为任务" → 创建任务并打开编辑抽屉
- [ ] 转化后灵感标记为已转化，从列表中消失
- [ ] 数据持久化（刷新后保留）

---

## 补充 2：localStorage 容量监控

**优先级**：P2

### 实现规格

```typescript
// src/utils/storageMonitor.ts

const STORAGE_LIMIT = 5 * 1024 * 1024  // 5MB
const WARNING_THRESHOLD = 0.8   // 80%
const CRITICAL_THRESHOLD = 0.95 // 95%

export function getStorageUsage(): { used: number; total: number; ratio: number } {
  let used = 0
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (key) {
      used += key.length + (localStorage.getItem(key)?.length ?? 0)
    }
  }
  // localStorage 存储 UTF-16，每字符 2 字节
  used *= 2
  return { used, total: STORAGE_LIMIT, ratio: used / STORAGE_LIMIT }
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function cleanupOldEvents(keepCount: number = 500) {
  const store = useGrowthEventStore.getState()
  const events = store.events
  if (events.length > keepCount) {
    // 保留最新的 keepCount 条
    const sorted = [...events].sort((a, b) =>
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    )
    store.setEvents(sorted.slice(0, keepCount))
  }
}
```

### 设置页面显示

```tsx
// SettingsModal.tsx 中添加
function StorageUsage() {
  const { used, total, ratio } = getStorageUsage()
  const t = useT()
  
  return (
    <div>
      <h4>{t.settings_storage}</h4>
      <div className="flex items-center gap-3">
        {/* 进度条 */}
        <div className="flex-1 h-2 bg-[var(--color-border)] rounded-full">
          <div
            className="h-full rounded-full transition-all"
            style={{
              width: `${Math.min(ratio * 100, 100)}%`,
              backgroundColor: ratio > CRITICAL_THRESHOLD
                ? '#ef4444'
                : ratio > WARNING_THRESHOLD
                  ? '#f59e0b'
                  : 'var(--color-accent)'
            }}
          />
        </div>
        <span className="text-sm text-[var(--color-text-secondary)]">
          {formatBytes(used)} / {formatBytes(total)}
        </span>
      </div>
    </div>
  )
}
```

### 仪表盘警告条

当使用量超过 80% 时，在仪表盘顶部显示警告：

```tsx
// Dashboard.tsx 顶部
const { ratio } = getStorageUsage()

{ratio > WARNING_THRESHOLD && (
  <div className="bg-amber-500/10 text-amber-600 px-4 py-2 rounded-lg text-sm flex items-center gap-2">
    <span>⚠️</span>
    <span>{t.storage_warning}</span>
    <button onClick={exportData} className="underline">{t.storage_exportNow}</button>
  </div>
)}
```

### 自动清理

当使用量超过 95% 时自动触发：

```typescript
// 在应用启动时检查
const { ratio } = getStorageUsage()
if (ratio > CRITICAL_THRESHOLD) {
  cleanupOldEvents(500)
  // 再次检查，如果还超标，通知用户
}
```

### i18n 新增 key

| key | zh | en |
|-----|----|----|
| `settings_storage` | 存储空间 | Storage |
| `storage_warning` | 存储空间不足，建议导出备份数据 | Storage running low, please export your data |
| `storage_exportNow` | 立即导出 | Export Now |

### 影响文件

- 新建 `src/utils/storageMonitor.ts`
- 修改 `src/components/layout/SettingsModal.tsx`
- 修改 `src/components/dashboard/Dashboard.tsx`（警告条）
- 修改 `src/stores/growthEventStore.ts`（新增 `setEvents` action，如果没有的话）
- `src/i18n/zh.ts`, `src/i18n/en.ts`

### 验收标准

- [ ] 设置页面显示存储用量进度条
- [ ] 用量 > 80% 时仪表盘顶部显示警告
- [ ] 警告中有"立即导出"快捷链接
- [ ] 用量 > 95% 时自动清理旧事件
- [ ] 清理后只保留最新 500 条成长事件
