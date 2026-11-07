export const TAP_MOVE_THRESHOLD_PX = 7

export type PointerPoint = { x: number; y: number }
export type TouchRegion = 'head' | 'torso' | 'hand'

export type TapClassificationInput = {
  start: PointerPoint
  end: PointerPoint
  pointerType: 'mouse' | 'touch' | 'pen'
  button?: number
  cancelled?: boolean
  multiTouch?: boolean
  startedOnOverlay?: boolean
  endedOnOverlay?: boolean
}

function finitePoint(point: PointerPoint) {
  return Number.isFinite(point.x) && Number.isFinite(point.y)
}

export function classifyTap(input: TapClassificationInput): boolean {
  if (
    input.cancelled ||
    input.multiTouch ||
    input.startedOnOverlay ||
    input.endedOnOverlay ||
    !finitePoint(input.start) ||
    !finitePoint(input.end) ||
    (input.pointerType === 'mouse' && input.button !== 0)
  )
    return false

  return (
    Math.hypot(input.end.x - input.start.x, input.end.y - input.start.y) <=
    TAP_MOVE_THRESHOLD_PX
  )
}

/**
 * Classifies points in the placed avatar group's local coordinates: floor at y=0,
 * centered on x=0, and a normalized model height of 1.55 units.
 */
export function classifyTouchRegion(point: {
  x: number
  y: number
  z: number
}): { region: TouchRegion; point: { x: number; y: number; z: number } } | null {
  if (![point.x, point.y, point.z].every(Number.isFinite)) return null
  if (point.y < 0.38 || point.y > 1.55) return null

  const x = Math.abs(point.x)
  const z = Math.abs(point.z)
  if (point.y >= 1.12 && x <= 0.34 && z <= 0.3)
    return { region: 'head', point: { ...point } }
  if (point.y >= 0.52 && point.y <= 1.18 && x >= 0.31 && x <= 0.78 && z <= 0.31)
    return { region: 'hand', point: { ...point } }
  if (point.y >= 0.38 && point.y <= 1.2 && x <= 0.34 && z <= 0.34)
    return { region: 'torso', point: { ...point } }
  return null
}
