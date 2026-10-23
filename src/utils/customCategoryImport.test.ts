import { afterEach, beforeEach, expect, it, vi } from 'vitest'
const storage = localStorage
const session = sessionStorage
beforeEach(() => {
  vi.resetModules()
  vi.stubGlobal('localStorage', storage)
  vi.stubGlobal('sessionStorage', session)
  localStorage.clear()
  vi.stubGlobal('window', { localStorage, location: { reload: vi.fn() }, addEventListener: vi.fn() })
})
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks() })
it('restores a custom category, task, habit and independent filters after export/import and cold hydration', async () => {
  const { useAreaStore: areas } = await import('@/stores/areaStore')
  const { useTaskStore: tasks } = await import('@/stores/taskStore')
  const { useHabitStore: habits } = await import('@/stores/habitStore')
  const { useDashboardStore: dashboard } = await import('@/stores/dashboardStore')
  const data = await import('./dataExport')
  const category = areas.getState().addArea(null, '客户反馈')!
  const task = tasks.getState().addTask({ title: '等待客户确认', category: category.category, priority: 'high', backgroundColor: '#8599ab' })
  tasks.getState().waitTask(task.id)
  habits.getState().addHabit({ title: '每周跟进', category: category.category, difficulty: 2, estimatedMinutes: 10,
    repeatType: 'daily', customIntervalDays: null, weeklyDays: null, weeklyMode: null, weeklyFlexibleCount: null,
    monthlyDays: null, targetCount: 1, startDate: new Date().toISOString().slice(0, 10), endDate: null, reminderTime: null, description: '' })
  const habit = habits.getState().habits[0]
  dashboard.getState().setTaskCardFilter('tasks', { mode: 'single', categories: [category.category] })
  dashboard.getState().setHabitCardFilter('habits', { mode: 'multiple', categories: ['home', category.category] })
  const incoming = JSON.parse(data.serializeExportData())
  const originalTask = incoming.data.tasks.tasks.find((item: { id: string }) => item.id === task.id)
  const originalHabit = incoming.data.habits.habits.find((item: { id: string }) => item.id === habit.id)
  areas.getState().removeArea(category.id)
  dashboard.getState().resetLayout()
  expect(data.applyImportPayload(incoming)).toEqual({ success: true })
  vi.resetModules()
  const freshAreas = (await import('@/stores/areaStore')).useAreaStore
  const freshTasks = (await import('@/stores/taskStore')).useTaskStore
  const freshHabits = (await import('@/stores/habitStore')).useHabitStore
  const freshDashboard = (await import('@/stores/dashboardStore')).useDashboardStore
  expect(freshAreas.getState().areas.find(item => item.id === category.id)).toEqual(category)
  expect(freshTasks.getState().tasks.find(item => item.id === task.id)).toEqual(originalTask)
  expect(freshHabits.getState().habits.find(item => item.id === habit.id)).toMatchObject(originalHabit)
  expect(freshDashboard.getState().layout.find(item => item.id === 'tasks')!.taskFilter).toEqual({ mode: 'single', categories: [category.category] })
  expect(freshDashboard.getState().layout.find(item => item.id === 'habits')!.habitFilter).toEqual({ mode: 'multiple', categories: ['home', category.category] })
})
