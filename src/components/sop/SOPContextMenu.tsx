import { useEffect, useRef, useState } from 'react'
import type { SOP, SOPFolder } from '@/types/sop'
import { useSOPStore } from '@/stores/sopStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { useT } from '@/i18n'
import { isSystemTemplateFolder } from '@/utils/sopLibrary'
import { useSOPLibrary } from './useSOPLibrary'

interface Props {
  x: number
  y: number
  type: 'folder' | 'sop'
  target: SOPFolder | SOP
  onClose: () => void
  onNewSOP: (folderId: string) => void
  onEditSOP?: (id: string) => void
  onStartRename: (id: string, name: string) => void
}

export function SOPContextMenu({ x, y, type, target, onClose, onNewSOP, onEditSOP, onStartRename }: Props) {
  const t = useT()
  const lang = useSettingsStore(s => s.settings.language)
  const { folders, sops } = useSOPLibrary()
  const {
    addFolder, deleteFolder, deleteFolderRecursive, transferSOP,
    deleteSOP, copySOPToFolder, selectSOP, getFolderDepth,
  } = useSOPStore()
  const [showMoveMenu, setShowMoveMenu] = useState(false)
  const [subfolderInput, setSubfolderInput] = useState(false)
  const [subfolderName, setSubfolderName] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function outside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) onClose()
    }
    function escape(event: KeyboardEvent) {
      if (event.key === 'Escape') { event.preventDefault(); onClose() }
    }
    document.addEventListener('mousedown', outside)
    document.addEventListener('keydown', escape)
    return () => {
      document.removeEventListener('mousedown', outside)
      document.removeEventListener('keydown', escape)
    }
  }, [onClose])

  const adjustedX = Math.max(8, Math.min(x, window.innerWidth - 228))
  const adjustedY = Math.max(8, Math.min(y, window.innerHeight - 300))
  const menuStyle: React.CSSProperties = {
    position: 'fixed', left: adjustedX, top: adjustedY,
    background: 'var(--color-surface)', border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-md)', padding: '4px 0', width: 220,
    maxWidth: 'calc(100vw - 16px)', maxHeight: Math.max(80, window.innerHeight - adjustedY - 8),
    overflowY: 'auto', boxShadow: '0 4px 12px rgba(0,0,0,0.12)', zIndex: 300,
  }
  const itemStyle = (danger = false, disabled = false): React.CSSProperties => ({
    display: 'block', width: '100%', textAlign: 'left', padding: '6px 16px', fontSize: 13,
    background: 'transparent', border: 'none', overflowWrap: 'anywhere',
    color: danger ? 'var(--color-danger)' : disabled ? 'var(--color-text-dim)' : 'var(--color-text)',
    cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.5 : 1,
  })

  if (type === 'folder') {
    const folder = folders.find(item => item.id === target.id)
    if (!folder) return null
    const isEmpty = !sops.some(sop => sop.folderId === folder.id) && !folders.some(item => item.parentId === folder.id)
    const canCreateSubfolder = getFolderDepth(folder.id) < 2
    return <div ref={ref} data-sop-context-menu="folder" role="menu" style={menuStyle}>
      <button type="button" role="menuitem" style={itemStyle()} onClick={() => { onNewSOP(folder.id); onClose() }}>{t.sop_contextMenu_newSOP}</button>
      {!subfolderInput && <button type="button" role="menuitem" style={itemStyle(false, !canCreateSubfolder)} disabled={!canCreateSubfolder} onClick={() => setSubfolderInput(true)}>
        {t.sop_newSubfolder}{!canCreateSubfolder ? ` (${t.sop_maxDepth})` : ''}
      </button>}
      {subfolderInput && <div style={{ padding: '4px 12px' }}>
        <input autoFocus value={subfolderName} onChange={event => setSubfolderName(event.target.value)}
          onKeyDown={event => {
            if (event.nativeEvent.isComposing || event.keyCode === 229) return
            if (event.key === 'Enter' && subfolderName.trim()) {
              event.preventDefault(); addFolder(subfolderName.trim(), folder.id); onClose()
            }
          }} placeholder={t.sop_newSubfolder}
          style={{ width: '100%', height: 26, fontSize: 12, padding: '0 6px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-accent)', background: 'var(--color-bg)', color: 'var(--color-text)', outline: 'none', boxSizing: 'border-box' }} />
      </div>}
      <div style={{ height: 1, background: 'var(--color-border)', margin: '4px 0' }} />
      <button type="button" role="menuitem" style={itemStyle()} onClick={() => { onStartRename(folder.id, folder.name); onClose() }}>{t.sop_contextMenu_rename}</button>
      <button type="button" role="menuitem" style={itemStyle(true)} onClick={() => {
        if (isEmpty) { deleteFolder(folder.id); onClose() }
        else if (window.confirm(t.sop_confirmDeleteAll)) { deleteFolderRecursive(folder.id); onClose() }
      }}>{isEmpty ? t.sop_contextMenu_delete : t.sop_contextMenu_deleteAll}</button>
    </div>
  }

  const sop = sops.find(item => item.id === target.id)
  if (!sop) return null
  const templateSource = isSystemTemplateFolder(sop.folderId, folders)
  const destinations = folders.filter(folder => folder.id !== sop.folderId)
  if (showMoveMenu) return <div ref={ref} data-sop-context-menu="move" role="menu" style={menuStyle}>
    <div style={{ padding: '4px 12px', fontSize: 12, color: 'var(--color-text-dim)', fontWeight: 600 }}>{t.sop_contextMenu_moveTo}</div>
    {destinations.map(folder => <button key={folder.id} type="button" role="menuitem" data-sop-move-target={folder.id} style={itemStyle()} onClick={() => {
      const id = transferSOP(sop.id, folder.id, lang)
      if (id) selectSOP(id)
      onClose()
    }}>{'  '.repeat(getFolderDepth(folder.id))}📁 {folder.name}</button>)}
    <div style={{ height: 1, background: 'var(--color-border)', margin: '4px 0' }} />
    <button type="button" role="menuitem" style={itemStyle()} onClick={() => setShowMoveMenu(false)}>← {t.common_cancel}</button>
  </div>

  return <div ref={ref} data-sop-context-menu="sop" role="menu" style={menuStyle}>
    <button type="button" role="menuitem" style={itemStyle()} onClick={() => {
      if (onEditSOP) onEditSOP(sop.id)
      else selectSOP(sop.id)
      onClose()
    }}>{t.sop_contextMenu_edit}</button>
    {templateSource && <button type="button" role="menuitem" style={itemStyle()} onClick={() => {
      const userFolder = folders.find(folder => !isSystemTemplateFolder(folder.id, folders))
      const folderId = userFolder?.id ?? addFolder(t.sop_myFlows)
      const id = copySOPToFolder(sop.id, folderId, lang)
      if (id) selectSOP(id)
      onClose()
    }}>{t.sop_copyToMine}</button>}
    {!templateSource && destinations.length > 0 && <button type="button" role="menuitem" style={itemStyle()} onClick={() => setShowMoveMenu(true)}>{t.sop_contextMenu_moveTo}</button>}
    <div style={{ height: 1, background: 'var(--color-border)', margin: '4px 0' }} />
    <button type="button" role="menuitem" style={itemStyle(true)} onClick={() => { deleteSOP(sop.id); onClose() }}>{t.sop_contextMenu_delete}</button>
  </div>
}
