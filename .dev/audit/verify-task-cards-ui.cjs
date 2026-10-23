const fs = require('node:fs')
const path = require('node:path')
const http = require('node:http')
const assert = require('node:assert/strict')
const { chromium } = require('playwright')
const root = path.resolve(__dirname, '../..')
const dist = path.join(root, 'dist')
const output = path.join(__dirname, 'task-cards-ui-2026-10-22')
fs.mkdirSync(output, { recursive: true })

function translations(language) {
  const source = fs.readFileSync(path.join(root, 'src/i18n', language + '.ts'), 'utf8')
  const text = key => {
    const match = source.match(new RegExp('\\b' + key + ':\\s*([\\x22\\x27])(.*?)\\1'))
    assert.ok(match, 'Missing local translation: ' + language + '.' + key)
    return match[2]
  }
  return Object.fromEntries([
    'dash_filterAll', 'dash_filterSingle', 'dash_filterMultiple', 'dash_filterClose',
    'dash_editLayout', 'dash_doneEditing', 'dash_addCard', 'dash_addTaskCard',
    'dash_resetLayout', 'dash_restoreCard', 'dash_tasks', 'card_waiting', 'task_waiting',
    'quickInput_full', 'quickInput_category', 'taskDrawer_titlePlaceholder',
    'taskDrawer_create', 'taskDrawer_save', 'taskDrawer_cancel', 'taskPriority_low', 'taskPriority_urgent',
    'task_colorRed', 'task_colorBlue', 'task_colorCustom', 'task_colorAuto',
    'data_export', 'data_importConfirm',
  ].map(key => [key, text(key)]))
}

const server = http.createServer((req, res) => {
  const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname)
  const file = path.resolve(dist, '.' + (pathname === '/' ? '/index.html' : pathname))
  if (!file.startsWith(dist + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
    res.writeHead(404).end()
    return
  }
  res.setHeader('Content-Type', ({ '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' })[path.extname(file)] || 'application/octet-stream')
  fs.createReadStream(file).pipe(res)
})

