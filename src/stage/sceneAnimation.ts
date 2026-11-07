import type {
  SceneAnimationCommand,
  SceneLightAnimation,
  SceneObjectAnimation,
  SceneVector,
} from '../state/sceneStore'
import { Quaternion, Vector3 } from 'three'

const TAU = Math.PI * 2

export function evaluateSceneObjectAnimation(
  animation: SceneObjectAnimation,
  elapsedMs: number,
  basePosition: SceneVector,
) {
  const position = { ...basePosition }
  let rotation = new Quaternion()
  if (animation.orbit) {
    const { center, radius, period_ms, phase_deg } = animation.orbit
    const angle = (TAU * elapsedMs) / period_ms + (phase_deg * Math.PI) / 180
    position.x = center.x + Math.cos(angle) * radius
    position.z = center.z + Math.sin(angle) * radius
    position.y = center.y
  }
  if (animation.spin) {
    const { axis, period_ms, phase_deg } = animation.spin
    const angle = (TAU * elapsedMs) / period_ms + (phase_deg * Math.PI) / 180
    rotation.setFromAxisAngle(new Vector3(axis.x, axis.y, axis.z), angle)
  }
  return { position, rotation }
}

export function evaluateSceneLightIntensity(
  animation: SceneLightAnimation,
  elapsedMs: number,
) {
  const { min, max, period_ms, phase_deg } = animation.intensity
  const phase = (TAU * elapsedMs) / period_ms + (phase_deg * Math.PI) / 180
  return min + ((max - min) * (1 + Math.sin(phase))) / 2
}

export function sceneAnimationElapsed(command: SceneAnimationCommand, nowMs: number) {
  return Math.max(0, nowMs - command.startedAtMs)
}
