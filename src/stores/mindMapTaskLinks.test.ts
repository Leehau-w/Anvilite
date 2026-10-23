import { beforeEach, afterEach, expect, it, vi } from 'vitest'
import { useMindMapStore as maps } from './mindMapStore'
import { useTaskStore as tasks } from './taskStore'
import { cloneMindMapNode, findMindMapNode, isValidMindMapNode } from '@/types/mindMap'
import type { MindMapNode } from '@/types/mindMap'
import { findMindMapSubTask, getMindMapNodeTitle, resolveMindMapNodeTask,
  MindMapTaskDepthError, MindMapTaskTitleConflictError } from '@/utils/mindMapTaskLinks'

const key = 'anvilite-mind-maps'
function doc(id = maps.getState().selectedMapId!) { return maps.getState().maps.find(map => map.id === id)! }
function node(id: string) { return findMindMapNode(doc().root, id)! }
function task(id: string) { return tasks.getState().tasks.find(task => task.id === id)! }
function makeMap(children: MindMapNode[] = [{ id: 'a', topic: 'First', children: [{ id: 'b', topic: 'Second', children: [{ id: 'c', topic: 'Third' }] }] }]) {
  const map = maps.getState().createMap('Project')!
  expect(maps.getState().updateMapTree(map.id, { ...map.root, children }, map.revision)).toBe(true)
  return doc(map.id)
}
function editTopic(id: string, title: string, previousTitle: string) {
  const map = doc()
  const root = cloneMindMapNode(map.root)
  findMindMapNode(root, id)!.topic = title
  return maps.getState().updateMapTree(map.id, root, map.revision, [{ nodeId: id, previousTitle, title }])
}
function failOnce(failedKey: string, effect?: () => void) {
  const write = localStorage.setItem.bind(localStorage)
  let active = true
  vi.spyOn(localStorage, 'setItem').mockImplementation((key, value) => {
    if (active && key === failedKey) { active = false; effect?.(); throw new Error('Full device') }
    write(key, value)
  })
}
beforeEach(() => {
  vi.restoreAllMocks(); localStorage.clear()
  maps.setState({ maps: [], selectedMapId: null })
  tasks.setState({ tasks: [], lastCategory: 'other', completedViewMode: 'month', customTaskGroups: [] })
})
afterEach(() => vi.restoreAllMocks())

it('converts all descendant levels, keeps existing subtrees and task business fields, and deduplicates repeated links', () => {
  const map = makeMap()
  const existing = tasks.getState().addTask({ title: 'Actual project', category: 'work', tags: ['keep'] })
  tasks.getState().addSubTask(existing.id, 'Unrelated child')
  tasks.getState().waitTask(existing.id)
  tasks.getState().updateTask(existing.id, { actualMinutes: 41, priority: 'high', timerAccumulated: 70 })
  const before = task(existing.id)
  expect(maps.getState().linkTask(map.id, map.root.id, existing.id)).toBe(true)
  const linked = task(existing.id)
  const { subTasks: _old, updatedAt: _oldAt, ...oldFields } = before
  const { subTasks: _next, updatedAt: _newAt, ...newFields } = linked
  expect(newFields).toEqual(oldFields)
  expect(linked.subTasks[0]).toBe(before.subTasks[0])
  expect(linked.subTasks[1]).toMatchObject({ title: 'First', mindMapSource: { mapId: map.id, nodeId: 'a' },
    subTasks: [{ title: 'Second', subTasks: [{ title: 'Third', subTasks: [] }] }] })
  for (const id of ['a', 'b', 'c']) expect(resolveMindMapNodeTask(node(id), [linked])!.subTask!.id).toBe(node(id).subTaskId)
  const snapshot = structuredClone(linked)
  expect(maps.getState().linkTask(map.id, map.root.id, existing.id)).toBe(true)
  expect(task(existing.id)).toEqual(snapshot)
  expect(isValidMindMapNode(doc().root)).toBe(true)
})

