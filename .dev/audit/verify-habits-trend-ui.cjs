const fs = require('node:fs')
const path = require('node:path')
const http = require('node:http')
const assert = require('node:assert/strict')
const { chromium } = require('playwright')
const root = path.resolve(__dirname, '../..')
const dist = path.join(root, 'dist')
const output = path.join(__dirname, 'habits-trend-ui-2026-10-22')
fs.mkdirSync(output, { recursive: true })

function translations(language) {
  const source = fs.readFileSync(path.join(root, 'src/i18n', language + '.ts'), 'utf8')
  return Object.fromEntries([
    'dash_tasks', 'dash_habits', 'dash_growth', 'dash_filterAll', 'dash_filterSingle', 'dash_filterMultiple',
    'dash_filterClose', 'dash_filterNone', 'dash_editLayout', 'dash_doneEditing', 'dash_addCard', 'dash_addHabitCard',
    'dash_resetLayout', 'quickInput_category', 'dashboard_waitingDropHint', 'card_waiting',
    'areaName_home', 'areaName_forge', 'common_undo', 'heatmap_countMetric', 'heatmap_timeMetric', 'heatmap_month',
    'heatmap_week', 'taskDrawer_titlePlaceholder', 'taskDrawer_save', 'data_export', 'data_importConfirm',
  ].map(key => {
    const match = source.match(new RegExp('\\b' + key + ':\\s*([\\x22\\x27])(.*?)\\1'))
    assert.ok(match, 'Missing translation: ' + language + '.' + key)
    return [key, match[2]]
  }))
}

