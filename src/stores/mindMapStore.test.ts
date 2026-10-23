import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useMindMapStore } from './mindMapStore'
import { useTaskStore } from './taskStore'
import { useGrowthEventStore } from './growthEventStore'
import { cloneMindMapNode, findMindMapNode, isValidMindMapDocument, isValidMindMapNode,
  isValidMindMapState, MAX_MIND_MAP_DEPTH, MAX_MIND_MAP_NODES } from '@/types/mindMap'
import type { MindMapDocument, MindMapNode } from '@/types/mindMap'

const maps = useMindMapStore
const tasks = useTaskStore
const storeKey = 'anvilite-mind-maps'
function document(id?: string) {
  return maps.getState().maps.find(map => map.id === (id ?? maps.getState().selectedMapId))!
}
function branchMap() {
  const map = maps.getState().createMap('Project')!
  const root = { ...map.root, children: [
    { id: 'idea', topic: 'Write proposal', expanded: true, direction: 1 as const,
      children: [{ id: 'child', topic: 'Research' }] },
    { id: 'other', topic: 'Follow up', direction: 0 as const },
  ] }
  expect(maps.getState().updateMapTree(map.id, root, map.revision)).toBe(true)
  return document(map.id)
}
function persisted() { return JSON.parse(localStorage.getItem(storeKey)!).state }
function failOnce(keyToFail: string, effect?: () => void) {
  const realSet = localStorage.setItem.bind(localStorage)
  let active = true
  vi.spyOn(localStorage, 'setItem').mockImplementation((key, value) => {
    if (key === keyToFail && active) { active = false; effect?.(); throw new Error('Synthetic quota') }
    realSet(key, value)
  })
}

beforeEach(() => {
  vi.restoreAllMocks()
  localStorage.clear()
  maps.setState({ maps: [], selectedMapId: null })
  tasks.setState({ tasks: [], lastCategory: 'other', completedViewMode: 'month', customTaskGroups: [] })
  useGrowthEventStore.setState({ events: [] })
})
afterEach(() => { vi.restoreAllMocks() })

it('creates multiple independent maps, selects, renames the root and deletes only the selected document', () => {
  const first = maps.getState().createMap('  First plan  ')!
  const second = maps.getState().createMap('Second plan')!
  expect(first.title).toBe('First plan')
  expect(first.root.topic).toBe('First plan')
  expect(first.root.id).not.toBe(second.root.id)
  expect(maps.getState().selectedMapId).toBe(second.id)
  expect(maps.getState().renameMap(first.id, '  Revised plan ')).toBe(true)
  expect(document(first.id)).toMatchObject({ title: 'Revised plan', root: { topic: 'Revised plan' }, revision: 1 })
  expect(document(second.id)).toBe(second)
  expect(maps.getState().selectMap(first.id)).toBe(true)
  expect(maps.getState().deleteMap(first.id)).toBe(true)
  expect(maps.getState().selectedMapId).toBe(second.id)
  expect(maps.getState().deleteMap(second.id)).toBe(true)
  expect(maps.getState().selectedMapId).toBeNull()
  expect(maps.getState().maps).toEqual([])
})

it('rejects empty titles, unknown documents, invalid selection and stale tree revisions without writing', () => {
  const map = branchMap()
  const before = maps.getState().maps
  const write = vi.spyOn(localStorage, 'setItem')
  expect(maps.getState().createMap('  ')).toBeNull()
  expect(maps.getState().renameMap(map.id, '')).toBe(false)
  expect(maps.getState().renameMap('missing', 'x')).toBe(false)
  expect(maps.getState().deleteMap('missing')).toBe(false)
  expect(maps.getState().selectMap('missing')).toBe(false)
  expect(maps.getState().updateMapTree(map.id, { ...map.root, topic: 'Stale' }, map.revision - 1)).toBe(false)
  expect(maps.getState().updateMapTree(map.id, null as unknown as MindMapNode, map.revision)).toBe(false)
  expect(maps.getState().updateMapTree(map.id, { id: 'replacement', topic: 'x' }, map.revision)).toBe(false)
  expect(maps.getState().maps).toBe(before)
  expect(write).not.toHaveBeenCalled()
})

