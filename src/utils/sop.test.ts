import { describe, expect, it } from 'vitest'
import { extractSOPPlainText, getSOPStepPrefix } from './sop'

describe('getSOPStepPrefix', () => {
  it('does not duplicate dots for nested numbered steps', () => {
    expect(getSOPStepPrefix('numbered', 0)).toBe('1.')
    expect(getSOPStepPrefix('numbered', 0, '1.')).toBe('1.1')
    expect(getSOPStepPrefix('numbered', 1, '1.1')).toBe('1.1.2')
  })

  it('keeps bullet and timeline prefixes stable', () => {
    expect(getSOPStepPrefix('bullet', 0, '1.')).toBe('•')
    expect(getSOPStepPrefix('timeline', 0, '1.')).toBe('')
  })
})

describe('extractSOPPlainText', () => {
  it('builds a compact summary from rich content', () => {
    expect(extractSOPPlainText({
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'Prepare materials' }] },
        { type: 'paragraph', content: [
          { type: 'sopLink', attrs: { sopTitle: 'Linked flow' } },
          { type: 'text', text: 'Check safety' },
        ] },
      ],
    })).toBe('Prepare materials Linked flow Check safety')
  })

  it('truncates long summaries', () => {
    expect(extractSOPPlainText({
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'abcdefghijklmnopqrstuvwxyz' }] }],
    }, 10)).toBe('abcdefg...')
  })
})
