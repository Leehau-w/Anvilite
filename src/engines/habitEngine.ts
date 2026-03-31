import type { Habit } from '@/types/habit'

/** 判断习惯今天是否应该出现 */
export function isHabitDueToday(habit: Habit): boolean {
  if (habit.status === 'paused' || habit.status === 'archived') return false

  const today = new Date()
  const todayStr = today.toISOString().split('T')[0]
  const dayOfWeek = today.getDay() === 0 ? 7 : today.getDay() // 1=Mon, 7=Sun

  // 还未开始
  if (habit.startDate > todayStr) return false
  // 已结束
  if (habit.endDate && habit.endDate < todayStr) return false

  switch (habit.repeatType) {
    case 'daily':
      return true
    case 'weekdays':
      return dayOfWeek >= 1 && dayOfWeek <= 5
    case 'weekly': {
      if (habit.weeklyMode === 'strict' && habit.weeklyDays) {
        return habit.weeklyDays.includes(dayOfWeek)
      }
      // 灵活模式：本周还没达到目标次数
      if (habit.weeklyMode === 'flexible' && habit.weeklyFlexibleCount) {
        const weekCompletions = getWeekCompletions(habit)
        return weekCompletions < habit.weeklyFlexibleCount
      }
      return false
    }
    case 'biweekly': {
      if (!habit.lastDueAt) return true
      const lastDue = new Date(habit.lastDueAt)
      const diffDays = Math.floor((today.getTime() - lastDue.getTime()) / 86400000)
      return diffDays >= 14
    }
    case 'monthly': {
      if (!habit.lastDueAt) return true
      const lastDue = new Date(habit.lastDueAt)
      return (
        today.getFullYear() > lastDue.getFullYear() ||
        today.getMonth() > lastDue.getMonth()
      )
    }
    case 'custom': {
      if (!habit.customIntervalDays) return false
      if (!habit.lastDueAt) return true
      const lastDue = new Date(habit.lastDueAt)
      const diffDays = Math.floor((today.getTime() - lastDue.getTime()) / 86400000)
      return diffDays >= habit.customIntervalDays
    }
    case 'monthly_fixed': {
      if (!habit.monthlyDays || habit.monthlyDays.length === 0) return false
      const dayOfMonth = today.getDate()
      const lastDayOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate()
      return habit.monthlyDays.some((d) => {
        if (d === -1) return dayOfMonth === lastDayOfMonth
        // 月份天数不足时向下兼容到月末（如31号在2月→月末）
        return dayOfMonth === Math.min(d, lastDayOfMonth)
      })
    }
  }
}

/** 获取下次刷新的提示文字 */
export function getNextRefreshText(habit: Habit): string | null {
  if (habit.repeatType === 'daily' || habit.repeatType === 'weekdays') return null

  const today = new Date()
  const dayOfWeek = today.getDay() === 0 ? 7 : today.getDay()

  switch (habit.repeatType) {
    case 'weekly': {
      if (habit.weeklyMode === 'strict' && habit.weeklyDays && habit.weeklyDays.length > 0) {
        const days = habit.weeklyDays.sort()
        const next = days.find((d) => d > dayOfWeek) ?? days[0]
        const labels = ['', '周一', '周二', '周三', '周四', '周五', '周六', '周日']
        return `下次：${labels[next]}`
      }
      return null
    }
    case 'biweekly':
      return `下次：两周后`
    case 'monthly':
      return `下次：下月`
    case 'custom':
      return habit.customIntervalDays ? `下次：${habit.customIntervalDays}天后` : null
    case 'monthly_fixed': {
      if (!habit.monthlyDays || habit.monthlyDays.length === 0) return null
      const sorted = [...habit.monthlyDays].sort((a, b) => (a === -1 ? 32 : a) - (b === -1 ? 32 : b))
      const today2 = new Date()
      const dayOfMonth = today2.getDate()
      const next = sorted.find((d) => (d === -1 ? 32 : d) > dayOfMonth)
      if (next !== undefined) return `下次：${next === -1 ? '月末' : `${next}号`}`
      return `下次：下月${sorted[0] === -1 ? '末' : `${sorted[0]}号`}`
    }
    default:
      return null
  }
}

function getWeekCompletions(habit: Habit): number {
  if (!habit.lastCompletedAt) return 0
  const today = new Date()
  const dayOfWeek = today.getDay() === 0 ? 7 : today.getDay()
  const monday = new Date(today)
  monday.setDate(today.getDate() - (dayOfWeek - 1))
  monday.setHours(0, 0, 0, 0)
  // 上次完成在本周之前 → 计数已过期
  if (new Date(habit.lastCompletedAt) < monday) return 0
  return habit.weeklyCompletionCount ?? 0
}

/** 计算新的连续次数 */
export function calculateNewStreak(habit: Habit, action: 'complete' | 'skip' | 'miss'): number {
  switch (action) {
    case 'complete':
      return habit.consecutiveCount + 1
    case 'skip':
      return Math.max(0, habit.consecutiveCount - Math.max(1, Math.floor(habit.consecutiveCount * 0.1)))
    case 'miss': {
      if (habit.toleranceCharges > 0) {
        return habit.consecutiveCount // 容错抵消，不变
      }
      return Math.max(0, Math.floor(habit.consecutiveCount / 2))
    }
  }
}

/** 计算容错相关 */
export function calculateToleranceUpdate(habit: Habit, action: 'complete' | 'miss'): {
  charges: number
  nextAt: number
} {
  let { toleranceCharges, toleranceNextAt, consecutiveCount } = habit

  if (action === 'complete') {
    const newConsecutive = consecutiveCount + 1
    // 首次7连续得1个
    if (toleranceNextAt === 0) {
      if (newConsecutive >= 7) {
        toleranceCharges = Math.min(1, toleranceCharges + 1)
        toleranceNextAt = newConsecutive + 14
      } else {
        toleranceNextAt = 7
      }
    } else if (newConsecutive >= toleranceNextAt) {
      toleranceCharges = Math.min(1, toleranceCharges + 1)
      toleranceNextAt = newConsecutive + 14
    }
  }

  if (action === 'miss' && toleranceCharges > 0) {
    toleranceCharges -= 1
  }

  return { charges: toleranceCharges, nextAt: toleranceNextAt }
}
