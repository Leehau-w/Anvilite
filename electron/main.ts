import { app, BrowserWindow, ipcMain, dialog } from 'electron'
import type { IpcMainEvent, IpcMainInvokeEvent } from 'electron'
import fs from 'fs'
import path from 'path'
import { fileURLToPath, pathToFileURL } from 'url'
import { randomUUID } from 'crypto'
import { LocalMcpBridge } from './mcpBridge'
import type { BridgeBinding } from './mcpBridge'
import type { McpDispatch, McpResult, McpReply, McpConfiguration } from '../src/mcp/contracts'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const isDev = process.env.NODE_ENV === 'development'
const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL
const MAX_SAVE_FILE_SIZE = 100 * 1024 * 1024
const rendererURL = isDev && VITE_DEV_SERVER_URL
  ? new URL(VITE_DEV_SERVER_URL).href
  : pathToFileURL(path.join(__dirname, '../dist/index.html')).href

let mainWindow: BrowserWindow | null = null
let documentGeneration = 0
let approvedSyncDirectory: { selected: string; root: string; dev: bigint; ino: bigint } | null = null

function trustedDocument(url: string): boolean {
  try {
    const actual = new URL(url)
    const expected = new URL(rendererURL)
    actual.hash = ''
    expected.hash = ''
    return actual.href === expected.href
  } catch { return false }
}

function trustedSender(event: IpcMainEvent | IpcMainInvokeEvent): boolean {
  const win = mainWindow
  return !!win && !win.isDestroyed() && event.sender === win.webContents &&
    event.senderFrame === win.webContents.mainFrame &&
    trustedDocument(event.senderFrame.url) && trustedDocument(win.webContents.getURL())
}

interface RendererMcpPending { binding: BridgeBinding; generation: number; resolve: (result: McpResult) => void }
const rendererMcpPending = new Map<string, RendererMcpPending>()
const localMcp = new LocalMcpBridge({
  clientConfig: (pipe, token) => ({
    command: process.execPath,
    args: [app.isPackaged ? path.join(process.resourcesPath, 'mcp/server.cjs') : path.resolve(__dirname, '../dist-mcp/server.cjs')],
    env: { ELECTRON_RUN_AS_NODE: '1', ANVILITE_MCP_PIPE: pipe, ANVILITE_MCP_TOKEN: token },
  }),
  dispatch: (dispatch: McpDispatch) => new Promise<McpResult>((resolve, reject) => {
    const win = mainWindow
    if (!win || win.isDestroyed() || !trustedDocument(win.webContents.getURL())) { reject(new Error('renderer_unavailable')); return }
    rendererMcpPending.set(dispatch.bridgeId, { binding: { accountId: dispatch.accountId, sessionId: dispatch.sessionId }, generation: documentGeneration, resolve })
    try { win.webContents.send('mcp-request', dispatch) } catch { rendererMcpPending.delete(dispatch.bridgeId); reject(new Error('renderer_unavailable')) }
  }),
  onFinished: bridgeId => { rendererMcpPending.delete(bridgeId) },
  onStatus: status => {
    if (!status.enabled) rendererMcpPending.clear()
    const win = mainWindow
    if (win && !win.isDestroyed() && trustedDocument(win.webContents.getURL())) win.webContents.send('mcp-status', status)
  },
})
function currentMcpBinding(): BridgeBinding | null {
  const status = localMcp.status()
  return status.accountId && status.sessionId ? { accountId: status.accountId, sessionId: status.sessionId } : null
}
function requireMcpSender(event: IpcMainEvent | IpcMainInvokeEvent): void {
  if (!trustedSender(event)) throw new Error('invalid_sender')
}
ipcMain.handle('mcp-ready', (event, context: unknown) => {
  requireMcpSender(event)
  const accountId = context && typeof context === 'object' && !Array.isArray(context) ? (context as Record<string, unknown>).accountId : null
  if (typeof accountId !== 'string' || !accountId || accountId.length > 256) throw new Error('invalid_account')
  localMcp.ready({ accountId, sessionId: randomUUID() })
  return localMcp.status()
})
ipcMain.handle('mcp-get-status', event => { requireMcpSender(event); return localMcp.status() })
ipcMain.handle('mcp-configure', async (event, configuration: McpConfiguration) => {
  requireMcpSender(event)
  const generation = documentGeneration
  const binding = currentMcpBinding()
  if (!binding) throw new Error('renderer_not_ready')
  const status = await localMcp.configure(binding, configuration)
  if (generation !== documentGeneration || !trustedSender(event)) throw new Error('invalid_sender')
  return status
})
ipcMain.handle('mcp-validate', (event, lease: unknown) => {
  if (!trustedSender(event) || !lease || typeof lease !== 'object' || Array.isArray(lease)) return false
  const value = lease as Record<string, unknown>
  if (typeof value.bridgeId !== 'string' || typeof value.sessionId !== 'string') return false
  const pending = rendererMcpPending.get(value.bridgeId)
  return !!pending && pending.generation === documentGeneration && pending.binding.sessionId === value.sessionId &&
    localMcp.canDispatch(value.bridgeId, pending.binding)
})
ipcMain.on('mcp-respond', (event, reply: McpReply) => {
  if (!trustedSender(event) || !reply || typeof reply !== 'object' || typeof reply.bridgeId !== 'string' || typeof reply.sessionId !== 'string') return
  const pending = rendererMcpPending.get(reply.bridgeId)
  if (!pending || pending.generation !== documentGeneration || pending.binding.sessionId !== reply.sessionId ||
      !localMcp.canDispatch(reply.bridgeId, pending.binding)) return
  if (!reply.result || typeof reply.result !== 'object' || typeof reply.result.ok !== 'boolean') return
  rendererMcpPending.delete(reply.bridgeId)
  pending.resolve(reply.result)
})

