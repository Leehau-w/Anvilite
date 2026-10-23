const fs = require('node:fs')
const path = require('node:path')
const http = require('node:http')
const assert = require('node:assert/strict')
const ts = require('typescript')
const { chromium } = require('playwright')
const root = path.resolve(__dirname, '../..'), dist = path.join(root, 'dist')
const output = path.join(__dirname, 'milestone-overview-removal-2026-10-23')
function translations(language) {
  const js = ts.transpileModule(fs.readFileSync(path.join(root, 'src/i18n', language + '.ts'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText
  const module = { exports: {} }; new Function('exports', 'module', js)(module.exports, module); return module.exports[language]
}
const server = http.createServer((req, res) => {
  const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname)
  const file = path.resolve(dist, '.' + (pathname === '/' ? '/index.html' : pathname)), relative = path.relative(dist, file)
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404).end(); return }
  res.setHeader('Content-Type', ({ '.html':'text/html', '.js':'text/javascript', '.css':'text/css' })[path.extname(file)] || 'application/octet-stream')
  fs.createReadStream(file).pipe(res)
})
;(async () => {
 const scripts=fs.readdirSync(path.join(dist,'assets')).filter(name=>name.endsWith('.js')).map(name=>fs.readFileSync(path.join(dist,'assets',name),'utf8')).join(' ')
 for(const marker of ['data-personal-overview','data-milestone-page','data-capability-chart']) assert.ok(scripts.includes(marker), 'Stale bundle: '+marker)
 fs.mkdirSync(output,{recursive:true}); await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve))
 const origin='http://127.0.0.1:'+server.address().port, checks=[], screenshots=[]
 let browser
 try {
  browser=await chromium.launch({channel:'msedge',headless:true,args:['--disable-background-networking','--disable-component-update','--no-first-run']})
  for(const language of ['zh','en']) for(const [width,height] of [[900,600],[1280,800]]) {
   const t=translations(language), theme=width===900?'dawn-white':'forge-purple'
   const context=await browser.newContext({viewport:{width,height},locale:language==='zh'?'zh-CN':'en-US',timezoneId:'Europe/Berlin',serviceWorkers:'block'})
   await context.route('**/*',route=>route.request().url().startsWith(origin+'/')?route.continue():route.abort())
   const page=await context.newPage(); page.setDefaultTimeout(12000)
   const errors=[]; page.on('pageerror',e=>errors.push(e.message)); page.on('console',m=>{if(m.type()==='error')errors.push(m.text())})
   await page.clock.setFixedTime(new Date('2026-10-23T12:00:00+02:00'))
   await page.addInitScript(({language,theme})=>{
    if(sessionStorage.getItem('degamification-seeded'))return
    sessionStorage.setItem('degamification-seeded','yes'); localStorage.clear()
    const now=new Date().toISOString(),put=(key,state,version=0)=>localStorage.setItem('anvilite-'+key,JSON.stringify({state,version}))
    for(const key of ['anvilite-subtask-migration-v3','anvilite-subhabit-migration-v3','anvilite-migration-timer-tags-v031','anvilite-migration-sop-v031'])localStorage.setItem(key,'synthetic-current-format')
    put('settings',{settings:{theme,language,dashboardLayout:[],unlockedThemes:['dawn-white'],characterName:'Synthetic user'}})
    put('character',{character:{name:'Synthetic user',level:19,currentXP:11,totalXP:987,ore:321,totalOreEarned:654,titlePreset:'custom',customTitles:['LEGACY_TITLE_HIDDEN'],streakDays:7,lastActiveDate:'2026-10-22',globalStatus:'active',prestigeLevel:2,xpFormulaVersion:1,createdAt:now}})
    put('badges',{earnedIds:{legacy:now},notifyQueue:['legacy']})
    put('areas',{areas:[{id:'area-home',templateId:'home',name:'Research',category:'home',position:{x:100,y:200},sortOrder:0,isPreset:false,canDelete:false,canMove:false,createdAt:now},{id:'area-archive',templateId:'milestone',name:'Archive',category:'_milestone',position:{x:200,y:200},sortOrder:1,isPreset:false,canDelete:false,canMove:false,createdAt:now},{id:'area-custom',templateId:null,name:language==='zh'?'这是一个很长的自定义分类名称用于检查图谱标签':'A very long custom category name for radar labels',category:'custom-craft',position:{x:0,y:0},sortOrder:2,isPreset:false,canDelete:true,canMove:true,createdAt:now}]})
    const task=(id,title,patch={})=>({id,title,category:'home',status:'todo',difficulty:2,priority:'high',backgroundColor:null,dueDate:null,description:'Synthetic isolated UI validation',actualMinutes:15,xpReward:0,completedAt:null,deletedAt:null,isHidden:false,sortOrder:0,timerStartedAt:null,timerAccumulated:0,tags:[],subTasks:[],createdAt:now,updatedAt:now,...patch})
    put('tasks',{tasks:[task('task-action','Synthetic actionable task'),task('task-waiting','Synthetic waiting reply',{status:'waiting',actualMinutes:7}),task('task-done','Synthetic completed task',{status:'done',actualMinutes:40,xpReward:35,completionId:'old-task',completedAt:now}),task('task-hidden','Synthetic hidden task',{status:'done',actualMinutes:10,xpReward:15,completionId:'old-hidden',completedAt:now,isHidden:true}),task('task-deleted','Synthetic deleted task',{status:'done',actualMinutes:999,completedAt:now,deletedAt:now}),task('task-custom','Synthetic custom completed',{category:'custom-craft',status:'done',completedAt:now,actualMinutes:5}),task('task-historical','Synthetic historical completed',{category:'Historical category without an area',status:'done',completedAt:now,actualMinutes:35})],lastCategory:'home',completedViewMode:'month',customTaskGroups:[]})
    put('habits',{habits:[{id:'habit-action',title:'Synthetic recurring habit',category:'home',difficulty:2,estimatedMinutes:5,repeatType:'daily',customIntervalDays:null,weeklyDays:null,weeklyMode:null,weeklyFlexibleCount:null,monthlyDays:null,targetCount:1,currentCycleCount:0,startDate:'2026-10-23',endDate:null,reminderTime:null,description:'',subHabits:[],status:'active',isHidden:false,deletedAt:null,timerStartedAt:null,timerAccumulated:0,actualMinutes:0,consecutiveCount:7,totalCompletions:7,toleranceCharges:1,toleranceNextAt:21,weeklyCompletionCount:0,lastCompletedAt:null,lastDueAt:null,lastMissCheckDate:'2026-10-22',cycleKey:'2026-10-23',sortOrder:0,createdAt:now,updatedAt:now}],completedHabitViewMode:'area',customHabitGroups:[]})
    put('growth-events',{events:[{id:'real-old',type:'task_complete',title:'Synthetic completed task',details:{entityId:'task-done',completionId:'old-task',xpGained:35,oreGained:35,actualMinutes:40,categoryName:'home'},isMilestone:false,timestamp:now},{id:'manual-old',type:'custom_milestone',title:'Synthetic preserved memory',details:{description:'Preserved personal note'},isMilestone:true,timestamp:now},{id:'reward-note',type:'level_up',title:'LEGACY_LEVEL_HIDDEN',details:{newLevel:19,description:'Preserved handwritten memory from earlier version'},isMilestone:true,timestamp:now},{id:'badge-old',type:'badge_earned',title:'LEGACY_BADGE_HIDDEN',details:{badgeId:'legacy'},isMilestone:true,timestamp:now},{id:'level-old',type:'level_up',title:'LEGACY_LEVEL_HIDDEN',details:{newLevel:19},isMilestone:true,timestamp:now}]})
    put('dashboard',{layout:[{id:'quickAdd',col:0,row:0,colSpan:24,rowSpan:2},{id:'stats',col:0,row:2,colSpan:12,rowSpan:4},{id:'character',col:12,row:2,colSpan:12,rowSpan:4},{id:'tasks',col:0,row:6,colSpan:12,rowSpan:8},{id:'habits',col:12,row:6,colSpan:12,rowSpan:8},{id:'growth',col:0,row:14,colSpan:12,rowSpan:8},{id:'waiting',col:12,row:14,colSpan:12,rowSpan:8},{id:'flows',col:0,row:22,colSpan:24,rowSpan:5}],visibleCards:['quickAdd','stats','character','tasks','habits','growth','waiting']},3)
   },{language,theme})
   const card=id=>page.locator('[data-dashboard-card="'+id+'"]'), row=id=>page.locator('[data-task-id="'+id+'"]')
   const read=key=>page.evaluate(key=>JSON.parse(localStorage.getItem('anvilite-'+key)).state,key)
   const go=async tab=>page.getByRole('navigation').getByTitle(t['sidebar_'+tab],{exact:true}).click()
   const snap=async suffix=>{await page.mouse.move(5,5);await page.waitForTimeout(250);const file=path.join(output,language+'-'+width+'-'+suffix+'.png');await page.screenshot({path:file,fullPage:true});screenshots.push(file)}
   const noGame=async()=>{const text=await page.locator('body').innerText();assert.equal(/\bXP\b|Lv\.\s*\d|LEGACY_(TITLE|BADGE|LEVEL)_HIDDEN|称号|成就|繁荣等级/.test(text),false,text)}
   const balances=async()=>{const c=(await read('character')).character;return [c.level,c.currentXP,c.totalXP,c.ore,c.totalOreEarned,c.prestigeLevel,c.titlePreset,c.customTitles]}
   const waitStatus=async(id,status,kind='tasks')=>page.waitForFunction(({id,status,kind})=>JSON.parse(localStorage.getItem('anvilite-'+kind)).state[kind].find(x=>x.id===id).status===status,{id,status,kind})
   await page.goto(origin);await page.locator('[data-personal-overview]').waitFor()
   const keys=['tasks','habits','character','growth-events','dashboard']
   const snapshot=()=>page.evaluate(keys=>Object.fromEntries(keys.map(key=>[key,localStorage.getItem('anvilite-'+key)])),keys)
   const before=await snapshot()
   await go('milestone');await page.locator('[data-milestone-page]').waitFor()
   assert.equal(await page.locator('[data-milestone-page] [data-personal-overview]').count(),0)
   await page.getByRole('heading',{name:t.milestone_abilityChart,exact:true}).waitFor()
   const chart=page.locator('[data-capability-chart]')
   assert.equal(await chart.getAttribute('data-capability-metric'),'count')
   await chart.getByRole('button',{name:t.heatmap_timeMetric,exact:true}).click()
   assert.equal(await chart.getAttribute('data-capability-metric'),'time')
   const top=await chart.boundingBox()
   assert.ok(top.y<150,JSON.stringify(top))
   const geometry=await page.locator('[data-milestone-page]').evaluate(el=>({width:el.clientWidth,scrollWidth:el.scrollWidth}))
   assert.ok(geometry.scrollWidth<=geometry.width+1,JSON.stringify(geometry))
   assert.equal(await page.locator('[data-activity-id="manual-old"]').count(),1)
   await snap('milestones')
   await page.locator('[data-personal-stats]').scrollIntoViewIfNeeded()
   await snap('personal-data')
   assert.deepEqual(await snapshot(),before)
   await go('dashboard');await page.locator('[data-personal-overview]').waitFor()
   assert.equal(await card('character').count(),1)
   assert.deepEqual(await snapshot(),before)
   assert.deepEqual(errors,[])
   checks.push({language,width,height,theme,milestoneOverviewRemoved:true,chartMovedUp:true,chartMetricSwitch:true,personalDataPreserved:true,dashboardUnchanged:true,storageUnchanged:true,errors})
   console.log(JSON.stringify(checks[checks.length-1]));await context.close()
  }
  fs.writeFileSync(path.join(output,'report.json'),JSON.stringify({checks,screenshots},null,2))
  console.log(JSON.stringify({groups:checks.length,screenshots:screenshots.length}))
 }finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve))}
})().catch(error=>{console.error(error);process.exitCode=1})
