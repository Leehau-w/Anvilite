/**
 * 全局繁荣度升级监听 hook。
 * 挂载在 App 根节点，任何页面完成任务都能触发区域升级事件记录。
 * WorldMap 里的同名检测仅做 toast + 发光动画，不再负责事件记录。
 */
import { useEffect, useRef } from 'react'
import { useAreaStore } from '@/stores/areaStore'
import { useTaskStore } from '@/stores/taskStore'
import { useCharacterStore } from '@/stores/characterStore'
import { useGrowthEventStore } from '@/stores/growthEventStore'
import { getProsperityInfo, getAreaSkillXP } from '@/engines/prosperityEngine'
import { PROSPERITY_NAMES } from '@/types/area'

function getAreaProsperityLevel(category: string, tasks: ReturnType<typeof useTaskStore.getState>['tasks'], characterLevel: number): number {
  if (category === '_milestone') {
    const lvl = characterLevel
    return lvl === 0 ? 1 : lvl <= 3 ? 2 : lvl <= 8 ? 3 : lvl <= 15 ? 4 : lvl <= 25 ? 5 : 6
  }
  return getProsperityInfo(getAreaSkillXP(tasks, category)).prosperityLevel
}

export function useProsperityWatcher() {
  const areas = useAreaStore((s) => s.areas)
  const tasks = useTaskStore((s) => s.tasks)
  const characterLevel = useCharacterStore((s) => s.character.level)
  const prevRef = useRef<Record<string, number> | null>(null)

  useEffect(() => {
    const current: Record<string, number> = {}
    for (const area of areas) {
      current[area.id] = getAreaProsperityLevel(area.category, tasks, characterLevel)
    }

    if (prevRef.current === null) {
      // 首次：记录基准，不触发事件
      prevRef.current = current
      return
    }

    for (const area of areas) {
      const prev = prevRef.current[area.id] ?? 1
      const now = current[area.id]
      if (now > prev) {
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
  }, [tasks, characterLevel, areas])
}
