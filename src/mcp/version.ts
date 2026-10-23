/** Deterministic JSON for comparison; object insertion order is not a revision. */
export function canonicalJSON(value: unknown): string {
  const normalize = (item: unknown): unknown => {
    if (Array.isArray(item)) return item.map(value => normalize(value) ?? null)
    if (item && typeof item === 'object') {
      return Object.fromEntries(Object.keys(item).sort().flatMap(key => {
        const value = normalize((item as Record<string, unknown>)[key])
        return value === undefined ? [] : [[key, value]]
      }))
    }
    return typeof item === 'function' || item === undefined ? undefined : item
  }
  const json = JSON.stringify(normalize(value))
  if (json === undefined) throw new Error('invalid_json')
  return json
}

/** Includes the whole business record, rather than trusting millisecond timestamps. */
export async function versionOf(value: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(canonicalJSON(value))
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return 'v1:' + Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('')
}