it('saves branch reparenting, order, direction and collapse while stripping library view objects', () => {
  const map = branchMap()
  const next = cloneMindMapNode(map.root)
  const first = next.children![0]
  const second = next.children![1]
  first.children = []
  first.expanded = false
  second.children = [{ id: 'child', topic: 'Research', direction: 0 }]
  next.children = [second, first]
  next.topic = 'Renamed through canvas'
  Object.assign(next, { parent: next, style: { color: '#ff0000' }, tags: ['Derived status'] })
  expect(maps.getState().updateMapTree(map.id, next, map.revision)).toBe(true)
  expect(document().title).toBe('Renamed through canvas')
  expect(document().root.children!.map(node => node.id)).toEqual(['other', 'idea'])
  expect(findMindMapNode(document().root, 'idea')).toMatchObject({ expanded: false, children: [] })
  expect(findMindMapNode(document().root, 'other')!.children).toEqual([{ id: 'child', topic: 'Research', direction: 0 }])
  expect(document().root).not.toHaveProperty('parent')
  expect(document().root).not.toHaveProperty('style')
  expect(persisted().maps[0].root).toEqual(document().root)
  next.topic = 'Mutated after save'
  next.children![0].topic = 'Aliased mutation'
  expect(document().root.topic).toBe('Renamed through canvas')
  expect(document().root.children![0].topic).toBe('Follow up')
})

it('links the same existing task in several maps and resolves every task status from the task store', () => {
  const first = branchMap()
  const second = maps.getState().createMap('Second')!
  const task = tasks.getState().addTask({ title: 'Existing task', category: 'work' })
  expect(maps.getState().linkTask(first.id, 'idea', task.id)).toBe(true)
  expect(maps.getState().linkTask(second.id, second.root.id, task.id)).toBe(true)
  const afterLink = structuredClone(maps.getState().maps)
  const state = () => tasks.getState().tasks.find(item => item.id === task.id)!
  tasks.getState().waitTask(task.id)
  expect(state().status).toBe('waiting')
  tasks.getState().completeTask(task.id)
  expect(state().status).toBe('done')
  tasks.getState().undoComplete(task.id)
  expect(state().status).toBe('waiting')
  tasks.getState().resumeWaitingTask(task.id)
  expect(state().status).toBe('todo')
  expect(maps.getState().maps).toEqual(afterLink)
  expect(tasks.getState().tasks).toHaveLength(1)
  expect(document(first.id).root.children![0].topic).toBe('Write proposal')
})

it('deleting a node, unlinking and deleting its entire map never deletes or changes an actual task', () => {
  const map = branchMap()
  const task = tasks.getState().addTask({ title: 'Independent task', category: 'work' })
  maps.getState().linkTask(map.id, 'idea', task.id)
  const initial = tasks.getState().tasks
  const latest = document()
  expect(maps.getState().updateMapTree(map.id, { ...latest.root, children: [latest.root.children![1]] }, latest.revision)).toBe(true)
  expect(findMindMapNode(document().root, 'idea')).toBeUndefined()
  maps.getState().linkTask(map.id, 'other', task.id)
  maps.getState().unlinkTask(map.id, 'other')
  maps.getState().linkTask(map.id, 'other', task.id)
  maps.getState().deleteMap(map.id)
  expect(tasks.getState().tasks).toBe(initial)
  expect(initial[0].deletedAt).toBeNull()
})

it('keeps deleted-task references for a missing-task indicator and never recreates them', () => {
  const map = branchMap()
  const taskId = maps.getState().convertNodeToTask(map.id, 'idea')!
  tasks.getState().deleteTask(taskId)
  expect(findMindMapNode(document().root, 'idea')!.taskId).toBe(taskId)
  expect(maps.getState().convertNodeToTask(map.id, 'idea')).toBeNull()
  expect(maps.getState().linkTask(map.id, 'other', taskId)).toBe(false)
  tasks.getState().permanentlyDeleteTask(taskId)
  expect(maps.getState().convertNodeToTask(map.id, 'idea')).toBeNull()
  expect(tasks.getState().tasks).toEqual([])
  expect(maps.getState().unlinkTask(map.id, 'idea')).toBe(true)
})

