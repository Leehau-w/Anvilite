import { useEffect, useRef, useState } from 'react'
import type { SOP, SOPFolder } from '@/types/sop'
import { useSOPStore } from '@/stores/sopStore'
import { useT } from '@/i18n'

interface Props {
  x: number
  y: number
  type: 'folder' | 'sop'
  target: SOPFolder | SOP
  onClose: () => void
  onNewSOP: (folderId: string) => void
  onStartRename: (id: string, name: string) => void
}

export function SOPContextMenu({ x, y, type, target, onClose, onNewSOP, onStartRename }: Props) {
  const t = useT()
  const {
    folders, sops,
    addFolder, deleteFolder, deleteFolderRecursive,
    moveSOP, deleteSOP, duplicateSOP, selectSOP,
    getFolderDepth,
  } = useSOPStore()

  const [showMoveMenu, setShowMoveMenu] = useState(false)
  const [subfolderInput, setSubfolderInput] = useState(false)
  const [subfolderName, setSubfolderName] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  // 点击外部关闭
  useEffect(() => {
    function handleMouseDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handleMouseDown)
    return () => document.removeEventListener('mousedown', handleMouseDown)
  }, [onClose])

  const userFolders = folders.filter((f) => !f.isSystem)

  // 确保菜单不超出视口
  const adjustedX = Math.min(x, window.innerWidth - 220)
  const adjustedY = Math.min(y, window.innerHeight - 300)

  const menuStyle: React.CSSProperties = {
    position: 'fixed',
    left: adjustedX,
    top: adjustedY,
    background: 'var(--color-surface)',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-md)',
    padding: '4px 0',
    minWidth: 180,
    boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
    zIndex: 300,
  }

  const itemStyle = (danger?: boolean, disabled?: boolean): React.CSSProperties => ({
    display: 'block',
    width: '100%',
    textAlign: 'left',
    padding: '6px 16px',
    fontSize: 13,
    background: 'transparent',
    border: 'none',
    color: danger ? 'var(--color-danger)' : disabled ? 'var(--color-text-dim)' : 'var(--color-text)',
    cursor: disabled ? 'default' : 'pointer',
    opacity: disabled ? 0.5 : 1,
  })

  if (type === 'folder') {
    const folder = target as SOPFolder
    const folderSOPs = sops.filter((s) => s.folderId === folder.id)
    const childFolders = folders.filter((f) => f.parentId === folder.id)
    const isEmpty = folderSOPs.length === 0 && childFolders.length === 0
    const depth = getFolderDepth(folder.id)
    const canCreateSubfolder = depth < 2

    return (
      <div ref={ref} style={menuStyle}>
        {/* 新建 SOP */}
        {!folder.isSystem && (
          <button
            style={itemStyle()}
            onClick={() => { onNewSOP(folder.id); onClose() }}
          >
            {t.sop_contextMenu_newSOP}
          </button>
        )}

        {/* 新建子文件夹 */}
        {!folder.isSystem && canCreateSubfolder && !subfolderInput && (
          <button
            style={itemStyle()}
            onClick={() => setSubfolderInput(true)}
          >
            {t.sop_newSubfolder}
          </button>
        )}
        {!folder.isSystem && !canCreateSubfolder && (
          <button style={itemStyle(false, true)} disabled>
            {t.sop_newSubfolder} ({t.sop_maxDepth})
          </button>
        )}

        {/* 子文件夹输入框 */}
        {subfolderInput && (
          <div style={{ padding: '4px 12px' }}>
            <input
              autoFocus
              value={subfolderName}
              onChange={(e) => setSubfolderName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && subfolderName.trim()) {
                  addFolder(subfolderName.trim(), folder.id)
                  onClose()
                }
                if (e.key === 'Escape') onClose()
              }}
              placeholder={t.sop_newSubfolder}
              style={{
                width: '100%', height: 26, fontSize: 12, padding: '0 6px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--color-accent)',
                background: 'var(--color-bg)', color: 'var(--color-text)',
                outline: 'none', boxSizing: 'border-box',
              }}
            />
          </div>
        )}

        {/* 分隔线 */}
        {!folder.isSystem && (
          <div style={{ height: 1, background: 'var(--color-border)', margin: '4px 0' }} />
        )}

        {/* 重命名 */}
        {!folder.isSystem && (
          <button
            style={itemStyle()}
            onClick={() => { onStartRename(folder.id, folder.name); onClose() }}
          >
            {t.sop_contextMenu_rename}
          </button>
        )}

        {/* 删除 */}
        {!folder.isSystem && isEmpty && (
          <button
            style={itemStyle(true)}
            onClick={() => { deleteFolder(folder.id); onClose() }}
          >
            {t.sop_contextMenu_delete}
          </button>
        )}
        {!folder.isSystem && !isEmpty && (
          <button
            style={itemStyle(true)}
            onClick={() => {
              if (window.confirm(t.sop_confirmDeleteAll)) {
                deleteFolderRecursive(folder.id)
                onClose()
              }
            }}
          >
            {t.sop_contextMenu_deleteAll}
          </button>
        )}
      </div>
    )
  }

  // SOP 菜单
  const sop = target as SOP

  if (showMoveMenu) {
    return (
      <div ref={ref} style={menuStyle}>
        <div style={{ padding: '4px 12px', fontSize: 12, color: 'var(--color-text-dim)', fontWeight: 600 }}>
          {t.sop_contextMenu_moveTo}
        </div>
        {userFolders.map((f) => (
          <button
            key={f.id}
            style={itemStyle(false, f.id === sop.folderId)}
            disabled={f.id === sop.folderId}
            onClick={() => {
              moveSOP(sop.id, f.id)
              onClose()
            }}
          >
            {'  '.repeat(getFolderDepth(f.id))}📁 {f.name}
          </button>
        ))}
        <div style={{ height: 1, background: 'var(--color-border)', margin: '4px 0' }} />
        <button style={itemStyle()} onClick={() => setShowMoveMenu(false)}>
          ← {t.common_cancel}
        </button>
      </div>
    )
  }

  return (
    <div ref={ref} style={menuStyle}>
      {/* 编辑 */}
      {!sop.isSystem && (
        <button
          style={itemStyle()}
          onClick={() => { selectSOP(sop.id); onClose() }}
        >
          {t.sop_contextMenu_edit}
        </button>
      )}

      {/* 复制为我的 */}
      {sop.isSystem && (
        <button
          style={itemStyle()}
          onClick={() => {
            const newId = duplicateSOP(sop.id)
            if (newId) selectSOP(newId)
            onClose()
          }}
        >
          {t.sop_copyToMine}
        </button>
      )}

      {/* 移动到 */}
      {!sop.isSystem && userFolders.length > 1 && (
        <button
          style={itemStyle()}
          onClick={() => setShowMoveMenu(true)}
        >
          {t.sop_contextMenu_moveTo}
        </button>
      )}

      {/* 删除 */}
      {!sop.isSystem && (
        <>
          <div style={{ height: 1, background: 'var(--color-border)', margin: '4px 0' }} />
          <button
            style={itemStyle(true)}
            onClick={() => { deleteSOP(sop.id); onClose() }}
          >
            {t.sop_contextMenu_delete}
          </button>
        </>
      )}
    </div>
  )
}
