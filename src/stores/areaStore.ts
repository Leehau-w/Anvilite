import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Area, AreaTemplateId } from '@/types/area'
import { AREA_TEMPLATES } from '@/types/area'
import { generateId } from '@/utils/id'

export const CANVAS_W = 1600
export const CANVAS_H = 1000

function createDefaultAreas(): Area[] {
  const now = new Date().toISOString()
  return [
    { id: 'area-home', templateId: 'home', name: '家园', category: '家园', position: { x: 700, y: 360 }, isPreset: true, canDelete: false, canMove: false, createdAt: now },
    { id: 'area-arena', templateId: 'arena', name: '竞技场', category: '竞技场', position: { x: 260, y: 190 }, isPreset: true, canDelete: true, canMove: false, createdAt: now },
    { id: 'area-library', templateId: 'library', name: '藏书阁', category: '藏书阁', position: { x: 1060, y: 140 }, isPreset: true, canDelete: true, canMove: false, createdAt: now },
    { id: 'area-workshop', templateId: 'workshop', name: '灵感工坊', category: '灵感工坊', position: { x: 280, y: 520 }, isPreset: true, canDelete: true, canMove: false, createdAt: now },
    { id: 'area-forge', templateId: 'forge', name: '锻造坊', category: '锻造坊', position: { x: 920, y: 580 }, isPreset: true, canDelete: true, canMove: false, createdAt: now },
    { id: 'area-milestone', templateId: 'milestone', name: '档案馆', category: '_milestone', position: { x: 1220, y: 700 }, isPreset: true, canDelete: false, canMove: false, createdAt: now },
  ]
}

interface AreaStore {
  areas: Area[]

  addArea: (templateId: AreaTemplateId | null, customName?: string) => Area | null
  updateArea: (id: string, patch: Partial<Pick<Area, 'name' | 'position'>>) => void
  removeArea: (id: string) => void
  canAddMore: () => boolean
  getUsedTemplateIds: () => AreaTemplateId[]
  /** 返回可作为任务/习惯分类的区域名称列表（不含里程碑殿堂，追加"其他"） */
  getAreaCategories: () => string[]
}

export const useAreaStore = create<AreaStore>()(
  persist(
    (set, get) => ({
      areas: createDefaultAreas(),

      canAddMore: () => get().areas.length < 12,

      getUsedTemplateIds: () =>
        get().areas.map((a) => a.templateId).filter(Boolean) as AreaTemplateId[],

      getAreaCategories: () => {
        const cats = get()
          .areas.filter((a) => a.category !== '_milestone')
          .map((a) => a.category)
        // 确保"其他"始终存在
        if (!cats.includes('其他')) cats.push('其他')
        return cats
      },

      addArea: (templateId, customName) => {
        if (!get().canAddMore()) return null
        const now = new Date().toISOString()
        let name: string
        let category: string

        if (templateId && AREA_TEMPLATES[templateId]) {
          name = customName || AREA_TEMPLATES[templateId].name
          category = AREA_TEMPLATES[templateId].category
        } else {
          name = customName || '新区域'
          category = customName || '新区域'
        }

        const newArea: Area = {
          id: generateId(),
          templateId,
          name,
          category,
          position: { x: 600 + Math.random() * 300, y: 300 + Math.random() * 200 },
          isPreset: false,
          canDelete: true,
          canMove: true,
          createdAt: now,
        }

        set((s) => ({ areas: [...s.areas, newArea] }))
        return newArea
      },

      updateArea: (id, patch) => {
        set((s) => ({
          areas: s.areas.map((a) => (a.id === id ? { ...a, ...patch } : a)),
        }))
      },

      removeArea: (id) => {
        set((s) => ({ areas: s.areas.filter((a) => a.id !== id) }))
      },
    }),
    {
      name: 'anvilite-areas',
      // 迁移：将旧名称"里程碑殿堂"更新为"档案馆"
      onRehydrateStorage: () => (state) => {
        if (!state) return
        const milestone = state.areas.find((a) => a.id === 'area-milestone')
        if (milestone && milestone.name === '里程碑殿堂') {
          milestone.name = '档案馆'
        }
        const library = state.areas.find((a) => a.id === 'area-library')
        if (library && library.name === '书阁高塔') {
          library.name = '藏书阁'
          library.category = '藏书阁'
        }
      },
    }
  )
)
