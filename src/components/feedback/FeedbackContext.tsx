import { createContext, useContext, type ReactNode } from 'react'

interface FeedbackPayload {
  xp: number
  ore: number
  leveledUp: boolean
  oldLevel: number
  newLevel: number
  oldStreakDays?: number
  newStreakDays?: number
  prestigeUnlocked?: boolean
}

interface FeedbackContextValue {
  triggerFeedback: (payload: FeedbackPayload) => void
  showPrestigeModal: () => void
}

// Keep the old API inert for compatibility; it must not observe activity or grant rewards.
const inactiveFeedback: FeedbackContextValue = {
  triggerFeedback: () => {},
  showPrestigeModal: () => {},
}
const FeedbackContext = createContext(inactiveFeedback)

export function useFeedback() {
  return useContext(FeedbackContext)
}

export function FeedbackProvider({ children }: { children: ReactNode }) {
  return <FeedbackContext.Provider value={inactiveFeedback}>{children}</FeedbackContext.Provider>
}
