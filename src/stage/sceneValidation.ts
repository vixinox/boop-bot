import type {
  CameraPoseCommand,
  PrimitiveDimensions,
  PrimitiveShape,
  SceneLight,
  ScenePrimitive,
  SceneVector,
  SceneObjectAnimation,
  SceneLightAnimation,
} from '../state/sceneStore'

export type ValidationIssue = {
  code: string
  message: string
  path?: string
  expected?: string
  repair: string
}
type Validation<T> = { ok: true; value: T } | { ok: false; error: ValidationIssue }
const valid = <T>(value: T): Validation<T> => ({ ok: true, value })
const invalid = <T = never>(
  message: string,
  code = 'INVALID_TOOL_ARGUMENTS',
  path?: string,
  expected?: string,
  repair?: string,
): Validation<T> => ({
  ok: false,
  error: {
    code,
    message,
    ...(path ? { path } : {}),
    ...(expected ? { expected } : {}),
    repair: repair ?? 'Check the tool schema and retry with valid arguments.',
  },
})

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function hasOnlyKeys(value: Record<string, unknown>, allowed: readonly string[]) {
  return Object.keys(value).every((key) => allowed.includes(key))
}

export function validateSceneVector(value: unknown): Validation<SceneVector> {
  if (!isRecord(value) || !hasOnlyKeys(value, ['x', 'y', 'z']))
    return invalid('Vector must contain only x, y, and z')
  const { x, y, z } = value
  if (
    ![x, y, z].every(
      (component) => typeof component === 'number' && Number.isFinite(component),
    )
  )
    return invalid('Vector components must be finite numbers')
  return valid({ x: x as number, y: y as number, z: z as number })
}

export function validateSceneAnimations(
  value: unknown,
  objectIds: readonly string[],
  lightIds: readonly string[],
): Validation<{ objects: SceneObjectAnimation[]; lights: SceneLightAnimation[] }> {
  if (!isRecord(value) || !hasOnlyKeys(value, ['objects', 'lights']))
    return invalid(
      'Animation command requires only objects and lights',
      'INVALID_SCENE_ANIMATION',
    )
  const objects = value.objects
  const lights = value.lights
  if (
    !Array.isArray(objects) ||
    !Array.isArray(lights) ||
    objects.length + lights.length === 0
  )
    return invalid(
      'Provide at least one object or light animation',
      'INVALID_SCENE_ANIMATION',
    )
  const validPeriod = (period: unknown) =>
    typeof period === 'number' && Number.isFinite(period) && period > 0
  const validPhase = (phase: unknown) =>
    typeof phase === 'number' && Number.isFinite(phase)
  const parsedObjects: SceneObjectAnimation[] = []
  const seenObjects = new Set<string>()
  for (const item of objects) {
    if (
      !isRecord(item) ||
      !hasOnlyKeys(item, ['id', 'orbit', 'spin']) ||
      typeof item.id !== 'string' ||
      !objectIds.includes(item.id) ||
      seenObjects.has(item.id) ||
      (!Object.hasOwn(item, 'orbit') && !Object.hasOwn(item, 'spin'))
    )
      return invalid(
        'Object animation needs a unique current primitive ID and orbit or spin',
        'INVALID_SCENE_ANIMATION',
        'objects',
        'unique IDs from inspect_scene',
        'Call inspect_scene and provide each current primitive ID once with orbit and/or spin.',
      )
    const entry: SceneObjectAnimation = { id: item.id }
    if (Object.hasOwn(item, 'orbit')) {
      const orbit = item.orbit
      if (
        !isRecord(orbit) ||
        !hasOnlyKeys(orbit, ['center', 'radius', 'period_ms', 'phase_deg'])
      )
        return invalid(
          'Orbit requires center, radius, period_ms, and phase_deg',
          'INVALID_SCENE_ANIMATION',
          'objects.orbit',
        )
      const center = validateSceneVector(orbit.center)
      if (
        !center.ok ||
        typeof orbit.radius !== 'number' ||
        !Number.isFinite(orbit.radius) ||
        orbit.radius < 0 ||
        !validPeriod(orbit.period_ms) ||
        !validPhase(orbit.phase_deg)
      )
        return invalid(
          'Orbit values must be finite, with radius >= 0 and period_ms > 0',
          'INVALID_SCENE_ANIMATION',
          'objects.orbit',
          'finite center, non-negative radius, positive period_ms and finite phase_deg',
        )
      entry.orbit = {
        center: center.value,
        radius: orbit.radius as number,
        period_ms: orbit.period_ms as number,
        phase_deg: orbit.phase_deg as number,
      }
    }
    if (Object.hasOwn(item, 'spin')) {
      const spin = item.spin
      if (!isRecord(spin) || !hasOnlyKeys(spin, ['axis', 'period_ms', 'phase_deg']))
        return invalid(
          'Spin requires axis, period_ms, and phase_deg',
          'INVALID_SCENE_ANIMATION',
          'objects.spin',
        )
      const axis = validateSceneVector(spin.axis)
      if (
        !axis.ok ||
        Math.hypot(axis.value.x, axis.value.y, axis.value.z) === 0 ||
        !validPeriod(spin.period_ms) ||
        !validPhase(spin.phase_deg)
      )
        return invalid(
          'Spin axis must be non-zero and period_ms positive; all values must be finite',
          'INVALID_SCENE_ANIMATION',
          'objects.spin',
        )
      const length = Math.hypot(axis.value.x, axis.value.y, axis.value.z)
      entry.spin = {
        axis: {
          x: axis.value.x / length,
          y: axis.value.y / length,
          z: axis.value.z / length,
        },
        period_ms: spin.period_ms as number,
        phase_deg: spin.phase_deg as number,
      }
    }
    seenObjects.add(item.id)
    parsedObjects.push(entry)
  }
  const parsedLights: SceneLightAnimation[] = []
  const seenLights = new Set<string>()
  for (const item of lights) {
    if (
      !isRecord(item) ||
      !hasOnlyKeys(item, ['id', 'intensity']) ||
      typeof item.id !== 'string' ||
      !lightIds.includes(item.id) ||
      seenLights.has(item.id)
    )
      return invalid(
        'Light animation needs a unique current light ID',
        'INVALID_SCENE_ANIMATION',
        'lights',
        'unique IDs from inspect_scene',
        'Call inspect_scene and provide each current light ID once.',
      )
    const intensity = item.intensity
    if (
      !isRecord(intensity) ||
      !hasOnlyKeys(intensity, ['min', 'max', 'period_ms', 'phase_deg']) ||
      typeof intensity.min !== 'number' ||
      !Number.isFinite(intensity.min) ||
      intensity.min < 0 ||
      typeof intensity.max !== 'number' ||
      !Number.isFinite(intensity.max) ||
      intensity.max < intensity.min ||
      !validPeriod(intensity.period_ms) ||
      !validPhase(intensity.phase_deg)
    )
      return invalid(
        'Intensity animation requires 0 <= min <= max, positive period_ms and finite phase_deg',
        'INVALID_SCENE_ANIMATION',
        'lights.intensity',
      )
    seenLights.add(item.id)
    parsedLights.push({
      id: item.id,
      intensity: {
        min: intensity.min as number,
        max: intensity.max as number,
        period_ms: intensity.period_ms as number,
        phase_deg: intensity.phase_deg as number,
      },
    })
  }
  return valid({ objects: parsedObjects, lights: parsedLights })
}

