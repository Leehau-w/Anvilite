// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { MindMapNode } from '@/types/mindMap'

const mock = vi.hoisted(() => {
  vi.stubGlobal('window', document.defaultView)
  vi.stubGlobal('localStorage', document.defaultView!.localStorage)
  return { instances: [] as any[] }
})
vi.mock('mind-elixir', () => {
  class FakeMindElixir {
    static SIDE = 2
    el: HTMLElement
    data: any
    currentNode: any = null
    scaleVal = 1
    fitCalls = 0
    destroyed = false
    handlers = new Map<string, Function[]>()
    bus = {
      addListener: (event: string, callback: Function) => this.handlers.set(event, [...(this.handlers.get(event) ?? []), callback]),
      removeListener: (event: string, callback: Function) => this.handlers.set(event, (this.handlers.get(event) ?? []).filter(fn => fn !== callback)),
      fire: (event: string, ...args: unknown[]) => { this.handlers.get(event)?.forEach(fn => fn(...args)) },
    }
    options: any
    constructor(options: any) { this.options = options; this.el = options.el; mock.instances.push(this) }
    init(data: any) { this.refresh(data) }
    refresh(data: any) {
      this.data = JSON.parse(JSON.stringify(data)); this.currentNode = null; this.el.replaceChildren()
      const render = (node: any) => {
        const button = document.createElement('button') as any
        button.type = 'button'; button.dataset.fakeNode = node.id; button.textContent = node.topic; button.nodeObj = node
        button.addEventListener('click', () => this.selectNode(button))
        this.el.append(button)
        if (node.expanded !== false) node.children?.forEach(render)
      }
      render(this.data.nodeData)
    }
    findEle(id: string) { const node = this.el.querySelector(`[data-fake-node="${id}"]`); if (!node) throw Error('Missing topic'); return node }
    selectNode(node: any) { this.currentNode = node; this.bus.fire('selectNodes', [node.nodeObj]) }
    clearSelection() { this.currentNode = null }
    getData() { return JSON.parse(JSON.stringify(this.data)) }
    toCenter() {}
    scaleFit() { this.fitCalls++; this.scaleVal = Math.min(1, this.scaleVal) }
    linkDiv() {}
    scale(value: number) { this.scaleVal = value }
    destroy() { this.destroyed = true; this.el.replaceChildren() }
  }
  return { default: FakeMindElixir }
})
// Task business controls are exercised elsewhere; retain an edit entry point here.
vi.mock('@/components/tasks/TaskItem', () => ({ TaskItem: ({ task, onEdit }: any) => React.createElement('button', { type: 'button', 'data-linked-task': task.id, onClick: () => onEdit(task) }, task.title) }))
vi.mock('@/components/tasks/TaskDrawer', () => ({ TaskDrawer: ({ open, editTask, onClose }: any) => open ? React.createElement('div', { 'data-task-drawer': editTask?.id }, React.createElement('button', { type: 'button', onClick: onClose }, 'Close task')) : null }))
import { MindMapPage } from './MindMapPage'
import { projectMindMap } from './MindMapCanvas'
import { useMindMapStore } from '@/stores/mindMapStore'
import { useTaskStore } from '@/stores/taskStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { zh } from '@/i18n/zh'
import { en } from '@/i18n/en'

let container: HTMLDivElement
let root: Root
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  localStorage.clear(); mock.instances.length = 0
  useMindMapStore.setState({ maps: [], selectedMapId: null })
  useTaskStore.setState({ tasks: [], customTaskGroups: [] })
  useSettingsStore.getState().setLanguage('zh')
  container = document.createElement('div'); document.body.append(container); root = createRoot(container)
})
afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.restoreAllMocks() })
async function render() { await act(async () => root.render(React.createElement(MindMapPage))) }
async function click(node: Element) { await act(async () => { node.dispatchEvent(new MouseEvent('click', { bubbles: true })) }) }
function button(text: string) { const node = [...container.querySelectorAll('button')].find(item => item.textContent?.trim() === text); expect(node, text).toBeDefined(); return node! }
async function input(node: HTMLInputElement | HTMLTextAreaElement, value: string) {
  await act(async () => {
    const prototype = node.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype
    Object.getOwnPropertyDescriptor(prototype, 'value')!.set!.call(node, value)
    node.dispatchEvent(new Event('input', { bubbles: true }))
  })
}
async function submit(form: HTMLFormElement) { await act(async () => { form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })) }) }
const state = () => useMindMapStore.getState()
function seedMap() {
  const map = state().createMap('Plan')!
  state().updateMapTree(map.id, { ...map.root, children: [{ id: 'branch', topic: 'Branch', children: [{ id: 'leaf', topic: 'Leaf' }] }, { id: 'second', topic: 'Second' }] }, 0)
  return state().maps[0]
}
const latestMind = () => mock.instances.at(-1)!

