const fs = require('node:fs')
const path = require('node:path')
const http = require('node:http')
const assert = require('node:assert/strict')
const ts = require('typescript')
const root = path.resolve(__dirname, '../..')
const dist = path.join(root, 'dist')
const output = path.join(__dirname, 'morandi-ui-2026-10-22')
fs.mkdirSync(output, { recursive: true })

// Read the local production identities, including their preserved legacy aliases.
const compiled = ts.transpileModule(fs.readFileSync(path.join(root, 'src/utils/taskPriority.ts'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText
const localModule = { exports: {} }
new Function('exports', 'module', compiled)(localModule.exports, localModule)
const palette = localModule.exports.TASK_COLOR_PRESETS
assert.ok(Array.isArray(palette) && palette.length === 7)
assert.equal(palette.some(preset => preset.id === 'green'), false)
const gray = localModule.exports.getTaskColorPreset('#22c55e')
assert.equal(gray.id, 'gray')
assert.equal(localModule.exports.getTaskColorPreset('#4b6a87'), undefined)

const themeKeys = {
  'dawn-white': 'theme_name_dawn', 'mint-paper': 'theme_name_mint', parchment: 'theme_name_parchment',
  'slate-cloud': 'theme_name_slate', 'forge-purple': 'theme_name_forge', 'ore-cyan': 'theme_name_ore',
  'flame-cast': 'theme_name_flame', 'jade-forest': 'theme_name_jade',
}
function translations(language) {
  const source = fs.readFileSync(path.join(root, 'src/i18n', language + '.ts'), 'utf8')
  return Object.fromEntries([...new Set([
    'topbar_settings', 'settings_title', 'taskDrawer_titlePlaceholder', 'taskDrawer_cancel', 'taskDrawer_save',
    'task_colorGreen', 'task_colorGray', 'task_colorCustom', 'priority_urgent', 'priority_high', 'priority_medium',
    'priority_low', 'data_export', ...palette.map(preset => preset.labelKey), ...Object.values(themeKeys),
  ])].map(key => {
    const match = source.match(new RegExp('\\b' + key + ':\\s*([\\x22\\x27])(.*?)\\1'))
    assert.ok(match, 'Missing translation: ' + language + '.' + key)
    return [key, match[2]]
  }))
}
function rgb(text) {
  if (/^#[0-9a-f]{6}$/i.test(text)) return [1, 3, 5].map(index => parseInt(text.slice(index, index + 2), 16) / 255)
  if (text.startsWith('color(srgb ')) return text.slice(11).split(/[ /)]/).filter(Boolean).slice(0, 3).map(Number)
  const match = text.match(/^rgba?\(([^)]+)\)$/)
  assert.ok(match, 'Unsupported computed color: ' + text)
  return match[1].split(/[, /]+/).filter(Boolean).slice(0, 3).map(value => value.endsWith('%') ? parseFloat(value) / 100 : Number(value) / 255)
}
function luminance(color) {
  const channels = rgb(color).map(value => value <= 0.04045 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4))
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722
}
function contrast(first, second) {
  const a = luminance(first), b = luminance(second)
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)
}
function hue(color) {
  const [r, g, b] = rgb(color), max = Math.max(r, g, b), min = Math.min(r, g, b)
  const delta = max - min
  if (!delta) return 0
  const value = max === r ? (g - b) / delta : max === g ? (b - r) / delta + 2 : (r - g) / delta + 4
  return (value * 60 + 360) % 360
}

const server = http.createServer((req, res) => {
  const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname)
  const file = path.resolve(dist, '.' + (pathname === '/' ? '/index.html' : pathname))
  if (!file.startsWith(dist + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404).end(); return }
  res.setHeader('Content-Type', ({ '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' })[path.extname(file)] || 'application/octet-stream')
  fs.createReadStream(file).pipe(res)
})

