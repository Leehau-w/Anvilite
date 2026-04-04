import React, { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useSettingsStore } from '@/stores/settingsStore'
import { useCharacterStore } from '@/stores/characterStore'
import { useToast } from '@/components/feedback/Toast'
import { THEMES } from '@/types/settings'
import { useT } from '@/i18n'
import type { Translations } from '@/i18n/zh'
import { getAccounts, getCurrentAccountId, createAccount, switchAccount, deleteAccount } from '@/stores/accountManager'
import { exportData, importData } from '@/utils/dataExport'
import { getStorageUsage, formatBytes } from '@/utils/storageMonitor'

/** Map theme id → i18n key */
const THEME_NAME_KEY: Record<string, keyof Translations> = {
  'dawn-white':    'theme_name_dawn',
  'mint-paper':    'theme_name_mint',
  'parchment':     'theme_name_parchment',
  'slate-cloud':   'theme_name_slate',
  'forge-purple':  'theme_name_forge',
  'ore-cyan':      'theme_name_ore',
  'flame-cast':    'theme_name_flame',
  'jade-forest':   'theme_name_jade',
}

interface SettingsModalProps {
  open: boolean
  onClose: () => void
}

/** 各主题的矿石解锁价格（dawn-white 为 0 = 免费） */
const THEME_ORE_COST: Record<string, number> = {
  'dawn-white':    0,
  'mint-paper':   200,
  'parchment':    200,
  'slate-cloud':  200,
  'forge-purple': 500,
  'ore-cyan':     500,
  'flame-cast':   500,
  'jade-forest':  500,
}

const THEME_COLORS: Record<string, { bg: string; accent: string }> = {
  'dawn-white':    { bg: '#faf8f5', accent: '#e8600a' },
  'mint-paper':    { bg: '#f3faf6', accent: '#0d9462' },
  'parchment':     { bg: '#f8f2e8', accent: '#a13820' },
  'slate-cloud':   { bg: '#f4f5f7', accent: '#2563eb' },
  'forge-purple':  { bg: '#0c0a1a', accent: '#a78bfa' },
  'ore-cyan':      { bg: '#0a1218', accent: '#22d3ee' },
  'flame-cast':    { bg: '#111010', accent: '#f97316' },
  'jade-forest':   { bg: '#0a120e', accent: '#34d399' },
}

