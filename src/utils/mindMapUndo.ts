import { cloneMindMapNode, type MindMapDocument } from '@/types/mindMap'
import type { Task, SubTask } from '@/types/task'
import { findMindMapSubTask, MindMapTaskTitleConflictError, type MindMapTaskPatch } from './mindMapTaskLinks'

interface TitleChange { taskId: string; subTaskId?: string; before: string; after: string }
export interface MindMapUndoEntry { map: MindMapDocument; titles: TitleChange[]; size: number }

export function changedTaskTitles(writes: Array<{ before: Task; after: Task }>): TitleChange[] {
  const titles: TitleChange[] = []
  for (const { before, after } of writes) {
    if (before.title !== after.title) titles.push({ taskId: before.id, before: before.title, after: after.title })
    const visit = (subs: SubTask[]) => subs.forEach(sub => {
      const next = findMindMapSubTask(after.subTasks, sub.id)
      if (next && sub.title !== next.title) titles.push({ taskId: before.id, subTaskId: sub.id, before: sub.title, after: next.title })
      visit(sub.subTasks)
    })
    visit(before.subTasks)
  }
  return titles
}

/** Revert explicit titles only; task status, time, children and later edits are preserved. */
export function planUndoTaskTitles(titles: TitleChange[], tasks: Task[]): MindMapTaskPatch[] {
  const drafts = new Map<string, Task>()
  for (const change of titles) {
    const task = drafts.get(change.taskId) ?? tasks.find(item => item.id === change.taskId && !item.deletedAt)
    const sub = task && change.subTaskId ? findMindMapSubTask(task.subTasks, change.subTaskId) : undefined
    if (!task || change.subTaskId && !sub) throw new MindMapTaskTitleConflictError()
    const value = sub?.title ?? task.title
    if (value !== change.after && value !== change.before) throw new MindMapTaskTitleConflictError()
    if (value === change.before) continue
    const edit = (subs: SubTask[]): SubTask[] => subs.map(item => item.id === change.subTaskId
      ? { ...item, title: change.before } : { ...item, subTasks: edit(item.subTasks) })
    drafts.set(task.id, sub ? { ...task, subTasks: edit(task.subTasks) } : { ...task, title: change.before })
  }
  return [...drafts].map(([id, next]) => ({ before: tasks.find(task => task.id === id)!, next }))
}

/** Per-map, session-only history, bounded across all documents and excluded from backups. */
export class MindMapUndoHistory {
  private maps = new Map<string, { current: MindMapDocument; entries: MindMapUndoEntry[] }>()
  clear(id: string) { this.maps.delete(id) }
  record(before: MindMapDocument, after: MindMapDocument, titles: TitleChange[] = []) {
    let history = this.maps.get(before.id)
    if (!history || history.current !== before) history = { current: after, entries: [] }
    const map = { ...before, root: cloneMindMapNode(before.root) }
    const size = JSON.stringify({ map, titles }).length
    history.entries.push({ map, titles, size })
    if (history.entries.length > 50) history.entries.shift()
    history.current = after
    this.maps.delete(before.id); this.maps.set(before.id, history)
    const total = () => [...this.maps.values()].reduce((n, value) => n + value.entries.reduce((s, entry) => s + entry.size, 0), 0)
    while (total() > 8 * 1024 * 1024) {
      const oldest = this.maps.keys().next().value!
      const value = this.maps.get(oldest)!
      value.entries.shift()
      if (!value.entries.length) this.maps.delete(oldest)
    }
  }
  rebind(previous: MindMapDocument, current: MindMapDocument | undefined) {
    const history = this.maps.get(previous.id)
    if (!history || history.current === current) return
    if (history.current === previous && current && JSON.stringify(previous) === JSON.stringify(current)) history.current = current
    else this.clear(previous.id)
  }
  peek(current: MindMapDocument): MindMapUndoEntry | undefined {
    const history = this.maps.get(current.id)
    if (!history) return
    if (history.current !== current) { this.clear(current.id); throw new MindMapTaskTitleConflictError() }
    return history.entries.at(-1)
  }
  applied(id: string, entry: MindMapUndoEntry, current: MindMapDocument) {
    const history = this.maps.get(id)
    if (history?.entries.at(-1) !== entry) { this.clear(id); return }
    history.entries.pop(); history.current = current
    if (!history.entries.length) this.clear(id)
  }
}