it('projects task and subtask renames from the task system, and explicitly edited node titles update the real entities', () => {
  const map = makeMap()
  const id = maps.getState().convertNodeToTask(map.id, map.root.id)!
  const childId = node('a').subTaskId!
  tasks.getState().updateTask(id, { title: 'Externally renamed', priority: 'urgent' })
  tasks.getState().editSubTask(id, childId, 'Externally renamed child')
  expect(getMindMapNodeTitle(doc().root, tasks.getState().tasks)).toBe('Externally renamed')
  expect(getMindMapNodeTitle(node('a'), tasks.getState().tasks)).toBe('Externally renamed child')
  expect(editTopic(doc().root.id, 'Canvas project', 'Externally renamed')).toBe(true)
  expect(editTopic('a', 'Canvas child', 'Externally renamed child')).toBe(true)
  expect(task(id).title).toBe('Canvas project')
  expect(findMindMapSubTask(task(id).subTasks, childId)!.title).toBe('Canvas child')
  expect(task(id).priority).toBe('urgent')
})

it('never overwrites a live task title from a stale folded/dragged canvas and rejects explicit stale title edits atomically', () => {
  const map = makeMap()
  const id = maps.getState().convertNodeToTask(map.id, map.root.id)!
  const stale = cloneMindMapNode(doc().root)
  tasks.getState().updateTask(id, { title: 'Latest saved task' })
  stale.expanded = false
  expect(maps.getState().updateMapTree(map.id, stale, doc().revision)).toBe(true)
  expect(task(id).title).toBe('Latest saved task')
  const before = structuredClone({ map: doc(), task: task(id) })
  const next = cloneMindMapNode(doc().root)
  next.topic = 'Stale edit'; next.children!.push({ id: 'new', topic: 'Must not be added' })
  expect(() => maps.getState().updateMapTree(map.id, next, doc().revision,
    [{ nodeId: next.id, previousTitle: 'Project', title: 'Stale edit' }])).toThrow(MindMapTaskTitleConflictError)
  expect({ map: doc(), task: task(id) }).toEqual(before)
})

it('adds new plain descendants under linked nodes on save and preserves latest external children/completion state', () => {
  const map = makeMap()
  const id = maps.getState().convertNodeToTask(map.id, map.root.id)!
  const first = node('a').subTaskId!
  const canvas = cloneMindMapNode(doc().root)
  tasks.getState().addSubTask(id, 'Added in task drawer', first)
  tasks.getState().toggleSubTask(id, node('b').subTaskId!)
  const before = task(id)
  findMindMapNode(canvas, 'a')!.children!.push({ id: 'new', topic: 'From canvas', children: [{ id: 'new-leaf', topic: 'Nested canvas' }] })
  expect(maps.getState().updateMapTree(map.id, canvas, doc().revision)).toBe(true)
  const children = findMindMapSubTask(task(id).subTasks, first)!.subTasks
  expect(children.map(child => child.title)).toEqual(['Second', 'Added in task drawer', 'From canvas'])
  expect(children[0]).toEqual(findMindMapSubTask(before.subTasks, node('b').subTaskId!))
  expect(resolveMindMapNodeTask(node('new-leaf'), [task(id)])!.subTask!.title).toBe('Nested canvas')
  const snapshot = structuredClone(task(id))
  const latest = doc(); expect(maps.getState().updateMapTree(map.id, { ...latest.root, expanded: false }, latest.revision)).toBe(true)
  expect(task(id)).toEqual(snapshot)
})

it('preserves independent task-linked descendant branches as boundaries', () => {
  const map = makeMap([{ id: 'a', topic: 'First', children: [{ id: 'independent', topic: 'Other project', children: [{ id: 'own', topic: 'Other child' }] }] }])
  const separate = tasks.getState().addTask({ title: 'Independent' })
  maps.getState().linkTask(map.id, 'independent', separate.id)
  const otherBefore = structuredClone(task(separate.id))
  const owner = maps.getState().convertNodeToTask(map.id, map.root.id)!
  expect(task(owner).subTasks).toHaveLength(1)
  expect(task(owner).subTasks[0].subTasks).toEqual([])
  expect(task(separate.id)).toEqual(otherBefore)
  expect(node('independent')).toMatchObject({ taskId: separate.id })
  expect(node('own')).toMatchObject({ taskId: separate.id, subTaskId: task(separate.id).subTasks[0].id })
})

