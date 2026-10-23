const fs = require('node:fs')
const path = require('node:path')
const http = require('node:http')
const assert = require('node:assert/strict')
const { chromium } = require('playwright')
const root = path.resolve(__dirname, '../..')
const dist = path.join(root, 'dist')
const output = path.join(__dirname, 'waiting-followups-ui-2026-10-23')
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
  let browser
  const checks = []
  try {
    browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--disable-background-networking', '--disable-component-update', '--no-first-run'] })
    for (const language of ['zh', 'en']) for (const [width, height] of [[900, 600], [1280, 800]]) {
      const context = await browser.newContext({ viewport: { width, height }, locale: language === 'zh' ? 'zh-CN' : 'en-US', timezoneId: 'Europe/Berlin' })
      const page = await context.newPage()
      const errors = []
      page.on('pageerror', error => errors.push(error.message))
      page.on('console', message => { if (message.type() === 'error') errors.push(message.text()) })
      await page.route('**/*', route => route.request().url().startsWith(origin + '/') ? route.continue() : route.abort())
      const labels = language === 'zh' ? {
        drag: '拖到“待反馈”卡片', resume: '恢复待办', undo: '撤销', edit: '编辑布局', done: '完成', add: '+ 添加卡片',
        settings: '设置', export: '导出数据', mismatch: '此任务不属于当前卡片分类，请更换卡片或调整筛选。',
      } : {
        drag: 'Drag to the Awaiting Feedback card', resume: 'Return to To-do', undo: 'Undo', edit: 'Edit Layout', done: 'Done', add: '+ Add Card',
        settings: 'Settings', export: 'Export Data', mismatch: 'This task does not match this card’s categories. Use another card or change its filter.',
      }
      await page.addInitScript(({ language, width }) => {
        window.electronAPI = { saveFile: async content => { window.__waitingExport = content; return { success: true } } }
        if (sessionStorage.getItem('waiting-followups-seeded')) return
        sessionStorage.setItem('waiting-followups-seeded', 'true')
        localStorage.clear()
        localStorage.setItem('anvilite-subtask-migration-v3', 'synthetic-current-format')
        localStorage.setItem('anvilite-migration-timer-tags-v031', 'synthetic-current-format')
        localStorage.setItem('anvilite-settings', JSON.stringify({ state: { settings: {
          theme: width === 900 ? 'dawn-white' : 'forge-purple', language, unlockedThemes: ['dawn-white', 'forge-purple'], characterName: 'Synthetic',
        } }, version: 0 }))
        const now = new Date().toISOString()
        const task = (id, title, category, status) => ({
          id, title, category, status, priority: 'medium', difficulty: 2, description: 'Synthetic notes to preserve', dueDate: null,
          actualMinutes: 20, xpReward: 0, completedAt: null, deletedAt: null, isHidden: false, timerStartedAt: null,
          timerAccumulated: 0, tags: ['synthetic'], sortOrder: 0,
          subTasks: [{ id: id + '-child', title: language === 'zh' ? '已发出材料' : 'Material already sent', completed: true, sortOrder: 0, subTasks: [], createdAt: now }],
          createdAt: now, updatedAt: now,
        })
        localStorage.setItem('anvilite-tasks', JSON.stringify({ state: { tasks: [
          task('email', language === 'zh' ? '等待合作邮件回复' : 'Waiting for collaboration reply', 'home', 'waiting'),
          task('home-todo', language === 'zh' ? '继续推进的事项' : 'Active work item', 'home', 'todo'),
          task('forge', language === 'zh' ? '等待工作反馈' : 'Waiting for work feedback', 'forge', 'waiting'),
          task('custom', language === 'zh' ? '等待客户反馈' : 'Waiting for client feedback', 'Client work', 'waiting'),
        ], lastCategory: 'home', completedViewMode: 'area', customTaskGroups: [] }, version: 0 }))
        localStorage.setItem('anvilite-dashboard', JSON.stringify({ state: { layout: [
          { id: 'tasks', col: 0, row: 0, colSpan: 8, rowSpan: 8 },
          { id: 'waiting', col: 8, row: 0, colSpan: 8, rowSpan: 8, waitingFilter: { mode: 'single', categories: ['home'] } },
          { id: 'waiting:second', col: 16, row: 0, colSpan: 8, rowSpan: 8, waitingFilter: { mode: 'multiple', categories: ['forge', 'Client work'] } },
        ], visibleCards: ['tasks', 'waiting', 'waiting:second'] }, version: 3 }))
      }, { language, width })
      const task = id => page.evaluate(id => JSON.parse(localStorage.getItem('anvilite-tasks')).state.tasks.find(t => t.id === id), id)
      const layout = () => page.evaluate(() => JSON.parse(localStorage.getItem('anvilite-dashboard')).state)
      const card = id => page.locator('[data-dashboard-card="' + id + '"]')
      const row = (cardId, taskId) => card(cardId).locator('[data-task-id="' + taskId + '"]')
      const zone = id => card(id).locator('[data-task-drop-target="waiting"]')
      const waitStatus = status => page.waitForFunction(status => JSON.parse(localStorage.getItem('anvilite-tasks')).state.tasks.find(t => t.id === 'email').status === status, status)
      const complete = async () => { await row('waiting', 'email').locator('button:not([draggable])').first().click(); await waitStatus('done') }
      const filter = async (id, mode, categories = []) => {
        await page.locator('[data-filter-trigger="' + id + '"]').click()
        const modal = page.locator('[data-task-card-filter="' + id + '"]')
        await modal.locator('input[name="filter-mode-' + id + '"][value="' + mode + '"]').check()
        for (const category of categories) await modal.locator('input[name="filter-category-' + id + '"][value="' + category + '"]').check()
        return modal
      }
      await page.goto(origin, { waitUntil: 'networkidle' })
      await zone('waiting').waitFor()
      const before = await task('email')
      const layoutBefore = await layout()
      assert.equal(await row('waiting', 'email').count(), 1)
      assert.equal(await row('waiting:second', 'email').count(), 0)
      assert.equal(await row('waiting:second', 'forge').count(), 1)
      assert.equal(await row('waiting:second', 'custom').count(), 1)
      await complete()
      assert.equal((await task('email')).completionReturnStatus, 'waiting')
      await page.getByRole('button', { name: labels.undo, exact: true }).click()
      await waitStatus('waiting')
      await row('waiting', 'email').waitFor()
      assert.equal((await task('email')).completionReturnStatus, undefined)
      assert.equal((await task('email')).timerStartedAt, null)
      const restored = await task('email')
      await row('waiting', 'email').getByRole('button', { name: labels.drag, exact: true }).dragTo(zone('waiting:second'), { targetPosition: { x: 50, y: 20 } })
      await card('waiting:second').locator('[data-waiting-drop-mismatch]').waitFor()
      assert.deepEqual(await task('email'), restored)
      await row('waiting', 'email').getByRole('button', { name: labels.resume, exact: true }).click()
      await waitStatus('todo')
      await row('tasks', 'email').getByRole('button', { name: labels.drag, exact: true }).dragTo(page.locator('h1'))
      assert.equal((await task('email')).status, 'todo')
      const beforeMismatch = await task('email')
      await row('tasks', 'email').getByRole('button', { name: labels.drag, exact: true }).dragTo(zone('waiting:second'), { targetPosition: { x: 50, y: 20 } })
      await page.getByText(labels.mismatch, { exact: true }).waitFor()
      assert.deepEqual(await task('email'), beforeMismatch)
      await row('tasks', 'email').getByRole('button', { name: labels.drag, exact: true }).dragTo(zone('waiting'), { targetPosition: { x: 50, y: 20 } })
      await waitStatus('waiting')
      await row('waiting', 'email').waitFor()
      // A persisted completion must also return to waiting after a cold renderer reload.
      await complete()
      await page.reload({ waitUntil: 'networkidle' })
      await row('tasks', 'email').locator('button').first().click()
      await waitStatus('waiting')
      await row('waiting', 'email').waitFor()
      const after = await task('email')
      for (const field of ['id', 'category', 'description', 'tags', 'actualMinutes', 'subTasks']) assert.deepEqual(after[field], before[field])
      assert.equal(after.timerStartedAt, null)
      assert.equal(after.completionId, undefined)
      assert.deepEqual(await layout(), layoutBefore)
      let modal = await filter('waiting:second', 'all')
      await modal.locator('button').first().click()
      await row('waiting:second', 'email').waitFor()
      modal = await filter('waiting:second', 'single', ['forge'])
      await modal.locator('button').first().click()
      assert.equal(await row('waiting:second', 'email').count(), 0)
      assert.equal(await row('waiting:second', 'custom').count(), 0)
      modal = await filter('waiting:second', 'multiple', ['Client work'])
      await page.screenshot({ path: path.join(output, language + '-' + width + '-filter.png'), fullPage: true })
      await modal.locator('button').first().click()
      await row('waiting:second', 'custom').waitFor()
      assert.equal(await row('waiting:second', 'forge').count(), 1)
      assert.equal(await row('waiting', 'email').count(), 1)
      await page.screenshot({ path: path.join(output, language + '-' + width + '-dashboard.png'), fullPage: true })
      await page.getByRole('button', { name: labels.edit, exact: true }).click()
      await page.getByRole('button', { name: labels.add, exact: true }).click()
      await page.locator('[data-add-waiting-card]').click()
      const withNew = await layout()
      const addedId = withNew.visibleCards.find(id => id.startsWith('waiting:') && id !== 'waiting:second')
      assert.ok(addedId)
      assert.equal(withNew.layout.find(c => c.id === 'waiting').waitingFilter.mode, 'single')
      await page.getByRole('button', { name: labels.done, exact: true }).click()
      await page.reload({ waitUntil: 'networkidle' })
      assert.deepEqual(await layout(), withNew)
      await page.getByRole('button', { name: labels.settings, exact: true }).click()
      await page.getByRole('button', { name: new RegExp(labels.export) }).click()
      await page.waitForFunction(() => typeof window.__waitingExport === 'string')
      const exported = await page.evaluate(() => JSON.parse(window.__waitingExport))
      assert.deepEqual(exported.data.dashboard, withNew)
      assert.equal(exported.data.tasks.tasks.find(t => t.id === 'email').status, 'waiting')
      assert.deepEqual(errors, [])
      checks.push({ language, width, height, toastUndo: true, coldReloadUndo: true, nativeDragAfterUndo: true,
        canceledDrag: true, mismatchedDropNoWrite: true, independentCategoryFilters: true, addMultipleCards: true,
        layoutPreserved: true, exportPreserved: true, errors })
      console.log(JSON.stringify(checks.at(-1)))
      await context.close()
    }
    fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify({ browser: 'Microsoft Edge isolated synthetic contexts', checks }, null, 2))
    console.log(JSON.stringify({ groups: checks.length, screenshots: checks.length * 2 }))
  } finally {
    if (browser) await browser.close()
    await new Promise(resolve => server.close(resolve))
  }
})().catch(error => { console.error(error); process.exitCode = 1 })
