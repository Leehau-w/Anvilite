import { useState, useEffect, useCallback } from 'react'
import { TopBar } from '@/components/layout/TopBar'
import { Sidebar, type NavTab } from '@/components/layout/Sidebar'
import { StatusBar } from '@/components/layout/StatusBar'
import { SettingsModal } from '@/components/layout/SettingsModal'
import { Dashboard } from '@/components/dashboard/Dashboard'
import { TaskList } from '@/components/tasks/TaskList'
import { MilestoneHall } from '@/components/milestone/MilestoneHall'
import { WorldMap } from '@/components/worldmap/WorldMap'
import { InspirationModal } from '@/components/ui/InspirationModal'
import { SOPPage } from '@/components/sop/SOPPage'
import { ToastProvider, useToast } from '@/components/feedback/Toast'
import { FeedbackProvider } from '@/components/feedback/FeedbackContext'
import ErrorBoundary from '@/components/ui/ErrorBoundary'
import { startDateWatcher } from '@/utils/dateWatcher'
import { useHabitStore } from '@/stores/habitStore'
import { useProsperityWatcher } from '@/hooks/useProsperityWatcher'
import { useT } from '@/i18n'

function App() {
  const [activeTab, setActiveTab] = useState<NavTab>('dashboard')
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [inspirationOpen, setInspirationOpen] = useState(false)
  const [, setDateTick] = useState(0)

  useProsperityWatcher()

  useEffect(() => {
    return startDateWatcher(() => {
      useHabitStore.getState().resetDailyHabits()
      setDateTick((v) => v + 1)
    })
  }, [])

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.ctrlKey && e.shiftKey && e.key === 'N') {
      e.preventDefault()
      setInspirationOpen((v) => !v)
    }
  }, [])

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  return (
    <ToastProvider>
      <FeedbackProvider>
        <ErrorBoundary>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              height: '100vh',
              overflow: 'hidden',
              background: 'var(--color-bg)',
            }}
          >
            <TopBar onSettingsClick={() => setSettingsOpen(true)} />

            <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
              <Sidebar activeTab={activeTab} onTabChange={setActiveTab} />

              <main style={{ flex: 1, overflow: 'hidden' }}>
                <ErrorBoundary>
                  {activeTab === 'dashboard' && (
                    <Dashboard
                      onNavigate={(tab) => setActiveTab(tab as NavTab)}
                      onOpenInspiration={() => setInspirationOpen(true)}
                    />
                  )}
                  {activeTab === 'tasks' && <TaskList />}
                  {activeTab === 'worldmap' && <WorldMap />}
                  {activeTab === 'milestone' && <MilestoneHall />}
                  {activeTab === 'sop' && <SOPPage />}
                </ErrorBoundary>
              </main>
            </div>

            <StatusBar />
          </div>

          <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
          <InspirationModal open={inspirationOpen} onClose={() => setInspirationOpen(false)} />
          <StaleTimerWatcher />
        </ErrorBoundary>
      </FeedbackProvider>
    </ToastProvider>
  )
}

function StaleTimerWatcher() {
  const { showToast } = useToast()
  const t = useT()
  // MED-08: include showToast and t in deps
  useEffect(() => {
    const stale = sessionStorage.getItem('anvilite-stale-timers')
    if (stale) {
      sessionStorage.removeItem('anvilite-stale-timers')
      showToast(t.timer_stalePaused(Number(stale)))
    }
  }, [showToast, t])
  return null
}

export default App
