import { Euler, MathUtils, Quaternion } from 'three'
import type { Bone } from 'three'
import type { BoneRotation } from '../state/companionStore'

export function dampBoneRotationOffsets(
  current: Map<string, BoneRotation>,
  targets: Record<string, BoneRotation>,
  delta: number,
  lambda = 12,
): Record<string, BoneRotation> {
  const smoothed: Record<string, BoneRotation> = {}
  const names = new Set([...current.keys(), ...Object.keys(targets)])

  for (const name of names) {
    const from = current.get(name) ?? { x: 0, y: 0, z: 0 }
    const target = targets[name] ?? { x: 0, y: 0, z: 0 }
    const next = {
      x: MathUtils.damp(from.x, target.x, lambda, delta),
      y: MathUtils.damp(from.y, target.y, lambda, delta),
      z: MathUtils.damp(from.z, target.z, lambda, delta),
    }
    if (Math.abs(next.x) + Math.abs(next.y) + Math.abs(next.z) < 1e-4) {
      current.delete(name)
    } else {
      current.set(name, next)
      smoothed[name] = next
    }
  }

  return smoothed
}

export function restoreAnimatedQuaternions(quaternions: ReadonlyMap<Bone, Quaternion>) {
  for (const [bone, quaternion] of quaternions) bone.quaternion.copy(quaternion)
}

export function applyBoneRotationOffsets(
  bones: ReadonlyMap<string, Bone>,
  offsets: Record<string, BoneRotation>,
  animatedQuaternions: Map<Bone, Quaternion>,
) {
  for (const [name, bone] of bones) {
    const animatedQuaternion = animatedQuaternions.get(bone)
    if (!animatedQuaternion) continue
    animatedQuaternion.copy(bone.quaternion)
    const offset = offsets[name]
    if (!offset) continue
    bone.quaternion.multiply(
      new Quaternion().setFromEuler(
        new Euler(
          MathUtils.degToRad(offset.x),
          MathUtils.degToRad(offset.y),
          MathUtils.degToRad(offset.z),
          'XYZ',
        ),
      ),
    )
  }
}
