import { describe, expect, it } from 'vitest'
import type { AnimationInfo } from '../state/companionStore'
import { easeTimeline, validateAnimationTimeline } from './animationTimeline'

const animations: AnimationInfo[] = [
  { name: 'Idle', duration: 2 },
  { name: 'Wave', duration: 1 },
  { name: 'Death', duration: 1 },
  { name: 'Punch', duration: 1 },
]

describe('finite animation timelines', () => {
  it('calculates total effective clip time from duration, repeats, and speed', () => {
    const result = validateAnimationTimeline(
      {
        steps: [
          {
            animation: 'Wave',
            repeat_count: 3,
            speed: 1.5,
            transition_ms: 250,
            easing: 'ease_in_out',
            expressions: [
              {
                expression: 'Surprised',
                to: 0.4,
                fade_in_ms: 100,
                hold_ms: 200,
                fade_out_ms: 100,
              },
            ],
          },
        ],
      },
      animations,
    )
    expect(result).toMatchObject({ ok: true, durationMs: 2000 })
  })

  it('rejects excluded clips, invalid steps, and timelines over 30 seconds', () => {
    const make = (animation: string, repeat_count = 1, speed = 1) => ({
      steps: [{ animation, repeat_count, speed, transition_ms: 0, easing: 'linear' }],
    })
    expect(validateAnimationTimeline(make('Death'), animations).ok).toBe(false)
    expect(validateAnimationTimeline(make('Punch'), animations).ok).toBe(false)
    expect(validateAnimationTimeline(make('Wave', 6), animations).ok).toBe(false)
    const longTimeline = make('Idle', 5, 0.5)
    longTimeline.steps.push(...make('Idle', 5, 0.5).steps)
    expect(validateAnimationTimeline(longTimeline, animations)).toMatchObject({
      ok: false,
      error: 'Timeline effective playback exceeds 30000ms',
    })
    expect(validateAnimationTimeline({ steps: [] }, animations).ok).toBe(false)
  })

  it('rejects unknown keys and invalid expression weights without partial acceptance', () => {
    const result = validateAnimationTimeline(
      {
        steps: [
          {
            animation: 'Wave',
            repeat_count: 1,
            speed: 1,
            transition_ms: 0,
            easing: 'linear',
            expressions: [
              {
                expression: 'Sad',
                to: 2,
                fade_in_ms: 100,
                hold_ms: 200,
                fade_out_ms: 100,
              },
            ],
          },
        ],
      },
      animations,
    )
    expect(result).toMatchObject({
      ok: false,
      error: 'Expression Sad target must be within 0..1',
    })
  })

  it('rejects expression cues that outlast their animation step', () => {
    const result = validateAnimationTimeline(
      {
        steps: [
          {
            animation: 'Wave',
            repeat_count: 1,
            speed: 1,
            transition_ms: 0,
            easing: 'linear',
            expressions: [
              {
                expression: 'Sad',
                to: 0.3,
                fade_in_ms: 500,
                hold_ms: 500,
                fade_out_ms: 500,
              },
            ],
          },
        ],
      },
      animations,
    )
    expect(result).toMatchObject({
      ok: false,
      error: 'Expression cues cannot outlast their animation step',
    })
  })

  it('uses the requested easing curve for clip cross-fades', () => {
    expect(easeTimeline('linear', 0.25)).toBe(0.25)
    expect(easeTimeline('ease_in', 0.5)).toBe(0.25)
    expect(easeTimeline('ease_out', 0.5)).toBe(0.75)
    expect(easeTimeline('ease_in_out', 1)).toBe(1)
  })
})
