export interface Habit {
  id: string
  title: string
  category: string
  difficulty: 1 | 2 | 3 | 4 | 5
  estimatedMinutes: number
  repeatType: 'daily' | 'weekdays' | 'weekly' | 'biweekly' | 'monthly' | 'custom' | 'monthly_fixed'
  customIntervalDays: number | null
  weeklyDays: number[] | null       // [1,3,5] = 周一三五 (1=Mon, 7=Sun)
  weeklyMode: 'strict' | 'flexible' | null
  weeklyFlexibleCount: number | null  // 灵活模式时每周需完成次数
  monthlyDays: number[] | null       // monthly_fixed: 指定日期，-1=月末最后一天
  targetCount: number                // 周期内目标完成次数（默认1）
  currentCycleCount: number          // 当前周期内已完成次数
  startDate: string
  endDate: string | null
  reminderTime: string | null        // HH:mm
  description: string
  parentId: string | null
  childIds: string[]
  nestingLevel: number              // 0=根, 1=子, 2=孙（最多3层）
  status: 'active' | 'completed_today' | 'paused' | 'archived' | 'mastered'
  isHidden: boolean
  deletedAt: string | null
  timerStartedAt: string | null
  actualMinutes: number
  consecutiveCount: number
  totalCompletions: number
  toleranceCharges: number           // 0或1
  toleranceNextAt: number            // 下次获得容错所需连续次数
  weeklyCompletionCount: number       // 本周已完成次数（仅 weekly flexible 使用）
  lastCompletedAt: string | null
  lastDueAt: string | null
  sortOrder: number
  createdAt: string
  updatedAt: string
}

export type HabitRepeatType = Habit['repeatType']
export type HabitStatus = Habit['status']

export interface HabitGroup {
  id: string
  name: string
  type: 'custom'
  habitIds: string[]
  createdAt: string
}
