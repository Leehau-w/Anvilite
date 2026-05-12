import { describe, expect, it } from 'vitest'
import { getSOPStepPrefix } from './sop'

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