it('does not delete or reparent real subtasks when nodes are dragged out, removed, unlinked or their map is deleted', () => {
  const map = makeMap()
  const id = maps.getState().convertNodeToTask(map.id, map.root.id)!
  const before = task(id)
  let root = cloneMindMapNode(doc().root)
  const moved = root.children![0].children!.pop()!
  root.children!.push(moved)
  expect(maps.getState().updateMapTree(map.id, root, doc().revision)).toBe(true)
  expect(task(id)).toBe(before)
  expect(node('b').subTaskId).toBe(before.subTasks[0].subTasks[0].id)
  expect(maps.getState().unlinkTask(map.id, 'b')).toBe(false)
  root = cloneMindMapNode(doc().root); root.children!.pop()
  expect(maps.getState().updateMapTree(map.id, root, doc().revision)).toBe(true)
  expect(task(id)).toBe(before)
  expect(maps.getState().unlinkTask(map.id, root.id)).toBe(true)
  expect(node('a').taskId).toBeUndefined()
  expect(task(id)).toBe(before)
  maps.getState().deleteMap(map.id)
  expect(task(id)).toBe(before)
})

it('keeps a deliberately removed mapped subtask as a missing reference instead of recreating it on later saves', () => {
  const map = makeMap()
  const id = maps.getState().convertNodeToTask(map.id, map.root.id)!
  const removed = node('b').subTaskId!
  tasks.getState().removeSubTask(id, removed)
  const before = task(id)
  const root = cloneMindMapNode(doc().root)
  root.expanded = false
  findMindMapNode(root, 'b')!.children!.push({ id: 'under-missing', topic: 'Unattached thought' })
  expect(maps.getState().updateMapTree(map.id, root, doc().revision)).toBe(true)
  expect(task(id)).toBe(before)
  expect(node('b').subTaskId).toBe(removed)
  expect(resolveMindMapNodeTask(node('b'), [task(id)])).toBeNull()
  expect(node('under-missing').taskId).toBeUndefined()
  expect(maps.getState().convertNodeToTask(map.id, 'b')).toBeNull()
})

it.each(['link', 'convert', 'append'] as const)('rejects a fourth subtask level atomically during %s', operation => {
  const map = makeMap()
  let id: string | undefined
  if (operation === 'append') id = maps.getState().convertNodeToTask(map.id, map.root.id)!
  const root = cloneMindMapNode(doc().root)
  findMindMapNode(root, 'c')!.children = [{ id: 'too-deep', topic: 'Fourth' }]
  if (operation !== 'append') expect(maps.getState().updateMapTree(map.id, root, doc().revision)).toBe(true)
  if (operation === 'link') id = tasks.getState().addTask({ title: 'Existing' }).id
  const before = structuredClone({ map: doc(), tasks: tasks.getState().tasks })
  const write = vi.spyOn(localStorage, 'setItem')
  const action = operation === 'append' ? () => maps.getState().updateMapTree(map.id, root, doc().revision)
    : operation === 'link' ? () => maps.getState().linkTask(map.id, map.root.id, id!)
    : () => maps.getState().convertNodeToTask(map.id, map.root.id)
  expect(action).toThrow(MindMapTaskDepthError)
  expect({ map: doc(), tasks: tasks.getState().tasks }).toEqual(before)
  expect(write).not.toHaveBeenCalled()
})

it('checks depth from the actual bound subtask even when it is moved to a shallower graph position', () => {
  const map = makeMap(); maps.getState().convertNodeToTask(map.id, map.root.id)
  const root = cloneMindMapNode(doc().root)
  const deepest = root.children![0].children![0].children!.pop()!
  deepest.children = [{ id: 'fourth', topic: 'Still too deep' }]
  root.children!.push(deepest)
  expect(() => maps.getState().updateMapTree(map.id, root, doc().revision)).toThrow(MindMapTaskDepthError)
})

it('completes newly mapped children under an already completed owner without changing its receipt or historical fields', () => {
  const map = makeMap()
  const existing = tasks.getState().addTask({ title: 'Done project' })
  tasks.getState().completeTask(existing.id)
  const before = task(existing.id)
  maps.getState().linkTask(map.id, map.root.id, existing.id)
  const { subTasks: _old, updatedAt: _oldAt, ...oldFields } = before
  const { subTasks: _next, updatedAt: _newAt, ...newFields } = task(existing.id)
  expect(newFields).toEqual(oldFields)
  const visit = (subs: typeof before.subTasks) => subs.forEach(sub => { expect(sub.completed).toBe(true); visit(sub.subTasks) })
  visit(task(existing.id).subTasks)
})

