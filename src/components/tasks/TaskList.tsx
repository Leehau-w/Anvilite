import React, { useState, useRef, useMemo, useCallback } from 'react'
import { AnimatePresence, motion, Reorder } from 'framer-motion'
import { useTaskStore } from '@/stores/taskStore'
import { useAreaStore } from '@/stores/areaStore'
import { useHabitStore } from '@/stores/habitStore'
import { useGrowthEventStore } from '@/stores/growthEventStore'
import { TaskItem } from './TaskItem'
import { QuickInput } from './QuickInput'
import { TaskDrawer } from './TaskDrawer'
import { HabitDrawer } from '@/components/dashboard/HabitDrawer'
import { CollapsibleGroup } from '@/components/ui/CollapsibleGroup'
import { useToast } from '@/components/feedback/Toast'
import type { Task } from '@/types/task'
import type { Habit } from '@/types/habit'
import { useT } from '@/i18n'
import { categoryDisplay, getAreaDisplayName } from '@/utils/area'
import { sortTasksInGroup } from '@/utils/task'


export function TaskList() {
  const {
    tasks, restoreTask, permanentlyDeleteTask, updateTask,
    completedViewMode, setCompletedViewMode,
    customTaskGroups, addCustomTaskGroup, renameCustomTaskGroup, deleteCustomTaskGroup,
    moveTaskToGroup, removeTaskFromGroup,
    reorderTasks,
  } = useTaskStore()
  const getAreaCategories = useAreaStore((s) => s.getAreaCategories)
  const areas = useAreaStore((s) => s.areas)
  const tr = useT()

  const catLabel = (cat: string) => resolveCatLabel(cat, areas, tr)
  const [mainTab, setMainTab] = useState<'tasks' | 'habits'>('tasks')
  const [activeCategory, setActiveCategory] = useState('ALL')
  const [newGroupName, setNewGroupName] = useState('')
  const [addingGroup, setAddingGroup] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editTask, setEditTask] = useState<Task | null>(null)
  const [trashMode, setTrashMode] = useState(false)
  const [hiddenMode, setHiddenMode] = useState(false)
  const [habitDrawerOpen, setHabitDrawerOpen] = useState(false)
  const [editHabit, setEditHabit] = useState<Habit | null>(null)

  const visible = useMemo(() => tasks.filter((task) => {
    if (task.deletedAt) return false
    if (task.isHidden) return false
    if (task.parentId) return false
    if (activeCategory !== 'ALL' && task.category !== activeCategory) return false
    return true
  }), [tasks, activeCategory])

  const doing = useMemo(() => sortTasksInGroup(visible.filter((t) => t.status === 'doing')), [visible])
  const todo = useMemo(() => sortTasksInGroup(visible.filter((t) => t.status === 'todo')), [visible])
  const done = useMemo(() => visible.filter((t) => t.status === 'done'), [visible])

  // 拖拽排序的本地状态
  const [localDoing, setLocalDoing] = useState<Task[]>([])
  const [localTodo, setLocalTodo] = useState<Task[]>([])

  // 同步外部排序结果到本地（只在非拖拽状态更新）
  const isDraggingRef = useRef(false)
  useMemo(() => {
    if (!isDraggingRef.current) {
      setLocalDoing(doing)
      setLocalTodo(todo)
    }
  }, [doing, todo])

  const handleDoingReorder = useCallback((newOrder: Task[]) => {
    isDraggingRef.current = true
    setLocalDoing(newOrder)
  }, [])

  const handleTodoReorder = useCallback((newOrder: Task[]) => {
    isDraggingRef.current = true
    setLocalTodo(newOrder)
  }, [])

  const handleDragEnd = useCallback(() => {
    isDraggingRef.current = false
    reorderTasks([...localDoing, ...localTodo].map((t) => t.id))
  }, [localDoing, localTodo, reorderTasks])

  // 已删除任务（30天内）
  const deleted = tasks
    .filter((t) => !!t.deletedAt)
    .sort((a, b) => new Date(b.deletedAt!).getTime() - new Date(a.deletedAt!).getTime())

  // 已隐藏任务
  const hidden = tasks.filter((t) => !t.deletedAt && t.isHidden)

  function openEdit(task: Task) {
    setEditTask(task)
    setDrawerOpen(true)
  }

  function handleCategoryClick(cat: string) {
    setTrashMode(false)
    setHiddenMode(false)
    setActiveCategory(cat)
  }

  function isCatActive(cat: string) {
    return !trashMode && activeCategory === cat
  }

  return (
    <div className="flex flex-col h-full">
      {/* 主页签：任务 / 习惯 */}
      <div
        className="flex items-center gap-1 px-4 shrink-0"
        style={{ borderBottom: '1px solid var(--color-border)', paddingTop: 8, paddingBottom: 0 }}
      >
        {(['tasks', 'habits'] as const).map((tab) => {
          const label = tab === 'tasks' ? tr.tasklist_tabTasks : tr.tasklist_tabHabits
          const isActive = mainTab === tab
          return (
            <button
              key={tab}
              onClick={() => setMainTab(tab)}
              style={{
                fontSize: 13,
                fontWeight: isActive ? 600 : 400,
                padding: '6px 14px',
                background: 'transparent',
                border: 'none',
                borderBottom: isActive ? '2px solid var(--color-accent)' : '2px solid transparent',
                color: isActive ? 'var(--color-accent)' : 'var(--color-text-dim)',
                cursor: 'pointer',
                transition: 'all 0.15s',
                marginBottom: -1,
              }}
            >
              {label}
            </button>
          )
        })}
      </div>

      {mainTab === 'habits' ? (
        <>
          <HabitsTab
            onAdd={() => { setEditHabit(null); setHabitDrawerOpen(true) }}
            onEdit={(h) => { setEditHabit(h); setHabitDrawerOpen(true) }}
          />
          <HabitDrawer
            open={habitDrawerOpen}
            onClose={() => { setHabitDrawerOpen(false); setEditHabit(null) }}
            editHabit={editHabit}
          />
        </>
      ) : (
      <>
      {/* 分类Tab + 垃圾桶切换 */}
      <div
        className="flex items-center gap-1 px-4 py-2 shrink-0 overflow-x-auto"
        style={{ borderBottom: '1px solid var(--color-border)' }}
      >
        {[{ key: 'ALL', label: tr.tasklist_all }, ...getAreaCategories().map((c) => ({ key: c, label: catLabel(c) }))].map(({ key, label }) => {
          const isActive = isCatActive(key)
          return (
            <button
              key={key}
              onClick={() => handleCategoryClick(key)}
              style={{
                fontSize: 12,
                letterSpacing: '0.02em',
                padding: '4px 12px',
                borderRadius: 'var(--radius-full)',
                border: 'none',
                background: isActive
                  ? 'color-mix(in srgb, var(--color-accent) 15%, transparent)'
                  : 'transparent',
                color: isActive ? 'var(--color-accent)' : 'var(--color-text-dim)',
                cursor: 'pointer',
                fontWeight: isActive ? 500 : 400,
                whiteSpace: 'nowrap',
                transition: 'all 0.15s',
              }}
            >
              {label}
            </button>
          )
        })}
        <div style={{ flex: 1 }} />
        <button
          onClick={() => { setHiddenMode((v) => !v); setTrashMode(false) }}
          title={tr.tasklist_hiddenTooltip}
          style={{
            fontSize: 12,
            padding: '4px 10px',
            borderRadius: 'var(--radius-full)',
            border: `1px solid ${hiddenMode ? 'var(--color-secondary)' : 'var(--color-border)'}`,
            background: hiddenMode
              ? 'color-mix(in srgb, var(--color-secondary) 10%, transparent)'
              : 'transparent',
            color: hiddenMode ? 'var(--color-secondary)' : 'var(--color-text-dim)',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            transition: 'all 0.15s',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            marginRight: 4,
          }}
        >
          <EyeOffIcon />
          {hidden.length > 0 && <span>{hidden.length}</span>}
        </button>
        <button
          onClick={() => { setTrashMode((v) => !v); setHiddenMode(false) }}
          title={tr.tasklist_trashTooltip}
          style={{
            fontSize: 12,
            padding: '4px 10px',
            borderRadius: 'var(--radius-full)',
            border: `1px solid ${trashMode ? 'var(--color-danger)' : 'var(--color-border)'}`,
            background: trashMode
              ? 'color-mix(in srgb, var(--color-danger) 10%, transparent)'
              : 'transparent',
            color: trashMode ? 'var(--color-danger)' : 'var(--color-text-dim)',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            transition: 'all 0.15s',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
          }}
        >
          <TrashIcon />
          {deleted.length > 0 && <span>{deleted.length}</span>}
        </button>
      </div>

      {hiddenMode ? (
        /* 已隐藏任务视图 */
        <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3">
          {hidden.length === 0 ? (
            <div
              className="flex flex-col items-center justify-center flex-1"
              style={{ color: 'var(--color-text-dim)', fontSize: 13, gap: 8, paddingTop: 60 }}
            >
              <span style={{ fontSize: 32 }}>👁️</span>
              <span>{tr.tasklist_hiddenEmpty}</span>
            </div>
          ) : (
            <>
              <p style={{ fontSize: 11, color: 'var(--color-text-dim)', margin: 0 }}>
                {tr.tasklist_hiddenNote}
              </p>
              <AnimatePresence mode="popLayout">
                {hidden.map((task) => (
                  <motion.div
                    key={task.id}
                    layout
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: '60%' }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: '8px 12px',
                      background: 'var(--color-surface)',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--color-border)',
                      opacity: 0.8,
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: 13,
                          color: 'var(--color-text)',
                          textDecoration: task.status === 'done' ? 'line-through' : 'none',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {task.title}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--color-text-dim)', marginTop: 2 }}>
                        {catLabel(task.category)}
                        {task.status === 'done' && task.xpReward > 0 && (
                          <span style={{ marginLeft: 6, color: 'var(--color-success)' }}>
                            +{task.xpReward} XP
                          </span>
                        )}
                        {task.status !== 'done' && (
                          <span style={{ marginLeft: 6, color: 'var(--color-warning)' }}>{tr.tasklist_pendingStatus}</span>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => updateTask(task.id, { isHidden: false })}
                      style={{
                        fontSize: 11,
                        padding: '3px 10px',
                        borderRadius: 'var(--radius-sm)',
                        border: '1px solid var(--color-secondary)',
                        background: 'transparent',
                        color: 'var(--color-secondary)',
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {tr.tasklist_unhide}
                    </button>
                  </motion.div>
                ))}
              </AnimatePresence>
            </>
          )}
        </div>
      ) : trashMode ? (
        /* 垃圾桶视图 */
        <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3">
          {deleted.length === 0 ? (
            <div
              className="flex flex-col items-center justify-center flex-1"
              style={{ color: 'var(--color-text-dim)', fontSize: 13, gap: 8, paddingTop: 60 }}
            >
              <span style={{ fontSize: 32 }}>🗑️</span>
              <span>{tr.tasklist_trashEmpty}</span>
            </div>
          ) : (
            <>
              <p style={{ fontSize: 11, color: 'var(--color-text-dim)', margin: 0 }}>
                {tr.tasklist_trashNote}
              </p>
              <AnimatePresence mode="popLayout">
                {deleted.map((task) => (
                  <motion.div
                    key={task.id}
                    layout
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: '60%' }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: '8px 12px',
                      background: 'var(--color-surface)',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--color-border)',
                      opacity: 0.75,
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: 13,
                          color: 'var(--color-text-dim)',
                          textDecoration: 'line-through',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {task.title}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--color-text-dim)', marginTop: 2, opacity: 0.7 }}>
                        {catLabel(task.category)} · {tr.tasklist_deletedOn(formatDeletedDate(task.deletedAt!))}
                      </div>
                    </div>
                    <button
                      onClick={() => restoreTask(task.id)}
                      style={{
                        fontSize: 11,
                        padding: '3px 10px',
                        borderRadius: 'var(--radius-sm)',
                        border: '1px solid var(--color-border)',
                        background: 'transparent',
                        color: 'var(--color-text-dim)',
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {tr.tasklist_restore}
                    </button>
                    <button
                      onClick={() => permanentlyDeleteTask(task.id)}
                      style={{
                        fontSize: 11,
                        padding: '3px 10px',
                        borderRadius: 'var(--radius-sm)',
                        border: '1px solid var(--color-danger)',
                        background: 'transparent',
                        color: 'var(--color-danger)',
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {tr.tasklist_deletePerm}
                    </button>
                  </motion.div>
                ))}
              </AnimatePresence>
            </>
          )}
        </div>
      ) : (
        /* 正常任务视图 */
        <>
          <div className="px-4 py-3 shrink-0">
            <QuickInput onOpenDrawer={() => { setEditTask(null); setDrawerOpen(true) }} />
          </div>

          <div className="flex-1 overflow-y-auto px-4 pb-4 flex flex-col gap-4">
            {localDoing.length > 0 && (
              <Section title={tr.tasklist_doing} count={localDoing.length} accentColor>
                <Reorder.Group
                  axis="y"
                  values={localDoing}
                  onReorder={handleDoingReorder}
                  style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 6 }}
                >
                  {localDoing.map((task) => (
                    <Reorder.Item
                      key={task.id}
                      value={task}
                      whileDrag={{ scale: 1.02, boxShadow: '0 4px 12px rgba(0,0,0,0.15)', zIndex: 10 }}
                      onDragEnd={handleDragEnd}
                      style={{ listStyle: 'none' }}
                    >
                      <TaskItem task={task} onEdit={openEdit} />
                    </Reorder.Item>
                  ))}
                </Reorder.Group>
              </Section>
            )}

            {localTodo.length > 0 && (
              <Section title={tr.tasklist_todo} count={localTodo.length}>
                <Reorder.Group
                  axis="y"
                  values={localTodo}
                  onReorder={handleTodoReorder}
                  style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 6 }}
                >
                  {localTodo.map((task) => (
                    <Reorder.Item
                      key={task.id}
                      value={task}
                      whileDrag={{ scale: 1.02, boxShadow: '0 4px 12px rgba(0,0,0,0.15)', zIndex: 10 }}
                      onDragEnd={handleDragEnd}
                      style={{ listStyle: 'none' }}
                    >
                      <TaskItem task={task} onEdit={openEdit} />
                    </Reorder.Item>
                  ))}
                </Reorder.Group>
              </Section>
            )}

            {done.length > 0 && (
              <CompletedSection
                done={done}
                completedViewMode={completedViewMode}
                setCompletedViewMode={setCompletedViewMode}
                customTaskGroups={customTaskGroups}
                addCustomTaskGroup={addCustomTaskGroup}
                renameCustomTaskGroup={renameCustomTaskGroup}
                deleteCustomTaskGroup={deleteCustomTaskGroup}
                moveTaskToGroup={moveTaskToGroup}
                removeTaskFromGroup={removeTaskFromGroup}
                catLabel={catLabel}
                onEdit={openEdit}
                tr={tr}
                addingGroup={addingGroup}
                setAddingGroup={setAddingGroup}
                newGroupName={newGroupName}
                setNewGroupName={setNewGroupName}
              />
            )}

            {visible.length === 0 && (
              <div
                className="flex flex-col items-center justify-center flex-1"
                style={{ color: 'var(--color-text-dim)', fontSize: 13, gap: 8, paddingTop: 60 }}
              >
                <span style={{ fontSize: 32 }}>⚒️</span>
                <span>{tr.tasklist_listEmpty}</span>
              </div>
            )}
          </div>
        </>
      )}

      <TaskDrawer
        open={drawerOpen}
        onClose={() => { setDrawerOpen(false); setEditTask(null) }}
        editTask={editTask}
      />
      </>
      )}
    </div>
  )
}

