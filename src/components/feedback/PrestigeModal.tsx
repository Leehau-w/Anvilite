import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useCharacterStore } from '@/stores/characterStore'

interface PrestigeModalProps {
  visible: boolean
  onDismiss: () => void
}

export function PrestigeModal({ visible, onDismiss }: PrestigeModalProps) {
  const { character, prestige } = useCharacterStore()

  function handlePrestige() {
    prestige()
    onDismiss()
  }

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.6)',
            backdropFilter: 'blur(6px)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24,
          }}
        >
          <motion.div
            initial={{ scale: 0.85, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ duration: 0.35, ease: [0.34, 1.56, 0.64, 1] }}
            style={{
              background: 'var(--color-surface)',
              borderRadius: 'var(--radius-xl)',
              border: '1.5px solid var(--color-accent)',
              boxShadow: '0 24px 60px rgba(0,0,0,0.3)',
              padding: 32,
              maxWidth: 440,
              width: '100%',
              display: 'flex',
              flexDirection: 'column',
              gap: 20,
              textAlign: 'center',
            }}
          >
            {/* 标题 */}
            <div>
              <div style={{ fontSize: 36, marginBottom: 8 }}>⚒️</div>
              <h2 style={{ fontSize: 22, fontWeight: 800, color: 'var(--color-text)', margin: 0 }}>
                抉择时刻
              </h2>
              <p style={{ fontSize: 13, color: 'var(--color-text-dim)', marginTop: 6 }}>
                你已达到传奇 Lv.51，可以开启淬火重铸之路
              </p>
            </div>

            {/* 重铸说明 */}
            <div
              style={{
                background: 'color-mix(in srgb, var(--color-accent) 8%, var(--color-bg))',
                border: '1px solid color-mix(in srgb, var(--color-accent) 25%, transparent)',
                borderRadius: 'var(--radius-lg)',
                padding: '14px 18px',
                textAlign: 'left',
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
              }}
            >
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-accent)' }}>淬火重铸 · 专属特权</div>
              {[
                '🌟 等级显示前置转生星级图标',
                '✨ 角色称号获得动态流光效果',
                '🏰 神话繁荣：解锁第七级区域特效',
                '🔥 起源之火：极稀有专属徽章',
              ].map((line) => (
                <div key={line} style={{ fontSize: 12, color: 'var(--color-text-dim)', display: 'flex', gap: 6, alignItems: 'flex-start' }}>
                  {line}
                </div>
              ))}
              <div
                style={{
                  marginTop: 4,
                  paddingTop: 8,
                  borderTop: '1px solid var(--color-border)',
                  fontSize: 11,
                  color: 'var(--color-text-dim)',
                }}
              >
                ⚠️ 等级将重置为 Lv.1，矿石·装饰·主题·繁荣度完整保留
              </div>
            </div>

            {/* 当前转生数 */}
            {(character.prestigeLevel ?? 0) > 0 && (
              <div style={{ fontSize: 12, color: 'var(--color-text-dim)' }}>
                当前已转生 {'🌟'.repeat(character.prestigeLevel ?? 0)} × {character.prestigeLevel}
              </div>
            )}

            {/* 按钮 */}
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={onDismiss}
                style={{
                  flex: 1,
                  height: 40,
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--color-border)',
                  background: 'transparent',
                  color: 'var(--color-text-dim)',
                  fontSize: 14,
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
              >
                维持现状
              </button>
              <button
                onClick={handlePrestige}
                style={{
                  flex: 2,
                  height: 40,
                  borderRadius: 'var(--radius-md)',
                  border: 'none',
                  background: 'var(--color-accent)',
                  color: 'white',
                  fontSize: 14,
                  fontWeight: 700,
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
              >
                🔥 淬火重铸
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
