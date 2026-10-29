const fs = require('node:fs')
const path = require('node:path')
const http = require('node:http')
const assert = require('node:assert/strict')
const ts = require('typescript')
const { chromium } = require('playwright')
const root = path.resolve(__dirname, '../..'), dist = path.join(root, 'dist')
const output = path.join(__dirname, 'editor-security-ui-2026-10-29')
fs.mkdirSync(output, { recursive: true })
function translations(language) {
  const source = fs.readFileSync(path.join(root, 'src/i18n', language + '.ts'), 'utf8')
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText
  const module = { exports: {} }; new Function('exports', 'module', compiled)(module.exports, module)
  return module.exports[language]
}
const server = http.createServer((req, res) => {
  const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname)
  const file = path.resolve(dist, '.' + (pathname === '/' ? '/index.html' : pathname))
  if (!file.startsWith(dist + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404).end(); return }
  res.setHeader('Content-Type', ({ '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' })[path.extname(file)] || 'application/octet-stream')
  fs.createReadStream(file).pipe(res)
})
function textOf(doc) { return doc?.type === 'text' ? doc.text : (doc?.content || []).map(textOf).join(' ') }
function allNodes(doc) { return doc ? [doc, ...(doc.content || []).flatMap(allNodes)] : [] }
;(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  const origin = 'http://127.0.0.1:' + server.address().port
  let browser; const checks = []
  try {
    browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--disable-background-networking', '--disable-component-update', '--no-first-run'] })
    for (const { language, width, height, theme } of [{ language: 'zh', width: 900, height: 600, theme: 'dawn-white' }, { language: 'en', width: 1280, height: 800, theme: 'forge-purple' }]) {
      const t = translations(language), context = await browser.newContext({ viewport: { width, height }, locale: language === 'zh' ? 'zh-CN' : 'en-US', timezoneId: 'Europe/Berlin' })
      const page = await context.newPage(); page.setDefaultTimeout(15000)
      const errors = [], externalRequests = []
      page.on('pageerror', error => errors.push(error.message))
      page.on('console', message => { if (message.type() === 'error') errors.push(message.text()) })
      await page.route('**/*', route => {
        if (route.request().url().startsWith(origin + '/')) return route.continue()
        externalRequests.push(route.request().url().split('?')[0]); return route.abort()
      })
      await page.addInitScript(({ language, theme }) => {
        window.__editorAuditExecutions = 0
        if (sessionStorage.getItem('editor-security-seeded')) return
        sessionStorage.setItem('editor-security-seeded', 'true'); localStorage.clear()
        for (const key of ['anvilite-migration-sop-v031', 'anvilite-subtask-migration-v3', 'anvilite-migration-timer-tags-v031']) localStorage.setItem(key, 'synthetic-current-format')
        const put = (key, state, version = 0) => localStorage.setItem('anvilite-' + key, JSON.stringify({ state, version }))
        const now = new Date().toISOString(), paragraph = text => ({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text }] }] })
        put('settings', { settings: { theme, language, unlockedThemes: ['dawn-white', 'forge-purple'], characterName: 'Synthetic editor audit' } })
        put('tasks', { tasks: [], lastCategory: 'home', customTaskGroups: [], completedViewMode: 'area' })
        put('habits', { habits: [], customHabitGroups: [], completedHabitViewMode: 'area' })
        const grandchild = { id: 'grandchild', title: 'Nested third-level step', content: paragraph('Third-level details preserved'), time: null, sortOrder: 0, childSteps: [] }
        const child = { id: 'child', title: 'Nested second-level step', content: { type: 'doc', content: [{ type: 'callout', attrs: { variant: 'info' }, content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Nested rich details preserved', marks: [{ type: 'bold' }] }] }] }] }, time: null, sortOrder: 0, childSteps: [grandchild] }
        const step = { id: 'parent', title: 'First editor step', content: paragraph('Original editable details'), time: null, sortOrder: 0, childSteps: [child] }
        put('sops', { folders: [{ id: 'editor-folder', name: 'Editor audit', parentId: null, sortOrder: 0, isSystem: false, createdAt: now }], sops: [{ id: 'editor-flow', folderId: 'editor-folder', title: 'Editor security audit', steps: [step], displayStyle: 'numbered', isSystem: false, lastUsedAt: null, sortOrder: 0, createdAt: now, updatedAt: now }], selectedSOPId: null, collapsedFolderIds: [], deletedSystemFolderIds: [], deletedSystemSOPIds: [] })
      }, { language, theme })
      const state = () => page.evaluate(() => JSON.parse(localStorage.getItem('anvilite-sops')).state)
      const flow = async () => (await state()).sops.find(item => item.id === 'editor-flow')
      const row = () => page.locator('[data-sop-id="editor-flow"]')
      const editor = () => page.locator('.tiptap[contenteditable="true"]').first()
      const openEditor = async () => {
        await row().click({ button: 'right' })
        await page.locator('[data-sop-context-menu]').getByRole('menuitem', { name: t.sop_contextMenu_edit, exact: true }).click()
        await page.getByText(t.sop_editDetails, { exact: true }).first().click()
        await editor().waitFor()
      }
      const unsafeDOM = () => editor().evaluate(element => [...element.querySelectorAll('*')].flatMap(node => [...node.attributes].filter(attr => /^on/i.test(attr.name) || /^(?:javascript|vbscript|data:text\/html)/i.test(attr.value)).map(attr => ({ tag: node.tagName, name: attr.name, value: attr.value }))))
      try {
        await page.goto(origin, { waitUntil: 'networkidle' })
        await page.getByTitle(t.sidebar_sop, { exact: true }).click()
        const originalChildren = (await flow()).steps[0].childSteps
        await openEditor()
        const words = language === 'zh' ? { ordinary: '中文普通正文', bold: '加粗内容', link: '安全链接', parent: '列表父项', child: '列表子项', paste: '粘贴普通文本', unsafe: '危险链接文本' } : { ordinary: 'Ordinary editor text', bold: 'Bold text', link: 'Safe link', parent: 'Parent list item', child: 'Nested list item', paste: 'Pasted normal text', unsafe: 'Unsafe link label' }
        await editor().click(); await editor().press('Control+A'); await editor().pressSequentially(words.ordinary)
        await editor().press('Enter'); await editor().press('Control+B'); await editor().pressSequentially(words.bold); await editor().press('Control+B')
        await editor().press('Enter'); await editor().pressSequentially(words.link); await editor().press('Home'); await editor().press('Shift+End')
        page.once('dialog', dialog => dialog.accept('https://example.invalid/editor-audit'))
        await page.getByTitle(t.sop_insertLink, { exact: true }).click()
        await editor().locator('a[href="https://example.invalid/editor-audit"]').waitFor()
        await page.waitForTimeout(100)
        await editor().press('Control+End'); await editor().press('Enter'); await editor().pressSequentially(words.parent)
        await page.getByTitle('Bullet List', { exact: true }).click(); await page.waitForTimeout(100); await editor().locator('ul > li > p').last().click(); await editor().press('End'); await editor().press('Enter'); await editor().press('Tab'); await editor().pressSequentially(words.child)
        const safeHtml = await editor().innerHTML()
        fs.writeFileSync(path.join(output, language + '-' + width + '-pre-paste.html'), safeHtml)
        assert.ok(safeHtml.includes('<strong>') && safeHtml.includes('https://example.invalid/editor-audit'))
        assert.equal(await editor().locator('ul ul').count(), 1)
        const attack = '<p>' + words.paste + '</p><img src="data:image/png;base64,invalid" onerror="window.__editorAuditExecutions+=1"><p><a href="javascript:window.__editorAuditExecutions+=1" onclick="window.__editorAuditExecutions+=1">' + words.unsafe + '</a><strong>Kept pasted bold</strong></p>'
        const pasted = await editor().evaluate((element, html) => {
          element.focus(); const data = new DataTransfer(); data.setData('text/html', html); data.setData('text/plain', 'Pasted text')
          const event = new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true })
          element.dispatchEvent(event); return { defaultPrevented: event.defaultPrevented }
        }, attack)
        assert.equal(pasted.defaultPrevented, true, 'Production ProseMirror paste handler should handle the clipboard event')
        await page.waitForTimeout(250)
        assert.equal(await page.evaluate(() => window.__editorAuditExecutions), 0)
        assert.deepEqual(await unsafeDOM(), [])
        assert.equal(await editor().locator('img,script').count(), 0)
        assert.ok((await editor().innerText()).includes(words.paste))
        await page.getByRole('button', { name: t.common_save, exact: true }).first().click()
        await editor().waitFor({ state: 'detached' })
        const saved = await flow(), content = saved.steps[0].content, contentText = textOf(content), nodes = allNodes(content)
        for (const value of Object.values(words)) assert.ok(contentText.includes(value), 'Saved content should contain ' + value)
        assert.ok(nodes.some(node => node.marks?.some(mark => mark.type === 'bold')))
        assert.ok(nodes.some(node => node.marks?.some(mark => mark.type === 'link' && mark.attrs?.href === 'https://example.invalid/editor-audit')))
        assert.ok(nodes.filter(node => node.type === 'bulletList').length >= 2)
        assert.deepEqual(saved.steps[0].childSteps, originalChildren)
        assert.ok(!/onerror|onclick|javascript:|<script/i.test(JSON.stringify(content)))
        assert.equal(await page.evaluate(() => window.__editorAuditExecutions), 0)
        await openEditor()
        assert.deepEqual(await unsafeDOM(), [])
        assert.ok((await editor().innerText()).includes(words.ordinary))
        assert.equal(await editor().locator('ul ul').count(), 1)
        assert.ok(await editor().locator('strong').count() > 0)
        assert.equal(await editor().locator('a[href="https://example.invalid/editor-audit"]').count(), 1)
        await editor().scrollIntoViewIfNeeded(); await page.mouse.move(40, 70); await page.waitForTimeout(350)
        await page.screenshot({ path: path.join(output, language + '-' + width + '-editor.png'), fullPage: true })
        await page.getByRole('button', { name: t.common_cancel, exact: true }).first().click()
        await page.reload({ waitUntil: 'networkidle' }); await page.getByTitle(t.sidebar_sop, { exact: true }).click(); await openEditor()
        assert.deepEqual((await flow()).steps, saved.steps)
        assert.deepEqual(await unsafeDOM(), [])
        assert.equal(await page.evaluate(() => window.__editorAuditExecutions), 0)
        assert.ok((await editor().innerText()).includes(words.ordinary))
        assert.deepEqual(errors, []); assert.deepEqual(externalRequests, [])
        const result = { language, width, height, theme, actualKeyboardEditAndSave: true, plainBoldLinkAndNestedList: true, nestedBusinessStepsPreserved: true, clipboardHandlerInvoked: true, htmlImageAndJavascriptLinkProbe: true, noScriptExecution: true, noExecutableDOMOrSavedAttributes: true, reopenAndColdReload: true, errors, externalRequests }
        checks.push(result); console.log(JSON.stringify(result))
      } catch (error) {
        await page.screenshot({ path: path.join(output, language + '-' + width + '-failure.png'), fullPage: true }).catch(() => {})
        fs.writeFileSync(path.join(output, language + '-' + width + '-failure.json'), JSON.stringify({ error: String(error), errors, externalRequests, body: await page.locator('body').innerText().catch(() => '') }, null, 2))
        throw error
      } finally { await context.close() }
    }
    fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify({ version: require(path.join(root, 'package.json')).version, tiptapVersion: require(path.join(root, 'node_modules/@tiptap/core/package.json')).version, browser: 'Microsoft Edge, isolated headless synthetic contexts', syntheticDataOnly: true, localAssetsOnly: true, upstreamSpecificExploitReproductionClaimed: false, scope: 'Generic HTML paste probes through production ProseMirror handler, not a reproduction of an undisclosed advisory PoC.', checks }, null, 2))
  } finally { if (browser) await browser.close(); await new Promise(resolve => server.close(resolve)) }
})().catch(error => { console.error(error); process.exitCode = 1 })
