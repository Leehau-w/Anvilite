const fs = require('node:fs')
const path = require('node:path')
const http = require('node:http')
const assert = require('node:assert/strict')
const { chromium } = require('playwright')
const root = path.resolve(__dirname, '../..')
const dist = path.join(root, 'dist')
const output = path.join(__dirname, 'waiting-sort-enter-ui-2026-10-23')
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
      const t = language === 'zh' ? { drag: '拖到“待反馈”卡片', high: '高', work: '工作', cancel: '取消',
        sub: '输入标题，回车创建', tag: '输入标签名', addTag: '+ 添加标签', full: '完整创建', edit: '编辑布局', done: '完成' }
        : { drag: 'Drag to the Awaiting Feedback card', high: 'High', work: 'Work', cancel: 'Cancel',
          sub: 'Title, press Enter', tag: 'Tag name', addTag: '+ Add Tag', full: 'Full Form', edit: 'Edit Layout', done: 'Done' }
      await page.addInitScript(({ language, width }) => {
        if (sessionStorage.getItem('waiting-sort-enter-seeded')) return
        sessionStorage.setItem('waiting-sort-enter-seeded', 'true'); localStorage.clear()
        localStorage.setItem('anvilite-subtask-migration-v3', 'synthetic-current-format')
        localStorage.setItem('anvilite-migration-timer-tags-v031', 'synthetic-current-format')
        localStorage.setItem('anvilite-settings', JSON.stringify({ state: { settings: {
          theme: width === 900 ? 'dawn-white' : 'forge-purple', language, unlockedThemes: ['dawn-white', 'forge-purple'], characterName: 'Synthetic',
        } }, version: 0 }))
        const now = new Date().toISOString()
        const task = (id, category, status, sortOrder) => ({ id, title: id.toUpperCase() + (language === 'zh' ? ' 等待回复' : ' Await reply'),
          category, status, sortOrder, priority: 'medium', difficulty: 2, dueDate: '2026-11-01', description: 'Original notes',
          actualMinutes: 20, xpReward: 0, completedAt: status === 'done' ? now : null, completionId: status === 'done' ? 'original-receipt' : undefined,
          completionReturnStatus: status === 'done' ? 'waiting' : undefined,
          deletedAt: null, isHidden: false, timerStartedAt: null, timerAccumulated: 0, tags: ['synthetic'],
          subTasks: [{ id: id + '-sub', title: language === 'zh' ? '已发送材料' : 'Material sent', completed: true, sortOrder: 0, subTasks: [], createdAt: now }],
          createdAt: now, updatedAt: now })
        localStorage.setItem('anvilite-tasks', JSON.stringify({ state: { tasks: [
          task('h1', 'home', 'waiting', 0), task('f1', 'forge', 'waiting', 1), task('h2', 'home', 'waiting', 2),
          task('f2', 'forge', 'waiting', 3), task('h3', 'home', 'waiting', 4), task('todo', 'home', 'todo', 0), task('done', 'home', 'done', 0),
        ], lastCategory: 'home', completedViewMode: 'area', customTaskGroups: [] }, version: 0 }))
        localStorage.setItem('anvilite-dashboard', JSON.stringify({ state: { layout: [
          { id: 'waiting', col: 0, row: 0, colSpan: 12, rowSpan: 6, waitingFilter: { mode: 'single', categories: ['home'] } },
          { id: 'waiting:all', col: 12, row: 0, colSpan: 12, rowSpan: 6 },
          { id: 'tasks', col: 0, row: 6, colSpan: 24, rowSpan: 6 },
          { id: 'quickAdd', col: 0, row: 12, colSpan: 24, rowSpan: 2 },
        ], visibleCards: ['waiting', 'waiting:all', 'tasks', 'quickAdd'] }, version: 3 }))
      }, { language, width })
      const tasks = () => page.evaluate(() => JSON.parse(localStorage.getItem('anvilite-tasks')).state.tasks)
      const stored = async id => (await tasks()).find(task => task.id === id)
      const card = id => page.locator('[data-dashboard-card="' + id + '"]')
      const row = (cardId, id) => card(cardId).locator('[data-task-id="' + id + '"]')
      const order = async cardId => card(cardId).locator('[data-waiting-task-id]').evaluateAll(rows => rows.map(row => row.getAttribute('data-waiting-task-id')))
      const sortedAll = async () => (await tasks()).filter(task => task.status === 'waiting' && !task.deletedAt && !task.isHidden).sort((a,b) => a.sortOrder - b.sortOrder).map(task => task.id)
      const drawer = () => page.locator('[data-task-drawer]')
      const open = async id => {
        const match = await stored(id)
        const cardId = match.status === 'waiting' ? 'waiting:all' : 'tasks'
        await row(cardId, id).getByText(match.title, { exact: true }).click()
        await drawer().waitFor()
      }
      const closed = () => drawer().waitFor({ state: 'detached' })
      await page.goto(origin, { waitUntil: 'networkidle' })
      await card('waiting').waitFor()
      const original = await tasks()
      await row('waiting', 'h3').getByRole('button', { name: t.drag, exact: true }).dragTo(row('waiting', 'h1'), { targetPosition: { x: 70, y: 5 } })
      await page.waitForFunction(() => JSON.parse(localStorage.getItem('anvilite-tasks')).state.tasks.find(task => task.id === 'h3').sortOrder === 0)
      assert.deepEqual(await sortedAll(), ['h3','f1','h1','f2','h2'])
      assert.deepEqual(await order('waiting'), ['h3','h1','h2'])
      assert.deepEqual(await order('waiting:all'), ['h3','f1','h1','f2','h2'])
      const clean = task => { const { sortOrder, ...rest } = task; return rest }
      for (const task of original) assert.deepEqual(clean(await stored(task.id)), clean(task))
      await page.waitForTimeout(350) // Reorder layout animation must settle before measuring.
      // Pointer sorting from row padding must work without opening the editor.
      const source = await row('waiting', 'h2').boundingBox()
      const target = await row('waiting', 'h3').boundingBox()
      await page.mouse.move(source.x + source.width - 5, source.y + 18)
      await page.mouse.down()
      await page.waitForTimeout(30)
      await page.mouse.move(source.x + source.width - 5, target.y + 5, { steps: 16 })
      await page.waitForTimeout(100)
      await page.mouse.up()
      await page.waitForTimeout(350)
      await page.waitForFunction(() => JSON.parse(localStorage.getItem('anvilite-tasks')).state.tasks.find(task => task.id === 'h2').sortOrder === 0)
      assert.equal(await drawer().count(), 0)
      assert.deepEqual(await sortedAll(), ['h2','f1','h3','f2','h1'])
      // Cancel a moved pointer gesture and confirm both position and order recover.
      const pointerCancelRow = row('waiting', 'h1')
      const pointerCancelBox = await pointerCancelRow.boundingBox()
      const cancelTarget = await row('waiting', 'h2').boundingBox()
      const beforePointerCancel = await tasks()
      await page.mouse.move(pointerCancelBox.x + pointerCancelBox.width - 5, pointerCancelBox.y + 18)
      await page.mouse.down()
      await page.waitForTimeout(30)
      await page.mouse.move(pointerCancelBox.x + pointerCancelBox.width - 5, cancelTarget.y + 5, { steps: 16 })
      await page.keyboard.press('Escape')
      await page.waitForTimeout(100)
      await page.mouse.up()
      await page.waitForTimeout(350)
      await page.waitForFunction(() => [...document.querySelectorAll('[data-waiting-card-id="waiting"] [data-waiting-task-id]')].every(row => {
        const transform = getComputedStyle(row).transform
        return transform === 'none' || Math.abs(new DOMMatrixReadOnly(transform).m42) < 1
      }))
      assert.deepEqual(await tasks(), beforePointerCancel)
      assert.equal(await drawer().count(), 0)
      assert.deepEqual(await order('waiting'), ['h2','h3','h1'])
      // The next pointer drag must still reorder after Escape.
      const resumeSource = await row('waiting', 'h3').boundingBox()
      const resumeTarget = await row('waiting', 'h2').boundingBox()
      await page.mouse.move(resumeSource.x + resumeSource.width - 5, resumeSource.y + 18)
      await page.mouse.down()
      await page.waitForTimeout(30)
      await page.mouse.move(resumeSource.x + resumeSource.width - 5, resumeTarget.y + 5, { steps: 16 })
      await page.waitForTimeout(100)
      await page.mouse.up()
      await page.waitForTimeout(350)
      await page.waitForFunction(() => JSON.parse(localStorage.getItem('anvilite-tasks')).state.tasks.find(task => task.id === 'h3').sortOrder === 0)
      assert.deepEqual(await sortedAll(), ['h3','f1','h2','f2','h1'])
      const beforeCancel = await tasks()
      await row('waiting', 'h3').getByRole('button', { name: t.drag, exact: true }).dragTo(page.locator('h1'))
      assert.deepEqual(await tasks(), beforeCancel)
      await page.reload({ waitUntil: 'networkidle' })
      assert.deepEqual(await sortedAll(), ['h3','f1','h2','f2','h1'])
      await row('tasks', 'todo').getByRole('button', { name: t.drag, exact: true }).dragTo(card('waiting').locator('[data-task-drop-target="waiting"]'), { targetPosition: { x: 80, y: 30 } })
      await page.waitForFunction(() => JSON.parse(localStorage.getItem('anvilite-tasks')).state.tasks.find(task => task.id === 'todo').status === 'waiting')
      await page.getByRole('button', { name: t.edit, exact: true }).click()
      const beforeEditDrag = await tasks()
      await row('waiting', 'h1').getByRole('button', { name: t.drag, exact: true }).dragTo(row('waiting', 'h2'), { targetPosition: { x: 70, y: 5 } })
      assert.deepEqual(await tasks(), beforeEditDrag)
      await page.getByRole('button', { name: t.done, exact: true }).click()
      await open('h2')
      await drawer().getByRole('button', { name: t.high, exact: true }).click()
      await drawer().getByRole('button', { name: t.high, exact: true }).press('Enter')
      await closed()
      assert.equal((await stored('h2')).priority, 'high')
      assert.equal((await stored('h2')).status, 'waiting')
      await open('h2')
      await drawer().getByRole('button', { name: t.work, exact: true }).click()
      await drawer().getByRole('button', { name: t.work, exact: true }).press('Enter')
      await closed()
      assert.equal((await stored('h2')).category, 'forge')
      await open('h2')
      await drawer().locator('[data-task-color-preset="sand"]').click()
      await drawer().locator('[data-task-color-preset="sand"]').press('Enter')
      await closed()
      assert.match((await stored('h2')).backgroundColor, /^#[0-9a-f]{6}$/i)
      await open('h2')
      await drawer().locator('input[type="date"]').fill('2026-12-12')
      await drawer().locator('input[type="date"]').press('Enter')
      await closed()
      assert.equal((await stored('h2')).dueDate, '2026-12-12')
      await open('done')
      await drawer().locator('input[type="number"]').fill('37')
      await drawer().locator('input[type="number"]').press('Enter')
      await closed()
      assert.deepEqual({ status: (await stored('done')).status, id: (await stored('done')).completionId, minutes: (await stored('done')).actualMinutes }, { status: 'done', id: 'original-receipt', minutes: 37 })
      await open('h2')
      const notes = drawer().locator('textarea')
      await notes.fill('First line')
      await notes.press('End'); await notes.press('Shift+Enter'); await notes.pressSequentially('Second line')
      assert.equal(await notes.inputValue(), 'First line\nSecond line')
      assert.equal(await drawer().count(), 1)
      await notes.press('Enter'); await closed()
      assert.equal((await stored('h2')).description, 'First line\nSecond line')
      await open('h2')
      const title = drawer().locator('input').first()
      await title.fill('Composing draft')
      await title.dispatchEvent('compositionstart')
      await title.dispatchEvent('keydown', { key: 'Enter', code: 'Enter', isComposing: true, keyCode: 229, bubbles: true, cancelable: true })
      assert.equal(await drawer().count(), 1)
      assert.notEqual((await stored('h2')).title, 'Composing draft')
      await title.dispatchEvent('compositionend')
      await drawer().getByRole('button', { name: t.cancel, exact: true }).click(); await closed()
      await open('h2')
      await drawer().getByPlaceholder(t.sub, { exact: true }).last().fill('Draft child kept on Enter')
      await drawer().getByRole('button', { name: t.high, exact: true }).focus()
      await drawer().getByRole('button', { name: t.high, exact: true }).press('Enter'); await closed()
      assert.equal((await stored('h2')).subTasks.filter(sub => sub.title === 'Draft child kept on Enter').length, 1)
      await open('h2')
      await drawer().getByRole('button', { name: t.addTag, exact: true }).click()
      await drawer().getByPlaceholder(t.tag, { exact: true }).fill('draft-tag')
      await drawer().getByRole('button', { name: t.high, exact: true }).press('Enter'); await closed()
      assert.ok((await stored('h2')).tags.includes('draft-tag'))
      // New creation also uses the same Enter submit and commits child drafts once.
      await page.getByTitle(t.full, { exact: true }).click()
      await drawer().locator('input').first().fill(language === 'zh' ? '回车新建任务' : 'Create with Enter')
      await drawer().getByPlaceholder(t.sub, { exact: true }).last().fill('New child')
      const beforeNew = (await tasks()).length
      await drawer().getByRole('button', { name: t.high, exact: true }).press('Enter'); await closed()
      assert.equal((await tasks()).length, beforeNew + 1)
      assert.ok((await tasks()).some(task => task.subTasks.some(sub => sub.title === 'New child')))
      await page.evaluate(() => document.querySelectorAll('*').forEach(el => { if (el.scrollTop) el.scrollTop = 0 }))
      await page.mouse.move(65, 80)
      await page.waitForTimeout(350)
      await page.screenshot({ path: path.join(output, language + '-' + width + '-dashboard.png'), fullPage: true })
      await open('h2')
      await page.waitForTimeout(350)
      await page.screenshot({ path: path.join(output, language + '-' + width + '-drawer.png'), fullPage: true })
      assert.deepEqual(errors, [])
      checks.push({ language, width, height, nativeGripSort: true, pointerSort: true, filteredSlots: true, overlappingCards: true,
        canceledDrag: true, pointerEscapeRestoresPosition: true, pointerReorderAfterEscape: true, layoutEditingBlocksSort: true, externalDrop: true, coldReload: true, enterSettingsSaveClose: true,
        textareaShiftEnter: true, imeSafe: true, localDraftsPreserved: true, newTaskEnter: true, errors })
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
