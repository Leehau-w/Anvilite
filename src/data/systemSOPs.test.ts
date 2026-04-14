import { describe, it, expect } from 'vitest'
import { getSystemSOPs, getSystemFolder, SYSTEM_FOLDER_ID } from './systemSOPs'

const EXPECTED_COUNT = 8
const EXPECTED_TYPES = ['schedule', 'workflow', 'checklist', 'itemlist'] as const

describe('getSystemFolder', () => {
  it('zh：名称为"系统模板"', () => {
    expect(getSystemFolder('zh').name).toBe('系统模板')
  })

  it('en：名称为"System Templates"', () => {
    expect(getSystemFolder('en').name).toBe('System Templates')
  })

  it('id 固定为 SYSTEM_FOLDER_ID', () => {
    expect(getSystemFolder('zh').id).toBe(SYSTEM_FOLDER_ID)
  })

  it('isSystem = true', () => {
    expect(getSystemFolder('zh').isSystem).toBe(true)
  })

  it('sortOrder = -1（排在用户文件夹之前）', () => {
    expect(getSystemFolder('zh').sortOrder).toBe(-1)
  })
})

describe('getSystemSOPs', () => {
  it(`共 ${EXPECTED_COUNT} 个预设`, () => {
    expect(getSystemSOPs('zh')).toHaveLength(EXPECTED_COUNT)
    expect(getSystemSOPs('en')).toHaveLength(EXPECTED_COUNT)
  })

  it('每个预设都属于系统文件夹', () => {
    for (const sop of getSystemSOPs('zh')) {
      expect(sop.folderId).toBe(SYSTEM_FOLDER_ID)
    }
  })

  it('每个预设 isSystem = true', () => {
    for (const sop of getSystemSOPs('zh')) {
      expect(sop.isSystem).toBe(true)
    }
  })

  it('每个预设至少有 1 个步骤', () => {
    for (const sop of getSystemSOPs('zh')) {
      expect(sop.steps.length).toBeGreaterThanOrEqual(1)
    }
  })

  it('type 只包含合法值', () => {
    for (const sop of getSystemSOPs('zh')) {
      expect(EXPECTED_TYPES).toContain(sop.type)
    }
  })

  it('id 在同语言内唯一', () => {
    const ids = getSystemSOPs('zh').map((s) => s.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  describe('双语解析', () => {
    it('zh/en 返回相同数量的 SOP', () => {
      expect(getSystemSOPs('zh').length).toBe(getSystemSOPs('en').length)
    })

    it('zh/en 对应 SOP 的 id 和 type 相同', () => {
      const zh = getSystemSOPs('zh')
      const en = getSystemSOPs('en')
      zh.forEach((s, i) => {
        expect(s.id).toBe(en[i].id)
        expect(s.type).toBe(en[i].type)
      })
    })

    it('zh/en 标题不同（确认双语生效）', () => {
      const zh = getSystemSOPs('zh')
      const en = getSystemSOPs('en')
      // 至少有一个标题不同
      const hasDiff = zh.some((s, i) => s.title !== en[i].title)
      expect(hasDiff).toBe(true)
    })

    it('zh/en 步骤数量一致', () => {
      const zh = getSystemSOPs('zh')
      const en = getSystemSOPs('en')
      zh.forEach((s, i) => {
        expect(s.steps.length).toBe(en[i].steps.length)
      })
    })

    it('步骤 id 在 zh/en 间一致', () => {
      const zh = getSystemSOPs('zh')
      const en = getSystemSOPs('en')
      zh.forEach((sop, i) => {
        sop.steps.forEach((step, j) => {
          expect(step.id).toBe(en[i].steps[j].id)
        })
      })
    })
  })

  describe('schedule 类型步骤有时间字段', () => {
    it('所有 schedule 类型的步骤都有 time', () => {
      const scheduleSOPs = getSystemSOPs('zh').filter((s) => s.type === 'schedule')
      expect(scheduleSOPs.length).toBeGreaterThan(0)
      for (const sop of scheduleSOPs) {
        for (const step of sop.steps) {
          expect(step.time).toBeTruthy()
        }
      }
    })
  })
})
