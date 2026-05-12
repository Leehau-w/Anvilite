import { app, BrowserWindow, ipcMain, dialog } from 'electron'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const isDev = process.env.NODE_ENV === 'development'
const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL

/** Maximum export file size: 100 MB */
const MAX_SAVE_FILE_SIZE = 100 * 1024 * 1024
const ALLOWED_SAVE_EXTENSIONS = ['.json']

let mainWindow: BrowserWindow | null = null

function getWindow(): BrowserWindow | null {
  return mainWindow
}

function isSafeRelativeJsonPath(relativePath: string): boolean {
  if (!relativePath || path.isAbsolute(relativePath)) return false
  const normalized = path.normalize(relativePath)
  if (normalized.startsWith('..') || path.basename(normalized).startsWith('.')) return false
  return ALLOWED_SAVE_EXTENSIONS.includes(path.extname(normalized).toLowerCase())
}

function resolveSyncPath(dirPath: string, relativePath: string): string | null {
  if (!isSafeRelativeJsonPath(relativePath)) return null
  const base = path.resolve(dirPath)
  const target = path.resolve(base, relativePath)
  if (target !== base && !target.startsWith(base + path.sep)) return null
  return target
}

function createWindow() {
  mainWindow = new BrowserWindow({
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

  if (isDev && VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(VITE_DEV_SERVER_URL)
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

// ── IPC handlers (registered once, outside createWindow) ──────────────────────

ipcMain.on('window-minimize', () => getWindow()?.minimize())
ipcMain.on('window-maximize', () => {
  const win = getWindow()
  if (!win) return
  if (win.isMaximized()) win.unmaximize()
  else win.maximize()
})
ipcMain.on('window-close', () => getWindow()?.close())

// CRIT-02: validate content size and file extension before writing
ipcMain.handle('save-file', async (_event, content: string, defaultName: string) => {
  const win = getWindow()
  if (!win) return { success: false, error: 'no_window' }

  // Size guard
  if (typeof content !== 'string' || Buffer.byteLength(content, 'utf-8') > MAX_SAVE_FILE_SIZE) {
    return { success: false, error: 'content_too_large' }
  }

  const { filePath } = await dialog.showSaveDialog(win, {
    defaultPath: defaultName,
    filters: [{ name: 'JSON', extensions: ['json'] }],
  })

  if (filePath) {
    // Extension whitelist
    const ext = path.extname(filePath).toLowerCase()
    if (!ALLOWED_SAVE_EXTENSIONS.includes(ext)) {
      return { success: false, error: 'invalid_extension' }
    }
    fs.writeFileSync(filePath, content, 'utf-8')
    return { success: true }
  }
  return { success: false }
})

ipcMain.handle('select-sync-directory', async () => {
  const win = getWindow()
  if (!win) return { success: false, error: 'no_window' }
  const { canceled, filePaths } = await dialog.showOpenDialog(win, {
    title: 'Select sync folder',
    properties: ['openDirectory', 'createDirectory'],
  })
  if (canceled || filePaths.length === 0) return { success: false, error: 'canceled' }
  return { success: true, path: filePaths[0] }
})

ipcMain.handle('read-sync-file', async (_event, dirPath: string, relativePath: string) => {
  const filePath = resolveSyncPath(dirPath, relativePath)
  if (!filePath) return { success: false, error: 'invalid_path' }
  if (!fs.existsSync(filePath)) return { success: true, exists: false }
  const stat = fs.statSync(filePath)
  if (!stat.isFile() || stat.size > MAX_SAVE_FILE_SIZE) {
    return { success: false, error: 'invalid_file' }
  }
  return { success: true, exists: true, content: fs.readFileSync(filePath, 'utf-8') }
})

ipcMain.handle('write-sync-file', async (_event, dirPath: string, relativePath: string, content: string) => {
  if (typeof content !== 'string' || Buffer.byteLength(content, 'utf-8') > MAX_SAVE_FILE_SIZE) {
    return { success: false, error: 'content_too_large' }
  }
  const filePath = resolveSyncPath(dirPath, relativePath)
  if (!filePath) return { success: false, error: 'invalid_path' }
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, content, 'utf-8')
  return { success: true }
})

// ── App lifecycle ───────���─────────────────────────────────────────────────────

app.whenReady().then(createWindow)

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})