;(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  const origin = 'http://127.0.0.1:' + server.address().port
  const { chromium } = require('playwright')
  const checks = []
  const violations = []
  let browser
  try {
    browser = await chromium.launch({ channel: 'msedge', headless: true,
      args: ['--disable-background-networking', '--disable-component-update', '--no-first-run'] })
    for (const language of ['zh', 'en']) for (const [width, height] of [[900, 600], [1280, 800]]) {
      const labels = translations(language)
      const initialTheme = width === 900 ? 'dawn-white' : 'forge-purple'
      const titles = language === 'zh' ? {
        urgent: '紧急：提交合作方案', high: '高优先级：安排重要反馈', medium: '中优先级：整理研究材料', low: '低优先级：归档参考资料',
        legacy: '旧版绿色预设：保持原始备份值', preset: '莫兰迪预设：随主题调整', manual: '自选底色：保留 #4b6a87',
      } : {
        urgent: 'Urgent: submit the collaboration proposal', high: 'High: arrange the important follow-up',
        medium: 'Medium: organize research material', low: 'Low: archive reference material',
        legacy: 'Legacy green preset: preserve the saved hex', preset: 'Morandi preset: follows the theme',
        manual: 'Custom background: preserve #4b6a87',
      }
      const context = await browser.newContext({ viewport: { width, height }, locale: language === 'zh' ? 'zh-CN' : 'en-US' })
      const page = await context.newPage()
      page.setDefaultTimeout(14000)
      const errors = [], consoleErrors = []
      page.on('pageerror', error => errors.push(error.message))
      page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()) })
      await page.route('**/*', route => route.request().url().startsWith(origin + '/') ? route.continue() : route.abort())
      await page.addInitScript(({ language, initialTheme, titles, palette, themeIds }) => {
        window.electronAPI = { saveFile: async content => { window.__morandiExport = content; return { success: true } } }
        window.__morandiTaskWrites = 0
        const originalSet = Storage.prototype.setItem
        Storage.prototype.setItem = function(key, value) {
          if (key === 'anvilite-tasks') window.__morandiTaskWrites++
          return originalSet.call(this, key, value)
        }
        if (sessionStorage.getItem('morandi-probe-seeded')) return
        sessionStorage.setItem('morandi-probe-seeded', 'true')
        localStorage.clear()
        localStorage.setItem('anvilite-subtask-migration-v3', 'synthetic-current-format')
        localStorage.setItem('anvilite-migration-timer-tags-v031', 'synthetic-current-format')
        const timestamp = new Date().toISOString()
        // The synthetic profile already owns the eight-theme badge, avoiding a transient unlock overlay in screenshots.
        localStorage.setItem('anvilite-badges', JSON.stringify({ state: { earnedIds: { theme_collect: timestamp }, notifyQueue: [] }, version: 0 }))
        localStorage.setItem('anvilite-settings', JSON.stringify({ state: { settings: {
          theme: initialTheme, language, dashboardLayout: [], unlockedThemes: themeIds, characterName: 'Synthetic',
        } }, version: 0 }))
        localStorage.setItem('anvilite-character', JSON.stringify({ state: { character: {
          name: 'Synthetic', level: 1, currentXP: 0, totalXP: 0, ore: 0, totalOreEarned: 0, titlePreset: 'forge',
          customTitles: null, streakDays: 0, lastActiveDate: null, globalStatus: 'active', prestigeLevel: 0,
          xpFormulaVersion: 2, createdAt: timestamp,
        } }, version: 0 }))
        const task = (id, priority, backgroundColor = null) => ({
          id, title: titles[id], priority, backgroundColor, category: 'home', difficulty: 1, description: 'Synthetic Morandi check',
          dueDate: null, actualMinutes: 0, xpReward: 0, status: 'todo', completedAt: null, deletedAt: null, isHidden: false,
          timerStartedAt: null, timerAccumulated: 0, tags: ['synthetic'], subTasks: [], sortOrder: Object.keys(titles).indexOf(id),
          createdAt: timestamp, updatedAt: timestamp,
        })
        localStorage.setItem('anvilite-tasks', JSON.stringify({ state: { tasks: [
          task('urgent', 'urgent'), task('high', 'high'), task('medium', 'medium'), task('low', 'low'),
          task('legacy', 'low', '#22c55e'), task('preset', 'high', palette[0].value), task('manual', 'medium', '#4b6a87'),
        ], lastCategory: 'home', completedViewMode: 'month', customTaskGroups: [] }, version: 0 }))
        localStorage.setItem('anvilite-dashboard', JSON.stringify({ state: {
          layout: [
            { id: 'tasks', col: 0, row: 0, colSpan: 24, rowSpan: 9 },
            { id: 'waiting', col: 0, row: 9, colSpan: 24, rowSpan: 4 },
          ], visibleCards: ['tasks'],
        }, version: 3 }))
      }, { language, initialTheme, titles, palette, themeIds: Object.keys(themeKeys) })
      const card = () => page.locator('[data-dashboard-card="tasks"]')
      const form = () => page.locator('form').filter({ has: page.getByPlaceholder(labels.taskDrawer_titlePlaceholder, { exact: true }) })
      const rawTasks = () => page.evaluate(() => localStorage.getItem('anvilite-tasks'))
      const readTasks = async () => JSON.parse(await rawTasks()).state.tasks
      const settle = async () => { await page.mouse.move(5, 5); await page.waitForTimeout(350) }
      const changeTheme = async theme => {
        // The task drawer's modal backdrop covers the toolbar; close it through its
        // real Cancel button before opening settings, then reopen the same record.
        if (await form().count()) {
          await form().getByRole('button', { name: labels.taskDrawer_cancel, exact: true }).click()
          await form().waitFor({ state: 'detached' })
        }
        await page.getByRole('button', { name: labels.topbar_settings, exact: true }).click()
        await page.getByText(labels[themeKeys[theme]], { exact: true }).click()
        await page.waitForFunction(theme => {
          const stored = JSON.parse(localStorage.getItem('anvilite-settings')).state.settings.theme
          return stored === theme && (document.documentElement.getAttribute('data-theme') || 'dawn-white') === theme
        }, theme)
        const heading = page.getByText(labels.settings_title, { exact: true })
        await heading.locator('..').getByRole('button').last().click()
        await heading.waitFor({ state: 'detached' })
        await card().getByText(titles.legacy, { exact: true }).click()
        await form().waitFor()
        await form().locator('[data-task-color-preset="gray"][aria-pressed="true"]').waitFor()
        await settle()
      }
      const capture = async theme => {
        const samples = await card().locator('[data-task-id]').evaluateAll((nodes, labels) => nodes.map(node => {
          const id = node.getAttribute('data-task-id')
          const title = node.querySelector('span[title]')
          const rootStyle = getComputedStyle(document.documentElement)
          const task = JSON.parse(localStorage.getItem('anvilite-tasks')).state.tasks.find(task => task.id === id)
          const badge = task.priority === 'urgent' ? [...node.querySelectorAll('span')].find(span => span.textContent.trim() === '! ' + labels.priority_urgent)
            : node.querySelector('[aria-label="' + labels['priority_' + task.priority] + '"]')
          return {
            id, priority: task.priority, background: getComputedStyle(node).backgroundColor,
            text: getComputedStyle(title).color,
            priorityColor: badge ? (task.priority === 'urgent' ? getComputedStyle(badge).color : getComputedStyle(badge).backgroundColor)
              : rootStyle.getPropertyValue('--task-priority-' + task.priority).trim(),
          }
        }), labels)
        const swatches = await form().locator('[data-task-color-preset]').evaluateAll(nodes => nodes.map(node => ({
          id: node.getAttribute('data-task-color-preset'), color: getComputedStyle(node).backgroundColor, selected: node.getAttribute('aria-pressed'),
        })))
        for (const sample of samples) {
          sample.textContrast = contrast(sample.text, sample.background)
          sample.priorityContrast = contrast(sample.priorityColor, sample.background)
          if (sample.textContrast < 4.5 || sample.priorityContrast < 4.5) {
            violations.push({ language, width, theme, ...sample })
          }
        }
        const automatic = samples.filter(sample => ['urgent', 'high', 'medium', 'low'].includes(sample.id))
        assert.equal(new Set(automatic.map(sample => sample.background)).size, 4)
        const redHue = hue(automatic.find(sample => sample.id === 'urgent').priorityColor)
        const orangeHue = hue(automatic.find(sample => sample.id === 'high').priorityColor)
        assert.ok(redHue <= 15 || redHue >= 330, 'Urgent remains visibly red: hue=' + redHue)
        assert.ok(orangeHue >= 15 && orangeHue <= 60, 'High remains visibly orange: hue=' + orangeHue)
        assert.equal(swatches.some(swatch => swatch.id === 'green'), false)
        assert.equal(swatches.find(swatch => swatch.id === gray.id).selected, 'true')
        assert.equal(await form().getByRole('button', { name: labels.task_colorGreen, exact: true }).count(), 0)
        assert.equal(await form().locator('input[type="color"]').inputValue(), gray.value)
        return { theme, samples, swatches, redHue, orangeHue }
      }

      try {
        await page.goto(origin, { waitUntil: 'networkidle' })
        await card().locator('[data-task-id="manual"]').waitFor()
        await settle()
        const baseline = await rawTasks()
        const originalCharacter = await page.evaluate(() => JSON.parse(localStorage.getItem('anvilite-character')).state.character)
        await page.evaluate(() => { window.__morandiTaskWrites = 0 })
        await page.screenshot({ path: path.join(output, language + '-' + width + '-dashboard.png'), fullPage: true })
        await card().getByText(titles.legacy, { exact: true }).click()
        await form().waitFor()
        await form().locator('[data-task-color-preset="gray"][aria-pressed="true"]').waitFor()
        const themeSamples = []
        for (const theme of Object.keys(themeKeys)) {
          await changeTheme(theme)
          const sample = await capture(theme)
          themeSamples.push(sample)
          assert.equal(await rawTasks(), baseline)
          assert.equal(await page.evaluate(() => window.__morandiTaskWrites), 0, 'Theme changes must never persist task records')
          if (language === 'zh' && width === 1280) {
            await form().locator('fieldset').scrollIntoViewIfNeeded()
            await settle()
            await page.screenshot({ path: path.join(output, 'theme-' + theme + '-palette.png'), fullPage: true })
          }
        }
        assert.equal(new Set(themeSamples.map(sample => JSON.stringify(sample.swatches.map(swatch => swatch.color)))).size, 8, 'All eight themes resolve their own preset tones')
        assert.equal(new Set(themeSamples.map(sample => JSON.stringify(sample.samples.map(task => task.background)))).size, 8, 'All eight themes resolve their own task backgrounds')
        const customBackgrounds = new Set(themeSamples.map(sample => sample.samples.find(task => task.id === 'manual').background))
        assert.ok(customBackgrounds.size > 1, 'An arbitrary custom hex still blends with each theme base')
        await changeTheme(initialTheme)
        await form().getByRole('button', { name: labels.taskDrawer_cancel, exact: true }).click()
        await form().waitFor({ state: 'detached' })
        assert.equal(await rawTasks(), baseline)
        assert.equal(await page.evaluate(() => window.__morandiTaskWrites), 0)

        // A plain save may update updatedAt, but must not canonicalize a legacy color.
        await card().getByText(titles.legacy, { exact: true }).click()
        await form().waitFor()
        await form().getByRole('button', { name: labels.taskDrawer_save, exact: true }).click()
        await form().waitFor({ state: 'detached' })
        const legacy = (await readTasks()).find(task => task.id === 'legacy')
        assert.equal(legacy.backgroundColor, '#22c55e')
        const previous = JSON.parse(baseline).state.tasks.find(task => task.id === 'legacy')
        assert.deepEqual(legacy, { ...previous, updatedAt: legacy.updatedAt })
        assert.equal((await readTasks()).find(task => task.id === 'manual').backgroundColor, '#4b6a87')
        assert.deepEqual(await page.evaluate(() => JSON.parse(localStorage.getItem('anvilite-character')).state.character), originalCharacter)
        await page.getByRole('button', { name: labels.topbar_settings, exact: true }).click()
        await page.getByRole('button', { name: new RegExp(labels.data_export) }).click()
        await page.waitForFunction(() => typeof window.__morandiExport === 'string')
        const exported = JSON.parse(await page.evaluate(() => window.__morandiExport))
        assert.equal(exported.data.tasks.tasks.find(task => task.id === 'legacy').backgroundColor, '#22c55e')
        assert.equal(exported.data.tasks.tasks.find(task => task.id === 'manual').backgroundColor, '#4b6a87')
        assert.deepEqual(errors, [])
        checks.push({ language, width, height, initialTheme, realSettingsThemeSwitches: 9,
          taskRecordsUntouchedByThemes: true, prioritiesAndRewardsPreserved: true, noGreenPreset: true,
          legacyGreenVisuallyWarmStone: true, legacyHexPreservedOnPlainSaveAndExport: true,
          arbitraryCustomHexPreserved: true, minimumTextContrast: Math.min(...themeSamples.flatMap(sample => sample.samples.map(task => task.textContrast))),
          minimumPriorityContrast: Math.min(...themeSamples.flatMap(sample => sample.samples.map(task => task.priorityContrast))),
          themeSamples, pageErrors: errors, consoleErrors })
        console.log(JSON.stringify({ language, width, themes: themeSamples.length, passed: true }))
      } catch (error) {
        await page.screenshot({ path: path.join(output, language + '-' + width + '-failure.png'), fullPage: true }).catch(() => {})
        fs.writeFileSync(path.join(output, language + '-' + width + '-failure.json'), JSON.stringify({
          error: String(error), pageErrors: errors, consoleErrors, violations, body: await page.locator('body').innerText().catch(() => ''),
        }, null, 2))
        throw error
      } finally { await context.close() }
    }
    const report = { bundle: fs.readFileSync(path.join(dist, 'index.html'), 'utf8').match(/src="\.\/([^"]+\.js)"/)[1],
      browser: 'Microsoft Edge (isolated headless contexts)', syntheticDataOnly: true, checks, violations }
    fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2))
    console.log(JSON.stringify({ groups: checks.length, themeChecks: checks.length * 8, screenshots: 12,
      contrastViolations: violations.length, report: path.join(output, 'report.json') }))
    if (violations.length) process.exitCode = 2
  } finally {
    if (browser) await browser.close()
    await new Promise(resolve => server.close(resolve))
  }
})().catch(error => { console.error(error); process.exitCode = 1 })
