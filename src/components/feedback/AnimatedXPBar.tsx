import React, { useEffect, useRef, useState } from 'react'
import { useCharacterStore } from '@/stores/characterStore'
import { getXPProgress, xpToNextLevel } from '@/engines/levelEngine'

/**
 * 经验条组件：带填充动画和光晕效果
 * 用于 StatusBar 中的经验条
 */
export function AnimatedXPBar() {
  const { character } = useCharacterStore()
  const progress = getXPProgress(character.currentXP, character.level)
  const needed = xpToNextLevel(character.level)

  const [displayXP, setDisplayXP] = useState(character.currentXP)
  const [glowing, setGlowing] = useState(false)
  const prevXP = useRef(character.currentXP)
  const animFrame = useRef<number | null>(null)

  useEffect(() => {
    if (character.currentXP === prevXP.current) return

    const start = prevXP.current
    const end = character.currentXP
    const duration = 600
    const startTime = performance.now()

    setGlowing(true)

    if (animFrame.current) cancelAnimationFrame(animFrame.current)

    function tick(now: number) {
      const elapsed = now - startTime
      const t = Math.min(elapsed / duration, 1)
      // ease-out cubic
      const eased = 1 - Math.pow(1 - t, 3)
      setDisplayXP(Math.round(start + (end - start) * eased))

      if (t < 1) {
        animFrame.current = requestAnimationFrame(tick)
      } else {
        setDisplayXP(end)
        prevXP.current = end
        setTimeout(() => setGlowing(false), 200)
      }
    }

    animFrame.current = requestAnimationFrame(tick)
    prevXP.current = end

    return () => {
      if (animFrame.current) cancelAnimationFrame(animFrame.current)
    }
  }, [character.currentXP])

  const pct = needed > 0 ? Math.min((displayXP / needed) * 100, 100) : 0

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div
        style={{
          width: 100,
          height: 4,
          background: 'var(--color-border)',
          borderRadius: 'var(--radius-full)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${pct}%`,
            background: 'var(--color-accent)',
            borderRadius: 'var(--radius-full)',
            transition: 'width 0.6s cubic-bezier(0.4, 0, 0.2, 1)',
            boxShadow: glowing ? '0 0 8px var(--color-accent)' : 'none',
            transitionProperty: 'width, box-shadow',
          }}
        />
      </div>
      <span
        style={{
          fontSize: 11,
          fontFamily: 'var(--font-num)',
          color: 'var(--color-text-dim)',
          letterSpacing: '0.02em',
        }}
      >
        {displayXP}/{needed}
      </span>
    </div>
  )
}
