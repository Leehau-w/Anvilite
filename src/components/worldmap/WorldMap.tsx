import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import { AnimatePresence, motion, Reorder } from 'framer-motion'
import { useAreaStore } from '@/stores/areaStore'
import { useTaskStore } from '@/stores/taskStore'
import { useHabitStore } from '@/stores/habitStore'
import type { Area } from '@/types/area'
import { AreaCard } from './AreaCard'
import { AddAreaModal } from './AddAreaModal'
import { InteriorSpace } from '@/components/interior/InteriorSpace'
import { getProsperityInfo, getAreaSkillXP } from '@/engines/prosperityEngine'
import { useT } from '@/i18n'
import { getAreaDisplayName } from '@/utils/area'
import { computeOptimalCols } from '@/utils/grid'

export { computeOptimalCols }

const CARD_ASPECT = 1
const CARD_GAP = 16

export function WorldMap() {
  const { areas, addArea, updateArea, removeArea, reorderAreas, canAddMore, getUsedTemplateIds } = useAreaStore()
  const tasks = useTaskStore((s) => s.tasks)
  const habits = useHabitStore((s) => s.habits)
  const t = useT()

  const [editMode, setEditMode] = useState(false)
  const [showAddModal, setShowAddModal] = useState(false)
  const [interiorAreaId, setInteriorAreaId] = useState<string | null>(null)
  const [renamingAreaId, setRenamingAreaId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<Area | null>(null)

  const sortedAreas = useMemo(
    () => [...areas].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)),
    [areas]
  )

  // 用于拖拽排序的本地状态
  const [localOrder, setLocalOrder] = useState<Area[]>(sortedAreas)
  const isDraggingRef = useRef(false)

  // 自适应列数：ResizeObserver 监听网格容器内容区尺寸
  const containerRef = useRef<HTMLDivElement>(null)
  const [cols, setCols] = useState(3)

  const totalCards = sortedAreas.length + (canAddMore() ? 1 : 0)

  const computeCols = useCallback((W: number, H: number) => {
    setCols(computeOptimalCols(W, H, totalCards))
  }, [totalCards])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const obs = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect
      computeCols(width, height)
    })
    obs.observe(el)
    // 初始计算（contentRect 在首次 observe 后触发，这里也主动读一次）
    const s = getComputedStyle(el)
    const pw = parseFloat(s.paddingLeft) + parseFloat(s.paddingRight)
    const ph = parseFloat(s.paddingTop) + parseFloat(s.paddingBottom)
    const r = el.getBoundingClientRect()
    computeCols(r.width - pw, r.height - ph)
    return () => obs.disconnect()
  }, [computeCols])

  React.useEffect(() => {
    if (!isDraggingRef.current) setLocalOrder(sortedAreas)
  }, [sortedAreas])

  const interiorArea = areas.find((a) => a.id === interiorAreaId)

  function handleAreaClick(areaId: string) {
    if (editMode) return
    setInteriorAreaId(areaId)
  }

  function handleBack() {
    setInteriorAreaId(null)
  }

  function handleRename(id: string) {
    const area = areas.find((a) => a.id === id)
    if (!area) return
    setRenamingAreaId(id)
    setRenameValue(getAreaDisplayName(area, t))
  }

  function commitRename() {
    if (!renamingAreaId || !renameValue.trim()) return
    updateArea(renamingAreaId, { name: renameValue.trim() })
    setRenamingAreaId(null)
  }

  function handleDeleteRequest(id: string) {
    const area = areas.find((a) => a.id === id)
    if (!area) return
    setDeleteTarget(area)
  }

  function getAreaBlockers(area: Area) {
    const taskCount = tasks.filter((t) => !t.deletedAt && t.category === area.category).length
    const habitCount = habits.filter((h) => !h.deletedAt && h.category === area.category).length
    return { taskCount, habitCount }
  }

  function confirmDelete() {
    if (!deleteTarget) return
    removeArea(deleteTarget.id)
    setDeleteTarget(null)
  }

  function handleDragEnd() {
    isDraggingRef.current = false
    reorderAreas(localOrder.map((a) => a.id))
  }

  const showInterior = !!(interiorAreaId && interiorArea)

  return (
    <div style={{ height: '100%', position: 'relative' }}>
      {/* 区域内部（始终挂载，用 display 切换） */}
      <div style={{ display: showInterior ? 'block' : 'none', height: '100%' }}>
        {interiorArea && (() => {
          const skillXP = getAreaSkillXP(tasks, interiorArea.category)
          const prosperity = getProsperityInfo(skillXP)
          return <InteriorSpace area={interiorArea} prosperity={prosperity} onExit={handleBack} />
        })()}
      </div>

      {/* 地图主视图（始终挂载，containerRef 不丢失） */}
      <div style={{ display: showInterior ? 'none' : 'flex', height: '100%', flexDirection: 'column', background: 'var(--color-bg)', overflow: 'hidden' }}>
      {/* 顶部工具栏 */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '16px 24px 12px', flexShrink: 0,
      }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: 'var(--color-text)' }}>
            {t.worldmap_title ?? '世界地图'}
          </h2>
          <span style={{ fontSize: 12, color: 'var(--color-text-dim)' }}>
            {t.worldmap_areaCount(areas.length)}
          </span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {editMode && canAddMore() && (
            <button
              onClick={() => setShowAddModal(true)}
              style={{
                fontSize: 12, padding: '6px 14px', borderRadius: 'var(--radius-md)',
                border: '1px solid var(--color-accent)',
                background: 'color-mix(in srgb, var(--color-accent) 10%, transparent)',
                color: 'var(--color-accent)', cursor: 'pointer', fontWeight: 600,
              }}
            >
              {t.worldmap_addArea}
            </button>
          )}
          <button
            onClick={() => setEditMode((v) => !v)}
            style={{
              fontSize: 12, padding: '6px 14px', borderRadius: 'var(--radius-md)',
              border: `1px solid ${editMode ? 'var(--color-accent)' : 'var(--color-border)'}`,
              background: editMode ? 'color-mix(in srgb, var(--color-accent) 12%, transparent)' : 'transparent',
              color: editMode ? 'var(--color-accent)' : 'var(--color-text-dim)',
              cursor: 'pointer', fontWeight: 600, transition: 'all 0.15s',
            }}
          >
            {editMode ? t.worldmap_editDone : t.worldmap_edit}
          </button>
        </div>
      </div>

      {/* 卡片网格 */}
      <div
        ref={containerRef}
        style={{ flex: 1, overflowY: 'auto', padding: '8px 24px 24px' }}
      >
        {editMode ? (
          // 编辑模式：单列列表，拖拽排序正常工作
          <Reorder.Group
            axis="y"
            values={localOrder}
            onReorder={(newOrder) => {
              isDraggingRef.current = true
              setLocalOrder(newOrder)
            }}
            style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}
          >
            {localOrder.map((area) => (
              <Reorder.Item
                key={area.id}
                value={area}
                onDragEnd={handleDragEnd}
                style={{ listStyle: 'none' }}
              >
                <AreaEditRow
                  area={area}
                  onRename={handleRename}
                  onDelete={handleDeleteRequest}
                  t={t}
                />
              </Reorder.Item>
            ))}
          </Reorder.Group>
        ) : (
          // 普通模式：静态网格
          <div style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${cols}, 1fr)`,
            gap: CARD_GAP,
          }}>
            <AnimatePresence>
              {sortedAreas.map((area) => (
                <AreaCard
                  key={area.id}
                  area={area}
                  editMode={false}
                  onClick={() => handleAreaClick(area.id)}
                  onRename={handleRename}
                  onDelete={handleDeleteRequest}
                />
              ))}
            </AnimatePresence>

            {/* 添加区域占位卡（非编辑模式也显示入口） */}
            {canAddMore() && (
              <motion.button
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                onClick={() => { setEditMode(true); setShowAddModal(true) }}
                style={{
                  aspectRatio: `${CARD_ASPECT}`,
                  border: '2px dashed var(--color-border)',
                  borderRadius: 'var(--radius-xl)',
                  display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'center',
                  gap: 8,
                  color: 'var(--color-text-dim)',
                  background: 'transparent', cursor: 'pointer',
                  fontSize: 13, transition: 'border-color 0.15s, color 0.15s',
                  width: '100%',
                }}
                whileHover={{ borderColor: 'var(--color-accent)', color: 'var(--color-accent)' } as any}
              >
                <span style={{ fontSize: 24 }}>+</span>
                <span>{t.worldmap_addArea}</span>
              </motion.button>
            )}
          </div>
        )}
      </div>

      {/* 添加区域 Modal */}
      <AnimatePresence>
        {showAddModal && (
          <AddAreaModal
            usedTemplateIds={getUsedTemplateIds()}
            areaCount={areas.length}
            onClose={() => setShowAddModal(false)}
            onAdd={(templateId, customName) => {
              addArea(templateId, customName)
              setShowAddModal(false)
            }}
          />
        )}
      </AnimatePresence>

      {/* 改名对话框 */}
      <AnimatePresence>
        {renamingAreaId && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}
            onClick={() => setRenamingAreaId(null)}
          >
            <motion.div
              initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }}
              onClick={(e) => e.stopPropagation()}
              style={{ background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)', padding: 20, display: 'flex', flexDirection: 'column', gap: 12, width: 280 }}
            >
              <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text)' }}>{t.worldmap_renameTitle}</span>
              <input
                autoFocus value={renameValue} maxLength={10}
                onChange={(e) => setRenameValue(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') commitRename(); if (e.key === 'Escape') setRenamingAreaId(null) }}
                style={{ height: 36, padding: '0 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', background: 'var(--color-bg)', color: 'var(--color-text)', fontSize: 14, outline: 'none' }}
              />
              <span style={{ fontSize: 11, color: renameValue.length >= 10 ? '#dc2626' : 'var(--color-text-dim)', textAlign: 'right' }}>{renameValue.length}/10</span>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button onClick={() => setRenamingAreaId(null)} style={ghostBtnStyle}>{t.worldmap_renameCancel}</button>
                <button onClick={commitRename} style={primaryBtnStyle}>{t.worldmap_renameConfirm}</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 删除确认对话框 */}
      <AnimatePresence>
        {deleteTarget && (() => {
          const { taskCount, habitCount } = getAreaBlockers(deleteTarget)
          const hasBlockers = taskCount > 0 || habitCount > 0
          return (
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}
              onClick={() => setDeleteTarget(null)}
            >
              <motion.div
                initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }}
                onClick={(e) => e.stopPropagation()}
                style={{ background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)', padding: 20, display: 'flex', flexDirection: 'column', gap: 14, width: 320 }}
              >
                <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-text)' }}>
                  {t.worldmap_deleteTitle(getAreaDisplayName(deleteTarget, t))}
                </span>
                {hasBlockers ? (
                  <>
                    <p style={{ margin: 0, fontSize: 13, color: 'var(--color-warning)', lineHeight: 1.6 }}>
                      {t.worldmap_deleteBlockers}
                      {taskCount > 0 && <><br />• {t.worldmap_deleteBlockerTasks(taskCount)}</>}
                      {habitCount > 0 && <><br />• {t.worldmap_deleteBlockerHabits(habitCount)}</>}
                      <br />{t.worldmap_deleteMoveFirst}
                    </p>
                    <button onClick={() => setDeleteTarget(null)} style={primaryBtnStyle}>{t.worldmap_deleteGotIt}</button>
                  </>
                ) : (
                  <>
                    <p style={{ margin: 0, fontSize: 13, color: 'var(--color-text-dim)', lineHeight: 1.6 }}>{t.worldmap_deleteWarning}</p>
                    <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                      <button onClick={() => setDeleteTarget(null)} style={ghostBtnStyle}>{t.worldmap_deleteCancel}</button>
                      <button onClick={confirmDelete} style={{ ...primaryBtnStyle, background: 'var(--color-danger)' }}>{t.worldmap_deleteConfirm}</button>
                    </div>
                  </>
                )}
              </motion.div>
            </motion.div>
          )
        })()}
      </AnimatePresence>
      </div>  {/* 地图主视图 end */}
    </div>
  )
}

function AreaEditRow({
  area,
  onRename,
  onDelete,
  t,
}: {
  area: Area
  onRename: (id: string) => void
  onDelete: (id: string) => void
  t: ReturnType<typeof useT>
}) {
  const displayName = getAreaDisplayName(area, t)
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '10px 14px',
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-md)',
        cursor: 'grab',
        userSelect: 'none',
      }}
    >
      {/* 拖拽手柄 */}
      <span style={{ fontSize: 16, color: 'var(--color-text-dim)', flexShrink: 0 }}>⠿</span>

      {/* 名称 */}
      <span style={{ flex: 1, fontSize: 14, color: 'var(--color-text)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {displayName}
      </span>

      {/* 重命名 */}
      <button
        onClick={(e) => { e.stopPropagation(); onRename(area.id) }}
        title={t.worldmap_rename ?? '重命名'}
        style={{ ...editRowBtnStyle }}
      >
        ✏
      </button>

      {/* 删除 */}
      {area.canDelete && (
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(area.id) }}
          title={t.worldmap_delete ?? '删除'}
          style={{ ...editRowBtnStyle, color: 'var(--color-danger)', borderColor: 'var(--color-danger)' }}
        >
          ✕
        </button>
      )}
    </div>
  )
}

const editRowBtnStyle: React.CSSProperties = {
  padding: '3px 10px',
  fontSize: 12,
  borderRadius: 'var(--radius-sm)',
  border: '1px solid var(--color-border)',
  background: 'transparent',
  color: 'var(--color-text-dim)',
  cursor: 'pointer',
  flexShrink: 0,
}

const ghostBtnStyle: React.CSSProperties = {
  padding: '6px 14px', borderRadius: 'var(--radius-md)',
  border: '1px solid var(--color-border)', background: 'transparent',
  color: 'var(--color-text-dim)', cursor: 'pointer', fontSize: 13,
}

const primaryBtnStyle: React.CSSProperties = {
  padding: '6px 14px', borderRadius: 'var(--radius-md)',
  border: 'none', background: 'var(--color-accent)',
  color: 'white', cursor: 'pointer', fontSize: 13, fontWeight: 600,
}
