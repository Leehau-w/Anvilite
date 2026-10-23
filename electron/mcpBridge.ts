import net from 'node:net'
import type { Server, Socket } from 'node:net'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { randomBytes, randomUUID, timingSafeEqual } from 'node:crypto'
import { NO_MCP_PERMISSIONS, MCP_TOOLS, mcpFailure, mcpToolAccess } from '../src/mcp/contracts'
import type { McpPermissions, McpRequest, McpResult, McpStatus, McpDispatch, McpConfiguration } from '../src/mcp/contracts'

export interface BridgeBinding { accountId: string; sessionId: string }
export interface LocalMcpBridgeOptions {
  dispatch: (request: McpDispatch) => Promise<McpResult>
  onStatus?: (status: McpStatus) => void
  clientConfig?: (pipe: string, token: string) => NonNullable<McpStatus['clientConfig']>
  onFinished?: (bridgeId: string) => void
  maxFrameBytes?: number
  timeoutMs?: number
  maxClients?: number
  maxPending?: number
}
const failure = (code: string): McpResult => mcpFailure(code, code)
const clonePermissions = (permissions: McpPermissions): McpPermissions => ({
  tasks: { ...permissions.tasks }, habits: { ...permissions.habits }, flows: { ...permissions.flows },
})
function validPermissions(value: unknown): value is McpPermissions {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  return ['tasks', 'habits', 'flows'].every(domain => {
    const access = (value as Record<string, unknown>)[domain]
    return !!access && typeof access === 'object' && !Array.isArray(access) &&
      typeof (access as Record<string, unknown>).read === 'boolean' && typeof (access as Record<string, unknown>).write === 'boolean'
  })
}
const validBinding = (value: BridgeBinding) => typeof value.accountId === 'string' && value.accountId.length > 0 &&
  value.accountId.length <= 256 && typeof value.sessionId === 'string' && value.sessionId.length > 0 && value.sessionId.length <= 256

/** A short lived authenticated local pipe. No network listener or storage writes. */
export class LocalMcpBridge {
  private binding: BridgeBinding | null = null
  private permissions: McpPermissions = clonePermissions(NO_MCP_PERMISSIONS)
  private server: Server | null = null
  private pipe: string | null = null
  private privateDirectory: string | null = null
  private token: string | null = null
  private sockets = new Set<Socket>()
  private epoch = 0
  private pending = new Map<string, McpRequest>()
  private rejected = new Set<(code: string) => void>()
  private transition = Promise.resolve()
  private options: LocalMcpBridgeOptions

  constructor(options: LocalMcpBridgeOptions) { this.options = options }

  status(): McpStatus {
    return { enabled: !!this.server, ready: !!this.binding, permissions: clonePermissions(this.permissions),
      accountId: this.binding?.accountId ?? null, sessionId: this.binding?.sessionId ?? null,
      pipe: this.pipe, token: this.token,
      ...(this.pipe && this.token && this.options.clientConfig ? { clientConfig: this.options.clientConfig(this.pipe, this.token) } : {}) }
  }

  private notify(): void { this.options.onStatus?.(this.status()) }

  ready(binding: BridgeBinding): void {
    if (!validBinding(binding)) throw new Error('invalid_session')
    // Each document/account handshake must start with a fresh explicit grant.
    if (this.binding?.accountId === binding.accountId && this.binding.sessionId === binding.sessionId) return
    this.revoke()
    this.binding = { ...binding }
    this.notify()
  }

  /** Immediately invalidate all outstanding work before asynchronously closing the listener. */
  revoke(notify = true): void {
    this.epoch++
    this.binding = null
    this.permissions = clonePermissions(NO_MCP_PERMISSIONS)
    this.token = null
    this.pending.clear()
    for (const reject of [...this.rejected]) reject('session_revoked')
    this.rejected.clear()
    for (const socket of this.sockets) socket.destroy()
    this.sockets.clear()
    const server = this.server
    this.server = null
    this.pipe = null
    const directory = this.privateDirectory
    this.privateDirectory = null
    if (server) {
      try { server.close(() => this.cleanDirectory(directory)) } catch { this.cleanDirectory(directory) }
    } else this.cleanDirectory(directory)
    if (notify) this.notify()
  }

