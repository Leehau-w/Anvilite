import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import old030 from '@/test/fixtures/release-v0.3.0-storage.json'
import old033 from '@/test/fixtures/release-v0.3.3-storage.json'
import type { MindMapDocument, MindMapNode, MindMapState } from '@/types/mindMap'

const storage = localStorage
const session = sessionStorage
const suffixes = ['character', 'tasks', 'habits', 'areas', 'badges', 'dashboard', 'settings',
  'growth-events', 'sops', 'inspirations', 'mind-maps']
let data: typeof import('./dataExport')
let maps: typeof import('@/stores/mindMapStore')['useMindMapStore']
let tasks: typeof import('@/stores/taskStore')['useTaskStore']
let reload: ReturnType<typeof vi.fn>
beforeEach(() => {
  vi.resetModules()
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-10-23T10:00:00.000Z'))
  storage.clear()
  vi.stubGlobal('localStorage', storage)
  vi.stubGlobal('sessionStorage', session)
  reload = vi.fn()
  vi.stubGlobal('window', { localStorage: storage, location: { reload }, addEventListener: vi.fn() })
  vi.stubGlobal('document', { documentElement: { setAttribute: vi.fn() } })
})
afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); vi.unstubAllGlobals() })

async function load(account?: string) {
  if (account) {
    const prefix = account === 'default' ? 'anvilite' : 'anvilite-' + account
    for (const [key, value] of Object.entries(old033.storage)) {
      if (suffixes.some(suffix => key === 'anvilite-' + suffix)) storage.setItem(prefix + key.slice('anvilite'.length), value)
    }
    storage.setItem('anvilite-current-account', account)
  }
  data = await import('./dataExport')
  maps = (await import('@/stores/mindMapStore')).useMindMapStore
  tasks = (await import('@/stores/taskStore')).useTaskStore
}
async function coldReload() { vi.resetModules(); await load() }
function graph(id = 'map-one', taskId = 'legacy-id-5'): MindMapDocument {
  return { id, title: 'Project outline', createdAt: '2026-10-22T10:00:00.000Z', updatedAt: '2026-10-23T10:00:00.000Z', revision: 7,
    root: { id: 'root', topic: 'Research', expanded: true, children: [
      { id: 'branch', topic: 'Waiting for feedback', expanded: false, taskId, direction: 1,
        children: [{ id: 'leaf', topic: 'A private note' }] },
      { id: 'plain', topic: 'Independent idea', direction: 0 },
    ] } }
}
function snapshot(): MindMapState {
  const { maps: documents, selectedMapId } = maps.getState()
  return structuredClone({ maps: documents, selectedMapId })
}
function backup() { return JSON.parse(data.serializeExportData()) }
function native() {
  const api = { selectSyncDirectory: vi.fn(), readSyncFile: vi.fn(), writeSyncFile: vi.fn() }
  Object.assign(window, { electronAPI: api })
  return api
}

it('round trips multiple maps, collapsed branches, task references and selected map through backup and cold reload', async () => {
  await load('default')
  const linkedTask = tasks.getState().tasks[0]
  maps.setState({ maps: [graph('map-one', linkedTask.id), graph('map-two', linkedTask.id)], selectedMapId: 'map-two' })
  const expected = snapshot()
  const incoming = backup()
  expect(incoming.exportVersion).toBe(1)
  expect(incoming.data.mindMaps).toEqual(expected)
  expect(data.parseImportText(JSON.stringify(incoming)).success).toBe(true)
  maps.setState({ maps: [], selectedMapId: null })
  expect(data.applyImportPayload(incoming)).toEqual({ success: true })
  const persisted = JSON.parse(storage.getItem('anvilite-mind-maps')!)
  expect(persisted).toEqual({ state: expected, version: maps.persist.getOptions().version })
  expect(Object.keys(persisted.state).sort()).toEqual(['maps', 'selectedMapId'])
  await coldReload()
  expect(snapshot()).toEqual(expected)
  expect(tasks.getState().tasks).toEqual(incoming.data.tasks.tasks)
  expect(data.applyImportPayload(backup())).toEqual({ success: true })
  await coldReload()
  expect(snapshot()).toEqual(expected)
})