// ─── Completed Tasks Section (FEAT-06) ─────────────────────────────────────

function CompletedSection({
  done,
  completedViewMode,
  setCompletedViewMode,
  customTaskGroups,
  addCustomTaskGroup,
  renameCustomTaskGroup,
  deleteCustomTaskGroup,
  moveTaskToGroup,
  removeTaskFromGroup,
  catLabel,
  onEdit,
  tr,
  addingGroup,
  setAddingGroup,
  newGroupName,
  setNewGroupName,
}: {
  done: Task[]
  completedViewMode: 'month' | 'area' | 'custom'
  setCompletedViewMode: (mode: 'month' | 'area' | 'custom') => void
  customTaskGroups: ReturnType<typeof useTaskStore>['customTaskGroups']
  addCustomTaskGroup: (name: string) => ReturnType<typeof useTaskStore>['customTaskGroups'][number]
  renameCustomTaskGroup: (id: string, name: string) => void
  deleteCustomTaskGroup: (id: string) => void
  moveTaskToGroup: (taskId: string, groupId: string) => void
  removeTaskFromGroup: (taskId: string, groupId: string) => void
  catLabel: (cat: string) => string
  onEdit: (task: Task) => void
  tr: ReturnType<typeof useT>
  addingGroup: boolean
  setAddingGroup: (v: boolean) => void
  newGroupName: string
  setNewGroupName: (v: string) => void
}) {
  const modes: Array<{ key: 'month' | 'area' | 'custom'; label: string }> = [
    { key: 'month', label: tr.task_groupByMonth },
    { key: 'area', label: tr.task_groupByArea },
    { key: 'custom', label: tr.task_groupCustom },
  ]

  // Group by month
  const byMonth = useMemo(() => {
    const map = new Map<string, Task[]>()
    const sorted = [...done].sort((a, b) => {
      const aTime = a.completedAt ? new Date(a.completedAt).getTime() : 0
      const bTime = b.completedAt ? new Date(b.completedAt).getTime() : 0
      return bTime - aTime
    })
    for (const task of sorted) {
      if (!task.completedAt) continue
      const d = new Date(task.completedAt)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(task)
    }
    return map
  }, [done])

  // Group by area
  const byArea = useMemo(() => {
    const map = new Map<string, Task[]>()
    for (const task of done) {
      const key = task.category ?? 'other'
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(task)
    }
    return map
  }, [done])

  // Custom groups
  const allGroupedIds = useMemo(() => {
    const ids = new Set<string>()
    for (const g of customTaskGroups) g.taskIds.forEach((id) => ids.add(id))
    return ids
  }, [customTaskGroups])

  const ungrouped = useMemo(
    () => done.filter((t) => !allGroupedIds.has(t.id)),
    [done, allGroupedIds]
  )

  // ── Drag-and-drop state ────────────────────────────────────────────────────
  const [dragOverGroupId, setDragOverGroupId] = useState<string | null>(null)

  function handleGroupDragOver(e: React.DragEvent, groupId: string) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOverGroupId(groupId)
  }

  function handleGroupDragLeave(e: React.DragEvent) {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setDragOverGroupId(null)
    }
  }

  function handleGroupDrop(e: React.DragEvent, targetGroupId: string) {
    e.preventDefault()
    setDragOverGroupId(null)
    const taskId = e.dataTransfer.getData('taskId')
    const fromGroupId = e.dataTransfer.getData('fromGroupId') // '' means ungrouped
    if (!taskId) return
    if (targetGroupId === '__ungrouped') {
      if (fromGroupId) removeTaskFromGroup(taskId, fromGroupId)
    } else {
      if (targetGroupId !== fromGroupId) {
        moveTaskToGroup(taskId, targetGroupId)
      }
    }
  }

  function handleAddGroup() {
    const name = newGroupName.trim()
    if (!name) return
    addCustomTaskGroup(name)
    setNewGroupName('')
    setAddingGroup(false)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {/* Header with mode switcher */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-dim)', letterSpacing: '0.02em', marginRight: 4 }}>
          {tr.tasklist_done}
        </span>
        <span style={{ fontSize: 11, color: 'var(--color-text-dim)', background: 'var(--color-surface-hover)', padding: '1px 6px', borderRadius: 'var(--radius-full)' }}>
          {done.length}
        </span>
        <div style={{ flex: 1 }} />
        <div style={{ display: 'flex', gap: 2 }}>
          {modes.map((m) => (
            <button
              key={m.key}
              onClick={() => setCompletedViewMode(m.key)}
              style={{
                fontSize: 11,
                padding: '2px 8px',
                borderRadius: 'var(--radius-full)',
                border: 'none',
                background: completedViewMode === m.key
                  ? 'color-mix(in srgb, var(--color-accent) 15%, transparent)'
                  : 'transparent',
                color: completedViewMode === m.key ? 'var(--color-accent)' : 'var(--color-text-dim)',
                cursor: 'pointer',
                fontWeight: completedViewMode === m.key ? 600 : 400,
                transition: 'all 0.15s',
              }}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {/* By Month */}
      {completedViewMode === 'month' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {Array.from(byMonth.entries()).map(([month, tasks]) => (
            <CollapsibleGroup key={month} label={month} count={tasks.length} defaultOpen={true}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <AnimatePresence mode="popLayout">
                  {tasks.map((task) => <TaskItem key={task.id} task={task} onEdit={onEdit} />)}
                </AnimatePresence>
              </div>
            </CollapsibleGroup>
          ))}
        </div>
      )}

      {/* By Area */}
      {completedViewMode === 'area' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {Array.from(byArea.entries()).map(([area, tasks]) => (
            <CollapsibleGroup key={area} label={catLabel(area)} count={tasks.length} defaultOpen={true}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <AnimatePresence mode="popLayout">
                  {tasks.map((task) => <TaskItem key={task.id} task={task} onEdit={onEdit} />)}
                </AnimatePresence>
              </div>
            </CollapsibleGroup>
          ))}
        </div>
      )}

      {/* Custom */}
      {completedViewMode === 'custom' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {customTaskGroups.map((group) => {
            const groupTasks = done.filter((t) => group.taskIds.includes(t.id))
            const isOver = dragOverGroupId === group.id
            return (
              <div
                key={group.id}
                onDragOver={(e) => handleGroupDragOver(e, group.id)}
                onDragLeave={handleGroupDragLeave}
                onDrop={(e) => handleGroupDrop(e, group.id)}
                style={{
                  borderRadius: 'var(--radius-md)',
                  border: `1.5px dashed ${isOver ? 'var(--color-accent)' : 'transparent'}`,
                  background: isOver ? 'color-mix(in srgb, var(--color-accent) 5%, transparent)' : 'transparent',
                  padding: isOver ? '0 4px 4px' : '0',
                  transition: 'border-color 0.12s, background 0.12s, padding 0.12s',
                }}
              >
                <CollapsibleGroup
                  label={group.name}
                  count={groupTasks.length}
                  defaultOpen={true}
                  onRename={(name) => renameCustomTaskGroup(group.id, name)}
                  onDelete={() => deleteCustomTaskGroup(group.id)}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <AnimatePresence mode="popLayout">
                      {groupTasks.map((task) => (
                        <DoneTaskWithGroupMenu
                          key={task.id}
                          task={task}
                          groups={customTaskGroups}
                          currentGroupId={group.id}
                          onEdit={onEdit}
                          onMove={moveTaskToGroup}
                          onRemove={removeTaskFromGroup}
                          tr={tr}
                        />
                      ))}
                    </AnimatePresence>
                    {groupTasks.length === 0 && isOver && (
                      <div style={{
                        height: 32,
                        borderRadius: 'var(--radius-sm)',
                        border: '1.5px dashed var(--color-accent)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 11,
                        color: 'var(--color-accent)',
                        opacity: 0.7,
                      }}>
                        {tr.task_dropHere}
                      </div>
                    )}
                  </div>
                </CollapsibleGroup>
              </div>
            )
          })}

          {/* Ungrouped */}
          {(ungrouped.length > 0 || dragOverGroupId === '__ungrouped') && (
            <div
              onDragOver={(e) => handleGroupDragOver(e, '__ungrouped')}
              onDragLeave={handleGroupDragLeave}
              onDrop={(e) => handleGroupDrop(e, '__ungrouped')}
              style={{
                borderRadius: 'var(--radius-md)',
                border: `1.5px dashed ${dragOverGroupId === '__ungrouped' ? 'var(--color-border)' : 'transparent'}`,
                background: dragOverGroupId === '__ungrouped' ? 'var(--color-surface-hover)' : 'transparent',
                padding: dragOverGroupId === '__ungrouped' ? '0 4px 4px' : '0',
                transition: 'border-color 0.12s, background 0.12s, padding 0.12s',
              }}
            >
            <CollapsibleGroup label={tr.task_ungrouped} count={ungrouped.length} defaultOpen={true}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <AnimatePresence mode="popLayout">
                  {ungrouped.map((task) => (
                    <DoneTaskWithGroupMenu
                      key={task.id}
                      task={task}
                      groups={customTaskGroups}
                      currentGroupId={null}
                      onEdit={onEdit}
                      onMove={moveTaskToGroup}
                      onRemove={removeTaskFromGroup}
                      tr={tr}
                    />
                  ))}
                </AnimatePresence>
              </div>
            </CollapsibleGroup>
            </div>
          )}

          {/* Add group button */}
          {addingGroup ? (
            <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
              <input
                autoFocus
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleAddGroup()
                  if (e.key === 'Escape') { setAddingGroup(false); setNewGroupName('') }
                }}
                placeholder={tr.task_groupNamePlaceholder}
                style={{
                  flex: 1,
                  fontSize: 12,
                  padding: '4px 8px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--color-accent)',
                  background: 'var(--color-surface)',
                  color: 'var(--color-text)',
                  outline: 'none',
                }}
              />
              <button
                onClick={handleAddGroup}
                style={{ fontSize: 12, padding: '4px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-accent)', background: 'color-mix(in srgb, var(--color-accent) 12%, transparent)', color: 'var(--color-accent)', cursor: 'pointer' }}
              >
                ✓
              </button>
              <button
                onClick={() => { setAddingGroup(false); setNewGroupName('') }}
                style={{ fontSize: 12, padding: '4px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)', background: 'transparent', color: 'var(--color-text-dim)', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>
          ) : (
            <button
              onClick={() => setAddingGroup(true)}
              style={{
                fontSize: 12, padding: '4px 12px', borderRadius: 'var(--radius-sm)',
                border: '1px dashed var(--color-border)', background: 'transparent',
                color: 'var(--color-text-dim)', cursor: 'pointer', alignSelf: 'flex-start',
                transition: 'all 0.15s',
              }}
            >
              + {tr.task_newGroup}
            </button>
          )}
        </div>
      )}
    </div>
  )
}

