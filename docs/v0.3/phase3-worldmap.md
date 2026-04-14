# Phase 3 — 世界地图重构 + 高频行为统计

> **前置**：先阅读 `OVERVIEW.md`。Phase 2 完成后再开始。

---

## feature3：世界地图改为卡片网格布局（P1）

### 整体方案

从自由画布（`transform: translate + scale`、绝对定位）重写为 CSS Grid 卡片布局。

### 数据模型迁移

`areaStore.ts` 的 `onRehydrateStorage` 中：

```typescript
// Area 中 position_x/position_y → sortOrder
state.areas.forEach((area, i) => {
  if (area.sortOrder === undefined) {
    area.sortOrder = i  // 按原有顺序赋初值
  }
  // 旧字段保留不删（避免复杂迁移），但 UI 不再使用
})
```

### 组件重写

**WorldMap.tsx** — 整体重写：

```tsx
function WorldMap() {
  const areas = useAreaStore(s => s.areas)
  const [editMode, setEditMode] = useState(false)
  const [interiorAreaId, setInteriorAreaId] = useState<string | null>(null)

  const sortedAreas = useMemo(() =>
    [...areas].sort((a, b) => a.sortOrder - b.sortOrder),
    [areas]
  )

  return (
    <div className="relative h-full">
      {/* 地图层 — 始终挂载 */}
      <motion.div
        animate={{
          opacity: interiorAreaId ? 0 : 1,
          scale: interiorAreaId ? 1.1 : 1,
          pointerEvents: interiorAreaId ? 'none' : 'auto',
        }}
        className="h-full p-6 overflow-y-auto"
        style={{ background: 'var(--color-bg)' /* 羊皮纸纹理 */ }}
      >
        {/* 顶部工具栏 */}
        <div className="flex justify-between items-center mb-4">
          <h2>{t.worldmap_title}</h2>
          <div className="flex gap-2">
            <button onClick={() => setEditMode(!editMode)}>
              {editMode ? t.common_done : t.worldmap_edit}
            </button>
          </div>
        </div>

        {/* 卡片网格 */}
        <div className="grid gap-4"
          style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))' }}
        >
          {sortedAreas.map(area => (
            <AreaCard
              key={area.id}
              area={area}
              editMode={editMode}
              onClick={() => handleAreaClick(area.id)}
            />
          ))}

          {/* 添加区域占位卡片 */}
          {areas.length < 12 && (
            <button
              onClick={handleAddArea}
              className="min-h-[140px] border-2 border-dashed border-[var(--color-border)]
                         rounded-xl flex items-center justify-center
                         text-[var(--color-text-secondary)] hover:border-[var(--color-accent)]"
            >
              + {t.worldmap_addArea}
            </button>
          )}
        </div>
      </motion.div>

      {/* 区域内部 — AnimatePresence */}
      <AnimatePresence>
        {interiorAreaId && (
          <motion.div
            className="absolute inset-0 z-20"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <InteriorSpace
              areaId={interiorAreaId}
              onBack={() => setInteriorAreaId(null)}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
```

**AreaCard.tsx** — 新建（替代旧 AreaNode.tsx）：

```tsx
function AreaCard({ area, editMode, onClick }: Props) {
  const prosperityStars = '★'.repeat(area.prosperityLevel) + '☆'.repeat(6 - area.prosperityLevel)
  const prosperityName = getProsperityName(area.prosperityLevel, t)

  return (
    <motion.div
      layoutId={`area-${area.id}`}  // 用于 zoom 过渡动画
      onClick={() => !editMode && onClick()}
      className="relative p-4 rounded-xl cursor-pointer
                 bg-[var(--color-card)] border border-[var(--color-border)]
                 hover:border-[var(--color-accent)] transition-colors"
      whileHover={{ scale: editMode ? 1 : 1.02 }}
      style={{
        // 繁荣度视觉：高等级发光
        boxShadow: area.prosperityLevel >= 5
          ? '0 0 12px var(--color-accent)'
          : undefined
      }}
    >
      {/* 像素风图标 */}
      <div className="text-3xl mb-2">{getAreaEmoji(area.templateId)}</div>

      {/* 区域名称 */}
      <div className="font-medium text-sm truncate">{getAreaDisplayName(area, t)}</div>

      {/* 繁荣度 */}
      <div className="text-xs text-amber-500 mt-1">{prosperityStars}</div>
      <div className="text-xs text-[var(--color-text-secondary)]">{prosperityName}</div>

      {/* 编辑模式：拖拽手柄 + 删除/重命名 */}
      {editMode && (
        <div className="absolute top-1 right-1 flex gap-1">
          <button onClick={e => { e.stopPropagation(); handleRename(area.id) }}>✏️</button>
          <button onClick={e => { e.stopPropagation(); handleDelete(area.id) }}>🗑</button>
        </div>
      )}
    </motion.div>
  )
}
```

