import { describe, expect, it } from 'vitest'
import { interpolateOrbitPose } from './cameraOrbit'

describe('interpolateOrbitPose', () => {
  it('interpolates zoom distance directly without cutting inside the orbit', () => {
    const halfway = interpolateOrbitPose(
      { radius: 2, theta: 0, phi: 1 },
      { radius: 6, theta: Math.PI, phi: 2 },
      0.5,
    )

    expect(halfway.radius).toBe(4)
  })

  it('takes the shortest path across the azimuth wrap', () => {
    const halfway = interpolateOrbitPose(
      { radius: 4, theta: Math.PI - 0.1, phi: 1 },
      { radius: 4, theta: -Math.PI + 0.1, phi: 1 },
      0.5,
    )

    expect(Math.abs(halfway.theta)).toBeCloseTo(Math.PI)
  })
})
