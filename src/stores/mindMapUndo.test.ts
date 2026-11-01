import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { useMindMapStore as maps } from './mindMapStore'
import { useTaskStore as tasks } from './taskStore'
import { cloneMindMapNode, findMindMapNode, type MindMapNode } from '@/types/mindMap'
import { MindMapTaskTitleConflictError } from '@/utils/mindMapTaskLinks'

const doc = (id = maps.getState().selectedMapId!) => maps.getState().maps.find(map => map.id === id)!
const task = (id: string) => tasks.getState().tasks.find(task => task.id === id)!
function setup() {
  const map = maps.getState().createMap('Plan')!
  maps.getState().updateMapTree(map.id, { ...map.root, children: [
    { id: 'a', topic: 'First', direction: 1, children: [{ id: 'child', topic: 'Child' }] },
    { id: 'b', topic: 'Second', direction: 0 },
  ] }, 0, [], false)
  return doc()
}
function change(edit: (root: MindMapNode) => void) {
  const current = doc(), root = cloneMindMapNode(current.root)
  edit(root)
  expect(maps.getState().updateMapTree(current.id, root, current.revision)).toBe(true)
}
function rename(id: string, title: string) {
  const current = doc(), root = cloneMindMapNode(current.root), node = findMindMapNode(root, id)!
  const before = node.taskId ? task(node.taskId).title : node.topic
  node.topic = title
  expect(maps.getState().updateMapTree(current.id, root, current.revision, [{ nodeId: id, previousTitle: before, title }])).toBe(true)
}
beforeEach(() => { localStorage.clear(); maps.setState({ maps: [], selectedMapId: null }); tasks.setState({ tasks: [], customTaskGroups: [] }) })
afterEach(() => vi.restoreAllMocks())

it('undoes repeated add, drag, fold, title and delete operations with monotonically increasing revisions', () => {
  const original = setup()
  const states = [cloneMindMapNode(doc().root)]
  change(root => { root.children!.push({ id: 'new', topic: 'New' }) }); states.push(cloneMindMapNode(doc().root))
  change(root => { root.children![0].direction = 0; root.children!.reverse() }); states.push(cloneMindMapNode(doc().root))
  change(root => { root.children![2].expanded = false }); states.push(cloneMindMapNode(doc().root))
  rename('a', 'Edited'); states.push(cloneMindMapNode(doc().root))
  change(root => { root.children = root.children!.filter(node => node.id !== 'a') })
  let revision = doc().revision
  for (const expected of states.reverse()) {
    expect(maps.getState().undoMap(original.id)).toBe(true)
    expect(doc().root).toEqual(expected)
    expect(doc().revision).toBe(++revision)
  }
  expect(maps.getState().undoMap(original.id)).toBe(false)
  expect(JSON.parse(localStorage.getItem('anvilite-mind-maps')!).state.maps[0].root).toEqual(original.root)
})

it('restores deleted linked nodes and their references without deleting or duplicating actual tasks', () => {
  const original = setup(), id = maps.getState().convertNodeToTask(original.id, 'a')!
  const linkedRoot = cloneMindMapNode(doc().root), business = structuredClone(task(id))
  change(root => { root.children = root.children!.filter(node => node.id !== 'a') })
  expect(maps.getState().undoMap(original.id)).toBe(true)
  expect(doc().root).toEqual(linkedRoot); expect(task(id)).toEqual(business)
  expect(maps.getState().undoMap(original.id)).toBe(true)
  expect(findMindMapNode(doc().root, 'a')?.taskId).toBeUndefined()
  expect(task(id)).toEqual(business)
  expect(maps.getState().convertNodeToTask(original.id, 'a')).toBe(id)
  expect(tasks.getState().tasks).toHaveLength(1)
})

it('undoes a linked title while preserving later completion, time, priority and newly added subtasks', () => {
  const map = setup(), id = maps.getState().convertNodeToTask(map.id, 'a')!
  rename('a', 'New task title')
  tasks.getState().completeTask(id)
  tasks.getState().updateTask(id, { actualMinutes: 90, priority: 'high' })
  tasks.getState().addSubTask(id, 'Later child')
  const current = structuredClone(task(id))
  expect(maps.getState().undoMap(map.id)).toBe(true)
  expect(task(id)).toEqual({ ...current, title: 'First', updatedAt: task(id).updatedAt })
})

it('undoes a linked subtask title and preserves its subsequent checkbox change', () => {
  const map = setup(), id = maps.getState().convertNodeToTask(map.id, 'a')!
  const current = doc(), root = cloneMindMapNode(current.root), node = findMindMapNode(root, 'child')!
  node.topic = 'Renamed child'
  maps.getState().updateMapTree(map.id, root, current.revision, [{ nodeId: node.id, previousTitle: 'Child', title: node.topic }])
  tasks.getState().toggleSubTask(id, task(id).subTasks[0].id)
  expect(maps.getState().undoMap(map.id)).toBe(true)
  expect(task(id).subTasks[0]).toMatchObject({ title: 'Child', completed: true })
})

