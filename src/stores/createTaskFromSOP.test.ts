import { beforeEach, expect, it } from 'vitest'
import { useTaskStore } from './taskStore'
import type { SOPStep } from '@/types/sop'

beforeEach(() => useTaskStore.setState({ tasks: [] }))
function step(title: string, childSteps: SOPStep[] = []): SOPStep {
  return { id: title, title, content: null, time: null, sortOrder: 0, childSteps }
}
it('converts all three SOP levels using the production store', () => {
  const id = useTaskStore.getState().createTaskFromSOP({
    title: 'Flow', category: 'other', difficulty: 3, priority: 'medium', dueDate: null,
    steps: [step('Parent', [step('Child', [step('Grandchild')])])],
  })
  const task = useTaskStore.getState().tasks.find(t => t.id === id)!
  expect(task.subTasks[0].subTasks[0].subTasks[0].title).toBe('Grandchild')
  expect(task.subTasks[0].subTasks[0].subTasks[0].completed).toBe(false)
})
it('creates an empty task for an empty selection', () => {
  useTaskStore.getState().createTaskFromSOP({
    title: 'Flow', category: 'other', difficulty: 3, priority: 'medium', dueDate: null, steps: [],
  })
  expect(useTaskStore.getState().tasks[0].subTasks).toEqual([])
})