const server = http.createServer((req, res) => {
  const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname)
  const file = path.resolve(dist, '.' + (pathname === '/' ? '/index.html' : pathname))
  if (!file.startsWith(dist + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
    res.writeHead(404).end(); return
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
    browser = await chromium.launch({ channel: 'msedge', headless: true, args: [
      '--disable-background-networking', '--disable-component-update', '--no-first-run',
    ] })
    for (const language of ['zh', 'en']) for (const [width, height] of [[900, 600], [1280, 800]]) {
      const labels = translations(language)
      const theme = width === 900 ? 'dawn-white' : 'forge-purple'
      const customName = language === 'zh' ? '自建协作分类与长期研究反馈' : 'Custom collaboration and long-term research'
      const titles = language === 'zh' ? {
        todo: '准备下一次项目讨论', doing: '正在核对合作清单', waiting: '等待合作方回信', custom: '整理自建项目材料',
        zero: '已经完成但未计时的事项', timed: '已经完成的半小时研究任务', yesterday: '昨天整理资料',
        hidden: '隐藏事项', deleted: '已删除的完成事项',
        homeHabit: '安排每日家庭事务', forgeHabit: '整理今日工作进展', customHabit: '跟进跨团队研究',
        hiddenHabit: '隐藏的每日习惯', deletedHabit: '已删除的每日习惯', doneHabit: '今天已经完成的例行事项',
      } : {
        todo: 'Prepare the next project discussion', doing: 'Reviewing the collaboration checklist',
        waiting: 'Awaiting the collaborator reply', custom: 'Collect custom project material',
        zero: 'A completed task without recorded time', timed: 'Completed half-hour research task', yesterday: 'Organize references yesterday',
        hidden: 'Hidden task', deleted: 'Deleted completion',
        homeHabit: 'Arrange daily family tasks', forgeHabit: 'Review today work progress', customHabit: 'Follow up cross-team research',
        hiddenHabit: 'Hidden daily habit', deletedHabit: 'Deleted daily habit', doneHabit: 'A routine already completed today',
      }
      const context = await browser.newContext({ viewport: { width, height }, locale: language === 'zh' ? 'zh-CN' : 'en-US' })
      const page = await context.newPage()
      page.setDefaultTimeout(14000)
      const errors = []
      const consoleErrors = []
      page.on('pageerror', error => errors.push(error.message))
      page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()) })
      await page.route('**/*', route => route.request().url().startsWith(origin + '/') ? route.continue() : route.abort())
      await page.addInitScript(({ language, theme, customName, titles }) => {
        window.electronAPI = { saveFile: async content => { window.__habitsTrendExport = content; return { success: true } } }
        if (sessionStorage.getItem('habits-trend-probe-seeded')) {
          window.__habitsTrendDates = JSON.parse(sessionStorage.getItem('habits-trend-probe-dates'))
          return
        }
        sessionStorage.setItem('habits-trend-probe-seeded', 'true')
        localStorage.clear()
        const now = new Date()
        const key = date => date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0') + '-' + String(date.getDate()).padStart(2, '0')
        const today = key(now)
        const previous = new Date(now); previous.setDate(now.getDate() - 1)
        const yesterday = key(previous)
        window.__habitsTrendDates = { today, yesterday }
        sessionStorage.setItem('habits-trend-probe-dates', JSON.stringify(window.__habitsTrendDates))
        const at = (date, hour) => {
          const value = new Date(date + 'T00:00:00'); value.setHours(hour); return value.toISOString()
        }
        const timestamp = now.toISOString()
        for (const name of ['anvilite-subtask-migration-v3', 'anvilite-migration-timer-tags-v031',
          'anvilite-subhabit-migration-v3', 'anvilite-migration-habit-timer-v031']) {
          localStorage.setItem(name, 'synthetic-current-format')
        }
        localStorage.setItem('anvilite-settings', JSON.stringify({ state: { settings: {
          theme, language, dashboardLayout: [], unlockedThemes: ['dawn-white', 'forge-purple'], characterName: 'Synthetic',
        } }, version: 0 }))
        localStorage.setItem('anvilite-character', JSON.stringify({ state: { character: {
          name: 'Synthetic', level: 1, currentXP: 0, totalXP: 0, ore: 0, totalOreEarned: 0, titlePreset: 'forge',
          customTitles: null, streakDays: 0, lastActiveDate: null, globalStatus: 'active', prestigeLevel: 0,
          xpFormulaVersion: 2, createdAt: timestamp,
        } }, version: 0 }))
        const areas = [['home', '家园'], ['arena', '竞技场'], ['library', '藏书阁'], ['workshop', '灵感工坊'],
          ['forge', '锻造坊'], ['milestone', '档案馆']].map(([templateId, name], sortOrder) => ({
          id: 'area-' + templateId, templateId, name, category: templateId === 'milestone' ? '_milestone' : templateId,
          position: { x: 100 + sortOrder * 100, y: 200 }, sortOrder, isPreset: true, canDelete: templateId !== 'home' && templateId !== 'milestone',
          canMove: false, createdAt: timestamp,
        }))
        areas.push({ id: 'area-custom', templateId: null, name: customName, category: 'custom-synthetic', position: { x: 800, y: 500 },
          sortOrder: areas.length, isPreset: false, canDelete: true, canMove: true, createdAt: timestamp })
        localStorage.setItem('anvilite-areas', JSON.stringify({ state: { areas }, version: 0 }))
        const task = (id, title, category, status = 'todo', patch = {}) => ({
          id, title, category, status, priority: 'medium', difficulty: 1, description: 'Synthetic browser probe data', dueDate: null,
          actualMinutes: 0, xpReward: 0, completedAt: null, deletedAt: null, isHidden: false,
          timerStartedAt: null, timerAccumulated: 0, tags: [], subTasks: [], sortOrder: 1, createdAt: timestamp, updatedAt: timestamp, ...patch,
        })
        localStorage.setItem('anvilite-tasks', JSON.stringify({ state: { tasks: [
          task('t-home', titles.todo, 'home'),
          task('t-forge', titles.doing, 'forge', 'doing'),
          task('t-custom', titles.custom, 'custom-synthetic'),
          task('t-waiting', titles.waiting, 'home', 'waiting'),
          task('t-zero', titles.zero, 'home', 'done', { completedAt: at(today, 9), completionId: 'completion-zero' }),
          task('t-timed', titles.timed, 'forge', 'done', { completedAt: at(today, 15), completionId: 'completion-timed', actualMinutes: 30 }),
          task('t-yesterday', titles.yesterday, 'custom-synthetic', 'done', { completedAt: at(yesterday, 21), actualMinutes: 15 }),
          task('t-hidden', titles.hidden, 'forge', 'todo', { isHidden: true }),
          task('t-deleted', titles.deleted, 'forge', 'done', { completedAt: at(today, 10), deletedAt: timestamp, actualMinutes: 100 }),
        ], lastCategory: 'home', completedViewMode: 'month', customTaskGroups: [] }, version: 0 }))
        const habit = (id, title, category, patch = {}) => ({
          id, title, category, difficulty: 1, estimatedMinutes: 0, repeatType: 'daily', customIntervalDays: null, weeklyDays: null,
          weeklyMode: null, weeklyFlexibleCount: null, monthlyDays: null, targetCount: 1, currentCycleCount: 0,
          startDate: today, endDate: null, reminderTime: null, description: 'Synthetic daily routine', subHabits: [],
          status: 'active', isHidden: false, deletedAt: null, timerStartedAt: null, timerAccumulated: 0, actualMinutes: 0,
          consecutiveCount: 0, totalCompletions: 0, toleranceCharges: 0, toleranceNextAt: 0, weeklyCompletionCount: 0,
          lastCompletedAt: null, lastDueAt: null, sortOrder: 0, cycleKey: today, lastMissCheckDate: yesterday, lastAction: null,
          createdAt: timestamp, updatedAt: timestamp, ...patch,
        })
        localStorage.setItem('anvilite-habits', JSON.stringify({ state: { habits: [
          habit('h-home', titles.homeHabit, 'home'),
          habit('h-forge', titles.forgeHabit, 'forge', { sortOrder: 1 }),
          habit('h-custom', titles.customHabit, 'custom-synthetic', { sortOrder: 2 }),
          habit('h-hidden', titles.hiddenHabit, 'forge', { isHidden: true, sortOrder: 3 }),
          habit('h-deleted', titles.deletedHabit, 'home', { deletedAt: timestamp, sortOrder: 4 }),
          habit('h-done', titles.doneHabit, 'home', { status: 'completed_today', currentCycleCount: 1, totalCompletions: 1,
            lastCompletedAt: timestamp, lastDueAt: timestamp, sortOrder: 5 }),
        ], completedHabitViewMode: 'area', customHabitGroups: [] }, version: 0 }))
        localStorage.setItem('anvilite-growth-events', JSON.stringify({ state: { events: [
          { id: 'unrelated-habit-reward', type: 'habit_complete', title: 'Synthetic unrelated habit XP', timestamp,
            details: { xpGained: 999999, entityId: 'unrelated-entity' }, isMilestone: false },
          { id: 'unrelated-sop-reward', type: 'sop_complete', title: 'Synthetic unrelated SOP XP', timestamp,
            details: { xpGained: 999999 }, isMilestone: false },
        ] }, version: 0 }))
        localStorage.setItem('anvilite-dashboard', JSON.stringify({ state: { layout: [
          { id: 'quickAdd', col: 0, row: 0, colSpan: 24, rowSpan: 2 },
          { id: 'tasks', col: 0, row: 2, colSpan: 12, rowSpan: 4 },
          { id: 'habits', col: 12, row: 2, colSpan: 12, rowSpan: 4 },
          { id: 'tasks:extra', col: 0, row: 6, colSpan: 12, rowSpan: 4 },
          { id: 'habits:extra', col: 12, row: 6, colSpan: 12, rowSpan: 4 },
          { id: 'growth', col: 0, row: 10, colSpan: 24, rowSpan: 5 },
          { id: 'waiting', col: 0, row: 15, colSpan: 24, rowSpan: 3 },
        ], visibleCards: ['quickAdd', 'tasks', 'habits', 'tasks:extra', 'habits:extra', 'growth'] }, version: 3 }))
      }, { language, theme, customName, titles })

      const card = id => page.locator('[data-dashboard-card=' + JSON.stringify(id) + ']')
      const dialog = id => page.locator('[data-task-card-filter=' + JSON.stringify(id) + ']')
      const read = key => page.evaluate(key => JSON.parse(localStorage.getItem(key))?.state, key)
      const dashboard = () => read('anvilite-dashboard')
      const tasks = async () => (await read('anvilite-tasks')).tasks
      const habits = async () => (await read('anvilite-habits')).habits
      const xp = async () => (await read('anvilite-character')).character.totalXP
      const openFilter = async id => { await page.locator('[data-filter-trigger=' + JSON.stringify(id) + ']').click(); await dialog(id).waitFor() }
      const closeFilter = async id => { await dialog(id).getByRole('button', { name: labels.dash_filterClose, exact: true }).click(); await dialog(id).waitFor({ state: 'detached' }) }
      const selectMode = async (id, label) => dialog(id).getByRole('radio', { name: label, exact: true }).check()
      const selectCategory = async (id, value, checked = true) => {
        const input = dialog(id).locator('input[value=' + JSON.stringify(value) + ']')
        if (checked) await input.check(); else await input.uncheck()
      }
      const rows = async (id, kind, expected) => {
        await page.waitForFunction(({ id, kind, expected }) => {
          const node = [...document.querySelectorAll('[data-dashboard-card]')].find(item => item.getAttribute('data-dashboard-card') === id)
          if (!node) return false
          const actual = [...node.querySelectorAll('[data-' + kind + '-id]')].map(item => item.getAttribute('data-' + kind + '-id')).sort()
          return JSON.stringify(actual) === JSON.stringify([...expected].sort())
        }, { id, kind, expected })
      }
      const settle = async () => { await page.mouse.move(5, 5); await page.waitForTimeout(650) }
      const waitForToasts = async () => page.waitForFunction(() => {
        const host = [...document.querySelectorAll('div')].find(node =>
          node.style.position === 'fixed' && node.style.bottom === '48px' && node.style.zIndex === '9999')
        return !host || host.children.length === 0
      })
      const top = async () => page.evaluate(() => { document.querySelectorAll('*').forEach(node => { if (node.scrollTop) node.scrollTop = 0 }) })
      const picker = async () => { await page.getByRole('button', { name: labels.dash_addCard, exact: true }).click(); await page.locator('[data-add-habit-card]').waitFor() }
      const changeFilter = async (id, mode, categories) => {
        await openFilter(id)
        await selectMode(id, mode)
        for (const category of categories) await selectCategory(id, category)
        await closeFilter(id)
      }
      const titleOf = id => card(id).evaluate(node => node.firstElementChild.firstElementChild.querySelector('span').textContent)
      const value = async (date, attribute = 'data-trend-value') => card('growth').locator('[data-trend-date=' + JSON.stringify(date) + ']').evaluateAll(
        (nodes, attribute) => nodes.reduce((total, node) => total + Number(node.getAttribute(attribute)), 0), attribute)
      const assertTrend = async (date, count, minutes, expectedValue) => {
        await page.waitForFunction(({ date, count, minutes, expectedValue }) => {
          const chart = document.querySelector('[data-dashboard-card="growth"]')
          if (!chart) return false
          const cells = [...chart.querySelectorAll('[data-trend-date]')].filter(node => node.getAttribute('data-trend-date') === date)
          const sum = attribute => cells.reduce((total, node) => total + Number(node.getAttribute(attribute)), 0)
          return cells.length > 0 && sum('data-trend-count') === count && sum('data-trend-minutes') === minutes && sum('data-trend-value') === expectedValue
        }, { date, count, minutes, expectedValue })
        assert.equal(await value(date, 'data-trend-count'), count)
        assert.equal(await value(date, 'data-trend-minutes'), minutes)
        assert.equal(await value(date), expectedValue)
      }

      try {
        await page.goto(origin, { waitUntil: 'networkidle' })
        const dates = await page.evaluate(() => window.__habitsTrendDates)
        const taskAll = ['t-home', 't-forge', 't-custom', 't-zero', 't-timed']
        const habitAll = ['h-home', 'h-forge', 'h-custom', 'h-done']
        await rows('tasks', 'task', taskAll)
        await rows('tasks:extra', 'task', taskAll)
        await rows('habits', 'habit', habitAll)
        await rows('habits:extra', 'habit', habitAll)
        assert.equal(await titleOf('tasks'), labels.dash_tasks)
        assert.equal(await titleOf('tasks:extra'), labels.dash_tasks)
        assert.equal(await titleOf('habits'), labels.dash_habits)
        assert.equal(await titleOf('habits:extra'), labels.dash_habits)
        assert.equal(await titleOf('growth'), labels.dash_growth)
        assert.equal(await card('quickAdd').locator('label > span').count(), 0, 'Quick input shows only the category name')
        await card('quickAdd').getByRole('combobox', { name: labels.quickInput_category, exact: true }).selectOption('custom-synthetic')
        assert.equal(await card('quickAdd').locator('label').getAttribute('title'), customName)
        const originalTaskCategories = Object.fromEntries((await tasks()).map(item => [item.id, item.category]))
        const originalHabitCategories = Object.fromEntries((await habits()).map(item => [item.id, item.category]))

        await changeFilter('tasks', labels.dash_filterSingle, ['forge'])
        await rows('tasks', 'task', ['t-forge', 't-timed'])
        await rows('tasks:extra', 'task', taskAll)
        assert.equal((await page.locator('[data-filter-trigger="tasks"]').innerText()).trim(), labels.areaName_forge + ' ▾')
        await changeFilter('tasks:extra', labels.dash_filterMultiple, ['home', 'custom-synthetic'])
        await rows('tasks:extra', 'task', ['t-home', 't-custom', 't-zero'])
        const taskSummary = await page.locator('[data-filter-trigger="tasks:extra"]').innerText()
        assert.ok(taskSummary.includes(labels.areaName_home) && taskSummary.includes(customName))
        assert.ok(!/^(分类|Categories):|已选\s*\d|\d+\s+categories selected/.test(taskSummary))
        await openFilter('tasks:extra')
        await selectCategory('tasks:extra', 'home', false); await selectCategory('tasks:extra', 'custom-synthetic', false)
        await closeFilter('tasks:extra')
        await rows('tasks:extra', 'task', [])
        assert.deepEqual((await dashboard()).layout.find(item => item.id === 'tasks:extra').taskFilter, { mode: 'multiple', categories: [] })
        await changeFilter('tasks:extra', labels.dash_filterAll, [])
        await rows('tasks:extra', 'task', taskAll)
        await changeFilter('tasks', labels.dash_filterAll, [])
        await rows('tasks', 'task', taskAll)

        await changeFilter('habits', labels.dash_filterSingle, ['forge'])
        await rows('habits', 'habit', ['h-forge'])
        await rows('habits:extra', 'habit', habitAll)
        assert.equal((await page.locator('[data-filter-trigger="habits"]').innerText()).trim(), labels.areaName_forge + ' ▾')
        await changeFilter('habits:extra', labels.dash_filterMultiple, ['home', 'custom-synthetic'])
        await rows('habits:extra', 'habit', ['h-home', 'h-custom', 'h-done'])
        const habitSummary = await page.locator('[data-filter-trigger="habits:extra"]').innerText()
        assert.ok(habitSummary.includes(labels.areaName_home) && habitSummary.includes(customName))
        assert.ok(!/^(分类|Categories):|已选\s*\d|\d+\s+categories selected/.test(habitSummary))
        await openFilter('habits:extra')
        await selectCategory('habits:extra', 'home', false); await selectCategory('habits:extra', 'custom-synthetic', false)
        await closeFilter('habits:extra')
        await rows('habits:extra', 'habit', [])
        assert.deepEqual((await dashboard()).layout.find(item => item.id === 'habits:extra').habitFilter, { mode: 'multiple', categories: [] })
        await changeFilter('habits:extra', labels.dash_filterAll, [])
        await changeFilter('habits', labels.dash_filterAll, [])
        await rows('habits', 'habit', habitAll)
        await rows('habits:extra', 'habit', habitAll)
        assert.deepEqual(Object.fromEntries((await tasks()).map(item => [item.id, item.category])), originalTaskCategories)
        assert.deepEqual(Object.fromEntries((await habits()).map(item => [item.id, item.category])), originalHabitCategories)

        const xpBefore = await xp()
        const completionButtons = await page.locator('[data-habit-complete="h-forge"]').count()
        assert.equal(completionButtons, 2)
        // Exercise the real button callbacks from both cards in one browser event turn.
        await page.locator('[data-habit-complete="h-forge"]').evaluateAll(buttons => buttons.forEach(button => button.click()))
        await page.waitForFunction(() => JSON.parse(localStorage.getItem('anvilite-habits')).state.habits.find(item => item.id === 'h-forge').status === 'completed_today')
        await settle()
        const completed = (await habits()).find(item => item.id === 'h-forge')
        assert.ok(completed.lastAction && completed.lastAction.xp > 0)
        assert.equal((await xp()) - xpBefore, completed.lastAction.xp)
        assert.equal((await read('anvilite-growth-events')).events.filter(event => event.type === 'habit_complete' && event.details.entityId === 'h-forge').length, 1)
        for (const id of ['habits', 'habits:extra']) assert.equal(await card(id).locator('[data-habit-id="h-forge"][data-habit-status="completed_today"]').count(), 1)
        const completedRow = card('habits').locator('[data-habit-id="h-forge"][data-habit-status="completed_today"]')
        await completedRow.hover()
        await completedRow.getByRole('button', { name: new RegExp(labels.common_undo) }).click()
        await page.waitForFunction(() => JSON.parse(localStorage.getItem('anvilite-habits')).state.habits.find(item => item.id === 'h-forge').status === 'active')
        await settle()
        assert.equal(await xp(), xpBefore)
        for (const id of ['habits', 'habits:extra']) assert.equal(await card(id).locator('[data-habit-id="h-forge"][data-habit-status="active"]').count(), 1)
        assert.equal((await read('anvilite-growth-events')).events.filter(event => event.details.entityId === 'h-forge').length, 0)

        await assertTrend(dates.today, 2, 30, 2)
        assert.equal(await value(dates.yesterday), 1)
        assert.equal(await value(dates.today, 'data-trend-count'), 2, 'Habit and SOP XP events do not add task completions')
        await card('growth').getByRole('button', { name: labels.heatmap_timeMetric, exact: true }).click()
        await assertTrend(dates.today, 2, 30, 30)
        await card('growth').getByRole('button', { name: labels.heatmap_week, exact: true }).click()
        assert.equal(await card('growth').locator('[data-trend-range]').getAttribute('data-trend-range'), 'week')
        await assertTrend(dates.today, 2, 30, 30)
        await card('growth').getByRole('button', { name: labels.heatmap_countMetric, exact: true }).click()
        await assertTrend(dates.today, 2, 30, 2)
        await card('growth').getByRole('button', { name: labels.heatmap_month, exact: true }).click()
        await card('growth').getByRole('button', { name: labels.heatmap_timeMetric, exact: true }).click()
        await card('growth').scrollIntoViewIfNeeded()
        await settle()
        await waitForToasts()
        await page.screenshot({ path: path.join(output, language + '-' + width + '-trend.png'), fullPage: true })

        await card('tasks').getByText(titles.timed, { exact: true }).click()
        const form = page.locator('form').filter({ has: page.getByPlaceholder(labels.taskDrawer_titlePlaceholder, { exact: true }) })
        await form.waitFor()
        await form.locator('input[type="number"]').fill('45')
        await form.getByRole('button', { name: labels.taskDrawer_save, exact: true }).click()
        await form.waitFor({ state: 'detached' })
        await assertTrend(dates.today, 2, 45, 45)
        await card('tasks').locator('[data-task-id="t-timed"]').locator('button').first().click()
        await page.waitForFunction(() => JSON.parse(localStorage.getItem('anvilite-tasks')).state.tasks.find(item => item.id === 't-timed').status === 'todo')
        await assertTrend(dates.today, 1, 0, 0)
        await card('growth').getByRole('button', { name: labels.heatmap_countMetric, exact: true }).click()
        await assertTrend(dates.today, 1, 0, 1)

        await changeFilter('tasks', labels.dash_filterSingle, ['forge'])
        await changeFilter('tasks:extra', labels.dash_filterMultiple, ['home', 'custom-synthetic'])
        await changeFilter('habits', labels.dash_filterSingle, ['forge'])
        await changeFilter('habits:extra', labels.dash_filterMultiple, ['home', 'custom-synthetic'])
        await openFilter('habits:extra')
        await waitForToasts()
        await page.screenshot({ path: path.join(output, language + '-' + width + '-filter.png'), fullPage: true })
        await closeFilter('habits:extra')
        await page.getByRole('button', { name: labels.dash_editLayout, exact: true }).click()
        const beforeAdd = await dashboard()
        const oldIds = beforeAdd.layout.map(item => item.id)
        await picker(); await page.locator('[data-add-habit-card]').click()
        await picker(); await page.locator('[data-add-habit-card]').click()
        const afterAdd = await dashboard()
        const added = afterAdd.layout.filter(item => !oldIds.includes(item.id))
        assert.equal(added.length, 2)
        assert.equal(new Set(added.map(item => item.id)).size, 2)
        assert.ok(added.every(item => item.id.startsWith('habits:')))
        assert.deepEqual(afterAdd.layout.filter(item => oldIds.includes(item.id)), beforeAdd.layout)
        for (const item of added) assert.equal(await titleOf(item.id), labels.dash_habits)
        await changeFilter(added[0].id, labels.dash_filterSingle, ['custom-synthetic'])
        await openFilter(added[1].id)
        await selectMode(added[1].id, labels.dash_filterMultiple)
        await closeFilter(added[1].id)
        const hiddenId = added[1].id
        const beforeHide = await dashboard()
        await card(hiddenId).hover()
        await card(hiddenId).getByTitle('移除卡片', { exact: true }).click()
        await card(hiddenId).waitFor({ state: 'detached' })
        assert.deepEqual((await dashboard()).layout, beforeHide.layout)
        await picker()
        await page.locator('[data-restore-card=' + JSON.stringify(hiddenId) + ']').click()
        await card(hiddenId).waitFor()
        assert.deepEqual((await dashboard()).layout, beforeHide.layout)
        await card(hiddenId).hover()
        await card(hiddenId).getByTitle('移除卡片', { exact: true }).click()
        await card(hiddenId).waitFor({ state: 'detached' })
        await picker()
        await page.locator('[data-restore-card="waiting"]').click()
        await card('waiting').waitFor()
        assert.ok(!(await card('waiting').innerText()).includes(labels.dashboard_waitingDropHint))
        assert.ok(!(await card('waiting').innerText()).includes('松开放入'))
        await page.getByRole('button', { name: labels.dash_doneEditing, exact: true }).click()
        assert.deepEqual(Object.fromEntries((await tasks()).map(item => [item.id, item.category])), originalTaskCategories)
        assert.deepEqual(Object.fromEntries((await habits()).map(item => [item.id, item.category])), originalHabitCategories)
        await top(); await settle()
        await waitForToasts()
        await page.screenshot({ path: path.join(output, language + '-' + width + '-dashboard.png'), fullPage: true })
        const expectedDashboard = await dashboard()
        await page.reload({ waitUntil: 'networkidle' })
        await card('habits:extra').waitFor()
        assert.deepEqual(await dashboard(), expectedDashboard)
        assert.equal(await card(hiddenId).count(), 0)
        assert.deepEqual(expectedDashboard.layout.find(item => item.id === hiddenId).habitFilter, { mode: 'multiple', categories: [] })

        const settings = language === 'zh' ? '设置' : 'Settings'
        await page.getByRole('button', { name: settings, exact: true }).click()
        await page.getByRole('button', { name: new RegExp(labels.data_export) }).click()
        await page.waitForFunction(() => typeof window.__habitsTrendExport === 'string')
        const exportedText = await page.evaluate(() => window.__habitsTrendExport)
        const exported = JSON.parse(exportedText)
        assert.deepEqual(exported.data.dashboard, expectedDashboard)
        await page.reload({ waitUntil: 'networkidle' })
        await page.getByRole('button', { name: labels.dash_editLayout, exact: true }).click()
        await page.getByRole('button', { name: labels.dash_resetLayout, exact: true }).click()
        assert.notDeepEqual(await dashboard(), expectedDashboard)
        await page.getByRole('button', { name: settings, exact: true }).click()
        await page.locator('input[type="file"]').setInputFiles({ name: 'synthetic-habits-trend-backup.json', mimeType: 'application/json', buffer: Buffer.from(exportedText) })
        await Promise.all([
          page.waitForNavigation({ waitUntil: 'networkidle' }),
          page.getByRole('button', { name: labels.data_importConfirm, exact: true }).click(),
        ])
        await card('habits:extra').waitFor()
        assert.deepEqual(await dashboard(), expectedDashboard)
        assert.equal(await card(hiddenId).count(), 0)
        await assertTrend(dates.today, 1, 0, 1)
        assert.equal(await titleOf('habits'), await titleOf('habits:extra'))
        assert.equal(await titleOf('tasks'), await titleOf('tasks:extra'))
        assert.deepEqual(errors, [])
        checks.push({ language, width, height, theme, compactCategoryNames: true, unnumberedCardTitles: true,
          independentTaskFilters: true, independentHabitFilters: true, emptyMultipleSelection: true, entityCategoriesUnchanged: true,
          sharedHabitCompletion: true, duplicateRewardPrevented: true, singleUndoRevokesOnce: true,
          repeatedHabitCards: true, hiddenCardRestore: true, geometryPreserved: true,
          completedTaskCounts: true, completedTaskMinutes: true, countAndTimeMonthWeek: true,
          unrelatedXPIgnored: true, completedDurationEdit: true, undoRemovesFromTrend: true,
          waitingIdleHintRemoved: true, coldRestart: true, fileExportImportReload: true,
          pageErrors: errors, consoleErrors })
        console.log(JSON.stringify({ language, width, theme, passed: true }))
      } catch (error) {
        await page.screenshot({ path: path.join(output, language + '-' + width + '-failure.png'), fullPage: true }).catch(() => {})
        fs.writeFileSync(path.join(output, language + '-' + width + '-failure.json'), JSON.stringify({
          error: String(error), pageErrors: errors, consoleErrors, dashboard: await dashboard().catch(() => null),
          body: await page.locator('body').innerText().catch(() => ''),
        }, null, 2))
        throw error
      } finally { await context.close() }
    }
    fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify({
      bundle: fs.readFileSync(path.join(dist, 'index.html'), 'utf8').match(/src="\.\/([^"]+\.js)"/)[1],
      browser: 'Microsoft Edge (isolated headless contexts)', syntheticDataOnly: true, localAssetsOnly: true, checks,
    }, null, 2))
    console.log(JSON.stringify({ combinations: checks.length, screenshots: checks.length * 3, pageErrors: 0, report: path.join(output, 'report.json') }))
  } finally {
    if (browser) await browser.close()
    await new Promise(resolve => server.close(resolve))
  }
})().catch(error => { console.error(error); process.exitCode = 1 })
