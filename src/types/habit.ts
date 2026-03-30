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
  status: 'active' | 'completed_today' | 'paused' | 'archived'
  isHidden: boolean
  timerStartedAt: string | null
  actualMinutes: number
  consecutiveCount: number
  totalCompletions: number
  toleranceCharges: number           // 0或1
  toleranceNextAt: number            // 下次获得容错所需连续次数
  lastCompletedAt: string | null
  lastDueAt: string | null
  createdAt: string
  updatedAt: string
}

export type HabitRepeatType = Habit['repeatType']
export type HabitStatus = Habit['status']

export const REPEAT_TYPE_LABELS: Record<HabitRepeatType, string> = {
  daily: '每天',
  weekdays: '工作日',
  weekly: '每周',
  biweekly: '每两周',
  monthly: '每月',
  custom: '自定义',
  monthly_fixed: '每月固定',
}

export const WEEKDAY_LABELS = ['', '周一', '周二', '周三', '周四', '周五', '周六', '周日']
