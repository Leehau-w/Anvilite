const fs = require('node:fs')
const path = require('node:path')
const http = require('node:http')
const assert = require('node:assert/strict')
const ts = require('typescript')
const { chromium } = require('playwright')
const root = path.resolve(__dirname, '../..'), dist = path.join(root, 'dist')
const trendOnly = process.argv.includes('--trend-only')
const output = path.join(__dirname, trendOnly ? 'trend-summary-removal-ui-2026-10-23' : 'category-trend-ui-2026-10-23')
const fixedTime = '2026-11-01T12:00:00+01:00' // Synthetic Sunday: this week starts in October.
function translations(language) {
  const source = fs.readFileSync(path.join(root, 'src/i18n', language + '.ts'), 'utf8')
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText
  const module = { exports: {} }
  new Function('exports', 'module', compiled)(module.exports, module)
  return module.exports[language]
}
const server = http.createServer((req, res) => {
  const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname)
  const file = path.resolve(dist, '.' + (pathname === '/' ? '/index.html' : pathname))
  const relative = path.relative(dist, file)
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404).end(); return }
  res.setHeader('Content-Type', ({ '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' })[path.extname(file)] || 'application/octet-stream')
  fs.createReadStream(file).pipe(res)
})
;(async () => {
  // Reject an old bundle instead of accidentally validating the previous implementation.
  const scripts = fs.readdirSync(path.join(dist, 'assets')).filter(name => name.endsWith('.js')).map(name => fs.readFileSync(path.join(dist, 'assets', name), 'utf8')).join('\n')
  for (const marker of ['data-trend-range', 'data-trend-metric', 'data-trend-date']) assert.ok(scripts.includes(marker), 'Build is not ready: ' + marker)
  assert.equal(scripts.includes('data-trend-summary'), false, 'Build still contains the removed summary UI')
  fs.mkdirSync(output, { recursive: true })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  const origin = 'http://127.0.0.1:' + server.address().port
  let browser
  const checks = [], screenshots = []
  try {
    browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--disable-background-networking', '--disable-component-update', '--no-first-run'] })
    for (const language of ['zh', 'en']) for (const [width, height] of [[900, 600], [1280, 800]]) {
      const t = translations(language), theme = width === 900 ? 'dawn-white' : 'forge-purple'
      const createdCategory = language === 'zh' ? '新协作研究分类' : 'New collaboration research'
      const drawerCategory = language === 'zh' ? '抽屉中新建的项目分类' : 'Projects created in the drawer'
      const context = await browser.newContext({ viewport: { width, height }, locale: language === 'zh' ? 'zh-CN' : 'en-US', timezoneId: 'Europe/Berlin', serviceWorkers: 'block' })
      await context.route('**/*', route => route.request().url().startsWith(origin + '/') ? route.continue() : route.abort())
      const page = await context.newPage()
      page.setDefaultTimeout(15000)
      const pageErrors = [], consoleErrors = []
      page.on('pageerror', error => pageErrors.push(error.message))
      page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()) })
      await page.clock.setFixedTime(new Date(fixedTime))
      await page.addInitScript(({ language, theme, narrow }) => {
        if (sessionStorage.getItem('category-summary-seeded')) return
        sessionStorage.setItem('category-summary-seeded', 'true')
        localStorage.clear()
        const put = (key, state, version = 0) => localStorage.setItem('anvilite-' + key, JSON.stringify({ state, version }))
        const now = new Date().toISOString()
        const localAt = (month, day, hour = 12) => new Date(2026, month - 1, day, hour).toISOString()
        for (const key of ['anvilite-subtask-migration-v3', 'anvilite-migration-timer-tags-v031', 'anvilite-migration-sop-v031']) localStorage.setItem(key, 'synthetic-current-format')
        put('settings', { settings: { theme, language, dashboardLayout: [], unlockedThemes: ['dawn-white', 'forge-purple'], characterName: 'Synthetic' } })
        put('character', { character: { name: 'Synthetic', level: 1, currentXP: 0, totalXP: 0, ore: 0, totalOreEarned: 0, titlePreset: 'forge', customTitles: null, streakDays: 0, lastActiveDate: null, globalStatus: 'active', prestigeLevel: 0, xpFormulaVersion: 2, createdAt: now } })
        const areas = [['home', '家园'], ['arena', '竞技场'], ['library', '藏书阁'], ['workshop', '灵感工坊'], ['forge', '锻造坊'], ['milestone', '档案馆']].map(([templateId, name], sortOrder) => ({
          id: 'area-' + templateId, templateId, name, category: templateId === 'milestone' ? '_milestone' : templateId,
          position: { x: 100 + sortOrder * 100, y: 200 }, sortOrder, isPreset: true, canDelete: !['home', 'milestone'].includes(templateId), canMove: false, createdAt: now,
        }))
        for (let index = 1; index <= 3; index++) {
          const name = language === 'zh' ? '用于跨团队研究与长期协作跟进的较长分类' + index : 'Long category for cross-team research and collaboration ' + index
          areas.push({ id: 'area-long-' + index, templateId: null, name, category: name, position: { x: 800, y: 300 }, sortOrder: areas.length, isPreset: false, canDelete: true, canMove: true, createdAt: now })
        }
        put('areas', { areas })
        const task = (id, title, patch = {}) => ({ id, title, category: 'other', status: 'todo', difficulty: 1, priority: 'medium', backgroundColor: null,
          dueDate: null, description: 'Synthetic isolated browser validation', actualMinutes: 0, xpReward: 0, completedAt: null,
          completionId: undefined, deletedAt: null, isHidden: false, timerStartedAt: null, timerAccumulated: 0, tags: [], subTasks: [], sortOrder: 0, createdAt: now, updatedAt: now, ...patch })
        const done = (id, month, day, minutes, patch = {}) => task(id, 'Synthetic ' + id, { status: 'done', completedAt: localAt(month, day), completionId: 'receipt-' + id, actualMinutes: minutes, ...patch })
        put('tasks', { tasks: [
          task('mutation', 'Synthetic mutation task', { actualMinutes: 10 }),
          done('current', 11, 1, 30, { subTasks: [{ id: 'child-one', title: 'Child does not add a completion', completed: true, sortOrder: 0, subTasks: [], createdAt: now }] }),
          done('hidden', 11, 1, 45, { isHidden: true }), done('week-monday', 10, 26, 20), done('week-saturday', 10, 31, 15),
          done('before-week', 10, 25, 200), done('deleted', 11, 1, 999, { deletedAt: now }),
          task('stale', 'Open task with a stale completion date', { completedAt: localAt(11, 1), actualMinutes: 999 }),
          task('waiting', 'A waiting task', { status: 'waiting', actualMinutes: 999 }),
        ], lastCategory: 'other', completedViewMode: 'month', customTaskGroups: [] })
        put('habits', { habits: [], customHabitGroups: [], completedHabitViewMode: 'area' })
        put('badges', { earnedIds: { start_first_task: now }, notifyQueue: [] })
        put('growth-events', { events: [{ id: 'ignored-habit-event', type: 'habit_complete', title: 'Unrelated synthetic reward', timestamp: now, details: { xpGained: 999999 }, isMilestone: false }] })
        put('dashboard', { layout: [
          { id: 'quickAdd', col: 0, row: 0, colSpan: 24, rowSpan: 2 },
          { id: 'growth', col: 0, row: 2, colSpan: narrow ? 8 : 10, rowSpan: 7 },
          { id: 'tasks', col: narrow ? 8 : 10, row: 2, colSpan: narrow ? 16 : 14, rowSpan: 7 },
        ], visibleCards: ['quickAdd', 'growth', 'tasks'] }, 3)
      }, { language, theme, narrow: width === 900 })
      const card = id => page.locator('[data-dashboard-card=' + JSON.stringify(id) + ']')
      const growth = () => card('growth')
      const row = id => page.locator('[data-task-id=' + JSON.stringify(id) + ']')
      const read = key => page.evaluate(key => JSON.parse(localStorage.getItem('anvilite-' + key)).state, key)
      const go = async tab => { await page.getByTitle(t['sidebar_' + tab], { exact: true }).click() }
      const snap = async (suffix, node) => {
        await page.mouse.move(5, 5); await page.waitForTimeout(350)
        const file = path.join(output, `${language}-${width}-${suffix}.png`)
        if (node) { await node.scrollIntoViewIfNeeded(); await node.screenshot({ path: file }) }
        else await page.screenshot({ path: file, fullPage: true })
        screenshots.push(file)
      }
      const calendarTotals = async (monthCount, monthMinutes, weekCount, weekMinutes) => {
        assert.equal(await growth().locator('[data-trend-summary]').count(), 0)
        const view = growth().locator('[data-trend-range][data-trend-metric]')
        const range = await view.getAttribute('data-trend-range')
        const metric = await view.getAttribute('data-trend-metric')
        const expected = range === 'month' ? [monthCount, monthMinutes] : [weekCount, weekMinutes]
        await page.waitForFunction(({ expected, range, metric }) => {
          const view = document.querySelector('[data-dashboard-card="growth"] [data-trend-range][data-trend-metric]')
          if (!view || view.getAttribute('data-trend-range') !== range || view.getAttribute('data-trend-metric') !== metric) return false
          const cells = [...view.querySelectorAll('[data-trend-date]')]
          const total = cells.reduce((sum, node) => [sum[0] + Number(node.getAttribute('data-trend-count')), sum[1] + Number(node.getAttribute('data-trend-minutes'))], [0, 0])
          return cells.length > 0 && total[0] === expected[0] && total[1] === expected[1]
            && cells.every(node => Number(node.getAttribute('data-trend-value')) === Number(node.getAttribute(metric === 'count' ? 'data-trend-count' : 'data-trend-minutes')))
        }, { expected, range, metric })
        return { range, metric, count: expected[0], minutes: expected[1] }
      }
      const layout = async () => growth().evaluate(node => {
        const view = node.querySelector('[data-trend-range][data-trend-metric]')
        const calendar = node.querySelector('[data-trend-calendar]') || view
        const box = element => { const b = element.getBoundingClientRect(); return { x: b.x, y: b.y, right: b.right, bottom: b.bottom, width: b.width, height: b.height } }
        const cells = [...calendar.querySelectorAll('[data-trend-date]')]
        return { card: box(node), chart: box(calendar), view: box(view),
          clientWidth: calendar.clientWidth, scrollWidth: calendar.scrollWidth,
          cellsRight: Math.max(...cells.map(cell => cell.getBoundingClientRect().right)),
          documentWidth: document.documentElement.scrollWidth, viewport: innerWidth }
      })
      const noOverflow = async () => {
        const size = await layout()
        assert.ok(size.scrollWidth <= size.clientWidth + 1, 'Heatmap must not overflow horizontally: ' + JSON.stringify(size))
        assert.ok(size.chart.x >= size.card.x - 1 && size.chart.right <= size.card.right + 1, 'Heatmap must fit its card')
        assert.ok(size.cellsRight <= size.chart.right + 1, 'Calendar cells must fit the chart')
        assert.ok(size.documentWidth <= size.viewport + 1, 'Document must not overflow horizontally')
        return size
      }
      let result
      try {
        await page.goto(origin, { waitUntil: 'networkidle' })
        await calendarTotals(2, 75, 4, 110)
        assert.equal(await card('quickAdd').locator('[data-create-category]').count(), 0)
        const initialLayout = await noOverflow()
        const initialTasks = await read('tasks')
        const initialCharacter = await read('character')
        const switches = []
        if (!trendOnly) await snap('dashboard-month-count')
        for (const [range, metric] of [['week', 'count'], ['week', 'time'], ['month', 'time'], ['month', 'count']]) {
          await growth().getByRole('button', { name: metric === 'count' ? t.heatmap_countMetric : t.heatmap_timeMetric, exact: true }).click()
          await growth().getByRole('button', { name: range === 'month' ? t.heatmap_month : t.heatmap_week, exact: true }).click()
          switches.push(await calendarTotals(2, 75, 4, 110))
          await noOverflow()
          if (range === 'week') {
            const crossMonth = await growth().locator('[data-trend-date="2026-10-26"]').evaluateAll(nodes => nodes.reduce((sum, node) => sum + Number(node.getAttribute('data-trend-count')), 0))
            assert.equal(crossMonth, 1, 'Complete Monday week must include the previous month')
          }
          if (trendOnly) await snap('trend-' + range + '-' + metric, growth())
          else if (range === 'week' && metric === 'time') await snap('trend-week-time', growth())
        }
        if (trendOnly) {
          assert.equal(await growth().locator('[data-trend-summary]').count(), 0)
          assert.deepEqual(await read('tasks'), initialTasks)
          assert.deepEqual(await read('character'), initialCharacter)
          assert.deepEqual(pageErrors, []); assert.deepEqual(consoleErrors, [])
          checks.push({ language, width, height, theme, fixedLocalDate: '2026-11-01', timezone: 'Europe/Berlin',
            summaryUIAbsent: true, heatmapAndFourSwitchesRetained: true, switches,
            crossMonthMondayWeek: true, hiddenIncludedDeletedExcluded: true, taskAndRewardRecordsUnchanged: true,
            initialLayout, noHorizontalOverflow: true, pageErrors, consoleErrors })
          console.log(JSON.stringify({ language, width, theme, trendOnly: true, passed: true }))
          continue
        }
        await go('tasks')
        const tabs = page.locator('[data-task-category-tabs]')
        await tabs.waitFor()
        assert.equal(await page.locator('input[placeholder=' + JSON.stringify(t.quickInput_placeholder) + ']').count(), 1)
        assert.equal(await page.locator('label').filter({ has: page.getByRole('combobox', { name: t.quickInput_category, exact: true }) }).locator('[data-create-category]').count(), 0)
        assert.equal(await tabs.locator('[data-create-category]').count(), 1)
        assert.equal(await tabs.locator('[data-task-category-tab="other"]').evaluate(node => node.nextElementSibling?.hasAttribute('data-task-category-create')), true)
        assert.ok(await tabs.evaluate(node => node.scrollWidth > node.clientWidth), 'Long category tabs should use their own horizontal scroll')
        const quick = page.getByPlaceholder(t.quickInput_placeholder, { exact: true })
        await quick.fill('Synthetic category draft stays intact')
        await tabs.locator('[data-create-category]').scrollIntoViewIfNeeded()
        await snap('task-category-strip-end')
        await tabs.locator('[data-create-category]').click()
        const dialog = page.locator('[data-category-creator]')
        await dialog.locator('input').fill(createdCategory)
        assert.equal(await quick.inputValue(), 'Synthetic category draft stays intact')
        await snap('category-modal')
        const bounds = await dialog.boundingBox()
        assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= width + 1 && bounds.y >= 0 && bounds.y + bounds.height <= height + 1)
        await dialog.getByRole('button', { name: t.category_add, exact: true }).click()
        await page.locator('[data-task-category-tab=' + JSON.stringify(createdCategory) + '][aria-pressed="true"]').waitFor()
        assert.equal(await quick.inputValue(), 'Synthetic category draft stays intact')
        assert.equal(await page.getByRole('combobox', { name: t.quickInput_category, exact: true }).inputValue(), createdCategory)
        await quick.press('Enter')
        await page.waitForFunction(name => JSON.parse(localStorage.getItem('anvilite-tasks')).state.tasks.some(task => task.title === 'Synthetic category draft stays intact' && task.category === name), createdCategory)
        let created = (await read('tasks')).tasks.find(task => task.title === 'Synthetic category draft stays intact')
        await row(created.id).getByText(created.title, { exact: true }).click()
        const form = page.locator('form').filter({ has: page.getByPlaceholder(t.taskDrawer_titlePlaceholder, { exact: true }) })
        await form.waitFor()
        assert.equal(await form.getByRole('button', { name: t.task_waitingAction, exact: true }).count(), 0)
        await form.getByPlaceholder(t.taskDrawer_titlePlaceholder, { exact: true }).fill('Synthetic drawer draft also stays intact')
        const taskCount = (await read('tasks')).tasks.length
        await form.locator('[data-create-category]').click()
        await dialog.locator('input').fill(drawerCategory)
        await snap('drawer-category-modal')
        await dialog.getByRole('button', { name: t.category_add, exact: true }).click()
        assert.equal(await form.getByPlaceholder(t.taskDrawer_titlePlaceholder, { exact: true }).inputValue(), 'Synthetic drawer draft also stays intact')
        assert.equal((await read('tasks')).tasks.length, taskCount, 'Category submit must not submit the task form')
        await form.getByRole('button', { name: t.taskDrawer_save, exact: true }).click()
        created = (await read('tasks')).tasks.find(task => task.id === created.id)
        assert.equal(created.title, 'Synthetic drawer draft also stays intact'); assert.equal(created.category, drawerCategory)
        await page.locator('[data-task-category-tab="ALL"]').click()
        await snap('task-list-long-categories')
        await row('mutation').locator('button:not([draggable])').first().click()
        await page.waitForFunction(() => JSON.parse(localStorage.getItem('anvilite-tasks')).state.tasks.find(task => task.id === 'mutation').status === 'done')
        await page.waitForTimeout(700)
        await go('dashboard'); await calendarTotals(3, 85, 5, 120)
        await row('mutation').getByText('Synthetic mutation task', { exact: true }).click()
        await form.waitFor()
        await form.locator('input[type="number"][min="0"]').fill('25')
        await form.getByRole('button', { name: t.taskDrawer_save, exact: true }).click()
        await calendarTotals(3, 100, 5, 135)
        await snap('trend-edited-duration', growth())
        await row('mutation').locator('button:not([draggable])').first().click()
        await calendarTotals(2, 75, 4, 110)
        await page.waitForTimeout(700)
        await row('current').scrollIntoViewIfNeeded()
        await page.waitForTimeout(200)
        await row('current').click({ button: 'right' })
        await page.getByRole('button', { name: t.task_delete, exact: true }).last().click()
        await calendarTotals(1, 45, 3, 80)
        await page.evaluate(() => {
          const stored = JSON.parse(localStorage.getItem('anvilite-tasks'))
          stored.state.tasks = stored.state.tasks.filter(task => task.status !== 'done')
          localStorage.setItem('anvilite-tasks', JSON.stringify(stored))
        })
        await page.reload({ waitUntil: 'networkidle' })
        await calendarTotals(0, 0, 0, 0)
        await noOverflow()
        await snap('trend-empty', growth())
        assert.equal(await page.evaluate(() => document.documentElement.getAttribute('data-theme') || 'dawn-white'), theme)
        assert.deepEqual(pageErrors, []); assert.deepEqual(consoleErrors, [])
        result = { language, width, height, theme, fixedLocalDate: '2026-11-01', timezone: 'Europe/Berlin',
          initialCalendarTotals: { month: { count: 2, minutes: 75 }, week: { count: 4, minutes: 110 } }, initialLayout,
          summaryUIAbsent: true, heatmapAndFourSwitchesRetained: true, crossMonthMondayWeek: true, hiddenIncludedDeletedExcluded: true,
          quickCreateButtonsRemoved: true, tabsCreateAfterOther: true, categoryDraftPreserved: true, categorySelectedForEnter: true,
          drawerCategoryStillAvailable: true, portalDoesNotSubmitParent: true, newCompletion: true, editedDuration: true, undo: true, deletion: true,
          zeroState: true, longTabsScroll: true, noHorizontalOverflow: true, pageErrors, consoleErrors }
        checks.push(result)
        console.log(JSON.stringify({ language, width, theme, passed: true }))
      } catch (error) {
        await snap('failure').catch(() => {})
        fs.writeFileSync(path.join(output, `${language}-${width}-failure.json`), JSON.stringify({ error: String(error), stack: error.stack, body: await page.locator('body').innerText().catch(() => ''), pageErrors, consoleErrors, tasks: await read('tasks').catch(() => null) }, null, 2))
        throw error
      } finally { await context.close() }
    }
    const index = fs.readFileSync(path.join(dist, 'index.html'), 'utf8')
    const report = { browser: 'Microsoft Edge (isolated headless contexts)', syntheticDataOnly: true, loopbackAssetsOnly: true,
      fixedTime, timezone: 'Europe/Berlin', bundle: index.match(/src="\.\/([^"]+\.js)"/)?.[1], checks, screenshots }
    fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2))
    console.log(JSON.stringify({ combinations: checks.length, screenshots: screenshots.length, report: path.join(output, 'report.json') }))
  } finally {
    if (browser) await browser.close()
    await new Promise(resolve => server.close(resolve))
  }
})().catch(error => { console.error(error); process.exitCode = 1 })
