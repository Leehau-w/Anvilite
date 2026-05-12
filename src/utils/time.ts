export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}分钟`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m > 0 ? `${h}小时${m}分钟` : `${h}小时`
}

export function formatTimer(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (h > 0) {
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export function formatDateKey(date: Date = new Date()): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function parseDateKey(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number)
  return new Date(year, month - 1, day)
}

export function getDateKey(value: string | Date): string {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value
  return formatDateKey(typeof value === 'string' ? new Date(value) : value)
}

export function isSameLocalDate(value: string | null | undefined, dateKey = getTodayString()): boolean {
  if (!value) return false
  return getDateKey(value) === dateKey
}

export function getTodayString(): string {
  return formatDateKey()
}

export function getTomorrowString(): string {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  return formatDateKey(d)
}

export function isOverdue(dueDate: string | null): boolean {
  if (!dueDate) return false
  return dueDate < getTodayString()
}

export function formatRelativeDate(dateStr: string | null, lang: 'zh' | 'en' = 'zh'): string {
  if (!dateStr) return ''
  const today = getTodayString()
  const tomorrow = getTomorrowString()
  if (dateStr === today) return lang === 'en' ? 'Today' : '今天'
  if (dateStr === tomorrow) return lang === 'en' ? 'Tomorrow' : '明天'
  const d = parseDateKey(dateStr)
  return `${d.getMonth() + 1}/${d.getDate()}`
}

export function getElapsedSeconds(startedAt: string | null): number {
  if (!startedAt) return 0
  return Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000)
}

export function getGreetingKey(): 'morning' | 'afternoon' | 'evening' {
  const hour = new Date().getHours()
  if (hour >= 5 && hour < 12) return 'morning'
  if (hour >= 12 && hour < 18) return 'afternoon'
  return 'evening'
}
