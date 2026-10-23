import type { MindMapNode, MindMapTitleEdit } from '@/types/mindMap'
import type { SubTask, Task } from '@/types/task'
import { generateId } from './id'

export const MAX_MIND_MAP_SUBTASK_LEVELS = 3
export class MindMapTaskDepthError extends Error {
  constructor() { super('mindmap_task_depth_exceeded'); this.name = 'MindMapTaskDepthError' }
}
export class MindMapTaskTitleConflictError extends Error {
  constructor() { super('mindmap_task_title_conflict'); this.name = 'MindMapTaskTitleConflictError' }
}
export function isMindMapTaskDepthError(error: unknown): error is MindMapTaskDepthError {
  return error instanceof MindMapTaskDepthError
}
export function isMindMapTaskTitleConflictError(error: unknown): error is MindMapTaskTitleConflictError {
  return error instanceof MindMapTaskTitleConflictError
}
export function findMindMapSubTask(subTasks: SubTask[], id: string): SubTask | undefined {
  for (const subTask of subTasks) {
    if (subTask.id === id) return subTask
    const found = findMindMapSubTask(subTask.subTasks, id)
    if (found) return found
  }
  return undefined
}
/** Titles and status are live projections; graph snapshots never own task fields. */
export function resolveMindMapNodeTask(node: MindMapNode, tasks: readonly Task[]): { task: Task; subTask?: SubTask } | null {
  if (!node.taskId) return null
  const task = tasks.find(task => task.id === node.taskId && !task.deletedAt)
  if (!task) return null
  if (!node.subTaskId) return { task }
  const subTask = findMindMapSubTask(task.subTasks, node.subTaskId)
  return subTask ? { task, subTask } : null
}
export function getMindMapNodeTitle(node: MindMapNode, tasks: readonly Task[]): string {
  const linked = resolveMindMapNodeTask(node, tasks)
  return linked?.subTask?.title ?? linked?.task.title ?? node.topic
}