function DoneTaskWithGroupMenu({
  task,
  groups,
  currentGroupId,
  onEdit,
  onMove,
  onRemove,
  tr,
}: {
  task: Task
  groups: ReturnType<typeof useTaskStore>['customTaskGroups']
  currentGroupId: string | null
  onEdit: (t: Task) => void
  onMove: (taskId: string, groupId: string) => void
  onRemove: (taskId: string, groupId: string) => void
  tr: ReturnType<typeof useT>
}) {
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <div
      style={{ position: 'relative' }}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('taskId', task.id)
        e.dataTransfer.setData('fromGroupId', currentGroupId ?? '')
        e.dataTransfer.effectAllowed = 'move'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'grab' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <TaskItem task={task} onEdit={onEdit} />
        </div>
        {groups.length > 0 && (
          <button
            onClick={(e) => { e.stopPropagation(); setMenuOpen((v) => !v) }}
            title={tr.task_moveToGroup}
            style={{
              fontSize: 10, padding: '2px 6px', borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--color-border)', background: 'transparent',
              color: 'var(--color-text-dim)', cursor: 'pointer', flexShrink: 0,
            }}
          >
            ⋯
          </button>
        )}
      </div>
      <AnimatePresence>
        {menuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            style={{
              position: 'absolute', right: 0, top: '100%', zIndex: 100,
              background: 'var(--color-surface)', border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-md)', boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
              minWidth: 140, padding: 4,
            }}
          >
            {groups.map((g) => (
              <button
                key={g.id}
                onClick={() => { onMove(task.id, g.id); setMenuOpen(false) }}
                disabled={g.id === currentGroupId}
                style={{
                  display: 'block', width: '100%', textAlign: 'left', padding: '5px 10px',
                  fontSize: 12, background: 'transparent', border: 'none',
                  color: g.id === currentGroupId ? 'var(--color-text-dim)' : 'var(--color-text)',
                  cursor: g.id === currentGroupId ? 'default' : 'pointer',
                  borderRadius: 'var(--radius-sm)',
                }}
              >
                {g.name}
              </button>
            ))}
            {currentGroupId && (
              <button
                onClick={() => { onRemove(task.id, currentGroupId); setMenuOpen(false) }}
                style={{
                  display: 'block', width: '100%', textAlign: 'left', padding: '5px 10px',
                  fontSize: 12, background: 'transparent', border: 'none', borderTop: '1px solid var(--color-border)',
                  color: 'var(--color-text-dim)', cursor: 'pointer', borderRadius: 'var(--radius-sm)', marginTop: 2,
                }}
              >
                {tr.task_removeFromGroup}
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function Section({
  title,
  count,
  children,
  accentColor,
  dim,
}: {
  title: string
  count: number
  children: React.ReactNode
  accentColor?: boolean
  dim?: boolean
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <span
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: accentColor
              ? 'var(--color-accent)'
              : dim
              ? 'var(--color-text-dim)'
              : 'var(--color-text)',
            letterSpacing: '0.02em',
          }}
        >
          {title}
        </span>
        <span
          style={{
            fontSize: 11,
            color: 'var(--color-text-dim)',
            background: 'var(--color-surface-hover)',
            padding: '1px 6px',
            borderRadius: 'var(--radius-full)',
          }}
        >
          {count}
        </span>
      </div>
      <div className="flex flex-col gap-2">{children}</div>
    </div>
  )
}

function TrashIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6M14 11v6" />
      <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
    </svg>
  )
}

function EyeOffIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  )
}

function formatDeletedDate(iso: string): string {
  const d = new Date(iso)
  return `${d.getMonth() + 1}/${d.getDate()}`
}

/** Resolve category key → display name using area data (user rename > i18n > raw key) */
function resolveCatLabel(cat: string, areas: ReturnType<typeof useAreaStore>['areas'], t: ReturnType<typeof useT>): string {
  const area = areas.find((a) => a.category === cat)
  if (area) return getAreaDisplayName(area, t)
  return categoryDisplay(cat, t)
}

// ─── 习惯页签 ──────────────────────────────────────────────────────────────────

function HabitsTab({
  onAdd,
  onEdit,
}: {
  onAdd: () => void
  onEdit: (h: Habit) => void
}) {
  const {
    habits, pauseHabit, resumeHabit, hideHabit, unhideHabit, deleteHabit, restoreHabit, permanentlyDeleteHabit, masterHabit, startHabitTimer, pauseHabitTimer,
    completedHabitViewMode, setCompletedHabitViewMode,
    customHabitGroups, addCustomHabitGroup, renameCustomHabitGroup, deleteCustomHabitGroup,
    moveHabitToGroup, removeHabitFromGroup,
  } = useHabitStore()
  const { addEvent } = useGrowthEventStore()
  const areas = useAreaStore((s) => s.areas)
  const tr = useT()
  const catLabel = (cat: string) => resolveCatLabel(cat, areas, tr)
  const { showToast } = useToast()
  const [hiddenMode, setHiddenMode] = useState(false)
  const [trashMode, setTrashMode] = useState(false)
  const [addingHabitGroup, setAddingHabitGroup] = useState(false)
  const [newHabitGroupName, setNewHabitGroupName] = useState('')

  const active = habits.filter((h) => !h.deletedAt && !h.isHidden && !h.parentId && (h.status === 'active' || h.status === 'completed_today'))
  const paused = habits.filter((h) => !h.deletedAt && !h.isHidden && !h.parentId && h.status === 'paused')
  const mastered = habits.filter((h) => !h.deletedAt && !h.isHidden && !h.parentId && h.status === 'mastered')
  const hidden = habits.filter((h) => !h.deletedAt && !h.parentId && h.isHidden)
  const deleted = habits.filter((h) => !!h.deletedAt).sort((a, b) => new Date(b.deletedAt!).getTime() - new Date(a.deletedAt!).getTime())

  function handleHide(id: string) {
    hideHabit(id)
    showToast(tr.habit_toastHidden)
  }

  function handleDelete(id: string) {
    deleteHabit(id)
  }

  function handleMaster(habit: Habit) {
    const days = Math.floor((Date.now() - new Date(habit.createdAt).getTime()) / 86400000)
    addEvent({
      type: 'custom_milestone',
      title: habit.title,
      details: {
        sourceType: 'habit',
        categoryName: habit.category,
        difficulty: habit.difficulty,
        consecutiveCount: habit.consecutiveCount,
        totalCompletions: habit.totalCompletions,
        durationDays: days,
      },
      isMilestone: true,
    })
    masterHabit(habit.id)
    showToast(tr.habit_masterToast(habit.title))
  }

  function handleInscribe(habit: Habit) {
    const days = Math.floor((Date.now() - new Date(habit.createdAt).getTime()) / 86400000)
    addEvent({
      type: 'custom_milestone',
      title: habit.title,
      details: {
        sourceType: 'habit',
        categoryName: habit.category,
        difficulty: habit.difficulty,
        consecutiveCount: habit.consecutiveCount,
        totalCompletions: habit.totalCompletions,
        durationDays: days,
      },
      isMilestone: true,
    })
    showToast(`⭐ ${habit.title}`)
  }

  return (
    <>
      {/* 工具栏：添加 + 隐藏/回收站图标 */}
      <div
        className="flex items-center gap-1 px-4 py-2 shrink-0"
        style={{ borderBottom: '1px solid var(--color-border)' }}
      >
        <button
          onClick={onAdd}
          style={{
            fontSize: 12, padding: '4px 14px', borderRadius: 'var(--radius-full)',
            border: '1px solid var(--color-accent)', background: 'color-mix(in srgb, var(--color-accent) 10%, transparent)',
            color: 'var(--color-accent)', cursor: 'pointer', fontWeight: 500, transition: 'all 0.15s',
          }}
        >
          {tr.habits_add}
        </button>
        <div style={{ flex: 1 }} />
        <button
          onClick={() => { setHiddenMode((v) => !v); setTrashMode(false) }}
          title={tr.habits_hiddenTooltip}
          style={{
            fontSize: 12, padding: '4px 10px', borderRadius: 'var(--radius-full)',
            border: `1px solid ${hiddenMode ? 'var(--color-secondary)' : 'var(--color-border)'}`,
            background: hiddenMode ? 'color-mix(in srgb, var(--color-secondary) 10%, transparent)' : 'transparent',
            color: hiddenMode ? 'var(--color-secondary)' : 'var(--color-text-dim)',
            cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all 0.15s',
            display: 'flex', alignItems: 'center', gap: 4, marginRight: 4,
          }}
        >
          <EyeOffIcon />
          {hidden.length > 0 && <span>{hidden.length}</span>}
        </button>
        <button
          onClick={() => { setTrashMode((v) => !v); setHiddenMode(false) }}
          title={tr.habits_trashTooltip}
          style={{
            fontSize: 12, padding: '4px 10px', borderRadius: 'var(--radius-full)',
            border: `1px solid ${trashMode ? 'var(--color-danger)' : 'var(--color-border)'}`,
            background: trashMode ? 'color-mix(in srgb, var(--color-danger) 10%, transparent)' : 'transparent',
            color: trashMode ? 'var(--color-danger)' : 'var(--color-text-dim)',
            cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all 0.15s',
            display: 'flex', alignItems: 'center', gap: 4,
          }}
        >
          <TrashIcon />
          {deleted.length > 0 && <span>{deleted.length}</span>}
        </button>
      </div>

      {hiddenMode ? (
        /* 已隐藏习惯视图 — 与任务一致 */
        <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3">
          {hidden.length === 0 ? (
            <div className="flex flex-col items-center justify-center flex-1" style={{ color: 'var(--color-text-dim)', fontSize: 13, gap: 8, paddingTop: 60 }}>
              <span style={{ fontSize: 32 }}>👁️</span>
              <span>{tr.habits_hiddenEmpty}</span>
            </div>
          ) : (
            <>
              <p style={{ fontSize: 11, color: 'var(--color-text-dim)', margin: 0 }}>{tr.habits_hiddenNote}</p>
              <AnimatePresence mode="popLayout">
                {hidden.map((h) => (
                  <motion.div key={h.id} layout initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: '60%' }}
                    style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: 'var(--color-surface)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', opacity: 0.8 }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, color: 'var(--color-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{h.title}</div>
                      <div style={{ fontSize: 11, color: 'var(--color-text-dim)', marginTop: 2 }}>{catLabel(h.category)} · {getHabitRepeatLabel(h, tr)}</div>
                    </div>
                    <button onClick={() => unhideHabit(h.id)}
                      style={{ fontSize: 11, padding: '3px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-secondary)', background: 'transparent', color: 'var(--color-secondary)', cursor: 'pointer', whiteSpace: 'nowrap' }}
                    >{tr.habit_unhide}</button>
                  </motion.div>
                ))}
              </AnimatePresence>
            </>
          )}
        </div>
      ) : trashMode ? (
        /* 回收站视图 — 与任务一致 */
        <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3">
          {deleted.length === 0 ? (
            <div className="flex flex-col items-center justify-center flex-1" style={{ color: 'var(--color-text-dim)', fontSize: 13, gap: 8, paddingTop: 60 }}>
              <span style={{ fontSize: 32 }}>🗑️</span>
              <span>{tr.habits_trashEmpty}</span>
            </div>
          ) : (
            <>
              <p style={{ fontSize: 11, color: 'var(--color-text-dim)', margin: 0 }}>{tr.habits_trashNote}</p>
              <AnimatePresence mode="popLayout">
                {deleted.map((h) => (
                  <motion.div key={h.id} layout initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: '60%' }}
                    style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: 'var(--color-surface)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', opacity: 0.75 }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, color: 'var(--color-text-dim)', textDecoration: 'line-through', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{h.title}</div>
                      <div style={{ fontSize: 11, color: 'var(--color-text-dim)', marginTop: 2, opacity: 0.7 }}>
                        {catLabel(h.category)} · {formatDeletedDate(h.deletedAt!)}
                      </div>
                    </div>
                    <button onClick={() => restoreHabit(h.id)}
                      style={{ fontSize: 11, padding: '3px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)', background: 'transparent', color: 'var(--color-text-dim)', cursor: 'pointer', whiteSpace: 'nowrap' }}
                    >{tr.habit_restore}</button>
                    <button onClick={() => permanentlyDeleteHabit(h.id)}
                      style={{ fontSize: 11, padding: '3px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-danger)', background: 'transparent', color: 'var(--color-danger)', cursor: 'pointer', whiteSpace: 'nowrap' }}
                    >{tr.habit_deletePerm}</button>
                  </motion.div>
                ))}
              </AnimatePresence>
            </>
          )}
        </div>
      ) : (
        /* 正常习惯列表 */
        <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-4">
          {habits.filter((h) => !h.deletedAt).length === 0 && (
            <div style={{ textAlign: 'center', paddingTop: 48, color: 'var(--color-text-dim)', fontSize: 13 }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>🌱</div>
              {tr.habits_empty}
            </div>
          )}

          {active.length > 0 && (
            <HabitSection title={tr.habits_active} count={active.length}>
              <AnimatePresence mode="popLayout">
                {active.map((h) => (
                  <HabitRow key={h.id} habit={h}
                    onEdit={onEdit} onPause={() => pauseHabit(h.id)}
                    onHide={() => handleHide(h.id)} onDelete={() => handleDelete(h.id)}
                    onMaster={() => handleMaster(h)} onInscribe={() => handleInscribe(h)}
                    onStartPause={() => h.timerStartedAt ? pauseHabitTimer(h.id) : startHabitTimer(h.id)}
                  />
                ))}
              </AnimatePresence>
            </HabitSection>
          )}

          {paused.length > 0 && (
            <HabitSection title={tr.habits_paused} count={paused.length}>
              <AnimatePresence mode="popLayout">
                {paused.map((h) => (
                  <HabitRow key={h.id} habit={h}
                    onEdit={onEdit} onResume={() => resumeHabit(h.id)}
                    onHide={() => handleHide(h.id)} onDelete={() => handleDelete(h.id)}
                    onMaster={() => handleMaster(h)} onInscribe={() => handleInscribe(h)}
                  />
                ))}
              </AnimatePresence>
            </HabitSection>
          )}

          {mastered.length > 0 && (
            <CompletedHabitsSection
              mastered={mastered}
              completedHabitViewMode={completedHabitViewMode}
              setCompletedHabitViewMode={setCompletedHabitViewMode}
              customHabitGroups={customHabitGroups}
              addCustomHabitGroup={addCustomHabitGroup}
              renameCustomHabitGroup={renameCustomHabitGroup}
              deleteCustomHabitGroup={deleteCustomHabitGroup}
              moveHabitToGroup={moveHabitToGroup}
              removeHabitFromGroup={removeHabitFromGroup}
              catLabel={catLabel}
              onEdit={onEdit}
              onDelete={handleDelete}
              onInscribe={handleInscribe}
              tr={tr}
              addingHabitGroup={addingHabitGroup}
              setAddingHabitGroup={setAddingHabitGroup}
              newHabitGroupName={newHabitGroupName}
              setNewHabitGroupName={setNewHabitGroupName}
            />
          )}
        </div>
      )}
    </>
  )
}

