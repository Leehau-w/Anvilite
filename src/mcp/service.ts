import { useTaskStore } from '@/stores/taskStore'
import { useHabitStore } from '@/stores/habitStore'
import { useSOPStore } from '@/stores/sopStore'
import { useGrowthEventStore } from '@/stores/growthEventStore'
import { useCharacterStore } from '@/stores/characterStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { useAreaStore } from '@/stores/areaStore'
import { getBoundAccountId, getStoragePrefix, isAccountBindingCurrent } from '@/stores/accountManager'
import { getTodayString, isSameLocalDate } from '@/utils/time'
import { resolveSOPLibrary } from '@/utils/sopLibrary'
import { refreshHabitCycle } from '@/utils/habitCycle'
import { isHabitDueToday } from '@/engines/habitEngine'
import type { Task } from '@/types/task'
import type { Habit } from '@/types/habit'
import type { SOP } from '@/types/sop'
import { MCP_TOOLS, mcpFailure, mcpToolAccess } from './contracts'
import type { McpDomain, McpPermissions, McpRequest, McpResult } from './contracts'
import { canonicalJSON, versionOf } from './version'
import { McpError, object, keys, id, text, number, oneOf, invalid, taskFields, habitFields, habitDefaults, flowFields } from './validation'

export interface McpServiceOptions {
  accountId: string
  sessionId: string
  getPermissions: () => McpPermissions
  isCurrent: () => boolean
  storage?: Pick<Storage, 'getItem' | 'setItem'>
}
export interface McpCallContext { authorize?: () => Promise<boolean> }
interface Receipt {
  requestId: string; fingerprint: string; method: string; domain: McpDomain
  status: 'pending' | 'committed'; createdAt: string; result?: McpResult
}
interface Journal { version: 1; accountId: string; receipts: Receipt[] }
type RecordType = Task | Habit | SOP
// All sessions in this renderer share one queue. No business mutation crosses an await.
let writeQueue: Promise<unknown> = Promise.resolve()
const suspendedSessions = new Set<string>()
function serialized<T>(run: () => Promise<T>): Promise<T> {
  const result = writeQueue.then(run, run)
  writeQueue = result.catch(() => undefined)
  return result
}
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T
const safeError = (error: unknown): McpResult => error instanceof McpError
  ? mcpFailure(error.code, error.message, error.details)
  : mcpFailure('storage_unavailable', 'The operation could not be confirmed. Inspect its receipt before retrying.')

