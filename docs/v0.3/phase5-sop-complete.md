# Phase 5 — SOP 完整版 + 收尾

> **前置**：先阅读 `OVERVIEW.md`。Phase 4 MVP 完成后再开始。

---

## SOP-2b：日程型 + 检查型视图 + 执行模式

### 日程型视图

新建 `src/components/sop/SOPScheduleView.tsx`：

```tsx
function SOPScheduleView({ steps }: { steps: SOPStep[] }) {
  const sorted = [...steps].sort((a, b) => {
    // 按时间点排序
    if (a.time && b.time) return a.time.localeCompare(b.time)
    return a.sortOrder - b.sortOrder
  })

  return (
    <div className="relative pl-8">
      {/* 左侧时间轴竖线 */}
      <div className="absolute left-3 top-0 bottom-0 w-0.5 bg-[var(--color-border)]" />

      {sorted.map(step => (
        <div key={step.id} className="relative flex gap-4 mb-6">
          {/* 时间轴节点 */}
          <div className="absolute left-[-22px] w-3 h-3 rounded-full bg-[var(--color-accent)]
                          border-2 border-[var(--color-bg)] mt-1" />

          {/* 时间点 */}
          <div className="w-14 flex-shrink-0 text-sm font-semibold tabular-nums
                          text-[var(--color-accent)]">
            {step.time || '--:--'}
          </div>

          {/* 内容 */}
          <div className="flex-1">
            <div>{step.title}</div>
            {step.note && (
              <div className="text-sm text-[var(--color-text-secondary)] mt-1">💡 {step.note}</div>
            )}
            {step.warning && (
              <div className="text-sm text-amber-600 mt-1">⚠️ {step.warning}</div>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
```

时间点字体规则：`font-variant-numeric: tabular-nums`（等宽数字对齐）。

### 检查型视图

新建 `src/components/sop/SOPChecklistView.tsx`：

```tsx
function SOPChecklistView({ steps, executionMode, checkedIds, onToggle }: Props) {
  return (
    <div className="space-y-2">
      {steps.sort((a, b) => a.sortOrder - b.sortOrder).map((step, idx) => (
        <div key={step.id}>
          <div className="flex items-start gap-2">
            {/* 执行模式下有勾选框 */}
            {executionMode && (
              <input
                type="checkbox"
                checked={checkedIds.has(step.id)}
                onChange={() => onToggle(step.id)}
                className="mt-1"
              />
            )}
            <span className={`text-sm font-medium ${
              executionMode && checkedIds.has(step.id) ? 'text-[var(--color-text-secondary)] line-through' : ''
            }`}>
              {idx + 1}. {step.title}
            </span>
          </div>

          {step.warning && (
            <div className="text-sm text-amber-600 ml-6 mt-0.5">⚠️ {step.warning}</div>
          )}
          {step.note && (
            <div className="text-sm text-[var(--color-text-secondary)] ml-6 mt-0.5">💡 {step.note}</div>
          )}
        </div>
      ))}
    </div>
  )
}
```

### 执行模式

执行模式是检查型和清单型的共有功能。**打勾状态不保存到 SOP 模板**，每次进入执行模式重置。

在 `SOPContent.tsx` 中管理执行状态：

```tsx
const [executionMode, setExecutionMode] = useState(false)
const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set())

const handleStartExecution = () => {
  setExecutionMode(true)
  setCheckedIds(new Set())  // 每次重置
}

const handleToggle = (stepId: string) => {
  setCheckedIds(prev => {
    const next = new Set(prev)
    next.has(stepId) ? next.delete(stepId) : next.add(stepId)
    return next
  })
}

const handleEndExecution = () => {
  setExecutionMode(false)
}
```

底部操作栏增加「开始执行」按钮（仅检查型和清单型显示）。执行模式中显示进度（如 3/12 已完成）和「结束执行」按钮。

### 更新 SOPContent 路由

```tsx
{sop.type === 'schedule' && <SOPScheduleView steps={sop.steps} />}
{sop.type === 'checklist' && (
  <SOPChecklistView
    steps={sop.steps}
    executionMode={executionMode}
    checkedIds={checkedIds}
    onToggle={handleToggle}
  />
)}
```

