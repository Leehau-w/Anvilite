const fs = require('node:fs')
const path = require('node:path')
const http = require('node:http')
const assert = require('node:assert/strict')
const { chromium } = require('playwright')

const workspace = path.resolve(__dirname, '../..')
const dist = path.join(workspace, 'dist')
const output = path.join(__dirname, 'ui-2026-10-22')
fs.mkdirSync(output, { recursive: true })
const server = http.createServer((req, res) => {
  const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname)
  const file = path.resolve(dist, '.' + (pathname === '/' ? '/index.html' : pathname))
  if (!file.startsWith(dist + path.sep) || !fs.existsSync(file)) { res.writeHead(404).end(); return }
  const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png' }
  res.setHeader('Content-Type', mime[path.extname(file)] || 'application/octet-stream')
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
      const sourceTitle = language === 'zh' ? '合成回归：长标题与三级日程步骤保存检查' : 'Synthetic regression: a long flow title and three nested timeline levels'
      const labels = language === 'zh'
        ? { nav: '流程', create: '+ 新建流程', title: '流程标题', cancel: '取消', start: '开始执行', end: '结束执行', third: '三级：确认保存与恢复', linked: '关联流程目标' }
        : { nav: 'Flows', create: '+ New Flow', title: 'Flow title', cancel: 'Cancel', start: 'Start Execution', end: 'End Execution', third: 'Third level: verify save and recovery', linked: 'Linked flow target' }
      await page.addInitScript(({ language, sourceTitle, labels }) => {
        localStorage.clear()
        localStorage.setItem('anvilite-migration-sop-v031', 'synthetic-current-format')
        localStorage.setItem('anvilite-settings', JSON.stringify({ state: { settings: {
          theme: 'dawn-white', language, unlockedThemes: ['dawn-white'], dashboardLayout: [], characterName: 'Synthetic',
        } }, version: 0 }))
        const now = '2026-10-22T10:00:00Z'
        const step = (id, title, children = [], content = null) => ({ id, title, childSteps: children, content, time: null, sortOrder: 0 })
        const flow = (id, title, steps) => ({ id, title, steps, folderId: 'synthetic-folder', displayStyle: 'timeline', isSystem: false, lastUsedAt: null, sortOrder: 0, createdAt: now, updatedAt: now })
        const content = { type: 'doc', content: [{ type: 'paragraph', content: [
          { type: 'text', text: language === 'zh' ? '参考：' : 'Reference: ' },
          { type: 'sopLink', attrs: { sopId: 'target', sopTitle: labels.linked } },
        ] }] }
        localStorage.setItem('anvilite-sops', JSON.stringify({ state: {
          folders: [{ id: 'synthetic-folder', name: language === 'zh' ? '合成检查' : 'Synthetic checks', parentId: null, sortOrder: 0, isSystem: false, createdAt: now }],
          sops: [flow('source', sourceTitle, [step('one', language === 'zh' ? '一级：检查输入' : 'First level: inspect input', [step('two', language === 'zh' ? '二级：检查子步骤' : 'Second level: inspect child steps', [step('three', labels.third)])], content)]), flow('target', labels.linked, [])],
          selectedSOPId: null, collapsedFolderIds: [],
        }, version: 0 }))
      }, { language, sourceTitle, labels })
      await page.goto(origin, { waitUntil: 'networkidle' })
      await page.getByRole('button', { name: labels.nav, exact: true }).click()
      await page.getByText(labels.create, { exact: true }).click()
      const titleInput = page.getByPlaceholder(labels.title, { exact: true })
      await titleInput.waitFor({ state: 'visible' })
      await titleInput.fill(language === 'zh' ? '新建流程键盘输入检查' : 'New flow keyboard input check')
      await titleInput.press('Tab')
      assert.equal(await titleInput.inputValue(), language === 'zh' ? '新建流程键盘输入检查' : 'New flow keyboard input check')
      await page.screenshot({ path: path.join(output, `${language}-${width}-new-flow.png`), fullPage: true })
      await page.getByRole('button', { name: labels.cancel, exact: true }).click()
      await page.getByText(sourceTitle, { exact: true }).click()
      await page.getByText(labels.third, { exact: true }).waitFor({ state: 'visible' })
      const start = page.getByRole('button', { name: new RegExp(labels.start) })
      await start.focus()
      await page.keyboard.press('Enter')
      assert.equal(await page.getByRole('checkbox').count(), 3)
      const boxes = page.getByRole('checkbox')
      await boxes.nth(0).focus(); await page.keyboard.press('Space')
      await boxes.nth(1).check(); await boxes.nth(2).check()
      await page.getByText(language === 'zh' ? '3/3 已完成' : '3/3 completed', { exact: true }).waitFor()
      await page.screenshot({ path: path.join(output, `${language}-${width}-three-level-execution.png`), fullPage: true })
      await page.getByRole('button', { name: new RegExp(labels.end) }).click()
      await page.locator('[data-sop-link]').click()
      await page.getByRole('heading', { name: labels.linked, exact: true }).waitFor()
      assert.deepEqual(errors, [])
      checks.push({ language, width, height, creation: true, keyboard: true, threeLevels: true, progress: '3/3', linkNavigation: true, pageErrors: errors })
      await context.close()
    }
    fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify({ browser: 'Microsoft Edge (isolated headless contexts)', checks }, null, 2))
    console.log(JSON.stringify({ combinations: checks.length, screenshots: checks.length * 2, pageErrors: 0, report: path.join(output, 'report.json') }))
  } finally {
    if (browser) await browser.close()
    await new Promise(resolve => server.close(resolve))
  }
})().catch(error => { console.error(error); process.exitCode = 1 })
