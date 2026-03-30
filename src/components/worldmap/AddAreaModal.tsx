import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { AreaTemplateId } from '@/types/area'
import { AREA_TEMPLATES } from '@/types/area'
import { useT } from '@/i18n'

const ADDABLE_TEMPLATES: AreaTemplateId[] = [
  'home', 'arena', 'library', 'workshop', 'forge',
  'spring', 'council', 'expedition', 'observatory', 'garden', 'plaza',
]

interface AddAreaModalProps {
  usedTemplateIds: AreaTemplateId[]
  areaCount: number
  onAdd: (templateId: AreaTemplateId | null, customName?: string) => void
  onClose: () => void
}

export function AddAreaModal({ usedTemplateIds, areaCount, onAdd, onClose }: AddAreaModalProps) {
  const t = useT()
  const [customName, setCustomName] = useState('')
  const [showCustom, setShowCustom] = useState(false)

  const atLimit = areaCount >= 12

  function handleSelectTemplate(id: AreaTemplateId) {
    if (atLimit) return
    onAdd(id)
    onClose()
  }

  function handleAddCustom() {
    if (!customName.trim() || atLimit) return
    onAdd(null, customName.trim())
    onClose()
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 50,
        background: 'rgba(0,0,0,0.4)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.92, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.92, y: 10 }}
        transition={{ duration: 0.2 }}
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 420,
          background: 'var(--color-surface)',
          borderRadius: 'var(--radius-xl)',
          border: '1px solid var(--color-border)',
          overflow: 'hidden',
          boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
        }}
      >
        {/* 标题栏 */}
        <div
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '16px 20px',
            borderBottom: '1px solid var(--color-border)',
          }}
        >
          <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-text)' }}>{t.addArea_title}</span>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', fontSize: 18, color: 'var(--color-text-dim)', cursor: 'pointer', lineHeight: 1 }}
          >
            ×
          </button>
        </div>

        {/* 内容 */}
        <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {atLimit ? (
            <p style={{ fontSize: 13, color: 'var(--color-danger)', textAlign: 'center', margin: 0 }}>
              {t.addArea_limitReached}
            </p>
          ) : (
            <>
              {/* 模板网格 */}
              <div>
                <p style={{ fontSize: 12, color: 'var(--color-text-dim)', margin: '0 0 10px 0' }}>
                  {t.addArea_selectTemplate}
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                  {ADDABLE_TEMPLATES.map((id) => {
                    const tpl = AREA_TEMPLATES[id]
                    return (
                      <button
                        key={id}
                        onClick={() => handleSelectTemplate(id)}
                        disabled={atLimit}
                        style={{
                          display: 'flex', flexDirection: 'column', alignItems: 'center',
                          gap: 4, padding: '10px 8px',
                          borderRadius: 'var(--radius-md)',
                          border: '1px solid var(--color-border)',
                          background: 'transparent',
                          opacity: atLimit ? 0.45 : 1,
                          cursor: atLimit ? 'not-allowed' : 'pointer',
                          transition: 'all 0.15s',
                        }}
                        onMouseEnter={(e) => {
                          if (!atLimit) (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--color-accent)'
                        }}
                        onMouseLeave={(e) => {
                          if (!atLimit) (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--color-border)'
                        }}
                      >
                        <span style={{ fontSize: 24 }}>{tpl.prosperityEmojis[0]}</span>
                        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text)' }}>{(t[`areaName_${id}` as keyof typeof t] as string) ?? tpl.name}</span>
                        <span style={{ fontSize: 10, color: 'var(--color-text-dim)', textAlign: 'center' }}>{(t[`areaDesc_${id}` as keyof typeof t] as string) ?? tpl.description}</span>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* 分隔线 */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ flex: 1, height: 1, background: 'var(--color-border)' }} />
                <span style={{ fontSize: 11, color: 'var(--color-text-dim)' }}>{t.addArea_or}</span>
                <div style={{ flex: 1, height: 1, background: 'var(--color-border)' }} />
              </div>

              {/* 空白区域 */}
              {!showCustom ? (
                <button
                  onClick={() => setShowCustom(true)}
                  style={{
                    padding: '10px', borderRadius: 'var(--radius-md)',
                    border: '1px dashed var(--color-border)',
                    background: 'transparent', color: 'var(--color-text-dim)',
                    cursor: 'pointer', fontSize: 13, transition: 'all 0.15s',
                  }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--color-accent)'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--color-accent)' }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--color-border)'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--color-text-dim)' }}
                >
                  {t.addArea_createBlank}
                </button>
              ) : (
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    autoFocus
                    value={customName}
                    onChange={(e) => setCustomName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleAddCustom(); if (e.key === 'Escape') setShowCustom(false) }}
                    placeholder={t.addArea_namePlaceholder}
                    style={{
                      flex: 1, height: 36, padding: '0 12px',
                      borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)',
                      background: 'var(--color-bg)', color: 'var(--color-text)',
                      fontSize: 13, outline: 'none',
                    }}
                  />
                  <button
                    onClick={handleAddCustom}
                    disabled={!customName.trim()}
                    style={{
                      padding: '0 16px', height: 36, borderRadius: 'var(--radius-md)',
                      background: 'var(--color-accent)', border: 'none', color: 'white',
                      fontSize: 13, fontWeight: 600, cursor: customName.trim() ? 'pointer' : 'not-allowed',
                      opacity: customName.trim() ? 1 : 0.5,
                    }}
                  >
                    {t.addArea_create}
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        {/* 底部统计 */}
        <div
          style={{
            padding: '10px 20px', background: 'var(--color-surface-hover)',
            borderTop: '1px solid var(--color-border)',
            fontSize: 11, color: 'var(--color-text-dim)', textAlign: 'center',
          }}
        >
          {t.addArea_usage(areaCount)}
        </div>
      </motion.div>
    </div>
  )
}
