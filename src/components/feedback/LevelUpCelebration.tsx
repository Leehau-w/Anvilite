import React, { useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { getTitle } from '@/engines/levelEngine'
import { useCharacterStore } from '@/stores/characterStore'
import { useT } from '@/i18n'

interface LevelUpCelebrationProps {
  visible: boolean
  newLevel: number
  oldLevel: number
  onDismiss: () => void
}

export function LevelUpCelebration({ visible, newLevel, oldLevel, onDismiss }: LevelUpCelebrationProps) {
  const { character } = useCharacterStore()
  const t = useT()
  const newTitle = getTitle(newLevel, character.titlePreset, character.customTitles)
  const oldTitle = getTitle(oldLevel, character.titlePreset, character.customTitles)
  const titleChanged = newTitle !== oldTitle

  useEffect(() => {
    if (!visible) return
    const timer = setTimeout(onDismiss, titleChanged ? 3700 : 2200)
    return () => clearTimeout(timer)
  }, [visible, onDismiss, titleChanged])

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={onDismiss}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            backdropFilter: 'blur(4px)',
            zIndex: 9998,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 16,
          }}
        >
          {/* 粒子效果（简化版 CSS） */}
          <Particles />

          {/* 等级数字 */}
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: [0, 1.2, 1.0], opacity: 1 }}
            transition={{ duration: 0.5, ease: [0.34, 1.56, 0.64, 1] }}
            style={{
              fontSize: 48,
              fontWeight: 800,
              color: 'var(--color-accent)',
              fontFamily: 'var(--font-num)',
              lineHeight: 1,
            }}
          >
            Lv.{newLevel}
          </motion.div>

          {titleChanged && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5, duration: 0.4 }}
              style={{
                fontSize: 20,
                fontWeight: 700,
                color: 'var(--color-accent)',
              }}
            >
              {newTitle}
            </motion.div>
          )}

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.6 }}
            transition={{ delay: 0.3 }}
            style={{ fontSize: 12, color: 'var(--color-surface)', marginTop: 8 }}
          >
            {t.streakPopup_dismiss}
          </motion.p>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

const PARTICLE_COUNT = 24

function Particles() {
  const particles = useMemo(() =>
    Array.from({ length: PARTICLE_COUNT }, (_, i) => {
      const angle = (i / PARTICLE_COUNT) * 360
      const rad = (angle * Math.PI) / 180
      const distance = 80 + Math.random() * 120
      const size = 3 + Math.random() * 4
      const delay = Math.random() * 0.3
      return { i, rad, distance, size, delay }
    }),
  [])

  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
      {particles.map(({ i, rad, distance, size, delay }) => {
        const color = i % 2 === 0 ? 'var(--color-accent)' : 'var(--color-xp)'
        const tx = Math.cos(rad) * distance
        const ty = Math.sin(rad) * distance
        return (
          <motion.div
            key={i}
            initial={{ opacity: 1, x: 0, y: 0, scale: 1 }}
            animate={{
              opacity: [1, 1, 0],
              x: tx,
              y: ty + 60,
              scale: [1, 1, 0.5],
            }}
            transition={{ duration: 1, delay, ease: 'easeOut' }}
            style={{
              position: 'absolute',
              left: '50%',
              top: '50%',
              width: size,
              height: size,
              borderRadius: '50%',
              background: color,
              marginLeft: -size / 2,
              marginTop: -size / 2,
            }}
          />
        )
      })}
    </div>
  )
}
