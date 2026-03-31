import type { Account } from '@/types/account'

const ACCOUNTS_KEY = 'anvilite-accounts'
const CURRENT_KEY = 'anvilite-current-account'
const DEFAULT_ID = 'default'

// ── 读取 ─────────────────────────────────────────────────────────────────────

function readDefaultName(): string {
  try {
    const raw = localStorage.getItem('anvilite-character')
    if (!raw) return '旅行者'
    const data = JSON.parse(raw)
    return data?.state?.character?.name || '旅行者'
  } catch {
    return '旅行者'
  }
}

export function getAccounts(): Account[] {
  try {
    const raw = localStorage.getItem(ACCOUNTS_KEY)
    if (raw) return JSON.parse(raw) as Account[]
  } catch { /* ignore */ }
  // 首次：自动创建默认账号
  const defaultAccount: Account = { id: DEFAULT_ID, name: readDefaultName(), createdAt: new Date().toISOString() }
  localStorage.setItem(ACCOUNTS_KEY, JSON.stringify([defaultAccount]))
  return [defaultAccount]
}

export function getCurrentAccountId(): string {
  return localStorage.getItem(CURRENT_KEY) ?? DEFAULT_ID
}

/** 获取当前账号的 localStorage key 前缀 */
export function getStoragePrefix(): string {
  const id = getCurrentAccountId()
  return id === DEFAULT_ID ? 'anvilite' : `anvilite-${id}`
}

// ── 写入 ─────────────────────────────────────────────────────────────────────

function saveAccounts(accounts: Account[]) {
  localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts))
}

export function createAccount(name: string): Account {
  const account: Account = {
    id: crypto.randomUUID(),
    name: name.trim() || '新账号',
    createdAt: new Date().toISOString(),
  }
  const accounts = getAccounts()
  accounts.push(account)
  saveAccounts(accounts)
  return account
}

export function renameAccount(id: string, name: string) {
  const accounts = getAccounts()
  const account = accounts.find((a) => a.id === id)
  if (account) {
    account.name = name
    saveAccounts(accounts)
  }
}

export function switchAccount(id: string) {
  localStorage.setItem(CURRENT_KEY, id)
  window.location.reload()
}

export function deleteAccount(id: string) {
  const currentId = getCurrentAccountId()
  if (id === currentId) return false // 不能删当前账号
  const accounts = getAccounts()
  if (accounts.length <= 1) return false // 至少保留一个账号

  // 清除该账号的所有 localStorage 数据
  const keysToRemove: string[] = []
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (!key || !key.startsWith('anvilite-')) continue
    // 跳过全局 key
    if (key === ACCOUNTS_KEY || key === CURRENT_KEY) continue
    if (id === DEFAULT_ID) {
      // 默认账号 key 格式：anvilite-character, anvilite-areas 等
      // 其他账号 key 格式：anvilite-{8位hex}...-character 等
      const rest = key.slice('anvilite-'.length)
      if (/^[a-f0-9]{8}-/.test(rest)) continue // 属于其他账号，跳过
      keysToRemove.push(key)
    } else {
      // 非默认账号 key 格式：anvilite-{uuid}-xxx
      if (key.startsWith(`anvilite-${id}-`)) keysToRemove.push(key)
    }
  }
  keysToRemove.forEach((key) => localStorage.removeItem(key))

  // 从列表中移除
  saveAccounts(accounts.filter((a) => a.id !== id))
  return true
}