function validateColor(value: unknown): value is string {
  return typeof value === 'string' && /^#[0-9a-fA-F]{6}$/.test(value)
}

function validatePositiveDimension(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
}

const dimensionKeys: Record<PrimitiveShape, readonly string[]> = {
  box: ['width', 'height', 'depth'],
  sphere: ['radius'],
  cylinder: ['radius_top', 'radius_bottom', 'height'],
  cone: ['radius', 'height'],
  torus: ['major_radius', 'tube_radius'],
}

function validateDimensions(
  shape: PrimitiveShape,
  value: unknown,
  partial: boolean,
): Validation<PrimitiveDimensions | Partial<PrimitiveDimensions>> {
  if (!isRecord(value))
    return invalid(
      'Dimensions must be an object',
      'INVALID_DIMENSIONS',
      'dimensions',
      'an object with shape-specific fields',
      'Pass dimensions as an object containing only fields for the selected shape.',
    )
  const expected = dimensionKeys[shape]
  if (!Object.keys(value).length || !hasOnlyKeys(value, expected))
    return invalid(
      `Invalid dimensions for ${shape}`,
      'INVALID_DIMENSIONS_FOR_SHAPE',
      'dimensions',
      expected.join(', '),
      `Keep only ${expected.join(', ')} and provide every listed field with a finite number greater than 0.`,
    )
  if (Object.values(value).some((item) => !validatePositiveDimension(item)))
    return invalid(
      'Dimensions must be finite positive numbers',
      'INVALID_DIMENSION_VALUE',
      'dimensions',
      'finite numbers greater than 0',
      'Replace every dimension with a finite number greater than 0.',
    )
  if (!partial && expected.some((key) => !Object.hasOwn(value, key)))
    return invalid(
      `Missing dimensions for ${shape}`,
      'MISSING_DIMENSIONS_FOR_SHAPE',
      'dimensions',
      expected.join(', '),
      `Add every missing field: ${expected.filter((key) => !Object.hasOwn(value, key)).join(', ')}.`,
    )
  return valid(value as PrimitiveDimensions | Partial<PrimitiveDimensions>)
}