it.each([old030, old033])('imports $provenance.tag without maps and clears previous links instead of attaching them to imported tasks', async fixture => {
  await load('default')
  maps.setState({ maps: [graph()], selectedMapId: 'map-one' })
  const incoming = structuredClone(fixture.payload)
  expect(data.parseImportText(JSON.stringify(incoming)).success).toBe(true)
  expect(data.applyImportPayload(incoming as unknown as import('./dataExport').ExportData)).toEqual({ success: true })
  expect(JSON.parse(storage.getItem('anvilite-mind-maps')!).state).toEqual({ maps: [], selectedMapId: null })
  await coldReload()
  expect(snapshot()).toEqual({ maps: [], selectedMapId: null })
  expect(tasks.getState().tasks).toHaveLength(fixture.payload.data.tasks.tasks.length)
  expect(tasks.getState().tasks.map(task => task.id)).toEqual(fixture.payload.data.tasks.tasks.map(task => task.id))
})

it('restoring an empty map collection retains every actual task and the saved dashboard layout', async () => {
  await load('default')
  maps.setState({ maps: [graph()], selectedMapId: 'map-one' })
  const incoming = backup()
  incoming.data.mindMaps = { maps: [], selectedMapId: null }
  expect(data.applyImportPayload(incoming)).toEqual({ success: true })
  await coldReload()
  expect(snapshot()).toEqual({ maps: [], selectedMapId: null })
  expect(tasks.getState().tasks).toEqual(incoming.data.tasks.tasks)
  const restored = JSON.parse(data.serializeExportData()).data.dashboard
  expect(restored.layout).toEqual(incoming.data.dashboard.layout)
  expect(restored.visibleCards).toEqual(incoming.data.dashboard.visibleCards)
})

it.each([
  null, [], {}, { maps: {}, selectedMapId: null }, { maps: [], selectedMapId: 'missing' },
  { maps: [graph()], selectedMapId: 42 }, { maps: [graph(), graph()], selectedMapId: null },
  { maps: [{ ...graph(), revision: -1 }], selectedMapId: null },
  { maps: [{ ...graph(), createdAt: 'broken' }], selectedMapId: null },
  { maps: [{ ...graph(), root: { id: 'root', topic: 'Bad', children: 'invalid' } }], selectedMapId: null },
  { maps: [{ ...graph(), root: { id: 'root', topic: 'Duplicate', children: [{ id: 'root', topic: 'Also root' }] } }], selectedMapId: null },
  { maps: [{ ...graph(), root: { id: 'root', topic: 'Bad link', taskId: 42 } }], selectedMapId: null },
  { maps: [{ ...graph(), root: { id: 'root', topic: 'Bad direction', direction: 2 } }], selectedMapId: null },
  { maps: [{ ...graph(), root: { id: 'root', topic: 'Bad subtask link', ...{"subTaskId":"sub-without-task"} } }], selectedMapId: null },
  { maps: [{ ...graph(), root: { id: 'root', topic: 'Bad subtask link', ...{"taskId":"task","subTaskId":null} } }], selectedMapId: null },
  { maps: [{ ...graph(), root: { id: 'root', topic: 'Bad subtask link', ...{"taskId":"task","subTaskId":42} } }], selectedMapId: null },
  { maps: [{ ...graph(), root: { id: 'root', topic: 'Bad subtask link', ...{"taskId":"task","subTaskId":""} } }], selectedMapId: null },
  { maps: [{ ...graph(), root: { id: 'root', topic: 'Bad subtask link', ...{"taskId":"task","subTaskId":"  "} } }], selectedMapId: null },
  { maps: [{ ...graph(), root: { id: 'root', topic: 'Bad subtask link', ...{"taskId":"task","subTaskId":"xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"} } }], selectedMapId: null },
])('rejects malformed mind-map slices before writing any store: %j', async invalid => {
  await load('default')
  maps.setState({ maps: [graph()], selectedMapId: 'map-one' })
  const expected = snapshot()
  const incoming = backup()
  incoming.data.mindMaps = invalid
  const writes = vi.spyOn(storage, 'setItem')
  expect(data.parseImportText(JSON.stringify(incoming))).toEqual({ success: false, error: 'invalid_mindMaps' })
  expect(data.applyImportPayload(incoming)).toEqual({ success: false, error: 'invalid_mindMaps' })
  expect(writes).not.toHaveBeenCalled()
  expect(snapshot()).toEqual(expected)
})

it('rejects deeply nested maps before overwrite without overflowing the stack', async () => {
  await load('default')
  const incoming = backup()
  const root: MindMapNode = { id: 'root', topic: 'Start' }
  let node = root
  for (let index = 0; index < 100; index++) {
    const child: MindMapNode = { id: 'depth-' + index, topic: 'Nested' }
    node.children = [child]
    node = child
  }
  incoming.data.mindMaps = { maps: [{ ...graph(), root }], selectedMapId: null }
  const writes = vi.spyOn(storage, 'setItem')
  expect(data.parseImportText(JSON.stringify(incoming))).toEqual({ success: false, error: 'invalid_mindMaps' })
  expect(data.applyImportPayload(incoming)).toEqual({ success: false, error: 'invalid_mindMaps' })
  expect(writes).not.toHaveBeenCalled()
})

