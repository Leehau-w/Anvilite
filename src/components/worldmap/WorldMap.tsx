import React, { useRef, useState, useEffect, useCallback } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useAreaStore, CANVAS_W } from '@/stores/areaStore'
import { useTaskStore } from '@/stores/taskStore'
import { useCharacterStore } from '@/stores/characterStore'
import { useHabitStore } from '@/stores/habitStore'
import { useGrowthEventStore } from '@/stores/growthEventStore'
import { useToast } from '@/components/feedback/Toast'
import { getProsperityInfo, getAreaSkillXP } from '@/engines/prosperityEngine'
import type { ProsperityInfo } from '@/engines/prosperityEngine'
import type { Area } from '@/types/area'
import { AREA_TEMPLATES, PROSPERITY_NAMES } from '@/types/area'
import { AreaNode } from './AreaNode'
import { AreaInfoBar } from './AreaInfoBar'
import { AddAreaModal } from './AddAreaModal'
import { InteriorSpace } from '@/components/interior/InteriorSpace'
import { ArchiveSpace } from '@/components/interior/ArchiveSpace'
import { useT } from '@/i18n'
import { getAreaDisplayName } from '@/utils/area'

export function WorldMap() {
  const { areas, addArea, updateArea, removeArea, canAddMore, getUsedTemplateIds } = useAreaStore()
  const { tasks } = useTaskStore()
  const { habits } = useHabitStore()
  const { character } = useCharacterStore()
  const { addEvent } = useGrowthEventStore()
  const { showToast } = useToast()
  const t = useT()

  const viewportRef = useRef<HTMLDivElement>(null)
  const dragAreaRef = useRef<{ areaId: string; startX: number; startY: number; origPos: { x: number; y: number } } | null>(null)
  const prevProsperityRef = useRef<Record<string, number>>({})
  const mountedRef = useRef(false)

  const [selectedAreaId, setSelectedAreaId] = useState<string | null>(null)
  const [isEditMode, setIsEditMode] = useState(false)
  const [showAddModal, setShowAddModal] = useState(false)
  const [interiorAreaId, setInteriorAreaId] = useState<string | null>(null)
  const [renamingAreaId, setRenamingAreaId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<Area | null>(null)
  const [glowingAreaIds, setGlowingAreaIds] = useState<Set<string>>(new Set())
  const [isTransitioning, setIsTransitioning] = useState(false)
  const [vpSize, setVpSize] = useState({ w: 1280, h: 800 })

  // ── 跟踪视口大小 ──────────────────────────────────────────────
  useEffect(() => {
    const vp = viewportRef.current
    if (!vp) return
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect
      if (width > 0 && height > 0) setVpSize({ w: width, h: height })
    })
    ro.observe(vp)
    setVpSize({ w: vp.clientWidth, h: vp.clientHeight })
    return () => ro.disconnect()
  }, [])

  const CANVAS_H = CANVAS_W * 0.625
  const autoScale = Math.min(vpSize.w / CANVAS_W, vpSize.h / CANVAS_H, 1) // 不超过 1:1
  const offsetX = (vpSize.w - CANVAS_W * autoScale) / 2
  const offsetY = (vpSize.h - CANVAS_H * autoScale) / 2

  // ── ESC 键退出区域 ──────────────────────────────────────────────
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && interiorAreaId) handleExitInterior()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [interiorAreaId])

  // ── 繁荣度升级检测 ──────────────────────────────────────────────
  useEffect(() => {
    const current: Record<string, number> = {}
    for (const area of areas) {
      current[area.id] = getAreaProsperity(area).prosperityLevel
    }

    if (!mountedRef.current) {
      // 首次挂载：记录初始值，不触发通知
      mountedRef.current = true
      prevProsperityRef.current = current
      return
    }

    for (const area of areas) {
      const prev = prevProsperityRef.current[area.id] ?? 1
      const now = current[area.id]
      if (now > prev) {
        // 繁荣升级！
        const levelName = PROSPERITY_NAMES[now - 1]
        const displayName = getAreaDisplayName(area, t)
        showToast(t.worldmap_levelUpToast(displayName, levelName))
        addEvent({
          type: 'area_level_up',
          title: t.worldmap_levelUpEvent(area.name, levelName),
          details: { areaName: area.name, prosperityLevel: now },
          isMilestone: now >= 4,
        })
        // 触发发光动画
        setGlowingAreaIds((s) => new Set([...s, area.id]))
        setTimeout(() => {
          setGlowingAreaIds((s) => { const n = new Set(s); n.delete(area.id); return n })
        }, 1500)
      }
    }

    prevProsperityRef.current = current
  }, [tasks, character.level])

  // ── 繁荣度计算 ──────────────────────────────────────────────────
  function getAreaProsperity(area: Area): ProsperityInfo {
    if (area.category === '_milestone') {
      const skillLevel = character.level
      const pl = skillLevel === 0 ? 1 : skillLevel <= 3 ? 2 : skillLevel <= 8 ? 3 : skillLevel <= 15 ? 4 : skillLevel <= 25 ? 5 : 6
      return { skillLevel, prosperityLevel: pl, prosperityName: PROSPERITY_NAMES[pl - 1], subLevelCurrent: 0, subLevelTotal: 1, subLevelFraction: 0, totalSkillXP: 0 }
    }
    return getProsperityInfo(getAreaSkillXP(tasks, area.category))
  }

  // ── 鼠标事件 ───────────────────────────────────────────────────
  const onMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragAreaRef.current) return
    const { areaId, startX, startY, origPos } = dragAreaRef.current
    const dx = (e.clientX - startX) / autoScale
    const dy = (e.clientY - startY) / autoScale
    const newX = Math.max(50, Math.min(CANVAS_W - 50, origPos.x + dx))
    const newY = Math.max(50, Math.min(CANVAS_H - 50, origPos.y + dy))
    updateArea(areaId, { position: { x: newX, y: newY } })
  }, [autoScale])

  const onMouseUp = useCallback((e: React.MouseEvent) => {
    dragAreaRef.current = null
    if (!(e.target as HTMLElement).closest('[data-area-node]')) {
      setSelectedAreaId(null)
    }
  }, [])

  const onMouseLeave = useCallback(() => {
    dragAreaRef.current = null
  }, [])

  // ── 区域拖拽 ───────────────────────────────────────────────────
  function handleAreaDragStart(areaId: string, e: React.PointerEvent) {
    e.stopPropagation()
    const area = areas.find((a) => a.id === areaId)
    if (!area) return
    dragAreaRef.current = { areaId, startX: e.clientX, startY: e.clientY, origPos: { ...area.position } }
  }

  // ── 改名 ────────────────────────────────────────────────────────
  function handleRename(areaId: string) {
    const area = areas.find((a) => a.id === areaId)
    if (!area) return
    setRenamingAreaId(areaId)
    setRenameValue(area.name)
  }

  function commitRename() {
    if (renamingAreaId && renameValue.trim()) updateArea(renamingAreaId, { name: renameValue.trim() })
    setRenamingAreaId(null)
  }

  // ── 删除区域（带检查）─────────────────────────────────────────
  function handleDeleteRequest(area: Area) {
    setDeleteTarget(area)
  }

  function confirmDelete() {
    if (!deleteTarget) return
    removeArea(deleteTarget.id)
    setDeleteTarget(null)
  }

  function getAreaBlockers(area: Area) {
    const taskCount = tasks.filter((t) => !t.deletedAt && t.category === area.category).length
    const habitCount = habits.filter((h) => h.status !== 'archived' && h.category === area.category).length
    return { taskCount, habitCount }
  }

  // ── 进入 / 退出区域 ─────────────────────────────────────────────
  function handleEnterArea() {
    if (!selectedAreaId) return
    setIsTransitioning(true)
    setInteriorAreaId(selectedAreaId)
    setSelectedAreaId(null)
    setTimeout(() => setIsTransitioning(false), 500)
  }

  function handleExitInterior() {
    setIsTransitioning(true)
    setInteriorAreaId(null)
    setTimeout(() => setIsTransitioning(false), 400)
  }

  const selectedArea = areas.find((a) => a.id === selectedAreaId)
  const interiorArea = areas.find((a) => a.id === interiorAreaId)

  // ── 渲染 ────────────────────────────────────────────────────────
  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden', background: 'var(--color-bg)' }}>
      {/* ── 地图视图（始终挂载，进入区域时淡出） ──────────────── */}
      <motion.div
        animate={{ opacity: interiorAreaId ? 0 : 1, scale: interiorAreaId ? 1.08 : 1 }}
        transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
        style={{ width: '100%', height: '100%', position: 'absolute', inset: 0, pointerEvents: interiorAreaId ? 'none' : 'auto' }}
      >
        {/* 地图视口 */}
        <div
          ref={viewportRef}
          style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden', userSelect: 'none', pointerEvents: isTransitioning ? 'none' : 'auto' }}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onMouseLeave={onMouseLeave}
          onClick={(e) => { if (!(e.target as HTMLElement).closest('[data-area-node]')) setSelectedAreaId(null) }}
        >
          {/* 画布（自动缩放适配视口） */}
          <div
            style={{
              position: 'absolute',
              width: CANVAS_W,
              height: CANVAS_H,
              left: offsetX,
              top: offsetY,
              transform: `scale(${autoScale})`,
              transformOrigin: '0 0',
            }}
          >
            {isEditMode && (
              <div style={{ position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(circle, var(--color-border) 1px, transparent 1px)', backgroundSize: '40px 40px', opacity: 0.4 }} />
            )}

            {areas.map((area) => {
              const prosperity = getAreaProsperity(area)
              return (
                <AreaNode
                  key={area.id}
                  area={area}
                  prosperity={prosperity}
                  isSelected={selectedAreaId === area.id}
                  isEditMode={isEditMode}
                  glowing={glowingAreaIds.has(area.id)}
                  onSelect={() => { if (!isEditMode) setSelectedAreaId((prev) => prev === area.id ? null : area.id) }}
                  onEdit={() => handleRename(area.id)}
                  onDelete={() => handleDeleteRequest(area)}
                  onDragStart={(e) => handleAreaDragStart(area.id, e)}
                />
              )
            })}
          </div>
        </div>

        {/* 顶部控制栏 */}
        <div style={{ position: 'absolute', top: 12, right: 12, display: 'flex', gap: 8, zIndex: 10 }}>
          <MapButton onClick={() => { setIsEditMode((v) => !v); setSelectedAreaId(null) }} active={isEditMode}>{isEditMode ? t.worldmap_editDone : t.worldmap_edit}</MapButton>
        </div>

        {/* 区域计数 */}
        <div style={{ position: 'absolute', bottom: 20, left: 16, zIndex: 10, fontSize: 11, color: 'var(--color-text-dim)', background: 'var(--color-surface)', border: '1px solid var(--color-border)', padding: '4px 10px', borderRadius: 'var(--radius-sm)' }}>
          {t.worldmap_areaCount(areas.length)}
        </div>

        {/* 添加区域按钮 */}
        {!isEditMode && (
          <button
            onClick={() => setShowAddModal(true)}
            disabled={!canAddMore()}
            style={{ position: 'absolute', bottom: 20, right: 16, zIndex: 10, padding: '8px 16px', borderRadius: 'var(--radius-md)', background: canAddMore() ? 'var(--color-secondary)' : 'var(--color-surface-hover)', border: 'none', color: canAddMore() ? 'white' : 'var(--color-text-dim)', fontSize: 13, fontWeight: 600, cursor: canAddMore() ? 'pointer' : 'not-allowed', boxShadow: canAddMore() ? '0 2px 8px rgba(0,0,0,0.2)' : 'none' }}
          >
            {t.worldmap_addArea}
          </button>
        )}

        {/* 区域信息栏 */}
        <AnimatePresence>
          {selectedArea && !isEditMode && (
            <AreaInfoBar key={selectedArea.id} area={selectedArea} prosperity={getAreaProsperity(selectedArea)} onClose={() => setSelectedAreaId(null)} onEnter={handleEnterArea} />
          )}
        </AnimatePresence>
      </motion.div>

      {/* ── 区域内部视图（AnimatePresence 仅包裹此层） ───────── */}
      <AnimatePresence>
        {interiorAreaId && interiorArea && (
          <motion.div
            key="interior"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transition: { duration: 0.3, delay: 0.1 } }}
            exit={{ opacity: 0, transition: { duration: 0.2 } }}
            style={{ width: '100%', height: '100%', position: 'absolute', inset: 0 }}
          >
            {interiorArea.category === '_milestone' ? (
              <ArchiveSpace
                area={interiorArea}
                prosperity={getAreaProsperity(interiorArea)}
                onExit={handleExitInterior}
              />
            ) : (
              <InteriorSpace
                area={interiorArea}
                prosperity={getAreaProsperity(interiorArea)}
                onExit={handleExitInterior}
              />
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── 改名对话框 ────────────────────────────────────────── */}
      <AnimatePresence>
        {renamingAreaId && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }} onClick={() => setRenamingAreaId(null)}>
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }} onClick={(e) => e.stopPropagation()} style={{ background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)', padding: '20px', display: 'flex', flexDirection: 'column', gap: 12, width: 280 }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text)' }}>{t.worldmap_renameTitle}</span>
              <input autoFocus value={renameValue} maxLength={10} onChange={(e) => setRenameValue(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') commitRename(); if (e.key === 'Escape') setRenamingAreaId(null) }} style={{ height: 36, padding: '0 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', background: 'var(--color-bg)', color: 'var(--color-text)', fontSize: 14, outline: 'none' }} />
              <span style={{ fontSize: 11, color: renameValue.length >= 10 ? '#dc2626' : 'var(--color-text-dim)', textAlign: 'right' }}>{renameValue.length}/10</span>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button onClick={() => setRenamingAreaId(null)} style={ghostBtnStyle}>{t.worldmap_renameCancel}</button>
                <button onClick={commitRename} style={primaryBtnStyle}>{t.worldmap_renameConfirm}</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── 删除确认对话框 ────────────────────────────────────── */}
      <AnimatePresence>
        {deleteTarget && (() => {
          const { taskCount, habitCount } = getAreaBlockers(deleteTarget)
          const hasBlockers = taskCount > 0 || habitCount > 0
          return (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }} onClick={() => setDeleteTarget(null)}>
              <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }} onClick={(e) => e.stopPropagation()} style={{ background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)', padding: '20px', display: 'flex', flexDirection: 'column', gap: 14, width: 320 }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-text)' }}>{t.worldmap_deleteTitle(getAreaDisplayName(deleteTarget, t))}</span>
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

      {/* ── 添加区域弹窗 ──────────────────────────────────────── */}
      <AnimatePresence>
        {showAddModal && (
          <AddAreaModal usedTemplateIds={getUsedTemplateIds()} areaCount={areas.length} onAdd={(tid, name) => addArea(tid, name)} onClose={() => setShowAddModal(false)} />
        )}
      </AnimatePresence>
    </div>
  )
}

function MapButton({ onClick, children, title, active }: { onClick: () => void; children: React.ReactNode; title?: string; active?: boolean }) {
  return (
    <button onClick={onClick} title={title} style={{ padding: '4px 10px', borderRadius: 'var(--radius-sm)', fontSize: 12, border: `1px solid ${active ? 'var(--color-accent)' : 'var(--color-border)'}`, background: active ? 'color-mix(in srgb, var(--color-accent) 15%, var(--color-surface))' : 'var(--color-surface)', color: active ? 'var(--color-accent)' : 'var(--color-text-dim)', cursor: 'pointer', transition: 'all 0.15s' }}>
      {children}
    </button>
  )
}

const ghostBtnStyle: React.CSSProperties = { padding: '6px 14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', background: 'transparent', color: 'var(--color-text-dim)', fontSize: 13, cursor: 'pointer' }
const primaryBtnStyle: React.CSSProperties = { padding: '6px 14px', borderRadius: 'var(--radius-md)', border: 'none', background: 'var(--color-accent)', color: 'white', fontSize: 13, fontWeight: 600, cursor: 'pointer' }