export interface MindMapTaskPatch { before: Task; next: Task }
function subTaskDepth(subTasks: SubTask[], id: string, depth = 0): number | undefined {
  for (const subTask of subTasks) {
    if (subTask.id === id) return depth
    const found = subTaskDepth(subTask.subTasks, id, depth + 1)
    if (found !== undefined) return found
  }
  return undefined
}
function updateSubTask(subTasks: SubTask[], id: string, edit: (sub: SubTask) => SubTask): SubTask[] {
  return subTasks.map(sub => sub.id === id ? edit(sub) : { ...sub, subTasks: updateSubTask(sub.subTasks, id, edit) })
}
function sourcedSubTask(subTasks: SubTask[], mapId: string, nodeId: string): SubTask | undefined {
  for (const sub of subTasks) {
    if (sub.mindMapSource?.mapId === mapId && sub.mindMapSource.nodeId === nodeId) return sub
    const found = sourcedSubTask(sub.subTasks, mapId, nodeId)
    if (found) return found
  }
  return undefined
}
/** Preflight the entire conversion before any task or map is written. */
export function planMindMapTaskLinks(mapId: string, root: MindMapNode, tasks: Task[], titleEdits: MindMapTitleEdit[] = []) {
  const drafts = new Map<string, Task>()
  const sourceTasks = new Map(tasks.filter(task => !task.deletedAt).map(task => [task.id, task]))
  const draft = (id: string) => drafts.get(id) ?? sourceTasks.get(id)
  const nodes = new Map<string, MindMapNode>()
  const collect = (node: MindMapNode) => { nodes.set(node.id, node); node.children?.forEach(collect) }
  collect(root)
  const edited = new Set<string>()
  for (const edit of titleEdits) {
    const node = nodes.get(edit.nodeId)
    if (!node || edited.has(edit.nodeId) || node.topic !== edit.title || !edit.title.trim()) throw new MindMapTaskTitleConflictError()
    edited.add(edit.nodeId)
    const linked = resolveMindMapNodeTask(node, tasks)
    if (!node.taskId) continue
    if (!linked || (linked.subTask?.title ?? linked.task.title) !== edit.previousTitle) throw new MindMapTaskTitleConflictError()
    const task = draft(linked.task.id)!
    const title = edit.title.trim()
    if (linked.subTask) {
      const current = findMindMapSubTask(task.subTasks, linked.subTask.id)!
      if (current.title !== linked.subTask.title && current.title !== title) throw new MindMapTaskTitleConflictError()
      drafts.set(task.id, { ...task, subTasks: updateSubTask(task.subTasks, current.id, sub => ({ ...sub, title })) })
    } else {
      if (task.title !== linked.task.title && task.title !== title) throw new MindMapTaskTitleConflictError()
      drafts.set(task.id, { ...task, title })
    }
  }
  type Owner = { taskId: string; subTaskId?: string }
  const visit = (node: MindMapNode, inherited?: Owner): MindMapNode => {
    let owner = inherited
    let next = node
    if (node.taskId) {
      const task = draft(node.taskId)
      owner = task && (!node.subTaskId || findMindMapSubTask(task.subTasks, node.subTaskId))
        ? { taskId: task.id, ...(node.subTaskId ? { subTaskId: node.subTaskId } : {}) } : undefined
    } else if (owner) {
      let task = draft(owner.taskId)!
      let sub = sourcedSubTask(task.subTasks, mapId, node.id)
      if (!sub) {
        const parentDepth = owner.subTaskId ? subTaskDepth(task.subTasks, owner.subTaskId) : -1
        if (parentDepth === undefined) throw new MindMapTaskTitleConflictError()
        if (parentDepth + 1 >= MAX_MIND_MAP_SUBTASK_LEVELS) throw new MindMapTaskDepthError()
        const siblings = owner.subTaskId ? findMindMapSubTask(task.subTasks, owner.subTaskId)!.subTasks : task.subTasks
        sub = { id: generateId(), title: node.topic.trim(), completed: task.status === 'done',
          sortOrder: siblings.length, subTasks: [], createdAt: new Date().toISOString(), mindMapSource: { mapId, nodeId: node.id } }
        const created = sub
        task = { ...task, subTasks: owner.subTaskId
          ? updateSubTask(task.subTasks, owner.subTaskId, parent => ({ ...parent, subTasks: [...parent.subTasks, created] }))
          : [...task.subTasks, created] }
        drafts.set(task.id, task)
      }
      owner = { taskId: task.id, subTaskId: sub.id }
      next = { ...node, taskId: task.id, subTaskId: sub.id }
    }
    const children = node.children?.map(child => visit(child, owner))
    return children ? { ...next, children } : next
  }
  const plannedRoot = visit(root)
  const patches: MindMapTaskPatch[] = []
  for (const [id, next] of drafts) {
    const before = sourceTasks.get(id)!
    if (next.title !== before.title || JSON.stringify(next.subTasks) !== JSON.stringify(before.subTasks)) patches.push({ before, next })
  }
  return { root: plannedRoot, patches }
}
/** Merge only additions and explicit title changes into the latest task children. */
export function mergeMindMapTaskPatch(patch: MindMapTaskPatch, current: Task): Pick<Task, 'title' | 'subTasks'> {
  const { before, next } = patch
  if (next.title !== before.title && current.title !== before.title && current.title !== next.title) throw new MindMapTaskTitleConflictError()
  const allCurrentIds = new Set<string>()
  const collect = (subs: SubTask[]) => subs.forEach(sub => { allCurrentIds.add(sub.id); collect(sub.subTasks) })
  collect(current.subTasks)
  const merge = (oldSubs: SubTask[], plannedSubs: SubTask[], currentSubs: SubTask[]): SubTask[] => {
    let changed = false
    const result = currentSubs.map(sub => {
      const old = oldSubs.find(item => item.id === sub.id)
      const planned = plannedSubs.find(item => item.id === sub.id)
      if (!old || !planned) return sub
      const titleChanged = old.title !== planned.title
      if (titleChanged && sub.title !== old.title && sub.title !== planned.title) throw new MindMapTaskTitleConflictError()
      const children = merge(old.subTasks, planned.subTasks, sub.subTasks)
      if (titleChanged || children !== sub.subTasks) {
        changed = true
        return { ...sub, ...(titleChanged ? { title: planned.title } : {}), subTasks: children }
      }
      return sub
    })
    for (const planned of plannedSubs) {
      const old = oldSubs.find(item => item.id === planned.id)
      if (!old && !allCurrentIds.has(planned.id)) { result.push(planned); allCurrentIds.add(planned.id); changed = true }
      if (old && !currentSubs.some(item => item.id === old.id) && JSON.stringify(old) !== JSON.stringify(planned)) throw new MindMapTaskTitleConflictError()
    }
    return changed ? result : currentSubs
  }
  return { title: next.title === before.title ? current.title : next.title,
    subTasks: merge(before.subTasks, next.subTasks, current.subTasks) }
}
/** Compensate only unchanged fields introduced by this operation; retain later user edits. */
export function undoMindMapTaskPatch(before: Task, written: Task, current: Task, protectedSubTaskIds: ReadonlySet<string> = new Set()): Partial<Task> {
  const retainedReference = (sub: SubTask): boolean => protectedSubTaskIds.has(sub.id) || sub.subTasks.some(retainedReference)
  const undo = (oldSubs: SubTask[], writtenSubs: SubTask[], currentSubs: SubTask[]): SubTask[] => {
    let changed = false
    const result: SubTask[] = []
    for (const sub of currentSubs) {
      const saved = writtenSubs.find(item => item.id === sub.id)
      const old = oldSubs.find(item => item.id === sub.id)
      if (!saved) { result.push(sub); continue }
      if (!old) {
        if (sub === saved && !retainedReference(sub)) { changed = true; continue }
        result.push(sub); continue
      }
      const children = undo(old.subTasks, saved.subTasks, sub.subTasks)
      const title = old.title !== saved.title && sub.title === saved.title ? old.title : sub.title
      if (children !== sub.subTasks || title !== sub.title) { result.push({ ...sub, title, subTasks: children }); changed = true }
      else result.push(sub)
    }
    return changed ? result : currentSubs
  }
  return { ...(before.title !== written.title && current.title === written.title ? { title: before.title } : {}),
    ...(current.subTasks !== before.subTasks ? { subTasks: undo(before.subTasks, written.subTasks, current.subTasks) } : {}),
    ...(current.updatedAt === written.updatedAt ? { updatedAt: before.updatedAt } : {}) }
}