class FileAccessError extends Error {}
function samePath(a: string, b: string): boolean {
  return process.platform === 'win32' ? a.toLowerCase() === b.toLowerCase() : a === b
}
function relativeJsonPath(value: unknown): string {
  if (typeof value !== 'string' || !value || value.length > 32767 || path.isAbsolute(value)) throw new FileAccessError('invalid_path')
  const relative = path.normalize(value)
  if (relative.startsWith('..') || path.basename(relative).startsWith('.') || path.extname(relative).toLowerCase() !== '.json') {
    throw new FileAccessError('invalid_path')
  }
  return relative
}

function resolveApprovedSyncPath(directory: unknown, relativePath: unknown, createParents: boolean): string {
  const approval = approvedSyncDirectory
  if (typeof directory !== 'string' || !approval ||
      ![approval.selected, approval.root].some(p => samePath(path.resolve(directory), p))) {
    throw new FileAccessError('directory_not_authorized')
  }
  const relative = relativeJsonPath(relativePath)
  const rootStat = fs.statSync(approval.root, { bigint: true })
  if (!rootStat.isDirectory() || rootStat.dev !== approval.dev || rootStat.ino !== approval.ino ||
      !samePath(fs.realpathSync(approval.selected), approval.root)) {
    approvedSyncDirectory = null
    throw new FileAccessError('directory_not_authorized')
  }
  const target = path.resolve(approval.root, relative)
  const fromRoot = path.relative(approval.root, target)
  if (!fromRoot || fromRoot.startsWith('..') || path.isAbsolute(fromRoot)) throw new FileAccessError('invalid_path')
  let parent = approval.root
  for (const segment of path.dirname(relative).split(path.sep).filter(p => p !== '.')) {
    parent = path.join(parent, segment)
    if (!fs.existsSync(parent)) {
      if (!createParents) return target
      fs.mkdirSync(parent)
    }
    const stat = fs.lstatSync(parent)
    if (stat.isSymbolicLink() || !stat.isDirectory()) throw new FileAccessError('invalid_path')
  }
  if (fs.existsSync(target)) {
    const stat = fs.lstatSync(target)
    if (stat.isSymbolicLink() || !stat.isFile()) throw new FileAccessError('invalid_file')
  }
  return target
}

// Complete the replacement in the same directory. A failed write leaves the old file intact.
function writeFileAtomically(filePath: string, content: string, recheck: () => void): void {
  const temporary = path.join(path.dirname(filePath), `.${path.basename(filePath)}.${randomUUID()}.tmp`)
  try {
    fs.writeFileSync(temporary, content, { encoding: 'utf-8', flag: 'wx', mode: 0o600, flush: true })
    recheck()
    fs.renameSync(temporary, filePath)
  } finally {
    try { fs.unlinkSync(temporary) } catch { /* The rename normally consumed the temporary file. */ }
  }
}

