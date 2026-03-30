import React, { useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useT } from '@/i18n'

export type StreakMilestone = 3 | 7 | 14 | 30

interface StreakMilestonePopupProps {
  milestone: StreakMilestone | null
  onDismiss: () => void
}

type MilestoneConfigEntry = {
  emoji: string
  text: string
  bonus: string
  duration: number
  size: 'sm' | 'md' | 'lg'
  particles: number
  fullOverlay: boolean
}

function getMilestoneConfig(t: ReturnType<typeof useT>): Record<StreakMilestone, MilestoneConfigEntry> {
  return {
    3:  { emoji: '✨', text: t.streakPopup_bonus10,  bonus: '+10%', duration: 1000, size: 'sm', particles: 0,  fullOverlay: false },
    7:  { emoji: '🔥', text: t.streakPopup_bonus20,  bonus: '+20%', duration: 1500, size: 'md', particles: 8,  fullOverlay: false },
    14: { emoji: '🔥', text: t.streakPopup_bonus30,  bonus: '+30%', duration: 1500, size: 'md', particles: 10, fullOverlay: false },
    30: { emoji: '🔥', text: t.streakPopup_bonusMax, bonus: '+50%', duration: 2000, size: 'lg', particles: 24, fullOverlay: true  },
  }
}

export function StreakMilestonePopup({ milestone, onDismiss }: StreakMilestonePopupProps) {
  const t = useT()
  const MILESTONE_CONFIG = getMilestoneConfig(t)
  const cfg = milestone ? MILESTONE_CONFIG[milestone] : null

  useEffect(() => {
    if (!milestone || !cfg) return
    const timer = setTimeout(onDismiss, cfg.duration)
    return () => clearTimeout(timer)
  }, [milestone])

  return (
    <AnimatePresence>
      {milestone && cfg && (
        cfg.fullOverlay ? (
          <FullOverlay cfg={cfg} milestone={milestone} onDismiss={onDismiss} />
        ) : (
          <FloatingBadge cfg={cfg} milestone={milestone} />
        )
      )}
    </AnimatePresence>
  )
}

function FloatingBadge({ cfg, milestone }: { cfg: MilestoneConfigEntry; milestone: StreakMilestone }) {
  const isSmall = cfg.size === 'sm'

  return (
    <motion.div
      key={`streak-${milestone}`}
      initial={{ opacity: 0, y: 20, scale: 0.85 }}
      animate={{ opacity: 1, y: -8, scale: 1 }}
      exit={{ opacity: 0, y: -30, scale: 0.9 }}
      transition={{ duration: 0.35, ease: [0.34, 1.56, 0.64, 1] }}
      style={{
        position: 'fixed',
        bottom: 120,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 1001,
        pointerEvents: 'none',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 4,
      }}
    >
      {cfg.particles > 0 && <MiniParticles count={cfg.particles} />}

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          background: 'var(--color-surface)',
          border: `1.5px solid var(--color-accent)`,
          borderRadius: 'var(--radius-lg)',
          padding: isSmall ? '5px 14px' : '8px 20px',
          boxShadow: '0 4px 20px color-mix(in srgb, var(--color-accent) 25%, transparent)',
        }}
      >
        <span style={{ fontSize: isSmall ? 14 : 18 }}>{cfg.emoji}</span>
        <span
          style={{
            fontSize: isSmall ? 12 : 15,
            fontWeight: isSmall ? 500 : 700,
            color: isSmall ? 'var(--color-text-dim)' : 'var(--color-accent)',
            fontFamily: 'var(--font-zh)',
          }}
        >
          {cfg.text}
        </span>
      </div>
    </motion.div>
  )
}

function FullOverlay({ cfg, milestone, onDismiss }: {
  cfg: MilestoneConfigEntry
  milestone: StreakMilestone
  onDismiss: () => void
}) {
  const t = useT()
  return (
    <motion.div
      key={`streak-overlay-${milestone}`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      onClick={onDismiss}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.55)',
        backdropFilter: 'blur(4px)',
        zIndex: 9997,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
      }}
    >
      <FireParticles count={cfg.particles} />

      <motion.div
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: [0, 1.15, 1.0], opacity: 1 }}
        transition={{ duration: 0.5, ease: [0.34, 1.56, 0.64, 1] }}
        style={{ fontSize: 56, lineHeight: 1 }}
      >
        {cfg.emoji}
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.4 }}
        style={{
          fontSize: 22,
          fontWeight: 800,
          color: 'var(--color-accent)',
          fontFamily: 'var(--font-zh)',
          textAlign: 'center',
        }}
      >
        {cfg.text}
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 1, 0.8, 1, 0.8, 1] }}
        transition={{ delay: 0.4, duration: 1.2 }}
        style={{
          fontSize: 30,
          fontWeight: 800,
          fontFamily: 'var(--font-num)',
          color: 'var(--color-xp)',
        }}
      >
        {t.streakPopup_streakLabel(milestone)}
      </motion.div>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.5 }}
        transition={{ delay: 0.6 }}
        style={{ fontSize: 12, color: 'var(--color-surface)', marginTop: 8 }}
      >
        {t.streakPopup_dismiss}
      </motion.p>
    </motion.div>
  )
}

function MiniParticles({ count }: { count: number }) {
  return (
    <div style={{ position: 'absolute', pointerEvents: 'none', width: 160, height: 60 }}>
      {Array.from({ length: count }, (_, i) => {
        const angle = (i / count) * 360
        const rad = (angle * Math.PI) / 180
        const d = 30 + Math.random() * 20
        return (
          <motion.div
            key={i}
            initial={{ opacity: 1, x: 80, y: 30, scale: 1 }}
            animate={{ opacity: 0, x: 80 + Math.cos(rad) * d, y: 30 + Math.sin(rad) * d, scale: 0 }}
            transition={{ duration: 0.6, delay: Math.random() * 0.2 }}
            style={{
              position: 'absolute',
              width: 4,
              height: 4,
              borderRadius: '50%',
              background: i % 2 === 0 ? 'var(--color-accent)' : 'var(--color-xp)',
              marginLeft: -2,
              marginTop: -2,
            }}
          />
        )
      })}
    </div>
  )
}

function FireParticles({ count }: { count: number }) {
  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
      {Array.from({ length: count }, (_, i) => {
        const angle = (i / count) * 360
        const d = 100 + Math.random() * 150
        const size = 4 + Math.random() * 5
        const rad = (angle * Math.PI) / 180
        const colors = ['var(--color-accent)', 'var(--color-xp)', '#ff4444', '#ff8800']
        return (
          <motion.div
            key={i}
            initial={{ opacity: 1, x: 0, y: 0, scale: 1 }}
            animate={{ opacity: [1, 1, 0], x: Math.cos(rad) * d, y: Math.sin(rad) * d + 60, scale: [1, 1, 0.3] }}
            transition={{ duration: 1.2, delay: Math.random() * 0.4, ease: 'easeOut' }}
            style={{
              position: 'absolute',
              left: '50%',
              top: '45%',
              width: size,
              height: size,
              borderRadius: '50%',
              background: colors[i % colors.length],
              marginLeft: -size / 2,
              marginTop: -size / 2,
            }}
          />
        )
      })}
    </div>
  )
}
