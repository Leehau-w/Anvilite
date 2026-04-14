import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { formatRelativeTime } from '@/utils/formatRelativeTime'

describe('formatRelativeTime', () => {
  const NOW = new Date('2026-04-14T12:00:00Z').getTime()

  beforeEach(() => {
    vi.spyOn(Date, 'now').mockReturnValue(NOW)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('中文', () => {
    it('同一天返回"今天"', () => {
      const iso = new Date('2026-04-14T08:00:00Z').toISOString()
      expect(formatRelativeTime(iso, 'zh')).toBe('今天')
    })

    it('昨天返回"昨天"', () => {
      const iso = new Date('2026-04-13T08:00:00Z').toISOString()
      expect(formatRelativeTime(iso, 'zh')).toBe('昨天')
    })

    it('5 天前', () => {
      const iso = new Date('2026-04-09T12:00:00Z').toISOString()
      expect(formatRelativeTime(iso, 'zh')).toBe('5 天前')
    })

    it('29 天前仍用天', () => {
      const iso = new Date('2026-03-16T12:00:00Z').toISOString()
      expect(formatRelativeTime(iso, 'zh')).toBe('29 天前')
    })

    it('30 天前改用月', () => {
      const iso = new Date('2026-03-15T12:00:00Z').toISOString()
      expect(formatRelativeTime(iso, 'zh')).toBe('1 个月前')
    })

    it('60 天前', () => {
      const iso = new Date('2026-02-13T12:00:00Z').toISOString()
      expect(formatRelativeTime(iso, 'zh')).toBe('2 个月前')
    })
  })

  describe('English', () => {
    it('same day → Today', () => {
      const iso = new Date('2026-04-14T08:00:00Z').toISOString()
      expect(formatRelativeTime(iso, 'en')).toBe('Today')
    })

    it('yesterday → Yesterday', () => {
      const iso = new Date('2026-04-13T08:00:00Z').toISOString()
      expect(formatRelativeTime(iso, 'en')).toBe('Yesterday')
    })

    it('5 days ago', () => {
      const iso = new Date('2026-04-09T12:00:00Z').toISOString()
      expect(formatRelativeTime(iso, 'en')).toBe('5 days ago')
    })

    it('29 days ago stays in days', () => {
      const iso = new Date('2026-03-16T12:00:00Z').toISOString()
      expect(formatRelativeTime(iso, 'en')).toBe('29 days ago')
    })

    it('30 days ago → months', () => {
      const iso = new Date('2026-03-15T12:00:00Z').toISOString()
      expect(formatRelativeTime(iso, 'en')).toBe('1 months ago')
    })

    it('60 days ago → 2 months ago', () => {
      const iso = new Date('2026-02-13T12:00:00Z').toISOString()
      expect(formatRelativeTime(iso, 'en')).toBe('2 months ago')
    })
  })
})
