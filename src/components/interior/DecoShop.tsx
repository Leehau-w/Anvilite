import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { Area } from '@/types/area'
import type { ProsperityInfo } from '@/engines/prosperityEngine'
import type { DecorationDef } from '@/types/decoration'
import { getDecorationsForTemplate } from '@/types/decoration'
import { useCharacterStore } from '@/stores/characterStore'
import { useDecorationStore } from '@/stores/decorationStore'
import { useToast } from '@/components/feedback/Toast'
import { PROSPERITY_NAMES } from '@/types/area'
import { useT } from '@/i18n'

interface DecoShopProps {
  area: Area
  prosperity: ProsperityInfo
  onClose: () => void
}

function decoT(deco: DecorationDef, t: ReturnType<typeof useT>, field: 'name' | 'desc'): string {
  const dict = t as Record<string, unknown>
  const key = `deco_${field}_${deco.id}`
  return typeof dict[key] === 'string' ? dict[key] as string : field === 'name' ? deco.name : deco.description
}

export function DecoShop({ area, prosperity, onClose }: DecoShopProps) {
  const t = useT()
  const { character, spendOre } = useCharacterStore()
  const { buy, isOwned } = useDecorationStore()
  const { showToast } = useToast()
  const [confirmDeco, setConfirmDeco] = useState<DecorationDef | null>(null)

  const decorations = getDecorationsForTemplate(area.templateId)

  // 按繁荣等级分组
  const byLevel: Record<number, DecorationDef[]> = {}
  for (const d of decorations) {
    if (!byLevel[d.requiredProsperityLevel]) byLevel[d.requiredProsperityLevel] = []
    byLevel[d.requiredProsperityLevel].push(d)
  }
  const levels = Object.keys(byLevel).map(Number).sort((a, b) => a - b)

  function handleBuy(deco: DecorationDef) {
    const ok = spendOre(deco.cost)
    if (!ok) {
      showToast(t.decoShop_insufficientOre(deco.cost - character.ore))
      setConfirmDeco(null)
      return
    }
    buy(area.id, deco.id)
    setConfirmDeco(null)
    showToast(t.decoShop_purchased(decoT(deco, t, 'name')))
  }

  return (
    <>
      {/* 遮罩 */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 800 }}
        onClick={onClose}
      />

      {/* 弹窗 */}
      <div
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          zIndex: 801,
        }}
      >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        transition={{ duration: 0.2 }}
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 420,
          maxHeight: '76vh',
          background: 'var(--color-surface)',
          borderRadius: 'var(--radius-xl)',
          border: '1px solid var(--color-border)',
          boxShadow: '0 16px 48px rgba(0,0,0,0.25)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* 标题栏 */}
        <div
          style={{
            height: 52,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 20px',
            borderBottom: '1px solid var(--color-border)',
            flexShrink: 0,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 16 }}>🎪</span>
            <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-text)' }}>{t.decoShop_title}</span>
            <span style={{ fontSize: 11, color: 'var(--color-text-dim)' }}>— {area.name}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 12, color: 'var(--color-text-dim)', fontFamily: 'var(--font-num)' }}>
              ⛏ {character.ore.toLocaleString()}
            </span>
            <button
              onClick={onClose}
              style={{
                width: 28, height: 28, borderRadius: 'var(--radius-md)',
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'var(--color-text-dim)', fontSize: 16,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              ✕
            </button>
          </div>
        </div>

        {/* 繁荣等级提示 */}
        <div
          style={{
            padding: '8px 20px',
            background: 'color-mix(in srgb, var(--color-accent) 6%, var(--color-bg))',
            borderBottom: '1px solid var(--color-border)',
            flexShrink: 0,
            fontSize: 11,
            color: 'var(--color-text-dim)',
          }}
        >
          {t.decoShop_currentProsperity}
          <strong style={{ color: 'var(--color-accent)' }}>
            {t.decoShop_prosperityBadge(PROSPERITY_NAMES[prosperity.prosperityLevel - 1], prosperity.prosperityLevel)}
          </strong>
          {t.decoShop_unlockHint(prosperity.prosperityLevel)}
        </div>

        {/* 内容 */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 20 }}>
          {decorations.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--color-text-dim)', fontSize: 13 }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>🏗️</div>
              {t.decoShop_empty}
            </div>
          ) : (
            levels.map((lvl) => {
              const items = byLevel[lvl] ?? []
              const isAvailable = lvl <= prosperity.prosperityLevel
              return (
                <div key={lvl}>
                  {/* 分组标题 */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      marginBottom: 10,
                    }}
                  >
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        color: isAvailable ? 'var(--color-accent)' : 'var(--color-text-dim)',
                        letterSpacing: '0.04em',
                      }}
                    >
                      {t.decoShop_levelLabel(PROSPERITY_NAMES[lvl - 1])}
                    </span>
                    {!isAvailable && (
                      <span
                        style={{
                          fontSize: 10,
                          color: 'var(--color-text-dim)',
                          background: 'var(--color-surface-hover)',
                          padding: '1px 6px',
                          borderRadius: 'var(--radius-full)',
                        }}
                      >
                        {t.decoShop_locked(lvl)}
                      </span>
                    )}
                  </div>

                  {/* 装饰网格 */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                    {items.map((deco) => {
                      const owned = isOwned(area.id, deco.id)
                      const canBuy = isAvailable && !owned && character.ore >= deco.cost
                      const locked = !isAvailable

                      return (
                        <DecoCard
                          key={deco.id}
                          deco={deco}
                          owned={owned}
                          locked={locked}
                          canBuy={canBuy}
                          onBuy={() => setConfirmDeco(deco)}
                        />
                      )
                    })}
                  </div>
                </div>
              )
            })
          )}
        </div>
      </motion.div>
      </div>

      {/* 购买确认弹窗 */}
      <AnimatePresence>
        {confirmDeco && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'fixed', inset: 0, zIndex: 900,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
            onClick={() => setConfirmDeco(null)}
          >
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              onClick={(e) => e.stopPropagation()}
              style={{
                width: 280,
                background: 'var(--color-surface)',
                borderRadius: 'var(--radius-xl)',
                border: '1px solid var(--color-border)',
                padding: 20,
                boxShadow: '0 8px 32px rgba(0,0,0,0.25)',
                textAlign: 'center',
              }}
            >
              <div style={{ fontSize: 40, marginBottom: 8 }}>{confirmDeco.icon}</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-text)', marginBottom: 4 }}>
                {decoT(confirmDeco, t, 'name')}
              </div>
              <div style={{ fontSize: 12, color: 'var(--color-text-dim)', marginBottom: 12 }}>
                {decoT(confirmDeco, t, 'desc')}
              </div>
              <div style={{ fontSize: 14, marginBottom: 16 }}>
                <strong style={{ color: 'var(--color-text)', fontFamily: 'var(--font-num)' }}>
                  {confirmDeco.cost} ⛏
                </strong>
                <span style={{ fontSize: 11, color: 'var(--color-text-dim)', marginLeft: 4 }}>
                  {t.decoShop_oreBalance(character.ore)}
                </span>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={() => setConfirmDeco(null)}
                  style={{
                    flex: 1, height: 34, borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--color-border)', background: 'transparent',
                    color: 'var(--color-text-dim)', fontSize: 13, cursor: 'pointer',
                  }}
                >
                  {t.decoShop_cancel}
                </button>
                <button
                  onClick={() => handleBuy(confirmDeco)}
                  style={{
                    flex: 2, height: 34, borderRadius: 'var(--radius-md)',
                    border: 'none', background: 'var(--color-accent)',
                    color: 'white', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                  }}
                >
                  {t.decoShop_buy}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}

