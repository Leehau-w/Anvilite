/** Local MCP contract. Never contains executable code or arbitrary storage/file access. */
export type McpDomain = 'tasks' | 'habits' | 'flows'
export interface McpAccess { read: boolean; write: boolean }
export type McpPermissions = Record<McpDomain, McpAccess>
export const NO_MCP_PERMISSIONS: McpPermissions = {
  tasks: { read: false, write: false }, habits: { read: false, write: false }, flows: { read: false, write: false },
}
export const READ_MCP_PERMISSIONS: McpPermissions = {
  tasks: { read: true, write: false }, habits: { read: true, write: false }, flows: { read: true, write: false },
}
export type McpMethod = 'get_context' | 'operations_get' |
  'tasks_list' | 'tasks_get' | 'tasks_create' | 'tasks_update' | 'tasks_action' |
  'habits_list' | 'habits_get' | 'habits_create' | 'habits_update' | 'habits_action' |
  'flows_list' | 'flows_get' | 'flows_create' | 'flows_update' | 'flows_action' |
  'flow_folders_list' | 'flow_folders_create'
export interface McpRequest { method: McpMethod; params: Record<string, unknown> }
export type McpResult = { ok: true; data: unknown } | { ok: false; error: { code: string; message: string; details?: unknown } }
export interface McpWireRequest { id: string; token: string; request: McpRequest }
export interface McpWireResponse { id: string; result: McpResult }
export interface McpConfiguration { enabled: boolean; permissions: McpPermissions }
export interface McpStatus extends McpConfiguration {
  clientConfig?: { command: string; args: string[]; env: Record<string, string> }
  ready: boolean; accountId: string | null; sessionId: string | null; pipe: string | null; token: string | null
}
export interface McpDispatch {
  bridgeId: string; sessionId: string; accountId: string; request: McpRequest; permissions: McpPermissions
}
export interface McpReply { bridgeId: string; sessionId: string; result: McpResult }
export interface McpRendererApi {
  mcpReady: (context: { accountId: string }) => Promise<McpStatus>
  mcpConfigure: (configuration: McpConfiguration) => Promise<McpStatus>
  mcpGetStatus: () => Promise<McpStatus>
  onMcpRequest: (handler: (dispatch: McpDispatch) => void) => () => void
  onMcpStatus: (handler: (status: McpStatus) => void) => () => void
  mcpValidate: (lease: { bridgeId: string; sessionId: string }) => Promise<boolean>
  mcpRespond: (reply: McpReply) => void
}
export interface McpToolDefinition {
  name: McpMethod; description: string; inputSchema: Record<string, unknown>;
  annotations: { readOnlyHint: boolean; destructiveHint: boolean; idempotentHint: boolean; openWorldHint: false }
}
const string = { type: 'string', minLength: 1, maxLength: 4096 }
const id = { type: 'string', minLength: 1, maxLength: 128 }
const version = { type: 'string', minLength: 1, maxLength: 256 }
const requestId = { type: 'string', minLength: 8, maxLength: 128, description: 'Unique operation ID. Reuse only for an identical retry; never replace after an unknown outcome.' }
const record = { type: 'object', additionalProperties: true }
function object(properties: Record<string, unknown>, required: string[] = []) {
  return { type: 'object', properties, required, additionalProperties: false }
}
function tool(name: McpMethod, description: string, inputSchema: Record<string, unknown>, readOnlyHint = true): McpToolDefinition {
  return { name, description, inputSchema, annotations: { readOnlyHint, destructiveHint: !readOnlyHint, idempotentHint: true, openWorldHint: false } }
}
const write = { requestId, expectedVersion: version }
const lists = { query: { ...string, maxLength: 1000 }, category: id, status: id, limit: { type: 'integer', minimum: 1, maximum: 100 }, cursor: string, includeDeleted: { type: 'boolean' } }
export const MCP_TOOLS: McpToolDefinition[] = [
 tool('get_context', 'Read connected account/session, granted permissions, local date, capability and collection versions. Read this before using other tools. The desktop application must remain open.', object({})),
 tool('operations_get', 'Read the durable receipt for a previous requestId. A pending/unknown outcome must be inspected, never repeated with a new requestId.', object({ requestId }, ['requestId'])),
 ...(['tasks','habits','flows'] as const).flatMap(domain => [
  tool((domain + '_list') as McpMethod, 'Read ' + domain + ' with filters and bounded pagination. Returns collectionVersion; cursors are invalidated by changes.', object(lists)),
  tool((domain + '_get') as McpMethod, 'Read one ' + domain + ' record and its full-content version before editing. Includes nested steps/checklists.', object({ id }, ['id'])),
  tool((domain + '_create') as McpMethod, 'Create one ' + domain + ' record using the allowed content fields. expectedVersion is the collectionVersion from a fresh read. Requires write permission and a durable requestId.', object({ ...write, record }, ['requestId','expectedVersion','record']), false),
  tool((domain + '_update') as McpMethod, 'Update explicit editable content fields only. Never writes status, IDs, history or cycle counters. expectedVersion is the record version from get. A conflict requires rereading.', object({ ...write, id, patch: record }, ['requestId','expectedVersion','id','patch']), false),
  tool((domain + '_action') as McpMethod, 'Perform an explicit business action on ' + domain + '. Returns the recorded action result; identical retries return the original result without re-execution. Read again for current state.', object({ ...write, id, action: { type:'string', enum: domain === 'tasks' ? ['complete','undo','wait','resume','start','pause','delete','restore','timer_start','timer_pause','timer_stop'] : domain === 'habits' ? ['complete','skip','undo','pause','resume','archive','delete','restore','timer_start','timer_pause'] : ['delete','copy','move','instantiate'], }, targetFolderId: id, taskCollectionVersion: version }, ['requestId','expectedVersion','id','action']), false),
 ]),
 tool('flow_folders_list', 'Read the current resolved flow folder tree and its collection version, including editable system templates.', object({})),
 tool('flow_folders_create', 'Create a flow folder. expectedVersion is the flow folder collection version. Parent is optional.', object({ ...write, name: { ...string, maxLength: 200 }, parentId: id }, ['requestId','expectedVersion','name']), false),
]
// Explicit content schemas are discoverable; business validation repeats these checks in the app.
const title = { type: 'string', minLength: 1, maxLength: 500 }
const nullableDate = { anyOf: [{ type:'string', pattern:'^\\d{4}-\\d{2}-\\d{2}$' }, { type:'null' }] }
const boundedMinutes = { type:'number', minimum:0, maximum:1e9 }
const taskContent = {
 title, category: { ...id, maxLength:200 }, description: { type:'string', maxLength:20000 },
 priority: { type:'string', enum:['urgent','high','medium','low'] }, difficulty: { type:'integer', minimum:1, maximum:5 },
 dueDate: nullableDate, backgroundColor: { anyOf:[{type:'string',pattern:'^#[0-9a-fA-F]{6}$'},{type:'null'}] },
 actualMinutes: boundedMinutes, tags: {type:'array',maxItems:32,uniqueItems:true,items:{type:'string',minLength:1,maxLength:100}},
}
const habitContent = {
 title, category: { ...id, maxLength:200 }, description: { type:'string',maxLength:20000 },
 difficulty: {type:'integer',minimum:1,maximum:5}, actualMinutes:boundedMinutes, estimatedMinutes:boundedMinutes,
 repeatType:{type:'string',enum:['daily','weekdays','weekly','biweekly','monthly','custom','monthly_fixed']},
 customIntervalDays:{anyOf:[{type:'integer',minimum:1,maximum:3660},{type:'null'}]},
 weeklyDays:{anyOf:[{type:'array',maxItems:7,uniqueItems:true,items:{type:'integer',minimum:1,maximum:7}},{type:'null'}]},
 weeklyMode:{anyOf:[{type:'string',enum:['strict','flexible']},{type:'null'}]},
 weeklyFlexibleCount:{anyOf:[{type:'integer',minimum:1,maximum:7},{type:'null'}]},
 monthlyDays:{anyOf:[{type:'array',maxItems:32,uniqueItems:true,items:{type:'integer',enum:[-1,...Array.from({length:31},(_,i)=>i+1)]}},{type:'null'}]},
 targetCount:{type:'integer',minimum:1,maximum:1000}, startDate:{type:'string',pattern:'^\\d{4}-\\d{2}-\\d{2}$'},
 endDate:nullableDate, reminderTime:{anyOf:[{type:'string',pattern:'^([01]\\d|2[0-3]):[0-5]\\d$'},{type:'null'}]},
}
function stepContent(depth: number): Record<string, unknown> {
 return object({ id, title, content:{anyOf:[{type:'object'},{type:'null'}]}, time:{anyOf:[{type:'string',maxLength:100},{type:'null'}]},
 sortOrder:{type:'number'}, childSteps:{type:'array',maxItems:depth < 2 ? 100 : 0,...(depth < 2 ? {items:stepContent(depth+1)} : {})} }, ['title'])
}
function stepPatchContent(depth: number): Record<string, unknown> {
 return { ...object({ id, title, content:{anyOf:[{type:'object'},{type:'null'}]}, time:{anyOf:[{type:'string',maxLength:100},{type:'null'}]},
 childSteps:{type:'array',maxItems:depth < 2 ? 100 : 0,...(depth < 2 ? {items:stepPatchContent(depth+1)} : {})} }),
 anyOf:[{required:['id']},{required:['title']}] }
}
const flowContent = { title, folderId:id, displayStyle:{type:'string',enum:['numbered','bullet','timeline']}, steps:{type:'array',maxItems:100,items:stepContent(0)} }
for (const definition of MCP_TOOLS) {
 const schema = definition.inputSchema as { properties:Record<string,unknown> }
 if (definition.name.endsWith('_create') || definition.name.endsWith('_update')) {
  const create = definition.name.endsWith('_create')
  const domain = definition.name.split('_')[0]
  const fields = domain === 'tasks' ? taskContent : domain === 'habits' ? habitContent : domain === 'flows' ? flowContent : null
  if (fields) {
   const { folderId: _folderId, ...flowEditable } = flowContent
   const effective = domain === 'flows' && !create ? { ...flowEditable, steps:{type:'array',maxItems:100,items:stepPatchContent(0),description:'Merge by existing step ID. Omitted fields, children and siblings are preserved. Omit ID to append a new step. Does not implicitly delete, reorder or move existing steps.'} } : fields
   schema.properties[create ? 'record' : 'patch'] = { ...object(effective,create ? domain === 'flows' ? ['title','folderId'] : ['title'] : []), ...(create ? {} : {minProperties:1}) }
   if (domain === 'flows' && !create) definition.description += ' Step patches merge by stable ID; omitted content and steps are kept. New steps omit ID and append. Do not use this tool to delete or reorder steps. To move a flow, use flows_action move with targetFolderId; system template moves create independent copies.'
  }
 }
}
export function mcpToolAccess(method: string): { domain: McpDomain; write: boolean } | null {
 const domain = method.startsWith('tasks_') ? 'tasks' : method.startsWith('habits_') ? 'habits' : method.startsWith('flows_') || method.startsWith('flow_folders_') ? 'flows' : null
 if (!domain) return null
 return { domain, write: !method.endsWith('_list') && !method.endsWith('_get') }
}
export function mcpFailure(code: string, message: string, details?: unknown): McpResult {
 return { ok: false, error: { code, message, ...(details === undefined ? {} : { details }) } }
}
