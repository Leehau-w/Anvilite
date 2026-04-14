import React, { useMemo } from 'react'
import { useSOPStore } from '@/stores/sopStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { getSystemFolder, getSystemSOPs } from '@/data/systemSOPs'
import { useT } from '@/i18n'
import type { SOP } from '@/types/sop'

function getSOPTypeIcon(type: SOP['type']): string {
  return { schedule: '⏰', workflow: '🔄', checklist: '☑️', itemlist: '📝' }[type]
}

interface Props {
  onNavigate: () => void
}

export function FlowsSummaryCard({ onNavigate }: Props) {
  const t = useT()
  const lang = useSettingsStore((s) => s.settings.language)
  const { folders, sops, selectSOP, collapsedFolderIds, toggleFolderCollapsed } = useSOPStore()
  const systemFolder = useMemo(() => getSystemFolder(lang), [lang])
  const systemSOPs = useMemo(() => getSystemSOPs(lang), [lang])

  const userFolders = useMemo(
    () => folders.filter((f) => !f.isSystem).sort((a, b) => a.sortOrder - b.sortOrder),
    [folders]
  )
  const allSOPs = useMemo(() => [...systemSOPs, ...sops], [systemSOPs, sops])

  function handleClick(sopId: string) {
    selectSOP(sopId)
    onNavigate()
  }

  const hasUser = userFolders.some((f) => allSOPs.some((s) => s.folderId === f.id))
  const systemItems = allSOPs.filter((s) => s.folderId === systemFolder.id).slice(0, 4)

  if (!hasUser && systemItems.length === 0) {
    return (
      <div style={{
        height: '100%', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        gap: 8, color: 'var(--color-text-dim)',
      }}>
        <div style={{ fontSize: 24 }}>📋</div>
        <div style={{ fontSize: 13 }}>{t.sop_emptyState}</div>
        <button
          onClick={onNavigate}
          style={{
            marginTop: 4, fontSize: 12, padding: '4px 14px',
            borderRadius: 'var(--radius-full)',
            border: '1px solid var(--color-accent)',
            background: 'transparent', color: 'var(--color-accent)',
            cursor: 'pointer',
          }}
        >
          {lang === 'zh' ? '创建流程' : 'Create Flow'}
        </button>
      </div>
    )
  }

  const SYSTEM_ID = systemFolder.id

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ flex: 1, overflowY: 'auto', scrollbarWidth: 'thin', scrollbarColor: 'var(--color-border) transparent' }}>

        {/* 用户文件夹 */}
        {userFolders.map((folder) => {
          const items = allSOPs.filter((s) => s.folderId === folder.id)
          if (items.length === 0) return null
          const isCollapsed = collapsedFolderIds.includes(folder.id)
          return (
            <div key={folder.id} style={{ marginBottom: 6 }}>
              <FolderHeader
                label={`📁 ${folder.name}`}
                count={items.length}
                collapsed={isCollapsed}
                onToggle={() => toggleFolderCollapsed(folder.id)}
              />
              {!isCollapsed && items.map((sop) => (
                <SOPRow key={sop.id} sop={sop} onClick={() => handleClick(sop.id)} />
              ))}
            </div>
          )
        })}

        {/* 系统模板 */}
        {systemItems.length > 0 && (
          <div style={{ marginBottom: 6 }}>
            <FolderHeader
              label={`✨ ${t.sop_systemFolder}`}
              count={systemItems.length}
              collapsed={collapsedFolderIds.includes(SYSTEM_ID)}
              onToggle={() => toggleFolderCollapsed(SYSTEM_ID)}
            />
            {!collapsedFolderIds.includes(SYSTEM_ID) && systemItems.map((sop) => (
              <SOPRow key={sop.id} sop={sop} onClick={() => handleClick(sop.id)} />
            ))}
          </div>
        )}
      </div>

      {/* 底部跳转 */}
      <div
        onClick={onNavigate}
        style={{
          marginTop: 8, fontSize: 12, color: 'var(--color-accent)',
          cursor: 'pointer', textAlign: 'right', flexShrink: 0,
        }}
        onMouseEnter={(e) => { e.currentTarget.style.textDecoration = 'underline' }}
        onMouseLeave={(e) => { e.currentTarget.style.textDecoration = 'none' }}
      >
        {lang === 'zh' ? '查看全部流程 →' : 'View all flows →'}
      </div>
    </div>
  )
}

function FolderHeader({ label, count, collapsed, onToggle }: {
  label: string
  count: number
  collapsed: boolean
  onToggle: () => void
}) {
  return (
    <div
      onClick={onToggle}
      style={{
        display: 'flex', alignItems: 'center', gap: 4,
        padding: '2px 4px', marginBottom: collapsed ? 0 : 2,
        borderRadius: 'var(--radius-sm)', cursor: 'pointer',
        userSelect: 'none',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--color-surface-hover)' }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
    >
      <span style={{ fontSize: 10, color: 'var(--color-text-dim)', width: 10 }}>
        {collapsed ? '▶' : '▼'}
      </span>
      <span style={{ fontSize: 11, color: 'var(--color-text-dim)', fontWeight: 600, flex: 1, letterSpacing: '0.03em' }}>
        {label}
      </span>
      <span style={{ fontSize: 10, color: 'var(--color-text-dim)', opacity: 0.6 }}>
        {count}
      </span>
    </div>
  )
}

function SOPRow({ sop, onClick }: { sop: SOP; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '4px 6px 4px 20px', borderRadius: 'var(--radius-sm)',
        cursor: 'pointer', fontSize: 13, color: 'var(--color-text)',
        transition: 'background 0.1s',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--color-surface-hover)' }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
    >
      <span style={{ flexShrink: 0 }}>{getSOPTypeIcon(sop.type)}</span>
      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {sop.title}
      </span>
      <span style={{ fontSize: 11, color: 'var(--color-text-dim)', flexShrink: 0 }}>
        {sop.steps.length}步
      </span>
    </div>
  )
}