it.each(['zh', 'en'] as const)('creates multiple maps and saves/cancels name drafts (%s)', async lang => {
  const t = lang === 'zh' ? zh : en
  useSettingsStore.getState().setLanguage(lang)
  await render()
  expect(container.textContent).toContain(t.mindmap_empty)
  await click(container.querySelector('[data-mindmap-new]')!)
  const name = container.querySelector<HTMLInputElement>('[data-mindmap-name]')!
  await input(name, '  Draft  ')
  const compose = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true, isComposing: true })
  await act(async () => { name.dispatchEvent(compose) })
  expect(compose.defaultPrevented).toBe(true); expect(state().maps).toHaveLength(0)
  await click(button(t.common_cancel)); expect(state().maps).toHaveLength(0)
  await click(container.querySelector('[data-mindmap-new]')!); await input(container.querySelector('[data-mindmap-name]')!, '  Research  ')
  await submit(container.querySelector('[role="dialog"] form')!)
  expect(state().maps[0].title).toBe('Research')
  await click(container.querySelector('[data-mindmap-new]')!); await input(container.querySelector('[data-mindmap-name]')!, 'Writing')
  await submit(container.querySelector('[role="dialog"] form')!)
  expect(state().maps).toHaveLength(2)
  const first = state().maps[0]
  await click(container.querySelector(`[data-mindmap-id="${first.id}"]`)!)
  expect(state().selectedMapId).toBe(first.id)
  expect(mock.instances[0].destroyed).toBe(true)
  expect(latestMind().options.allowUndo).toBe(false)
  expect(latestMind().options.contextMenu).toBe(false)
})

it('adds, renames, folds and removes a branch without affecting tasks', async () => {
  const map = seedMap(); useTaskStore.getState().addTask({ title: 'Unrelated task' })
  const before = useTaskStore.getState().tasks
  await render(); await click(container.querySelector('[data-fake-node="branch"]')!)
  await click(container.querySelector('[data-mindmap-add-child]')!)
  const child = state().maps[0].root.children![0].children!.at(-1)!
  expect(child.topic).toBe(zh.mindmap_newNode)
  await input(container.querySelector('[data-mindmap-node-title]')!, 'Named branch')
  await submit(container.querySelector('.mindmap-inspector form')!)
  expect(state().maps[0].root.children![0].children!.at(-1)!.topic).toBe('Named branch')
  await click(container.querySelector('[data-fake-node="branch"]')!); await click(button(zh.mindmap_collapse))
  expect(state().maps[0].root.children![0].expanded).toBe(false)
  await click(button(zh.mindmap_expand)); expect(state().maps[0].root.children![0].expanded).toBe(true)
  await click(container.querySelector('[data-mindmap-delete-node]')!); await click(button(zh.common_cancel))
  expect(state().maps[0].root.children).toHaveLength(2)
  await click(container.querySelector('[data-mindmap-delete-node]')!); await click(button(zh.common_delete))
  expect(state().maps[0].root.children!.map(node => node.id)).toEqual(['second'])
  expect(useTaskStore.getState().tasks).toEqual(before)
  expect(state().maps[0].id).toBe(map.id)
})

