import { describe, expect, it } from 'vitest'
import {
  sampleExpressionCue,
  shouldApplyExpressionOutput,
  validateExpressionCues,
} from './expressionTimeline'

const cue = {
  expression: 'Surprised',
  to: 0.4,
  fade_in_ms: 200,
  hold_ms: 600,
  fade_out_ms: 300,
} as const

describe('finite expression timelines', () => {
  it('owns expression output while active even when Idle has a morph track', () => {
    expect(shouldApplyExpressionOutput(true, 0, false, true)).toBe(true)
    expect(shouldApplyExpressionOutput(false, 0, false, true)).toBe(false)
  })

  it('validates bounded cues and calculates the longest concurrent duration', () => {
    expect(validateExpressionCues([cue])).toMatchObject({ ok: true, durationMs: 1100 })
    expect(
      validateExpressionCues([
        cue,
        { expression: 'Sad', to: 0.2, fade_in_ms: 100, hold_ms: 100, fade_out_ms: 100 },
      ]),
    ).toMatchObject({ ok: true, durationMs: 1100 })
  })

  it('rejects unknown, duplicate, out-of-range, invalid, and overlong cues', () => {
    expect(validateExpressionCues([{ ...cue, expression: 'Happy' }])).toMatchObject({
      ok: false,
      error: 'Unknown expression: Happy',
    })
    expect(validateExpressionCues([{ ...cue, to: 1.1 }]).ok).toBe(false)
    expect(validateExpressionCues([{ ...cue, fade_in_ms: -1 }]).ok).toBe(false)
    expect(
      validateExpressionCues([{ ...cue, fade_in_ms: 0, hold_ms: 0, fade_out_ms: 0 }]),
    ).toMatchObject({
      ok: false,
      error: 'Expression cue duration must be greater than zero',
    })
    expect(
      validateExpressionCues([
        { ...cue, fade_in_ms: 5000, hold_ms: 5000, fade_out_ms: 1 },
      ]),
    ).toMatchObject({
      ok: false,
      error: 'Expression timeline exceeds 10000ms',
    })
    expect(validateExpressionCues([cue, cue])).toMatchObject({ ok: false })
  })

  it('fades from the visible weight to target, holds, then returns to baseline', () => {
    expect(sampleExpressionCue(cue, 100, 0.1, 0.05)).toBeCloseTo(0.25)
    expect(sampleExpressionCue(cue, 500, 0.1, 0.05)).toBe(0.4)
    expect(sampleExpressionCue(cue, 950, 0.1, 0.05)).toBeCloseTo(0.225)
    expect(sampleExpressionCue(cue, 1100, 0.1, 0.05)).toBe(0.05)
  })

  it('returns to baseline immediately when fade-out is zero', () => {
    const instantOut = { ...cue, hold_ms: 100, fade_out_ms: 0 }
    expect(sampleExpressionCue(instantOut, 300, 0, 0.12)).toBe(0.12)
  })
})
