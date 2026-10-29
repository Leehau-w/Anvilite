const fs = require('node:fs')
const path = require('node:path')
const http = require('node:http')
const assert = require('node:assert/strict')
const { chromium } = require('playwright')
const root = path.resolve(__dirname, '../..')
const dist = path.join(root, 'dist')
const output = process.env.ANVILITE_AUDIT_OUTPUT ? path.resolve(process.env.ANVILITE_AUDIT_OUTPUT) : path.join(__dirname, 'mindmap-editor-statusbar-ui-2026-10-28')
fs.mkdirSync(output, { recursive: true })
const server = http.createServer((req, res) => {
  const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname)
  const file = path.resolve(dist, '.' + (pathname === '/' ? '/index.html' : pathname))
  if (!file.startsWith(dist + path.sep) || !fs.existsSync(file)) { res.writeHead(404).end(); return }
  res.setHeader('Content-Type', ({ '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' })[path.extname(file)] || 'application/octet-stream')
  fs.createReadStream(file).pipe(res)
})
;(async()=>{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve))
  const origin='http://127.0.0.1:'+server.address().port
  let browser,lastPage;const checks=[]
  try{
    browser=await chromium.launch({channel:'msedge',headless:true,args:['--disable-background-networking','--disable-component-update','--no-first-run']})
    for(const language of ['zh','en'])for(const [width,height]of [[900,600],[1280,800]]){
      const context=await browser.newContext({viewport:{width,height},locale:language==='zh'?'zh-CN':'en-US',timezoneId:'Europe/Berlin'})
      const page=lastPage=await context.newPage(),errors=[]
      page.on('pageerror',error=>errors.push(error.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())})
      await page.route('**/*',route=>route.request().url().startsWith(origin+'/')?route.continue():route.abort())
      const t=language==='zh'?{nav:'思维导图',open:'打开任务',plain:'回车保存的计划',task:'回车修改任务',sub:'回车修改子任务',done:'今日完成',time:'用时',minutes:n=>n+'分',duration:'1时30分',hour:'1时1分'}:{nav:'Mind maps',open:'Open task',plain:'Plan saved with Enter',task:'Task saved with Enter',sub:'Subtask saved with Enter',done:"Today's Done",time:'Time spent',minutes:n=>n+'m',duration:'1h30m',hour:'1h1m'}
      await page.addInitScript(({language,width})=>{
        localStorage.clear();localStorage.setItem('anvilite-subtask-migration-v3','synthetic-current-format');localStorage.setItem('anvilite-migration-timer-tags-v031','synthetic-current-format')
        localStorage.setItem('anvilite-settings',JSON.stringify({state:{settings:{language,theme:width===900?'dawn-white':'forge-purple',unlockedThemes:['dawn-white','forge-purple']}},version:0}))
        const now=new Date().toISOString(),make=(id,title,status)=>({id,title,status,category:'home',priority:'medium',difficulty:2,dueDate:null,description:'Synthetic notes',actualMinutes:status==='done'?90:0,xpReward:0,completedAt:status==='done'?now:null,deletedAt:null,isHidden:false,sortOrder:0,timerStartedAt:null,timerAccumulated:0,tags:[],subTasks:[],createdAt:now,updatedAt:now})
        const linked=make('linked','Linked task','waiting');linked.subTasks=[{id:'sub',title:'Linked child',completed:false,sortOrder:0,subTasks:[],createdAt:now,mindMapSource:{mapId:'map',nodeId:'child'}}]
        localStorage.setItem('anvilite-tasks',JSON.stringify({state:{tasks:[linked,make('done','Finished task','done')],lastCategory:'home',completedViewMode:'area',customTaskGroups:[]},version:0}))
        localStorage.setItem('anvilite-mind-maps',JSON.stringify({state:{selectedMapId:'map',maps:[{id:'map',title:'Plan',createdAt:now,updatedAt:now,revision:0,root:{id:'root',topic:'Plan',children:[{id:'linked-node',topic:'Linked task',taskId:'linked',direction:1,children:[{id:'child',topic:'Linked child',taskId:'linked',subTaskId:'sub'}]},{id:'done-node',topic:'Finished task',taskId:'done',direction:0}]}}]},version:1}))
      },{language,width})
      const stored=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('anvilite-tasks')).state.tasks)
      const task=async id=>(await stored()).find(task=>task.id===id)
      const maps=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('anvilite-mind-maps')).state.maps)
      const node=id=>page.locator('me-tpc[data-nodeid="me'+id+'"]')
      const title=()=>page.locator('[data-mindmap-node-title]')
      const bar=()=>page.locator('[data-status-bar]')
      const select=async id=>{await page.getByRole('button',{name:language==='zh'?'居中':'Center',exact:true}).click();await page.waitForTimeout(300);await node(id).click();await page.waitForTimeout(30)}
      await page.goto(origin,{waitUntil:'networkidle'});await page.getByRole('button',{name:t.nav,exact:true}).click();await node('root').waitFor()
      assert.equal(await page.locator('.mindmap-inspector form button[type="submit"]').count(),0)
      assert.ok((await bar().textContent()).includes(t.done+' 1'));assert.ok((await bar().textContent()).includes(t.time+' '+t.duration))
      await title().fill(t.plain);await title().press('Enter');assert.equal((await maps())[0].root.topic,t.plain);assert.equal(await title().inputValue(),t.plain)
      await select('linked-node');await title().fill(t.task);await title().press('Enter');assert.equal((await task('linked')).title,t.task);assert.equal((await task('linked')).status,'waiting')
      await title().press('End');await title().press('Shift+Enter');await title().pressSequentially('Second line')
      assert.equal((await task('linked')).title,t.task);assert.equal(await title().inputValue(),t.task+'\nSecond line')
      await title().press('Enter');assert.equal((await task('linked')).title,t.task+'\nSecond line')
      await select('child');const originalChild=(await task('linked')).subTasks[0].title
      await title().fill(t.sub);await title().dispatchEvent('compositionstart');await title().dispatchEvent('keydown',{key:'Enter',code:'Enter',isComposing:true,keyCode:229,bubbles:true,cancelable:true})
      assert.equal((await task('linked')).subTasks[0].title,originalChild)
      await title().dispatchEvent('compositionend');await title().press('Enter');assert.equal((await task('linked')).subTasks[0].title,t.sub)
      const body=await page.locator('body').textContent()
      assert.ok(!body.includes('标题会与关联任务同步，分支子节点会转为子任务。'));assert.ok(!body.includes('Titles stay in sync with the linked task. Child branches become subtasks.'))
      assert.ok(!body.includes('双击编辑 · 拖动分支 · Ctrl + 滚轮缩放'));assert.ok(!body.includes('Double-click to edit · Drag branches · Ctrl + scroll to zoom'))
      await select('done-node')
      for(const [minutes,expected]of [[60,t.minutes(60)],[61,t.hour],[0,t.minutes(0)],[90,t.duration]]){
        await page.getByRole('button',{name:t.open,exact:true}).click();const form=page.locator('[data-task-drawer]');await form.waitFor();await form.locator('input[type="number"]').fill(String(minutes));await form.locator('input[type="number"]').press('Enter');await form.waitFor({state:'detached'})
        assert.equal((await task('done')).actualMinutes,minutes);assert.ok((await bar().textContent()).includes(t.time+' '+expected));assert.ok((await bar().textContent()).includes(t.done+' 1'))
      }
      await select('child');await page.mouse.move(65,85);await page.waitForTimeout(350)
      await page.screenshot({path:path.join(output,language+'-'+width+'-editor-statusbar.png'),fullPage:true})
      assert.deepEqual(errors,[]);checks.push({language,width,height,plainEnter:true,taskEnterSync:true,subtaskEnterSync:true,shiftEnter:true,imeSafe:true,hintsRemoved:true,nodeTitleSaveButtonRemoved:true,compactTodayStats:true,durationBoundaries:true,errors});console.log(JSON.stringify(checks.at(-1)));await context.close()
    }
    fs.writeFileSync(path.join(output,'report.json'),JSON.stringify({checks},null,2))
  }catch(error){if(lastPage&&!lastPage.isClosed())await lastPage.screenshot({path:path.join(output,'failure.png'),fullPage:true}).catch(()=>{});throw error}
  finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve))}
})().catch(error=>{console.error(error);process.exitCode=1})