it('links an existing task, syncs status and title, unlinks safely and converts once', async () => {
  const map = seedMap(); const task = useTaskStore.getState().addTask({ title: 'Send email' })
  await render(); await click(container.querySelector('[data-fake-node="branch"]')!)
  await click(container.querySelector('[data-mindmap-link]')!)
  await input(container.querySelector('input[type="search"]')!, 'email')
  await click(container.querySelector(`[data-mindmap-link-task="${task.id}"]`)!)
  expect(state().maps[0].root.children![0].taskId).toBe(task.id)
  expect(useTaskStore.getState().tasks).toHaveLength(1)
  await act(async () => { useTaskStore.getState().updateTask(task.id, { title: 'Send revised email' }); useTaskStore.getState().waitTask(task.id) })
  expect(container.querySelector('[data-mindmap-task-status]')?.getAttribute('data-mindmap-task-status')).toBe('waiting')
  expect(container.querySelector('[data-linked-task]')?.textContent).toBe('Send revised email')
  expect(latestMind().data.nodeData.children[0].topic).toBe('Send revised email')
  expect((container.querySelector('[data-mindmap-node-title]') as HTMLTextAreaElement).value).toBe('Send revised email')
  expect(latestMind().data.nodeData.children[0].tags[0].text).toBe(zh.task_waiting)
  await input(container.querySelector('[data-mindmap-node-title]')!, 'Send from map')
  await submit(container.querySelector('.mindmap-inspector form')!)
  expect(useTaskStore.getState().tasks.find(item => item.id === task.id)?.title).toBe('Send from map')
  expect(latestMind().data.nodeData.children[0].topic).toBe('Send from map')
  await click(button(zh.mindmap_openTask)); expect(container.querySelector('[data-task-drawer]')?.getAttribute('data-task-drawer')).toBe(task.id)
  await click(button('Close task'))
  await click(button(zh.mindmap_unlink)); expect(useTaskStore.getState().tasks).toHaveLength(1)
  await click(container.querySelector('[data-mindmap-convert]')!)
  const converted = state().maps[0].root.children![0].taskId!
  expect(converted).not.toBe(task.id)
  expect(useTaskStore.getState().tasks).toHaveLength(2)
  await act(async () => { state().convertNodeToTask(map.id, 'branch') })
  expect(useTaskStore.getState().tasks).toHaveLength(2)
  await click(container.querySelector('[data-mindmap-delete-node]')!); await click(button(zh.common_delete))
  expect(useTaskStore.getState().tasks.find(item => item.id === converted)?.deletedAt).toBeNull()
})

it('deleting a map preserves all linked tasks, and deleted task references remain clear', async () => {
  const map = seedMap(); const task = useTaskStore.getState().addTask({ title: 'Existing task' }); state().linkTask(map.id, 'branch', task.id)
  await render(); await click(container.querySelector('[data-fake-node="branch"]')!)
  await act(async () => { useTaskStore.getState().deleteTask(task.id) })
  expect(container.textContent).toContain(zh.mindmap_taskMissing)
  expect(latestMind().data.nodeData.children[0].tags[0].text).toBe(zh.mindmap_taskMissing)
  await act(async () => { useTaskStore.getState().restoreTask(task.id) })
  const before = useTaskStore.getState().tasks
  await click(button(zh.mindmap_deleteMap)); await click(button(zh.common_delete))
  expect(state().maps).toHaveLength(0); expect(useTaskStore.getState().tasks).toEqual(before)
})

it('uses the rendered revision during native editing and refuses to overwrite external updates', async () => {
  const map = seedMap(); await render()
  const mind = latestMind()
  const draft = document.createElement('div'); draft.id = 'input-box'; draft.textContent = 'Composing'; mind.el.append(draft)
  await act(async () => { state().renameMap(map.id, 'External title') })
  expect(mind.el.querySelector('#input-box')?.textContent).toBe('Composing')
  mind.data.nodeData.topic = 'Stale local title'
  await act(async () => { mind.bus.fire('operation', { name: 'finishEdit' }) })
  expect(state().maps[0].title).toBe('External title')
  expect(container.querySelector('[role="alert"]')?.textContent).toBe(zh.mindmap_conflict)
})

it('native task status refresh preserves a text composition and hidden selection safely falls back', async () => {
  const map = seedMap(); const task = useTaskStore.getState().addTask({ title: 'Mail' }); state().linkTask(map.id, 'branch', task.id)
  await render(); await click(container.querySelector('[data-fake-node="leaf"]')!)
  const mind = latestMind()
  const draft = document.createElement('div'); draft.id = 'input-box'; draft.textContent = 'Unfinished input'; mind.el.append(draft)
  await act(async () => { useTaskStore.getState().waitTask(task.id) })
  expect(mind.el.querySelector('#input-box')?.textContent).toBe('Unfinished input')
  draft.remove()
  await act(async () => {
    const current = state().maps[0]
    state().updateMapTree(map.id, { ...current.root, children: current.root.children!.map(node => node.id === 'branch' ? { ...node, expanded: false } : node) }, current.revision)
  })
  expect(container.querySelector('[data-mindmap-node-title]')?.getAttribute('id')).toBe('mindmap-node-title')
  expect((container.querySelector('[data-mindmap-node-title]') as HTMLTextAreaElement).value).toBe('Plan')
  expect(mind.currentNode.nodeObj.id).toBe(map.root.id)
})

