import { useEffect, useMemo, useState } from 'react'
import type { SOP, SOPFolder } from '@/types/sop'
import { useSOPStore } from '@/stores/sopStore'
import { useT } from '@/i18n'
import { useSettingsStore } from '@/stores/settingsStore'
import { isSystemTemplateFolder } from '@/utils/sopLibrary'
import { beginSOPDrag, endSOPDrag, isSOPDrag, takeDraggedSOP } from '@/utils/sopDrag'
import { useSOPLibrary } from './useSOPLibrary'
import { SOPContextMenu } from './SOPContextMenu'

function getDisplayStyleIcon(style: SOP['displayStyle']): string {
  const icons: Record<SOP['displayStyle'], string> = {
    numbered: '≡',
    bullet: '•',
    timeline: '⏰',
  }
  return icons[style]
}

interface Props {
  onNewSOP: (folderId: string) => void
  onEditSOP?: (id: string) => void
}

export function SOPTree({ onNewSOP, onEditSOP }: Props) {
  const t = useT()
  const lang = useSettingsStore((s) => s.settings.language)
  const {
    selectedSOPId, selectSOP, transferSOP,
    addFolder, renameFolder,
    collapsedFolderIds, toggleFolderCollapsed,
  } = useSOPStore()
  const { folders, sops } = useSOPLibrary()
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [dropFolderId, setDropFolderId] = useState<string | null>(null)
  const [newFolderInput, setNewFolderInput] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [contextMenu, setContextMenu] = useState<{
    x: number; y: number; type: 'folder' | 'sop'; target: SOPFolder | SOP
  } | null>(null)

  const allFolders = useMemo(() => [...folders].sort((a, b) => {
    if (a.isSystem !== b.isSystem) return a.isSystem ? -1 : 1
    return a.sortOrder - b.sortOrder
  }), [folders])
  const allSOPs = sops
  const draggingSOP = sops.find(sop => sop.id === draggingId)
  const dragCopies = !!draggingSOP && isSystemTemplateFolder(draggingSOP.folderId, folders)

  useEffect(() => {
    const clear = () => { setDraggingId(null); setDropFolderId(null); endSOPDrag() }
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') clear() }
    window.addEventListener('dragend', clear)
    window.addEventListener('drop', clear)
    window.addEventListener('blur', clear)
    window.addEventListener('keydown', escape)
    return () => {
      window.removeEventListener('dragend', clear)
      window.removeEventListener('drop', clear)
      window.removeEventListener('blur', clear)
      window.removeEventListener('keydown', escape)
      endSOPDrag()
    }
  }, [])

  function canDrop(dataTransfer: DataTransfer, folderId: string) {
    return isSOPDrag(dataTransfer) && !!draggingSOP && draggingSOP.folderId !== folderId
  }

  function onDrop(event: React.DragEvent, folderId: string) {
    if (!canDrop(event.dataTransfer, folderId)) return
    event.preventDefault(); event.stopPropagation()
    const sourceId = takeDraggedSOP(event.dataTransfer)
    setDraggingId(null); setDropFolderId(null)
    if (!sourceId) return
    const id = transferSOP(sourceId, folderId, lang)
    if (id) selectSOP(id)
  }

  function handleContextMenu(
    e: React.MouseEvent,
    type: 'folder' | 'sop',
    target: SOPFolder | SOP
  ) {
    e.preventDefault()
    e.stopPropagation()
    setContextMenu({ x: e.clientX, y: e.clientY, type, target })
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

  function renderFolder(folder: SOPFolder, depth: number) {
    const childFolders = allFolders
      .filter((f) => f.parentId === folder.id)
      .sort((a, b) => a.sortOrder - b.sortOrder)
    const folderSOPs = allSOPs
      .filter((s) => s.folderId === folder.id)
      .sort((a, b) => a.sortOrder - b.sortOrder)
    const isCollapsed = collapsedFolderIds.includes(folder.id)
    const isRenaming = renamingId === folder.id

    return (
      <div key={folder.id}>
        {/* 文件夹标题行 */}
        <div
          className="group"
          data-sop-folder={folder.id}
          data-sop-drop-active={dropFolderId === folder.id ? 'true' : 'false'}
          onDragOver={event => {
            if (!canDrop(event.dataTransfer, folder.id)) return
            event.preventDefault(); event.stopPropagation()
            event.dataTransfer.dropEffect = dragCopies ? 'copy' : 'move'
            setDropFolderId(folder.id)
          }}
          onDragLeave={event => {
            if (event.relatedTarget instanceof Node && event.currentTarget.contains(event.relatedTarget)) return
            setDropFolderId(current => current === folder.id ? null : current)
          }}
          onDrop={event => onDrop(event, folder.id)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '8px 12px',
            paddingLeft: 12 + depth * 16,
            cursor: 'pointer',
            userSelect: 'none',
            background: dropFolderId === folder.id ? 'color-mix(in srgb, var(--color-accent) 12%, transparent)' : 'transparent',
            boxShadow: dropFolderId === folder.id ? 'inset 0 0 0 1px var(--color-accent)' : undefined,
          }}
          onClick={() => toggleFolderCollapsed(folder.id)}
          onContextMenu={(e) => handleContextMenu(e, 'folder', folder)}
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
                if (e.nativeEvent.isComposing || e.keyCode === 229) return
                if (e.key === 'Enter') { e.preventDefault(); handleRename(folder.id) }
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

          {dropFolderId === folder.id && <span role="status" style={{ fontSize: 10, color: 'var(--color-accent)', maxWidth: '48%', overflowWrap: 'anywhere' }}>{dragCopies ? t.sop_dropCopy : t.sop_dropMove}</span>}

          {/* ⋯ 按钮触发右键菜单 */}
          {!isRenaming && (
            <span
              style={{ fontSize: 14, color: 'var(--color-text-dim)', padding: '0 2px', opacity: 0 }}
              className="group-hover:opacity-100"
              onClick={(e) => {
                e.stopPropagation()
                handleContextMenu(e, 'folder', folder)
              }}
            >
              ⋯
            </span>
          )}
        </div>

        {/* 展开内容 */}
        {!isCollapsed && (
          <>
            {childFolders.map((cf) => renderFolder(cf, depth + 1))}
            {folderSOPs.map((sop) => (
              <div
                key={sop.id}
                data-sop-id={sop.id}
                draggable
                title={t.sop_dragToFolder}
                onDragStart={event => {
                  event.stopPropagation()
                  beginSOPDrag(event, sop.id)
                  setDraggingId(sop.id)
                }}
                onDragEnd={() => { endSOPDrag(); setDraggingId(null); setDropFolderId(null) }}
                onClick={() => selectSOP(sop.id)}
                onContextMenu={(e) => handleContextMenu(e, 'sop', sop)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '6px 12px',
                  paddingLeft: 28 + depth * 16,
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
                <span>{getDisplayStyleIcon(sop.displayStyle)}</span>
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
            {(
              <div
                onClick={() => onNewSOP(folder.id)}
                style={{
                  padding: '4px 12px',
                  paddingLeft: 28 + depth * 16,
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
  }

  // 只渲染根级文件夹（parentId === null）
  const rootFolders = allFolders.filter((f) => f.parentId === null)

  return (
    <div
      data-sop-tree
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
      {rootFolders.map((folder) => renderFolder(folder, 0))}

      {/* 新建文件夹 */}
      <div style={{ padding: '8px 12px', borderTop: '1px solid var(--color-border)', marginTop: 'auto' }}>
        {newFolderInput ? (
          <input
            autoFocus
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            onBlur={handleAddFolder}
            onKeyDown={(e) => {
              if (e.nativeEvent.isComposing || e.keyCode === 229) return
              if (e.key === 'Enter') { e.preventDefault(); handleAddFolder() }
              if (e.key === 'Escape') { setNewFolderInput(false); setNewFolderName('') }
            }}
            placeholder={t.sop_newFolder}
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

      {/* 右键菜单 */}
      {contextMenu && (
        <SOPContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          type={contextMenu.type}
          target={contextMenu.target}
          onClose={() => setContextMenu(null)}
          onNewSOP={onNewSOP}
          onEditSOP={onEditSOP}
          onStartRename={(id, name) => {
            setRenamingId(id)
            setRenameValue(name)
          }}
        />
      )}
    </div>
  )
}