it('rolls back all prior store writes and a partially persisted map slice when the final restore write fails', async () => {
  await load('default')
  maps.setState({ maps: [graph()], selectedMapId: 'map-one' })
  const expected = snapshot()
  const incoming = backup()
  incoming.data.mindMaps.maps[0].title = 'Incoming overwrite'
  incoming.data.tasks.tasks[0].title = 'Incoming task title'
  await Promise.resolve()
  const keys = suffixes.map(suffix => 'anvilite-' + suffix)
  const before = keys.map(key => storage.getItem(key))
  const realSet = storage.setItem.bind(storage)
  let fail = true
  vi.spyOn(storage, 'setItem').mockImplementation((key, value) => {
    realSet(key, value)
    if (key === 'anvilite-mind-maps' && fail) { fail = false; throw new Error('Synthetic quota after writing maps') }
  })
  expect(data.applyImportPayload(incoming)).toEqual({ success: false, error: 'write_failed' })
  expect(keys.map(key => storage.getItem(key))).toEqual(before)
  await coldReload()
  expect(snapshot()).toEqual(expected)
  expect(tasks.getState().tasks[0].title).not.toBe('Incoming task title')
})

it('keeps default and non-default account maps separate during export, import and cold reload', async () => {
  await load('default')
  maps.setState({ maps: [graph('private-default')], selectedMapId: 'private-default' })
  const firstBytes = suffixes.map(suffix => storage.getItem('anvilite-' + suffix))
  vi.resetModules()
  await load('synthetic-second')
  expect(maps.persist.getOptions().name).toBe('anvilite-synthetic-second-mind-maps')
  expect(snapshot()).toEqual({ maps: [], selectedMapId: null })
  maps.setState({ maps: [graph('private-second')], selectedMapId: 'private-second' })
  const expected = snapshot()
  const incoming = backup()
  expect(incoming.accountId).toBe('synthetic-second')
  maps.setState({ maps: [], selectedMapId: null })
  expect(data.applyImportPayload(incoming)).toEqual({ success: true })
  await coldReload()
  expect(snapshot()).toEqual(expected)
  expect(suffixes.map(suffix => storage.getItem('anvilite-' + suffix))).toEqual(firstBytes)
})

it('includes maps in manual sync snapshots and the pre-restore safety copy, then restores the chosen snapshot', async () => {
  await load('default')
  maps.setState({ maps: [graph()], selectedMapId: 'map-one' })
  const expected = snapshot()
  const remote = backup()
  remote.data.mindMaps.maps[0].title = 'Synced map title'
  const api = native()
  api.writeSyncFile.mockResolvedValue({ success: true })
  api.readSyncFile.mockResolvedValue({ success: true, exists: true, content: JSON.stringify(remote) })
  const sync = await import('./dataSync')
  expect((await sync.writeSyncSnapshot('synthetic-directory')).success).toBe(true)
  expect(JSON.parse(api.writeSyncFile.mock.calls[0][2]).data.mindMaps).toEqual(expected)
  expect(await sync.restoreFromSync('synthetic-directory')).toEqual({ success: true })
  expect(api.writeSyncFile.mock.calls[1][1]).toMatch(/^backups\/anvilite-before-sync-restore-/)
  expect(JSON.parse(api.writeSyncFile.mock.calls[1][2]).data.mindMaps).toEqual(expected)
  expect(reload).toHaveBeenCalledTimes(1)
  await coldReload()
  expect(snapshot()).toEqual(remote.data.mindMaps)
  expect(tasks.getState().tasks).toEqual(remote.data.tasks.tasks)
})

it('rejects malformed maps from manual sync before saving a safety copy or modifying local data', async () => {
  await load('default')
  maps.setState({ maps: [graph()], selectedMapId: 'map-one' })
  const expected = snapshot()
  const incoming = backup()
  incoming.data.mindMaps.maps[0].root.children[0].id = 'root'
  const api = native()
  api.readSyncFile.mockResolvedValue({ success: true, exists: true, content: JSON.stringify(incoming) })
  const sync = await import('./dataSync')
  expect(await sync.restoreFromSync('synthetic-directory')).toEqual({ success: false, error: 'invalid_mindMaps' })
  expect(api.writeSyncFile).not.toHaveBeenCalled()
  expect(reload).not.toHaveBeenCalled()
  expect(snapshot()).toEqual(expected)
})


