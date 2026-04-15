import { describe, it, expect } from 'vitest'
import { getSystemSOPs, getSystemFolder, SYSTEM_FOLDER_ID } from './systemSOPs'

const EXPECTED_COUNT = 8
const EXPECTED_STYLES = ['numbered', 'bullet', 'timeline'] as const

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

  it('displayStyle 只包含合法值', () => {
    for (const sop of getSystemSOPs('zh')) {
      expect(EXPECTED_STYLES).toContain(sop.displayStyle)
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

    it('zh/en 对应 SOP 的 id 和 displayStyle 相同', () => {
      const zh = getSystemSOPs('zh')
      const en = getSystemSOPs('en')
      zh.forEach((s, i) => {
        expect(s.id).toBe(en[i].id)
        expect(s.displayStyle).toBe(en[i].displayStyle)
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

  describe('timeline 风格步骤有时间字段', () => {
    it('所有 timeline 风格的步骤都有 time', () => {
      const timelineSOPs = getSystemSOPs('zh').filter((s) => s.displayStyle === 'timeline')
      expect(timelineSOPs.length).toBeGreaterThan(0)
      for (const sop of timelineSOPs) {
        for (const step of sop.steps) {
          expect(step.time).toBeTruthy()
        }
      }
    })
  })

  describe('步骤 content 为 Tiptap JSON 格式', () => {
    it('有 note 的步骤 content 包含 info callout', () => {
      // 工作日第4步有 noteZh
      const sops = getSystemSOPs('zh')
      const workday = sops.find((s) => s.id === '__sys_workday')!
      const step4 = workday.steps.find((s) => s.id === 'wd4')!
      expect(step4.content).not.toBeNull()
      expect(step4.content!.type).toBe('doc')
      const infos = step4.content!.content!.filter(
        (n: any) => n.type === 'callout' && n.attrs?.variant === 'info'
      )
      expect(infos.length).toBeGreaterThan(0)
    })

    it('有 warning 的步骤 content 包含 warning callout', () => {
      // 出差准备第4步有 warnZh
      const sops = getSystemSOPs('zh')
      const travel = sops.find((s) => s.id === '__sys_travelPacking')!
      const step4 = travel.steps.find((s) => s.id === 'tp4')!
      expect(step4.content).not.toBeNull()
      const warnings = step4.content!.content!.filter(
        (n: any) => n.type === 'callout' && n.attrs?.variant === 'warning'
      )
      expect(warnings.length).toBeGreaterThan(0)
    })

    it('无 note/warning 的步骤 content 为 null', () => {
      const sops = getSystemSOPs('zh')
      const workday = sops.find((s) => s.id === '__sys_workday')!
      const step1 = workday.steps.find((s) => s.id === 'wd1')!
      expect(step1.content).toBeNull()
    })

    it('所有步骤 childSteps 为空数组', () => {
      for (const sop of getSystemSOPs('zh')) {
        for (const step of sop.steps) {
          expect(step.childSteps).toEqual([])
        }
      }
    })
  })
})