it('converts a node once and repeated conversions return its linked task even after a rename', () => {
  const map = branchMap()
  tasks.setState({ lastCategory: 'work' })
  const first = maps.getState().convertNodeToTask(map.id, 'idea')
  expect(first).toEqual(expect.any(String))
  expect(maps.getState().convertNodeToTask(map.id, 'idea')).toBe(first)
  const task = tasks.getState().tasks[0]
  expect(task).toMatchObject({ id: first, title: 'Write proposal', category: 'work', status: 'todo', xpReward: 0, dueDate: null })
  tasks.getState().updateTask(task.id, { title: 'Renamed actual task', priority: 'urgent' })
  expect(maps.getState().convertNodeToTask(map.id, 'idea')).toBe(first)
  expect(tasks.getState().tasks).toHaveLength(1)
  expect(document().root.children![0].topic).toBe('Write proposal')
  expect(useGrowthEventStore.getState().events).toEqual([])
})

it('blocks reentrant conversion during task persistence so rapid execution cannot create a duplicate', () => {
  const map = branchMap()
  let nested: string | null | undefined
  const unsubscribe = tasks.subscribe(state => {
    if (state.tasks.length === 1 && nested === undefined) nested = maps.getState().convertNodeToTask(map.id, 'idea')
  })
  const taskId = maps.getState().convertNodeToTask(map.id, 'idea')
  unsubscribe()
  expect(nested).toBeNull()
  expect(taskId).toEqual(expect.any(String))
  expect(tasks.getState().tasks.map(task => task.id)).toEqual([taskId])
})

it('preserves current links across tree history and strips attempts to inject links into a new node', () => {
  const map = branchMap()
  const task = tasks.getState().addTask({ title: 'Task' })
  const oldTree = cloneMindMapNode(map.root)
  maps.getState().linkTask(map.id, 'idea', task.id)
  let latest = document()
  expect(maps.getState().updateMapTree(map.id, oldTree, latest.revision)).toBe(true)
  expect(findMindMapNode(document().root, 'idea')!.taskId).toBe(task.id)
  const linkedTree = cloneMindMapNode(document().root)
  maps.getState().unlinkTask(map.id, 'idea')
  latest = document()
  linkedTree.children!.push({ id: 'injected', topic: 'Injected task', taskId: task.id })
  expect(maps.getState().updateMapTree(map.id, linkedTree, latest.revision)).toBe(true)
  expect(findMindMapNode(document().root, 'idea')!.taskId).toBeUndefined()
  expect(findMindMapNode(document().root, 'injected')!.taskId).toBeUndefined()
  expect(tasks.getState().tasks).toHaveLength(1)
})

it.each(['anvilite-tasks', storeKey])('compensates a failed conversion write to %s and permits a clean retry', failedKey => {
  const map = branchMap()
  const existing = tasks.getState().addTask({ title: 'Must remain', category: 'study' })
  const previousMap = structuredClone(document())
  const previousCategory = tasks.getState().lastCategory
  failOnce(failedKey)
  expect(() => maps.getState().convertNodeToTask(map.id, 'idea')).toThrow('Synthetic quota')
  expect(document()).toEqual(previousMap)
  expect(tasks.getState().tasks).toEqual([existing])
  expect(tasks.getState().lastCategory).toBe(previousCategory)
  expect(persisted().maps[0]).toEqual(previousMap)
  expect(JSON.parse(localStorage.getItem('anvilite-tasks')!).state.tasks).toEqual([existing])
  const retried = maps.getState().convertNodeToTask(map.id, 'idea')
  expect(retried).toEqual(expect.any(String))
  expect(tasks.getState().tasks).toHaveLength(2)
  expect(findMindMapNode(document().root, 'idea')!.taskId).toBe(retried)
})

it('preserves unrelated tasks and map edits made while a conversion write fails', () => {
  const first = branchMap()
  const second = maps.getState().createMap('Second plan')!
  const existing = tasks.getState().addTask({ title: 'Existing', category: 'life' })
  failOnce(storeKey, () => {
    tasks.getState().updateTask(existing.id, { title: 'Later saved title' })
    tasks.getState().addTask({ title: 'Unrelated task', category: 'study' })
    maps.getState().renameMap(second.id, 'Later saved plan')
  })
  expect(() => maps.getState().convertNodeToTask(first.id, 'idea')).toThrow('Synthetic quota')
  expect(tasks.getState().tasks.map(task => task.title).sort()).toEqual(['Later saved title', 'Unrelated task'])
  expect(tasks.getState().lastCategory).toBe('study')
  expect(document(second.id).title).toBe('Later saved plan')
  expect(findMindMapNode(document(first.id).root, 'idea')!.taskId).toBeUndefined()
  expect(persisted().maps).toEqual(maps.getState().maps)
})

