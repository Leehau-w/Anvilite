export interface GrowthEvent {
  id: string
  type:
    | 'task_complete'
    | 'habit_complete'
    | 'habit_skip'
    | 'habit_miss'
    | 'level_up'
    | 'badge_earned'
    | 'area_level_up'
    | 'milestone'
    | 'custom_milestone'
    | 'prestige'
  title: string
  details: {
    xpGained?: number
    oreGained?: number
    actualMinutes?: number
    categoryName?: string
    oldLevel?: number
    newLevel?: number
    badgeId?: string
    areaName?: string
    prosperityLevel?: number
    consecutiveCount?: number
    description?: string
    // Milestone inscription data
    sourceType?: 'task' | 'habit'
    difficulty?: number
    totalCompletions?: number
    durationDays?: number  // days since creation
  }
  isMilestone: boolean
  timestamp: string
}
