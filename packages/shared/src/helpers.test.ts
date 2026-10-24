import { describe, expect, it } from 'vitest'
import { assertFiveAgentSlots, calculateWinner, parseBehavior, parseCoachCommand } from './helpers'

describe('BOAI shared helper contracts', () => {
  it('maps supported prompts deterministically and keeps decoy precedence', () => {
    expect(parseBehavior('Alihkan perhatian lalu bantu menyusun genting')).toEqual({ behavior: 'DECOY', recognizedTerms: ['alihkan'] })
    expect(parseBehavior('Hindari bola sebelum mendekati genting').behavior).toBe('DODGE_FIRST')
  })

  it('accepts only the five frozen slots', () => {
    expect(assertFiveAgentSlots(['p1', 'p2', 'p3', 'p4', 'p5'])).toBe(true)
    expect(assertFiveAgentSlots(['p1', 'p2'])).toBe(false)
  })

  it('parses coach vocabulary and scores objective before progress', () => {
    expect(parseCoachCommand('serang')).toEqual({ command: 'ATTACK', error: null })
    expect(calculateWinner({ buildCount: 1, completionMs: null, eliminations: 5, objectiveComplete: true }, { buildCount: 9, completionMs: null, eliminations: 9, objectiveComplete: false })).toBe('red')
  })
})