it('preserves a converted task source across backup import and cold restart so a lost link can reuse the same task', async () => {
  await load('default')
  const document = graph()
  document.root.children = []
  maps.setState({ maps: [document], selectedMapId: document.id })
  const taskId = maps.getState().convertNodeToTask(document.id, document.root.id)!
  expect(taskId).toBeTypeOf('string')
  const incoming = backup()
  const converted = incoming.data.tasks.tasks.find((task: { id: string }) => task.id === taskId)
  expect(converted.mindMapSource).toEqual({ mapId: document.id, nodeId: document.root.id })
  // A missing reference can be the result of a failed multi-store conversion write.
  delete incoming.data.mindMaps.maps[0].root.taskId
  expect(data.parseImportText(JSON.stringify(incoming)).success).toBe(true)
  expect(data.applyImportPayload(incoming)).toEqual({ success: true })
  await coldReload()
  const taskCount = tasks.getState().tasks.length
  expect(maps.getState().convertNodeToTask(document.id, document.root.id)).toBe(taskId)
  expect(tasks.getState().tasks).toHaveLength(taskCount)
  expect(snapshot().maps[0].root.taskId).toBe(taskId)
  expect(tasks.getState().tasks.find(task => task.id === taskId)?.mindMapSource).toEqual({ mapId: document.id, nodeId: document.root.id })
})

it.each([
  null, [], {}, 'invalid', { mapId: 'map' }, { nodeId: 'node' },
  { mapId: '', nodeId: 'node' }, { mapId: '  ', nodeId: 'node' }, { mapId: 42, nodeId: 'node' },
  { mapId: 'map', nodeId: '' }, { mapId: 'map', nodeId: '  ' }, { mapId: 'map', nodeId: 42 },
  { mapId: 'x'.repeat(129), nodeId: 'node' }, { mapId: 'map', nodeId: 'x'.repeat(129) },
  { mapId: 'map', nodeId: 'node', taskId: 'unsupported-extra-field' },
])('rejects malformed optional task conversion sources before backup overwrite: %j', async source => {
  await load('default')
  const incoming = backup()
  incoming.data.tasks.tasks[0].mindMapSource = source
  const writes = vi.spyOn(storage, 'setItem')
  expect(data.parseImportText(JSON.stringify(incoming))).toEqual({ success: false, error: 'invalid_tasks' })
  expect(data.applyImportPayload(incoming)).toEqual({ success: false, error: 'invalid_tasks' })
  expect(writes).not.toHaveBeenCalled()
})


function sourcedSubTree() {
  return [{ id: 'sub-first', title: 'First branch', completed: true, sortOrder: 0,
    createdAt: '2026-10-23T10:00:00.000Z', mindMapSource: { mapId: 'map-one', nodeId: 'branch' }, subTasks: [
      { id: 'sub-second', title: 'Second branch', completed: false, sortOrder: 0,
        createdAt: '2026-10-23T10:00:00.000Z', mindMapSource: { mapId: 'map-one', nodeId: 'leaf' }, subTasks: [
          { id: 'sub-third', title: 'Third branch', completed: true, sortOrder: 0,
            createdAt: '2026-10-23T10:00:00.000Z', mindMapSource: { mapId: 'map-one', nodeId: 'tip' }, subTasks: [] },
        ] },
    ] }]
}

it('round trips task and all three subtask-level sources with node references through export, import and cold reload', async () => {
  await load('default')
  const task = tasks.getState().tasks[0]
  const children = sourcedSubTree()
  tasks.getState().updateTask(task.id, { subTasks: children,
    mindMapSource: { mapId: 'map-one', nodeId: 'root' } })
  const document = graph('map-one', task.id)
  document.root = { id: 'root', topic: task.title, taskId: task.id, children: [
    { id: 'branch', topic: 'First branch', taskId: task.id, subTaskId: 'sub-first', expanded: false, children: [
      { id: 'leaf', topic: 'Second branch', taskId: task.id, subTaskId: 'sub-second', children: [
        { id: 'tip', topic: 'Third branch', taskId: task.id, subTaskId: 'sub-third' },
      ] },
    ] },
  ] }
  maps.setState({ maps: [document], selectedMapId: document.id })
  const expected = snapshot()
  const incoming = backup()
  expect(data.parseImportText(JSON.stringify(incoming)).success).toBe(true)
  tasks.getState().updateTask(task.id, { subTasks: [] })
  maps.setState({ maps: [], selectedMapId: null })
  expect(data.applyImportPayload(incoming)).toEqual({ success: true })
  await coldReload()
  expect(snapshot()).toEqual(expected)
  const restored = tasks.getState().tasks.find(current => current.id === task.id)!
  expect(restored.subTasks).toEqual(children)
  expect(restored.mindMapSource).toEqual({ mapId: document.id, nodeId: document.root.id })
  expect(backup().data.tasks.tasks).toEqual(incoming.data.tasks.tasks)
  expect(backup().data.mindMaps).toEqual(incoming.data.mindMaps)
})

