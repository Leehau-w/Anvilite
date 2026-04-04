import React, { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useBadgeStore } from '@/stores/badgeStore'
import { useGrowthEventStore } from '@/stores/growthEventStore'
import { useAreaStore } from '@/stores/areaStore'
import { STATIC_BADGE_DEFS, makeAreaBadgeDef, type BadgeDef } from '@/types/badge'
import { useT } from '@/i18n'
import type { Translations } from '@/i18n'
import type { Area } from '@/types/area'
import { getAreaDisplayName } from '@/utils/area'

/** 从徽章ID查找定义（含动态区域徽章）。areas 用于将 category 解析为用户可见名称。 */
function resolveBadgeDef(id: string, areas: Area[], t: Translations): BadgeDef | null {
  // 静态徽章
  const found = STATIC_BADGE_DEFS.find((d) => d.id === id)
  if (found) return found

  // 动态区域徽章：area_{category}_{level}
  const areaMatch = id.match(/^area_(.+)_(\d+)$/)
  if (areaMatch) {
    const category = areaMatch[1]
    const level = parseInt(areaMatch[2], 10)
    if (level >= 2 && level <= 6) {
      const area = areas.find((a) => a.category === category)
      const displayName = area ? getAreaDisplayName(area, t) : category
      return makeAreaBadgeDef(category, level, displayName)
    }
  }

  return null
}

/** 显示时间（ms） */
const DISPLAY_MS = 3000

interface ActiveNotif {
  id: string
  def: BadgeDef
  timerId: ReturnType<typeof setTimeout>
}

export function BadgeNotificationLayer() {
  const { notifyQueue, dismissNotify } = useBadgeStore()
  const { addEvent } = useGrowthEventStore()
  const areas = useAreaStore((s) => s.areas)
  const t = useT()
  const [active, setActive] = useState<ActiveNotif[]>([])
  const [lit, setLit] = useState<Set<string>>(new Set())

  // 处理通知队列：每次取队首显示
  useEffect(() => {
    if (notifyQueue.length === 0) return
    const id = notifyQueue[0]
    // 如果已在显示中，跳过
    if (active.some((a) => a.id === id)) return

    const def = resolveBadgeDef(id, areas, t)
    if (!def) {
      dismissNotify(id)
      return
    }

    // 记录成长事件
    addEvent({
      type: 'badge_earned',
      title: t.badge_earnedEvent(def.name),
      details: { badgeId: id },
      isMilestone: false,
    })

    // 500ms 后变彩色发光
    const litTimer = setTimeout(() => {
      setLit((s) => new Set([...s, id]))
    }, 500)

    const timerId = setTimeout(() => {
      dismissNotify(id)
      setActive((prev) => prev.filter((a) => a.id !== id))
      setLit((s) => { const n = new Set(s); n.delete(id); return n })
      clearTimeout(litTimer)
    }, DISPLAY_MS)

    setActive((prev) => [...prev, { id, def, timerId }])
  }, [notifyQueue])

  // 手动关闭
  function dismiss(id: string) {
    const notif = active.find((a) => a.id === id)
    if (notif) clearTimeout(notif.timerId)
    setActive((prev) => prev.filter((a) => a.id !== id))
    setLit((s) => { const n = new Set(s); n.delete(id); return n })
    dismissNotify(id)
  }

  return (
    <div
      style={{
        position: 'fixed',
        top: 56,   // TopBar 高度下方
        right: 16,
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        pointerEvents: 'none',
      }}
    >
      <AnimatePresence mode="popLayout">
        {active.map(({ id, def }) => {
          const isLit = lit.has(id)
          return (
            <motion.div
              key={id}
              layout
              initial={{ x: 320, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 320, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 400, damping: 35 }}
              style={{ pointerEvents: 'auto' }}
            >
              <motion.div
                animate={
                  isLit
                    ? {
                        boxShadow: [
                          '0 0 0px transparent',
                          '0 0 16px color-mix(in srgb, var(--color-accent) 50%, transparent)',
                          '0 0 8px color-mix(in srgb, var(--color-accent) 30%, transparent)',
                        ],
                      }
                    : { boxShadow: '0 2px 12px rgba(0,0,0,0.15)' }
                }
                transition={{ duration: 0.6, times: [0, 0.5, 1] }}
                style={{
                  width: 280,
                  padding: '12px 14px',
                  borderRadius: 'var(--radius-lg)',
                  border: `1px solid ${isLit ? 'var(--color-accent)' : 'var(--color-border)'}`,
                  background: isLit
                    ? 'color-mix(in srgb, var(--color-accent) 8%, var(--color-surface))'
                    : 'var(--color-surface)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  cursor: 'pointer',
                  transition: 'border-color 0.4s, background 0.4s',
                  userSelect: 'none',
                }}
                onClick={() => dismiss(id)}
              >
                {/* 图标 */}
                <motion.span
                  animate={isLit ? { scale: [1, 1.3, 1] } : { scale: 1 }}
                  transition={{ duration: 0.4 }}
                  style={{
                    fontSize: 28,
                    flexShrink: 0,
                    filter: isLit ? 'none' : 'grayscale(1) opacity(0.5)',
                    transition: 'filter 0.4s',
                  }}
                >
                  {def.icon}
                </motion.span>

                {/* 文字 */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 10,
                      fontWeight: 600,
                      letterSpacing: '0.05em',
                      color: isLit ? 'var(--color-accent)' : 'var(--color-text-dim)',
                      marginBottom: 2,
                      transition: 'color 0.4s',
                    }}
                  >
                    🏅 徽章解锁
                  </div>
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 700,
                      color: isLit ? 'var(--color-text)' : 'var(--color-text-dim)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      transition: 'color 0.4s',
                    }}
                  >
                    {def.name}
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      color: 'var(--color-text-dim)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {def.description}
                  </div>
                </div>

                {/* 关闭提示 */}
                <span style={{ fontSize: 10, color: 'var(--color-text-dim)', opacity: 0.5, flexShrink: 0 }}>✕</span>
              </motion.div>
            </motion.div>
          )
        })}
      </AnimatePresence>
    </div>
  )
}
