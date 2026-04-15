/** 4 hours threshold (seconds) — auto-pause if exceeded */
export const TIMER_STALE_THRESHOLD = 4 * 60 * 60

/** Returns total elapsed seconds including current running segment */
export function getElapsedSeconds(startedAt: string | null, accumulated: number): number {
  if (!startedAt) return accumulated
  const elapsed = Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000)
  return accumulated + Math.max(0, elapsed)
}

/** Formats seconds as HH:MM:SS or MM:SS */
export function formatElapsed(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  const s = totalSeconds % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${m}:${String(s).padStart(2, '0')}`
}
