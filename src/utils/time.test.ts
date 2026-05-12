import { describe, expect, it, vi } from 'vitest'
import { formatDateKey, formatRelativeDate, getTodayString, getTomorrowString, parseDateKey } from './time'

describe('local date helpers', () => {
  it('formats calendar dates without UTC conversion', () => {
    expect(formatDateKey(new Date(2026, 0, 2, 23, 30))).toBe('2026-01-02')
  })

  it('parses YYYY-MM-DD as a local calendar date', () => {
    const d = parseDateKey('2026-05-11')
    expect(d.getFullYear()).toBe(2026)
    expect(d.getMonth()).toBe(4)
    expect(d.getDate()).toBe(11)
  })

  it('today and tomorrow use local date keys', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 4, 11, 23, 30))
    expect(getTodayString()).toBe('2026-05-11')
    expect(getTomorrowString()).toBe('2026-05-12')
    vi.useRealTimers()
  })

  it('formats relative dates from local date keys', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 4, 11, 9, 0))
    expect(formatRelativeDate('2026-05-12', 'zh')).toBe('明天')
    expect(formatRelativeDate('2026-05-13', 'zh')).toBe('5/13')
    vi.useRealTimers()
  })
})
