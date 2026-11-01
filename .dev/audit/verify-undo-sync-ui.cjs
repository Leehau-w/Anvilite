const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict')
const { randomUUID } = require('node:crypto'), { pathToFileURL } = require('node:url')
const { _electron } = require('playwright'), ts = require('typescript')
const root = path.resolve(__dirname, '../..'), output = path.join(__dirname, 'undo-sync-ui-2026-10-30')
fs.mkdirSync(output, { recursive: true })
function translations(lang) {
  const code = ts.transpileModule(fs.readFileSync(path.join(root, 'src/i18n', lang + '.ts'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText
  const module = { exports: {} }; new Function('exports', 'module', code)(module.exports, module); return module.exports[lang]
}
const find = (node, id) => node.id === id ? node : (node.children || []).map(child => find(child, id)).find(Boolean)
;(async () => {
  const checks = []
  for (const [language, width, height] of [['zh', 900, 600], ['en', 1280, 800]]) {
    const t = translations(language), run = path.join(output, language + '-' + randomUUID())
    const profile = path.join(run, 'profile'), bootstrap = path.join(run, 'bootstrap')
    const syncA = path.join(run, 'synthetic-cloud-a'), syncB = path.join(run, 'synthetic-cloud-b')
    for (const directory of [profile, bootstrap, syncA, syncB]) fs.mkdirSync(directory, { recursive: true })
    const nonce = randomUUID(); fs.writeFileSync(path.join(profile, 'synthetic.marker'), nonce)
    fs.writeFileSync(path.join(bootstrap, 'package.json'), JSON.stringify({ name: 'anvilite-undo-sync-audit', version: '1.0.0', main: 'bootstrap.cjs' }))
    fs.writeFileSync(path.join(bootstrap, 'bootstrap.cjs'), [
      "const { app, dialog } = require('electron'), fs = require('node:fs'), path = require('node:path')",
      "const p = process.env.ANVILITE_UNDO_SYNC_PROFILE, n = process.env.ANVILITE_UNDO_SYNC_NONCE",
      "if (!p || !n || fs.readFileSync(path.join(p, 'synthetic.marker'), 'utf8') !== n) throw Error('Synthetic profile required')",
      "app.setPath('userData', p); app.setPath('sessionData', path.join(p, 'session')); app.setAppLogsPath(path.join(p, 'logs')); app.disableHardwareAcceleration()",
      "globalThis.__auditChosen = 0; globalThis.__auditDirectory = process.env.ANVILITE_UNDO_SYNC_DIRECTORY",
      "dialog.showOpenDialog = async () => { globalThis.__auditChosen++; return { canceled: false, filePaths: [globalThis.__auditDirectory] } }",
      "app.on('browser-window-created', (_e, win) => { win.webContents.setBackgroundThrottling(false); win.setOpacity(0); win.setFocusable(false); win.setSkipTaskbar(true); win.show = () => {}; win.showInactive = () => {}; win.focus = () => {}; win.hide(); win.on('show', () => win.hide()) })",
      "import(" + JSON.stringify(pathToFileURL(path.join(root, 'dist-electron/main.js')).href) + ").catch(e => { console.error(e); app.quit() })",
    ].join('\n'))
    let app, page; const errors = []
    const env = { ...process.env, NODE_ENV: 'production', ANVILITE_UNDO_SYNC_PROFILE: profile, ANVILITE_UNDO_SYNC_NONCE: nonce, ANVILITE_UNDO_SYNC_DIRECTORY: syncA }
    delete env.ELECTRON_RUN_AS_NODE; delete env.VITE_DEV_SERVER_URL
    async function launch() {
      app = await _electron.launch({ executablePath: path.join(root, 'node_modules/electron/dist/electron.exe'), args: [bootstrap], cwd: root, env, timeout: 30000 })
      page = await app.firstWindow(); page.setDefaultTimeout(15000); await app.evaluate(({ BrowserWindow }, size) => BrowserWindow.getAllWindows()[0].setContentSize(size.width, size.height), { width, height }); await page.setViewportSize({ width, height })
      page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()) })
      await page.route('**/*', route => route.request().url().startsWith('file:') ? route.continue() : route.abort())
      await ready()
    }
    async function shutdown() {
      if (!app) return
      const closing = app; app = null
      const timer = setTimeout(() => { console.error('Audit cleanup timeout: terminating its own synthetic runtime'); closing.process().kill() }, 10000)
      try { await closing.close() } finally { clearTimeout(timer) }
    }
    const ready = () => page.waitForFunction(async () => !!(await window.electronAPI?.mcpGetStatus?.())?.ready)
    const maps = () => page.evaluate(() => JSON.parse(localStorage.getItem('anvilite-mind-maps')).state.maps)
    const map = async () => (await maps())[0]
    const tasks = () => page.evaluate(() => JSON.parse(localStorage.getItem('anvilite-tasks')).state.tasks)
    const node = id => page.locator('me-tpc[data-nodeid="me' + id + '"]')
    const title = () => page.locator('[data-mindmap-node-title]')
    const center = async () => { await page.getByRole('button', { name: t.mindmap_center, exact: true }).click(); await page.waitForTimeout(300) }
    const select = async id => { await center(); await node(id).click() }
    const settings = async () => { await page.getByTitle(t.topbar_settings, { exact: true }).click(); await page.getByText(t.settings_title, { exact: true }).last().waitFor() }
    async function closeSettings() { await page.getByText(t.settings_title, { exact: true }).last().locator('xpath=..').locator('button').click(); await page.waitForTimeout(250) }
    const write = async () => {
      await page.getByRole('button', { name: t.data_syncSave, exact: true }).evaluate(button => button.click())
      await page.waitForTimeout(150)
      assert.equal(await page.locator('[role="alert"]').count(), 0)
    }
    try {
      await launch(); console.log(language + ': runtime ready')
      await page.evaluate(({ language, width }) => {
        localStorage.clear(); const now = new Date().toISOString()
        const put = (key, state, version = 0) => localStorage.setItem('anvilite-' + key, JSON.stringify({ state, version }))
        put('settings', { settings: { language, theme: width === 900 ? 'dawn-white' : 'forge-purple', unlockedThemes: ['dawn-white', 'forge-purple'] } })
        localStorage.setItem('anvilite-subtask-migration-v3', 'synthetic-current-format'); localStorage.setItem('anvilite-migration-timer-tags-v031', 'synthetic-current-format')
        localStorage.setItem('anvilite-accounts', JSON.stringify([{ id: 'default', name: 'Synthetic A', createdAt: now }, { id: 'b', name: 'Synthetic B', createdAt: now }]))
        put('tasks', { tasks: [{ id: 'task', title: 'Linked task', category: 'work', status: 'waiting', priority: 'high', difficulty: 2, dueDate: null, description: 'Preserved notes', actualMinutes: 37, xpReward: 0, completedAt: null, deletedAt: null, isHidden: false, sortOrder: 0, timerStartedAt: null, timerAccumulated: 0, tags: [], subTasks: [], createdAt: now, updatedAt: now }], lastCategory: 'work', completedViewMode: 'area', customTaskGroups: [] })
        put('mind-maps', { selectedMapId: 'map', maps: [{ id: 'map', title: 'Plan', createdAt: now, updatedAt: now, revision: 0, root: { id: 'root', topic: 'Plan', children: [{ id: 'idea', topic: 'Idea', direction: 1 }, { id: 'linked', topic: 'Linked task', taskId: 'task', direction: 1 }] } }] }, 1)
      }, { language, width })
      await page.reload(); await ready()
      await page.getByRole('button', { name: t.sidebar_mindmap, exact: true }).click(); await node('root').waitFor()
      await select('idea'); const original = (await map()).root, originalTasks = await tasks()
      await page.locator('[data-mindmap-add-child]').click(); assert.equal(find((await map()).root, 'idea').children.length, 1)
      await page.keyboard.press('Control+z'); assert.deepEqual((await map()).root, original)
      await center()
      const bounds = await page.locator('[data-mindmap-canvas] .map-container').boundingBox(), base = await node('root').boundingBox(), box = await node('idea').boundingBox()
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.down(); await page.mouse.move(Math.max(bounds.x + 65, base.x - 75), bounds.y + 60, { steps: 18 }); await page.waitForTimeout(100); await page.mouse.up()
      await page.waitForFunction(() => JSON.parse(localStorage.getItem('anvilite-mind-maps')).state.maps[0].root.children.find(n => n.id === 'idea').direction === 0)
      await center(); await page.keyboard.press('Control+z'); assert.deepEqual((await map()).root, original); assert.deepEqual(await tasks(), originalTasks)
      await select('linked'); await title().fill('Renamed linked task'); await title().press('Enter'); assert.equal((await tasks())[0].title, 'Renamed linked task')
      await center(); await page.keyboard.press('Control+z'); assert.equal((await tasks())[0].title, 'Linked task'); assert.equal((await tasks())[0].actualMinutes, 37); assert.equal((await tasks())[0].status, 'waiting')
      await select('linked'); await page.locator('[data-mindmap-delete-node]').click(); await page.locator('[role="dialog"]').getByRole('button', { name: t.common_delete, exact: true }).click(); await node('linked').waitFor({ state: 'detached' })
      await page.keyboard.press('Control+z'); await node('linked').waitFor(); assert.equal(find((await map()).root, 'linked').taskId, 'task'); assert.equal((await tasks()).length, 1)
      await select('idea'); const revision = (await map()).revision
      await title().fill('Draft title'); await title().press('Control+z'); assert.equal((await map()).revision, revision)
      await title().fill('Idea'); await title().press('Enter'); await center()
      console.log(language + ': graph undo checks passed')
      await settings(); console.log(language + ': first settings opened'); await page.getByRole('button', { name: t.data_syncChooseFolder, exact: true }).evaluate(button => button.click()); await write(); console.log(language + ': first sync written')
      assert.equal(await app.evaluate(() => globalThis.__auditChosen), 1)
      assert.equal(JSON.parse(fs.readFileSync(path.join(syncA, 'anvilite-sync-default.json'), 'utf8')).accountId, 'default')
      await closeSettings(); await page.reload(); await ready(); await settings(); await write(); assert.equal(await app.evaluate(() => globalThis.__auditChosen), 1)
      await shutdown(); console.log(language + ': first runtime closed'); await launch(); console.log(language + ': cold runtime ready'); await settings(); await write(); assert.equal(await app.evaluate(() => globalThis.__auditChosen), 0)
      await closeSettings()
      await page.evaluate(({ syncA, language, width }) => {
        localStorage.setItem('anvilite-current-account', 'b'); localStorage.setItem('anvilite-b-sync-dir', syncA)
        localStorage.setItem('anvilite-b-settings', JSON.stringify({ state: { settings: { language, theme: width === 900 ? 'dawn-white' : 'forge-purple', unlockedThemes: ['dawn-white', 'forge-purple'] } }, version: 0 }))
      }, { syncA, language, width })
      await page.reload(); await ready(); await settings(); assert.ok((await page.locator('[role="alert"]').textContent()).includes(t.data_syncReselectFolder))
      await app.evaluate((_electron, directory) => { globalThis.__auditDirectory = directory }, syncB)
      await page.getByRole('button', { name: t.data_syncChooseFolder, exact: true }).evaluate(button => button.click()); await write(); assert.equal(await app.evaluate(() => globalThis.__auditChosen), 1)
      assert.equal(JSON.parse(fs.readFileSync(path.join(syncB, 'anvilite-sync-b.json'), 'utf8')).accountId, 'b')
      await closeSettings(); await page.evaluate(() => localStorage.setItem('anvilite-current-account', 'default')); await page.reload(); await ready(); await settings(); await write()
      assert.equal(await app.evaluate(() => globalThis.__auditChosen), 1)
      await page.getByRole('button', { name: t.data_syncRefresh, exact: true }).scrollIntoViewIfNeeded(); await page.waitForTimeout(300)
      // Screenshots are taken separately by verify-undo-browser-ui.cjs.
      const grants = JSON.parse(fs.readFileSync(path.join(profile, 'sync-directory-grants.json'), 'utf8')); assert.equal(grants.grants.length, 2)
      assert.deepEqual(errors, []); assert.equal(await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().every(win => !win.isVisible() && !win.isFocused())), true)
      checks.push({ language, width, height, undoAddDragRenameDelete: true, inputUndoPreserved: true, linkedTaskDataPreserved: true, syncReloadAndFullRestart: true, syncAccountIsolation: true, nativeChoices: 'one per account', errors })
      console.log(JSON.stringify(checks.at(-1)))
    } catch (error) { console.error(language + ': native audit failed', error); throw error }
    finally { await shutdown() }
  }
  fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify({ checks, syntheticProfilesOnly: true, installersExecuted: false, visualReport: 'undo-browser-ui-2026-10-30/report.json' }, null, 2))
})().catch(error => { console.error(error); process.exitCode = 1 })
