/**
 * 全局繁荣度升级监听 hook。
 * 挂载在 App 根节点，任何页面完成任务都能触发区域升级事件记录。
 * WorldMap 里的同名检测仅做 toast + 发光动画，不再负责事件记录。
 */
import { useEffect, useRef } from 'react'
import { useAreaStore } from '@/stores/areaStore'
import { useTaskStore } from '@/stores/taskStore'
import { useGrowthEventStore } from '@/stores/growthEventStore'
import { getProsperityInfo, getAreaSkillXP } from '@/engines/prosperityEngine'
import { PROSPERITY_NAMES } from '@/types/area'

function getAreaProsperityLevel(category: string, tasks: ReturnType<typeof useTaskStore.getState>['tasks']): number {
  // _milestone 区域由 characterStore.gainXPAndOre 在升级时同步记录，此处跳过避免重复
  if (category === '_milestone') return -1
  return getProsperityInfo(getAreaSkillXP(tasks, category)).prosperityLevel
}

export function useProsperityWatcher() {
  const areas = useAreaStore((s) => s.areas)
  const tasks = useTaskStore((s) => s.tasks)
  const prevRef = useRef<Record<string, number> | null>(null)

  useEffect(() => {
    const current: Record<string, number> = {}
    for (const area of areas) {
      current[area.id] = getAreaProsperityLevel(area.category, tasks)
    }

    if (prevRef.current === null) {
      prevRef.current = current
      return
    }

    for (const area of areas) {
      const prev = prevRef.current[area.id]
      const now = current[area.id]
      // -1 表示由其他机制处理（_milestone），跳过
      if (now === -1 || prev === -1) continue
      if (prev !== undefined && now > prev) {
        const levelName = PROSPERITY_NAMES[now - 1]
        useGrowthEventStore.getState().addEvent({
          type: 'area_level_up',
          title: `${area.name} 升级为${levelName}`,
          details: { areaName: area.name, prosperityLevel: now },
          isMilestone: now >= 4,
        })
      }
    }

    prevRef.current = current
  }, [tasks, areas])
}
