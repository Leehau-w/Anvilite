import { describe, it, expect } from 'vitest'
import { getTagColor, TAG_PALETTE } from './tagColor'

describe('getTagColor', () => {
  it('returns a color from the palette', () => {
    expect(TAG_PALETTE).toContain(getTagColor('work'))
    expect(TAG_PALETTE).toContain(getTagColor('hobby'))
  })

  it('returns the same color for the same tag name', () => {
    expect(getTagColor('project')).toBe(getTagColor('project'))
  })

  it('distributes different names across palette', () => {
    const colors = new Set(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].map(getTagColor))
    expect(colors.size).toBeGreaterThan(1)
  })

  it('handles empty string without crashing', () => {
    expect(TAG_PALETTE).toContain(getTagColor(''))
  })
})
