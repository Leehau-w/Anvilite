import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'

interface XPFloatProps {
  xp: number
  ore: number
  visible: boolean
  anchorRef?: React.RefObject<HTMLElement>
}

export function XPFloat({ xp, ore, visible }: XPFloatProps) {
  return (
    <AnimatePresence>
      {visible && (
        <div
          style={{
            position: 'absolute',
            right: 40,
            top: '50%',
            pointerEvents: 'none',
            zIndex: 100,
            display: 'flex',
            gap: 8,
          }}
        >
          {/* XP飘字 */}
          <motion.span
            initial={{ opacity: 0, y: 0, scale: 0.8 }}
            animate={{
              opacity: [0, 1, 1, 0],
              y: [0, -60],
              scale: [0.8, 1.1, 1.0, 1.0],
            }}
            transition={{ duration: 0.8, ease: [0, 0, 0.2, 1] }}
            style={{
              fontFamily: 'var(--font-num)',
              fontWeight: 600,
              fontSize: 16,
              color: 'var(--color-xp)',
              whiteSpace: 'nowrap',
            }}
          >
            +{xp} XP
          </motion.span>

          {/* 矿石飘字 */}
          <motion.span
            initial={{ opacity: 0, y: 0, scale: 0.8 }}
            animate={{
              opacity: [0, 1, 1, 0],
              y: [0, -50],
              scale: [0.8, 1.05, 1.0, 1.0],
            }}
            transition={{ duration: 0.8, delay: 0.1, ease: [0, 0, 0.2, 1] }}
            style={{
              fontFamily: 'var(--font-num)',
              fontWeight: 600,
              fontSize: 14,
              color: 'var(--color-secondary)',
              whiteSpace: 'nowrap',
            }}
          >
            +{ore} ⛏
          </motion.span>
        </div>
      )}
    </AnimatePresence>
  )
}
