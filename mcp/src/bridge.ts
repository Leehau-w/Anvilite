import net from 'node:net'
import path from 'node:path'
import os from 'node:os'
import { randomUUID } from 'node:crypto'
import { mcpFailure, mcpToolAccess } from '../../src/mcp/contracts.js'
import type { McpRequest, McpResult, McpWireRequest } from '../../src/mcp/contracts.js'

const MAX_FRAME_BYTES = 1024 * 1024
const WRITE_UNKNOWN = 'The operation may have been applied. Inspect operations_get with the same requestId; do not repeat with a new requestId.'

export function validLocalPipe(value: string): boolean {
  if (process.platform === 'win32') {
    const prefix = String.raw`\\.\pipe\anvilite-mcp-`
    return value.startsWith(prefix) && /^[a-zA-Z0-9-]+$/.test(value.slice(prefix.length))
  }
  const resolved = path.resolve(value)
  return value === resolved && path.dirname(path.dirname(resolved)) === path.resolve(os.tmpdir()) &&
    /^anvilite-mcp-[a-zA-Z0-9-]+$/.test(path.basename(path.dirname(resolved))) && path.basename(resolved) === 'bridge.sock'
}

/** One local socket per call, with no automatic retries and no raw storage access. */
export class DesktopBridgeClient {
  private sockets = new Map<net.Socket, () => void>()
  constructor(private readonly pipe: string, private readonly token: string, private readonly timeoutMs = 20_000) {
    if (!validLocalPipe(pipe) || !/^[a-f0-9]{64}$/.test(token)) throw new Error('invalid_configuration')
  }

  close(): void { for (const cancel of [...this.sockets.values()]) cancel() }

  call(request: McpRequest, signal?: AbortSignal): Promise<McpResult> {
    const write = mcpToolAccess(request.method)?.write === true
    return new Promise(resolve => {
      const id = randomUUID()
      const frame: McpWireRequest = { id, token: this.token, request }
      let encoded: string
      try { encoded = JSON.stringify(frame) + '\n' } catch { resolve(mcpFailure('invalid_request', 'The request is not serializable.')); return }
      if (Buffer.byteLength(encoded) > MAX_FRAME_BYTES) { resolve(mcpFailure('request_too_large', 'The request exceeds the local bridge limit.')); return }
      const socket = net.createConnection({ path: this.pipe })
      let sent = false
      let finished = false
      let buffer = Buffer.alloc(0)
      const unknown = () => mcpFailure(write && sent ? 'unknown_outcome' : 'app_unavailable', write && sent ? WRITE_UNKNOWN : 'Anvilite is unavailable. Open the application and enable this local connection.')
      const malformed = (code = 'invalid_bridge_response') => write && sent ? unknown() : mcpFailure(code, 'The local application returned an invalid or oversized response.')
      const finish = (result: McpResult) => {
        if (finished) return
        finished = true
        clearTimeout(timer)
        signal?.removeEventListener('abort', cancel)
        this.sockets.delete(socket)
        socket.destroy()
        resolve(result)
      }
      const cancel = () => finish(unknown())
      const timer = setTimeout(cancel, this.timeoutMs)
      this.sockets.set(socket, cancel)
      socket.on('error', cancel)
      socket.on('close', () => { if (!finished) cancel() })
      socket.on('connect', () => {
        if (finished) return
        sent = true
        socket.write(encoded)
      })
      socket.on('data', chunk => {
        buffer = Buffer.concat([buffer, chunk])
        if (buffer.length > MAX_FRAME_BYTES) { finish(malformed('response_too_large')); return }
        const end = buffer.indexOf(10)
        if (end < 0) return
        let frame: unknown
        try { frame = JSON.parse(buffer.subarray(0, end).toString('utf8')) } catch { finish(malformed()); return }
        if (!frame || typeof frame !== 'object' || Array.isArray(frame)) { finish(malformed()); return }
        const response = frame as { id?: unknown; result?: unknown }
        if (response.id !== id || !response.result || typeof response.result !== 'object' || Array.isArray(response.result)) { finish(malformed()); return }
        const result = response.result as McpResult
        if (result.ok === true && Object.hasOwn(result, 'data')) { finish(result); return }
        if (result.ok !== false || !result.error || typeof result.error.code !== 'string' || typeof result.error.message !== 'string') { finish(malformed()); return }
        // A timeout/revocation after dispatch does not prove that the write was rolled back.
        if (write && ['request_timeout','bridge_failed','session_revoked','response_too_large'].includes(result.error.code)) {
          finish(mcpFailure('unknown_outcome', WRITE_UNKNOWN, { cause: result.error.code })); return
        }
        finish(result)
      })
      signal?.addEventListener('abort', cancel, { once: true })
      if (signal?.aborted) cancel()
    })
  }
}