### 过渡动画：zoom 推进（已确认）

点击卡片 → 卡片放大到全屏 → 内部空间淡入：

```tsx
// 利用 Framer Motion layoutId 实现 zoom 效果
// AreaCard 上设置 layoutId={`area-${area.id}`}
// InteriorSpace 的容器上设置相同的 layoutId

// 进入时：
const handleAreaClick = (areaId: string) => {
  setInteriorAreaId(areaId)
  // Framer Motion 的 layout animation 会自动做从卡片位置到全屏的 zoom 过渡
}

// 退出时（ESC 或返回按钮）：
// setInteriorAreaId(null) → AnimatePresence exit → layout animation 回到卡片位置
```

如果 `layoutId` 的效果不理想（因为 AreaCard 和 InteriorSpace 的 DOM 结构差异大），降级方案：

```tsx
// 降级：手动 zoom 动画
<motion.div
  initial={{ opacity: 0, scale: 0.8, y: 20 }}
  animate={{ opacity: 1, scale: 1, y: 0 }}
  exit={{ opacity: 0, scale: 0.8, y: 20 }}
  transition={{ type: 'spring', damping: 25, stiffness: 300 }}
>
  <InteriorSpace ... />
</motion.div>
```

### 编辑模式

- 编辑模式下卡片可拖拽排序（用 Framer Motion Reorder，同 FEAT-01 模式）
- 拖拽结果更新每个 area 的 `sortOrder`
- 卡片可重命名（弹出输入框，限 10 字）和删除（二次确认）

### 删除的文件/代码

- 移除 `MapControls.tsx`（缩放/平移控制）
- 移除 `AreaInfoBar.tsx`（信息直接在卡片上）
- WorldMap.tsx 中删除所有 canvas 相关逻辑：`autoScale`、`viewportRef`、`ResizeObserver`、`CANVAS_W/H`、鼠标拖拽平移
- 旧 `AreaNode.tsx` 替换为 `AreaCard.tsx`

### 影响文件

- `src/components/worldmap/WorldMap.tsx`（重写）
- 新建 `src/components/worldmap/AreaCard.tsx`
- 删除 `src/components/worldmap/MapControls.tsx`（如存在）
- 删除 `src/components/worldmap/AreaInfoBar.tsx`（如存在）
- `src/stores/areaStore.ts`（sortOrder 迁移 + 排序 action）
- `src/i18n/zh.ts`, `src/i18n/en.ts`

### 验收

- [ ] 世界地图显示为卡片网格，自适应列数
- [ ] 每张卡片显示：emoji + 名称 + 繁荣度星级 + 繁荣度名称
- [ ] 点击卡片 → zoom 推进过渡 → 进入区域内部
- [ ] ESC 返回世界地图
- [ ] 编辑模式可拖拽排序卡片
- [ ] 编辑模式可重命名/删除区域
- [ ] 添加区域卡片正常工作（虚线占位）
- [ ] 12 个区域上限
- [ ] v0.2 旧数据（position_x/y）迁移后正常显示
- [ ] 所有 8 个主题下视觉正常

---

## feature7：高频行为统计（P2）

### 实现

新建 `src/utils/normalizeTitle.ts`：

```typescript
export function normalizeTitle(title: string): string {
  return title
    .replace(/[#＃]\s*\d+/g, '')                    // #1, ＃2
    .replace(/第\s*\d+\s*[章节篇回]/g, '')            // 第1章, 第3节
    .replace(/\d{4}[-/]\d{1,2}[-/]\d{1,2}/g, '')    // 日期
    .replace(/\d+/g, '')                             // 其余数字
    .trim()
}
```

在 `ArchiveStats.tsx` 的高频行为统计中，用 `normalizeTitle()` 预处理后再分组统计。

### 测试

```typescript
// normalizeTitle.test.ts
describe('normalizeTitle', () => {
  it('去除序号', () => {
    expect(normalizeTitle('论文阅读 #1')).toBe('论文阅读')
    expect(normalizeTitle('论文阅读 #2')).toBe('论文阅读')
  })
  it('去除章节', () => {
    expect(normalizeTitle('阅读《XX》第3章')).toBe('阅读《XX》第章')
  })
  it('去除日期', () => {
    expect(normalizeTitle('日记 2026-04-13')).toBe('日记')
  })
  it('无数字标题不变', () => {
    expect(normalizeTitle('每日锻炼')).toBe('每日锻炼')
  })
})
```

### 验收

- [ ] 档案馆数据总览中相似标题正确归组
- [ ] normalizeTitle 测试通过