  private cleanDirectory(directory: string | null): void {
    if (!directory) return
    // Only the fresh private directory owned by this listener is eligible; never recurse.
    try { fs.unlinkSync(path.join(directory, 'bridge.sock')) } catch { /* already closed */ }
    try { fs.rmdirSync(directory) } catch { /* closing connection may still own socket */ }
  }

  configure(binding: BridgeBinding, configuration: McpConfiguration): Promise<McpStatus> {
    if (!this.sameBinding(binding)) return Promise.reject(new Error('session_revoked'))
    if (!configuration || typeof configuration.enabled !== 'boolean' || !validPermissions(configuration.permissions)) {
      return Promise.reject(new Error('invalid_configuration'))
    }
    if (configuration.enabled === !!this.server && JSON.stringify(configuration.permissions) === JSON.stringify(this.permissions)) {
      return Promise.resolve(this.status())
    }
    // Every permission change invalidates the old token, sockets and all outstanding work.
    const retainedBinding = this.binding!
    this.revoke(false)
    this.binding = retainedBinding
    this.permissions = configuration.enabled ? clonePermissions(configuration.permissions) : clonePermissions(NO_MCP_PERMISSIONS)
    this.notify()
    if (!configuration.enabled) return Promise.resolve(this.status())
    const epoch = this.epoch
    this.transition = this.transition.catch(() => undefined).then(async () => {
      if (!this.sameBinding(binding) || this.epoch !== epoch) throw new Error('session_revoked')
      if (this.server) return
      const token = randomBytes(32).toString('hex')
      let directory: string | null = null
      let pipe: string
      if (process.platform === 'win32') pipe = '\\\\.\\pipe\\anvilite-mcp-' + randomUUID()
      else {
        directory = fs.mkdtempSync(path.join(os.tmpdir(), 'anvilite-mcp-'))
        fs.chmodSync(directory, 0o700)
        pipe = path.join(directory, 'bridge.sock')
      }
      const server = net.createServer(socket => this.accept(socket, epoch))
      try {
        await new Promise<void>((resolve, reject) => {
          server.once('error', reject)
          server.listen(pipe, () => { server.off('error', reject); resolve() })
        })
        if (directory) fs.chmodSync(pipe, 0o600)
        if (!this.sameBinding(binding) || this.epoch !== epoch) throw new Error('session_revoked')
        this.server = server
        this.token = token
        this.pipe = pipe
        this.privateDirectory = directory
        this.notify()
        server.on('error', () => {
          if (this.server === server) this.revoke()
        })
      } catch (error) {
        try { server.close(() => this.cleanDirectory(directory)) } catch { this.cleanDirectory(directory) }
        throw error
      }
    })
    return this.transition.then(() => this.status())
  }

  private sameBinding(binding: BridgeBinding): boolean {
    return !!this.binding && binding.accountId === this.binding.accountId && binding.sessionId === this.binding.sessionId
  }

  canDispatch(bridgeId: string, binding: BridgeBinding): boolean {
    const request = this.pending.get(bridgeId)
    return !!this.server && this.sameBinding(binding) && !!request && this.allowed(request)
  }

  private allowed(request: McpRequest): boolean {
    if (request.method === 'get_context' || request.method === 'operations_get') return Object.values(this.permissions).some(access => access.read)
    const access = mcpToolAccess(request.method)
    if (!access || !this.permissions[access.domain][access.write ? 'write' : 'read']) return false
    return !(request.method === 'flows_action' && request.params.action === 'instantiate' && !this.permissions.tasks.write)
  }

  private authorized(value: unknown): boolean {
    if (typeof value !== 'string' || !/^[a-f0-9]{64}$/.test(value) || !this.token) return false
    return timingSafeEqual(Buffer.from(value, 'hex'), Buffer.from(this.token, 'hex'))
  }

  private fail(code: string): McpResult { return failure(code) }

