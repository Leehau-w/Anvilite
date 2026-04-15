import { describe, it, expect, vi, afterEach } from 'vitest'
import { getElapsedSeconds, formatElapsed } from './timerEngine'

describe('getElapsedSeconds', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns accumulated when startedAt is null', () => {
    expect(getElapsedSeconds(null, 0)).toBe(0)
    expect(getElapsedSeconds(null, 120)).toBe(120)
  })

  it('returns accumulated + running elapsed when timing', () => {
    vi.useFakeTimers()
    const now = Date.now()
    vi.setSystemTime(now)
    const startedAt = new Date(now - 30_000).toISOString() // 30 seconds ago
    expect(getElapsedSeconds(startedAt, 60)).toBe(90) // 60 accumulated + 30 running
  })

  it('clamps negative elapsed to zero', () => {
    vi.useFakeTimers()
    const now = Date.now()
    vi.setSystemTime(now)
    const futureStart = new Date(now + 10_000).toISOString()
    expect(getElapsedSeconds(futureStart, 10)).toBe(10) // only accumulated
  })
})

describe('formatElapsed', () => {
  it('formats 0 as 0:00', () => {
    expect(formatElapsed(0)).toBe('0:00')
  })

  it('formats 65 as 1:05', () => {
    expect(formatElapsed(65)).toBe('1:05')
  })

  it('formats 3661 as 1:01:01', () => {
    expect(formatElapsed(3661)).toBe('1:01:01')
  })

  it('formats 3600 as 1:00:00', () => {
    expect(formatElapsed(3600)).toBe('1:00:00')
  })

  it('formats 59 as 0:59', () => {
    expect(formatElapsed(59)).toBe('0:59')
  })
})