it.each(['anvilite-tasks', key])('compensates a failed descendant association write to %s then retries without duplicates', failedKey => {
  const map = makeMap()
  const existing = tasks.getState().addTask({ title: 'Keep task' })
  tasks.getState().addSubTask(existing.id, 'Keep child')
  const before = structuredClone({ map: doc(), task: task(existing.id) })
  failOnce(failedKey)
  expect(() => maps.getState().linkTask(map.id, map.root.id, existing.id)).toThrow('Full device')
  expect({ map: doc(), task: task(existing.id) }).toEqual(before)
  expect(JSON.parse(localStorage.getItem('anvilite-tasks')!).state.tasks[0]).toEqual(before.task)
  expect(maps.getState().linkTask(map.id, map.root.id, existing.id)).toBe(true)
  expect(task(existing.id).subTasks).toHaveLength(2)
})

it('retains later unrelated task changes and newly added subtasks during compensation', () => {
  const map = makeMap()
  const existing = tasks.getState().addTask({ title: 'Keep task' })
  failOnce(key, () => {
    tasks.getState().updateTask(existing.id, { title: 'Later name', priority: 'high' })
    tasks.getState().addSubTask(existing.id, 'Later user child')
  })
  expect(() => maps.getState().linkTask(map.id, map.root.id, existing.id)).toThrow('Full device')
  expect(task(existing.id)).toMatchObject({ title: 'Later name', priority: 'high', subTasks: [{ title: 'Later user child' }] })
  expect(doc().root.taskId).toBeUndefined()
})

it('recovers durable converted children after graph and rollback writes fail and a cold reload loses all new references', async () => {
  const map = makeMap()
  const existing = tasks.getState().addTask({ title: 'Keep task' })
  const write = localStorage.setItem.bind(localStorage)
  let failing = false
  vi.spyOn(localStorage, 'setItem').mockImplementation((name, value) => {
    if (name === key) failing = true
    if (failing) throw new Error('Device remains full')
    write(name, value)
  })
  expect(() => maps.getState().linkTask(map.id, map.root.id, existing.id)).toThrow('Device remains full')
  expect(task(existing.id).subTasks).toEqual([])
  const durable = JSON.parse(localStorage.getItem('anvilite-tasks')!).state.tasks[0]
  expect(durable.subTasks).toHaveLength(1)
  vi.restoreAllMocks(); vi.resetModules()
  const freshMaps = (await import('./mindMapStore')).useMindMapStore
  const freshTasks = (await import('./taskStore')).useTaskStore
  expect(freshMaps.getState().linkTask(map.id, map.root.id, existing.id)).toBe(true)
  expect(freshMaps.getState().linkTask(map.id, map.root.id, existing.id)).toBe(true)
  expect(freshTasks.getState().tasks[0]).toEqual(durable)
  expect(findMindMapNode(freshMaps.getState().maps[0].root, 'a')!.subTaskId).toBe(durable.subTasks[0].id)
})

it('preserves an independent document name for linked roots across map rename and projected fold saves', () => {
  const map = makeMap()
  const id = maps.getState().convertNodeToTask(map.id, map.root.id)!
  expect(maps.getState().renameMap(map.id, 'Personal map name')).toBe(true)
  expect(task(id).title).toBe('Project')
  tasks.getState().updateTask(id, { title: 'Live project name' })
  const root = cloneMindMapNode(doc().root); root.topic = getMindMapNodeTitle(root, tasks.getState().tasks); root.expanded = false
  expect(maps.getState().updateMapTree(map.id, root, doc().revision)).toBe(true)
  expect(doc().title).toBe('Personal map name')
  expect(task(id).title).toBe('Live project name')
})

it('retains children deliberately associated by a nested link operation that wins before the outer map commit', () => {
  const map = makeMap()
  const existing = tasks.getState().addTask({ title: 'Keep task' })
  let nested: boolean | undefined
  const unsubscribe = tasks.subscribe(state => {
    if (nested === undefined && state.tasks[0].subTasks.length) {
      nested = false
      nested = maps.getState().linkTask(map.id, map.root.id, existing.id)
    }
  })
  expect(maps.getState().linkTask(map.id, map.root.id, existing.id)).toBe(false)
  unsubscribe()
  expect(nested).toBe(true)
  expect(task(existing.id).subTasks).toHaveLength(1)
  expect(resolveMindMapNodeTask(node('c'), [task(existing.id)])!.subTask!.title).toBe('Third')
})