export function validatePrimitiveCreate(
  value: unknown,
): Validation<Omit<ScenePrimitive, 'id'>> {
  if (
    !isRecord(value) ||
    !hasOnlyKeys(value, ['shape', 'position', 'dimensions', 'color']) ||
    Object.keys(value).length !== 4
  )
    return invalid(
      'Primitive creation requires shape, position, dimensions, and color',
      'MISSING_REQUIRED_FIELDS',
      undefined,
      'shape, position, dimensions, color',
      'Provide shape, position {x,y,z}, shape-specific dimensions, and a #RRGGBB color.',
    )
  const shapes: PrimitiveShape[] = ['box', 'sphere', 'cylinder', 'cone', 'torus']
  if (typeof value.shape !== 'string' || !shapes.includes(value.shape as PrimitiveShape))
    return invalid('Unknown primitive shape')
  const position = validateSceneVector(value.position)
  if (!position.ok) return position
  if (!validateColor(value.color))
    return invalid(
      'Color must use #RRGGBB format',
      'INVALID_COLOR',
      'color',
      '#RRGGBB',
      'Use a six-digit hexadecimal color such as #72B7D9.',
    )
  const dimensions = validateDimensions(
    value.shape as PrimitiveShape,
    value.dimensions,
    false,
  )
  if (!dimensions.ok) return dimensions
  return valid({
    shape: value.shape as PrimitiveShape,
    position: position.value,
    dimensions: dimensions.value as PrimitiveDimensions,
    color: value.color,
  })
}

export function validatePrimitiveUpdate(
  existing: ScenePrimitive,
  value: unknown,
): Validation<Partial<Omit<ScenePrimitive, 'id' | 'shape'>>> {
  if (!isRecord(value) || !hasOnlyKeys(value, ['position', 'dimensions', 'color']))
    return invalid('Primitive update contains unknown fields')
  if (!Object.keys(value).length) return invalid('Primitive update is empty')
  const patch: Partial<Omit<ScenePrimitive, 'id' | 'shape'>> = {}
  if (Object.hasOwn(value, 'position')) {
    const position = validateSceneVector(value.position)
    if (!position.ok) return position
    patch.position = position.value
  }
  if (Object.hasOwn(value, 'dimensions')) {
    const partial = validateDimensions(existing.shape, value.dimensions, true)
    if (!partial.ok) return partial
    const merged = { ...existing.dimensions, ...partial.value }
    const complete = validateDimensions(existing.shape, merged, false)
    if (!complete.ok) return complete
    patch.dimensions = complete.value as PrimitiveDimensions
  }
  if (Object.hasOwn(value, 'color')) {
    if (!validateColor(value.color))
      return invalid(
        'Color must use #RRGGBB format',
        'INVALID_COLOR',
        'color',
        '#RRGGBB',
        'Use a six-digit hexadecimal color such as #72B7D9.',
      )
    patch.color = value.color
  }
  return valid(patch)
}

function validateNonNegative(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
}

function validateLightFields(
  type: SceneLight['type'],
  value: Record<string, unknown>,
  creating: boolean,
): Validation<Partial<SceneLight>> {
  const allowed = ['color', 'intensity', 'position', 'target', 'distance', 'angle_deg']
  if (!hasOnlyKeys(value, allowed)) return invalid('Light contains unknown fields')
  if (creating && (!validateColor(value.color) || !validateNonNegative(value.intensity)))
    return invalid('Light requires a valid color and finite non-negative intensity')
  if (!creating && !Object.keys(value).length) return invalid('Light update is empty')
  const patch: Partial<SceneLight> = {}
  if (Object.hasOwn(value, 'color')) {
    if (!validateColor(value.color)) return invalid('Color must use #RRGGBB format')
    patch.color = value.color
  }
  if (Object.hasOwn(value, 'intensity')) {
    if (!validateNonNegative(value.intensity))
      return invalid('Light intensity must be finite and non-negative')
    patch.intensity = value.intensity as number
  }
  if (Object.hasOwn(value, 'position')) {
    if (type === 'ambient') return invalid('Ambient lights do not have a position')
    const position = validateSceneVector(value.position)
    if (!position.ok) return position
    patch.position = position.value
  }
  if (Object.hasOwn(value, 'target')) {
    if (type !== 'directional' && type !== 'spot')
      return invalid('Only directional and spot lights have a target')
    const target = validateSceneVector(value.target)
    if (!target.ok) return target
    patch.target = target.value
  }
  if (Object.hasOwn(value, 'distance')) {
    if (type !== 'point' && type !== 'spot')
      return invalid('Only point and spot lights have a distance')
    if (!validateNonNegative(value.distance))
      return invalid('Light distance must be finite and non-negative')
    patch.distance = value.distance as number
  }
  if (Object.hasOwn(value, 'angle_deg')) {
    if (type !== 'spot') return invalid('Only spot lights have an angle')
    if (
      typeof value.angle_deg !== 'number' ||
      !Number.isFinite(value.angle_deg) ||
      value.angle_deg <= 0 ||
      value.angle_deg >= 180
    )
      return invalid('Spot angle must be finite and between 0 and 180 degrees')
    patch.angle_deg = value.angle_deg
  }
  if (creating) {
    if (type !== 'ambient' && !Object.hasOwn(value, 'position'))
      return invalid('Non-ambient lights require a position')
    if (type === 'spot' && !Object.hasOwn(value, 'angle_deg')) patch.angle_deg = 45
    if ((type === 'spot' || type === 'point') && !Object.hasOwn(value, 'distance'))
      patch.distance = 0
  }
  return valid(patch)
}