;(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  const origin = 'http://127.0.0.1:' + server.address().port
  let browser
  const checks = []
  try {
    browser = await chromium.launch({ channel: 'msedge', headless: true,
      args: ['--disable-background-networking', '--disable-component-update', '--no-first-run'] })
    for (const language of ['zh', 'en']) for (const [width, height] of [[900, 600], [1280, 800]]) {
      const theme = width === 900 ? 'dawn-white' : 'forge-purple'
      const labels = translations(language)
      const customName = language === 'zh'
        ? '自建分类：跨团队协作、长期研究与反馈跟踪的长名称'
        : 'Custom category: cross-team collaboration, long-term research and follow-up'
      const titles = language === 'zh' ? {
        urgent: '今天提交合作方案（紧急）', high: '安排家庭日程（高）',
        medium: '整理长期研究材料（中）', low: '归档项目参考资料（低）',
        hidden: '已经隐藏的合成任务', waiting: '等待合作方回信',
        quick: '从快速创建加入自建分类', full: '从完整表单加入自建分类',
      } : {
        urgent: 'Submit the collaboration proposal (urgent)', high: 'Arrange the family schedule (high)',
        medium: 'Collect material for long-term research (medium)', low: 'Archive project references (low)',
        hidden: 'A hidden synthetic task', waiting: 'Awaiting the collaborator reply',
        quick: 'Quick task created in the custom category', full: 'Full-form task in the custom category',
      }
      const context = await browser.newContext({ viewport: { width, height }, locale: language === 'zh' ? 'zh-CN' : 'en-US' })
      const page = await context.newPage()
      page.setDefaultTimeout(12000)
      const errors = []
      const consoleErrors = []
      page.on('pageerror', error => errors.push(error.message))
      page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()) })
      await page.route('**/*', route => route.request().url().startsWith(origin + '/') ? route.continue() : route.abort())
      await page.addInitScript(({ language, theme, customName, titles }) => {
        window.electronAPI = { saveFile: async content => { window.__taskCardsExport = content; return { success: true } } }
        if (sessionStorage.getItem('task-cards-test-seeded')) return
        sessionStorage.setItem('task-cards-test-seeded', 'true')
        localStorage.clear()
        localStorage.setItem('anvilite-subtask-migration-v3', 'synthetic-current-format')
        localStorage.setItem('anvilite-migration-timer-tags-v031', 'synthetic-current-format')
        localStorage.setItem('anvilite-settings', JSON.stringify({ state: { settings: {
          theme, language, dashboardLayout: [], unlockedThemes: ['dawn-white', 'forge-purple'], characterName: 'Synthetic',
        } }, version: 0 }))
        const now = new Date().toISOString()
        const areas = [
          ['home', '家园'], ['arena', '竞技场'], ['library', '藏书阁'], ['workshop', '灵感工坊'],
          ['forge', '锻造坊'], ['milestone', '档案馆'],
        ].map(([templateId, name], sortOrder) => ({
          id: 'area-' + templateId, templateId, name, category: templateId === 'milestone' ? '_milestone' : templateId,
          position: { x: 100 + sortOrder * 100, y: 200 }, sortOrder, isPreset: true, canDelete: templateId !== 'home' && templateId !== 'milestone',
          canMove: false, createdAt: now,
        }))
        areas.push({ id: 'area-custom', templateId: null, name: customName, category: 'custom-synthetic',
          position: { x: 800, y: 500 }, sortOrder: areas.length, isPreset: false, canDelete: true, canMove: true, createdAt: now })
        localStorage.setItem('anvilite-areas', JSON.stringify({ state: { areas }, version: 0 }))
        const task = (id, title, category, priority, sortOrder, patch = {}) => ({
          id, title, category, priority, sortOrder, status: 'todo', difficulty: 3, description: 'Synthetic test data',
          dueDate: null, actualMinutes: 0, xpReward: 0, completedAt: null, deletedAt: null, isHidden: false,
          timerStartedAt: null, timerAccumulated: 0, tags: [], subTasks: [], createdAt: now, updatedAt: now, ...patch,
        })
        localStorage.setItem('anvilite-tasks', JSON.stringify({ state: {
          tasks: [
            task('urgent', titles.urgent, 'forge', 'urgent', 0),
            task('high', titles.high, 'home', 'high', 1),
            task('medium', titles.medium, 'custom-synthetic', 'medium', 2),
            task('low', titles.low, 'forge', 'low', 3),
            task('hidden', titles.hidden, 'forge', 'medium', 4, { isHidden: true }),
            task('waiting-reply', titles.waiting, 'custom-synthetic', 'medium', 5, { status: 'waiting' }),
          ], lastCategory: 'other', completedViewMode: 'month', customTaskGroups: [],
        }, version: 0 }))
        localStorage.setItem('anvilite-dashboard', JSON.stringify({ state: {
          layout: [
            { id: 'quickAdd', col: 0, row: 0, colSpan: 24, rowSpan: 2 },
            { id: 'tasks', col: 0, row: 2, colSpan: 12, rowSpan: 8 },
            { id: 'tasks:synthetic', col: 12, row: 2, colSpan: 12, rowSpan: 8 },
            // Keep waiting explicitly hidden rather than triggering its historical introduction migration.
            { id: 'waiting', col: 0, row: 10, colSpan: 24, rowSpan: 5 },
          ], visibleCards: ['quickAdd', 'tasks', 'tasks:synthetic'],
        }, version: 3 }))
      }, { language, theme, customName, titles })

      const card = id => page.locator('[data-dashboard-card=' + JSON.stringify(id) + ']')
      const storedDashboard = () => page.evaluate(() => JSON.parse(localStorage.getItem('anvilite-dashboard')).state)
      const storedTasks = () => page.evaluate(() => JSON.parse(localStorage.getItem('anvilite-tasks')).state.tasks)
      const storedAreas = () => page.evaluate(() => JSON.parse(localStorage.getItem('anvilite-areas')).state.areas)
      const filterDialog = id => page.locator('[data-task-card-filter=' + JSON.stringify(id) + ']')
      const openFilter = async id => {
        await page.locator('[data-filter-trigger=' + JSON.stringify(id) + ']').click()
        await filterDialog(id).waitFor()
      }
      const closeFilter = async id => {
        await filterDialog(id).getByRole('button', { name: labels.dash_filterClose, exact: true }).click()
        await filterDialog(id).waitFor({ state: 'detached' })
      }
      const mode = async (id, label) => filterDialog(id).getByRole('radio', { name: label, exact: true }).check()
      const choose = async (id, category, checked = true) => {
        const input = filterDialog(id).locator('input[value=' + JSON.stringify(category) + ']')
        if (checked) await input.check()
        else await input.uncheck()
      }
      const assertRows = async (id, expected) => {
        await page.waitForFunction(({ id, expected }) => {
          const card = [...document.querySelectorAll('[data-dashboard-card]')].find(el => el.getAttribute('data-dashboard-card') === id)
          if (!card) return false
          const actual = [...card.querySelectorAll('[data-task-id]')].map(el => el.getAttribute('data-task-id')).sort()
          return JSON.stringify(actual) === JSON.stringify([...expected].sort())
        }, { id, expected })
        const actual = await card(id).locator('[data-task-id]').evaluateAll(nodes => nodes.map(node => node.getAttribute('data-task-id')).sort())
        assert.deepEqual(actual, [...expected].sort())
      }
      const settle = async () => {
        await page.mouse.move(5, 5)
        await page.waitForTimeout(650) // Finish section exit/move animations before screenshots.
      }
      const scrollToTop = async () => page.evaluate(() => {
        document.querySelectorAll('*').forEach(element => { if (element.scrollTop) element.scrollTop = 0 })
      })
      const openPicker = async () => {
        await page.getByRole('button', { name: labels.dash_addCard, exact: true }).click()
        await page.locator('[data-add-task-card]').waitFor()
      }

      try {
        await page.goto(origin, { waitUntil: 'networkidle' })
        await card('tasks:synthetic').waitFor()
        await assertRows('tasks', ['urgent', 'high', 'medium', 'low'])
        await assertRows('tasks:synthetic', ['urgent', 'high', 'medium', 'low'])
        const initialAreas = await storedAreas()
        const initialCategories = Object.fromEntries((await storedTasks()).map(task => [task.id, task.category]))
        const initialColors = {}
        for (const priority of ['urgent', 'high', 'medium', 'low']) {
          initialColors[priority] = await card('tasks').locator('[data-task-id=' + JSON.stringify(priority) + ']').evaluate(el => getComputedStyle(el).backgroundColor)
        }
        assert.equal(new Set(Object.values(initialColors)).size, 4, 'Each priority must have a distinct computed background')
        assert.ok(Object.values(initialColors).every(value => value !== 'rgba(0, 0, 0, 0)' && value !== 'transparent'))
        assert.equal(await page.evaluate(() => document.documentElement.getAttribute('data-theme') || 'dawn-white'), theme)

        await openFilter('tasks')
        await mode('tasks', labels.dash_filterSingle)
        await choose('tasks', 'forge')
        await closeFilter('tasks')
        await assertRows('tasks', ['urgent', 'low'])
        await assertRows('tasks:synthetic', ['urgent', 'high', 'medium', 'low'])

        await openFilter('tasks:synthetic')
        await mode('tasks:synthetic', labels.dash_filterMultiple)
        await choose('tasks:synthetic', 'home')
        await choose('tasks:synthetic', 'custom-synthetic')
        await page.screenshot({ path: path.join(output, language + '-' + width + '-filter.png'), fullPage: true })
        await closeFilter('tasks:synthetic')
        await assertRows('tasks:synthetic', ['high', 'medium'])
        await assertRows('tasks', ['urgent', 'low'])
        assert.deepEqual(await storedAreas(), initialAreas)
        assert.deepEqual(Object.fromEntries((await storedTasks()).map(task => [task.id, task.category])), initialCategories)

        await openFilter('tasks:synthetic')
        await choose('tasks:synthetic', 'home', false)
        await choose('tasks:synthetic', 'custom-synthetic', false)
        await closeFilter('tasks:synthetic')
        await assertRows('tasks:synthetic', [])
        assert.deepEqual((await storedDashboard()).layout.find(item => item.id === 'tasks:synthetic').taskFilter, { mode: 'multiple', categories: [] })
        await openFilter('tasks:synthetic')
        await mode('tasks:synthetic', labels.dash_filterAll)
        await closeFilter('tasks:synthetic')
        await assertRows('tasks:synthetic', ['urgent', 'high', 'medium', 'low'])
        await assertRows('tasks', ['urgent', 'low'])
        await openFilter('tasks:synthetic')
        await mode('tasks:synthetic', labels.dash_filterMultiple)
        await choose('tasks:synthetic', 'home')
        await choose('tasks:synthetic', 'custom-synthetic')
        await closeFilter('tasks:synthetic')

        const quick = card('quickAdd')
        await quick.getByRole('combobox', { name: labels.quickInput_category, exact: true }).selectOption('custom-synthetic')
        await quick.getByRole('textbox').fill(titles.quick)
        await quick.getByRole('textbox').press('Enter')
        await page.waitForFunction(title => JSON.parse(localStorage.getItem('anvilite-tasks')).state.tasks.some(task => task.title === title), titles.quick)
        const quickTask = (await storedTasks()).find(task => task.title === titles.quick)
        assert.equal(quickTask.category, 'custom-synthetic')
        await assertRows('tasks:synthetic', ['high', 'medium', quickTask.id])
        assert.equal(await card('tasks').locator('[data-task-id=' + JSON.stringify(quickTask.id) + ']').count(), 0)

        await quick.getByRole('button', { name: labels.quickInput_full, exact: true }).click()
        const form = page.locator('form').filter({ has: page.getByPlaceholder(labels.taskDrawer_titlePlaceholder, { exact: true }) })
        await form.waitFor()
        const selectedCustom = form.getByRole('button', { name: customName, exact: true })
        await selectedCustom.waitFor({ state: 'visible' })
        await page.waitForFunction(name => [...document.querySelectorAll('form button')].some(el => el.textContent === name && getComputedStyle(el).backgroundColor !== 'rgba(0, 0, 0, 0)' && getComputedStyle(el).backgroundColor !== 'transparent'), customName)
        assert.notEqual(await selectedCustom.evaluate(el => getComputedStyle(el).backgroundColor), 'rgba(0, 0, 0, 0)', 'Full form must receive the quick-input category')
        await form.getByPlaceholder(labels.taskDrawer_titlePlaceholder, { exact: true }).fill(titles.full)
        await form.getByRole('button', { name: labels.task_colorRed, exact: true }).click()
        await form.getByRole('button', { name: labels.taskDrawer_create, exact: true }).click()
        await form.waitFor({ state: 'detached' })
        const fullTask = (await storedTasks()).find(task => task.title === titles.full)
        assert.ok(fullTask)
        assert.equal(fullTask.category, 'custom-synthetic')
        assert.match(fullTask.backgroundColor, /^#[0-9a-f]{6}$/i)
        await assertRows('tasks:synthetic', ['high', 'medium', quickTask.id, fullTask.id])

        await card('tasks').getByText(titles.urgent, { exact: true }).click()
        await form.waitFor()
        await form.getByRole('button', { name: labels.taskPriority_low, exact: true }).click()
        await form.getByRole('button', { name: labels.taskDrawer_save, exact: true }).click()
        await form.waitFor({ state: 'detached' })
        assert.equal((await storedTasks()).find(task => task.id === 'urgent').priority, 'low')
        await settle()
        const editedColor = await card('tasks').locator('[data-task-id="urgent"]').evaluate(el => getComputedStyle(el).backgroundColor)
        assert.notEqual(editedColor, initialColors.urgent)
        assert.equal(editedColor, initialColors.low)

        // Manual color is a separate choice and stays selected when priority changes.
        await card('tasks').getByText(titles.urgent, { exact: true }).click()
        await form.waitFor()
        await form.getByRole('button', { name: labels.task_colorBlue, exact: true }).click()
        assert.equal(await form.getByRole('button', { name: labels.task_colorBlue, exact: true }).getAttribute('aria-pressed'), 'true')
        const presetValue = await form.locator('input[type="color"]').inputValue()
        await form.getByRole('button', { name: labels.taskDrawer_save, exact: true }).click()
        await form.waitFor({ state: 'detached' })
        assert.equal((await storedTasks()).find(task => task.id === 'urgent').backgroundColor, fs.readFileSync(path.join(root, 'src/utils/taskPriority.ts'), 'utf8').match(/id: 'blue', value: '(#[0-9a-f]{6})'/i)[1])
        await settle()
        const presetColor = await card('tasks').locator('[data-task-id="urgent"]').evaluate(el => getComputedStyle(el).backgroundColor)
        assert.equal(presetColor, initialColors.medium)

        await card('tasks').getByText(titles.urgent, { exact: true }).click()
        await form.waitFor()
        await form.getByRole('button', { name: labels.taskPriority_urgent, exact: true }).click()
        assert.equal(await form.getByRole('button', { name: labels.task_colorBlue, exact: true }).getAttribute('aria-pressed'), 'true')
        assert.equal(await form.locator('input[type="color"]').inputValue(), presetValue)
        const customColor = '#4b6a87'
        const colorInput = form.locator('input[type="color"]')
        let colorInputMethod = 'fill'
        try { await colorInput.fill(customColor) } catch {
          // Chromium's native color picker cannot always be driven by fill.
          // Use its standard input/change events, preserving the React value tracker.
          colorInputMethod = 'native-input-and-change-events'
          await colorInput.evaluate((input, value) => {
            Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, value)
            input.dispatchEvent(new Event('input', { bubbles: true }))
            input.dispatchEvent(new Event('change', { bubbles: true }))
          }, customColor)
        }
        await page.waitForFunction(expected => {
          const input = document.querySelector('form input[type="color"]')
          return input && input.value === expected && !document.querySelector('form [data-task-color-preset][aria-pressed="true"]')
        }, customColor)
        await page.screenshot({ path: path.join(output, language + '-' + width + '-manual-color.png'), fullPage: true })
        await form.getByRole('button', { name: labels.taskDrawer_save, exact: true }).click()
        await form.waitFor({ state: 'detached' })
        assert.equal((await storedTasks()).find(task => task.id === 'urgent').priority, 'urgent')
        assert.equal((await storedTasks()).find(task => task.id === 'urgent').backgroundColor, customColor)
        await settle()
        const manualColorComputed = await card('tasks').locator('[data-task-id="urgent"]').evaluate(el => getComputedStyle(el).backgroundColor)
        assert.notEqual(manualColorComputed, presetColor)

        await page.getByRole('button', { name: labels.dash_editLayout, exact: true }).click()
        const beforeAdd = await storedDashboard()
        const oldIds = beforeAdd.layout.map(item => item.id)
        await openPicker()
        await page.getByRole('button', { name: new RegExp(labels.dash_addTaskCard) }).click()
        await openPicker()
        await page.getByRole('button', { name: new RegExp(labels.dash_addTaskCard) }).click()
        const afterAdd = await storedDashboard()
        const added = afterAdd.layout.filter(item => !oldIds.includes(item.id))
        assert.equal(added.length, 2)
        assert.equal(new Set(added.map(item => item.id)).size, 2)
        assert.ok(added.every(item => item.id.startsWith('tasks:')))
        assert.deepEqual(afterAdd.layout.filter(item => oldIds.includes(item.id)), beforeAdd.layout)
        assert.ok(added.every(item => afterAdd.visibleCards.includes(item.id)))
        const addedFirst = added[0].id
        const addedHidden = added[1].id
        await openFilter(addedFirst)
        await mode(addedFirst, labels.dash_filterSingle)
        await choose(addedFirst, 'home')
        await closeFilter(addedFirst)
        await openFilter(addedHidden)
        await mode(addedHidden, labels.dash_filterMultiple)
        await closeFilter(addedHidden)
        const beforeHide = await storedDashboard()
        await card(addedHidden).hover()
        await card(addedHidden).getByTitle('移除卡片', { exact: true }).click()
        await card(addedHidden).waitFor({ state: 'detached' })
        assert.deepEqual((await storedDashboard()).layout, beforeHide.layout)
        await openPicker()
        await page.locator('[data-restore-card="' + addedHidden + '"]').click()
        await card(addedHidden).waitFor()
        assert.deepEqual((await storedDashboard()).layout, beforeHide.layout)
        await card(addedHidden).hover()
        await card(addedHidden).getByTitle('移除卡片', { exact: true }).click()
        await card(addedHidden).waitFor({ state: 'detached' })

        await openPicker()
        await page.getByRole('button').filter({ hasText: labels.card_waiting }).filter({ hasText: labels.dash_restoreCard }).click()
        const waitingRow = card('waiting').locator('[data-task-id="waiting-reply"]')
        await waitingRow.waitFor()
        assert.equal(await waitingRow.getByText(labels.task_waiting, { exact: true }).count(), 0, 'Removed waiting status subtitle must stay absent')
        await page.getByRole('button', { name: labels.dash_doneEditing, exact: true }).click()
        assert.deepEqual(await storedAreas(), initialAreas)
        await scrollToTop()
        await settle()
        await page.screenshot({ path: path.join(output, language + '-' + width + '-dashboard.png'), fullPage: true })
        const expectedDashboard = await storedDashboard()
        await page.reload({ waitUntil: 'networkidle' })
        await card('tasks:synthetic').waitFor()
        assert.deepEqual(await storedDashboard(), expectedDashboard)
        await assertRows('tasks', ['urgent', 'low'])
        await assertRows('tasks:synthetic', ['high', 'medium', quickTask.id, fullTask.id])
        assert.equal(await card(addedHidden).count(), 0)
        assert.equal((await storedTasks()).find(task => task.id === 'urgent').backgroundColor, customColor)
        assert.equal(await card('tasks').locator('[data-task-id="urgent"]').evaluate(el => getComputedStyle(el).backgroundColor), manualColorComputed)
        assert.deepEqual(expectedDashboard.layout.find(item => item.id === addedHidden).taskFilter, { mode: 'multiple', categories: [] })

        const settings = language === 'zh' ? '设置' : 'Settings'
        await page.getByRole('button', { name: settings, exact: true }).click()
        await page.getByRole('button', { name: new RegExp(labels.data_export) }).click()
        await page.waitForFunction(() => typeof window.__taskCardsExport === 'string')
        const exportedText = await page.evaluate(() => window.__taskCardsExport)
        const exported = JSON.parse(exportedText)
        assert.deepEqual(exported.data.dashboard, expectedDashboard)
        await page.reload({ waitUntil: 'networkidle' })
        await page.getByRole('button', { name: labels.dash_editLayout, exact: true }).click()
        await page.getByRole('button', { name: labels.dash_resetLayout, exact: true }).click()
        assert.notDeepEqual(await storedDashboard(), expectedDashboard)
        await page.getByRole('button', { name: settings, exact: true }).click()
        await page.locator('input[type="file"]').setInputFiles({ name: 'synthetic-task-cards-backup.json', mimeType: 'application/json', buffer: Buffer.from(exportedText) })
        await Promise.all([
          page.waitForNavigation({ waitUntil: 'networkidle' }),
          page.getByRole('button', { name: labels.data_importConfirm, exact: true }).click(),
        ])
        await card('tasks:synthetic').waitFor()
        assert.deepEqual(await storedDashboard(), expectedDashboard)
        await assertRows('tasks', ['urgent', 'low'])
        await assertRows('tasks:synthetic', ['high', 'medium', quickTask.id, fullTask.id])
        assert.equal(await card(addedHidden).count(), 0)
        assert.equal((await storedTasks()).find(task => task.id === 'urgent').priority, 'urgent')
        assert.equal((await storedTasks()).find(task => task.id === 'urgent').backgroundColor, customColor)
        assert.equal(await card('tasks').locator('[data-task-id="urgent"]').evaluate(el => getComputedStyle(el).backgroundColor), manualColorComputed)
        await card('tasks').getByText(titles.urgent, { exact: true }).click()
        await form.waitFor()
        await form.getByRole('button', { name: labels.task_colorAuto, exact: true }).click()
        await form.getByRole('button', { name: labels.taskDrawer_save, exact: true }).click()
        await form.waitFor({ state: 'detached' })
        assert.equal((await storedTasks()).find(task => task.id === 'urgent').backgroundColor, null)
        await settle()
        assert.equal(await card('tasks').locator('[data-task-id="urgent"]').evaluate(el => getComputedStyle(el).backgroundColor), initialColors.urgent)
        assert.deepEqual(await storedAreas(), initialAreas)
        assert.deepEqual(errors, [])
        checks.push({ language, width, height, theme, independentFilters: true, singleMultipleAll: true,
          emptyMultipleSelection: true, hiddenTasksExcluded: true, categoriesUnchanged: true,
          quickCreationCategory: true, fullFormCategory: true, priorityColors: initialColors,
          editedPriorityColor: editedColor, manualPresetColor: true, manualCustomColor: customColor, manualComputedColor: manualColorComputed, colorInputMethod, manualColorRestartAndImport: true, resetToPriorityColor: true, repeatedCardCreation: true, uniqueCardIds: true,
          existingLayoutPreserved: true, hiddenCardRestore: true, filtersPersisted: true,
          waitingSubtitleRemoved: true, coldRestart: true, fileExportImportReload: true,
          pageErrors: errors, consoleErrors })
        console.log(JSON.stringify({ language, width, theme, passed: true }))
      } catch (error) {
        await page.screenshot({ path: path.join(output, language + '-' + width + '-failure.png'), fullPage: true }).catch(() => {})
        fs.writeFileSync(path.join(output, language + '-' + width + '-failure.json'), JSON.stringify({
          error: String(error), pageErrors: errors, consoleErrors,
          dashboard: await storedDashboard().catch(() => null),
          body: await page.locator('body').innerText().catch(() => ''),
        }, null, 2))
        throw error
      } finally { await context.close() }
    }
    fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify({
      browser: 'Microsoft Edge (isolated headless contexts)', syntheticDataOnly: true, localAssetsOnly: true, checks,
    }, null, 2))
    console.log(JSON.stringify({ combinations: checks.length, screenshots: checks.length * 3, pageErrors: 0,
      report: path.join(output, 'report.json') }))
  } finally {
    if (browser) await browser.close()
    await new Promise(resolve => server.close(resolve))
  }
})().catch(error => { console.error(error); process.exitCode = 1 })
