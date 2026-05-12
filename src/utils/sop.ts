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