it('accepts durable sources and stale node references after their original map, node or task has been removed', async () => {
  await load('default')
  const incoming = backup()
  incoming.data.tasks.tasks[0].subTasks = sourcedSubTree()
  incoming.data.tasks.tasks[0].mindMapSource = { mapId: 'removed-map', nodeId: 'removed-node' }
  incoming.data.mindMaps = { maps: [{ ...graph(), root: {
    id: 'root', topic: 'Task no longer exists', taskId: 'removed-task', subTaskId: 'removed-subtask',
  } }], selectedMapId: 'map-one' }
  expect(data.parseImportText(JSON.stringify(incoming)).success).toBe(true)
  expect(data.applyImportPayload(incoming)).toEqual({ success: true })
  await coldReload()
  expect(backup().data.tasks.tasks).toEqual(incoming.data.tasks.tasks)
  expect(snapshot()).toEqual(incoming.data.mindMaps)
})

it.each([0, 1, 2])('rejects invalid mind-map sources at subtask depth %i before any backup overwrite', async depth => {
  await load('default')
  const invalidSources = [null, {}, { mapId: ' ', nodeId: 'node' }, { mapId: 'map', nodeId: 42 },
    { mapId: 'map', nodeId: 'x'.repeat(129) }, { mapId: 'map', nodeId: 'node', extra: true }]
  for (const source of invalidSources) {
    const incoming = backup()
    incoming.data.tasks.tasks[0].subTasks = sourcedSubTree()
    let sub = incoming.data.tasks.tasks[0].subTasks[0]
    for (let index = 0; index < depth; index++) sub = sub.subTasks[0]
    sub.mindMapSource = source
    const before = suffixes.map(suffix => storage.getItem('anvilite-' + suffix))
    const writes = vi.spyOn(storage, 'setItem')
    expect(data.parseImportText(JSON.stringify(incoming))).toEqual({ success: false, error: 'invalid_tasks' })
    expect(data.applyImportPayload(incoming)).toEqual({ success: false, error: 'invalid_tasks' })
    expect(writes).not.toHaveBeenCalled()
    expect(suffixes.map(suffix => storage.getItem('anvilite-' + suffix))).toEqual(before)
    writes.mockRestore()
  }
})


it('restores real linked-branch sources and recovers lost subtask references without duplicating converted children', async () => {
  await load('default')
  const task = tasks.getState().addTask({ title: 'Existing project', category: 'work' })
  const document = graph('linked-project', task.id)
  document.root = { id: 'project-root', topic: 'Original idea', children: [
    { id: 'step-one', topic: 'Collect information', expanded: false, children: [
      { id: 'step-two', topic: 'Request feedback' },
    ] },
    { id: 'step-three', topic: 'Write summary' },
  ] }
  maps.setState({ maps: [document], selectedMapId: document.id })
  expect(maps.getState().linkTask(document.id, document.root.id, task.id)).toBe(true)
  const savedTask = structuredClone(tasks.getState().tasks.find(current => current.id === task.id)!)
  const savedMap = snapshot()
  expect(savedTask.subTasks).toHaveLength(2)
  expect(savedTask.subTasks[0].mindMapSource).toEqual({ mapId: document.id, nodeId: 'step-one' })
  expect(savedTask.subTasks[0].subTasks[0].mindMapSource).toEqual({ mapId: document.id, nodeId: 'step-two' })
  const incoming = backup()
  // Simulate a map write lost after the durable task write succeeded.
  const forgetChildren = (node: MindMapNode) => {
    for (const child of node.children ?? []) {
      delete child.taskId
      delete child.subTaskId
      forgetChildren(child)
    }
  }
  forgetChildren(incoming.data.mindMaps.maps[0].root)
  expect(data.applyImportPayload(incoming)).toEqual({ success: true })
  await coldReload()
  const count = tasks.getState().tasks.length
  expect(maps.getState().linkTask(document.id, document.root.id, task.id)).toBe(true)
  expect(maps.getState().linkTask(document.id, document.root.id, task.id)).toBe(true)
  expect(tasks.getState().tasks).toHaveLength(count)
  expect(tasks.getState().tasks.find(current => current.id === task.id)?.subTasks).toEqual(savedTask.subTasks)
  expect(snapshot().maps[0].root).toEqual(savedMap.maps[0].root)
})