it('rejects undo when a linked title was later changed elsewhere without changing any records', () => {
  const map = setup(), id = maps.getState().convertNodeToTask(map.id, 'a')!
  rename('a', 'Map edit'); tasks.getState().updateTask(id, { title: 'External edit' })
  const current = structuredClone({ map: doc(), task: task(id) })
  expect(() => maps.getState().undoMap(map.id)).toThrow(MindMapTaskTitleConflictError)
  expect({ map: doc(), task: task(id) }).toEqual(current)
})

it('retains generated subtasks when undoing a newly added linked branch', () => {
  const map = setup(), id = maps.getState().convertNodeToTask(map.id, 'a')!
  change(root => { findMindMapNode(root, 'a')!.children!.push({ id: 'later', topic: 'New actual subtask' }) })
  const business = structuredClone(task(id))
  expect(maps.getState().undoMap(map.id)).toBe(true)
  expect(findMindMapNode(doc().root, 'later')).toBeUndefined()
  expect(task(id)).toEqual(business)
})

it.each(['anvilite-mind-maps', 'anvilite-tasks'])('rolls back a failed undo write to %s and retains the entry for retry', key => {
  const map = setup(), id = maps.getState().convertNodeToTask(map.id, 'a')!
  rename('a', 'Changed title')
  const before = structuredClone({ map: doc(), task: task(id) })
  const write = localStorage.setItem.bind(localStorage); let fail = true
  vi.spyOn(localStorage, 'setItem').mockImplementation((name, value) => {
    if (name === key && fail) { fail = false; throw Error('Synthetic full disk') }
    write(name, value)
  })
  expect(() => maps.getState().undoMap(map.id)).toThrow('Synthetic full disk')
  expect({ map: doc(), task: task(id) }).toEqual(before)
  expect(maps.getState().undoMap(map.id)).toBe(true)
  expect(task(id).title).toBe('First')
})

it('keeps histories independent across map switches and discards history after external state replacement', () => {
  const a = setup(); rename('a', 'Map A')
  const b = setup(); rename('b', 'Map B')
  maps.getState().selectMap(a.id); expect(maps.getState().undoMap(a.id)).toBe(true)
  expect(findMindMapNode(doc(b.id).root, 'b')?.topic).toBe('Map B')
  const latest = doc(b.id)
  maps.setState(state => ({ maps: state.maps.map(map => map.id === b.id ? { ...map, root: { ...map.root, topic: 'Imported' } } : map) }))
  expect(() => maps.getState().undoMap(b.id)).toThrow(MindMapTaskTitleConflictError)
  expect(maps.getState().undoMap(b.id)).toBe(false)
  expect(doc(b.id).root.topic).toBe('Imported'); expect(latest.root.topic).toBe('Plan')
})

it('limits per-map history to the most recent fifty changes', () => {
  const map = setup()
  for (let n = 1; n <= 55; n++) rename('b', 'Change ' + n)
  let count = 0
  while (maps.getState().undoMap(map.id)) count++
  expect(count).toBe(50); expect(findMindMapNode(doc().root, 'b')?.topic).toBe('Change 5')
})

it('preserves concurrent external task edits if persisting an undo fails', () => {
  const map = setup(), id = maps.getState().convertNodeToTask(map.id, 'a')!
  rename('a', 'Changed in map')
  const before = structuredClone(doc())
  const write = localStorage.setItem.bind(localStorage); let fail = true
  vi.spyOn(localStorage, 'setItem').mockImplementation((key, value) => {
    if (key === 'anvilite-mind-maps' && fail) {
      fail = false
      tasks.getState().updateTask(id, { title: 'Later external name', actualMinutes: 42 })
      throw Error('Synthetic storage failure')
    }
    write(key, value)
  })
  expect(() => maps.getState().undoMap(map.id)).toThrow('Synthetic storage failure')
  expect(doc()).toEqual(before)
  expect(task(id)).toMatchObject({ title: 'Later external name', actualMinutes: 42 })
  expect(() => maps.getState().undoMap(map.id)).toThrow(MindMapTaskTitleConflictError)
})

it('does not persist history and starts a cold reload with no available undo', async () => {
  const map = setup(); rename('a', 'Saved before restart')
  expect(Object.keys(JSON.parse(localStorage.getItem('anvilite-mind-maps')!).state).sort()).toEqual(['maps', 'selectedMapId'])
  vi.resetModules()
  const fresh = (await import('./mindMapStore')).useMindMapStore
  expect(fresh.getState().maps[0].root).toEqual(doc().root)
  expect(fresh.getState().undoMap(map.id)).toBe(false)
})
