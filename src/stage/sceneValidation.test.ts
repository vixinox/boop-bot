import { describe, expect, it } from 'vitest'
import {
  validateCameraPose,
  validateLightCreate,
  validatePrimitiveCreate,
} from './sceneValidation'

describe('scene command validation', () => {
  it('accepts each typed primitive and finite dimensions without a product maximum', () => {
    const base = { position: { x: 0, y: 1, z: 0 }, color: '#ffffff' }
    const values = [
      { shape: 'box', dimensions: { width: 1, height: 2, depth: 1 } },
      { shape: 'sphere', dimensions: { radius: 1e120 } },
      { shape: 'cylinder', dimensions: { radius_top: 0.5, radius_bottom: 1, height: 2 } },
      { shape: 'cone', dimensions: { radius: 1, height: 2 } },
      { shape: 'torus', dimensions: { major_radius: 1, tube_radius: 0.2 } },
    ]
    for (const value of values)
      expect(validatePrimitiveCreate({ ...base, ...value }).ok).toBe(true)
  })

  it('rejects malformed geometry, non-finite values, and invalid colors', () => {
    expect(
      validatePrimitiveCreate({
        shape: 'sphere',
        position: { x: 0, y: 0, z: 0 },
        dimensions: { width: 1 },
        color: '#ffffff',
      }).ok,
    ).toBe(false)
    expect(
      validatePrimitiveCreate({
        shape: 'sphere',
        position: { x: 0, y: Number.NaN, z: 0 },
        dimensions: { radius: 1 },
        color: '#ffffff',
      }).ok,
    ).toBe(false)
    expect(
      validatePrimitiveCreate({
        shape: 'sphere',
        position: { x: 0, y: 0, z: 0 },
        dimensions: { radius: 1 },
        color: 'blue',
      }).ok,
    ).toBe(false)
  })

  it('validates light type-specific properties and existing camera pose', () => {
    expect(
      validateLightCreate({
        type: 'point',
        color: '#ffffff',
        intensity: 1e200,
        position: { x: 0, y: 1, z: 0 },
      }).ok,
    ).toBe(true)
    expect(
      validateLightCreate({
        type: 'directional',
        color: '#ffffff',
        intensity: 1,
        position: { x: 0, y: 1, z: 0 },
        angle_deg: 30,
      }).ok,
    ).toBe(false)
    expect(
      validateCameraPose({
        position: { x: 0, y: 0, z: 0 },
        target: { x: 0, y: 0, z: 1 },
        fov: 34,
        duration_ms: 800,
      }).ok,
    ).toBe(true)
    expect(
      validateCameraPose({
        position: { x: 0, y: 0, z: 0 },
        target: { x: 0, y: 0, z: 1 },
        fov: 180,
        duration_ms: 800,
      }).ok,
    ).toBe(false)
  })
})
