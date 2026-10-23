const fs = require('node:fs')
const path = require('node:path')
const http = require('node:http')
const assert = require('node:assert/strict')
const { chromium } = require('playwright')
const root = path.resolve(__dirname, '../..')
const dist = path.join(root, 'dist')
const output = path.join(__dirname, 'mindmap-task-links-ui-2026-10-23')
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
      const t = language === 'zh' ? { nav: '思维导图', openTask: '打开任务', openParent: '打开所属任务', cancel: '取消', unlink: '解除关联', collapse: '折叠', expand: '展开', center: '居中', remove: '删除',
        main: '合作方回复已更新', nodeTitle: '导图里修改任务标题', nativeTitle: '直接双击节点改名', childTitle: '整理资料并完成审阅', taskChildTitle: '任务里修改子项', addedTitle: '新增后续跟进',
        settings: '设置', export: '导出数据', confirmImport: '确认导入' }
        : { nav: 'Mind maps', openTask: 'Open task', openParent: 'Open parent task', cancel: 'Cancel', unlink: 'Unlink', collapse: 'Collapse', expand: 'Expand', center: 'Center', remove: 'Delete',
          main: 'Partner reply updated', nodeTitle: 'Task title edited in the mind map', nativeTitle: 'Rename directly in the canvas', childTitle: 'Organize material and finish review', taskChildTitle: 'Subtask edited in the task', addedTitle: 'Additional follow up',
          settings: 'Settings', export: 'Export Data', confirmImport: 'Confirm Import' }
      await page.addInitScript(({ language, width }) => {
        window.electronAPI = { saveFile: async content => { window.__mindMapExport = content; return { success: true } } }
        if (sessionStorage.getItem('mindmap-links-seeded')) return
        sessionStorage.setItem('mindmap-links-seeded', 'true'); localStorage.clear()
        localStorage.setItem('anvilite-subtask-migration-v3', 'synthetic-current-format')
        localStorage.setItem('anvilite-migration-timer-tags-v031', 'synthetic-current-format')
        localStorage.setItem('anvilite-settings', JSON.stringify({ state: { settings: { theme: width === 900 ? 'dawn-white' : 'forge-purple', language, unlockedThemes: ['dawn-white', 'forge-purple'] } }, version: 0 }))
        const now = '2026-10-23T10:00:00.000Z'
        const makeTask = (id, title, status) => ({ id, title, status, category: 'home', priority: 'medium', difficulty: 2,
          description: 'Synthetic task notes', dueDate: null, actualMinutes: 20, xpReward: 0, completedAt: null,
          deletedAt: null, isHidden: false, timerStartedAt: null, timerAccumulated: 0, tags: ['synthetic'], sortOrder: 0,
          subTasks: id === 'existing' ? [{ id: 'unrelated', title: 'Existing unrelated child', completed: true, sortOrder: 0, subTasks: [], createdAt: now }] : [], createdAt: now, updatedAt: now })
        localStorage.setItem('anvilite-tasks', JSON.stringify({ state: { tasks: [
          makeTask('mail', language === 'zh' ? '等待合作方回信' : 'Await partner reply', 'waiting'),
          makeTask('existing', language === 'zh' ? '整理项目资料' : 'Organize project material', 'todo'),
        ], lastCategory: 'home', completedViewMode: 'area', customTaskGroups: [] }, version: 0 }))
        localStorage.setItem('anvilite-mind-maps', JSON.stringify({ state: { selectedMapId: 'map-one', maps: [
          { id: 'map-one', title: language === 'zh' ? '研究计划' : 'Research', createdAt: now, updatedAt: now, revision: 0,
            root: { id: 'root', topic: language === 'zh' ? '研究计划' : 'Research', expanded: true, children: [
              { id: 'a', topic: 'Graph placeholder', direction: 1, expanded: true, children: [
                { id: 'a1', topic: 'Read material', expanded: true, children: [{ id: 'a11', topic: 'Write draft', expanded: true, children: [{ id: 'a111', topic: 'Review draft' }] }] },
                { id: 'a2', topic: 'Read material' },
              ] },
              { id: 'b', topic: 'Old graph title', direction: 0, taskId: 'mail', children: [{ id: 'b1', topic: 'Send reminder' }] },
              { id: 'c', topic: 'New task from outline', direction: 0, children: [{ id: 'c1', topic: 'Converted child' }] },
              { id: 'deep', topic: 'Deep notes', direction: 1, expanded: false, children: [{ id: 'd1', topic: 'Level one', children: [{ id: 'd2', topic: 'Level two', children: [{ id: 'd3', topic: 'Level three', children: [{ id: 'd4', topic: 'Level four' }] }] }] }] },
            ] } },
          { id: 'map-two', title: 'Other map', createdAt: now, updatedAt: now, revision: 0, root: { id: 'root-two', topic: 'Other map', taskId: 'mail' } },
        ] }, version: 1 }))
      }, { language, width })
      const maps = () => page.evaluate(() => JSON.parse(localStorage.getItem('anvilite-mind-maps')).state)
      const tasks = () => page.evaluate(() => JSON.parse(localStorage.getItem('anvilite-tasks')).state.tasks)
      const task = async id => (await tasks()).find(task => task.id === id)
      const node = id => page.locator('me-tpc[data-nodeid="me' + id + '"]')
      const find = (root, id) => root.id === id ? root : (root.children || []).map(child => find(child, id)).find(Boolean)
      const storedNode = async id => find((await maps()).maps[0].root, id)
      const findSub = (subs, id) => subs.map(sub => sub.id === id ? sub : findSub(sub.subTasks, id)).find(Boolean)
      const flatten = subs => subs.flatMap(sub => [sub, ...flatten(sub.subTasks)])
      const select = async id => { await page.getByRole('button', { name: t.center, exact: true }).click(); await page.waitForTimeout(30); await node(id).click(); await page.waitForTimeout(40) }
      const title = () => page.locator('[data-mindmap-node-title]')
      const editTitle = async value => { await title().fill(value); await page.locator('.mindmap-inspector form button[type="submit"]').click() }
      const visibleTitle = async (id, value) => { await page.waitForFunction(({id, value}) => document.querySelector('me-tpc[data-nodeid="me' + id + '"]')?.textContent.includes(value), {id,value}) }
      const link = async (id, taskId) => { await select(id); await page.locator('[data-mindmap-link]').click(); await page.locator('[data-mindmap-link-task="' + taskId + '"]').click() }
      const openTask = async () => { await page.getByRole('button', { name: new RegExp('^(' + t.openTask + '|' + t.openParent + ')$') }).click(); await page.locator('[data-task-drawer]').waitFor() }
      const closeTask = async () => { await page.locator('[data-task-drawer]').getByRole('button', { name: t.cancel, exact: true }).click(); await page.locator('[data-task-drawer]').waitFor({state:'detached'}) }
      await page.goto(origin, { waitUntil: 'networkidle' })
      await page.getByRole('button', { name: t.nav, exact: true }).click()
      await node('root').waitFor()
      await select('b')
      assert.ok((await storedNode('b1')).subTaskId, 'Opening existing linked branches converts their ordinary children')
      assert.equal((await task('mail')).subTasks.length, 1)
      await visibleTitle('b', (await task('mail')).title)
      assert.equal(await title().inputValue(), (await task('mail')).title)
      await openTask()
      await page.locator('[data-task-drawer] input').first().fill(t.main)
      await page.locator('[data-task-drawer] input').first().press('Enter')
      await page.locator('[data-task-drawer]').waitFor({ state: 'detached' })
      await visibleTitle('b', t.main)
      await editTitle(t.nodeTitle)
      assert.equal((await task('mail')).title, t.nodeTitle)
      assert.equal((await task('mail')).status, 'waiting')
      await select('b')
      await page.waitForTimeout(350) // Clear the library's previous pointer-tap before a fresh double click.
      await node('b').dblclick({ delay: 80, position: { x: 8, y: 8 } })
      await page.locator('#input-box').fill(t.nativeTitle)
      await page.locator('#input-box').press('Enter')
      await visibleTitle('b', t.nativeTitle)
      assert.equal((await task('mail')).title, t.nativeTitle)
      await page.locator('[data-mindmap-id="map-two"]').click()
      await visibleTitle('root-two', t.nativeTitle)
      await page.locator('[data-mindmap-id="map-one"]').click()
      await link('a', 'existing')
      await visibleTitle('a', (await task('existing')).title)
      const childId = (await storedNode('a1')).subTaskId
      const nestedId = (await storedNode('a11')).subTaskId
      const leafId = (await storedNode('a111')).subTaskId
      assert.ok(childId && nestedId && leafId)
      assert.equal(findSub((await task('existing')).subTasks, childId).subTasks[0].id, nestedId)
      assert.equal(findSub((await task('existing')).subTasks, nestedId).subTasks[0].id, leafId)
      assert.ok((await task('existing')).subTasks.some(sub => sub.id === 'unrelated' && sub.completed))
      assert.equal(flatten((await task('existing')).subTasks).length, 5)
      assert.notEqual((await storedNode('a2')).subTaskId, childId)
      // Inspector edits the bound child; the task drawer edits back into the map.
      await select('a1'); await editTitle(t.childTitle)
      assert.equal(findSub((await task('existing')).subTasks, childId).title, t.childTitle)
      await openTask()
      await page.locator('[data-task-drawer]').getByText(t.childTitle, { exact: true }).click()
      // The inline child input is distinguished from the task title and add inputs by current value.
      await page.locator('[data-task-drawer] input').evaluateAll((inputs, value) => {
        const input = inputs.find(input => input.value === value)
        if (!input) throw Error('Missing inline child input')
        input.setAttribute('data-regression-inline-child', '')
      }, t.childTitle)
      await page.locator('[data-regression-inline-child]').fill(t.taskChildTitle)
      await page.locator('[data-regression-inline-child]').press('Enter')
      const childRow = page.locator('[data-task-drawer]').getByText(t.taskChildTitle, { exact: true }).locator('..')
      await childRow.getByRole('checkbox').click()
      await closeTask()
      await visibleTitle('a1', t.taskChildTitle)
      await select('a1')
      await page.locator('[data-mindmap-subtask-status="done"]').waitFor()
      assert.equal((await task('existing')).status, 'todo')
      await select('a')
      await page.locator('[data-mindmap-add-child]').click()
      const added = (await storedNode('a')).children.find(child => !['a1','a2'].includes(child.id))
      assert.ok(added?.subTaskId)
      await editTitle(t.addedTitle)
      assert.equal(findSub((await task('existing')).subTasks, added.subTaskId).title, t.addedTitle)
      // Deleting a graph branch leaves the actual subtask intact and never respawns it.
      await select('a2')
      const preservedId = (await storedNode('a2')).subTaskId
      await page.locator('[data-mindmap-delete-node]').click()
      await page.getByRole('dialog').getByRole('button', { name: t.remove, exact: true }).click()
      assert.ok(findSub((await task('existing')).subTasks, preservedId))
      await select('a')
      await page.getByRole('button', { name: t.collapse, exact: true }).click()
      await page.getByRole('button', { name: t.expand, exact: true }).click()
      const childrenBeforeUnlink = (await task('existing')).subTasks
      await page.getByRole('button', { name: t.unlink, exact: true }).click()
      assert.equal((await storedNode('a1')).subTaskId, undefined)
      await link('a', 'existing')
      assert.deepEqual((await task('existing')).subTasks, childrenBeforeUnlink)
      assert.equal((await storedNode('a1')).subTaskId, childId)
      // New task conversion includes its child once.
      await select('c')
      await page.locator('[data-mindmap-convert]').evaluate(button => { button.click(); button.click() })
      const createdId = (await storedNode('c')).taskId
      assert.ok(createdId)
      assert.equal((await tasks()).length, 3)
      assert.equal((await task(createdId)).subTasks[0].title, 'Converted child')
      // Depth limit rejects the whole association before any task mutation.
      const beforeDeepTasks = await tasks()
      const beforeDeepMaps = await maps()
      await link('deep', 'existing')
      await page.getByRole('alert').waitFor()
      assert.deepEqual(await tasks(), beforeDeepTasks)
      assert.deepEqual(await maps(), beforeDeepMaps)
      await select('a')
      await page.getByRole('button', { name: t.collapse, exact: true }).click()
      await page.getByRole('button', { name: t.expand, exact: true }).click()
      await select('a1')
      await page.getByRole('button', { name: t.center, exact: true }).click()
      await page.locator('.mindmap-inspector').evaluate(el => { el.scrollTop = 0 })
      await page.mouse.move(65, 85); await page.waitForTimeout(350)
      await page.screenshot({ path: path.join(output, language + '-' + width + '-linked-subtasks.png'), fullPage: true })
      const expectedMaps = await maps(), expectedTasks = await tasks()
      await page.reload({ waitUntil: 'networkidle' })
      await page.getByRole('button', { name: t.nav, exact: true }).click()
      await node('a1').waitFor()
      await visibleTitle('a1', t.taskChildTitle)
      assert.deepEqual(await maps(), expectedMaps)
      assert.deepEqual(await tasks(), expectedTasks)
      await page.getByRole('button', { name: t.settings, exact: true }).click()
      await page.getByRole('button', { name: new RegExp(t.export) }).click()
      await page.waitForFunction(() => typeof window.__mindMapExport === 'string')
      const exportedText = await page.evaluate(() => window.__mindMapExport)
      assert.deepEqual(JSON.parse(exportedText).data.mindMaps, expectedMaps)
      await page.reload({ waitUntil: 'networkidle' })
      await page.getByRole('button', { name: t.settings, exact: true }).click()
      await page.locator('input[type="file"]').setInputFiles({ name: 'synthetic-mindmap-subtasks.json', mimeType: 'application/json', buffer: Buffer.from(exportedText) })
      await Promise.all([page.waitForNavigation({ waitUntil: 'networkidle' }), page.getByRole('button', { name: t.confirmImport, exact: true }).click()])
      await page.getByRole('button', { name: t.nav, exact: true }).click()
      await node('a1').waitFor()
      await visibleTitle('a1', t.taskChildTitle)
      assert.deepEqual(await maps(), expectedMaps)
      assert.deepEqual(await tasks(), expectedTasks)
      await select('a1'); await page.getByRole('button', { name: t.center, exact: true }).click()
      await page.waitForTimeout(350)
      await page.screenshot({ path: path.join(output, language + '-' + width + '-restored-subtasks.png'), fullPage: true })
      assert.deepEqual(errors, [])
      checks.push({ language, width, height, existingAssociationUpgrade: true, taskTitleTwoWay: true, nativeCanvasTitleEdit: true, sharedTaskTitle: true, subtreeConversion: true, nestedThreeLevels: true,
        preserveExistingChildren: true, subtaskTitleTwoWay: true, childCompletionProjection: true, addedBranchCreatesSubtask: true,
        deleteNodePreservesSubtask: true, relinkReusesChildren: true, newTaskIncludesChildren: true, deepAssociationAtomicRejection: true,
        coldReload: true, fileBackupRestore: true, errors })
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