function DecoCard({
  deco,
  owned,
  locked,
  canBuy,
  onBuy,
}: {
  deco: DecorationDef
  owned: boolean
  locked: boolean
  canBuy: boolean
  onBuy: () => void
}) {
  const t = useT()
  return (
    <motion.div
      whileHover={!locked && !owned ? { scale: 1.03 } : {}}
      style={{
        padding: '10px 8px',
        borderRadius: 'var(--radius-md)',
        border: `1px solid ${owned ? 'color-mix(in srgb, var(--color-success) 40%, transparent)' : 'var(--color-border)'}`,
        background: owned
          ? 'color-mix(in srgb, var(--color-success) 6%, var(--color-surface-hover))'
          : 'var(--color-surface-hover)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 6,
        opacity: locked ? 0.4 : 1,
        cursor: locked || owned ? 'default' : 'pointer',
        transition: 'all 0.15s',
        position: 'relative',
      }}
      onClick={!locked && !owned ? onBuy : undefined}
    >
      <span style={{ fontSize: 28, filter: locked ? 'grayscale(1)' : 'none' }}>{deco.icon}</span>
      <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text)', textAlign: 'center', lineHeight: 1.2 }}>
        {decoT(deco, t, 'name')}
      </span>

      {owned ? (
        <span style={{ fontSize: 10, color: 'var(--color-success)', fontWeight: 600 }}>{t.decoShop_owned}</span>
      ) : locked ? (
        <span style={{ fontSize: 10, color: 'var(--color-text-dim)' }}>🔒</span>
      ) : (
        <span
          style={{
            fontSize: 10,
            color: canBuy ? 'var(--color-secondary)' : '#dc2626',
            fontFamily: 'var(--font-num)',
            fontWeight: 600,
          }}
        >
          {deco.cost} ⛏
        </span>
      )}
    </motion.div>
  )
}
