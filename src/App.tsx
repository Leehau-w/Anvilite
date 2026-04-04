import React, { useState, useEffect } from 'react'
import { TopBar } from '@/components/layout/TopBar'
import { Sidebar, type NavTab } from '@/components/layout/Sidebar'
import { StatusBar } from '@/components/layout/StatusBar'
import { SettingsModal } from '@/components/layout/SettingsModal'
import { Dashboard } from '@/components/dashboard/Dashboard'
import { TaskList } from '@/components/tasks/TaskList'
import { MilestoneHall } from '@/components/milestone/MilestoneHall'
import { WorldMap } from '@/components/worldmap/WorldMap'
import { ToastProvider } from '@/components/feedback/Toast'
import { FeedbackProvider } from '@/components/feedback/FeedbackContext'
import ErrorBoundary from '@/components/ui/ErrorBoundary'
import { startDateWatcher } from '@/utils/dateWatcher'
import { useHabitStore } from '@/stores/habitStore'

function App() {
  const [activeTab, setActiveTab] = useState<NavTab>('dashboard')
  const [settingsOpen, setSettingsOpen] = useState(false)

  useEffect(() => {
    return startDateWatcher(() => {
      useHabitStore.getState().resetDailyHabits()
    })
  }, [])

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
                    <Dashboard onNavigate={(tab) => setActiveTab(tab as NavTab)} />
                  )}
                  {activeTab === 'tasks' && <TaskList />}
                  {activeTab === 'worldmap' && <WorldMap />}
                  {activeTab === 'milestone' && <MilestoneHall />}
                </ErrorBoundary>
              </main>
            </div>

            <StatusBar />
          </div>

          <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
        </ErrorBoundary>
      </FeedbackProvider>
    </ToastProvider>
  )
}

export default App