function accessFailure(error: unknown, fallback: string) {
  return { success: false, error: error instanceof FileAccessError ? error.message : fallback }
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    frame: false,
    titleBarStyle: 'hidden',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    backgroundColor: '#faf8f5',
    icon: app.isPackaged
      ? path.join(process.resourcesPath, 'build/icon.ico')
      : path.join(process.cwd(), 'build/icon.ico'),
  })
  mainWindow = win
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  win.webContents.on('will-navigate', (event, url) => { if (!trustedDocument(url)) event.preventDefault() })
  win.webContents.on('did-start-navigation', (_event, _url, isInPlace, isMainFrame) => {
    if (isMainFrame && !isInPlace) { documentGeneration++; approvedSyncDirectory = null; localMcp.revoke() }
  })
  win.webContents.on('render-process-gone', () => { documentGeneration++; localMcp.revoke() })
  if (isDev && VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL)
    win.webContents.openDevTools()
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  win.on('closed', () => {
    approvedSyncDirectory = null
    localMcp.revoke()
    mainWindow = null
  })
}

ipcMain.on('window-minimize', event => { if (trustedSender(event)) mainWindow!.minimize() })
ipcMain.on('window-maximize', event => {
  if (!trustedSender(event)) return
  if (mainWindow!.isMaximized()) mainWindow!.unmaximize()
  else mainWindow!.maximize()
})
ipcMain.on('window-close', event => { if (trustedSender(event)) mainWindow!.close() })

ipcMain.handle('save-file', async (event, content: unknown, defaultName: unknown) => {
  if (!trustedSender(event)) return { success: false, error: 'invalid_sender' }
  if (typeof content !== 'string' || Buffer.byteLength(content, 'utf-8') > MAX_SAVE_FILE_SIZE) return { success: false, error: 'content_too_large' }
  const generation = documentGeneration
  try {
    const { filePath, canceled } = await dialog.showSaveDialog(mainWindow!, {
      defaultPath: typeof defaultName === 'string' ? path.basename(defaultName) : 'anvilite-backup.json',
      filters: [{ name: 'JSON', extensions: ['json'] }],
    })
    if (generation !== documentGeneration || !trustedSender(event)) return { success: false, error: 'invalid_sender' }
    if (canceled || !filePath) return { success: false, canceled: true }
    if (path.extname(filePath).toLowerCase() !== '.json') return { success: false, error: 'invalid_extension' }
    writeFileAtomically(filePath, content, () => {
      if (generation !== documentGeneration || !trustedSender(event)) throw new FileAccessError('invalid_sender')
    })
    return { success: true }
  } catch (error) { return accessFailure(error, 'write_failed') }
})

ipcMain.handle('select-sync-directory', async event => {
  if (!trustedSender(event)) return { success: false, error: 'invalid_sender' }
  const generation = documentGeneration
  try {
    const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow!, {
      title: 'Select sync folder', properties: ['openDirectory', 'createDirectory'],
    })
    if (generation !== documentGeneration || !trustedSender(event)) return { success: false, error: 'invalid_sender' }
    if (canceled || filePaths.length === 0) return { success: false, error: 'canceled' }
    const selected = path.resolve(filePaths[0])
    const root = fs.realpathSync(selected)
    const stat = fs.statSync(root, { bigint: true })
    if (!stat.isDirectory()) return { success: false, error: 'invalid_path' }
    approvedSyncDirectory = { selected, root, dev: stat.dev, ino: stat.ino }
    return { success: true, path: selected }
  } catch (error) { return accessFailure(error, 'read_failed') }
})

ipcMain.handle('read-sync-file', (event, directory: unknown, relativePath: unknown) => {
  if (!trustedSender(event)) return { success: false, error: 'invalid_sender' }
  try {
    const filePath = resolveApprovedSyncPath(directory, relativePath, false)
    if (!fs.existsSync(filePath)) return { success: true, exists: false }
    const stat = fs.statSync(filePath)
    if (!stat.isFile() || stat.size > MAX_SAVE_FILE_SIZE) return { success: false, error: 'invalid_file' }
    return { success: true, exists: true, content: fs.readFileSync(filePath, 'utf-8') }
  } catch (error) { return accessFailure(error, 'read_failed') }
})

ipcMain.handle('write-sync-file', (event, directory: unknown, relativePath: unknown, content: unknown) => {
  if (!trustedSender(event)) return { success: false, error: 'invalid_sender' }
  if (typeof content !== 'string' || Buffer.byteLength(content, 'utf-8') > MAX_SAVE_FILE_SIZE) return { success: false, error: 'content_too_large' }
  try {
    const filePath = resolveApprovedSyncPath(directory, relativePath, true)
    writeFileAtomically(filePath, content, () => {
      if (!trustedSender(event)) throw new FileAccessError('invalid_sender')
      if (resolveApprovedSyncPath(directory, relativePath, false) !== filePath) throw new FileAccessError('invalid_path')
    })
    return { success: true }
  } catch (error) { return accessFailure(error, 'write_failed') }
})

app.on('before-quit', () => localMcp.revoke())

app.whenReady().then(createWindow)

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})
