import { describe, expect, it } from 'vitest'
import { Bone, Euler, MathUtils, Quaternion } from 'three'
import {
  applyBoneRotationOffsets,
  dampBoneRotationOffsets,
  restoreAnimatedQuaternions,
} from './bonePose'

describe('animation pose overlays', () => {
  it('smoothly follows changing external offsets and eases cleared offsets back to zero', () => {
    const current = new Map()
    const target = { Head: { x: 60, y: -30, z: 0 } }
    const first = dampBoneRotationOffsets(current, target, 1 / 60)

    expect(first.Head.x).toBeGreaterThan(0)
    expect(first.Head.x).toBeLessThan(target.Head.x)
    expect(first.Head.y).toBeLessThan(0)

    const second = dampBoneRotationOffsets(current, target, 1 / 60)
    expect(second.Head.x).toBeGreaterThan(first.Head.x)

    const released = dampBoneRotationOffsets(current, {}, 1 / 60)
    expect(released.Head.x).toBeLessThan(second.Head.x)
    expect(released.Head.x).toBeGreaterThan(0)
  })

  it('reapplies offsets to each animation pose without accumulating between frames', () => {
    const head = new Bone()
    head.name = 'Head'
    const bones = new Map([[head.name, head]])
    const animatedQuaternions = new Map([[head, head.quaternion.clone()]])
    const offsets = { Head: { x: 25, y: -10, z: 0 } }
    const expectedOffset = new Quaternion().setFromEuler(
      new Euler(MathUtils.degToRad(25), MathUtils.degToRad(-10), 0, 'XYZ'),
    )

    const firstAnimationPose = new Quaternion().setFromEuler(new Euler(0.2, 0, 0))
    head.quaternion.copy(firstAnimationPose)
    applyBoneRotationOffsets(bones, offsets, animatedQuaternions)
    expect(
      head.quaternion.angleTo(firstAnimationPose.clone().multiply(expectedOffset)),
    ).toBeLessThan(1e-6)

    restoreAnimatedQuaternions(animatedQuaternions)
    const secondAnimationPose = new Quaternion().setFromEuler(new Euler(0, 0.35, 0))
    head.quaternion.copy(secondAnimationPose)
    applyBoneRotationOffsets(bones, offsets, animatedQuaternions)
    expect(
      head.quaternion.angleTo(secondAnimationPose.clone().multiply(expectedOffset)),
    ).toBeLessThan(1e-6)

    restoreAnimatedQuaternions(animatedQuaternions)
    applyBoneRotationOffsets(bones, {}, animatedQuaternions)
    expect(head.quaternion.angleTo(secondAnimationPose)).toBeLessThan(1e-6)
  })
})