// ─── Completed Habits Section (FEAT-07) ─────────────────────────────────────

function CompletedHabitsSection({
  mastered,
  completedHabitViewMode,
  setCompletedHabitViewMode,
  customHabitGroups,
  addCustomHabitGroup,
  renameCustomHabitGroup,
  deleteCustomHabitGroup,
  moveHabitToGroup,
  removeHabitFromGroup,
  catLabel,
  onEdit,
  onDelete,
  onInscribe,
  tr,
  addingHabitGroup,
  setAddingHabitGroup,
  newHabitGroupName,
  setNewHabitGroupName,
}: {
  mastered: Habit[]
  completedHabitViewMode: 'area' | 'custom'
  setCompletedHabitViewMode: (mode: 'area' | 'custom') => void
  customHabitGroups: ReturnType<typeof useHabitStore>['customHabitGroups']
  addCustomHabitGroup: (name: string) => ReturnType<typeof useHabitStore>['customHabitGroups'][number]
  renameCustomHabitGroup: (id: string, name: string) => void
  deleteCustomHabitGroup: (id: string) => void
  moveHabitToGroup: (habitId: string, groupId: string) => void
  removeHabitFromGroup: (habitId: string, groupId: string) => void
  catLabel: (cat: string) => string
  onEdit: (h: Habit) => void
  onDelete: (id: string) => void
  onInscribe: (h: Habit) => void
  tr: ReturnType<typeof useT>
  addingHabitGroup: boolean
  setAddingHabitGroup: (v: boolean) => void
  newHabitGroupName: string
  setNewHabitGroupName: (v: string) => void
}) {
  const modes: Array<{ key: 'area' | 'custom'; label: string }> = [
    { key: 'area', label: tr.task_groupByArea },
    { key: 'custom', label: tr.task_groupCustom },
  ]

  const byArea = useMemo(() => {
    const map = new Map<string, Habit[]>()
    for (const h of mastered) {
      const key = h.category ?? 'other'
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(h)
    }
    return map
  }, [mastered])

  const allGroupedIds = useMemo(() => {
    const ids = new Set<string>()
    for (const g of customHabitGroups) g.habitIds.forEach((id) => ids.add(id))
    return ids
  }, [customHabitGroups])

  const ungrouped = useMemo(
    () => mastered.filter((h) => !allGroupedIds.has(h.id)),
    [mastered, allGroupedIds]
  )

  function handleAddGroup() {
    const name = newHabitGroupName.trim()
    if (!name) return
    addCustomHabitGroup(name)
    setNewHabitGroupName('')
    setAddingHabitGroup(false)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {/* Header with mode switcher */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text)', letterSpacing: '0.02em', marginRight: 4 }}>
          {tr.habits_mastered}
        </span>
        <span style={{ fontSize: 11, color: 'var(--color-text-dim)', background: 'var(--color-surface-hover)', padding: '1px 6px', borderRadius: 'var(--radius-full)' }}>
          {mastered.length}
        </span>
        <div style={{ flex: 1 }} />
        <div style={{ display: 'flex', gap: 2 }}>
          {modes.map((m) => (
            <button
              key={m.key}
              onClick={() => setCompletedHabitViewMode(m.key)}
              style={{
                fontSize: 11, padding: '2px 8px', borderRadius: 'var(--radius-full)', border: 'none',
                background: completedHabitViewMode === m.key ? 'color-mix(in srgb, var(--color-accent) 15%, transparent)' : 'transparent',
                color: completedHabitViewMode === m.key ? 'var(--color-accent)' : 'var(--color-text-dim)',
                cursor: 'pointer', fontWeight: completedHabitViewMode === m.key ? 600 : 400, transition: 'all 0.15s',
              }}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {/* By Area */}
      {completedHabitViewMode === 'area' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {Array.from(byArea.entries()).map(([area, habits]) => (
            <CollapsibleGroup key={area} label={catLabel(area)} count={habits.length} defaultOpen={true}>
              <AnimatePresence mode="popLayout">
                {habits.map((h) => (
                  <HabitRow key={h.id} habit={h} onEdit={onEdit} onDelete={() => onDelete(h.id)} onInscribe={() => onInscribe(h)} dim />
                ))}
              </AnimatePresence>
            </CollapsibleGroup>
          ))}
        </div>
      )}

      {/* Custom */}
      {completedHabitViewMode === 'custom' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {customHabitGroups.map((group) => {
            const groupHabits = mastered.filter((h) => group.habitIds.includes(h.id))
            return (
              <CollapsibleGroup
                key={group.id}
                label={group.name}
                count={groupHabits.length}
                defaultOpen={true}
                onRename={(name) => renameCustomHabitGroup(group.id, name)}
                onDelete={() => deleteCustomHabitGroup(group.id)}
              >
                <AnimatePresence mode="popLayout">
                  {groupHabits.map((h) => (
                    <HabitRow key={h.id} habit={h} onEdit={onEdit} onDelete={() => onDelete(h.id)} onInscribe={() => onInscribe(h)} dim />
                  ))}
                </AnimatePresence>
              </CollapsibleGroup>
            )
          })}

          {ungrouped.length > 0 && (
            <CollapsibleGroup label={tr.task_ungrouped} count={ungrouped.length} defaultOpen={true}>
              <AnimatePresence mode="popLayout">
                {ungrouped.map((h) => (
                  <HabitRow key={h.id} habit={h} onEdit={onEdit} onDelete={() => onDelete(h.id)} onInscribe={() => onInscribe(h)} dim />
                ))}
              </AnimatePresence>
            </CollapsibleGroup>
          )}

          {addingHabitGroup ? (
            <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
              <input
                autoFocus
                value={newHabitGroupName}
                onChange={(e) => setNewHabitGroupName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleAddGroup()
                  if (e.key === 'Escape') { setAddingHabitGroup(false); setNewHabitGroupName('') }
                }}
                placeholder={tr.task_groupNamePlaceholder}
                style={{
                  flex: 1, fontSize: 12, padding: '4px 8px', borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--color-accent)', background: 'var(--color-surface)',
                  color: 'var(--color-text)', outline: 'none',
                }}
              />
              <button onClick={handleAddGroup} style={{ fontSize: 12, padding: '4px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-accent)', background: 'color-mix(in srgb, var(--color-accent) 12%, transparent)', color: 'var(--color-accent)', cursor: 'pointer' }}>✓</button>
              <button onClick={() => { setAddingHabitGroup(false); setNewHabitGroupName('') }} style={{ fontSize: 12, padding: '4px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)', background: 'transparent', color: 'var(--color-text-dim)', cursor: 'pointer' }}>✕</button>
            </div>
          ) : (
            <button
              onClick={() => setAddingHabitGroup(true)}
              style={{
                fontSize: 12, padding: '4px 12px', borderRadius: 'var(--radius-sm)',
                border: '1px dashed var(--color-border)', background: 'transparent',
                color: 'var(--color-text-dim)', cursor: 'pointer', alignSelf: 'flex-start', transition: 'all 0.15s',
              }}
            >
              + {tr.task_newGroup}
            </button>
          )}
        </div>
      )}
    </div>
  )
}

