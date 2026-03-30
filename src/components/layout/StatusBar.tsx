import React from 'react'
import { useCharacterStore } from '@/stores/characterStore'
import { AnimatedXPBar } from '@/components/feedback/AnimatedXPBar'
import { useT } from '@/i18n'

const TITLE_THRESHOLDS = [1, 6, 11, 16, 21, 31, 41, 51] as const
function getTitleIndex(level: number): number {
  for (let i = TITLE_THRESHOLDS.length - 1; i >= 0; i--) {
    if (level >= TITLE_THRESHOLDS[i]) return i
  }
  return 0
}

export function StatusBar() {
  const { character } = useCharacterStore()
  const t = useT()
  const idx = getTitleIndex(character.level)
  const title = character.titlePreset === 'rpg'
    ? t.titles_rpg[idx]
    : (character.titlePreset === 'custom' && character.customTitles?.[idx])
      ? character.customTitles[idx]
      : t.titles_forge[idx]

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