it('reports save failures and leaves the current map available for retry', async () => {
  seedMap(); await render(); await click(container.querySelector('[data-fake-node="branch"]')!)
  const before = structuredClone(state().maps)
  const update = vi.spyOn(state(), 'updateMapTree').mockImplementation(() => { throw Error('Disk full') })
  await input(container.querySelector('[data-mindmap-node-title]')!, 'Unsaved')
  await submit(container.querySelector('.mindmap-inspector form')!)
  expect(container.querySelector('[role="alert"]')?.textContent).toBe(zh.mindmap_saveFailed)
  expect(state().maps).toEqual(before)
  update.mockRestore()
})

it('projects only plain schema fields and badges without persisting task status or HTML', () => {
  const task = useTaskStore.getState().addTask({ title: 'Real title', status: 'waiting' })
  const node = { id: 'root', topic: '<img onerror=alert(1)>', taskId: task.id, dangerouslySetInnerHTML: '<script>bad</script>', tags: ['old'], children: [{ id: 'child', topic: 'Child', taskId: 'missing' }] } as MindMapNode
  const projected = projectMindMap(node, [{ ...task, status: 'waiting' }], en)
  expect(projected.nodeData.topic).toBe('Real title')
  expect(node.topic).toBe('<img onerror=alert(1)>')
  expect(projected.nodeData).not.toHaveProperty('dangerouslySetInnerHTML')
  expect(projected.nodeData).not.toHaveProperty('taskId')
  expect(projected.nodeData.tags).toEqual([expect.objectContaining({ text: en.task_waiting })])
  expect(projected.nodeData.children![0].tags).toEqual([expect.objectContaining({ text: en.mindmap_taskMissing })])
  expect(node).not.toHaveProperty('status')
})


it('fits the visible diagram on initial load and when centering after zooming', async () => {
  seedMap(); await render()
  const mind = latestMind()
  expect(mind.fitCalls).toBe(1)
  const zoomIn = container.querySelector('[aria-label="' + zh.mindmap_zoomIn + '"]')!
  await click(zoomIn); await click(zoomIn)
  expect(mind.scaleVal).toBeGreaterThan(1)
  await click(button(zh.mindmap_center))
  expect(mind.fitCalls).toBe(2)
  expect(mind.scaleVal).toBeLessThanOrEqual(1)
})


it.each(['zh', 'en'] as const)('shows derived subtask titles and completion independently from the owner task (%s)', async lang => {
  const t = lang === 'zh' ? zh : en
  useSettingsStore.getState().setLanguage(lang)
  const map = seedMap(); const task = useTaskStore.getState().addTask({ title: 'Parent task' })
  useTaskStore.getState().waitTask(task.id)
  state().linkTask(map.id, 'branch', task.id)
  const childId = state().maps[0].root.children![0].children![0].subTaskId!
  expect(childId).toBeTruthy()
  await render(); await click(container.querySelector('[data-fake-node="leaf"]')!)
  expect(container.textContent).toContain(t.mindmap_linkedSubTask)
  expect(container.querySelector('[data-mindmap-subtask-id]')?.getAttribute('data-mindmap-subtask-id')).toBe(childId)
  expect(container.querySelector('[data-mindmap-subtask-status]')?.getAttribute('data-mindmap-subtask-status')).toBe('todo')
  expect(latestMind().data.nodeData.children[0].children[0].tags[0].text).toBe(t.tasklist_todo)
  expect([...container.querySelectorAll('button')].some(node => node.textContent === t.mindmap_unlink)).toBe(false)
  await act(async () => { useTaskStore.getState().editSubTask(task.id, childId, 'Edited in tasks'); useTaskStore.getState().toggleSubTask(task.id, childId) })
  expect(latestMind().data.nodeData.children[0].children[0].topic).toBe('Edited in tasks')
  expect(latestMind().data.nodeData.children[0].children[0].tags[0].text).toBe(t.tasklist_done)
  expect(container.querySelector('[data-mindmap-subtask-status]')?.getAttribute('data-mindmap-subtask-status')).toBe('done')
  expect((container.querySelector('[data-mindmap-node-title]') as HTMLTextAreaElement).value).toBe('Edited in tasks')
  await input(container.querySelector('[data-mindmap-node-title]')!, 'Edited in map')
  await submit(container.querySelector('.mindmap-inspector form')!)
  const current = useTaskStore.getState().tasks.find(item => item.id === task.id)!
  expect(current.title).toBe('Parent task'); expect(current.status).toBe('waiting')
  expect(current.subTasks[0]).toMatchObject({ id: childId, title: 'Edited in map', completed: true })
  await click(button(t.mindmap_openParentTask))
  expect(container.querySelector('[data-task-drawer]')?.getAttribute('data-task-drawer')).toBe(task.id)
})

