const fs = require('node:fs')
const path = require('node:path')
const http = require('node:http')
const assert = require('node:assert/strict')
const { chromium } = require('playwright')
const root = path.resolve(__dirname, '../..')
const dist = path.join(root, 'dist')
const output = path.join(__dirname, 'mindmap-side-drag-ui-2026-10-28')
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
  const origin='http://127.0.0.1:' + server.address().port
  const baseline=process.argv.includes('--baseline')
  let browser,lastPage
  const checks=[]
  try {
    browser=await chromium.launch({channel:'msedge',headless:true,args:['--disable-background-networking','--disable-component-update','--no-first-run']})
    for(const language of baseline?['zh']:['zh','en']) for(const [width,height] of baseline?[[900,600]]:[[900,600],[1280,800]]) {
      const context=await browser.newContext({viewport:{width,height},locale:language==='zh'?'zh-CN':'en-US',timezoneId:'Europe/Berlin'})
      const page=lastPage=await context.newPage(),errors=[]
      page.on('pageerror',error=>errors.push(error.message))
      page.on('console',message=>{if(message.type()==='error')errors.push(message.text())})
      await page.route('**/*',route=>route.request().url().startsWith(origin+'/')?route.continue():route.abort())
      const t=language==='zh'?{nav:'思维导图',center:'居中',collapse:'折叠',expand:'展开',zoomIn:'放大',zoomOut:'缩小'}:{nav:'Mind maps',center:'Center',collapse:'Collapse',expand:'Expand',zoomIn:'Zoom in',zoomOut:'Zoom out'}
      await page.addInitScript(({language,width})=>{
        if(sessionStorage.getItem('side-drag-seeded'))return
        sessionStorage.setItem('side-drag-seeded','true');localStorage.clear()
        localStorage.setItem('anvilite-subtask-migration-v3','synthetic-current-format')
        localStorage.setItem('anvilite-migration-timer-tags-v031','synthetic-current-format')
        localStorage.setItem('anvilite-settings',JSON.stringify({state:{settings:{theme:width===900?'dawn-white':'forge-purple',language,unlockedThemes:['dawn-white','forge-purple']}},version:0}))
        const now='2026-10-28T10:00:00.000Z'
        const sub={id:'task-sub',title:language==='zh'?'准备资料':'Prepare material',completed:false,sortOrder:0,createdAt:now,mindMapSource:{mapId:'map',nodeId:'r1'},subTasks:[{id:'task-nested',title:language==='zh'?'核对细节':'Check details',completed:true,sortOrder:0,createdAt:now,subTasks:[],mindMapSource:{mapId:'map',nodeId:'r11'}}]}
        const task={id:'linked',title:language==='zh'?'等待合作方回信':'Await partner reply',status:'waiting',category:'home',priority:'high',difficulty:2,dueDate:null,description:'Synthetic original notes',actualMinutes:37,xpReward:0,completedAt:null,deletedAt:null,isHidden:false,sortOrder:0,timerStartedAt:null,timerAccumulated:120000,tags:['synthetic'],subTasks:[sub],createdAt:now,updatedAt:now}
        localStorage.setItem('anvilite-tasks',JSON.stringify({state:{tasks:[task],lastCategory:'home',completedViewMode:'area',customTaskGroups:[]},version:0}))
        localStorage.setItem('anvilite-mind-maps',JSON.stringify({state:{selectedMapId:'map',maps:[{id:'map',title:language==='zh'?'左右分支':'Branches',createdAt:now,updatedAt:now,revision:0,root:{id:'root',topic:language==='zh'?'项目计划':'Project plan',expanded:true,children:[
          {id:'r',topic:task.title,direction:1,taskId:'linked',expanded:true,children:[{id:'r1',topic:sub.title,taskId:'linked',subTaskId:sub.id,expanded:true,children:[{id:'r11',topic:sub.subTasks[0].title,taskId:'linked',subTaskId:sub.subTasks[0].id}]}]},
          {id:'l',topic:language==='zh'?'另一侧分支':'Other branch',direction:0,children:[{id:'l1',topic:language==='zh'?'保留子节点':'Keep child'}]},
          {id:'d',topic:language==='zh'?'其他想法':'Other idea',direction:1},
        ]}}]},version:1}))
      },{language,width})
      const maps=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('anvilite-mind-maps')).state)
      const tasks=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('anvilite-tasks')).state.tasks)
      const root=async()=>(await maps()).maps[0].root
      const find=(root,id)=>root.id===id?root:(root.children||[]).map(child=>find(child,id)).find(Boolean)
      const node=id=>page.locator('me-tpc[data-nodeid="me'+id+'"]')
      const center=async()=>{await page.getByRole('button',{name:t.center,exact:true}).click();await page.waitForTimeout(350)}
      const oppositePoint=async(direction)=>{
        const bounds=await page.locator('[data-mindmap-canvas] .map-container').boundingBox(),base=await node('root').boundingBox()
        return {x:direction===0?Math.max(bounds.x+65,base.x-75):Math.min(bounds.x+bounds.width-65,base.x+base.width+75),y:bounds.y+60}
      }
      const drag=async(id,target)=>{
        const box=await node(id).boundingBox()
        await page.mouse.move(box.x+box.width/2,box.y+box.height/2)
        await page.mouse.down();await page.waitForTimeout(30)
        await page.mouse.move(target.x,target.y,{steps:18});await page.waitForTimeout(100)
        await page.mouse.up();await page.waitForTimeout(350)
      }
      const sideIs=async(id,direction)=>{
        const n=await node(id).boundingBox(),r=await node('root').boundingBox()
        assert.ok(direction===0?n.x+n.width<r.x:n.x>r.x+r.width,'Branch '+id+' should be on side '+direction)
      }
      await page.goto(origin,{waitUntil:'networkidle'})
      await page.getByRole('button',{name:t.nav,exact:true}).click();await node('root').waitFor();await center()
      const originalTasks=await tasks(),originalChildren=JSON.parse(JSON.stringify(find(await root(),'r').children))
      await drag('r',await oppositePoint(0))
      if(baseline){assert.equal(find(await root(),'r').direction,1);console.log('Reproduced: dropping the right branch on blank left canvas does not move or save it.');return}
      assert.equal(find(await root(),'r').direction,0);await sideIs('r',0)
      assert.deepEqual(find(await root(),'r').children,originalChildren);assert.deepEqual(await tasks(),originalTasks)
      await center();await drag('r',await oppositePoint(1))
      assert.equal(find(await root(),'r').direction,1);await sideIs('r',1)
      assert.deepEqual(await tasks(),originalTasks)
      const beforeIgnored=await maps()
      await center();await drag('r',await oppositePoint(1))
      assert.deepEqual(await maps(),beforeIgnored,'A same-side blank drop must not save')
      await drag('r',{x:80,y:75})
      assert.deepEqual(await maps(),beforeIgnored,'Dropping outside the canvas must not save')
      const blank=await oppositePoint(0)
      await page.mouse.move(blank.x,blank.y);await page.mouse.down();await page.mouse.move(blank.x+45,blank.y+30,{steps:10});await page.mouse.up();await page.waitForTimeout(150)
      assert.deepEqual(await maps(),beforeIgnored,'Panning from blank canvas must not move a branch')
      await center()
      // Collapsed descendants move with their parent and stay collapsed after reload.
      await node('r').click();await page.getByRole('button',{name:t.collapse,exact:true}).click();await center()
      await drag('r',await oppositePoint(0));assert.equal(find(await root(),'r').expanded,false)
      assert.equal(await node('r1').count(),0);await sideIs('r',0)
      await page.reload({waitUntil:'networkidle'});await page.getByRole('button',{name:t.nav,exact:true}).click();await node('root').waitFor();await center()
      assert.equal(find(await root(),'r').direction,0);assert.equal(find(await root(),'r').expanded,false);await sideIs('r',0)
      await node('r').click();await page.getByRole('button',{name:t.expand,exact:true}).click();await center()
      // Promote a nested branch to the opposite side, retaining its actual subtask ownership.
      await drag('r1',await oppositePoint(1))
      assert.ok((await root()).children.some(child=>child.id==='r1'&&child.direction===1))
      assert.equal(find(await root(),'r1').subTaskId,'task-sub');assert.equal(find(await root(),'r1').taskId,'linked')
      assert.equal(find(await root(),'r1').children[0].id,'r11');await sideIs('r1',1)
      assert.deepEqual(await tasks(),originalTasks)
      // Native drop onto another topic retains its original tree-reparent behavior.
      await center();await node('l1').dragTo(node('d'),{targetPosition:{x:15,y:10}})
      await page.waitForFunction(()=>JSON.parse(localStorage.getItem('anvilite-mind-maps')).state.maps[0].root.children.find(n=>n.id==='d').children?.some(n=>n.id==='l1'))
      assert.deepEqual(await tasks(),originalTasks)
      // Escape cancels a moved pointer gesture; the next drag still works.
      await center();const beforeCancel=await maps(),box=await node('r1').boundingBox(),point=await oppositePoint(0)
      await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await page.mouse.move(point.x,point.y,{steps:18});await page.waitForTimeout(60)
      await page.keyboard.press('Escape');await page.mouse.up();await page.waitForTimeout(350)
      assert.deepEqual(await maps(),beforeCancel)
      await center();await page.getByRole('button',{name:t.zoomIn,exact:true}).click();await page.getByRole('button',{name:t.zoomOut,exact:true}).click()
      await drag('r1',await oppositePoint(0));assert.equal(find(await root(),'r1').direction,0);await sideIs('r1',0)
      assert.deepEqual(await tasks(),originalTasks)
      const expected=await maps();await page.reload({waitUntil:'networkidle'});await page.getByRole('button',{name:t.nav,exact:true}).click();await node('root').waitFor();await center()
      assert.deepEqual(await maps(),expected);await sideIs('r1',0);assert.deepEqual(await tasks(),originalTasks)
      await node('r1').click();await page.mouse.move(65,85);await page.waitForTimeout(350)
      await page.screenshot({path:path.join(output,language+'-'+width+'-side-drag.png'),fullPage:true})
      assert.deepEqual(errors,[])
      checks.push({language,width,height,rightToLeft:true,leftToRight:true,collapsedBranch:true,nestedPromotion:true,subtreeAndTaskDataPreserved:true,nativeReparent:true,ignoredDropAndPan:true,escapeCancelAndRetry:true,zoom:true,coldReload:true,errors})
      console.log(JSON.stringify(checks.at(-1)));await context.close()
    }
    fs.writeFileSync(path.join(output,'report.json'),JSON.stringify({browser:'Microsoft Edge isolated synthetic contexts',checks},null,2))
  }catch(error){if(lastPage&&!lastPage.isClosed())await lastPage.screenshot({path:path.join(output,'failure.png'),fullPage:true}).catch(()=>{});throw error}
  finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve))}
})().catch(error=>{console.error(error);process.exitCode=1})
