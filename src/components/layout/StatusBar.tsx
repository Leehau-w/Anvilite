import React from 'react'
import { useCharacterStore } from '@/stores/characterStore'
import { getTitle } from '@/engines/levelEngine'
import { AnimatedXPBar } from '@/components/feedback/AnimatedXPBar'
import { useT } from '@/i18n'

export function StatusBar() {
  const { character } = useCharacterStore()
  const title = getTitle(character.level, character.titlePreset, character.customTitles)
  const t = useT()

  return (
    <footer
      className="flex items-center px-4 shrink-0 gap-3"
      style={{
        height: 32,
        background: 'var(--color-surface)',
        borderTop: '1px solid var(--color-border)',
        fontSize: 12,
        color: 'var(--color-text-dim)',
      }}
    >
      {(character.prestigeLevel ?? 0) > 0 && (
        <span style={{ fontSize: 10, letterSpacing: 1 }}>{'🌟'.repeat(Math.min(character.prestigeLevel, 5))}</span>
      )}
      <span style={{ fontFamily: 'var(--font-num)', fontWeight: 600, color: 'var(--color-text)', fontSize: 12 }}>
        Lv.{character.level}
      </span>
      <span>·</span>
      <span className={(character.prestigeLevel ?? 0) > 0 ? 'prestige-title' : ''} style={(character.prestigeLevel ?? 0) === 0 ? { color: 'var(--color-accent)' } : {}}>
        {title}
      </span>
      <span style={{ color: 'var(--color-border)' }}>|</span>

      <AnimatedXPBar />

      <span style={{ color: 'var(--color-border)' }}>|</span>

      <span style={{ fontSize: 12 }}>
        🔥
        <span style={{ fontFamily: 'var(--font-num)', fontWeight: 600, color: 'var(--color-text)' }}>
          {character.streakDays}
        </span>
        {t.statusbar_days}
      </span>
    </footer>
  )
}
