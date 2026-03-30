import React from 'react'
import { useT } from '@/i18n'

interface TopBarProps {
  onSettingsClick: () => void
}

// -webkit-app-region is not in React.CSSProperties; cast via augmentation
type DragStyle = React.CSSProperties & { WebkitAppRegion?: 'drag' | 'no-drag' }

export function TopBar({ onSettingsClick }: TopBarProps) {
  const t = useT()

  return (
    <header
      className="flex items-center justify-between px-4 shrink-0"
      style={{
        height: 44,
        background: 'var(--color-surface)',
        borderBottom: '1px solid var(--color-border)',
        WebkitAppRegion: 'drag',
      } as DragStyle}
    >
      <div className="flex items-center gap-1" style={{ WebkitAppRegion: 'no-drag' } as DragStyle}>
        <span
          style={{
            fontSize: 16,
            fontWeight: 800,
            color: 'var(--color-accent)',
            fontFamily: 'var(--font-en)',
          }}
        >
          Anvilite
        </span>
        <span
          style={{
            fontSize: 12,
            color: 'var(--color-text-dim)',
          }}
        >
          · {t.app_subtitle}
        </span>
      </div>

      {/* 右侧：设置 + 窗口控制 */}
      <div className="flex items-center gap-1" style={{ WebkitAppRegion: 'no-drag' } as DragStyle}>
        <button
          onClick={onSettingsClick}
          className="flex items-center justify-center"
          style={{
            width: 32,
            height: 32,
            color: 'var(--color-text-dim)',
            borderRadius: 'var(--radius-md)',
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            transition: 'background 0.15s, color 0.15s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'var(--color-surface-hover)'
            e.currentTarget.style.color = 'var(--color-text)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent'
            e.currentTarget.style.color = 'var(--color-text-dim)'
          }}
          title={t.topbar_settings}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
        </button>

        <div style={{ width: 1, height: 16, background: 'var(--color-border)', margin: '0 2px' }} />

        <WinBtn onClick={() => window.electronAPI?.minimize()} title="最小化">
          <svg width="10" height="2" viewBox="0 0 10 2" fill="currentColor"><rect width="10" height="2" rx="1"/></svg>
        </WinBtn>
        <WinBtn onClick={() => window.electronAPI?.maximize()} title="最大化/还原">
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.2"><rect x="0.6" y="0.6" width="8.8" height="8.8" rx="1.2"/></svg>
        </WinBtn>
        <WinBtn onClick={() => window.electronAPI?.close()} title="关闭" danger>
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.4">
            <line x1="1" y1="1" x2="9" y2="9"/><line x1="9" y1="1" x2="1" y2="9"/>
          </svg>
        </WinBtn>
      </div>
    </header>
  )
}

function WinBtn({ children, onClick, title, danger }: { children: React.ReactNode; onClick: () => void; title: string; danger?: boolean }) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        width: 28,
        height: 28,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 'var(--radius-sm)',
        border: 'none',
        background: 'transparent',
        color: 'var(--color-text-dim)',
        cursor: 'pointer',
        transition: 'background 0.12s, color 0.12s',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = danger ? '#dc2626' : 'var(--color-surface-hover)'
        e.currentTarget.style.color = danger ? 'white' : 'var(--color-text)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'transparent'
        e.currentTarget.style.color = 'var(--color-text-dim)'
      }}
    >
      {children}
    </button>
  )
}
