import { createMcpService } from './service'
import { mcpFailure, type McpConfiguration, type McpDispatch, type McpRendererApi, type McpStatus } from './contracts'
import { getBoundAccountId, getStoragePrefix, isAccountBindingCurrent } from '@/stores/accountManager'
import { useTaskStore } from '@/stores/taskStore'
import { useHabitStore } from '@/stores/habitStore'
import { useSOPStore } from '@/stores/sopStore'
import { useAreaStore } from '@/stores/areaStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { useGrowthEventStore } from '@/stores/growthEventStore'
import { useCharacterStore } from '@/stores/characterStore'

let status: McpStatus | null = null
let suspended = false
let documentInvalidated = false
let started = false

export async function configureMcp(configuration: McpConfiguration): Promise<McpStatus> {
  const api = window.electronAPI
  if (documentInvalidated) throw new Error('reload_required')
  if (!api?.mcpConfigure) throw new Error('desktop_required')
  // Block commands already queued in this renderer as soon as the user changes access.
  suspended = true
  try {
    const next = await api.mcpConfigure(configuration)
    status = next
    suspended = false
    return next
  } catch (error) {
    // An uncertain permission change stays closed until a successful configuration.
    throw error
  }
}

type Hydratable = { persist: { hasHydrated: () => boolean; onFinishHydration: (callback: () => void) => () => void } }
async function hydrated(store: Hydratable) {
  if (store.persist.hasHydrated()) return
  await new Promise<void>((resolve, reject) => {
    const off = store.persist.onFinishHydration(() => { clearTimeout(timer); off(); resolve() })
    const timer = setTimeout(() => { off(); reject(new Error('hydration_failed')) }, 10000)
    if (store.persist.hasHydrated()) { clearTimeout(timer); off(); resolve() }
  })
}

/** Install exactly once per loaded document, outside React StrictMode effects. */
export async function startMcpRendererBridge(): Promise<(() => void) | undefined> {
  const candidate = window.electronAPI
  if (started || !candidate?.mcpReady || !candidate.onMcpRequest || !candidate.onMcpStatus || !candidate.mcpValidate || !candidate.mcpRespond) return
  started = true
  const api = candidate as McpRendererApi
  let disposed = false
  let service: ReturnType<typeof createMcpService> | null = null
  let serviceSession: string | null = null
  function accept(next: McpStatus) {
    status = next
    if (!next.sessionId || serviceSession !== next.sessionId) {
      service = null
      serviceSession = next.sessionId
    }
    if (!disposed && next.ready && next.sessionId && next.accountId === getBoundAccountId() && !service) {
      const session = next.sessionId
      service = createMcpService({ accountId: next.accountId, sessionId: session,
        getPermissions: () => status?.permissions ?? next.permissions,
        isCurrent: () => !disposed && !documentInvalidated && !suspended && !!status?.enabled && status.ready && status.sessionId === session &&
          status.accountId === getBoundAccountId() && isAccountBindingCurrent(),
      })
    }
  }
  const offStatus = api.onMcpStatus(accept)
  const offRequest = api.onMcpRequest((dispatch: McpDispatch) => {
    void (async () => {
      const currentService = service
      if (!currentService || disposed || documentInvalidated || suspended || !status?.enabled || dispatch.sessionId !== status.sessionId ||
        dispatch.accountId !== getBoundAccountId() || !isAccountBindingCurrent()) {
        api.mcpRespond({ bridgeId: dispatch.bridgeId, sessionId: dispatch.sessionId, result: mcpFailure('session_expired', 'Reconnect to the current account.') })
        return
      }
      const result = await currentService.handle(dispatch.request, {
        authorize: () => api.mcpValidate({ bridgeId: dispatch.bridgeId, sessionId: dispatch.sessionId }),
      })
      api.mcpRespond({ bridgeId: dispatch.bridgeId, sessionId: dispatch.sessionId, result })
    })().catch(() => {
      api.mcpRespond({ bridgeId: dispatch.bridgeId, sessionId: dispatch.sessionId,
        result: mcpFailure('unknown_outcome', 'Read operations_get with the same requestId before retrying.') })
    })
  })
  const suspend = () => { documentInvalidated = true; suspended = true }
  const onStorage = (event: StorageEvent) => {
    const prefix = getStoragePrefix() + '-'
    if (event.key === null || event.key === 'anvilite-current-account' ||
      ['tasks','habits','sops','growth-events','character','areas','settings','mcp-receipts'].some(slice => event.key === prefix + slice)) suspend()
  }
  function dispose() { disposed = true; suspended = true; status = null; offStatus(); offRequest(); window.removeEventListener('pagehide', dispose); window.removeEventListener('beforeunload', suspend); window.removeEventListener('storage', onStorage) }
  window.addEventListener('pagehide', dispose, { once: true })
  window.addEventListener('beforeunload', suspend)
  window.addEventListener('storage', onStorage)
  try {
    await Promise.all([useTaskStore, useHabitStore, useSOPStore, useAreaStore, useSettingsStore, useGrowthEventStore, useCharacterStore].map(store => hydrated(store)))
    if (!disposed && isAccountBindingCurrent()) accept(await api.mcpReady({ accountId: getBoundAccountId() }))
  } catch { dispose() }
  return dispose
}
