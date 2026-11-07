import type {
  ExpressionCue,
  ExpressionName,
  ExpressionWeights,
} from '../state/companionStore'

export const EXPRESSION_TIMELINE_LIMITS = {
  cues: 3,
  durationMs: 10_000,
  phaseMs: 5_000,
} as const

type Validation<T> =
  | { ok: true; value: T; durationMs: number }
  | { ok: false; error: string }

const expressionNames: ExpressionName[] = ['Angry', 'Surprised', 'Sad']

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

export function validateExpressionCues(value: unknown): Validation<ExpressionCue[]> {
  if (
    !Array.isArray(value) ||
    value.length < 1 ||
    value.length > EXPRESSION_TIMELINE_LIMITS.cues
  )
    return { ok: false, error: 'expressions must contain 1 to 3 cues' }

  const cues: ExpressionCue[] = []
  let durationMs = 0
  const seen = new Set<string>()
  for (const cue of value) {
    if (
      !isRecord(cue) ||
      Object.keys(cue).some(
        (key) =>
          !['expression', 'to', 'fade_in_ms', 'hold_ms', 'fade_out_ms'].includes(key),
      )
    )
      return { ok: false, error: 'Expression cue contains unknown fields' }
    if (
      typeof cue.expression !== 'string' ||
      !expressionNames.includes(cue.expression as ExpressionName)
    )
      return { ok: false, error: `Unknown expression: ${String(cue.expression)}` }
    if (seen.has(cue.expression))
      return { ok: false, error: `Duplicate expression cue: ${cue.expression}` }
    seen.add(cue.expression)
    if (
      typeof cue.to !== 'number' ||
      !Number.isFinite(cue.to) ||
      cue.to < 0 ||
      cue.to > 1
    )
      return {
        ok: false,
        error: `Expression ${cue.expression} target must be within 0..1`,
      }
    const phaseValues: Record<'fade_in_ms' | 'hold_ms' | 'fade_out_ms', number> = {
      fade_in_ms: cue.fade_in_ms as number,
      hold_ms: cue.hold_ms as number,
      fade_out_ms: cue.fade_out_ms as number,
    }
    for (const field of ['fade_in_ms', 'hold_ms', 'fade_out_ms'] as const) {
      const duration = cue[field]
      if (
        typeof duration !== 'number' ||
        !Number.isInteger(duration) ||
        duration < 0 ||
        duration > EXPRESSION_TIMELINE_LIMITS.phaseMs
      )
        return { ok: false, error: `${field} must be an integer within 0..5000` }
    }
    const cueDuration =
      phaseValues.fade_in_ms + phaseValues.hold_ms + phaseValues.fade_out_ms
    if (cueDuration <= 0)
      return { ok: false, error: 'Expression cue duration must be greater than zero' }
    durationMs = Math.max(durationMs, cueDuration)
    cues.push({
      expression: cue.expression as ExpressionName,
      to: cue.to,
      ...phaseValues,
    })
  }
  if (durationMs > EXPRESSION_TIMELINE_LIMITS.durationMs)
    return { ok: false, error: 'Expression timeline exceeds 10000ms' }
  return { ok: true, value: cues, durationMs }
}

export function sampleExpressionCue(
  cue: ExpressionCue,
  elapsedMs: number,
  from: number,
  baseline: number,
) {
  const fadeInEnd = cue.fade_in_ms
  const holdEnd = fadeInEnd + cue.hold_ms
  const end = holdEnd + cue.fade_out_ms
  const t = Math.max(0, Math.min(end, elapsedMs))
  if (cue.fade_in_ms > 0 && t < fadeInEnd) return from + (cue.to - from) * (t / fadeInEnd)
  if (t < holdEnd) return cue.to
  if (cue.fade_out_ms === 0) return baseline
  if (t < end) return cue.to + (baseline - cue.to) * ((t - holdEnd) / cue.fade_out_ms)
  return baseline
}

export function zeroExpressionWeights(): ExpressionWeights {
  return { Angry: 0, Surprised: 0, Sad: 0 }
}

export function shouldApplyExpressionOutput(
  expressionTimelineActive: boolean,
  expressionWeight: number,
  comfortEmotion: boolean,
  hasClipTrack: boolean,
) {
  return expressionTimelineActive || expressionWeight > 0 || comfortEmotion || !hasClipTrack
}
