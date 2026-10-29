const fs = require('node:fs')
const path = require('node:path')
const http = require('node:http')
const assert = require('node:assert/strict')
const { chromium } = require('playwright')
const root = path.resolve(__dirname, '../..')
const dist = path.join(root, 'dist')
const output = path.join(__dirname, 'category-time-ui-2026-10-28')
fs.mkdirSync(output, { recursive: true })
const server = http.createServer((req, res) => {
  const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname)
  const file = path.resolve(dist, '.' + (pathname === '/' ? '/index.html' : pathname))
  if (!file.startsWith(dist + path.sep) || !fs.existsSync(file)) { res.writeHead(404).end(); return }
  res.setHeader('Content-Type', ({ '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' })[path.extname(file)] || 'application/octet-stream')
  fs.createReadStream(file).pipe(res)
})
;(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const origin='http://127.0.0.1:'+server.address().port
 let browser,lastPage;const checks=[]
 try{
  browser=await chromium.launch({channel:'msedge',headless:true,args:['--disable-background-networking','--disable-component-update','--no-first-run']})
  for(const language of ['zh','en'])for(const[width,height]of [[900,600],[1280,800]]){
   const context=await browser.newContext({viewport:{width,height},locale:language==='zh'?'zh-CN':'en-US',timezoneId:'Europe/Berlin'})
   const page=lastPage=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});await page.route('**/*',route=>route.request().url().startsWith(origin+'/')?route.continue():route.abort())
   const names=language==='zh'?['生活','锻炼','学习','灵感','工作','档案馆']:['Life','Fitness','Study','Inspiration','Work','Archive']
   const times=language==='zh'?['1时30分','60分','0分','2时','1时1分']:['1h30m','60m','0m','2h','1h1m']
   await page.addInitScript(({language,width,names})=>{
    localStorage.clear();localStorage.setItem('anvilite-subtask-migration-v3','synthetic-current-format');localStorage.setItem('anvilite-migration-timer-tags-v031','synthetic-current-format')
    localStorage.setItem('anvilite-settings',JSON.stringify({state:{settings:{language,theme:width===900?'dawn-white':'forge-purple',unlockedThemes:['dawn-white','forge-purple']}},version:0}))
    const now=new Date().toISOString(),make=(id,category,minutes)=>({id,title:'Synthetic '+category,status:'done',category,priority:'medium',difficulty:2,dueDate:null,description:'Synthetic notes',actualMinutes:minutes,xpReward:0,completedAt:now,deletedAt:null,isHidden:false,sortOrder:0,timerStartedAt:null,timerAccumulated:0,tags:[],subTasks:[],createdAt:now,updatedAt:now})
    localStorage.setItem('anvilite-tasks',JSON.stringify({state:{tasks:[make('home','home',90),make('arena','arena',60),make('workshop','workshop',120),make('forge','forge',61)],lastCategory:'home',completedViewMode:'area',customTaskGroups:[]},version:0}))
    const templates=['home','arena','library','workshop','forge','milestone'];localStorage.setItem('anvilite-areas',JSON.stringify({state:{areas:templates.map((id,i)=>({id:'area-'+id,templateId:id,name:names[i],category:id==='milestone'?'_milestone':id,position:{x:0,y:0},sortOrder:i,isPreset:true,canDelete:id!=='home'&&id!=='milestone',canMove:false,createdAt:now}))},version:0}))
   },{language,width,names})
   const tasks=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('anvilite-tasks')).state.tasks)
   await page.goto(origin,{waitUntil:'networkidle'});await page.getByRole('button',{name:language==='zh'?'分类':'Categories',exact:true}).click()
   const original=await tasks()
   for(let i=0;i<5;i++){
    const card=page.getByText(names[i],{exact:true}).locator('xpath=../../..');assert.ok((await card.textContent()).includes(times[i]),'Category '+names[i]+' compact time')
   }
   await page.mouse.move(65,85);await page.waitForTimeout(350);await page.screenshot({path:path.join(output,language+'-'+width+'-cards.png'),fullPage:true})
   await page.getByText(names[0],{exact:true}).click();await page.waitForTimeout(350)
   assert.ok((await page.locator('main').textContent()).includes(times[0]));await page.screenshot({path:path.join(output,language+'-'+width+'-detail.png'),fullPage:true})
   await page.getByRole('button',{name:new RegExp(language==='zh'?'返回分类':'Back to Categories','i')}).click();await page.getByText(names[5],{exact:true}).click();await page.waitForTimeout(350)
   const archive=await page.locator('main').textContent();assert.ok(archive.includes(times[0]));assert.ok(archive.includes(times[4]));assert.ok(!archive.includes('1小时')&&!archive.includes('90分钟'))
   await page.screenshot({path:path.join(output,language+'-'+width+'-archive.png'),fullPage:true});assert.deepEqual(await tasks(),original);assert.deepEqual(errors,[])
   checks.push({language,width,height,cards:true,detail:true,archiveCategoryTimes:true,boundaries:true,recordsUnchanged:true,errors});console.log(JSON.stringify(checks.at(-1)));await context.close()
  }
  fs.writeFileSync(path.join(output,'report.json'),JSON.stringify({checks},null,2))
 }catch(error){if(lastPage&&!lastPage.isClosed())await lastPage.screenshot({path:path.join(output,'failure.png'),fullPage:true}).catch(()=>{});throw error}
 finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve))}
})().catch(error=>{console.error(error);process.exitCode=1})
