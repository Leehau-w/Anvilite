import { beforeAll, beforeEach, afterEach, expect, it, vi } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { pathToFileURL, fileURLToPath } from 'node:url'

const harness = vi.hoisted(() => ({
  handlers: new Map<string, (...args: any[]) => any>(),
  navigation: new Map<string, (...args: any[]) => any>(),
  openDialog: vi.fn(), saveDialog: vi.fn(), win: null as any,
}))
vi.mock('electron', () => ({
  app: { whenReady: () => Promise.resolve(), on: vi.fn(), isPackaged: false },
  BrowserWindow: class {
    webContents = {
      send: vi.fn(), mainFrame: { url: '' }, getURL: () => this.webContents.mainFrame.url,
      setWindowOpenHandler: vi.fn(), openDevTools: vi.fn(),
      on: (name: string, callback: (...args: any[]) => any) => harness.navigation.set(name, callback),
    }
    constructor() { harness.win = this }
    isDestroyed = () => false
    on = vi.fn()
    loadFile = (value: string) => { this.webContents.mainFrame.url = pathToFileURL(value).href }
    loadURL = (value: string) => { this.webContents.mainFrame.url = value }
    static getAllWindows() { return [harness.win] }
  },
  ipcMain: { on: vi.fn(), handle: (channel: string, handler: (...args: any[]) => any) => harness.handlers.set(channel, handler) },
  dialog: { showOpenDialog: harness.openDialog, showSaveDialog: harness.saveDialog },
}))

let temporaryRoot: string
let selected: string
let target: string
const renderer = pathToFileURL(fileURLToPath(new URL('../../dist/index.html', import.meta.url))).href
const call = (name: string, ...args: unknown[]) => harness.handlers.get(name)!(
  { sender: harness.win.webContents, senderFrame: harness.win.webContents.mainFrame }, ...args,
)

beforeAll(async () => { await import('../../electron/main'); await Promise.resolve() })
beforeEach(async () => {
  temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'anvilite-legacy-file-regression-'))
  selected = path.join(temporaryRoot, 'approved')
  fs.mkdirSync(selected)
  target = path.join(selected, 'snapshot.json')
  fs.writeFileSync(target, '{"original":true}')
  harness.win.webContents.mainFrame.url = renderer
  harness.navigation.get('did-start-navigation')!({}, renderer, false, true)
  harness.openDialog.mockResolvedValue({ canceled: false, filePaths: [selected] })
  expect(await call('select-sync-directory')).toMatchObject({ success: true })
})
afterEach(() => {
  vi.restoreAllMocks()
  // Only this test's fresh mkdtemp tree is eligible for cleanup.
  const parent = path.resolve(os.tmpdir())
  const actual = path.resolve(temporaryRoot)
  if (path.dirname(actual) !== parent || !path.basename(actual).startsWith('anvilite-legacy-file-regression-')) {
    throw new Error('Unexpected test cleanup target')
  }
  fs.rmSync(actual, { recursive: true, force: true })
})

it('replaces a real synthetic snapshot only after the complete content is written', async () => {
  expect(await call('write-sync-file', selected, 'snapshot.json', '{"new":true}')).toEqual({ success: true })
  expect(fs.readFileSync(target, 'utf-8')).toBe('{"new":true}')
  expect(fs.readdirSync(selected)).toEqual(['snapshot.json'])
})

it('preserves a real old snapshot when writing the temporary file fails midway', async () => {
  const actualWrite = fs.writeFileSync.bind(fs)
  vi.spyOn(fs, 'writeFileSync').mockImplementationOnce((file) => {
    actualWrite(file, 'partial')
    throw new Error('ENOSPC: synthetic failure')
  })
  expect(await call('write-sync-file', selected, 'snapshot.json', '{"new":true}')).toMatchObject({ error: 'write_failed' })
  expect(fs.readFileSync(target, 'utf-8')).toBe('{"original":true}')
  expect(fs.readdirSync(selected)).toEqual(['snapshot.json'])
})

it('preserves a real old snapshot when rename fails', async () => {
  vi.spyOn(fs, 'renameSync').mockImplementationOnce(() => { throw new Error('EACCES: synthetic failure') })
  expect(await call('write-sync-file', selected, 'snapshot.json', '{"new":true}')).toMatchObject({ error: 'write_failed' })
  expect(fs.readFileSync(target, 'utf-8')).toBe('{"original":true}')
  expect(fs.readdirSync(selected)).toEqual(['snapshot.json'])
})

it('rejects a real directory junction escaping the selected root', async () => {
  const outside = path.join(temporaryRoot, 'outside')
  fs.mkdirSync(outside)
  const protectedFile = path.join(outside, 'protected.json')
  fs.writeFileSync(protectedFile, '{"keep":true}')
  fs.symlinkSync(outside, path.join(selected, 'escape'), process.platform === 'win32' ? 'junction' : 'dir')
  expect(await call('write-sync-file', selected, 'escape/protected.json', '{}')).toMatchObject({ error: 'invalid_path' })
  expect(await call('read-sync-file', selected, 'escape/protected.json')).toMatchObject({ error: 'invalid_path' })
  expect(fs.readFileSync(protectedFile, 'utf-8')).toBe('{"keep":true}')
})

it('rejects a real replaced directory identity', async () => {
  fs.renameSync(selected, path.join(temporaryRoot, 'retired'))
  fs.mkdirSync(selected)
  fs.writeFileSync(target, '{"other":true}')
  expect(await call('write-sync-file', selected, 'snapshot.json', '{}')).toMatchObject({ error: 'directory_not_authorized' })
  expect(fs.readFileSync(target, 'utf-8')).toBe('{"other":true}')
})