it('does not delete a new task deliberately associated with another map during a failed conversion', () => {
  const first = branchMap()
  const second = maps.getState().createMap('Other map')!
  let taskId = ''
  failOnce(storeKey, () => {
    taskId = tasks.getState().tasks[0].id
    expect(maps.getState().linkTask(second.id, second.root.id, taskId)).toBe(true)
  })
  expect(() => maps.getState().convertNodeToTask(first.id, 'idea')).toThrow('Synthetic quota')
  expect(findMindMapNode(document(first.id).root, 'idea')!.taskId).toBeUndefined()
  expect(document(second.id).root.taskId).toBe(taskId)
  expect(tasks.getState().tasks.map(task => task.id)).toEqual([taskId])
  expect(persisted().maps).toEqual(maps.getState().maps)
})

it('rolls back its new task if the map changes before the association can be committed', () => {
  const map = branchMap()
  const unsubscribe = tasks.subscribe(state => {
    if (state.tasks.length === 1) maps.getState().renameMap(map.id, 'Changed by another operation')
  })
  expect(maps.getState().convertNodeToTask(map.id, 'idea')).toBeNull()
  unsubscribe()
  expect(document().title).toBe('Changed by another operation')
  expect(tasks.getState().tasks).toEqual([])
  expect(findMindMapNode(document().root, 'idea')!.taskId).toBeUndefined()
})

it('restores map and task memory when persistent storage stays unavailable throughout compensation', () => {
  const map = branchMap()
  const initialMap = structuredClone(map)
  const initialPersisted = localStorage.getItem(storeKey)
  vi.spyOn(localStorage, 'setItem').mockImplementation(() => { throw new Error('Storage stays full') })
  expect(() => maps.getState().convertNodeToTask(map.id, 'idea')).toThrow('Storage stays full')
  expect(document()).toEqual(initialMap)
  expect(tasks.getState().tasks).toEqual([])
  expect(localStorage.getItem(storeKey)).toBe(initialPersisted)
})

it.each(['create', 'rename', 'delete', 'select', 'tree', 'link', 'unlink'] as const)(
  'compensates failed document operation: %s', operation => {
    const map = branchMap()
    const second = maps.getState().createMap('Second')!
    const task = tasks.getState().addTask({ title: 'Task' })
    maps.getState().linkTask(map.id, 'idea', task.id)
    const linkedTasks = structuredClone(tasks.getState().tasks)
    const previous = structuredClone({ maps: maps.getState().maps, selectedMapId: maps.getState().selectedMapId })
    failOnce(storeKey)
    const action = {
      create: () => maps.getState().createMap('New'),
      rename: () => maps.getState().renameMap(map.id, 'Renamed'),
      delete: () => maps.getState().deleteMap(map.id),
      select: () => maps.getState().selectMap(map.id),
      tree: () => maps.getState().updateMapTree(map.id, { ...document(map.id).root, expanded: false }, document(map.id).revision),
      link: () => maps.getState().linkTask(second.id, second.root.id, task.id),
      unlink: () => maps.getState().unlinkTask(map.id, 'idea'),
    }[operation]
    expect(action).toThrow('Synthetic quota')
    expect({ maps: maps.getState().maps, selectedMapId: maps.getState().selectedMapId }).toEqual(previous)
    expect(persisted()).toEqual(previous)
    expect(tasks.getState().tasks).toEqual(linkedTasks)
  })

it('rehydrates all maps and selection without library-only data or duplicated tasks', async () => {
  const first = branchMap()
  const taskId = maps.getState().convertNodeToTask(first.id, 'idea')
  const second = maps.getState().createMap('Second')!
  maps.getState().linkTask(second.id, second.root.id, taskId!)
  maps.getState().selectMap(first.id)
  const snapshot = structuredClone(persisted())
  vi.resetModules()
  const fresh = (await import('./mindMapStore')).useMindMapStore
  expect(fresh.getState().maps).toEqual(snapshot.maps)
  expect(fresh.getState().selectedMapId).toBe(first.id)
  expect(isValidMindMapState(snapshot)).toBe(true)
  expect(fresh.persist.getOptions().version).toBe(1)
  expect((await import('./taskStore')).useTaskStore.getState().tasks).toHaveLength(1)
})

