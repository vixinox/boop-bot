import { describe, expect, it } from 'vitest'
import {
  classifyTap,
  classifyTouchRegion,
  TAP_MOVE_THRESHOLD_PX,
} from './touchInteraction'

describe('classifyTap', () => {
  const base = {
    start: { x: 10, y: 20 },
    end: { x: 12, y: 22 },
    pointerType: 'mouse' as const,
    button: 0,
  }

  it('accepts stationary primary pointer input within the movement threshold', () => {
    expect(classifyTap(base)).toBe(true)
    expect(
      classifyTap({
        ...base,
        end: { x: base.start.x + TAP_MOVE_THRESHOLD_PX, y: base.start.y },
      }),
    ).toBe(true)
  })

  it('rejects a drag, non-primary mouse button, and canceled pointer', () => {
    expect(classifyTap({ ...base, end: { x: 30, y: 20 } })).toBe(false)
    expect(classifyTap({ ...base, button: 2 })).toBe(false)
    expect(classifyTap({ ...base, cancelled: true })).toBe(false)
  })

  it('rejects multi-touch and gestures beginning or ending on overlays', () => {
    expect(classifyTap({ ...base, multiTouch: true })).toBe(false)
    expect(classifyTap({ ...base, startedOnOverlay: true })).toBe(false)
    expect(classifyTap({ ...base, endedOnOverlay: true })).toBe(false)
  })

  it('accepts touch and pen taps without a mouse-button requirement', () => {
    expect(classifyTap({ ...base, pointerType: 'touch', button: undefined })).toBe(true)
    expect(classifyTap({ ...base, pointerType: 'pen', button: undefined })).toBe(true)
  })
})

describe('classifyTouchRegion', () => {
  it('maps head, torso, and either hand using placed avatar coordinates', () => {
    expect(classifyTouchRegion({ x: 0, y: 1.3, z: 0 })).toMatchObject({ region: 'head' })
    expect(classifyTouchRegion({ x: 0, y: 0.8, z: 0 })).toMatchObject({ region: 'torso' })
    expect(classifyTouchRegion({ x: -0.48, y: 0.85, z: 0 })).toMatchObject({
      region: 'hand',
    })
    expect(classifyTouchRegion({ x: 0.48, y: 0.85, z: 0 })).toMatchObject({
      region: 'hand',
    })
  })

  it('returns the finite world-convertible hit point with the region', () => {
    const point = { x: 0.45, y: 0.8, z: 0.12 }
    const result = classifyTouchRegion(point)
    expect(result).toEqual({ region: 'hand', point })
    expect(result?.point).not.toBe(point)
  })

  it('ignores non-finite and out-of-avatar intersections', () => {
    expect(classifyTouchRegion({ x: Number.NaN, y: 0.8, z: 0 })).toBeNull()
    expect(classifyTouchRegion({ x: 0, y: 1.8, z: 0 })).toBeNull()
    expect(classifyTouchRegion({ x: 1, y: 0.8, z: 0 })).toBeNull()
  })
})
