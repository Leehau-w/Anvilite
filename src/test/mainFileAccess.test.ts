import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import path from 'node:path'
import { pathToFileURL, fileURLToPath } from 'node:url'

const harness = vi.hoisted(() => ({
  handlers: new Map<string, (...args: any[]) => any>(),
  windowEvents: new Map<string, (...args: any[]) => any>(),
  navigationEvents: new Map<string, (...args: any[]) => any>(),
  files: new Map<string, string>(),
  directories: new Set<string>(),
  symlinks: new Set<string>(),
  realpaths: new Map<string, string>(),
  inode: 10n,
  writeFailure: false,
  renameFailure: false,
  writeHook: undefined as (() => void) | undefined,
  openDialog: vi.fn(), saveDialog: vi.fn(),
  win: null as any,
}))

vi.mock('electron', () => ({
  app: { whenReady: () => Promise.resolve(), on: vi.fn(), isPackaged: false, getPath: () => path.resolve('C:/synthetic-user-data') },
  BrowserWindow: class {
    webContents = {
      send: vi.fn(), mainFrame: { url: '' }, getURL: () => this.webContents.mainFrame.url,
      setWindowOpenHandler: vi.fn(),
      on: (name: string, callback: (...args: any[]) => any) => harness.navigationEvents.set(name, callback),
      openDevTools: vi.fn(),
    }
    constructor() { harness.win = this }
    isDestroyed = () => false
    on = (name: string, callback: (...args: any[]) => any) => harness.windowEvents.set(name, callback)
    loadFile = (value: string) => { this.webContents.mainFrame.url = pathToFileURL(value).href }
    loadURL = (value: string) => { this.webContents.mainFrame.url = value }
    minimize = vi.fn(); maximize = vi.fn(); unmaximize = vi.fn(); close = vi.fn()
    isMaximized = () => false
    static getAllWindows() { return [harness.win] }
  },
  ipcMain: {
    on: (channel: string, handler: (...args: any[]) => any) => harness.handlers.set(channel, handler),
    handle: (channel: string, handler: (...args: any[]) => any) => harness.handlers.set(channel, handler),
  },
  dialog: { showOpenDialog: harness.openDialog, showSaveDialog: harness.saveDialog },
}))
vi.mock('fs', () => {
  const stat = (value: string) => {
    if (!harness.directories.has(value) && !harness.files.has(value) && !harness.symlinks.has(value)) throw new Error('ENOENT')
    return {
      dev: 1n, ino: harness.inode,
      isDirectory: () => harness.directories.has(value),
      isFile: () => harness.files.has(value),
      isSymbolicLink: () => harness.symlinks.has(value),
      size: Buffer.byteLength(harness.files.get(value) ?? ''),
    }
  }
  return { default: {
    existsSync: (value: string) => harness.directories.has(value) || harness.files.has(value) || harness.symlinks.has(value),
    statSync: stat, lstatSync: stat,
    realpathSync: (value: string) => harness.realpaths.get(value) ?? value,
    mkdirSync: (value: string) => harness.directories.add(value),
    readFileSync: (value: string) => {
      if (!harness.files.has(value)) throw new Error('ENOENT')
      return harness.files.get(value)
    },
    writeFileSync: (value: string, content: string) => {
      harness.files.set(value, harness.writeFailure ? 'partial' : content)
      harness.writeHook?.()
      if (harness.writeFailure) throw new Error('ENOSPC')
    },
    renameSync: (from: string, to: string) => {
      if (harness.renameFailure) throw new Error('EACCES')
      harness.files.set(to, harness.files.get(from)!)
      harness.files.delete(from)
    },
    unlinkSync: (value: string) => { harness.files.delete(value) },
  } }
})

const root = path.resolve('C:/synthetic-approved')
const target = path.join(root, 'snapshot.json')
const grantFile = path.resolve('C:/synthetic-user-data/sync-directory-grants.json')
const snapshotFiles = () => [...harness.files.entries()].filter(([name]) => name !== grantFile)
const renderer = pathToFileURL(fileURLToPath(new URL('../../dist/index.html', import.meta.url))).href
const event = () => ({ sender: harness.win.webContents, senderFrame: harness.win.webContents.mainFrame })
const call = (channel: string, ...args: any[]) => harness.handlers.get(channel)!(event(), ...args)
async function approve() {
  harness.openDialog.mockResolvedValue({ canceled: false, filePaths: [root] })
  expect(await call('select-sync-directory')).toEqual({ success: true, path: root })
}

beforeAll(async () => { await import('../../electron/main'); await Promise.resolve() })
beforeEach(() => {
  harness.files.clear(); harness.directories.clear(); harness.symlinks.clear(); harness.realpaths.clear()
  harness.directories.add(root)
  harness.directories.add(path.dirname(grantFile))
  harness.files.set(target, '{"original":true}')
  harness.writeFailure = false; harness.renameFailure = false; harness.writeHook = undefined; harness.inode = 10n
  harness.win.webContents.mainFrame.url = renderer
  harness.navigationEvents.get('did-start-navigation')!({}, renderer, false, true)
  vi.clearAllMocks()
})

