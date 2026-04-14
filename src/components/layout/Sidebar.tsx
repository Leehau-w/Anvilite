import React from 'react'
import { useT } from '@/i18n'

export type NavTab = 'dashboard' | 'tasks' | 'worldmap' | 'milestone' | 'sop'

interface NavItem {
  id: NavTab
  labelKey: 'sidebar_dashboard' | 'sidebar_tasks' | 'sidebar_worldmap' | 'sidebar_milestone' | 'sidebar_sop'
  icon: React.ReactNode
}

const NAV_ITEMS: NavItem[] = [
  {
    id: 'dashboard',
    labelKey: 'sidebar_dashboard',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </svg>
    ),
  },
  {
    id: 'tasks',
    labelKey: 'sidebar_tasks',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M9 11l3 3L22 4" />
        <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
      </svg>
    ),
  },
  {
    id: 'sop',
    labelKey: 'sidebar_sop',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
        <polyline points="10 9 9 9 8 9" />
      </svg>
    ),
  },
  {
    id: 'worldmap',
    labelKey: 'sidebar_worldmap',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="10" />
        <line x1="2" y1="12" x2="22" y2="12" />
        <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
      </svg>
    ),
  },
  {
    id: 'milestone',
    labelKey: 'sidebar_milestone',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
      </svg>
    ),
  },
]

interface SidebarProps {
  activeTab: NavTab
  onTabChange: (tab: NavTab) => void
}

export function Sidebar({ activeTab, onTabChange }: SidebarProps) {
  const t = useT()
  return (
    <nav
      className="flex flex-col items-center py-3 shrink-0"
      style={{
        width: 56,
        background: 'var(--color-surface)',
        borderRight: '1px solid var(--color-border)',
        gap: 16,
      }}
    >
      {NAV_ITEMS.map((item) => {
        const isActive = activeTab === item.id
        return (
          <button
            key={item.id}
            onClick={() => onTabChange(item.id)}
            title={t[item.labelKey]}
            className="flex items-center justify-center transition-colors"
            style={{
              width: 36,
              height: 36,
              borderRadius: 'var(--radius-md)',
              background: isActive ? `color-mix(in srgb, var(--color-accent) 15%, transparent)` : 'transparent',
              color: isActive ? 'var(--color-accent)' : 'var(--color-text-dim)',
              border: 'none',
              cursor: 'pointer',
            }}
            onMouseEnter={(e) => {
              if (!isActive) {
                e.currentTarget.style.background = 'var(--color-surface-hover)'
                e.currentTarget.style.color = 'var(--color-text)'
              }
            }}
            onMouseLeave={(e) => {
              if (!isActive) {
                e.currentTarget.style.background = 'transparent'
                e.currentTarget.style.color = 'var(--color-text-dim)'
              }
            }}
          >
            {item.icon}
          </button>
        )
      })}
    </nav>
  )
}
