import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { MindMapDocument, MindMapNode, MindMapState, MindMapTitleEdit } from '@/types/mindMap'
import { cloneMindMapNode, findMindMapNode, isValidMindMapNode, isValidMindMapState,
  MAX_MIND_MAPS, MAX_MIND_MAP_TOPIC_LENGTH } from '@/types/mindMap'
import { assertAccountBindingCurrent, getStoragePrefix } from './accountManager'
import { useTaskStore } from './taskStore'
import type { Task } from '@/types/task'
import { MindMapUndoHistory, changedTaskTitles, planUndoTaskTitles } from '@/utils/mindMapUndo'
import { generateId } from '@/utils/id'
import { MindMapTaskTitleConflictError, getMindMapNodeTitle, resolveMindMapNodeTask, planMindMapTaskLinks, mergeMindMapTaskPatch, undoMindMapTaskPatch } from '@/utils/mindMapTaskLinks'

export interface MindMapStore extends MindMapState {
  createMap: (title: string) => MindMapDocument | null
  renameMap: (id: string, title: string) => boolean
  deleteMap: (id: string) => boolean
  selectMap: (id: string | null) => boolean
  updateMapTree: (id: string, root: MindMapNode, expectedRevision: number, titleEdits?: MindMapTitleEdit[], recordUndo?: boolean) => boolean
  undoMap: (id: string) => boolean
  linkTask: (mapId: string, nodeId: string, taskId: string) => boolean
  unlinkTask: (mapId: string, nodeId: string) => boolean
  convertNodeToTask: (mapId: string, nodeId: string) => string | null
}

function validTitle(value: unknown): value is string {
  return typeof value === 'string' && !!value.trim() && value.length <= MAX_MIND_MAP_TOPIC_LENGTH
}
function editNode(root: MindMapNode, id: string, edit: (node: MindMapNode) => MindMapNode): MindMapNode {
  if (root.id === id) return edit(root)
  if (!root.children) return root
  let changed = false
  const children = root.children.map(child => {
    const next = editNode(child, id, edit)
    if (next !== child) changed = true
    return next
  })
  return changed ? { ...root, children } : root
}
function hasReference(root: MindMapNode, taskId: string): boolean {
  return root.taskId === taskId || !!root.children?.some(child => hasReference(child, taskId))
}
const converting = new Set<string>()