describe('native file authorization and replacement regression', () => {
  it('rejects unrelated senders, subframes and foreign documents before file access', async () => {
    const handler = harness.handlers.get('read-sync-file')!
    expect(await handler({ sender: {}, senderFrame: {} }, root, 'snapshot.json')).toMatchObject({ error: 'invalid_sender' })
    expect(await handler({ sender: harness.win.webContents, senderFrame: { url: renderer } }, root, 'snapshot.json')).toMatchObject({ error: 'invalid_sender' })
    harness.win.webContents.mainFrame.url = 'https://untrusted.invalid/'
    expect(await call('read-sync-file', root, 'snapshot.json')).toMatchObject({ error: 'invalid_sender' })
  })

  it('remembers native directory approval across document reloads', async () => {
    expect(await call('read-sync-file', root, 'snapshot.json')).toMatchObject({ error: 'directory_not_authorized' })
    await approve()
    expect(await call('read-sync-file', root, 'snapshot.json')).toEqual({ success: true, exists: true, content: '{"original":true}' })
    harness.navigationEvents.get('did-start-navigation')!({}, renderer, false, true)
    expect(await call('write-sync-file', root, 'snapshot.json', '{}')).toEqual({ success: true })
    expect(harness.files.get(target)).toBe('{}')
  })

  it('rejects a different root and traversal even after approval', async () => {
    await approve()
    expect(await call('write-sync-file', path.resolve('C:/unselected'), 'snapshot.json', '{}')).toMatchObject({ error: 'directory_not_authorized' })
    for (const relative of ['../outside.json', path.resolve('C:/outside.json'), 'snapshot.txt', '']) {
      expect(await call('write-sync-file', root, relative, '{}')).toMatchObject({ error: 'invalid_path' })
    }
    expect(harness.files.get(target)).toBe('{"original":true}')
  })

  it('rejects a replaced approved directory, symbolic subdirectory and symbolic file', async () => {
    await approve()
    harness.inode = 11n
    expect(await call('read-sync-file', root, 'snapshot.json')).toMatchObject({ error: 'directory_not_authorized' })
    harness.inode = 10n
    await approve()
    const subdirectory = path.join(root, 'escape')
    harness.directories.add(subdirectory); harness.symlinks.add(subdirectory)
    expect(await call('write-sync-file', root, 'escape/snapshot.json', '{}')).toMatchObject({ error: 'invalid_path' })
    harness.symlinks.add(target)
    expect(await call('read-sync-file', root, 'snapshot.json')).toMatchObject({ error: 'invalid_file' })
  })

  it('keeps the old snapshot on partial write failure and allows a successful retry', async () => {
    await approve()
    harness.writeFailure = true
    expect(await call('write-sync-file', root, 'snapshot.json', '{"new":true}')).toMatchObject({ error: 'write_failed' })
    expect(snapshotFiles()).toEqual([[target, '{"original":true}']])
    harness.writeFailure = false
    expect(await call('write-sync-file', root, 'snapshot.json', '{"new":true}')).toEqual({ success: true })
    expect(snapshotFiles()).toEqual([[target, '{"new":true}']])
  })

  it('preserves the original snapshot if replacing the file fails', async () => {
    await approve(); harness.renameFailure = true
    expect(await call('write-sync-file', root, 'snapshot.json', '{}')).toMatchObject({ error: 'write_failed' })
    expect(snapshotFiles()).toEqual([[target, '{"original":true}']])
  })

  it('rechecks the directory grant before replacing the snapshot', async () => {
    await approve()
    harness.writeHook = () => harness.navigationEvents.get('did-start-navigation')!({}, renderer, false, true)
    expect(await call('write-sync-file', root, 'snapshot.json', '{}')).toMatchObject({ error: 'invalid_sender' })
    expect(snapshotFiles()).toEqual([[target, '{"original":true}']])
  })

  it('only creates backup directories below the approved root', async () => {
    await approve()
    expect(await call('write-sync-file', root, 'backups/before-restore.json', '{"backup":true}')).toEqual({ success: true })
    expect(harness.files.get(path.join(root, 'backups', 'before-restore.json'))).toBe('{"backup":true}')
    expect(await call('read-sync-file', root, 'absent.json')).toEqual({ success: true, exists: false })
  })

  it('reports save cancellation and write failure without destroying the existing backup', async () => {
    harness.saveDialog.mockResolvedValue({ canceled: true })
    expect(await call('save-file', '{}', 'snapshot.json')).toEqual({ success: false, canceled: true })
    harness.saveDialog.mockResolvedValue({ canceled: false, filePath: target })
    harness.writeFailure = true
    expect(await call('save-file', '{}', 'snapshot.json')).toMatchObject({ error: 'write_failed' })
    expect(harness.files.get(target)).toBe('{"original":true}')
  })

  it('supports an explicitly selected drive root', async () => {
    const driveRoot = path.parse(root).root
    harness.directories.add(driveRoot)
    harness.openDialog.mockResolvedValue({ canceled: false, filePaths: [driveRoot] })
    expect(await call('select-sync-directory')).toMatchObject({ success: true })
    expect(await call('write-sync-file', driveRoot, 'drive-snapshot.json', '{}')).toEqual({ success: true })
  })

  it('rejects a same-URL reload while a native dialog is pending', async () => {
    harness.openDialog.mockImplementation(async () => {
      harness.navigationEvents.get('did-start-navigation')!({}, renderer, false, true)
      return { canceled: false, filePaths: [root] }
    })
    expect(await call('select-sync-directory')).toMatchObject({ error: 'invalid_sender' })
    expect(await call('read-sync-file', root, 'snapshot.json')).toMatchObject({ error: 'directory_not_authorized' })
  })

  it('rejects a saved-directory alias whose real target changed', async () => {
    await approve()
    harness.realpaths.set(root, path.resolve('C:/another-root'))
    expect(await call('read-sync-file', root, 'snapshot.json')).toMatchObject({ error: 'directory_not_authorized' })
    expect(harness.files.get(target)).toBe('{"original":true}')
  })

  it('rejects save after a same-URL reload while the native dialog was pending', async () => {
    harness.saveDialog.mockImplementation(async () => {
      harness.navigationEvents.get('did-start-navigation')!({}, renderer, false, true)
      return { canceled: false, filePath: target }
    })
    expect(await call('save-file', '{}', 'snapshot.json')).toMatchObject({ error: 'invalid_sender' })
    expect(harness.files.get(target)).toBe('{"original":true}')
  })
  it('does not grant a directory selected by a document that navigated while its dialog was open', async () => {
    harness.openDialog.mockImplementation(async () => {
      harness.win.webContents.mainFrame.url = 'https://untrusted.invalid/'
      return { canceled: false, filePaths: [root] }
    })
    expect(await call('select-sync-directory')).toMatchObject({ error: 'invalid_sender' })
    harness.win.webContents.mainFrame.url = renderer
    expect(await call('read-sync-file', root, 'snapshot.json')).toMatchObject({ error: 'directory_not_authorized' })
  })
})


