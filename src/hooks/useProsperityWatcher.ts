/**
 * 全局繁荣度升级监听 hook。
 * 挂载在 App 根节点，任何页面完成任务都能触发区域升级事件记录。
 * - 普通区域：通过任务XP计算繁荣度
 * - _milestone 区域（档案馆）：繁荣度跟随角色等级，也在此处统一监听
 */
import { useEffect, useRef } from 'react'
import { useAreaStore } from '@/stores/areaStore'
import { useTaskStore } from '@/stores/taskStore'
import { useCharacterStore } from '@/stores/characterStore'
import { useGrowthEventStore } from '@/stores/growthEventStore'
import { getProsperityInfo, getAreaSkillXP } from '@/engines/prosperityEngine'
import { PROSPERITY_NAMES } from '@/types/area'
import { useT } from '@/i18n'
import { getAreaDisplayName } from '@/utils/area'

function getMilestoneProsperityLevel(characterLevel: number): number {
  if (characterLevel <= 3)  return 1  // 荒芜：Lv.1-3
  if (characterLevel <= 8)  return 2  // 聚落：Lv.4-8
  if (characterLevel <= 15) return 3  // 丰饶：Lv.9-15
  if (characterLevel <= 25) return 4  // 繁荣：Lv.16-25
  if (characterLevel <= 40) return 5  // 鼎盛：Lv.26-40
  return 6                            // 辉煌：Lv.41+
}

function getAreaProsperityLevel(
  category: string,
  tasks: ReturnType<typeof useTaskStore.getState>['tasks'],
  characterLevel: number,
): number {
  if (category === '_milestone') return getMilestoneProsperityLevel(characterLevel)
  return getProsperityInfo(getAreaSkillXP(tasks, category)).prosperityLevel
}

export function useProsperityWatcher() {
  const areas = useAreaStore((s) => s.areas)
  const tasks = useTaskStore((s) => s.tasks)
  const characterLevel = useCharacterStore((s) => s.character.level)
  const t = useT()
  const prevRef = useRef<Record<string, number> | null>(null)

  useEffect(() => {
    const current: Record<string, number> = {}
    for (const area of areas) {
      current[area.id] = getAreaProsperityLevel(area.category, tasks, characterLevel)
    }

    if (prevRef.current === null) {
      prevRef.current = current
      return
    }

    for (const area of areas) {
      const prev = prevRef.current[area.id]
      const now = current[area.id]
      if (prev !== undefined && now > prev) {
        const levelName = PROSPERITY_NAMES[now - 1]
        const displayName = getAreaDisplayName(area, t)
        useGrowthEventStore.getState().addEvent({
          type: 'area_level_up',
          title: `${displayName} 升级为${levelName}`,
          details: { areaName: displayName, prosperityLevel: now },
          isMilestone: now >= 4,
        })
      }
    }

    prevRef.current = current
  }, [tasks, areas, characterLevel])
}
