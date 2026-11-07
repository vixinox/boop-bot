import { describe, expect, it } from 'vitest'
import { companionActionPresentation, SEMANTIC_ACTIONS } from './companionActions'

describe('semantic companion action catalog', () => {
  it('maps each public action to a verified clip and finite presentation', () => {
    expect(SEMANTIC_ACTIONS).toEqual([
      'greet',
      'affection',
      'praise',
      'celebrate',
      'comfort',
      'sleep',
      'wake',
    ])
    expect(companionActionPresentation('greet').animation).toBe('Wave')
    expect(companionActionPresentation('affection').animation).toBe('Yes')
    expect(companionActionPresentation('praise').animation).toBe('ThumbsUp')
    expect(companionActionPresentation('celebrate').animation).toBe('Dance')
    expect(companionActionPresentation('comfort')).toMatchObject({
      animation: 'Yes',
      expressions: [
        { expression: 'Sad', to: 0.38, fade_in_ms: 150, hold_ms: 500, fade_out_ms: 250 },
      ],
    })
    expect(companionActionPresentation('sleep')).toMatchObject({
      pose: 'sleep',
    })
    expect(companionActionPresentation('sleep').animation).toBeUndefined()
    expect(companionActionPresentation('wake')).toMatchObject({ pose: 'wake' })
    expect(companionActionPresentation('wake').animation).toBeUndefined()
  })
})
