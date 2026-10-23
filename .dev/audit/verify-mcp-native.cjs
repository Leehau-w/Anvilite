const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict')
const {createRequire}=require('node:module'),{pathToFileURL}=require('node:url'),{randomUUID}=require('node:crypto')
const {_electron}=require('playwright')
const root=path.resolve(__dirname,'../..'),output=path.join(__dirname,'mcp-native-2026-10-23')
const mcpRequire=createRequire(path.join(root,'mcp/package.json'))
;(async()=>{
 fs.mkdirSync(output,{recursive:true})
 const {Client}=await import(pathToFileURL(mcpRequire.resolve('@modelcontextprotocol/client')).href)
 const {StdioClientTransport}=await import(pathToFileURL(mcpRequire.resolve('@modelcontextprotocol/client/stdio')).href)
 const profile=fs.mkdtempSync(path.join(os.tmpdir(),'anvilite-mcp-audit-')),nonce=randomUUID()
 fs.writeFileSync(path.join(profile,'synthetic-profile.marker'),nonce)
 const env={...process.env,ANVILITE_MCP_AUDIT_PROFILE:profile,ANVILITE_MCP_AUDIT_NONCE:nonce};delete env.ELECTRON_RUN_AS_NODE
 let app;const clients=[],errors=[],checks=[]
 try{
  app=await _electron.launch({executablePath:require('electron'),args:[path.join(__dirname,'mcp-native-fixture.cjs')],cwd:root,env,timeout:30000})
  const page=await app.firstWindow();page.setDefaultTimeout(15000)
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())})
  const ready=async()=>page.waitForFunction(async()=>{const s=await window.electronAPI?.mcpGetStatus?.();return !!s?.ready})
  await ready()
  const read=key=>page.evaluate(key=>JSON.parse(localStorage.getItem('anvilite-'+key)).state,key)
  await page.evaluate(()=>{
   localStorage.clear(); const now=new Date().toISOString(),put=(key,state,version=0)=>localStorage.setItem('anvilite-'+key,JSON.stringify({state,version}))
   put('tasks',{tasks:[],lastCategory:'other',completedViewMode:'month',customTaskGroups:[]})
   put('habits',{habits:[],completedHabitViewMode:'area',customHabitGroups:[]})
   put('settings',{settings:{theme:'dawn-white',language:'zh',dashboardLayout:[],unlockedThemes:['dawn-white'],characterName:'Synthetic MCP user'}})
   put('character',{character:{name:'Synthetic MCP user',level:17,totalXP:987,currentXP:11,ore:321,totalOreEarned:654,titlePreset:'forge',customTitles:null,streakDays:0,lastActiveDate:null,globalStatus:'active',prestigeLevel:0,xpFormulaVersion:1,createdAt:now}})
   put('badges',{earnedIds:{},notifyQueue:[]});put('growth-events',{events:[]})
  })
  await page.reload();await ready()
  const initial=await page.evaluate(()=>window.electronAPI.mcpGetStatus());assert.equal(initial.enabled,false);assert.equal(initial.token,null)
  await page.getByTitle('设置',{exact:true}).click();const panel=page.locator('[data-mcp-settings]');await panel.waitFor();await panel.scrollIntoViewIfNeeded()
  await panel.locator('[data-mcp-enabled]').click()
  await page.waitForFunction(async()=>!!(await window.electronAPI.mcpGetStatus()).enabled)
  let binding=await page.evaluate(()=>window.electronAPI.mcpGetStatus());assert.equal(binding.permissions.tasks.read,true);assert.equal(binding.permissions.tasks.write,false)
  async function connect(binding){
   const logs=[];const transport=new StdioClientTransport({...binding.clientConfig,cwd:root,env:{...process.env,...binding.clientConfig.env},stderr:'pipe'})
   transport.stderr.on('data',x=>logs.push(x.toString()))
   const client=new Client({name:'anvilite-native-synthetic-audit',version:'1.0.0'});await client.connect(transport);clients.push(client)
   return {client,logs,transport}
  }
  const invoke=async(client,name,args={})=>(await client.callTool({name,arguments:args})).structuredContent
  const expectOk=result=>{assert.equal(result.ok,true,JSON.stringify(result));return result.data}
  let connection=await connect(binding),client=connection.client
  assert.equal((await client.listTools()).tools.length,19)
  const context=expectOk(await invoke(client,'get_context'));assert.equal(context.accountId,'default')
  const denied=await invoke(client,'tasks_create',{requestId:'native-denied-0001',expectedVersion:context.collectionVersions.tasks,record:{title:'Denied task'}});assert.equal(denied.ok,false);assert.equal((await read('tasks')).tasks.length,0)
  await panel.locator('[data-mcp-permission="tasks:write"]').click();await page.waitForFunction(async()=>!!(await window.electronAPI.mcpGetStatus()).permissions.tasks.write)
  await panel.locator('[data-mcp-permission="habits:write"]').click();await page.waitForFunction(async()=>!!(await window.electronAPI.mcpGetStatus()).permissions.habits.write)
  await panel.locator('[data-mcp-permission="flows:write"]').click();await page.waitForFunction(async()=>!!(await window.electronAPI.mcpGetStatus()).permissions.flows.write)
  binding=await page.evaluate(()=>window.electronAPI.mcpGetStatus());await client.close();connection=await connect(binding);client=connection.client
  const versions=()=>invoke(client,'get_context').then(expectOk)
  const taskCreate={requestId:'native-task-create-0001',expectedVersion:(await versions()).collectionVersions.tasks,record:{title:'MCP合成任务：等待客户回信',category:'other',priority:'high',actualMinutes:23,tags:['合成']}}
  const created=expectOk(await invoke(client,'tasks_create',taskCreate));assert.equal(created.record.actualMinutes,23);assert.deepEqual(created.record.tags,['合成'])
  const same=expectOk(await invoke(client,'tasks_create',taskCreate));assert.equal(same.id,created.id);assert.equal((await read('tasks')).tasks.length,1)
  const getTask=()=>invoke(client,'tasks_get',{id:created.id}).then(expectOk)
  let current=await getTask();expectOk(await invoke(client,'tasks_action',{id:created.id,action:'wait',requestId:'native-task-wait-0001',expectedVersion:current.version}));assert.equal((await getTask()).record.status,'waiting')
  const conflict=await invoke(client,'tasks_update',{id:created.id,patch:{title:'Stale edit must not win'},requestId:'native-stale-0001',expectedVersion:current.version});assert.equal(conflict.ok,false);assert.equal(conflict.error.code,'version_conflict')
  current=await getTask();expectOk(await invoke(client,'tasks_action',{id:created.id,action:'complete',requestId:'native-task-complete-0001',expectedVersion:current.version}));assert.equal((await getTask()).record.status,'done')
  assert.equal((await read('growth-events')).events.filter(e=>e.type==='task_complete').length,1)
  current=await getTask();expectOk(await invoke(client,'tasks_action',{id:created.id,action:'undo',requestId:'native-task-undo-0001',expectedVersion:current.version}));assert.equal((await getTask()).record.status,'todo')
  const habitCreate={requestId:'native-habit-create-0001',expectedVersion:(await versions()).collectionVersions.habits,record:{title:'MCP合成多次习惯',category:'other',targetCount:3}}
  const habit=expectOk(await invoke(client,'habits_create',habitCreate));let h=expectOk(await invoke(client,'habits_get',{id:habit.id}))
  const habitAction={id:habit.id,action:'complete',requestId:'native-habit-complete-0001',expectedVersion:h.version}
  expectOk(await invoke(client,'habits_action',habitAction));h=expectOk(await invoke(client,'habits_get',{id:habit.id}));assert.equal(h.record.currentCycleCount,1)
  expectOk(await invoke(client,'habits_action',habitAction));assert.equal(expectOk(await invoke(client,'habits_get',{id:habit.id})).record.currentCycleCount,1)
  await client.close();connection=await connect(binding);client=connection.client;expectOk(await invoke(client,'habits_action',habitAction));assert.equal(expectOk(await invoke(client,'habits_get',{id:habit.id})).record.currentCycleCount,1)
  const receipt=expectOk(await invoke(client,'operations_get',{requestId:habitAction.requestId}));assert.equal(receipt.status,'committed')
  const folderVersions=expectOk(await invoke(client,'flow_folders_list'))
  const folder=expectOk(await invoke(client,'flow_folders_create',{requestId:'native-folder-create-0001',expectedVersion:folderVersions.collectionVersion,name:'MCP合成文件夹'}))
  const flow=expectOk(await invoke(client,'flows_create',{requestId:'native-flow-create-0001',expectedVersion:(await versions()).collectionVersions.flows,record:{title:'MCP合成流程',folderId:folder.id,steps:[{title:'第一步',content:{type:'doc',content:[{type:'paragraph',content:[{type:'text',text:'保留说明'}]}]},childSteps:[{title:'保留子步骤'}]},{title:'保留旁边步骤'}]}}))
  let flowRead=expectOk(await invoke(client,'flows_get',{id:flow.id}));const first=flowRead.record.steps[0]
  expectOk(await invoke(client,'flows_update',{id:flow.id,requestId:'native-flow-edit-0001',expectedVersion:flowRead.version,patch:{steps:[{id:first.id,title:'改名保留其余内容'}]}}))
  flowRead=expectOk(await invoke(client,'flows_get',{id:flow.id}));assert.deepEqual(flowRead.record.steps[0].content,first.content);assert.deepEqual(flowRead.record.steps[0].childSteps,first.childSteps);assert.equal(flowRead.record.steps.length,2)
  const instantiateArgs={id:flow.id,action:'instantiate',requestId:'native-flow-task-0001',expectedVersion:flowRead.version,taskCollectionVersion:(await versions()).collectionVersions.tasks}
  const instantiated=expectOk(await invoke(client,'flows_action',instantiateArgs));assert.equal(instantiated.record.subTasks.length,2)
  assert.equal(expectOk(await invoke(client,'flows_action',instantiateArgs)).id,instantiated.id)
  const balances=(await read('character')).character;assert.equal(balances.totalXP,987);assert.equal(balances.ore,321)
  await panel.locator('[data-mcp-enabled]').click();await page.waitForFunction(async()=>!(await window.electronAPI.mcpGetStatus()).enabled)
  const revoked=await invoke(client,'tasks_list');assert.equal(revoked.ok,false)
  await page.reload();await ready();const reloaded=await page.evaluate(()=>window.electronAPI.mcpGetStatus());assert.equal(reloaded.enabled,false);assert.notEqual(reloaded.sessionId,binding.sessionId)
  assert.equal((await read('habits')).habits[0].currentCycleCount,1)
  assert.equal((await read('tasks')).tasks.length,2)
  assert.deepEqual(errors,[])
  for(const value of connection.logs){assert.equal(value.includes(binding.token),false)}
  checks.push('default off and read-only enable','real official SDK over stdio and Windows pipe','domain write grants and token rotation','task create/wait/complete/undo and stale edit rejection','partial habit completion deduplicated across new stdio process','flow folder/create and partial step update preserves rich text/children/siblings','flow instantiate existing business action','revocation/reload and durable synthetic state','legacy reward values unchanged')
  fs.writeFileSync(path.join(output,'report.json'),JSON.stringify({checks,errors,profile,protocolTools:19,realElectron:true},null,2));console.log(JSON.stringify({checks:checks.length,errors,realElectron:true}))
 }finally{for(const client of clients)try{await client.close()}catch{};if(app)await app.close()}
})().catch(e=>{console.error(e);process.exitCode=1})
