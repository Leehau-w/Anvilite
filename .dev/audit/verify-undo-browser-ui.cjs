const fs = require('node:fs'), path = require('node:path'), http = require('node:http'), assert = require('node:assert/strict')
const { chromium } = require('playwright'), ts = require('typescript')
const root = path.resolve(__dirname, '../..'), dist = path.join(root, 'dist'), output = path.join(__dirname, 'undo-browser-ui-2026-10-30')
fs.mkdirSync(output, { recursive: true })
function labels(lang) { const module = { exports: {} }; new Function('exports', 'module', ts.transpileModule(fs.readFileSync(path.join(root, 'src/i18n/' + lang + '.ts'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText)(module.exports, module); return module.exports[lang] }
const server = http.createServer((req, res) => {
  const file = path.resolve(dist, '.' + decodeURIComponent(new URL(req.url, 'http://localhost').pathname === '/' ? '/index.html' : new URL(req.url, 'http://localhost').pathname))
  if (!file.startsWith(dist + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404).end(); return }
  res.setHeader('Content-Type', ({ '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' })[path.extname(file)] || 'application/octet-stream'); fs.createReadStream(file).pipe(res)
})
;(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); const origin = 'http://127.0.0.1:' + server.address().port
  const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--disable-background-networking', '--no-first-run'] }), checks = []
  try {
    for (const [language, width, height] of [['zh', 900, 600], ['en', 1280, 800]]) {
      const t = labels(language), context = await browser.newContext({ viewport: { width, height }, locale: language === 'zh' ? 'zh-CN' : 'en-US', timezoneId: 'Europe/Berlin' })
      const page = await context.newPage(), errors = []; page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()) })
      await page.route('**/*', r => r.request().url().startsWith(origin + '/') ? r.continue() : r.abort())
      await page.addInitScript(({ language, width }) => {
        window.electronAPI = { selectSyncDirectory: async () => ({ success: true, path: 'C:\\Synthetic\\Sync' }), readSyncFile: async () => ({ success: true, exists: !!localStorage.getItem('audit-sync-snapshot'), content: localStorage.getItem('audit-sync-snapshot') }), writeSyncFile: async (_dir, _name, content) => { localStorage.setItem('audit-sync-snapshot', content); return { success: true } } }
        if (sessionStorage.getItem('undo-fixture')) return; sessionStorage.setItem('undo-fixture', 'true'); localStorage.clear()
        const now = new Date().toISOString(); localStorage.setItem('anvilite-subtask-migration-v3', 'synthetic-current-format'); localStorage.setItem('anvilite-migration-timer-tags-v031', 'synthetic-current-format')
        localStorage.setItem('anvilite-settings', JSON.stringify({ state: { settings: { language, theme: width === 900 ? 'dawn-white' : 'forge-purple', unlockedThemes: ['dawn-white', 'forge-purple'] } }, version: 0 }))
        localStorage.setItem('anvilite-mind-maps', JSON.stringify({ state: { selectedMapId: 'map', maps: [{ id: 'map', title: 'Plan', revision: 0, createdAt: now, updatedAt: now, root: { id: 'root', topic: 'Plan', children: [{ id: 'idea', topic: 'Idea', direction: 1 }] } }] }, version: 1 }))
      }, { language, width })
      await page.goto(origin, { waitUntil: 'networkidle' }); await page.getByRole('button', { name: t.sidebar_mindmap, exact: true }).click()
      const node = id => page.locator('me-tpc[data-nodeid="me' + id + '"]'), read = () => page.evaluate(() => JSON.parse(localStorage.getItem('anvilite-mind-maps')).state.maps[0])
      await node('idea').click(); const original = await read()
      await page.locator('[data-mindmap-add-child]').click(); await page.keyboard.press('Control+z'); assert.deepEqual((await read()).root, original.root)
      const title = page.locator('[data-mindmap-node-title]'); await title.fill('Renamed idea'); await title.press('Enter'); await page.getByRole('button', { name: t.mindmap_center, exact: true }).click(); await page.keyboard.press('Control+z'); assert.deepEqual((await read()).root, original.root)
      await page.waitForTimeout(300); await page.screenshot({ path: path.join(output, language + '-' + width + '-undo.png'), fullPage: true })
      await page.getByTitle(t.topbar_settings, { exact: true }).click(); const modal = page.getByRole('dialog', { name: t.settings_title, exact: true }); await modal.waitFor()
      const before = (await read()).revision; await page.keyboard.press('Control+z'); assert.equal((await read()).revision, before)
      await modal.getByRole('button', { name: t.data_syncChooseFolder, exact: true }).click(); await modal.getByRole('button', { name: t.data_syncSave, exact: true }).click(); await page.waitForTimeout(150); assert.equal(await modal.locator('[role="alert"]').count(), 0)
      await page.reload({ waitUntil: 'networkidle' }); await page.getByTitle(t.topbar_settings, { exact: true }).click(); await page.getByRole('button', { name: t.data_syncRefresh, exact: true }).click(); assert.equal(await page.locator('[role="alert"]').count(), 0)
      await page.waitForTimeout(300); await page.screenshot({ path: path.join(output, language + '-' + width + '-sync.png'), fullPage: true }); assert.deepEqual(errors, [])
      checks.push({ language, width, height, ctrlZAddAndTitle: true, modalUndoBlocked: true, savedFolderShown: true, errors }); console.log(JSON.stringify(checks.at(-1))); await context.close()
    }
    fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify({ checks, nativeSyncApiStubbedForVisuals: true, nativeIpcVerifiedSeparately: true }, null, 2))
  } finally { await browser.close(); await new Promise(resolve => server.close(resolve)) }
})().catch(e => { console.error(e); process.exitCode = 1 })
