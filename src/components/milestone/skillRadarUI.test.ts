// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

vi.hoisted(() => {
  vi.stubGlobal('window', document.defaultView)
  vi.stubGlobal('localStorage', document.defaultView!.localStorage)
})
import { SkillRadarChart, type SkillDimension } from './SkillRadarChart'
import { useSettingsStore } from '@/stores/settingsStore'
import { zh } from '@/i18n/zh'
import { en } from '@/i18n/en'

let container: HTMLDivElement
let root: Root
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  useSettingsStore.getState().setLanguage('zh')
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
})
afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
  vi.restoreAllMocks()
})
async function render(dimensions: SkillDimension[], props: { size?: number; formatValue?: (value: number) => string; ariaLabel?: string } = {}) {
  await act(async () => root.render(React.createElement(SkillRadarChart, { dimensions, ...props })))
}

it.each(['zh', 'en'] as const)('shows the localized empty state without creating a misleading graph (%s)', async language => {
  useSettingsStore.getState().setLanguage(language)
  await render([])
  expect(container.textContent).toBe(({ zh, en })[language].radar_empty)
  expect(container.querySelector('[role="img"]')).toBeNull()
})

it('shows one or two categories as readable bars and applies the actual metric formatter', async () => {
  const dimensions = [{ name: 'A long custom category', value: 75 }, { name: '学习', value: 12 }]
  await render(dimensions, { formatValue: value => value + ' min', ariaLabel: 'Task time' })
  const graph = container.querySelector('[data-capability-bars]')!
  expect(graph.getAttribute('aria-label')).toBe('Task time; A long custom category: 75 min; 学习: 12 min')
  expect(graph.textContent).toContain('75 min')
  expect(graph.textContent).toContain('12 min')
  expect(graph.textContent).not.toMatch(/Lv\.|XP/)
  await render(dimensions.slice(0, 1))
  expect(container.querySelector('[data-capability-bars]')!.textContent).toContain('75')
  expect(container.querySelector('[data-capability-radar]')).toBeNull()
})

it.each([220, 240])('keeps long names accessible and supports keyboard metric tooltips at %i px', async size => {
  const dimensions = [{ name: '非常长的中文自定义分类名称', value: 12000 }, { name: 'Professional development and research', value: 20 }, { name: '生活', value: 0 }]
  await render(dimensions, { size, formatValue: value => value + ' tasks', ariaLabel: 'Capability chart' })
  const graph = container.querySelector<SVGSVGElement>('[data-capability-radar]')!
  expect(graph.getAttribute('aria-label')).toContain('Professional development and research: 20 tasks')
  const axisLabels = [...graph.querySelectorAll('text')].filter(node => node.querySelector('tspan'))
  expect(axisLabels).toHaveLength(3)
  for (const label of axisLabels) expect(label.querySelectorAll('tspan').length).toBeLessThanOrEqual(2)
  expect(axisLabels[0].querySelector('title')!.textContent).toContain(dimensions[0].name)
  const point = graph.querySelector<SVGElement>('[tabindex="0"]')!
  await act(async () => point.dispatchEvent(new FocusEvent('focusin', { bubbles: true })))
  const tooltip = graph.querySelector('[data-capability-tooltip]')!
  expect(tooltip.textContent).toBe('12000 tasks')
  const rect = tooltip.querySelector('rect')!
  expect(Number(rect.getAttribute('x'))).toBeGreaterThanOrEqual(0)
  expect(Number(rect.getAttribute('x')) + Number(rect.getAttribute('width'))).toBeLessThanOrEqual(size)
  await act(async () => point.dispatchEvent(new FocusEvent('focusout', { bubbles: true })))
  expect(graph.querySelector('[data-capability-tooltip]')).toBeNull()
  expect(graph.textContent).not.toMatch(/Lv\.|XP/)
})

it('renders zero and invalid imported values as finite nonnegative geometry', async () => {
  await render([{ name: 'Zero', value: 0 }, { name: 'Invalid', value: NaN }, { name: 'Negative', value: -20 }])
  const graph = container.querySelector('[data-capability-radar]')!
  expect(graph.getAttribute('aria-label')).toBe('Zero: 0; Invalid: 0; Negative: 0')
  expect(graph.innerHTML).not.toMatch(/NaN|Infinity/)
})

it('keeps extreme finite imported totals visible without overflowing the chart scale', async () => {
  await render([{ name: 'Largest valid total', value: Number.MAX_VALUE }, { name: 'Half total', value: Number.MAX_VALUE / 2 }, { name: 'Zero', value: 0 }])
  const graph = container.querySelector<SVGSVGElement>('[data-capability-radar]')!
  expect(graph.innerHTML).not.toMatch(/NaN|Infinity/)
  const points = graph.querySelectorAll<SVGCircleElement>('[tabindex="0"]')
  expect(Number(points[0].getAttribute('cy'))).toBeLessThan(100)
  expect(Number(points[1].getAttribute('cx'))).toBeGreaterThan(100)
  expect(Number(points[2].getAttribute('cx'))).toBe(100)
  expect(Number(points[2].getAttribute('cy'))).toBe(100)
})