export function SettingsModal({ open, onClose }: SettingsModalProps) {
  const { settings, setTheme, setLanguage, unlockTheme } = useSettingsStore()
  const { character, setName, spendOre } = useCharacterStore()
  const { showToast } = useToast()
  const t = useT()
  const [nameInput, setNameInput] = useState(character.name)
  const [confirmTheme, setConfirmTheme] = useState<string | null>(null)

  // ── 数据导出/导入 ──
  const [importConfirm, setImportConfirm] = useState(false)
  const [pendingImportFile, setPendingImportFile] = useState<File | null>(null)
  const importInputRef = useRef<HTMLInputElement>(null)

  async function handleExport() {
    await exportData()
  }

  function handleImportSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setPendingImportFile(file)
    setImportConfirm(true)
    e.target.value = ''
  }

  async function handleImportConfirm() {
    if (!pendingImportFile) return
    const result = await importData(pendingImportFile)
    setImportConfirm(false)
    setPendingImportFile(null)
    if (!result.success) {
      const msg = result.error?.startsWith('version') ? t.data_importErrorVersion
        : result.error === 'parse_error' ? t.data_importErrorParse
        : t.data_importErrorFormat
      showToast(msg)
    }
    // success: page reloads automatically
  }

  // ── 账号管理 ──
  const accounts = getAccounts()
  const currentAccountId = getCurrentAccountId()
  const [showCreateAccount, setShowCreateAccount] = useState(false)
  const [newAccountName, setNewAccountName] = useState('')
  const [accountAction, setAccountAction] = useState<{ type: 'switch' | 'delete'; id: string; name: string } | null>(null)

  function handleCreateAccount() {
    if (!newAccountName.trim()) return
    const acc = createAccount(newAccountName.trim())
    showToast(t.account_toastCreated(acc.name))
    setNewAccountName('')
    setShowCreateAccount(false)
  }

  function handleConfirmAccountAction() {
    if (!accountAction) return
    if (accountAction.type === 'switch') {
      switchAccount(accountAction.id)
    } else {
      deleteAccount(accountAction.id)
      showToast(t.account_toastDeleted(accountAction.name))
      setAccountAction(null)
    }
  }

  function handleNameSave() {
    if (nameInput.trim()) setName(nameInput.trim())
  }

  function handleThemeClick(themeId: string) {
    if (settings.unlockedThemes.includes(themeId)) {
      setTheme(themeId)
      return
    }
    // 未解锁：弹出确认
    setConfirmTheme(themeId)
  }

  function handleBuyTheme(themeId: string) {
    const cost = THEME_ORE_COST[themeId] ?? 0
    if (cost === 0) {
      unlockTheme(themeId)
      setTheme(themeId)
      setConfirmTheme(null)
      return
    }
    const ok = spendOre(cost)
    if (!ok) {
      showToast(t.settings_toastNoOre(cost - character.ore))
      setConfirmTheme(null)
      return
    }
    unlockTheme(themeId)
    setTheme(themeId)
    setConfirmTheme(null)
    const nameKey = THEME_NAME_KEY[themeId]
    showToast(t.settings_toastUnlocked(nameKey ? (t[nameKey] as string) : themeId))
  }

  const confirmThemeInfo = confirmTheme ? THEMES.find((t) => t.id === confirmTheme) : null
  const confirmCost = confirmTheme ? (THEME_ORE_COST[confirmTheme] ?? 0) : 0
  const canAfford = character.ore >= confirmCost

  const [storageUsage, setStorageUsage] = useState(() => getStorageUsage())
  useEffect(() => {
    if (open) setStorageUsage(getStorageUsage())
  }, [open])

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0,0,0,0.3)',
              backdropFilter: 'blur(4px)',
              zIndex: 500,
            }}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            style={{
              position: 'fixed',
              top: '50%',
              left: '50%',
              x: '-50%',
              y: '-50%',
              width: 440,
              maxHeight: '80vh',
              background: 'var(--color-surface)',
              borderRadius: 'var(--radius-xl)',
              border: '1px solid var(--color-border)',
              boxShadow: 'var(--shadow-lg)',
              zIndex: 501,
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            {/* 标题栏 */}
            <div
              style={{
                height: 52,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0 20px',
                borderBottom: '1px solid var(--color-border)',
                flexShrink: 0,
              }}
            >
              <span style={{ fontSize: 16, fontWeight: 600 }}>{t.settings_title}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                {/* 矿石余额 */}
                <span style={{ fontSize: 12, color: 'var(--color-text-dim)', fontFamily: 'var(--font-num)' }}>
                  ⛏ {character.ore.toLocaleString()}
                </span>
                <button
                  onClick={onClose}
                  style={{
                    width: 28, height: 28, borderRadius: 'var(--radius-md)',
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: 'var(--color-text-dim)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
            </div>

            <div style={{ overflowY: 'auto', flex: 1, padding: 20, display: 'flex', flexDirection: 'column', gap: 24 }}>
              {/* 账号管理 */}
              <section>
                <SectionTitle>{t.account_section}</SectionTitle>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {accounts.map((acc) => {
                    const isCurrent = acc.id === currentAccountId
                    return (
                      <div
                        key={acc.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '8px 12px',
                          borderRadius: 'var(--radius-md)',
                          border: `1px solid ${isCurrent ? 'var(--color-accent)' : 'var(--color-border)'}`,
                          background: isCurrent ? 'color-mix(in srgb, var(--color-accent) 6%, transparent)' : 'transparent',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ width: 6, height: 6, borderRadius: '50%', background: isCurrent ? 'var(--color-success)' : 'var(--color-border)' }} />
                          <span style={{ fontSize: 13, fontWeight: isCurrent ? 600 : 400, color: 'var(--color-text)' }}>{acc.name}</span>
                          {isCurrent && (
                            <span style={{ fontSize: 10, color: 'var(--color-accent)', background: 'color-mix(in srgb, var(--color-accent) 12%, transparent)', padding: '1px 6px', borderRadius: 'var(--radius-full)' }}>
                              {t.account_current}
                            </span>
                          )}
                        </div>
                        {!isCurrent && (
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button
                              onClick={() => setAccountAction({ type: 'switch', id: acc.id, name: acc.name })}
                              style={{ fontSize: 11, color: 'var(--color-accent)', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 6px' }}
                            >
                              {t.account_switch}
                            </button>
                            <button
                              onClick={() => setAccountAction({ type: 'delete', id: acc.id, name: acc.name })}
                              style={{ fontSize: 11, color: 'var(--color-danger, #dc2626)', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 6px' }}
                            >
                              {t.account_delete}
                            </button>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
                {/* 创建新账号 */}
                {showCreateAccount ? (
                  <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                    <input
                      autoFocus
                      value={newAccountName}
                      onChange={(e) => setNewAccountName(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleCreateAccount(); if (e.key === 'Escape') setShowCreateAccount(false) }}
                      placeholder={t.account_namePlaceholder}
                      maxLength={20}
                      style={{
                        flex: 1, height: 32, padding: '0 10px',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--color-border)',
                        background: 'var(--color-bg)',
                        color: 'var(--color-text)',
                        fontSize: 13, outline: 'none',
                      }}
                    />
                    <button
                      onClick={handleCreateAccount}
                      disabled={!newAccountName.trim()}
                      style={{
                        height: 32, padding: '0 14px',
                        borderRadius: 'var(--radius-md)',
                        border: 'none',
                        background: newAccountName.trim() ? 'var(--color-accent)' : 'var(--color-border)',
                        color: newAccountName.trim() ? 'white' : 'var(--color-text-dim)',
                        fontSize: 12, fontWeight: 600, cursor: newAccountName.trim() ? 'pointer' : 'default',
                      }}
                    >
                      {t.account_createBtn}
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowCreateAccount(true)}
                    style={{
                      marginTop: 8, width: '100%', height: 32,
                      borderRadius: 'var(--radius-md)',
                      border: '1px dashed var(--color-border)',
                      background: 'transparent',
                      color: 'var(--color-text-dim)',
                      fontSize: 12, cursor: 'pointer',
                    }}
                  >
                    {t.account_create}
                  </button>
                )}
              </section>

              {/* 角色名 */}
              <section>
                <SectionTitle>{t.settings_char}</SectionTitle>
                <input
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  onBlur={handleNameSave}
                  onKeyDown={(e) => e.key === 'Enter' && handleNameSave()}
                  placeholder={t.settings_charName}
                  style={{
                    width: '100%', height: 36, padding: '0 12px',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--color-border)',
                    background: 'var(--color-bg)',
                    color: 'var(--color-text)',
                    fontSize: 14, outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </section>

              {/* 主题 */}
              <section>
                <SectionTitle>{t.settings_theme}</SectionTitle>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {(['light', 'dark'] as const).map((mode) => (
                    <div key={mode}>
                      <p style={{ fontSize: 11, color: 'var(--color-text-dim)', marginBottom: 8 }}>
                        {mode === 'light' ? t.settings_light : t.settings_dark}
                      </p>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                        {THEMES.filter((th) => th.dark === (mode === 'dark')).map((theme) => {
                          const isUnlocked = settings.unlockedThemes.includes(theme.id)
                          const cost = THEME_ORE_COST[theme.id] ?? 0
                          const nameKey = THEME_NAME_KEY[theme.id]
                          const displayName = nameKey ? (t[nameKey] as string) : theme.name
                          return (
                            <ThemeButton
                              key={theme.id}
                              theme={{ id: theme.id, name: displayName }}
                              isActive={settings.theme === theme.id}
                              isUnlocked={isUnlocked}
                              cost={cost}
                              onClick={() => handleThemeClick(theme.id)}
                            />
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              {/* 语言 */}
              <section>
                <SectionTitle>{t.settings_language}</SectionTitle>
                <div style={{ display: 'flex', gap: 8 }}>
                  {(['zh', 'en'] as const).map((lang) => (
                    <button
                      key={lang}
                      onClick={() => setLanguage(lang)}
                      style={{
                        padding: '6px 16px',
                        borderRadius: 'var(--radius-md)',
                        border: `1px solid ${settings.language === lang ? 'var(--color-accent)' : 'var(--color-border)'}`,
                        background: settings.language === lang ? 'color-mix(in srgb, var(--color-accent) 12%, transparent)' : 'transparent',
                        color: settings.language === lang ? 'var(--color-accent)' : 'var(--color-text-dim)',
                        cursor: 'pointer',
                        fontSize: 13,
                      }}
                    >
                      {lang === 'zh' ? '中文' : 'English'}
                    </button>
                  ))}
                </div>
              </section>

              {/* 数据管理 */}
              <section>
                <SectionTitle>{t.data_section}</SectionTitle>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={handleExport}
                    style={{ flex: 1, padding: '8px 0', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', background: 'transparent', color: 'var(--color-text)', fontSize: 13, cursor: 'pointer', transition: 'border-color 0.15s' }}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--color-accent)' }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--color-border)' }}
                  >
                    📤 {t.data_export}
                  </button>
                  <button
                    onClick={() => importInputRef.current?.click()}
                    style={{ flex: 1, padding: '8px 0', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', background: 'transparent', color: 'var(--color-text)', fontSize: 13, cursor: 'pointer', transition: 'border-color 0.15s' }}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--color-accent)' }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--color-border)' }}
                  >
                    📥 {t.data_import}
                  </button>
                  <input ref={importInputRef} type="file" accept=".json" style={{ display: 'none' }} onChange={handleImportSelect} />
                </div>
              </section>

              {/* 存储用量 */}
              <section>
                <SectionTitle>{t.settings_storage}</SectionTitle>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={{ height: 6, borderRadius: 'var(--radius-full)', background: 'var(--color-border)', overflow: 'hidden' }}>
                    <div
                      style={{
                        height: '100%',
                        width: `${Math.min(storageUsage.usageRatio * 100, 100)}%`,
                        borderRadius: 'var(--radius-full)',
                        background: storageUsage.isWarning ? 'var(--color-danger)' : 'var(--color-accent)',
                        transition: 'width 0.3s ease',
                      }}
                    />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--color-text-dim)' }}>
                    <span>{t.storage_used}: {formatBytes(storageUsage.usedBytes)}</span>
                    <span>{t.storage_total}: {formatBytes(storageUsage.totalBytes)}</span>
                  </div>
                </div>
              </section>
            </div>
          </motion.div>

          {/* 导入确认弹窗 */}
          <AnimatePresence>
            {importConfirm && (
              <motion.div
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                style={{ position: 'fixed', inset: 0, zIndex: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                onClick={() => { setImportConfirm(false); setPendingImportFile(null) }}
              >
                <motion.div
                  initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
                  onClick={(e) => e.stopPropagation()}
                  style={{ width: 320, background: 'var(--color-surface)', borderRadius: 'var(--radius-xl)', border: '1px solid var(--color-border)', padding: 20, boxShadow: '0 8px 32px rgba(0,0,0,0.15)' }}
                >
                  <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 10 }}>⚠️ {t.data_importConfirmTitle}</div>
                  <p style={{ fontSize: 13, color: 'var(--color-text-dim)', marginBottom: 16, lineHeight: 1.6 }}>{t.data_importConfirmMsg}</p>
                  <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                    <button onClick={() => { setImportConfirm(false); setPendingImportFile(null) }} style={{ padding: '6px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)', background: 'transparent', color: 'var(--color-text-dim)', cursor: 'pointer', fontSize: 13 }}>{t.data_importCancel}</button>
                    <button onClick={handleImportConfirm} style={{ padding: '6px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-danger)', background: 'color-mix(in srgb, var(--color-danger) 12%, transparent)', color: 'var(--color-danger)', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>{t.data_importConfirm}</button>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* 账号操作确认弹窗 */}
          <AnimatePresence>
            {accountAction && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                style={{
                  position: 'fixed', inset: 0, zIndex: 600,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
                onClick={() => setAccountAction(null)}
              >
                <motion.div
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.9, opacity: 0 }}
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    width: 320,
                    background: 'var(--color-surface)',
                    borderRadius: 'var(--radius-xl)',
                    border: '1px solid var(--color-border)',
                    padding: 20,
                    boxShadow: '0 8px 32px rgba(0,0,0,0.25)',
                    textAlign: 'center',
                  }}
                >
                  <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-text)', marginBottom: 8 }}>
                    {accountAction.type === 'switch' ? t.account_confirmSwitchTitle : t.account_confirmDeleteTitle}
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--color-text-dim)', lineHeight: 1.6, marginBottom: 16 }}>
                    {accountAction.type === 'switch'
                      ? t.account_confirmSwitchMsg(accountAction.name)
                      : t.account_confirmDeleteMsg(accountAction.name)}
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      onClick={() => setAccountAction(null)}
                      style={{
                        flex: 1, height: 34, borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--color-border)', background: 'transparent',
                        color: 'var(--color-text-dim)', fontSize: 13, cursor: 'pointer',
                      }}
                    >
                      {t.account_cancel}
                    </button>
                    <button
                      onClick={handleConfirmAccountAction}
                      style={{
                        flex: 2, height: 34, borderRadius: 'var(--radius-md)',
                        border: 'none',
                        background: accountAction.type === 'delete' ? 'var(--color-danger, #dc2626)' : 'var(--color-accent)',
                        color: 'white', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                      }}
                    >
                      {t.account_confirm}
                    </button>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* 购买主题确认弹窗 */}
          <AnimatePresence>
            {confirmTheme && confirmThemeInfo && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                style={{
                  position: 'fixed', inset: 0, zIndex: 600,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
                onClick={() => setConfirmTheme(null)}
              >
                <motion.div
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.9, opacity: 0 }}
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    width: 300,
                    background: 'var(--color-surface)',
                    borderRadius: 'var(--radius-xl)',
                    border: '1px solid var(--color-border)',
                    padding: 20,
                    boxShadow: '0 8px 32px rgba(0,0,0,0.25)',
                  }}
                >
                  {/* 主题预览色块 */}
                  <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
                    <div
                      style={{
                        width: 64,
                        height: 40,
                        borderRadius: 'var(--radius-md)',
                        background: THEME_COLORS[confirmTheme]?.bg ?? '#fff',
                        border: '1px solid rgba(0,0,0,0.12)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <div
                        style={{
                          width: 22,
                          height: 10,
                          borderRadius: 5,
                          background: THEME_COLORS[confirmTheme]?.accent ?? '#666',
                        }}
                      />
                    </div>
                  </div>

                  <div style={{ textAlign: 'center', marginBottom: 16 }}>
                    <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-text)', marginBottom: 4 }}>
                      {t.settings_unlockTitle((THEME_NAME_KEY[confirmTheme] ? (t[THEME_NAME_KEY[confirmTheme]] as string) : confirmThemeInfo.name))}
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--color-text-dim)' }}>
                      {t.settings_unlockCost(confirmCost)}
                    </div>
                    {!canAfford && (
                      <div style={{ fontSize: 11, color: '#dc2626', marginTop: 4 }}>
                        {t.settings_insufficientOre(character.ore)}
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      onClick={() => setConfirmTheme(null)}
                      style={{
                        flex: 1, height: 34, borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--color-border)', background: 'transparent',
                        color: 'var(--color-text-dim)', fontSize: 13, cursor: 'pointer',
                      }}
                    >
                      {t.settings_cancel}
                    </button>
                    <button
                      onClick={() => handleBuyTheme(confirmTheme)}
                      disabled={!canAfford}
                      style={{
                        flex: 2, height: 34, borderRadius: 'var(--radius-md)',
                        border: 'none',
                        background: canAfford ? 'var(--color-accent)' : 'var(--color-border)',
                        color: canAfford ? 'white' : 'var(--color-text-dim)',
                        fontSize: 13, fontWeight: 600,
                        cursor: canAfford ? 'pointer' : 'not-allowed',
                      }}
                    >
                      {t.settings_confirmBuy(confirmCost)}
                    </button>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}
    </AnimatePresence>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <p style={{
      fontSize: 12, fontWeight: 600, color: 'var(--color-text-dim)',
      marginBottom: 10, letterSpacing: '0.04em', textTransform: 'uppercase',
    }}>
      {children}
    </p>
  )
}

function ThemeButton({
  theme,
  isActive,
  isUnlocked,
  cost,
  onClick,
}: {
  theme: { id: string; name: string }
  isActive: boolean
  isUnlocked: boolean
  cost: number
  onClick: () => void
}) {
  const colors = THEME_COLORS[theme.id] ?? { bg: '#fff', accent: '#666' }
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 4,
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        padding: 4,
        position: 'relative',
      }}
    >
      <div
        style={{
          width: 52,
          height: 34,
          borderRadius: 'var(--radius-md)',
          background: colors.bg,
          border: `2px solid ${isActive ? colors.accent : isUnlocked ? 'rgba(0,0,0,0.12)' : 'transparent'}`,
          boxShadow: isActive ? `0 0 0 2px ${colors.accent}40` : 'inset 0 0 0 1px rgba(0,0,0,0.1)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          opacity: isUnlocked ? 1 : 0.55,
          transition: 'all 0.15s',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: 18,
            height: 9,
            borderRadius: 4,
            background: colors.accent,
          }}
        />
        {/* 未解锁蒙层 */}
        {!isUnlocked && (
          <div
            style={{
              position: 'absolute', inset: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'rgba(0,0,0,0.15)',
              fontSize: 12,
            }}
          >
            🔒
          </div>
        )}
      </div>
      <span style={{ fontSize: 11, color: 'var(--color-text-dim)', whiteSpace: 'nowrap' }}>
        {theme.name}
      </span>
      {/* 价格标签 */}
      {!isUnlocked && cost > 0 && (
        <span style={{
          fontSize: 9,
          color: 'var(--color-secondary)',
          fontFamily: 'var(--font-num)',
          lineHeight: 1,
        }}>
          {cost} ⛏
        </span>
      )}
      {isUnlocked && cost > 0 && (
        <span style={{ fontSize: 9, color: 'var(--color-success)', lineHeight: 1 }}>✓</span>
      )}
    </button>
  )
}