同时更新 SOPEditor，新建模式下新增日程型和检查型选项，日程型额外有时间点输入。

### 验收

- [ ] 日程型视图显示纵向时间轴 + 时间点 + 步骤
- [ ] 检查型视图显示有序编号 + 备注/警告
- [ ] 执行模式下可逐项打勾，已勾选项显示删除线
- [ ] 执行模式进度显示（如 3/12）
- [ ] 退出执行模式后打勾状态重置
- [ ] 清单型同样支持执行模式

---

## SOP-5：8 个系统预设

新建 `src/data/systemSOPs.ts`：

```typescript
export const SYSTEM_FOLDER: SOPFolder = {
  id: '__system',
  name: '', // 使用 i18n key: sop_systemFolder
  sortOrder: -1,
  isSystem: true,
  createdAt: '2026-01-01T00:00:00Z',
}

export const SYSTEM_SOPS: SOP[] = [
  {
    id: '__sys_workday',
    folderId: '__system',
    title: '', // i18n: sop_preset_workday
    type: 'schedule',
    isSystem: true,
    steps: [
      { id: 's1', title: '', note: '', warning: '', time: '07:00', sortOrder: 0, childSteps: [] },
      // ... 8 个步骤
    ],
    // ...
  },
  // ... 其余 7 个预设
]
```

**注意**：系统预设的标题和步骤内容使用 i18n key，不硬编码中文。这样中英文切换时预设内容也会跟着变。

在 `sopStore` 的 `onRehydrateStorage` 中：如果 `folders` 不包含 `__system`，自动注入系统文件夹和预设。

系统预设特殊规则：
- 卡片上显示 "系统模板" 标签
- 不可编辑/删除原始版本
- 可"复制为我的 SOP"后自由修改

### 8 个预设内容

按 PM 方案中的表格实现，每个预设填入具体步骤内容。步骤内容需要中英文双语。

### i18n 新增 key

| key | zh | en |
|-----|----|----|
| `sop_systemFolder` | 系统模板 | System Templates |
| `sop_systemBadge` | 系统模板 | System |
| `sop_preset_workday` | 工作日日程 | Workday Schedule |
| `sop_preset_weekend` | 休息日日程 | Day Off Schedule |
| `sop_preset_weeklyReview` | 每周复盘 | Weekly Review |
| `sop_preset_projectKickoff` | 项目启动流程 | Project Kickoff |
| `sop_preset_learnSkill` | 学习新技能流程 | Learn a New Skill |
| `sop_preset_travelPacking` | 出差准备清单 | Business Trip Packing |
| `sop_preset_deepClean` | 大扫除清单 | Deep Cleaning |
| `sop_preset_meetingPrep` | 会议准备检查 | Meeting Preparation |
| `sop_executionMode` | 执行模式 | Execution Mode |
| `sop_startExecution` | 开始执行 | Start Execution |
| `sop_endExecution` | 结束执行 | End Execution |
| `sop_progress` | (done, total) => \`${done}/${total} 已完成\` | (done, total) => \`${done}/${total} completed\` |

### 验收

- [ ] 系统模板文件夹始终在目录树最上方
- [ ] 8 个系统预设正确显示
- [ ] 系统预设不可编辑/删除
- [ ] 可"复制为我的 SOP"
- [ ] 切换语言时系统预设内容跟随变化

---

## feature4：任务 hover 交互更改（待 PM 确认后实施）

**当前状态**：等待 PM 出设计稿。

**预留方向**：hover 时卡片右侧出现 `⋯` 按钮，点击展开下拉菜单（铭刻/隐藏/删除）。具体视觉以设计稿为准。

如果 Phase 5 期间 PM 仍未确认，此项顺延到后续版本。不阻塞 v0.3 发布。

---

## v0.3 发布前检查清单

- [ ] `tsc --noEmit` 零错误
- [ ] `npm test` 全部通过
- [ ] 中英文切换无遗漏 key
- [ ] v0.2 → v0.3 数据迁移正确（子任务内嵌 + 世界地图坐标）
- [ ] Error Boundary 正常工作
- [ ] 8 个主题下 UI 无异常
- [ ] SOP 模块独立可用
- [ ] `CHANGELOG.md` 更新
