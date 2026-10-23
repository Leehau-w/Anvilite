const fs = require('node:fs')
const path = require('node:path')
const http = require('node:http')
const assert = require('node:assert/strict')
const { chromium } = require('playwright')
const root = path.resolve(__dirname, '../..')
const dist = path.join(root, 'dist')
const output = path.join(__dirname, 'mindmap-ui-2026-10-23')
fs.mkdirSync(output, { recursive: true })
const server = http.createServer((req, res) => {
  const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname)
  const file = path.resolve(dist, '.' + (pathname === '/' ? '/index.html' : pathname))
  if (!file.startsWith(dist + path.sep) || !fs.existsSync(file)) { res.writeHead(404).end(); return }
  res.setHeader('Content-Type', ({ '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' })[path.extname(file)] || 'application/octet-stream')
  fs.createReadStream(file).pipe(res)
})
;(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  const origin = 'http://127.0.0.1:' + server.address().port
  let browser, lastPage
  const checks = []
  try {
    browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--disable-background-networking', '--disable-component-update', '--no-first-run'] })
    for (const language of ['zh', 'en']) for (const [width, height] of [[900, 600], [1280, 800]]) {
      const context = await browser.newContext({ viewport: { width, height }, locale: language === 'zh' ? 'zh-CN' : 'en-US', timezoneId: 'Europe/Berlin' })
      const page = lastPage = await context.newPage()
      const errors = []
      page.on('pageerror', error => errors.push(error.message))
      page.on('console', message => { if (message.type() === 'error') errors.push(message.text()) })
      await page.route('**/*', route => route.request().url().startsWith(origin + '/') ? route.continue() : route.abort())
      const labels = language === 'zh' ? {
        nav: '思维导图', save: '保存', collapse: '折叠', expand: '展开', zoomOut: '缩小', center: '居中',
        openTask: '打开任务', link: '关联已有任务', unlink: '解除关联', newMap: '新建导图', rename: '重命名', deleteMap: '删除导图',
        remove: '删除', waiting: '待反馈', done: '已完成', newName: '旅行安排', renameName: '旅行计划',
        settings: '设置', export: '导出数据', confirmImport: '确认导入',
      } : {
        nav: 'Mind maps', save: 'Save', collapse: 'Collapse', expand: 'Expand', zoomOut: 'Zoom out', center: 'Center',
        openTask: 'Open task', link: 'Link existing task', unlink: 'Unlink', newMap: 'New map', rename: 'Rename', deleteMap: 'Delete map',
        remove: 'Delete', waiting: 'Awaiting Feedback', done: 'Completed', newName: 'Travel outline', renameName: 'Travel plan',
        settings: 'Settings', export: 'Export Data', confirmImport: 'Confirm Import',
      }
      await page.addInitScript(({ language, width }) => {
        window.electronAPI = { saveFile: async content => { window.__mindMapExport = content; return { success: true } } }
        if (sessionStorage.getItem('mindmap-seeded')) return
        sessionStorage.setItem('mindmap-seeded', 'true'); localStorage.clear()
        localStorage.setItem('anvilite-subtask-migration-v3', 'synthetic-current-format')
        localStorage.setItem('anvilite-migration-timer-tags-v031', 'synthetic-current-format')
        localStorage.setItem('anvilite-settings', JSON.stringify({ state: { settings: {
          theme: width === 900 ? 'dawn-white' : 'forge-purple', language, unlockedThemes: ['dawn-white', 'forge-purple'],
          characterName: 'Synthetic', dashboardLayout: [],
        } }, version: 0 }))
        const now = '2026-10-23T10:00:00.000Z'
        const makeTask = (id, title, status) => ({ id, title, status, category: 'home', priority: 'medium', difficulty: 2,
          description: 'Synthetic task notes', dueDate: null, actualMinutes: 20, xpReward: 0, completedAt: null,
          deletedAt: null, isHidden: false, timerStartedAt: null, timerAccumulated: 0, tags: ['synthetic'], sortOrder: 0,
          subTasks: [], createdAt: now, updatedAt: now })
        localStorage.setItem('anvilite-tasks', JSON.stringify({ state: { tasks: [
          makeTask('mail', language === 'zh' ? '等待合作方回信' : 'Await partner reply', 'waiting'),
          makeTask('existing', language === 'zh' ? '已经存在的任务' : 'An existing task', 'todo'),
        ], lastCategory: 'home', completedViewMode: 'area', customTaskGroups: [] }, version: 0 }))
        localStorage.setItem('anvilite-mind-maps', JSON.stringify({ state: { selectedMapId: 'map-one', maps: [
          { id: 'map-one', title: language === 'zh' ? '研究计划' : 'Research', createdAt: now, updatedAt: now, revision: 0,
            root: { id: 'root', topic: language === 'zh' ? '研究计划' : 'Research', expanded: true, children: [
              { id: 'a', topic: language === 'zh' ? '材料' : 'Materials', direction: 1, expanded: true,
                children: [{ id: 'a1', topic: language === 'zh' ? '阅读笔记' : 'Reading notes' }] },
              { id: 'b', topic: language === 'zh' ? '外部反馈' : 'Feedback', direction: 1, taskId: 'mail' },
              { id: 'c', topic: language === 'zh' ? '新思路' : 'New idea', direction: 0 },
            ] } },
          { id: 'map-two', title: language === 'zh' ? '其他想法' : 'Other ideas', createdAt: now, updatedAt: now, revision: 0,
            root: { id: 'root-two', topic: language === 'zh' ? '其他想法' : 'Other ideas', children: [] } },
        ] }, version: 1 }))
      }, { language, width })
      const maps = () => page.evaluate(() => JSON.parse(localStorage.getItem('anvilite-mind-maps')).state)
      const tasks = () => page.evaluate(() => JSON.parse(localStorage.getItem('anvilite-tasks')).state.tasks)
      const node = id => page.locator('me-tpc[data-nodeid="me' + id + '"]')
      const select = async id => { await node(id).click(); await page.waitForTimeout(30) }
      const editTitle = async title => { await page.locator('[data-mindmap-node-title]').fill(title); await page.locator('.mindmap-inspector form button[type="submit"]').click() }
      const find = (root, id) => root.id === id ? root : (root.children || []).map(n => find(n, id)).find(Boolean)
      const assertCanvasFit = async () => {
        const visible = await page.locator('[data-mindmap-canvas]').evaluate(canvas => {
          const frame = canvas.getBoundingClientRect()
          return [...canvas.querySelectorAll('me-tpc')].every(node => {
            const rect = node.getBoundingClientRect()
            return rect.left >= frame.left - 2 && rect.right <= frame.right + 2 && rect.top >= frame.top - 2 && rect.bottom <= frame.bottom + 2
          })
        })
        assert.equal(visible, true, 'Opening and centering should fit all visible nodes')
      }
      await page.goto(origin, { waitUntil: 'networkidle' })
      await page.getByRole('button', { name: labels.nav, exact: true }).click()
      await page.locator('[data-mindmap-canvas] me-tpc').first().waitFor()
      await assertCanvasFit()
      await page.getByRole('button', { name: labels.zoomOut, exact: true }).click()
      const originalTasks = await tasks()
      await select('a')
      await page.getByRole('button', { name: labels.collapse, exact: true }).click()
      assert.equal(find((await maps()).maps[0].root, 'a').expanded, false)
      assert.equal(await node('a1').count(), 0)
      await page.getByRole('button', { name: labels.expand, exact: true }).click()
      await node('a1').waitFor()
      // Real pointer movement exercises the library's branch drag behavior.
      await node('c').dragTo(node('a'), { targetPosition: { x: 35, y: 18 } })
      await page.waitForFunction(() => {
        const root = JSON.parse(localStorage.getItem('anvilite-mind-maps')).state.maps[0].root
        return root.children.find(n => n.id === 'a').children.some(n => n.id === 'c')
      })
      assert.deepEqual(await tasks(), originalTasks)
      await select('b')
      await page.locator('[data-mindmap-task-status="waiting"]').waitFor()
      assert.ok((await node('b').textContent()).includes(labels.waiting))
      await page.locator('.mindmap-inspector [data-task-id="mail"] button:not([draggable])').first().click()
      await page.waitForFunction(() => JSON.parse(localStorage.getItem('anvilite-tasks')).state.tasks.find(t => t.id === 'mail').status === 'done')
      await page.locator('[data-mindmap-task-status="done"]').waitFor()
      await page.waitForTimeout(400) // Let the original task completion interaction finish before undo.
      await page.locator('.mindmap-inspector [data-task-id="mail"] button').first().click()
      await page.locator('[data-mindmap-task-status="waiting"]').waitFor()
      await page.getByRole('button', { name: labels.openTask, exact: true }).click()
      const drawerForm = page.locator('form').filter({ has: page.locator('input') }).last()
      await drawerForm.locator('input').first().fill(language === 'zh' ? '更新后的回信任务' : 'Updated reply task')
      await drawerForm.evaluate(form => form.requestSubmit())
      await page.waitForFunction(() => JSON.parse(localStorage.getItem('anvilite-tasks')).state.tasks.find(t => t.id === 'mail').title.includes('Updated') || JSON.parse(localStorage.getItem('anvilite-tasks')).state.tasks.find(t => t.id === 'mail').title.includes('更新'))
      await select('a1')
      await page.locator('[data-mindmap-link]').click()
      await page.locator('.mindmap-task-picker input').fill(language === 'zh' ? '已经存在' : 'existing')
      await page.locator('[data-mindmap-link-task="existing"]').click()
      assert.equal(find((await maps()).maps[0].root, 'a1').taskId, 'existing')
      await page.getByRole('button', { name: labels.unlink, exact: true }).click()
      assert.equal(find((await maps()).maps[0].root, 'a1').taskId, undefined)
      await select('c')
      await page.locator('[data-mindmap-convert]').evaluate(button => { button.click(); button.click() })
      const createdId = find((await maps()).maps[0].root, 'c').taskId
      assert.ok(createdId)
      assert.equal((await tasks()).length, originalTasks.length + 1)
      await page.locator('[data-mindmap-id="map-two"]').click()
      await select('root-two')
      await page.locator('[data-mindmap-link]').click()
      await page.locator('[data-mindmap-link-task="mail"]').click()
      assert.equal((await maps()).maps[1].root.taskId, 'mail')
      await page.locator('[data-mindmap-id="map-one"]').click()
      await select('c')
      await page.locator('[data-mindmap-delete-node]').click()
      await page.getByRole('dialog').getByRole('button', { name: labels.remove, exact: true }).click()
      assert.equal(find((await maps()).maps[0].root, 'c'), undefined)
      assert.ok((await tasks()).some(t => t.id === createdId && !t.deletedAt))
      // Plain HTML-like text must stay text in the third-party renderer.
      await select('a1')
      await editTitle('<img src=x onerror="window.__mindmapUnsafe=1">')
      assert.equal(await node('a1').locator('img').count(), 0)
      assert.equal(await page.evaluate(() => window.__mindmapUnsafe), undefined)
      await editTitle(language === 'zh' ? '整理阅读笔记' : 'Organize reading notes')
      await page.locator('[data-mindmap-new]').click()
      await page.locator('[data-mindmap-name]').fill(labels.newName)
      await page.getByRole('dialog').getByRole('button', { name: labels.save, exact: true }).click()
      assert.equal((await maps()).maps.length, 3)
      await page.getByRole('button', { name: labels.rename, exact: true }).click()
      await page.locator('[data-mindmap-name]').fill(labels.renameName)
      await page.getByRole('dialog').getByRole('button', { name: labels.save, exact: true }).click()
      assert.equal((await maps()).maps[2].root.topic, labels.renameName)
      await page.getByRole('button', { name: labels.deleteMap, exact: true }).click()
      await page.getByRole('dialog').getByRole('button', { name: labels.remove, exact: true }).click()
      assert.equal((await maps()).maps.length, 2)
      await page.locator('[data-mindmap-id="map-one"]').click()
      await select('b')
      await page.getByRole('button', { name: labels.center, exact: true }).click()
      await assertCanvasFit()
      await page.mouse.move(65, 85)
      await page.locator('.mindmap-inspector').evaluate(el => { el.scrollTop = 0 })
      await page.screenshot({ path: path.join(output, language + '-' + width + '-linked-map.png'), fullPage: true })
      const expectedMaps = await maps()
      const expectedTasks = await tasks()
      await page.reload({ waitUntil: 'networkidle' })
      await page.getByRole('button', { name: labels.nav, exact: true }).click()
      await node('root').waitFor()
      assert.deepEqual(await maps(), expectedMaps)
      assert.deepEqual(await tasks(), expectedTasks)
      await page.getByRole('button', { name: labels.settings, exact: true }).click()
      await page.getByRole('button', { name: new RegExp(labels.export) }).click()
      await page.waitForFunction(() => typeof window.__mindMapExport === 'string')
      const exportedText = await page.evaluate(() => window.__mindMapExport)
      assert.deepEqual(JSON.parse(exportedText).data.mindMaps, expectedMaps)
      await page.reload({ waitUntil: 'networkidle' })
      await page.getByRole('button', { name: labels.settings, exact: true }).click()
      await page.locator('input[type="file"]').setInputFiles({ name: 'synthetic-mindmap-backup.json', mimeType: 'application/json', buffer: Buffer.from(exportedText) })
      await Promise.all([page.waitForNavigation({ waitUntil: 'networkidle' }), page.getByRole('button', { name: labels.confirmImport, exact: true }).click()])
      await page.getByRole('button', { name: labels.nav, exact: true }).click()
      await node('root').waitFor()
      assert.deepEqual(await maps(), expectedMaps)
      assert.deepEqual(await tasks(), expectedTasks)
      await assertCanvasFit()
      await page.screenshot({ path: path.join(output, language + '-' + width + '-restored-map.png'), fullPage: true })
      assert.deepEqual(errors, [])
      checks.push({ language, width, height, multipleMaps: true, initialAndCenterFit: true, branchCollapseExpand: true, nativeBranchDrag: true,
        existingTaskLinkUnlink: true, convertWithoutDuplicates: true, sharedTaskReference: true, taskCompleteUndoSync: true,
        editOriginalTask: true, deletingNodesKeepsTasks: true, plainTextRendering: true, coldReload: true, fileBackupRestore: true, errors })
      console.log(JSON.stringify(checks.at(-1)))
      await context.close()
    }
    fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify({ browser: 'Microsoft Edge isolated synthetic contexts', checks }, null, 2))
    console.log(JSON.stringify({ groups: checks.length, screenshots: checks.length * 2 }))
  } catch (error) {
    if (lastPage && !lastPage.isClosed()) await lastPage.screenshot({ path: path.join(output, 'failure.png'), fullPage: true }).catch(() => {})
    throw error
  } finally {
    if (browser) await browser.close()
    await new Promise(resolve => server.close(resolve))
  }
})().catch(error => { console.error(error); process.exitCode = 1 })
