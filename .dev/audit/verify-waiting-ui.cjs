const fs = require('node:fs')
const path = require('node:path')
const http = require('node:http')
const assert = require('node:assert/strict')
const { chromium } = require('playwright')
const root = path.resolve(__dirname, '../..')
const dist = path.join(root, 'dist')
const output = path.join(__dirname, 'waiting-ui-2026-10-22')
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
  const origin = `http://127.0.0.1:${server.address().port}`
  let browser
  const checks = []
  try {
    browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--disable-background-networking', '--disable-component-update', '--no-first-run'] })
    for (const language of ['zh', 'en']) for (const [width, height] of [[900, 600], [1280, 800]]) {
      const context = await browser.newContext({ viewport: { width, height }, locale: language === 'zh' ? 'zh-CN' : 'en-US' })
      const page = await context.newPage()
      const errors = []
      page.on('pageerror', error => errors.push(error.message))
      await page.route('**/*', route => route.request().url().startsWith(origin + '/') ? route.continue() : route.abort())
      const labels = language === 'zh' ? {
        email: '等待对方回复的合作邮件', other: '可以主动推进的事项', existing: '等待实验观察结果',
        drag: '拖到“待反馈”卡片', resume: '恢复待办', wait: '移入待反馈',
        tasks: '任务', settings: '设置', export: '导出数据', confirmImport: '确认导入',
      } : {
        email: 'Collaboration email awaiting a reply', other: 'A task I can actively work on', existing: 'Waiting for observation results',
        drag: 'Drag to the Awaiting Feedback card', resume: 'Return to To-do', wait: 'Move to Awaiting Feedback',
        tasks: 'Tasks', settings: 'Settings', export: 'Export Data', confirmImport: 'Confirm Import',
      }
      await page.addInitScript(({ language, labels }) => {
        window.electronAPI = { saveFile: async (content) => { window.__waitingExport = content; return { success: true } } }
        if (sessionStorage.getItem('waiting-test-seeded')) return
        sessionStorage.setItem('waiting-test-seeded', 'true')
        localStorage.clear()
        localStorage.setItem('anvilite-subtask-migration-v3', 'synthetic-current-format')
        localStorage.setItem('anvilite-migration-timer-tags-v031', 'synthetic-current-format')
        localStorage.setItem('anvilite-settings', JSON.stringify({ state: { settings: {
          theme: 'dawn-white', language, dashboardLayout: [], unlockedThemes: ['dawn-white'], characterName: 'Synthetic',
        } }, version: 0 }))
        const now = new Date().toISOString()
        const task = (id, title, status) => ({
          id, title, status, category: 'other', priority: 'medium', difficulty: 3, description: 'Synthetic context to preserve',
          dueDate: null, actualMinutes: 20, xpReward: 0, completedAt: null, deletedAt: null, isHidden: false,
          timerStartedAt: status === 'doing' ? new Date(Date.now() - 120000).toISOString() : null,
          timerAccumulated: 60, tags: ['synthetic'], sortOrder: id === 'email' ? 0 : 1,
          subTasks: [{ id: id + '-child', title: language === 'zh' ? '材料已经发送' : 'Material already sent', completed: true, sortOrder: 0, subTasks: [], createdAt: now }],
          createdAt: now, updatedAt: now,
        })
        localStorage.setItem('anvilite-tasks', JSON.stringify({ state: {
          tasks: [task('email', labels.email, 'doing'), task('other', labels.other, 'todo'), task('existing', labels.existing, 'waiting')],
          lastCategory: 'other', completedViewMode: 'month', customTaskGroups: [],
        }, version: 0 }))
        localStorage.setItem('anvilite-dashboard', JSON.stringify({ state: { layout: [
          { id: 'tasks', col: 0, row: 0, colSpan: 12, rowSpan: 8 },
          { id: 'waiting', col: 12, row: 0, colSpan: 12, rowSpan: 8 },
        ], visibleCards: ['tasks', 'waiting'] }, version: 3 }))
      }, { language, labels })
      const stored = () => page.evaluate(() => JSON.parse(localStorage.getItem('anvilite-tasks')).state.tasks.find(t => t.id === 'email'))
      const waiting = () => page.locator('[data-task-drop-target="waiting"]')
      const row = () => page.locator('[data-task-id="email"]')
      await page.goto(origin, { waitUntil: 'networkidle' })
      await waiting().waitFor()
      const before = await stored()
      const layoutBefore = await page.evaluate(() => JSON.parse(localStorage.getItem('anvilite-dashboard')).state)
      await row().getByRole('button', { name: labels.drag, exact: true }).dragTo(page.locator('h1'))
      assert.equal((await stored()).status, 'doing')
      await row().getByRole('button', { name: labels.drag, exact: true }).dragTo(waiting(), { targetPosition: { x: 80, y: 35 } })
      await page.waitForFunction(() => JSON.parse(localStorage.getItem('anvilite-tasks')).state.tasks.find(t => t.id === 'email').status === 'waiting')
      await waiting().getByText(labels.email, { exact: true }).waitFor()
      const moved = await stored()
      assert.equal(moved.timerStartedAt, null)
      assert.equal(moved.actualMinutes, before.actualMinutes)
      assert.ok(moved.timerAccumulated >= 180 && moved.timerAccumulated < 240)
      assert.deepEqual(moved.subTasks, before.subTasks)
      assert.deepEqual(moved.tags, before.tags)
      assert.deepEqual(await page.evaluate(() => JSON.parse(localStorage.getItem('anvilite-dashboard')).state), layoutBefore)
      await page.reload({ waitUntil: 'networkidle' })
      await waiting().getByText(labels.email, { exact: true }).waitFor()
      const paused = (await stored()).timerAccumulated
      await page.waitForTimeout(1100)
      assert.equal((await stored()).timerAccumulated, paused)
      await page.getByRole('button', { name: labels.tasks, exact: true }).click()
      await row().getByRole('button', { name: labels.resume, exact: true }).click()
      await page.waitForFunction(() => JSON.parse(localStorage.getItem('anvilite-tasks')).state.tasks.find(t => t.id === 'email').status === 'todo')
      assert.equal((await stored()).timerStartedAt, null)
      await page.waitForFunction(() => document.querySelectorAll('[data-task-id="email"]').length === 1)
      await row().click({ button: 'right' })
      await page.getByRole('button', { name: labels.wait, exact: true }).last().click()
      await page.waitForFunction(() => JSON.parse(localStorage.getItem('anvilite-tasks')).state.tasks.find(t => t.id === 'email').status === 'waiting')
      await page.waitForFunction(() => document.querySelectorAll('[data-task-id="email"]').length === 1)
      await page.mouse.move(20, 20)
      await page.evaluate(() => { document.querySelectorAll('*').forEach(element => { if (element.scrollTop) element.scrollTop = 0 }) })
      await page.waitForTimeout(650) // Let section move/exit animations settle before visual inspection.
      await page.screenshot({ path: path.join(output, `${language}-${width}-task-list.png`), fullPage: true })
      await page.getByRole('button', { name: labels.settings, exact: true }).click()
      await page.getByRole('button', { name: new RegExp(labels.export) }).click()
      await page.waitForFunction(() => typeof window.__waitingExport === 'string')
      const exportedText = await page.evaluate(() => window.__waitingExport)
      const exported = JSON.parse(exportedText)
      assert.equal(exported.data.tasks.tasks.find(t => t.id === 'email').status, 'waiting')
      await page.reload({ waitUntil: 'networkidle' })
      await waiting().locator('[data-task-id="email"]').getByRole('button', { name: labels.resume, exact: true }).click()
      await page.getByRole('button', { name: labels.settings, exact: true }).click()
      await page.locator('input[type="file"]').setInputFiles({ name: 'synthetic-waiting-backup.json', mimeType: 'application/json', buffer: Buffer.from(exportedText) })
      await Promise.all([
        page.waitForNavigation({ waitUntil: 'networkidle' }),
        page.getByRole('button', { name: labels.confirmImport, exact: true }).click(),
      ])
      await waiting().getByText(labels.email, { exact: true }).waitFor()
      assert.equal((await stored()).status, 'waiting')
      assert.equal((await stored()).timerStartedAt, null)
      const restoredLayout = await page.evaluate(() => JSON.parse(localStorage.getItem('anvilite-dashboard')).state)
      assert.deepEqual(restoredLayout, exported.data.dashboard)
      await page.screenshot({ path: path.join(output, `${language}-${width}-dashboard.png`), fullPage: true })
      assert.deepEqual(errors, [])
      checks.push({ language, width, height, nativeDrag: true, canceledDrag: true, pausedTimer: true, taskList: true, explicitResume: true, restart: true, fileImportReload: true, layoutPreserved: true, pageErrors: errors })
      await context.close()
    }
    fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify({ browser: 'Microsoft Edge (isolated headless contexts)', checks }, null, 2))
    console.log(JSON.stringify({ combinations: checks.length, screenshots: checks.length * 2, pageErrors: 0, report: path.join(output, 'report.json') }))
  } finally {
    if (browser) await browser.close()
    await new Promise(resolve => server.close(resolve))
  }
})().catch(error => { console.error(error); process.exitCode = 1 })
