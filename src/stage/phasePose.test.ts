import { describe, expect, it } from 'vitest'
import { phasePose } from './phasePose'

describe('phasePose', () => {
  it('uses restrained distinct posture cues for listening and thinking', () => {
    expect(phasePose('listening', 'conversation', false, false)).toEqual({
      tiltX: -0.018,
      tiltZ: 0.012,
    })
    expect(phasePose('thinking', 'conversation', false, false)).toEqual({
      tiltX: 0.022,
      tiltZ: -0.008,
    })
    expect(phasePose('responding', 'conversation', false, false)).toEqual({
      tiltX: 0,
      tiltZ: 0,
    })
  })

  it('suppresses phase posture during manual control, a reaction, or reduced motion', () => {
    expect(phasePose('thinking', 'manual', false, false)).toEqual({
      tiltX: 0,
      tiltZ: 0,
    })
    expect(phasePose('thinking', 'conversation', true, false)).toEqual({
      tiltX: 0,
      tiltZ: 0,
    })
    expect(phasePose('thinking', 'conversation', false, true)).toEqual({
      tiltX: 0,
      tiltZ: 0,
    })
  })

  it('uses restrained distinct emotion poses when companion control owns presentation', () => {
    expect(phasePose('available', 'ambient', false, false, 'happy')).toEqual({
      tiltX: -0.015,
      tiltZ: 0,
    })
    expect(phasePose('available', 'ambient', false, false, 'comfort')).toEqual({
      tiltX: 0.035,
      tiltZ: -0.012,
    })
    expect(phasePose('available', 'ambient', false, false, 'sleepy')).toEqual({
      tiltX: 0,
      tiltZ: 0,
    })
  })

  it('does not add a body tilt for sleep; the rig owns the head-only pose', () => {
    expect(phasePose('available', 'direct_interaction', true, false, 'sleepy')).toEqual({
      tiltX: 0,
      tiltZ: 0,
    })
  })

  it('leaves camera-driven body attention available during a direct one-shot owner', () => {
    expect(phasePose('available', 'direct_interaction', false, false, 'neutral')).toEqual(
      {
        tiltX: 0,
        tiltZ: 0,
      },
    )
  })
})
