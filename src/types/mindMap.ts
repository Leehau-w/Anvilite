/** Only document data is persisted; task status and Mind Elixir view objects are projections. */
export interface MindMapNode {
  id: string
  topic: string
  expanded?: boolean
  children?: MindMapNode[]
  taskId?: string
  /** Owner task plus its stable recursive subtask identity. */
  subTaskId?: string
  direction?: 0 | 1
}

export interface MindMapTitleEdit {
  nodeId: string
  previousTitle: string
  title: string
}

export interface MindMapDocument {
  id: string
  title: string
  root: MindMapNode
  createdAt: string
  updatedAt: string
  revision: number
}

export interface MindMapTaskSource {
  mapId: string
  nodeId: string
}

export interface MindMapState {
  maps: MindMapDocument[]
  selectedMapId: string | null
}

export const MAX_MIND_MAP_DEPTH = 64
export const MAX_MIND_MAP_NODES = 5000
export const MAX_MIND_MAPS = 1000
export const MAX_MIND_MAP_TOPIC_LENGTH = 2000

function record(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}
function identifier(value: unknown): value is string {
  return typeof value === 'string' && !!value.trim() && value.length <= 128
}
function topic(value: unknown): value is string {
  return typeof value === 'string' && !!value.trim() && value.length <= MAX_MIND_MAP_TOPIC_LENGTH
}
function timestamp(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value) &&
    Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value
}

export function isValidMindMapTaskSource(value: unknown): value is MindMapTaskSource {
  return record(value) && Object.keys(value).length === 2 && identifier(value.mapId) && identifier(value.nodeId)
}

export function isValidMindMapNode(value: unknown): value is MindMapNode {
  const ids = new Set<string>()
  const objects = new Set<object>()
  let count = 0
  const visit = (candidate: unknown, depth: number): boolean => {
    if (!record(candidate) || depth > MAX_MIND_MAP_DEPTH || ++count > MAX_MIND_MAP_NODES ||
      objects.has(candidate) || !identifier(candidate.id) || ids.has(candidate.id) || !topic(candidate.topic)) return false
    objects.add(candidate)
    ids.add(candidate.id)
    if (candidate.expanded !== undefined && typeof candidate.expanded !== 'boolean' ||
      candidate.direction !== undefined && candidate.direction !== 0 && candidate.direction !== 1 ||
      candidate.taskId !== undefined && !identifier(candidate.taskId) ||
      candidate.subTaskId !== undefined && (!identifier(candidate.subTaskId) || !identifier(candidate.taskId))) return false
    return candidate.children === undefined || Array.isArray(candidate.children) && candidate.children.every(child => visit(child, depth + 1))
  }
  return visit(value, 0)
}

export function isValidMindMapDocument(value: unknown): value is MindMapDocument {
  return record(value) && identifier(value.id) && topic(value.title) && isValidMindMapNode(value.root) &&
    timestamp(value.createdAt) && timestamp(value.updatedAt) && Number.isSafeInteger(value.revision) && Number(value.revision) >= 0
}

export function isValidMindMapState(value: unknown): value is MindMapState {
  if (!record(value) || !Array.isArray(value.maps) || value.maps.length > MAX_MIND_MAPS) return false
  const ids = new Set<string>()
  for (const map of value.maps) {
    if (!isValidMindMapDocument(map) || ids.has(map.id)) return false
    ids.add(map.id)
  }
  return value.selectedMapId === null || typeof value.selectedMapId === 'string' && ids.has(value.selectedMapId)
}

/** Ignore transient parent pointers, HTML nodes, styles and derived task badges from the library. */
export function cloneMindMapNode(node: MindMapNode): MindMapNode {
  return {
    id: node.id, topic: node.topic,
    ...(node.expanded !== undefined ? { expanded: node.expanded } : {}),
    ...(node.direction !== undefined ? { direction: node.direction } : {}),
    ...(node.taskId !== undefined ? { taskId: node.taskId } : {}),
    ...(node.subTaskId !== undefined ? { subTaskId: node.subTaskId } : {}),
    ...(node.children !== undefined ? { children: node.children.map(cloneMindMapNode) } : {}),
  }
}

export function findMindMapNode(root: MindMapNode, id: string): MindMapNode | undefined {
  if (root.id === id) return root
  for (const child of root.children ?? []) {
    const found = findMindMapNode(child, id)
    if (found) return found
  }
  return undefined
}
