import { useEffect, useState } from 'react'
import { useT } from '@/i18n'
import { configureMcp } from '@/mcp/rendererBootstrap'
import { READ_MCP_PERMISSIONS, type McpConfiguration, type McpDomain, type McpStatus } from '@/mcp/contracts'

export function McpSettingsPanel() {
  const t = useT()
  const [status, setStatus] = useState<McpStatus | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const available = !!window.electronAPI?.mcpGetStatus
  useEffect(() => {
    let active = true
    const api = window.electronAPI
    if (!api?.mcpGetStatus) return
    void api.mcpGetStatus().then(next => { if (active) setStatus(next) }).catch(() => { if (active) setMessage(t.mcp_failed) })
    const off = api.onMcpStatus?.(next => { if (active) { setStatus(next); setMessage('') } })
    return () => { active = false; off?.() }
  }, [t.mcp_failed])
  async function change(configuration: McpConfiguration) {
    setBusy(true); setMessage('')
    try { setStatus(await configureMcp(configuration)) } catch { setMessage(t.mcp_failed) } finally { setBusy(false) }
  }
  function toggle(enabled: boolean) {
    const permissions = status?.permissions ?? structuredClone(READ_MCP_PERMISSIONS)
    const hasRead = Object.values(permissions).some(access => access.read)
    void change({ enabled, permissions: enabled && !hasRead ? structuredClone(READ_MCP_PERMISSIONS) : permissions })
  }
  function access(domain: McpDomain, key: 'read' | 'write', checked: boolean) {
    if (!status) return
    const permissions = structuredClone(status.permissions)
    permissions[domain][key] = checked
    if (key === 'read' && !checked) permissions[domain].write = false
    if (key === 'write' && checked) permissions[domain].read = true
    void change({ enabled: status.enabled, permissions })
  }
  async function copy() {
    setBusy(true); setMessage('')
    try {
      const next = await window.electronAPI!.mcpGetStatus!()
      if (!next.enabled || !next.clientConfig) throw new Error('unavailable')
      await navigator.clipboard.writeText(JSON.stringify({ mcpServers: { anvilite: next.clientConfig } }, null, 2))
      setMessage(t.mcp_copied)
    } catch { setMessage(t.mcp_copyFailed) } finally { setBusy(false) }
  }
  return <section data-mcp-settings style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
    <h3 style={{ margin: 0, fontSize: 11, fontWeight: 700, color: 'var(--color-text-dim)' }}>{t.mcp_title}</h3>
    {!available ? <p style={{ margin: 0, fontSize: 12, color: 'var(--color-text-dim)' }}>{t.mcp_desktopOnly}</p> : <>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
        <input type="checkbox" data-mcp-enabled checked={status?.enabled ?? false} disabled={busy || !status?.ready}
          onChange={event => toggle(event.target.checked)} />{t.mcp_enable}
      </label>
      <p style={{ margin: 0, fontSize: 12, lineHeight: 1.6, color: 'var(--color-text-dim)' }}>{t.mcp_sessionHint}</p>
      <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
        <thead><tr><th style={{ textAlign: 'left', padding: '4px 0' }}>{t.mcp_scope}</th><th>{t.mcp_read}</th><th>{t.mcp_write}</th></tr></thead>
        <tbody>{(['tasks','habits','flows'] as const).map(domain => <tr key={domain}>
          <td style={{ padding: '7px 0' }}>{domain === 'tasks' ? t.dash_tasks : domain === 'habits' ? t.dash_habits : t.sidebar_sop}</td>
          {(['read','write'] as const).map(key => <td key={key} style={{ textAlign: 'center' }}><input type="checkbox" data-mcp-permission={domain + ':' + key}
            aria-label={(domain === 'tasks' ? t.dash_tasks : domain === 'habits' ? t.dash_habits : t.sidebar_sop) + ' ' + (key === 'read' ? t.mcp_read : t.mcp_write)}
            checked={status?.permissions[domain][key] ?? false} disabled={busy || !status?.enabled}
            onChange={event => access(domain, key, event.target.checked)} /></td>)}
        </tr>)}</tbody>
      </table>
      <button type="button" data-mcp-copy disabled={busy || !status?.enabled || !status.clientConfig} onClick={() => void copy()}
        style={{ padding: '8px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)',
          background: 'var(--color-bg)', color: 'var(--color-text)', cursor: 'pointer', fontSize: 12 }}>{t.mcp_copyConfig}</button>
      <p style={{ margin: 0, fontSize: 11, lineHeight: 1.5, color: 'var(--color-text-dim)' }}>{t.mcp_configHint}</p>
    </>}
    {message && <div role="status" style={{ fontSize: 12, color: 'var(--color-text-dim)' }}>{message}</div>}
  </section>
}
