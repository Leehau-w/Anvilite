export interface SOPFolder {
  id: string
  name: string
  sortOrder: number
  isSystem: boolean       // 系统预设文件夹（只读）
  createdAt: string
}

export interface SOPStep {
  id: string
  title: string
  note: string            // 备注（💡）
  warning: string         // 警告（⚠️）
  time: string | null     // 时间点（仅日程型，如 "07:00"）
  sortOrder: number
  childSteps: SOPStep[]   // 子步骤（UI 限制最多 2 层）
}

export interface SOP {
  id: string
  folderId: string        // 所属文件夹
  title: string
  type: 'schedule' | 'workflow' | 'checklist' | 'itemlist'
  steps: SOPStep[]
  isSystem: boolean       // 系统预设（只读）
  lastUsedAt: string | null  // 最近一次转为任务的时间
  sortOrder: number
  createdAt: string
  updatedAt: string
}
