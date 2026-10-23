const fs = require('node:fs')
const path = require('node:path')
const { execFileSync } = require('node:child_process')
const vm = require('node:vm')
const esbuild = require('esbuild')
const root = path.resolve(__dirname, '../..')
const output = path.join(root, 'src/test/fixtures')
const tags = ['v0.3.0', 'v0.3.3']
async function generate(tag) {
  const files = new Set(execFileSync('git', ['ls-tree', '-r', '--name-only', tag], { cwd: root, encoding: 'utf8' }).trim().split(/\r?\n/))
  const source = new Map()
  const find = name => [name, name + '.ts', name + '.tsx', name + '/index.ts'].find(file => files.has(file))
  const entry = ['taskStore', 'habitStore', 'characterStore', 'badgeStore', 'dashboardStore', 'settingsStore', 'areaStore', 'growthEventStore']
    .map(name => 'import {use' + ({ taskStore:'Task', habitStore:'Habit', characterStore:'Character', badgeStore:'Badge', dashboardStore:'Dashboard', settingsStore:'Settings', areaStore:'Area', growthEventStore:'GrowthEvent' }[name]) + 'Store} from "@/stores/' + name + '";').join('\n') +
    (tags.includes(tag) ? '\nimport {useSOPStore} from "@/stores/sopStore";\nimport {useInspirationStore} from "@/stores/inspirationStore";' : '') + '\n' + fs.readFileSync(path.join(__dirname, 'release-legacy-scenario.txt'), 'utf8')
  const result = await esbuild.build({ stdin: { contents: entry, sourcefile: 'legacy-entry.ts', resolveDir: root }, bundle: true, write: false, platform: 'node', format: 'cjs', define: { __APP_VERSION__: JSON.stringify(tag.slice(1)), LEGACY_TAG: JSON.stringify(tag) }, plugins: [{ name: 'tag-sources', setup(build) {
    build.onResolve({filter:/^@\//}, args => ({ path: find('src/' + args.path.slice(2)), namespace: 'tag' }))
    build.onResolve({filter:/^\./, namespace:'tag'}, args => ({ path: find(path.posix.normalize(path.posix.join(path.posix.dirname(args.importer), args.path))), namespace:'tag' }))
    build.onLoad({filter:/.*/, namespace:'tag'}, args => {
      if (!source.has(args.path)) source.set(args.path, execFileSync('git', ['show', tag + ':' + args.path], {cwd:root,encoding:'utf8'}))
      return { contents:source.get(args.path), loader:args.path.endsWith('.tsx')?'tsx':'ts', resolveDir:root }
    })
  }}] })
  const items = {}
  const storage = { getItem:key=>items[key]??null, setItem:(key,value)=>{items[key]=String(value)}, removeItem:key=>{delete items[key]}, clear:()=>Object.keys(items).forEach(key=>delete items[key]) }
  const FixedDate = class extends Date { constructor(...args) { super(...(args.length?args:['2026-10-23T10:00:00.000Z'])) } static now(){return new Date('2026-10-23T10:00:00.000Z').getTime()} }
  let count = 0
  const seededMath = Object.create(Math); seededMath.random=()=>0.314159
  const context = { require, process, module:{exports:{}}, console, localStorage:storage, sessionStorage:storage, window:{localStorage:storage}, document:{documentElement:{setAttribute(){}}}, Date:FixedDate, Math:seededMath, crypto:{randomUUID:()=> 'legacy-id-' + (++count)}, performance, setTimeout, clearTimeout, TAG:tag }
  vm.runInNewContext(result.outputFiles[0].text, context, { filename:tag + '-stores.cjs' })
  const payload = JSON.parse(JSON.stringify(context.module.exports))
  const prefix = 'anvilite'
  const suffixes={character:'character',tasks:'tasks',habits:'habits',areas:'areas',badges:'badges',dashboard:'dashboard',settings:'settings',growthEvents:'growth-events',sops:'sops',inspirations:'inspirations'}
  // Flush every original store state through exactly the original persistence envelopes.
  for(const [slice,suffix] of Object.entries(suffixes)) if(payload.data[slice]) storage.setItem(prefix+'-'+suffix,JSON.stringify({state:payload.data[slice],version:slice==='dashboard'?3:0}))
  const fixture={ provenance:{tag,commit:execFileSync('git',['rev-parse',tag+'^{commit}'],{cwd:root,encoding:'utf8'}).trim(),method:'Original tagged store modules bundled from git and executed with synthetic actions; no current store modules or real user data.',synthetic:true}, payload, storage:items }
  fs.mkdirSync(output,{recursive:true}); fs.writeFileSync(path.join(output,'release-'+tag+'-storage.json'),JSON.stringify(fixture,null,2)+'\n')
  console.log(tag+' fixture: '+payload.data.tasks.tasks.length+' task records, '+payload.data.habits.habits.length+' habit records')
}
(async()=>{for(const tag of tags) await generate(tag)})().catch(e=>{console.error(e);process.exitCode=1})
