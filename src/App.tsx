import React, { useState } from 'react'
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

function App() {
  const [activeTab, setActiveTab] = useState<NavTab>('dashboard')
  const [settingsOpen, setSettingsOpen] = useState(false)

  return (
    <ToastProvider>
      <FeedbackProvider>
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
              {activeTab === 'dashboard' && (
                <Dashboard onNavigate={(tab) => setActiveTab(tab as NavTab)} />
              )}
              {activeTab === 'tasks' && <TaskList />}
              {activeTab === 'worldmap' && <WorldMap />}
              {activeTab === 'milestone' && <MilestoneHall />}
            </main>
          </div>

          <StatusBar />
        </div>

        <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      </FeedbackProvider>
    </ToastProvider>
  )
}

function Placeholder({ title, emoji, desc }: { title: string; emoji: string; desc: string }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        gap: 12,
        color: 'var(--color-text-dim)',
      }}
    >
      <span style={{ fontSize: 48 }}>{emoji}</span>
      <span style={{ fontSize: 16, fontWeight: 600, color: 'var(--color-text)' }}>{title}</span>
      <span style={{ fontSize: 13 }}>{desc}</span>
    </div>
  )
}

export default App
