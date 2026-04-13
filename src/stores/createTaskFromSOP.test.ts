import { describe, it, expect, beforeEach } from 'vitest'
import type { SOPStep } from '@/types/sop'
import type { SubTask } from '@/types/task'

// Pure helper extracted from taskStore for testability
function mapStepToSubTask(step: SOPStep, index: number): SubTask {
  const now = '2026-01-01T00:00:00.000Z'
  return {
    id: `sub-${index}`,
    title: step.title,
    completed: false,
    sortOrder: index,
    subTasks: step.childSteps.map((child, ci) => ({
      id: `sub-${index}-${ci}`,
      title: child.title,
      completed: false,
      sortOrder: ci,
      subTasks: [],
      createdAt: now,
    })),
    createdAt: now,
  }
}

function makeStep(title: string, childSteps: SOPStep[] = []): SOPStep {
  return {
    id: title,
    title,
    note: '',
    warning: '',
    time: null,
    sortOrder: 0,
    childSteps,
  }
}

describe('mapStepToSubTask (createTaskFromSOP mapping logic)', () => {
  it('步骤正确映射为子任务', () => {
    const step = makeStep('准备材料')
    const subTask = mapStepToSubTask(step, 0)
    expect(subTask.title).toBe('准备材料')
    expect(subTask.completed).toBe(false)
    expect(subTask.sortOrder).toBe(0)
    expect(subTask.subTasks).toHaveLength(0)
  })

  it('子步骤映射为嵌套子任务', () => {
    const step = makeStep('主步骤', [makeStep('子步骤A'), makeStep('子步骤B')])
    const subTask = mapStepToSubTask(step, 1)
    expect(subTask.sortOrder).toBe(1)
    expect(subTask.subTasks).toHaveLength(2)
    expect(subTask.subTasks[0].title).toBe('子步骤A')
    expect(subTask.subTasks[1].title).toBe('子步骤B')
    expect(subTask.subTasks[0].sortOrder).toBe(0)
    expect(subTask.subTasks[1].sortOrder).toBe(1)
  })

  it('第 3 层子步骤被忽略（childSteps 只映射第 1 层）', () => {
    const deepChild = makeStep('孙步骤')
    const child = makeStep('子步骤', [deepChild])
    const step = makeStep('主步骤', [child])
    const subTask = mapStepToSubTask(step, 0)
    // 子步骤被映射
    expect(subTask.subTasks).toHaveLength(1)
    // 孙步骤（第 3 层）被忽略
    expect(subTask.subTasks[0].subTasks).toHaveLength(0)
  })

  it('部分勾选时只生成勾选的步骤', () => {
    const steps: SOPStep[] = [
      makeStep('步骤1'),
      makeStep('步骤2'),
      makeStep('步骤3'),
    ]
    // 模拟只选 步骤1 和 步骤3
    const selected = [steps[0], steps[2]]
    const subTasks = selected.map((s, i) => mapStepToSubTask(s, i))
    expect(subTasks).toHaveLength(2)
    expect(subTasks[0].title).toBe('步骤1')
    expect(subTasks[1].title).toBe('步骤3')
  })

  it('空步骤列表产生空子任务数组', () => {
    const subTasks: SubTask[] = [].map((s: SOPStep, i: number) => mapStepToSubTask(s, i))
    expect(subTasks).toHaveLength(0)
  })

  it('所有子任务初始 completed = false', () => {
    const step = makeStep('步骤', [makeStep('子'), makeStep('子2')])
    const subTask = mapStepToSubTask(step, 0)
    expect(subTask.completed).toBe(false)
    subTask.subTasks.forEach((s) => expect(s.completed).toBe(false))
  })
})
