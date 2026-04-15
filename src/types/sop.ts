export interface SOPFolder {
  id: string
  name: string
  parentId: string | null  // 父文件夹 ID，null = 根级
  sortOrder: number
  isSystem: boolean       // 系统预设文件夹（只读）
  createdAt: string
}

import type { JSONContent } from '@tiptap/react'

export interface SOPStep {
  id: string
  title: string
  content: JSONContent | null  // Tiptap 富文本内容（替换 note + warning）
  time: string | null          // 时间点（仅 timeline 风格）
  sortOrder: number
  childSteps: SOPStep[]        // 子步骤（UI 限制最多 2 层）
}

export interface SOP {
  id: string
  folderId: string        // 所属文件夹
  title: string
  displayStyle: 'numbered' | 'bullet' | 'timeline'
  steps: SOPStep[]
  isSystem: boolean       // 系统预设（只读）
  lastUsedAt: string | null  // 最近一次转为任务的时间
  sortOrder: number
  createdAt: string
  updatedAt: string
}