it('restores a native grant after a fresh main-process module starts', async () => {
  await approve()
  const stored = harness.files.get(grantFile)
  expect(JSON.parse(stored!).grants[0].accountId).toBe('default')
  vi.resetModules(); await import('../../electron/main'); await Promise.resolve()
  expect(await call('read-sync-file', root, 'snapshot.json')).toMatchObject({ success: true, exists: true })
  expect(harness.openDialog).toHaveBeenCalledOnce()
})

it('keeps independent directory grants per account and rejects a forged preference', async () => {
  await approve()
  expect(await call('read-sync-file', root, 'snapshot.json', 'other-account')).toMatchObject({ error: 'directory_not_authorized' })
  const other = path.resolve('C:/synthetic-other-account')
  harness.directories.add(other)
  harness.openDialog.mockResolvedValue({ canceled: false, filePaths: [other] })
  expect(await call('select-sync-directory', 'other-account')).toMatchObject({ success: true })
  harness.navigationEvents.get('did-start-navigation')!({}, renderer, false, true)
  expect(await call('read-sync-file', root, 'snapshot.json', 'default')).toMatchObject({ success: true })
  expect(await call('read-sync-file', root, 'snapshot.json', 'other-account')).toMatchObject({ error: 'directory_not_authorized' })
  expect(await call('write-sync-file', other, 'snapshot.json', '{}', 'other-account')).toMatchObject({ success: true })
  expect(JSON.parse(harness.files.get(grantFile)!).grants).toHaveLength(2)
})

it('does not silently approve a corrupted or symbolic native grant file', async () => {
  await approve()
  harness.files.set(grantFile, '{invalid')
  harness.navigationEvents.get('did-start-navigation')!({}, renderer, false, true)
  expect(await call('read-sync-file', root, 'snapshot.json')).toMatchObject({ error: 'directory_not_authorized' })
  await approve()
  harness.symlinks.add(grantFile)
  harness.navigationEvents.get('did-start-navigation')!({}, renderer, false, true)
  expect(await call('read-sync-file', root, 'snapshot.json')).toMatchObject({ error: 'directory_not_authorized' })
})

it('does not report a successful directory choice when persisting its grant fails', async () => {
  harness.writeFailure = true
  harness.openDialog.mockResolvedValue({ canceled: false, filePaths: [root] })
  expect(await call('select-sync-directory')).toMatchObject({ success: false })
  expect(harness.files.has(grantFile)).toBe(false)
  expect(await call('read-sync-file', root, 'snapshot.json')).toMatchObject({ error: 'directory_not_authorized' })
})

it('protects the native authorization file even if its containing folder was explicitly selected', async () => {
  const profile = path.dirname(grantFile)
  harness.openDialog.mockResolvedValue({ canceled: false, filePaths: [profile] })
  expect(await call('select-sync-directory')).toMatchObject({ success: true })
  const original = harness.files.get(grantFile)
  expect(await call('write-sync-file', profile, path.basename(grantFile), '{"version":1,"grants":[]}')).toMatchObject({ error: 'invalid_path' })
  expect(await call('read-sync-file', profile, path.basename(grantFile))).toMatchObject({ error: 'invalid_path' })
  expect(harness.files.get(grantFile)).toBe(original)
})