export function createMcpService(options: McpServiceOptions) {
  const storage = options.storage ?? window.localStorage
  const suspensionKey = options.accountId + '\u0000' + options.sessionId
  const journalKey = getStoragePrefix() + '-mcp-receipts'
  const businessStores = [useTaskStore, useHabitStore, useSOPStore, useGrowthEventStore, useCharacterStore, useSettingsStore, useAreaStore]
  const persistentSlices = businessStores.map(store => ({ name: store.persist.getOptions().name ?? '', getState: store.getState }))
  const observed = new Map(persistentSlices.map(slice => [slice.name, {
    raw: storage.getItem(slice.name), memory: canonicalJSON(slice.getState()),
  }]))
  let reloadRequired = false
  function observePersistence() {
    if (reloadRequired) throw new McpError('reload_required', 'Stored data changed independently of this window. Reload the app before reading new versions or writing.')
    for (const slice of persistentSlices) {
      const raw = storage.getItem(slice.name), memory = canonicalJSON(slice.getState())
      const before = observed.get(slice.name)!
      if (before.raw === raw && before.memory === memory) continue
      let matches = false
      try { matches = raw !== null && canonicalJSON((JSON.parse(raw) as { state: unknown }).state) === memory } catch { /* invalid or inaccessible state */ }
      if (!matches) {
        reloadRequired = true
        throw new McpError('reload_required', 'Stored data changed independently of this window or failed to save. Inspect receipts and reload the app; old in-memory values will not overwrite the stored data.')
      }
      observed.set(slice.name, { raw, memory })
    }
  }
  // Private comparison data only. Never placed in a business frame, response or receipt.
  const privatePersistence = () => persistentSlices.map(slice => ({ name: slice.name, raw: storage.getItem(slice.name) }))
  const versionFor = async (snapshot: unknown, privateBaseline = privatePersistence()) => {
    const persistedRevision = await versionOf(privateBaseline)
    return versionOf({ snapshot, persistedRevision })
  }
  const language = () => useSettingsStore.getState().settings.language
  const library = () => resolveSOPLibrary(useSOPStore.getState(), language())
  const frame = (value: unknown) => ({ accountId: options.accountId, sessionId: options.sessionId,
    localDate: getTodayString(), language: language(), categories: useAreaStore.getState().areas.filter(area => area.category !== '_milestone').map(area => ({ category: area.category, name: area.name })), value })
  const records = (domain: McpDomain): RecordType[] => domain === 'tasks' ? useTaskStore.getState().tasks
    : domain === 'habits' ? useHabitStore.getState().habits : library().sops
  const collection = (domain: McpDomain) => frame({ domain, records: records(domain), ...(domain === 'flows' ? { folders: library().folders } : {}) })
  const folders = () => frame({ folders: library().folders })
  const entity = (domain: McpDomain, entityId: string): RecordType => {
    const result = records(domain).find(record => record.id === entityId)
    if (!result) throw new McpError('not_found', 'The requested record does not exist')
    return result
  }
  const entitySnapshot = (domain: McpDomain, entityId: string) => frame({ domain, record: entity(domain, entityId),
    ...(domain === 'flows' ? { folders: library().folders } : {}) })
  function assertSession() {
    if (options.accountId !== getBoundAccountId() || !isAccountBindingCurrent() || !options.isCurrent()) {
      throw new McpError('session_expired', 'The app account or MCP session changed. Reconnect and read fresh versions.')
    }
  }
  function access(domain: McpDomain, write = false) {
    assertSession()
    const permission = options.getPermissions()[domain]
    if (!permission?.read || write && !permission.write) throw new McpError('permission_denied', 'This domain is not granted for ' + (write ? 'writing' : 'reading'))
  }
  function readJournal(): Journal {
    const raw = storage.getItem(journalKey)
    if (!raw) return { version: 1, accountId: options.accountId, receipts: [] }
    let data: Journal
    try { data = JSON.parse(raw) as Journal } catch { throw new McpError('receipt_storage_invalid', 'Receipt storage is invalid; writes are disabled') }
    if (data.version !== 1 || data.accountId !== options.accountId || !Array.isArray(data.receipts) ||
      data.receipts.some(receipt => !receipt || typeof receipt.requestId !== 'string' || typeof receipt.fingerprint !== 'string' ||
        !['tasks','habits','flows'].includes(receipt.domain) || !['pending','committed'].includes(receipt.status) ||
        receipt.status === 'committed' && (!receipt.result || typeof receipt.result.ok !== 'boolean')) ||
      new Set(data.receipts.map(receipt => receipt.requestId)).size !== data.receipts.length) {
      throw new McpError('receipt_storage_invalid', 'Receipt storage is invalid; writes are disabled')
    }
    return data
  }
  function saveJournal(journal: Journal) {
    const raw = JSON.stringify(journal)
    storage.setItem(journalKey, raw)
    if (storage.getItem(journalKey) !== raw) throw new McpError('storage_unavailable', 'The operation receipt could not be saved')
  }
  function requestId(value: unknown) {
    const result = text(value, 'requestId', 128)
    if (result.length < 8 || /[\u0000-\u001f]/.test(result)) invalid('requestId must be 8–128 printable characters')
    return result
  }
  async function resultRecord(domain: McpDomain, entityId: string, extra: Record<string, unknown> = {}): Promise<unknown> {
    // Capture once, before hashing, so the receipt describes exactly this action's result.
    observePersistence()
    const record = clone(records(domain).find(record => record.id === entityId) ?? null)
    const snapshot = frame({ domain, record, ...(domain === 'flows' ? { folders: clone(library().folders) } : {}) })
    const collectionSnapshot = clone(collection(domain))
    const privateBaseline = privatePersistence()
    return { ...extra, id: entityId, record, version: record ? await versionFor(snapshot, privateBaseline) : null,
      collectionVersion: await versionFor(collectionSnapshot, privateBaseline) }
  }
  function persistenceSnapshots() {
    return [useTaskStore, useHabitStore, useSOPStore, useGrowthEventStore, useCharacterStore].map(store => ({
      name: store.persist.getOptions().name ?? '', value: canonicalJSON(store.getState()), getState: store.getState,
    }))
  }
  function verifyPersistence(before: ReturnType<typeof persistenceSnapshots>) {
    for (const entry of before) {
      const current = canonicalJSON(entry.getState())
      if (current === entry.value) continue
      const raw = storage.getItem(entry.name)
      if (!raw) throw new Error('missing_persisted_state')
      const persisted = JSON.parse(raw) as { state: unknown }
      if (canonicalJSON(persisted.state) !== current) throw new Error('persisted_state_mismatch')
    }
  }
  function findFolder(folderId: string) {
    const folder = library().folders.find(folder => folder.id === folderId)
    if (!folder) throw new McpError('not_found', 'The destination folder does not exist')
    return folder
  }
  function validCategory(category: string | undefined) {
    if (category !== undefined && category !== 'other' && !useAreaStore.getState().areas.some(area => area.category === category && area.category !== '_milestone')) invalid('Unknown category; read registered categories from get_context')
  }
  function stateError(): never { throw new McpError('invalid_state', 'This action is unavailable for the current record state') }
  function prepare(request: McpRequest) {
    const { method, params } = request
    const route = mcpToolAccess(method)
    if (!route || !route.write) invalid('Not a write tool')
    const domain = route.domain
    access(domain, true)
    const operationId = requestId(params.requestId)
    const expectedVersion = text(params.expectedVersion, 'expectedVersion', 256)
    let snapshot: () => unknown
    let apply: () => { domain?: McpDomain; id: string; extra?: Record<string, unknown> }
    if (method === 'flow_folders_create') {
      keys(params, ['requestId','expectedVersion','name','parentId'])
      const name = text(params.name, 'name', 200)
      const parentId = params.parentId === undefined ? undefined : id(params.parentId, 'parentId')
      if (parentId && (findFolder(parentId), useSOPStore.getState().getFolderDepth(parentId) >= 2)) stateError()
      snapshot = folders
      apply = () => {
        const created = useSOPStore.getState().addFolder(name, parentId)
        if (!created) stateError()
        return { id: created, extra: { folder: clone(findFolder(created)) } }
      }
    } else if (method.endsWith('_create')) {
      keys(params, ['requestId','expectedVersion','record'])
      snapshot = () => collection(domain)
      if (domain === 'tasks') {
        const fields = taskFields(params.record, true)
        validCategory(fields.category)
        apply = () => {
          const created = useTaskStore.getState().addTask({ ...fields, title: fields.title! })
          if (fields.actualMinutes !== undefined) useTaskStore.getState().updateTask(created.id, { actualMinutes: fields.actualMinutes })
          return { id: created.id }
        }
      } else if (domain === 'habits') {
        const fields = habitFields(params.record)
        validCategory(fields.category)
        apply = () => {
          const previousIds = new Set(useHabitStore.getState().habits.map(habit => habit.id))
          useHabitStore.getState().addHabit({ ...habitDefaults(), ...fields, title: fields.title! })
          const created = useHabitStore.getState().habits.find(habit => !previousIds.has(habit.id))
          if (!created) stateError()
          if (fields.actualMinutes !== undefined) useHabitStore.getState().updateHabit(created.id, { actualMinutes: fields.actualMinutes })
          return { id: created.id }
        }
      } else {
        const fields = flowFields(params.record)
        findFolder(fields.folderId!)
        apply = () => {
          const created = useSOPStore.getState().addSOP({ title: fields.title!, folderId: fields.folderId!,
            displayStyle: fields.displayStyle ?? 'numbered', steps: fields.steps ?? [], isSystem: false })
          if (!created) stateError()
          return { id: created }
        }
      }
    } else {
      const entityId = id(params.id)
      const record = entity(domain, entityId)
      snapshot = () => entitySnapshot(domain, entityId)
      if (method.endsWith('_update')) {
        keys(params, ['requestId','expectedVersion','id','patch'])
        if (domain === 'tasks') {
          if ((record as Task).deletedAt) stateError()
          const fields = taskFields(params.patch, false)
          validCategory(fields.category)
          apply = () => { useTaskStore.getState().updateTask(entityId, fields); return { id: entityId } }
        } else if (domain === 'habits') {
          if ((record as Habit).deletedAt) stateError()
          const fields = habitFields(params.patch, record as Habit)
          validCategory(fields.category)
          apply = () => { useHabitStore.getState().updateHabit(entityId, fields); return { id: entityId } }
        } else {
          const fields = flowFields(params.patch, record as SOP)
          if (fields.folderId && fields.folderId !== (record as SOP).folderId) invalid('Use the explicit move action to change a flow folder')
          apply = () => { useSOPStore.getState().updateSOP(entityId, fields); return { id: entityId } }
        }
      } else if (method.endsWith('_action')) {
        keys(params, domain === 'flows' ? ['requestId','expectedVersion','id','action','targetFolderId','taskCollectionVersion'] : ['requestId','expectedVersion','id','action'])
        if (domain === 'tasks') {
          const task = record as Task
          const action = oneOf(params.action, ['complete','undo','wait','resume','start','pause','delete','restore','timer_start','timer_pause','timer_stop'] as const, 'action')
          if (action === 'restore' ? !task.deletedAt : !!task.deletedAt) stateError()
          if (action === 'complete' && task.status === 'done' || action === 'undo' && task.status !== 'done' || action === 'resume' && task.status !== 'waiting') stateError()
          if (['wait','start','pause','timer_start','timer_pause','timer_stop'].includes(action) && (task.isHidden || !['todo','doing'].includes(task.status))) stateError()
          apply = () => {
            const store = useTaskStore.getState()
            if (action === 'complete') { if (!store.completeTask(entityId)) stateError() }
            else if (action === 'undo') store.undoComplete(entityId)
            else if (action === 'wait') { if (!store.waitTask(entityId)) stateError() }
            else if (action === 'resume') { if (!store.resumeWaitingTask(entityId)) stateError() }
            else if (action === 'start') store.startTask(entityId)
            else if (action === 'pause') store.pauseTask(entityId)
            else if (action === 'delete') store.deleteTask(entityId)
            else if (action === 'restore') store.restoreTask(entityId)
            else if (action === 'timer_start') store.startTimer(entityId)
            else if (action === 'timer_pause') store.pauseTimer(entityId)
            else store.stopTimer(entityId)
            return { id: entityId }
          }
        } else if (domain === 'habits') {
          const habit = record as Habit
          const action = oneOf(params.action, ['complete','skip','undo','pause','resume','archive','delete','restore','timer_start','timer_pause'] as const, 'action')
          if (action === 'restore' ? !habit.deletedAt : !!habit.deletedAt) stateError()
          const refreshed = refreshHabitCycle(habit)
          if (['complete','skip'].includes(action) && (refreshed.isHidden || refreshed.status !== 'active' || !!refreshed.lastAction || !isHabitDueToday(refreshed))) stateError()
          if (action === 'pause' && habit.status !== 'active' || action === 'resume' && (habit.status !== 'paused' || !!refreshed.lastAction) || action === 'archive' && habit.status === 'archived') stateError()
          if (action === 'undo' && (habit.status !== 'completed_today' || !habit.lastAction || !isSameLocalDate(habit.lastAction.at, getTodayString()))) stateError()
          if (['timer_start','timer_pause'].includes(action) && (habit.isHidden || habit.status !== 'active')) stateError()
          apply = () => {
            const store = useHabitStore.getState()
            if (action === 'complete') { if (!store.completeHabit(entityId)) stateError() }
            else if (action === 'skip') { if (!store.skipHabit(entityId)) stateError() }
            else if (action === 'undo') { if (!store.undoComplete(entityId, habit.lastAction?.id)) stateError() }
            else if (action === 'pause') store.pauseHabit(entityId)
            else if (action === 'resume') store.resumeHabit(entityId)
            else if (action === 'archive') store.archiveHabit(entityId)
            else if (action === 'delete') store.deleteHabit(entityId)
            else if (action === 'restore') store.restoreHabit(entityId)
            else if (action === 'timer_start') store.startHabitTimer(entityId)
            else store.pauseHabitTimer(entityId)
            return { id: entityId }
          }
        } else {
          const source = record as SOP
          const action = oneOf(params.action, ['delete','copy','move','instantiate'] as const, 'action')
          if (action !== 'copy' && action !== 'move' && params.targetFolderId !== undefined || action !== 'instantiate' && params.taskCollectionVersion !== undefined) invalid('Unexpected action parameter')
          const target = params.targetFolderId === undefined ? undefined : id(params.targetFolderId, 'targetFolderId')
          if (target) findFolder(target)
          if (action === 'move' && !target) invalid('move requires targetFolderId')
          if (action === 'instantiate') {
            access('tasks', true)
            const expectedTasks = text(params.taskCollectionVersion, 'taskCollectionVersion', 256)
            const sourceSnapshot = snapshot
            snapshot = () => ({ source: sourceSnapshot(), tasks: collection('tasks'), expectedTasks })
            // The two independent caller tokens are validated separately in executeWrite.
          }
          apply = () => {
            const store = useSOPStore.getState()
            if (action === 'delete') { store.deleteSOP(entityId); return { id: entityId } }
            if (action === 'copy') {
              const created = target ? store.copySOPToFolder(entityId, target) : store.duplicateSOP(entityId)
              if (!created) stateError()
              return { id: created, extra: { sourceFlowId: entityId } }
            }
            if (action === 'move') {
              const moved = store.transferSOP(entityId, target!)
              if (!moved) stateError()
              return { id: moved, extra: { sourceFlowId: entityId } }
            }
            const created = useTaskStore.getState().createTaskFromSOP({ title: source.title, category: 'other',
              difficulty: 3, priority: 'medium', dueDate: null, steps: source.steps })
            return { domain: 'tasks', id: created, extra: { sourceFlowId: entityId } }
          }
        }
      } else invalid('Unknown write method')
    }
    return { domain, operationId, expectedVersion, snapshot, apply }
  }

  async function executeWrite(request: McpRequest, context: McpCallContext): Promise<McpResult> {
    const route = mcpToolAccess(request.method)!
    access(route.domain, true)
    // Retry recognition precedes state and version checks: later edits never replay an old action.
    const operationId = requestId(request.params.requestId)
    const fingerprint = await versionOf({ method: request.method, params: request.params, accountId: options.accountId })
    assertSession(); access(route.domain, true)
    if (request.method === 'flows_action' && request.params.action === 'instantiate') access('tasks', true)
    const journal = readJournal()
    const existing = journal.receipts.find(receipt => receipt.requestId === operationId)
    if (existing) {
      if (existing.fingerprint !== fingerprint) throw new McpError('request_id_conflict', 'requestId was already used with different parameters')
      if (existing.status === 'committed') return clone(existing.result!)
      throw new McpError('operation_unknown', 'This request may already have executed. Read its receipt and current records; do not submit a new requestId.', { requestId: operationId })
    }
    if (suspendedSessions.has(suspensionKey)) throw new McpError('writes_suspended', 'An earlier write has an unknown outcome. Inspect its receipt and reload the app before any new write.')
    if (journal.receipts.length >= 2000) throw new McpError('receipt_storage_full', 'Receipt limit reached. Writes are disabled; old request IDs are never silently forgotten.')
    observePersistence()
    const operation = prepare(request)
    const snapshot = clone(operation.snapshot())
    const canonical = canonicalJSON(snapshot)
    const privateBaseline = privatePersistence()
    const privateCanonical = canonicalJSON(privateBaseline)
    if (request.method === 'flows_action' && request.params.action === 'instantiate') {
      const compound = snapshot as { source: unknown; tasks: unknown }
      if (await versionFor(compound.source, privateBaseline) !== operation.expectedVersion || await versionFor(compound.tasks, privateBaseline) !== request.params.taskCollectionVersion) {
        throw new McpError('version_conflict', 'The flow or task collection changed. Read fresh versions before making a new decision.')
      }
    } else if (await versionFor(snapshot, privateBaseline) !== operation.expectedVersion) {
      throw new McpError('version_conflict', 'The record or collection changed. Read a fresh version before editing.')
    }
    if (context.authorize && !await context.authorize()) throw new McpError('session_expired', 'The request expired or its permission was revoked')
    assertSession(); access(operation.domain, true)
    if (request.method === 'flows_action' && request.params.action === 'instantiate') access('tasks', true)
    observePersistence()
    if (canonicalJSON(operation.snapshot()) !== canonical || canonicalJSON(privatePersistence()) !== privateCanonical) throw new McpError('version_conflict', 'The app changed while this request was waiting. Read it again.')
    const before = persistenceSnapshots()
    const receipt: Receipt = { requestId: operationId, fingerprint, method: request.method,
      domain: operation.domain, status: 'pending', createdAt: new Date().toISOString() }
    journal.receipts.push(receipt)
    // Fail before touching business state if the durable intent cannot be saved.
    try { saveJournal(journal) } catch { throw new McpError('storage_unavailable', 'Receipt could not be saved. No business action was started.') }
    // No await between the final validation, durable intent, and the synchronous store action.
    try {
      const result = operation.apply()
      verifyPersistence(before)
      let data: unknown
      if (request.method === 'flow_folders_create') {
        const snapshot = clone(folders())
        data = { ...result.extra, id: result.id, collectionVersion: await versionFor(snapshot) }
      } else data = await resultRecord(result.domain ?? operation.domain, result.id, result.extra)
      const response: McpResult = { ok: true, data: { requestId: operationId, ...object(data) } }
      receipt.status = 'committed'; receipt.result = response
      saveJournal(journal)
      return clone(response)
    } catch {
      suspendedSessions.add(suspensionKey)
      // Persisted pending intent is deliberately retained. Never retry a partial or unknown write.
      throw new McpError('operation_unknown', 'The result could not be durably confirmed. Inspect this receipt and the records; never repeat with a new requestId.', { requestId: operationId })
    }
  }

  async function read(request: McpRequest): Promise<McpResult> {
    const { method, params } = request
    assertSession()
    if (method === 'get_context') {
      observePersistence()
      keys(params, [])
      const permissions = clone(options.getPermissions())
      const versions: Record<string, string> = {}
      for (const domain of ['tasks','habits','flows'] as const) if (permissions[domain]?.read) versions[domain] = await versionFor(collection(domain))
      if (permissions.flows?.read) versions.flowFolders = await versionFor(folders())
      assertSession(); observePersistence()
      if (canonicalJSON(options.getPermissions()) !== canonicalJSON(permissions)) throw new McpError('permission_denied', 'Permissions changed while reading the context')
      return { ok: true, data: { accountId: options.accountId, sessionId: options.sessionId, localDate: getTodayString(),
        permissions, writeSuspended: suspendedSessions.has(suspensionKey), ...(suspendedSessions.has(suspensionKey) ? { recovery: 'Inspect pending receipts and current records. Reload the app before making a new decision; the original pending requestId will never execute again.' } : {}), collectionVersions: versions, categories: permissions.tasks.read || permissions.habits.read
          ? useAreaStore.getState().areas.filter(area => area.category !== '_milestone').map(area => ({ id: area.category, name: area.name })).concat({ id: 'other', name: language() === 'zh' ? '其他' : 'Other' }) : [],
        limits: { pageSize: 100, retainedReceipts: 2000 }, rules: 'Use exact requestId for identical retries. Unknown/pending outcomes must be inspected, never repeated with a new ID. Updates accept explicit content fields only. Application must remain open.' } }
    }
    if (method === 'operations_get') {
      keys(params, ['requestId'])
      const operationId = requestId(params.requestId)
      const receipt = readJournal().receipts.find(receipt => receipt.requestId === operationId)
      if (!receipt) return { ok: true, data: { requestId: operationId, status: 'not_found' } }
      access(receipt.domain)
      if (receipt.method === 'flows_action' && receipt.result?.ok && object(receipt.result.data).sourceFlowId) {
        // An instantiated task must not leak through a flow-only grant.
        if (object(receipt.result.data).record && 'status' in object(object(receipt.result.data).record)) access('tasks')
      }
      return { ok: true, data: { requestId: operationId, method: receipt.method, status: receipt.status,
        createdAt: receipt.createdAt, ...(receipt.status === 'committed' ? { result: clone(receipt.result) } : { outcome: 'unknown', advice: 'Inspect current records. This request will never be executed automatically again.' }) } }
    }
    observePersistence()
    const route = mcpToolAccess(method)
    if (!route || route.write) invalid('Unknown read method')
    access(route.domain)
    if (method === 'flow_folders_list') {
      keys(params, [])
      const tree = clone(library().folders)
      const version = await versionFor(frame({ folders: tree }))
      access('flows'); observePersistence()
      return { ok: true, data: { folders: tree, collectionVersion: version } }
    }
    const domain = route.domain
    if (method.endsWith('_get')) {
      keys(params, ['id'])
      const entityId = id(params.id)
      const data = await resultRecord(domain, entityId)
      if (!object(data).record) throw new McpError('not_found', 'The requested record does not exist')
      access(domain); observePersistence()
      return { ok: true, data }
    }
    keys(params, ['query','category','status','limit','cursor','includeDeleted'])
    const query = params.query === undefined ? '' : text(params.query, 'query', 1000, true)
    const category = params.category === undefined ? undefined : id(params.category, 'category')
    const status = params.status === undefined ? undefined : id(params.status, 'status')
    if (domain === 'flows' && (category !== undefined || status !== undefined || params.includeDeleted !== undefined)) invalid('Flows do not support category, status, or trash filters')
    if (status) oneOf(status, domain === 'tasks' ? ['todo','doing','waiting','done'] : ['active','completed_today','paused','archived','mastered'], 'status')
    const limit = params.limit === undefined ? 25 : number(params.limit, 'limit', 1, 100, true)
    if (params.includeDeleted !== undefined && typeof params.includeDeleted !== 'boolean') invalid('includeDeleted must be boolean')
    const all = clone(records(domain))
    const collectionVersion = await versionFor(frame({ domain, records: all, ...(domain === 'flows' ? { folders: clone(library().folders) } : {}) }))
    const cursorKey = await versionOf({ collectionVersion, query, category, status, includeDeleted: !!params.includeDeleted })
    let offset = 0
    if (params.cursor !== undefined) {
      const cursor = text(params.cursor, 'cursor', 256).match(/^v1:(\d+):(v1:[a-f0-9]{64})$/)
      if (!cursor || cursor[2] !== cursorKey) throw new McpError('cursor_expired', 'The collection or filters changed; restart pagination')
      offset = number(Number(cursor[1]), 'cursor offset', 0, Number.MAX_SAFE_INTEGER, true)
    }
    const filtered = all.filter(record => {
      const state = record as Task | Habit
      return (params.includeDeleted || !state.deletedAt) && (!category || state.category === category) && (!status || state.status === status) &&
        (!query || (record.title + ('description' in record ? '\n' + record.description : '')).toLocaleLowerCase().includes(query.toLocaleLowerCase()))
    })
    const items = filtered.slice(offset, offset + limit).map(record => {
      if (domain === 'flows') { const flow = record as SOP; return { id: flow.id, title: flow.title, folderId: flow.folderId, displayStyle: flow.displayStyle, isSystem: flow.isSystem } }
      const state = record as Task | Habit
      return { id: state.id, title: state.title, category: state.category, status: state.status, actualMinutes: state.actualMinutes,
        deletedAt: state.deletedAt, isHidden: state.isHidden, ...(domain === 'tasks' ? { dueDate: (state as Task).dueDate, priority: (state as Task).priority } : { repeatType: (state as Habit).repeatType, currentCycleCount: (state as Habit).currentCycleCount, targetCount: (state as Habit).targetCount }) }
    })
    access(domain); observePersistence()
    return { ok: true, data: { items, total: filtered.length, collectionVersion, nextCursor: offset + limit < filtered.length ? 'v1:' + (offset + limit) + ':' + cursorKey : null } }
  }
  return {
    async handle(request: McpRequest, context: McpCallContext = {}): Promise<McpResult> {
      try {
        object(request); object(request.params)
        keys(request as unknown as Record<string, unknown>, ['method','params'])
        if (!MCP_TOOLS.some(tool => tool.name === request.method)) invalid('Unknown MCP tool')
        if (canonicalJSON(request).length > 128000) invalid('Request exceeds the input limit')
        const route = mcpToolAccess(request.method)
        return route?.write ? await serialized(() => executeWrite(request, context)) : await read(request)
      } catch (error) { return safeError(error) }
    },
  }
}