function HabitSection({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text)', letterSpacing: '0.02em' }}>{title}</span>
        <span style={{ fontSize: 11, color: 'var(--color-text-dim)', background: 'var(--color-surface-hover)', padding: '1px 6px', borderRadius: 'var(--radius-full)' }}>{count}</span>
      </div>
      {children}
    </div>
  )
}

function HabitRow({
  habit,
  onEdit,
  onPause,
  onResume,
  onHide,
  onDelete,
  onMaster,
  onInscribe,
  onStartPause,
  dim,
}: {
  habit: Habit
  onEdit?: (habit: Habit) => void
  onPause?: () => void
  onResume?: () => void
  onHide?: () => void
  onDelete?: () => void
  onMaster?: () => void
  onInscribe?: () => void
  onStartPause?: () => void
  dim?: boolean
}) {
  const tr = useT()
  const areas = useAreaStore((s) => s.areas)
  const allHabits = useHabitStore((s) => s.habits)
  const catLabel = (cat: string) => resolveCatLabel(cat, areas, tr)
  const repeatLabel = getHabitRepeatLabel(habit, tr)
  const [hovered, setHovered] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const deleteTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isDoing = !!habit.timerStartedAt

  const children = allHabits.filter((c) => !c.deletedAt && !c.isHidden && (habit.childIds ?? []).includes(c.id))

  function handleDeleteClick() {
    if (!deleteConfirm) {
      setDeleteConfirm(true)
      if (deleteTimer.current) clearTimeout(deleteTimer.current)
      deleteTimer.current = setTimeout(() => setDeleteConfirm(false), 3000)
      return
    }
    setDeleteConfirm(false)
    onDelete?.()
  }

  return (
    <div>
      <motion.div
        layout
        initial={{ opacity: 0, y: -6 }}
        animate={{ opacity: dim ? 0.6 : 1, y: 0 }}
        exit={{ opacity: 0, height: 0 }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => { setHovered(false); setDeleteConfirm(false) }}
        style={{
          padding: '10px 12px',
          background: 'var(--color-surface)',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--color-border)',
          cursor: onEdit ? 'pointer' : 'default',
        }}
        whileHover={{ boxShadow: 'var(--shadow-md)' }}
        onClick={() => onEdit?.(habit)}
      >
        {/* 标题行 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {children.length > 0 && (
            <span style={{ fontSize: 10, color: 'var(--color-text-dim)', flexShrink: 0 }}>▶</span>
          )}
          <span style={{
            fontSize: 14, color: dim ? 'var(--color-text-dim)' : isDoing ? 'var(--color-accent)' : 'var(--color-text)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1,
            textDecoration: dim ? 'line-through' : 'none',
            fontWeight: isDoing ? 600 : 400,
          }}>
            {habit.title}
          </span>
          {onStartPause && (
            <button
              onClick={(e) => { e.stopPropagation(); onStartPause() }}
              title={isDoing ? tr.habit_pauseDoing : tr.habit_startDoing}
              style={{
                width: 26, height: 26, borderRadius: 'var(--radius-sm)',
                border: `1px solid ${isDoing ? 'var(--color-accent)' : 'var(--color-border)'}`,
                background: isDoing ? 'color-mix(in srgb, var(--color-accent) 15%, transparent)' : 'transparent',
                color: isDoing ? 'var(--color-accent)' : 'var(--color-text-dim)',
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0, transition: 'all 0.15s', padding: 0,
              }}
            >
              {isDoing ? (
                <svg width="9" height="9" viewBox="0 0 10 10" fill="currentColor">
                  <rect x="2" y="2" width="2.5" height="6" rx="0.5"/>
                  <rect x="5.5" y="2" width="2.5" height="6" rx="0.5"/>
                </svg>
              ) : (
                <svg width="9" height="9" viewBox="0 0 10 10" fill="currentColor">
                  <path d="M3 2l5 3-5 3V2z"/>
                </svg>
              )}
            </button>
          )}
        </div>
        {/* 元信息行 */}
        <div style={{ fontSize: 12, color: 'var(--color-text-dim)', marginTop: 4, display: 'flex', gap: 12 }}>
          <span>{catLabel(habit.category)}</span>
          <span>{repeatLabel}</span>
          {habit.consecutiveCount > 0 && (
            <span style={{ color: 'var(--color-xp)', fontFamily: 'var(--font-num)', fontWeight: 600 }}>🔥{habit.consecutiveCount}</span>
          )}
          {(habit.childIds ?? []).length > 0 && (
            <span>{tr.task_subtasks((habit.childIds ?? []).length)}</span>
          )}
        </div>
        {/* hover 操作栏（和 TaskItem 一致的文字按钮风格） */}
        <AnimatePresence>
          {hovered && (
            <motion.div
              initial={{ opacity: 0, x: -4 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -4 }}
              transition={{ duration: 0.15 }}
              style={{ display: 'flex', gap: 4, marginTop: 6 }}
              onClick={(e) => e.stopPropagation()}
            >
              {onPause && <HabitTextBtn onClick={onPause}>{tr.habit_pause}</HabitTextBtn>}
              {onResume && <HabitTextBtn onClick={onResume} color="var(--color-success)">{tr.habit_resume}</HabitTextBtn>}
              {onInscribe && <HabitTextBtn onClick={onInscribe} color="var(--color-xp)">⭐ {tr.habit_inscribe}</HabitTextBtn>}
              {onMaster && <HabitTextBtn onClick={onMaster} color="var(--color-success)">{tr.habit_master}</HabitTextBtn>}
              {onHide && <HabitTextBtn onClick={onHide}>{tr.habit_hide}</HabitTextBtn>}
              {onDelete && (
                <HabitTextBtn
                  onClick={handleDeleteClick}
                  color={deleteConfirm ? 'var(--color-danger, #dc2626)' : undefined}
                  borderColor={deleteConfirm ? 'var(--color-danger, #dc2626)' : undefined}
                >
                  {deleteConfirm ? tr.habit_deleteConfirm : tr.habit_delete}
                </HabitTextBtn>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* 子习惯 */}
      {children.length > 0 && (
        <div style={{ paddingLeft: 20, marginTop: 4, display: 'flex', flexDirection: 'column', gap: 4, borderLeft: '2px solid var(--color-border)', marginLeft: 8 }}>
          {children.map((child) => (
            <HabitRow key={child.id} habit={child} onEdit={onEdit} dim={dim} />
          ))}
        </div>
      )}
    </div>
  )
}

function HabitTextBtn({ children, onClick, color, borderColor }: { children: React.ReactNode; onClick: () => void; color?: string; borderColor?: string }) {
  return (
    <button
      onClick={onClick}
      style={{
        fontSize: 11, padding: '2px 8px', borderRadius: 'var(--radius-sm)',
        border: `1px solid ${borderColor ?? 'var(--color-border)'}`, background: 'transparent',
        color: color ?? 'var(--color-text-dim)', cursor: 'pointer', transition: 'all 0.15s', whiteSpace: 'nowrap',
      }}
    >
      {children}
    </button>
  )
}

function getHabitRepeatLabel(habit: Habit, tr: ReturnType<typeof useT>): string {
  const repeatKey = `repeat_${habit.repeatType}` as keyof ReturnType<typeof useT>
  const base = (tr[repeatKey] as string) ?? habit.repeatType
  if (habit.repeatType === 'weekly') {
    if (habit.weeklyMode === 'flexible' && habit.weeklyFlexibleCount)
      return tr.habitRepeatLabel_weekly(habit.weeklyFlexibleCount)
    if (habit.weeklyMode === 'strict' && habit.weeklyDays?.length) {
      const dayLabels = habit.weeklyDays.map((d) => (tr[`weekday_${d}` as keyof ReturnType<typeof useT>] as string) ?? d)
      return tr.habitRepeatLabel_weekDays(dayLabels.join('/'))
    }
  }
  if (habit.repeatType === 'custom' && habit.customIntervalDays) {
    const suffix = (habit.targetCount ?? 1) > 1 ? tr.habitRepeatLabel_targetSuffix(habit.targetCount!) : ''
    return tr.habitRepeatLabel_custom(habit.customIntervalDays, suffix)
  }
  if (habit.repeatType === 'monthly_fixed' && habit.monthlyDays?.length) {
    const days = habit.monthlyDays.map((d) => d === -1 ? tr.habitRepeatLabel_monthEndDay : tr.habitRepeatLabel_monthDay(d)).join('/')
    return tr.habitRepeatLabel_monthFixed(days)
  }
  if (habit.repeatType === 'monthly' && (habit.targetCount ?? 1) > 1)
    return tr.habitRepeatLabel_monthFlexible(habit.targetCount!)
  if ((habit.targetCount ?? 1) > 1) return `${base}${tr.habitRepeatLabel_targetSuffix(habit.targetCount!)}`
  return base
}