export function validateLightCreate(
  value: unknown,
): Validation<Omit<SceneLight, 'id' | 'builtIn'>> {
  if (
    !isRecord(value) ||
    !hasOnlyKeys(value, [
      'type',
      'color',
      'intensity',
      'position',
      'target',
      'distance',
      'angle_deg',
    ])
  )
    return invalid('Invalid light creation fields')
  if (value.type !== 'directional' && value.type !== 'point' && value.type !== 'spot')
    return invalid('Only directional, point, and spot lights can be created')
  const fields = { ...value }
  delete fields.type
  const parsed = validateLightFields(value.type, fields, true)
  if (!parsed.ok) return parsed
  return valid({
    type: value.type,
    color: parsed.value.color!,
    intensity: parsed.value.intensity!,
    ...(parsed.value.position ? { position: parsed.value.position } : {}),
    ...(parsed.value.target ? { target: parsed.value.target } : {}),
    ...(parsed.value.distance !== undefined ? { distance: parsed.value.distance } : {}),
    ...(parsed.value.angle_deg !== undefined
      ? { angle_deg: parsed.value.angle_deg }
      : {}),
  })
}

export function validateLightUpdate(
  existing: SceneLight,
  value: unknown,
): Validation<Partial<Omit<SceneLight, 'id' | 'builtIn' | 'type'>>> {
  if (!isRecord(value)) return invalid('Light update must be an object')
  const parsed = validateLightFields(existing.type, value, false)
  return parsed as Validation<Partial<Omit<SceneLight, 'id' | 'builtIn' | 'type'>>>
}

export function validateCameraPose(
  value: unknown,
): Validation<Omit<CameraPoseCommand, 'id'>> {
  if (
    !isRecord(value) ||
    !hasOnlyKeys(value, ['position', 'target', 'fov', 'duration_ms']) ||
    Object.keys(value).length !== 4
  )
    return invalid('Camera pose requires position, target, fov, and duration_ms')
  const position = validateSceneVector(value.position)
  if (!position.ok) return position
  const target = validateSceneVector(value.target)
  if (!target.ok) return target
  if (
    position.value.x === target.value.x &&
    position.value.y === target.value.y &&
    position.value.z === target.value.z
  )
    return invalid(
      'Camera position and target must differ',
      'CAMERA_TARGET_EQUALS_POSITION',
      'target',
      'a target different from position',
      'Choose a look-at target different from the camera position.',
    )
  const distance = Math.hypot(
    position.value.x - target.value.x,
    position.value.y - target.value.y,
    position.value.z - target.value.z,
  )
  if (!Number.isFinite(distance) || distance === 0)
    return invalid('Camera position and target distance must be finite and positive')
  if (
    typeof value.fov !== 'number' ||
    !Number.isFinite(value.fov) ||
    value.fov <= 0 ||
    value.fov >= 180
  )
    return invalid(
      'FOV must be finite and between 0 and 180 degrees',
      'INVALID_CAMERA_FOV',
      'fov',
      'a number greater than 0 and less than 180 degrees',
      'Choose a finite FOV in degrees strictly between 0 and 180.',
    )
  if (
    typeof value.duration_ms !== 'number' ||
    !Number.isInteger(value.duration_ms) ||
    value.duration_ms < 200 ||
    value.duration_ms > 1500
  )
    return invalid('Camera duration must be an integer between 200 and 1500 ms')
  return valid({
    position: position.value,
    target: target.value,
    fov: value.fov,
    duration_ms: value.duration_ms,
  })
}
