import { describe, expect, it } from 'vitest'
import {
  BODY_FOLLOW_SUSTAIN_MS,
  createAttentionState,
  MAX_HEAD_PITCH_RAD,
  MAX_HEAD_YAW_RAD,
  stepAttention,
} from './attention'

describe('stepAttention', () => {
  it('moves the head before the body when the view changes substantially', () => {
    let state = createAttentionState()
    state = stepAttention(state, { x: 1, y: 0, z: 0 }, 0.05)
    expect(Math.abs(state.headYaw)).toBeGreaterThan(0)
    expect(state.bodyYaw).toBe(0)

    for (let ms = 0; ms < BODY_FOLLOW_SUSTAIN_MS + 200; ms += 50)
      state = stepAttention(state, { x: 1, y: 0, z: 0 }, 0.05)
    expect(state.bodyYaw).toBeGreaterThan(0)
    expect(state.bodyYaw).toBeLessThan(Math.PI / 2)
  })

  it('does not start body movement until the substantial turn is sustained', () => {
    let state = createAttentionState()
    for (let ms = 0; ms < BODY_FOLLOW_SUSTAIN_MS - 100; ms += 50)
      state = stepAttention(state, { x: 0.8, y: 0, z: 0.6 }, 0.05)
    expect(state.bodyYaw).toBe(0)
  })

  it('returns head and body smoothly toward the user when the view recenters', () => {
    let state = createAttentionState()
    for (let ms = 0; ms < 1800; ms += 50)
      state = stepAttention(state, { x: 1, y: 0, z: 0 }, 0.05)
    expect(state.bodyYaw).toBeGreaterThan(0)
    const before = state.bodyYaw
    state = stepAttention(state, { x: 0, y: 0, z: 1 }, 0.05)
    expect(state.bodyYaw).toBeLessThan(before)
    for (let ms = 0; ms < 7000; ms += 50)
      state = stepAttention(state, { x: 0, y: 0, z: 1 }, 0.05)
    expect(state.bodyYaw).toBeCloseTo(0, 2)
    expect(state.headYaw).toBeCloseTo(0, 2)
  })

  it('bounds head angles, ignores invalid deltas, and safely recenters on null input', () => {
    let state = createAttentionState()
    state = stepAttention(state, { x: 0.1, y: 1, z: -0.1 }, 0.05)
    expect(Math.abs(state.headYaw)).toBeLessThanOrEqual(MAX_HEAD_YAW_RAD)
    expect(Math.abs(state.headPitch)).toBeLessThanOrEqual(MAX_HEAD_PITCH_RAD)
    expect(stepAttention(state, null, 0)).toBe(state)
    for (let ms = 0; ms < 1500; ms += 50) state = stepAttention(state, null, 0.05)
    expect(state.headYaw).toBeCloseTo(0, 2)
    expect(state.headPitch).toBeCloseTo(0, 2)
  })

  it('keeps upward camera gaze close to level', () => {
    let state = createAttentionState()
    for (let ms = 0; ms < 1500; ms += 50)
      state = stepAttention(state, { x: 0, y: 1, z: 1 }, 0.05)

    expect(state.headPitch).toBeCloseTo(MAX_HEAD_PITCH_RAD, 2)
    expect(state.headPitch).toBeLessThan(0.2)
  })
})