it('rejects a dirty inspector title when its linked task changed and reloads the latest title', async () => {
  const map = seedMap(); const task = useTaskStore.getState().addTask({ title: 'Original task' }); state().linkTask(map.id, 'branch', task.id)
  await render(); await click(container.querySelector('[data-fake-node="branch"]')!)
  await input(container.querySelector('[data-mindmap-node-title]')!, 'Local draft')
  await act(async () => { useTaskStore.getState().updateTask(task.id, { title: 'External title' }) })
  expect((container.querySelector('[data-mindmap-node-title]') as HTMLTextAreaElement).value).toBe('Local draft')
  await submit(container.querySelector('.mindmap-inspector form')!)
  expect(useTaskStore.getState().tasks.find(item => item.id === task.id)?.title).toBe('External title')
  expect(container.querySelector('[role="alert"]')?.textContent).toBe(zh.mindmap_conflict)
  expect((container.querySelector('[data-mindmap-node-title]') as HTMLTextAreaElement).value).toBe('External title')
})

it('uses native rendered title baselines and never renames live tasks from a stale fold', async () => {
  const map = seedMap(); const task = useTaskStore.getState().addTask({ title: 'Original task' }); state().linkTask(map.id, 'branch', task.id)
  await render()
  const mind = latestMind(); const draft = document.createElement('div'); draft.id = 'input-box'; draft.textContent = 'Composing'; mind.el.append(draft)
  await act(async () => { useTaskStore.getState().updateTask(task.id, { title: 'External title' }) })
  expect(mind.data.nodeData.children[0].topic).toBe('Original task')
  mind.data.nodeData.children[0].expanded = false
  await act(async () => { mind.bus.fire('expandNode') })
  expect(useTaskStore.getState().tasks.find(item => item.id === task.id)?.title).toBe('External title')
  expect(state().maps[0].root.children![0].expanded).toBe(false)
  mind.data.nodeData.children[0].topic = 'Native local draft'
  await act(async () => { mind.bus.fire('operation', { name: 'finishEdit' }) })
  expect(useTaskStore.getState().tasks.find(item => item.id === task.id)?.title).toBe('External title')
  expect(container.querySelector('[role="alert"]')?.textContent).toBe(zh.mindmap_conflict)
  draft.remove()
})

it('commits a native task title edit and protects IME Enter including key code 229', async () => {
  const map = seedMap(); const task = useTaskStore.getState().addTask({ title: 'Original task' }); state().linkTask(map.id, 'branch', task.id)
  await render()
  const mind = latestMind(); const draft = document.createElement('div'); draft.id = 'input-box'; draft.textContent = '组合输入'; mind.el.append(draft)
  const commit = vi.fn(() => { mind.data.nodeData.children[0].topic = draft.textContent; draft.remove(); mind.bus.fire('operation', { name: 'finishEdit' }) })
  draft.addEventListener('keydown', event => { if (event.key === 'Enter') commit() })
  await act(async () => {
    draft.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }))
    draft.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }))
    draft.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true }))
    draft.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', keyCode: 229, bubbles: true, cancelable: true }))
  })
  expect(commit).not.toHaveBeenCalled()
  expect(useTaskStore.getState().tasks.find(item => item.id === task.id)?.title).toBe('Original task')
  await act(async () => { draft.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })) })
  expect(commit).toHaveBeenCalledOnce()
  expect(useTaskStore.getState().tasks.find(item => item.id === task.id)?.title).toBe('组合输入')
})

