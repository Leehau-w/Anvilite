import { describe, it, expect } from 'vitest'
import type { Inspiration } from '@/types/inspiration'

// ── reorderInspirations 核心逻辑（从 store 提取） ─────────────────────────

function reorderInspirations(
  current: Inspiration[],
  ids: string[],
): Inspiration[] {
  const map = new Map(current.map((i) => [i.id, i]))
  const reordered = ids.map((id) => map.get(id)).filter(Boolean) as Inspiration[]
  const rest = current.filter((i) => !new Set(ids).has(i.id))
  return [...reordered, ...rest]
}

function makeItem(id: string, converted = false): Inspiration {
  return {
    id,
    content: `content-${id}`,
    createdAt: '2026-01-01T00:00:00Z',
    ...(converted ? { convertedTaskId: 'task-x' } : {}),
  }
}

describe('reorderInspirations', () => {
  it('按指定顺序重排', () => {
    const items = [makeItem('a'), makeItem('b'), makeItem('c')]
    const result = reorderInspirations(items, ['c', 'a', 'b'])
    expect(result.map((i) => i.id)).toEqual(['c', 'a', 'b'])
  })

  it('未在 ids 中的项（已转化）追加到末尾', () => {
    const converted = makeItem('x', true)
    const items = [makeItem('a'), makeItem('b'), converted]
    // 只重排未转化的
    const result = reorderInspirations(items, ['b', 'a'])
    expect(result.map((i) => i.id)).toEqual(['b', 'a', 'x'])
  })

  it('ids 中含不存在的 id 时静默忽略', () => {
    const items = [makeItem('a'), makeItem('b')]
    const result = reorderInspirations(items, ['b', 'ghost', 'a'])
    expect(result.map((i) => i.id)).toEqual(['b', 'a'])
  })

  it('空列表 → 返回空数组', () => {
    expect(reorderInspirations([], [])).toEqual([])
  })

  it('单项列表不变', () => {
    const items = [makeItem('a')]
    const result = reorderInspirations(items, ['a'])
    expect(result.map((i) => i.id)).toEqual(['a'])
  })

  it('原始顺序传入时内容不变', () => {
    const items = [makeItem('a'), makeItem('b'), makeItem('c')]
    const result = reorderInspirations(items, ['a', 'b', 'c'])
    expect(result.map((i) => i.id)).toEqual(['a', 'b', 'c'])
  })
})
