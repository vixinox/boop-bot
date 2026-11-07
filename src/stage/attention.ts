export type AttentionDirection = { x: number; y: number; z: number }

export type AttentionState = {
  bodyYaw: number
  headYaw: number
  headPitch: number
  candidateYaw: number | null
  candidateMs: number
}

export const BODY_FOLLOW_THRESHOLD_RAD = 0.62
export const BODY_FOLLOW_SUSTAIN_MS = 700
export const BODY_RETURN_THRESHOLD_RAD = 0.24
export const MAX_HEAD_YAW_RAD = 0.85
export const MAX_HEAD_PITCH_RAD = 0.06
export const BODY_TURN_RATE_RAD_PER_SECOND = 0.9
export const HEAD_TURN_RATE_RAD_PER_SECOND = 3.8

const MAX_DELTA_SECONDS = 0.05
const CANDIDATE_STABILITY_RAD = 0.16

export function createAttentionState(): AttentionState {
  return {
    bodyYaw: 0,
    headYaw: 0,
    headPitch: 0,
    candidateYaw: null,
    candidateMs: 0,
  }
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

export function normalizeAngle(angle: number) {
  return Math.atan2(Math.sin(angle), Math.cos(angle))
}

export function angleDelta(from: number, to: number) {
  return normalizeAngle(to - from)
}

function dampAngle(current: number, target: number, rate: number, deltaSeconds: number) {
  const alpha = 1 - Math.exp(-rate * deltaSeconds)
  return normalizeAngle(current + angleDelta(current, target) * alpha)
}

export function stepAttention(
  current: AttentionState,
  direction: AttentionDirection | null,
  deltaSeconds: number,
): AttentionState {
  if (!Number.isFinite(deltaSeconds) || deltaSeconds <= 0) return current
  const delta = Math.min(MAX_DELTA_SECONDS, deltaSeconds)
  let desiredYaw = 0
  let desiredPitch = 0

  if (direction && [direction.x, direction.y, direction.z].every(Number.isFinite)) {
    const length = Math.hypot(direction.x, direction.y, direction.z)
    if (length > 1e-6) {
      const x = direction.x / length
      const y = direction.y / length
      const z = direction.z / length
      desiredYaw = Math.atan2(x, z)
      desiredPitch = Math.atan2(y, Math.hypot(x, z))
    }
  }

  const bodyDifference = Math.abs(angleDelta(current.bodyYaw, desiredYaw))
  let candidateYaw = current.candidateYaw
  let candidateMs = current.candidateMs
  let bodyTarget = current.bodyYaw

  if (bodyDifference >= BODY_FOLLOW_THRESHOLD_RAD) {
    if (
      candidateYaw === null ||
      Math.abs(angleDelta(candidateYaw, desiredYaw)) >= CANDIDATE_STABILITY_RAD
    ) {
      candidateYaw = desiredYaw
      candidateMs = 0
    } else {
      candidateMs += delta * 1000
      candidateYaw = desiredYaw
    }
    if (candidateMs >= BODY_FOLLOW_SUSTAIN_MS) bodyTarget = desiredYaw
  } else {
    candidateYaw = null
    candidateMs = 0
  }

  if (Math.abs(desiredYaw) <= BODY_RETURN_THRESHOLD_RAD) bodyTarget = desiredYaw

  const bodyYaw = dampAngle(
    current.bodyYaw,
    bodyTarget,
    BODY_TURN_RATE_RAD_PER_SECOND,
    delta,
  )
  const headYawTarget = clamp(
    angleDelta(bodyYaw, desiredYaw),
    -MAX_HEAD_YAW_RAD,
    MAX_HEAD_YAW_RAD,
  )

  return {
    bodyYaw,
    headYaw: dampAngle(
      current.headYaw,
      headYawTarget,
      HEAD_TURN_RATE_RAD_PER_SECOND,
      delta,
    ),
    headPitch: clamp(
      current.headPitch +
        (clamp(desiredPitch, -MAX_HEAD_PITCH_RAD, MAX_HEAD_PITCH_RAD) -
          current.headPitch) *
          (1 - Math.exp(-HEAD_TURN_RATE_RAD_PER_SECOND * delta)),
      -MAX_HEAD_PITCH_RAD,
      MAX_HEAD_PITCH_RAD,
    ),
    candidateYaw,
    candidateMs,
  }
}