it('binds maps and tasks to the same account prefix and rejects actions after an account change', async () => {
  const defaultMap = maps.getState().createMap('Default account')!
  const defaultData = localStorage.getItem(storeKey)
  localStorage.setItem('anvilite-current-account', 'second-account')
  vi.resetModules()
  const fresh = (await import('./mindMapStore')).useMindMapStore
  expect(fresh.getState().maps).toEqual([])
  const second = fresh.getState().createMap('Second account')!
  const id = fresh.getState().convertNodeToTask(second.id, second.root.id)
  expect(id).toEqual(expect.any(String))
  expect(localStorage.getItem(storeKey)).toBe(defaultData)
  expect(JSON.parse(localStorage.getItem('anvilite-second-account-mind-maps')!).state.maps[0].id).toBe(second.id)
  expect(JSON.parse(localStorage.getItem('anvilite-second-account-tasks')!).state.tasks[0].id).toBe(id)
  localStorage.setItem('anvilite-current-account', 'default')
  expect(() => fresh.getState().createMap('Wrong account write')).toThrow('account_changed')
  expect(() => fresh.getState().selectMap(defaultMap.id)).toThrow('account_changed')
  localStorage.setItem('anvilite-current-account', 'second-account')
  expect(() => fresh.getState().renameMap(second.id, 'Still stale')).toThrow('account_changed')
  localStorage.removeItem('anvilite-current-account')
})

describe('document validation', () => {
  it.each([
    null, {}, { id: 'r', topic: '' }, { id: '', topic: 'Root' }, { id: 'r', topic: 'Root', expanded: 1 },
    { id: 'r', topic: 'Root', taskId: null }, { id: 'r', topic: 'Root', direction: 2 },
    { id: 'r', topic: 'Root', children: 'bad' },
    { id: 'r', topic: 'Root', children: [{ id: 'r', topic: 'Duplicate' }] },
  ])('rejects malformed node data: %j', value => { expect(isValidMindMapNode(value)).toBe(false) })
  it('rejects cyclic, oversized and excessively nested branches before recursion becomes unsafe', () => {
    const cyclic: MindMapNode = { id: 'r', topic: 'Cycle' }
    cyclic.children = [cyclic]
    expect(isValidMindMapNode(cyclic)).toBe(false)
    const deep: MindMapNode = { id: 'r', topic: 'Root' }
    let current = deep
    for (let i = 0; i < MAX_MIND_MAP_DEPTH + 1; i++) {
      current.children = [{ id: 'n' + i, topic: 'Child' }]
      current = current.children[0]
    }
    expect(isValidMindMapNode(deep)).toBe(false)
    expect(isValidMindMapNode({ id: 'root', topic: 'Root', children: Array.from({ length: MAX_MIND_MAP_NODES }, (_, i) => ({ id: 'n' + i, topic: 'Child' })) })).toBe(false)
  })
  it('rejects bad document metadata, duplicate map IDs and dangling selected-map IDs', () => {
    const map = maps.getState().createMap('Valid')!
    expect(isValidMindMapDocument(map)).toBe(true)
    for (const patch of [{ revision: -1 }, { revision: 1.5 }, { revision: Number.POSITIVE_INFINITY },
      { createdAt: '2026-02-30' }, { updatedAt: 'invalid' }, { title: ' ' }]) {
      expect(isValidMindMapDocument({ ...map, ...patch })).toBe(false)
    }
    expect(isValidMindMapState({ maps: [map, map], selectedMapId: map.id })).toBe(false)
    expect(isValidMindMapState({ maps: [map], selectedMapId: 'missing' })).toBe(false)
    expect(isValidMindMapState({ maps: [map], selectedMapId: null })).toBe(true)
  })
  it('does not hydrate a malformed persisted tree or turn its references into tasks', async () => {
    const invalid: MindMapDocument = { id: 'bad', title: 'Bad', root: { id: 'r', topic: 'Root', children: [{ id: 'r', topic: 'Duplicate' }] },
      createdAt: '2026-10-23T10:00:00.000Z', updatedAt: '2026-10-23T10:00:00.000Z', revision: 0 }
    localStorage.setItem(storeKey, JSON.stringify({ state: { maps: [invalid], selectedMapId: 'bad' }, version: 1 }))
    vi.resetModules()
    const fresh = (await import('./mindMapStore')).useMindMapStore
    expect(fresh.getState().maps).toEqual([])
    expect(fresh.getState().selectedMapId).toBeNull()
    expect((await import('./taskStore')).useTaskStore.getState().tasks).toEqual([])
  })
})

