import type {
  AnimationInfo,
  AnimationName,
  AnimationTimelineStep,
} from '../state/companionStore'
import { validateExpressionCues } from './expressionTimeline'

export const TIMELINE_LIMITS = {
  steps: 12,
  durationMs: 30_000,
  repeats: 5,
  speedMin: 0.5,
  speedMax: 1.5,
  transitionMs: 800,
} as const

type Validation<T> =
  | { ok: true; value: T; durationMs: number }
  | { ok: false; error: string }

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

const stepKeys = [
  'animation',
  'repeat_count',
  'speed',
  'transition_ms',
  'easing',
  'expressions',
] as const
const easings = ['linear', 'ease_in', 'ease_out', 'ease_in_out'] as const

export function validateAnimationTimeline(
  value: unknown,
  animations: readonly AnimationInfo[],
): Validation<AnimationTimelineStep[]> {
  if (!isRecord(value) || Object.keys(value).length !== 1 || !Array.isArray(value.steps))
    return { ok: false, error: 'Timeline requires a steps array' }
  if (!value.steps.length || value.steps.length > TIMELINE_LIMITS.steps)
    return { ok: false, error: 'Timeline must contain 1 to 12 steps' }
  const available = new Map(
    animations
      .filter((clip) => clip.name !== 'Death' && clip.name !== 'Punch')
      .map((clip) => [clip.name, clip]),
  )
  const steps: AnimationTimelineStep[] = []
  let totalMs = 0
  for (const raw of value.steps) {
    if (
      !isRecord(raw) ||
      !Object.keys(raw).every((key) => stepKeys.includes(key as never))
    )
      return { ok: false, error: 'Timeline step contains unknown fields' }
    const clip =
      typeof raw.animation === 'string'
        ? available.get(raw.animation as AnimationName)
        : null
    if (!clip || !Number.isFinite(clip.duration) || clip.duration <= 0)
      return {
        ok: false,
        error: `Unknown or invalid animation: ${String(raw.animation)}`,
      }
    const repeats = raw.repeat_count
    if (
      typeof repeats !== 'number' ||
      !Number.isInteger(repeats) ||
      repeats < 1 ||
      repeats > TIMELINE_LIMITS.repeats
    )
      return { ok: false, error: 'repeat_count must be an integer from 1 to 5' }
    const speed = raw.speed
    if (
      typeof speed !== 'number' ||
      !Number.isFinite(speed) ||
      speed < TIMELINE_LIMITS.speedMin ||
      speed > TIMELINE_LIMITS.speedMax
    )
      return { ok: false, error: 'speed must be within 0.5..1.5' }
    const transition = raw.transition_ms
    if (
      typeof transition !== 'number' ||
      !Number.isInteger(transition) ||
      transition < 0 ||
      transition > TIMELINE_LIMITS.transitionMs
    )
      return { ok: false, error: 'transition_ms must be an integer within 0..800' }
    const easing = raw.easing
    if (!easings.includes(easing as (typeof easings)[number]))
      return { ok: false, error: 'Unknown timeline easing' }
    let expressions: AnimationTimelineStep['expressions']
    if (raw.expressions !== undefined) {
      const validated = validateExpressionCues(raw.expressions)
      if (!validated.ok) return validated
      if (validated.durationMs > (clip.duration * 1000 * repeats) / speed)
        return { ok: false, error: 'Expression cues cannot outlast their animation step' }
      expressions = validated.value
    }
    totalMs += (clip.duration * 1000 * repeats) / speed
    if (!Number.isFinite(totalMs) || totalMs > TIMELINE_LIMITS.durationMs)
      return { ok: false, error: 'Timeline effective playback exceeds 30000ms' }
    steps.push({
      animation: clip.name,
      repeat_count: repeats,
      speed,
      transition_ms: transition,
      easing: easing as AnimationTimelineStep['easing'],
      ...(expressions ? { expressions } : {}),
    })
  }
  return { ok: true, value: steps, durationMs: totalMs }
}

export function easeTimeline(easing: AnimationTimelineStep['easing'], progress: number) {
  const t = Math.max(0, Math.min(1, progress))
  if (easing === 'linear') return t
  if (easing === 'ease_in') return t * t
  if (easing === 'ease_out') return 1 - (1 - t) ** 2
  return t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2
}
