import React, { useMemo, useState } from 'react'
import type { SOP } from '@/types/sop'
import { useSOPStore } from '@/stores/sopStore'
import { useT } from '@/i18n'
import { useSettingsStore } from '@/stores/settingsStore'
import { getSystemFolder, getSystemSOPs } from '@/data/systemSOPs'

function getSOPTypeIcon(type: SOP['type']): string {
  const icons: Record<SOP['type'], string> = {
    schedule: '⏰',
    workflow: '🔄',
    checklist: '☑️',
    itemlist: '📝',
  }
  return icons[type]
}

interface Props {
  onNewSOP: (folderId: string) => void
}

export function SOPTree({ onNewSOP }: Props) {
  const t = useT()
  const lang = useSettingsStore((s) => s.settings.language)
  const { folders, sops, selectedSOPId, selectSOP, addFolder, renameFolder, deleteFolder } = useSOPStore()
  const [collapsedFolders, setCollapsedFolders] = useState<Set<string>>(new Set())
  const [newFolderInput, setNewFolderInput] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')

  const systemFolder = useMemo(() => getSystemFolder(lang), [lang])
  const systemSOPs = useMemo(() => getSystemSOPs(lang), [lang])

  const tree = useMemo(() => {
    const allFolders = [systemFolder, ...folders].sort((a, b) => {
      if (a.isSystem !== b.isSystem) return a.isSystem ? -1 : 1
      return a.sortOrder - b.sortOrder
    })
    const allSOPs = [...systemSOPs, ...sops]
    return allFolders.map((folder) => ({
      folder,
      items: allSOPs
        .filter((s) => s.folderId === folder.id)
        .sort((a, b) => a.sortOrder - b.sortOrder),
    }))
  }, [systemFolder, systemSOPs, folders, sops])

  function toggleFolder(id: string) {
    setCollapsedFolders((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function handleAddFolder() {
    if (!newFolderName.trim()) {
      setNewFolderInput(false)
      return
    }
    addFolder(newFolderName.trim())
    setNewFolderName('')
    setNewFolderInput(false)
  }

  function handleRename(id: string) {
    if (!renameValue.trim()) {
      setRenamingId(null)
      return
    }
    renameFolder(id, renameValue.trim())
    setRenamingId(null)
  }

  return (
    <div
      style={{
        width: '30%',
        minWidth: 200,
        maxWidth: 280,
        borderRight: '1px solid var(--color-border)',
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
      }}
    >
      {tree.map(({ folder, items }) => {
        const isCollapsed = collapsedFolders.has(folder.id)
        const isRenaming = renamingId === folder.id

        return (
          <div key={folder.id}>
            {/* 文件夹标题行 */}
            <div
              className="group"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '8px 12px',
                cursor: 'pointer',
                userSelect: 'none',
              }}
              onClick={() => toggleFolder(folder.id)}
            >
              <span style={{ fontSize: 12, color: 'var(--color-text-dim)', width: 12 }}>
                {isCollapsed ? '▶' : '▼'}
              </span>
              <span style={{ fontSize: 13 }}>📁</span>

              {isRenaming ? (
                <input
                  autoFocus
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  onBlur={() => handleRename(folder.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleRename(folder.id)
                    if (e.key === 'Escape') setRenamingId(null)
                  }}
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    flex: 1, height: 24, fontSize: 13, padding: '0 6px',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--color-accent)',
                    background: 'var(--color-bg)', color: 'var(--color-text)',
                    outline: 'none',
                  }}
                />
              ) : (
                <span
                  style={{
                    flex: 1, fontSize: 13, fontWeight: 500, color: 'var(--color-text)',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}
                >
                  {folder.name}
                </span>
              )}

              {/* 文件夹操作菜单（非系统文件夹） */}
              {!folder.isSystem && !isRenaming && (
                <span
                  style={{ fontSize: 14, color: 'var(--color-text-dim)', padding: '0 2px', opacity: 0 }}
                  className="group-hover:opacity-100"
                  onClick={(e) => {
                    e.stopPropagation()
                    setRenamingId(folder.id)
                    setRenameValue(folder.name)
                  }}
                  title="重命名"
                >
                  ✏️
                </span>
              )}
              {!folder.isSystem && !isRenaming && items.length === 0 && (
                <span
                  style={{ fontSize: 12, color: 'var(--color-text-dim)', padding: '0 2px', opacity: 0 }}
                  className="group-hover:opacity-100"
                  onClick={(e) => {
                    e.stopPropagation()
                    deleteFolder(folder.id)
                  }}
                  title="删除文件夹"
                >
                  🗑
                </span>
              )}
            </div>

            {/* SOP 条目列表 */}
            {!isCollapsed && (
              <>
                {items.map((sop) => (
                  <div
                    key={sop.id}
                    onClick={() => selectSOP(sop.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '6px 12px 6px 28px',
                      cursor: 'pointer',
                      fontSize: 13,
                      color: selectedSOPId === sop.id ? 'var(--color-accent)' : 'var(--color-text)',
                      background:
                        selectedSOPId === sop.id
                          ? 'color-mix(in srgb, var(--color-accent) 10%, transparent)'
                          : 'transparent',
                      borderRadius: 'var(--radius-sm)',
                      marginInline: 4,
                    }}
                  >
                    <span>{getSOPTypeIcon(sop.type)}</span>
                    <span
                      style={{
                        flex: 1,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {sop.title}
                    </span>
                  </div>
                ))}

                {/* 在此文件夹内新建 SOP */}
                {!folder.isSystem && (
                  <div
                    onClick={() => onNewSOP(folder.id)}
                    style={{
                      padding: '4px 12px 4px 28px',
                      fontSize: 12,
                      color: 'var(--color-text-dim)',
                      cursor: 'pointer',
                      opacity: 0.6,
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
                    onMouseLeave={(e) => (e.currentTarget.style.opacity = '0.6')}
                  >
                    + {t.sop_create}
                  </div>
                )}
              </>
            )}
          </div>
        )
      })}

      {/* 新建文件夹 */}
      <div style={{ padding: '8px 12px', borderTop: '1px solid var(--color-border)', marginTop: 'auto' }}>
        {newFolderInput ? (
          <input
            autoFocus
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            onBlur={handleAddFolder}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleAddFolder()
              if (e.key === 'Escape') { setNewFolderInput(false); setNewFolderName('') }
            }}
            placeholder="文件夹名称"
            style={{
              width: '100%', height: 28, fontSize: 13, padding: '0 8px',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--color-accent)',
              background: 'var(--color-bg)', color: 'var(--color-text)',
              outline: 'none', boxSizing: 'border-box',
            }}
          />
        ) : (
          <button
            onClick={() => setNewFolderInput(true)}
            style={{
              width: '100%', textAlign: 'left', padding: '4px 0',
              background: 'none', border: 'none',
              fontSize: 13, color: 'var(--color-text-dim)',
              cursor: 'pointer',
            }}
          >
            + {t.sop_newFolder}
          </button>
        )}
      </div>
    </div>
  )
}