it('recovers one durable task after its map write and all compensating writes fail, including a cold retry', async () => {
  const map = branchMap()
  const realSet = localStorage.setItem.bind(localStorage)
  let failAllWrites = false
  vi.spyOn(localStorage, 'setItem').mockImplementation((key, value) => {
    if (key === storeKey) failAllWrites = true
    if (failAllWrites) throw new Error('Device remains full')
    realSet(key, value)
  })
  expect(() => maps.getState().convertNodeToTask(map.id, 'idea')).toThrow('Device remains full')
  expect(tasks.getState().tasks).toEqual([])
  expect(findMindMapNode(document(map.id).root, 'idea')!.taskId).toBeUndefined()
  const durableTasks = JSON.parse(localStorage.getItem('anvilite-tasks')!).state.tasks
  expect(durableTasks).toHaveLength(1)
  expect(durableTasks[0].mindMapSource).toEqual({ mapId: map.id, nodeId: 'idea' })
  expect(persisted().maps[0].root.children[0].taskId).toBeUndefined()
  vi.restoreAllMocks()
  vi.resetModules()
  const fresh = (await import('./mindMapStore')).useMindMapStore
  const freshTasks = (await import('./taskStore')).useTaskStore
  expect(fresh.getState().convertNodeToTask(map.id, 'idea')).toBe(durableTasks[0].id)
  expect(freshTasks.getState().tasks).toEqual(durableTasks)
  expect(findMindMapNode(fresh.getState().maps[0].root, 'idea')!.taskId).toBe(durableTasks[0].id)
  expect(fresh.getState().convertNodeToTask(map.id, 'idea')).toBe(durableTasks[0].id)
  expect(freshTasks.getState().tasks).toHaveLength(1)
})

it('reuses a node-created task after unlinking and prevents recreating its soft-deleted source', () => {
  const map = branchMap()
  const id = maps.getState().convertNodeToTask(map.id, 'idea')!
  maps.getState().unlinkTask(map.id, 'idea')
  expect(maps.getState().convertNodeToTask(map.id, 'idea')).toBe(id)
  expect(tasks.getState().tasks).toHaveLength(1)
  maps.getState().unlinkTask(map.id, 'idea')
  tasks.getState().deleteTask(id)
  expect(maps.getState().convertNodeToTask(map.id, 'idea')).toBeNull()
  expect(tasks.getState().tasks).toHaveLength(1)
  expect(tasks.getState().tasks[0].deletedAt).not.toBeNull()
})

it('refuses to overflow a valid maximum revision and keeps the document readable on reload', async () => {
  const map = branchMap()
  const task = tasks.getState().addTask({ title: 'Existing' })
  maps.setState({ maps: [{ ...map, revision: Number.MAX_SAFE_INTEGER }] })
  const snapshot = localStorage.getItem(storeKey)
  const write = vi.spyOn(localStorage, 'setItem')
  expect(maps.getState().renameMap(map.id, 'Overflow rename')).toBe(false)
  expect(maps.getState().updateMapTree(map.id, { ...map.root, expanded: false }, Number.MAX_SAFE_INTEGER)).toBe(false)
  expect(maps.getState().linkTask(map.id, 'idea', task.id)).toBe(false)
  expect(maps.getState().convertNodeToTask(map.id, 'idea')).toBeNull()
  expect(write).not.toHaveBeenCalled()
  expect(localStorage.getItem(storeKey)).toBe(snapshot)
  vi.resetModules()
  const fresh = (await import('./mindMapStore')).useMindMapStore
  expect(fresh.getState().maps).toEqual([{ ...map, revision: Number.MAX_SAFE_INTEGER }])
  expect(fresh.getState().selectedMapId).toBe(map.id)
})
