import { describe, it, expect, beforeEach } from 'vitest'
import { useUIStore } from './uiStore'

// 每个 test 前重置 store 状态
beforeEach(() => {
  useUIStore.setState({ collapsedTaskIds: [] })
})

describe('uiStore — toggleTaskCollapse', () => {
  it('初始状态：没有任何 id 被收起', () => {
    expect(useUIStore.getState().collapsedTaskIds).toEqual([])
  })

  it('toggle 一次 → id 进入列表（收起）', () => {
    useUIStore.getState().toggleTaskCollapse('task-1')
    expect(useUIStore.getState().collapsedTaskIds).toContain('task-1')
  })

  it('toggle 两次 → id 移出列表（展开），幂等恢复', () => {
    useUIStore.getState().toggleTaskCollapse('task-1')
    useUIStore.getState().toggleTaskCollapse('task-1')
    expect(useUIStore.getState().collapsedTaskIds).not.toContain('task-1')
  })

  it('多个不同 id 互不影响', () => {
    useUIStore.getState().toggleTaskCollapse('task-1')
    useUIStore.getState().toggleTaskCollapse('task-2')
    const { collapsedTaskIds } = useUIStore.getState()
    expect(collapsedTaskIds).toContain('task-1')
    expect(collapsedTaskIds).toContain('task-2')
  })

  it('toggle 其中一个不影响另一个', () => {
    useUIStore.getState().toggleTaskCollapse('task-1')
    useUIStore.getState().toggleTaskCollapse('task-2')
    useUIStore.getState().toggleTaskCollapse('task-1') // 展开 task-1
    const { collapsedTaskIds } = useUIStore.getState()
    expect(collapsedTaskIds).not.toContain('task-1')
    expect(collapsedTaskIds).toContain('task-2')
  })
})

describe('uiStore — isTaskCollapsed', () => {
  it('未 toggle 过的 id → false', () => {
    expect(useUIStore.getState().isTaskCollapsed('task-x')).toBe(false)
  })

  it('toggle 一次后 → true', () => {
    useUIStore.getState().toggleTaskCollapse('task-x')
    expect(useUIStore.getState().isTaskCollapsed('task-x')).toBe(true)
  })

  it('toggle 两次后 → false', () => {
    useUIStore.getState().toggleTaskCollapse('task-x')
    useUIStore.getState().toggleTaskCollapse('task-x')
    expect(useUIStore.getState().isTaskCollapsed('task-x')).toBe(false)
  })

  it('task id 与 subtask id 共用 store，互不冲突', () => {
    useUIStore.getState().toggleTaskCollapse('task-1')
    useUIStore.getState().toggleTaskCollapse('subtask-1')
    expect(useUIStore.getState().isTaskCollapsed('task-1')).toBe(true)
    expect(useUIStore.getState().isTaskCollapsed('subtask-1')).toBe(true)
    expect(useUIStore.getState().isTaskCollapsed('task-2')).toBe(false)
  })
})
