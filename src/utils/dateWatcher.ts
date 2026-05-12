import { getTodayString } from './time'

type DateChangeCallback = () => void

export function startDateWatcher(onDateChange: DateChangeCallback): () => void {
  let lastDate = getTodayString()
  let midnightTimeoutId: ReturnType<typeof setTimeout> | null = null

  const check = () => {
    const currentDate = getTodayString()
    if (currentDate !== lastDate) {
      lastDate = currentDate
      onDateChange()
    }
  }

  const scheduleNextMidnight = () => {
    if (midnightTimeoutId) clearTimeout(midnightTimeoutId)
    const now = new Date()
    const next = new Date(now)
    next.setDate(now.getDate() + 1)
    next.setHours(0, 0, 1, 0)
    midnightTimeoutId = setTimeout(() => {
      check()
      scheduleNextMidnight()
    }, Math.max(1_000, next.getTime() - now.getTime()))
  }

  // 每分钟检查一次（兜底）
  const intervalId = setInterval(check, 60_000)
  scheduleNextMidnight()

  // 页面从后台恢复时立即检查
  const handleVisibility = () => {
    if (document.visibilityState === 'visible') {
      check()
    }
  }
  document.addEventListener('visibilitychange', handleVisibility)
  window.addEventListener('focus', check)
  window.addEventListener('pageshow', check)

  return () => {
    clearInterval(intervalId)
    if (midnightTimeoutId) clearTimeout(midnightTimeoutId)
    document.removeEventListener('visibilitychange', handleVisibility)
    window.removeEventListener('focus', check)
    window.removeEventListener('pageshow', check)
  }
}