export const useMindMapStore = create<MindMapStore>()(
  persist(
    (set, get) => {
      const history = new MindMapUndoHistory()
      const commitMap = (previous: MindMapDocument, next: MindMapDocument,
        undoRoot?: (current: MindMapNode) => MindMapNode,
        options: { titles?: ReturnType<typeof changedTaskTitles>; history?: 'record' | 'clear' | 'undo' } = {}) => {
        try {
          set(state => ({ maps: state.maps.map(map => map.id === previous.id ? next : map) }))
        } catch (error) {
          // Persist updates memory first. Restore only this operation's unchanged fields.
          const current = get().maps.find(map => map.id === previous.id)
          if (current) {
            const restored = { ...current }
            if (current.root === next.root) restored.root = previous.root
            else if (undoRoot) restored.root = undoRoot(current.root)
            if (current.title === next.title) restored.title = previous.title
            if (current.updatedAt === next.updatedAt) restored.updatedAt = previous.updatedAt
            if (current.revision === next.revision) restored.revision = previous.revision
            try { set(state => ({ maps: state.maps.map(map => map.id === previous.id ? restored : map) })) }
            catch { /* The memory rollback still applies if persistent storage stays unavailable. */ }
          }
          history.rebind(previous, get().maps.find(map => map.id === previous.id))
          throw error
        }
        if (get().maps.find(map => map.id === next.id) !== next || options.history === 'clear') history.clear(next.id)
        else if (options.history !== 'undo') history.record(previous, next, options.titles)
      }
      const commitLinkedTree = (previous: MindMapDocument, root: MindMapNode,
        title: string, titleEdits: MindMapTitleEdit[] = [], recordUndo = true): boolean => {
        if (previous.revision >= Number.MAX_SAFE_INTEGER) return false
        const plan = planMindMapTaskLinks(previous.id, root, useTaskStore.getState().tasks, titleEdits)
        const written: { before: Task; after: Task }[] = []
        const rollback = () => {
          for (const entry of [...written].reverse()) {
            const current = useTaskStore.getState().tasks.find(task => task.id === entry.before.id)
            if (!current) continue
            const retained = new Set<string>()
            const collect = (node: MindMapNode) => {
              if (node.taskId === current.id && node.subTaskId) retained.add(node.subTaskId)
              node.children?.forEach(collect)
            }
            get().maps.forEach(map => collect(map.root))
            const patch = undoMindMapTaskPatch(entry.before, entry.after, current, retained)
            try { useTaskStore.setState(state => ({ tasks: state.tasks.map(task => task.id === current.id ? { ...task, ...patch } : task) })) }
            catch { /* Persistence updates memory first; retain the compensated task in memory. */ }
          }
        }
        try {
          for (const patch of plan.patches) {
            const current = useTaskStore.getState().tasks.find(task => task.id === patch.before.id && !task.deletedAt)
            if (!current) { rollback(); return false }
            const merged = mergeMindMapTaskPatch(patch, current)
            const entry = { before: current, after: { ...current, ...merged } }
            written.push(entry)
            // Capture this write even if storage throws after Zustand has updated memory.
            const unsubscribe = useTaskStore.subscribe(state => {
              const value = state.tasks.find(task => task.id === current.id)
              if (value?.title === merged.title && value.subTasks === merged.subTasks) entry.after = value
            })
            try { useTaskStore.getState().updateTask(current.id, merged) } finally { unsubscribe() }
          }
          const latest = get().maps.find(map => map.id === previous.id)
          if (!latest || latest.revision !== previous.revision) { rollback(); return false }
          if (JSON.stringify(plan.root) === JSON.stringify(previous.root) && title === previous.title) return true
          const next = { ...previous, title, root: plan.root, revision: previous.revision + 1, updatedAt: new Date().toISOString() }
          commitMap(previous, next, undefined, { titles: changedTaskTitles(written), history: recordUndo ? 'record' : 'clear' })
          return true
        } catch (error) { rollback(); throw error }
      }
      const replaceReference = (mapId: string, nodeId: string, taskId: string | undefined): boolean => {
        const previous = get().maps.find(map => map.id === mapId)
        const node = previous && findMindMapNode(previous.root, nodeId)
        if (!previous || !node || node.subTaskId) return false
        if (previous.revision >= Number.MAX_SAFE_INTEGER) return false
        const tasks = useTaskStore.getState().tasks
        // Replacing/unlinking an owner detaches dependent references, never their actual children.
        const detach = (child: MindMapNode): MindMapNode => {
          if (child.taskId && (!child.subTaskId || child.taskId !== node.taskId)) return child
          const { taskId: _task, subTaskId: _sub, ...rest } = child
          return { ...rest, topic: getMindMapNodeTitle(child, tasks),
            ...(child.children ? { children: child.children.map(detach) } : {}) }
        }
        const root = editNode(previous.root, nodeId, current => {
          const { taskId: _task, subTaskId: _sub, ...rest } = current
          return { ...rest, topic: taskId ? current.topic : getMindMapNodeTitle(current, tasks), ...(taskId ? { taskId } : {}),
            ...(current.children ? { children: node.taskId && node.taskId !== taskId ? current.children.map(detach) : current.children } : {}) }
        })
        return commitLinkedTree(previous, root, previous.title)
      }
      return {
        maps: [], selectedMapId: null,
        createMap: title => {
          assertAccountBindingCurrent()
          if (!validTitle(title) || get().maps.length >= MAX_MIND_MAPS) return null
          const now = new Date().toISOString()
          const map: MindMapDocument = { id: generateId(), title: title.trim(),
            root: { id: generateId(), topic: title.trim(), children: [] }, createdAt: now, updatedAt: now, revision: 0 }
          const previousSelection = get().selectedMapId
          try { set(state => ({ maps: [...state.maps, map], selectedMapId: map.id })) }
          catch (error) {
            try { set(state => ({ maps: state.maps.filter(current => current !== map),
              selectedMapId: state.selectedMapId === map.id ? previousSelection : state.selectedMapId })) }
            catch { /* Retain memory consistency during a persistent storage failure. */ }
            throw error
          }
          return map
        },
        renameMap: (id, title) => {
          assertAccountBindingCurrent()
          const previous = get().maps.find(map => map.id === id)
          if (!previous || !validTitle(title)) return false
          const value = title.trim()
          if (previous.title === value && (previous.root.taskId || previous.root.topic === value)) return true
          if (previous.revision >= Number.MAX_SAFE_INTEGER) return false
          const next = { ...previous, title: value, root: previous.root.taskId ? previous.root : { ...previous.root, topic: value },
            revision: previous.revision + 1, updatedAt: new Date().toISOString() }
          commitMap(previous, next, root => root.topic === value ? { ...root, topic: previous.root.topic } : root)
          return true
        },
        deleteMap: id => {
          assertAccountBindingCurrent()
          const previous = get().maps.find(map => map.id === id)
          if (!previous) return false
          const previousIndex = get().maps.indexOf(previous)
          const previousSelection = get().selectedMapId
          const remaining = get().maps.filter(map => map.id !== id)
          const nextSelection = previousSelection === id ? remaining[0]?.id ?? null : previousSelection
          try { set({ maps: remaining, selectedMapId: nextSelection }) }
          catch (error) {
            try { set(state => {
              const maps = [...state.maps]
              if (!maps.some(map => map.id === id)) maps.splice(Math.min(previousIndex, maps.length), 0, previous)
              return { maps, selectedMapId: state.selectedMapId === nextSelection ? previousSelection : state.selectedMapId }
            }) } catch { /* Retain the removed document in memory when persistence fails. */ }
            throw error
          }
          history.clear(id)
          return true
        },
        selectMap: id => {
          assertAccountBindingCurrent()
          if (id !== null && !get().maps.some(map => map.id === id)) return false
          const previous = get().selectedMapId
          if (previous === id) return true
          try { set({ selectedMapId: id }) }
          catch (error) {
            if (get().selectedMapId === id) {
              try { set({ selectedMapId: previous }) } catch { /* Memory is still restored. */ }
            }
            throw error
          }
          return true
        },
        updateMapTree: (id, root, expectedRevision, titleEdits = [], recordUndo = true) => {
          assertAccountBindingCurrent()
          const previous = get().maps.find(map => map.id === id)
          if (!previous || previous.revision !== expectedRevision || !isValidMindMapNode(root) || root.id !== previous.root.id) return false
          // The canvas owns structure/text; current business links are restored by stable node ID.
          const references = new Map<string, Pick<MindMapNode, 'taskId' | 'subTaskId'>>()
          const collect = (node: MindMapNode) => {
            if (node.taskId) references.set(node.id, { taskId: node.taskId, ...(node.subTaskId ? { subTaskId: node.subTaskId } : {}) })
            node.children?.forEach(collect)
          }
          collect(previous.root)
          const sanitize = (node: MindMapNode): MindMapNode => ({ id: node.id, topic: node.topic,
            ...(node.expanded !== undefined ? { expanded: node.expanded } : {}),
            ...(node.direction !== undefined ? { direction: node.direction } : {}),
            ...references.get(node.id),
            ...(node.children !== undefined ? { children: node.children.map(sanitize) } : {}) })
          const clean = sanitize(root)
          return commitLinkedTree(previous, clean, clean.taskId ? previous.title : clean.topic, titleEdits, recordUndo)
        },
        undoMap: id => {
          assertAccountBindingCurrent()
          const previous = get().maps.find(map => map.id === id)
          if (!previous || previous.revision >= Number.MAX_SAFE_INTEGER) return false
          const entry = history.peek(previous)
          if (!entry) return false
          const patches = planUndoTaskTitles(entry.titles, useTaskStore.getState().tasks)
          const written: Array<{ before: Task; after: Task }> = []
          const rollback = () => {
            for (const write of [...written].reverse()) {
              const current = useTaskStore.getState().tasks.find(task => task.id === write.before.id)
              if (!current) continue
              const patch = undoMindMapTaskPatch(write.before, write.after, current)
              try { useTaskStore.setState(state => ({ tasks: state.tasks.map(task => task.id === current.id ? { ...task, ...patch } : task) })) }
              catch { /* Persist updates memory first; preserve compensated titles for retry. */ }
            }
          }
          try {
            for (const patch of patches) {
              const current = useTaskStore.getState().tasks.find(task => task.id === patch.before.id && !task.deletedAt)
              if (!current) throw new MindMapTaskTitleConflictError()
              const merged = mergeMindMapTaskPatch(patch, current)
              const write = { before: current, after: { ...current, ...merged } }
              written.push(write)
              const unsubscribe = useTaskStore.subscribe(state => {
                const value = state.tasks.find(task => task.id === current.id)
                if (value?.title === merged.title && value.subTasks === merged.subTasks) write.after = value
              })
              try { useTaskStore.getState().updateTask(current.id, merged) } finally { unsubscribe() }
            }
            if (get().maps.find(map => map.id === id) !== previous) throw new MindMapTaskTitleConflictError()
            const next = { ...previous, title: entry.map.title, root: cloneMindMapNode(entry.map.root),
              revision: previous.revision + 1, updatedAt: new Date().toISOString() }
            commitMap(previous, next, undefined, { history: 'undo' })
            history.applied(id, entry, next)
            return true
          } catch (error) { rollback(); throw error }
        },
        linkTask: (mapId, nodeId, taskId) => {
          assertAccountBindingCurrent()
          const task = useTaskStore.getState().tasks.find(task => task.id === taskId && !task.deletedAt)
          return !!task && replaceReference(mapId, nodeId, task.id)
        },
        unlinkTask: (mapId, nodeId) => {
          assertAccountBindingCurrent()
          return replaceReference(mapId, nodeId, undefined)
        },
        convertNodeToTask: (mapId, nodeId) => {
          assertAccountBindingCurrent()
          const map = get().maps.find(map => map.id === mapId)
          const node = map && findMindMapNode(map.root, nodeId)
          if (!map || !node || !validTitle(node.topic)) return null
          if (node.taskId) {
            const task = useTaskStore.getState().tasks.find(task => task.id === node.taskId && !task.deletedAt)
            return task && (!node.subTaskId || resolveMindMapNodeTask(node, [task])) ? node.taskId : null
          }
          if (map.revision >= Number.MAX_SAFE_INTEGER) return null
          const lock = JSON.stringify([mapId, nodeId])
          if (converting.has(lock)) return null
          // A task write may survive when storage also rejects compensating writes.
          // Its durable origin makes retry after a reload reuse that task instead of duplicating it.
          const sourced = useTaskStore.getState().tasks.filter(task => task.mindMapSource?.mapId === mapId && task.mindMapSource.nodeId === nodeId)
          const recoverable = sourced.find(task => !task.deletedAt)
          if (recoverable) return replaceReference(mapId, nodeId, recoverable.id) ? recoverable.id : null
          if (sourced.length) return null
          converting.add(lock)
          const taskId = generateId()
          const previousTasks = useTaskStore.getState().tasks
          const previousCategory = useTaskStore.getState().lastCategory
          let created: Task | undefined
          const unsubscribe = useTaskStore.subscribe(state => {
            created ??= state.tasks.find(task => task.id === taskId)
          })
          const rollbackTask = () => {
            if (!created || get().maps.some(current => hasReference(current.root, taskId))) return
            const current = useTaskStore.getState()
            // A later edit or deliberate association makes this task independently owned.
            if (current.tasks.find(task => task.id === taskId) !== created) return
            const onlyOwnChange = current.tasks.length === previousTasks.length + 1 &&
              previousTasks.every(task => current.tasks.includes(task))
            try { useTaskStore.setState({ tasks: current.tasks.filter(task => task.id !== taskId),
              ...(onlyOwnChange && current.lastCategory === created.category ? { lastCategory: previousCategory } : {}) }) }
            catch { /* Zustand has already restored memory; report the original write failure. */ }
          }
          try {
            const candidate = { id: taskId, title: node.topic.trim(), status: 'todo', deletedAt: null, subTasks: [] } as unknown as Task
            const conversion = planMindMapTaskLinks(mapId, { ...cloneMindMapNode(node), taskId }, [...useTaskStore.getState().tasks, candidate])
            const children = conversion.patches.find(patch => patch.before.id === taskId)?.next.subTasks ?? []
            created = useTaskStore.getState().addTask({ id: taskId, title: node.topic.trim(), category: previousCategory, dueDate: null,
              subTasks: children, mindMapSource: { mapId, nodeId } })
            const latest = get().maps.find(current => current.id === mapId)
            if (!latest || latest.revision !== map.revision || findMindMapNode(latest.root, nodeId)?.taskId) {
              rollbackTask()
              return null
            }
            if (!replaceReference(mapId, nodeId, taskId)) { rollbackTask(); return null }
            return taskId
          } catch (error) {
            rollbackTask()
            throw error
          } finally {
            unsubscribe()
            converting.delete(lock)
          }
        },
      }
    },
    {
      name: getStoragePrefix() + '-mind-maps', version: 1,
      partialize: state => ({ maps: state.maps, selectedMapId: state.selectedMapId }),
      merge: (persisted, current) => isValidMindMapState(persisted)
        ? { ...current, maps: persisted.maps.map(map => ({ ...map, root: cloneMindMapNode(map.root) })), selectedMapId: persisted.selectedMapId }
        : current,
    }
  )
)
