import { describe, expect, it } from 'vitest'
import {
  evaluateSceneLightIntensity,
  evaluateSceneObjectAnimation,
  sceneAnimationElapsed,
} from './sceneAnimation'

describe('looping scene animation evaluation', () => {
  it('evaluates orbital position and spin phase continuously over repeated periods', () => {
    const animation = {
      id: 'planet',
      orbit: { center: { x: 1, y: 2, z: 3 }, radius: 4, period_ms: 1000, phase_deg: 0 },
      spin: { axis: { x: 0, y: 1, z: 0 }, period_ms: 2000, phase_deg: 0 },
    }
    const first = evaluateSceneObjectAnimation(animation, 0, { x: 0, y: 0, z: 0 })
    const quarter = evaluateSceneObjectAnimation(animation, 250, { x: 0, y: 0, z: 0 })
    const repeated = evaluateSceneObjectAnimation(animation, 1250, { x: 0, y: 0, z: 0 })
    expect(first.position).toMatchObject({ x: 5, y: 2, z: 3 })
    expect(quarter.position.x).toBeCloseTo(1)
    expect(quarter.position.z).toBeCloseTo(7)
    expect(repeated.position.x).toBeCloseTo(quarter.position.x)
    expect(repeated.position.z).toBeCloseTo(quarter.position.z)
    expect(quarter.rotation.y).toBeCloseTo(Math.sin(Math.PI / 8))
  })

  it('pulses light intensity between configured bounds and uses monotonic elapsed time', () => {
    const animation = {
      id: 'key',
      intensity: { min: 1, max: 3, period_ms: 1000, phase_deg: 0 },
    }
    expect(evaluateSceneLightIntensity(animation, 0)).toBe(2)
    expect(evaluateSceneLightIntensity(animation, 250)).toBe(3)
    expect(evaluateSceneLightIntensity(animation, 750)).toBe(1)
    expect(
      sceneAnimationElapsed({ id: 1, startedAtMs: 500, objects: [], lights: [] }, 400),
    ).toBe(0)
  })
})