it.each(['zh', 'en'] as const)('explains unsupported subtask depth without partially linking the branch (%s)', async lang => {
  const t = lang === 'zh' ? zh : en
  useSettingsStore.getState().setLanguage(lang)
  const map = state().createMap('Deep')!
  state().updateMapTree(map.id, { ...map.root, children: [{ id: 'owner', topic: 'Owner', children: [{ id: 'one', topic: 'One', children: [{ id: 'two', topic: 'Two', children: [{ id: 'three', topic: 'Three', children: [{ id: 'four', topic: 'Four' }] }] }] }] }] }, 0)
  const task = useTaskStore.getState().addTask({ title: 'Existing task' }); const before = useTaskStore.getState().tasks
  await render(); await click(container.querySelector('[data-fake-node="owner"]')!)
  await click(container.querySelector('[data-mindmap-link]')!); await click(container.querySelector('[data-mindmap-link-task="' + task.id + '"]')!)
  expect(container.querySelector('[role="alert"]')?.textContent).toBe(t.mindmap_subTaskDepth)
  expect(state().maps[0].root.children![0].taskId).toBeUndefined()
  expect(useTaskStore.getState().tasks).toEqual(before)
})


it('does not submit an inspector title during input method composition', async () => {
  const map = seedMap(); const task = useTaskStore.getState().addTask({ title: 'Original' }); state().linkTask(map.id, 'branch', task.id)
  await render(); await click(container.querySelector('[data-fake-node="branch"]')!)
  const title = container.querySelector<HTMLTextAreaElement>('[data-mindmap-node-title]')!
  await input(title, '输入法标题')
  await act(async () => { title.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true })) })
  const event = new KeyboardEvent('keydown', { key: 'Enter', keyCode: 229, bubbles: true, cancelable: true })
  await act(async () => { title.dispatchEvent(event) })
  expect(event.defaultPrevented).toBe(true)
  await submit(container.querySelector('.mindmap-inspector form')!)
  expect(useTaskStore.getState().tasks.find(item => item.id === task.id)?.title).toBe('Original')
  await act(async () => { title.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true })) })
  await submit(container.querySelector('.mindmap-inspector form')!)
  expect(useTaskStore.getState().tasks.find(item => item.id === task.id)?.title).toBe('输入法标题')
})


it('upgrades old linked branches once on opening and switching maps without duplicate children', async () => {
  const first = seedMap(); const second = state().createMap('Other map')!
  const task = useTaskStore.getState().addTask({ title: 'Existing owner' })
  const oldFirst = { ...first, root: { ...first.root, children: [{ ...first.root.children![0], taskId: task.id }] } }
  const oldSecond = { ...second, root: { ...second.root, taskId: task.id, children: [{ id: 'other-child', topic: 'Second map child' }] } }
  useMindMapStore.setState({ maps: [oldFirst, oldSecond], selectedMapId: first.id })
  const write = vi.spyOn(useTaskStore.getState(), 'updateTask')
  await render()
  expect(state().maps[0].root.children![0].children![0].subTaskId).toBeTruthy()
  const firstChildId = state().maps[0].root.children![0].children![0].subTaskId
  expect(useTaskStore.getState().tasks[0].subTasks).toHaveLength(1)
  expect(write).toHaveBeenCalledTimes(1)
  await act(async () => { useTaskStore.getState().waitTask(task.id) })
  await render()
  expect(write).toHaveBeenCalledTimes(1)
  await click(container.querySelector('[data-mindmap-id="' + second.id + '"]')!)
  expect(state().maps[1].root.children![0].subTaskId).toBeTruthy()
  expect(useTaskStore.getState().tasks[0].subTasks).toHaveLength(2)
  expect(write).toHaveBeenCalledTimes(2)
  await click(container.querySelector('[data-mindmap-id="' + first.id + '"]')!)
  expect(state().maps[0].root.children![0].children![0].subTaskId).toBe(firstChildId)
  expect(useTaskStore.getState().tasks[0].subTasks).toHaveLength(2)
  expect(write).toHaveBeenCalledTimes(2)
})

it('reports a legacy-link upgrade failure once without retrying on task updates', async () => {
  const map = seedMap(); const task = useTaskStore.getState().addTask({ title: 'Existing owner' })
  useMindMapStore.setState({ maps: [{ ...map, root: { ...map.root, children: [{ ...map.root.children![0], taskId: task.id }] } }], selectedMapId: map.id })
  const update = vi.spyOn(state(), 'updateMapTree').mockImplementation(() => { throw Error('Disk full') })
  await render()
  expect(container.querySelector('[role="alert"]')?.textContent).toBe(zh.mindmap_saveFailed)
  expect(update).toHaveBeenCalledTimes(1)
  await act(async () => { useTaskStore.getState().waitTask(task.id) })
  await render()
  expect(update).toHaveBeenCalledTimes(1)
  expect(useTaskStore.getState().tasks[0].subTasks).toHaveLength(0)
  expect(container.querySelector('[data-mindmap-canvas]')).not.toBeNull()
})