  private accept(socket: Socket, epoch: number): void {
    const maxBytes = this.options.maxFrameBytes ?? 1024 * 1024
    if (epoch !== this.epoch || this.sockets.size >= (this.options.maxClients ?? 8)) { socket.destroy(); return }
    this.sockets.add(socket)
    // Idle or unauthenticated clients cannot hold a connection forever.
    socket.setTimeout(Math.max(this.options.timeoutMs ?? 15_000, 1000) * 2, () => socket.destroy())
    let buffer = Buffer.alloc(0)
    let socketPending = 0
    const ids = new Set<string>()
    socket.on('error', () => socket.destroy())
    socket.on('close', () => this.sockets.delete(socket))
    socket.on('data', chunk => {
      buffer = Buffer.concat([buffer, chunk])
      for (;;) {
        const end = buffer.indexOf(10)
        if (end < 0) break
        if (end > maxBytes) { socket.destroy(); return }
        const line = buffer.subarray(0, end).toString('utf8')
        buffer = buffer.subarray(end + 1)
        if (!line.trim()) continue
        let frame: unknown
        try { frame = JSON.parse(line) } catch { socket.destroy(); return }
        if (!frame || typeof frame !== 'object' || Array.isArray(frame)) { socket.destroy(); return }
        const value = frame as Record<string, unknown>
        if (typeof value.id !== 'string' || !value.id || value.id.length > 128 || !this.authorized(value.token)) { socket.destroy(); return }
        if (ids.has(value.id)) { this.reply(socket, value.id, this.fail('duplicate_transport_id'), maxBytes); continue }
        if (ids.size >= 1024) { socket.destroy(); return }
        ids.add(value.id)
        const id = value.id
        if (socketPending >= 4 || this.pending.size >= (this.options.maxPending ?? 16)) {
          this.reply(socket, id, this.fail('busy'), maxBytes); continue
        }
        socketPending++
        void this.handle(value.request, epoch).then(result => this.reply(socket, id, result, maxBytes)).finally(() => socketPending--)
      }
      if (buffer.length > maxBytes) socket.destroy()
    })
  }

  private reply(socket: Socket, id: string, result: McpResult, maxBytes: number): void {
    if (socket.destroyed) return
    let text: string
    try { text = JSON.stringify({ id, result }) + '\n' } catch { socket.destroy(); return }
    if (Buffer.byteLength(text) > maxBytes) text = JSON.stringify({ id, result: this.fail('response_too_large') }) + '\n'
    if (socket.writableLength > maxBytes * 2) { socket.destroy(); return }
    socket.write(text)
  }

  private async handle(raw: unknown, epoch: number): Promise<McpResult> {
    if (!this.binding || !this.server || epoch !== this.epoch) return this.fail('session_revoked')
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return this.fail('invalid_request')
    const candidate = raw as Record<string, unknown>
    if (typeof candidate.method !== 'string' || !MCP_TOOLS.some(tool => tool.name === candidate.method) ||
      !candidate.params || typeof candidate.params !== 'object' || Array.isArray(candidate.params)) return this.fail('invalid_request')
    const request = raw as McpRequest
    if (!this.allowed(request)) return this.fail('permission_denied')
    const binding = { ...this.binding }
    const bridgeId = randomUUID()
    this.pending.set(bridgeId, request)
    let timeout: ReturnType<typeof setTimeout> | undefined
    let cancel: ((code: string) => void) | undefined
    try {
      const operation = this.options.dispatch({ bridgeId, ...binding, request, permissions: clonePermissions(this.permissions) })
      const cancelled = new Promise<McpResult>(resolve => {
        cancel = code => resolve(this.fail(code))
        this.rejected.add(cancel)
        timeout = setTimeout(() => cancel?.(mcpToolAccess(request.method)?.write ? 'unknown_outcome' : 'request_timeout'), this.options.timeoutMs ?? 15_000)
      })
      const result = await Promise.race([operation, cancelled])
      if (epoch !== this.epoch || !this.sameBinding(binding)) return this.fail('session_revoked')
      return result
    } catch { return this.fail('bridge_failed') }
    finally {
      if (timeout) clearTimeout(timeout)
      if (cancel) this.rejected.delete(cancel)
      this.pending.delete(bridgeId)
      this.options.onFinished?.(bridgeId)
    }
  }
}