it.each(['anvilite-tasks', key])('rolls back explicit task and subtask title edits when %s rejects the write', failedKey => {
  const map = makeMap()
  const id = maps.getState().convertNodeToTask(map.id, map.root.id)!
  const before = structuredClone({ map: doc(), task: task(id) })
  const root = cloneMindMapNode(doc().root)
  root.topic = 'Edited task'; findMindMapNode(root, 'a')!.topic = 'Edited child'
  failOnce(failedKey)
  expect(() => maps.getState().updateMapTree(map.id, root, doc().revision, [
    { nodeId: root.id, previousTitle: 'Project', title: 'Edited task' },
    { nodeId: 'a', previousTitle: 'First', title: 'Edited child' },
  ])).toThrow('Full device')
  expect({ map: doc(), task: task(id) }).toEqual(before)
})

it('keeps later task/subtask title changes instead of rolling them back with a failed graph title save', () => {
  const map = makeMap(); const id = maps.getState().convertNodeToTask(map.id, map.root.id)!
  const childId = node('a').subTaskId!
  failOnce(key, () => {
    tasks.getState().updateTask(id, { title: 'Later task title', description: 'Keep notes' })
    tasks.getState().editSubTask(id, childId, 'Later child title')
  })
  const root = cloneMindMapNode(doc().root); root.topic = 'Edited task'; findMindMapNode(root, 'a')!.topic = 'Edited child'
  expect(() => maps.getState().updateMapTree(map.id, root, doc().revision, [
    { nodeId: root.id, previousTitle: 'Project', title: 'Edited task' },
    { nodeId: 'a', previousTitle: 'First', title: 'Edited child' },
  ])).toThrow('Full device')
  expect(task(id)).toMatchObject({ title: 'Later task title', description: 'Keep notes' })
  expect(findMindMapSubTask(task(id).subTasks, childId)!.title).toBe('Later child title')
})

it('merges the latest independently linked owner children between bounded task writes', () => {
  const map = makeMap([{ id: 'plain', topic: 'Initial' }, { id: 'independent', topic: 'Independent' }])
  const other = tasks.getState().addTask({ title: 'Other project' })
  maps.getState().linkTask(map.id, 'independent', other.id)
  const owner = maps.getState().convertNodeToTask(map.id, map.root.id)!
  let changed = false
  const unsubscribe = tasks.subscribe(state => {
    if (!changed && state.tasks.find(current => current.id === owner)!.subTasks.some(sub => sub.title === 'New owner child')) {
      changed = true
      tasks.getState().updateTask(other.id, { title: 'New independent task title', actualMinutes: 33 })
      tasks.getState().addSubTask(other.id, 'Drawer addition between saves')
    }
  })
  const root = cloneMindMapNode(doc().root)
  root.children!.unshift({ id: 'new-owner', topic: 'New owner child' })
  findMindMapNode(root, 'independent')!.children = [{ id: 'new-independent', topic: 'New independent child' }]
  expect(maps.getState().updateMapTree(map.id, root, doc().revision)).toBe(true)
  unsubscribe()
  expect(changed).toBe(true)
  expect(task(other.id)).toMatchObject({ title: 'New independent task title', actualMinutes: 33 })
  expect(task(other.id).subTasks.map(sub => sub.title)).toEqual(['Drawer addition between saves', 'New independent child'])
  expect(resolveMindMapNodeTask(node('new-independent'), [task(other.id)])!.subTask!.title).toBe('New independent child')
})

it('validates dependent references and preserves them through plain cloning', () => {
  expect(isValidMindMapNode({ id: 'n', topic: 'Child', subTaskId: 'sub' })).toBe(false)
  expect(isValidMindMapNode({ id: 'n', topic: 'Child', taskId: 'task', subTaskId: '' })).toBe(false)
  const value = { id: 'n', topic: 'Child', taskId: 'task', subTaskId: 'sub' }
  expect(isValidMindMapNode(value)).toBe(true)
  expect(cloneMindMapNode(value)).toEqual(value)
})
