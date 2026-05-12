import type { JSONContent } from '@tiptap/react'
import type { SOP } from '@/types/sop'

export function getSOPStepPrefix(
  displayStyle: SOP['displayStyle'],
  index: number,
  parentIndex?: string,
): string {
  switch (displayStyle) {
    case 'numbered': {
      const parent = parentIndex?.replace(/\.$/, '')
      return parent ? `${parent}.${index + 1}` : `${index + 1}.`
    }
    case 'bullet':
      return '•'
    case 'timeline':
      return ''
  }
}

export function extractSOPPlainText(content: JSONContent | null, maxLength = 96): string {
  if (!content) return ''

  const parts: string[] = []

  function walk(node: JSONContent) {
    if (typeof node.text === 'string') parts.push(node.text)

    if (node.type === 'sopLink' && typeof node.attrs?.sopTitle === 'string') {
      parts.push(node.attrs.sopTitle)
    }

    if (node.type === 'hardBreak') parts.push(' ')
    if (Array.isArray(node.content)) node.content.forEach(walk)

    if (node.type === 'paragraph' || node.type === 'heading' || node.type === 'listItem') {
      parts.push(' ')
    }
  }

  walk(content)

  const normalized = parts.join(' ').replace(/\s+/g, ' ').trim()
  if (normalized.length <= maxLength) return normalized
  if (maxLength <= 3) return normalized.slice(0, maxLength)
  return `${normalized.slice(0, maxLength - 3).trimEnd()}...`
}
