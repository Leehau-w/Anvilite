const { app, BrowserWindow } = require('electron')
const fs = require('node:fs')
const path = require('node:path')
const { pathToFileURL } = require('node:url')
const root = path.resolve(__dirname, '../..')
const profile = path.join(app.getPath('temp'), 'Anvilite-legacy-review-preview')
const statusFile = path.join(__dirname, 'native-preview.status.local')
fs.mkdirSync(profile, { recursive: true })
app.setPath('userData', profile)
app.setPath('sessionData', path.join(profile, 'session'))
app.setName('Anvilite Preview')
process.chdir(root)
function status(value) {
  fs.writeFileSync(statusFile, JSON.stringify({ pid: process.pid, profile, ...value }, null, 2))
}
status({ state: 'starting' })
app.on('browser-window-created', (_event, win) => {
  win.webContents.on('did-fail-load', (_event, code, description) => status({ state: 'failed', code, description }))
  win.webContents.on('render-process-gone', (_event, details) => status({ state: 'renderer-exited', reason: details.reason }))
  win.webContents.once('did-finish-load', async () => {
    try {
      const view = await win.webContents.executeJavaScript(`({
        dashboard: !!document.querySelector('[data-dashboard-card="tasks"]'),
        waiting: !!document.querySelector('[data-dashboard-card="waiting"]'),
        categoryChoice: !!document.querySelector('select[aria-label="分类"]'),
        cards: document.querySelectorAll('[data-dashboard-card]').length
      })`)
      win.setTitle('Anvilite 测试版 · legacy-review')
      win.show()
      win.focus()
      status({ state: 'ready', visible: win.isVisible(), url: win.webContents.getURL(), view })
    } catch (error) { status({ state: 'check-failed', message: error.message }) }
  })
  win.on('closed', () => status({ state: 'closed' }))
})
import(pathToFileURL(path.join(root, 'dist-electron/main.js')).href)
  .catch(error => { status({ state: 'failed', message: error.message }); app.quit() })
