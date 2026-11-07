import { describe, expect, it } from 'vitest'
import {
  Bone,
  Group,
  NumberKeyframeTrack,
  QuaternionKeyframeTrack,
  SkinnedMesh,
  Skeleton,
} from 'three'
import { animationCatalog, buildRigCatalog, collectSkinnedBones } from './rig'

describe('rig catalog', () => {
  it('collects stable unique skin bones and reports helper joints', () => {
    const root = new Group()
    const body = new Bone()
    body.name = 'Body'
    const helper = new Bone()
    helper.name = 'PoleTarget.L'
    const head = new Bone()
    head.name = 'Head'
    root.add(body)
    body.add(head)
    root.add(helper)
    const mesh = new SkinnedMesh()
    mesh.bind(new Skeleton([body, head, helper]))
    root.add(mesh)

    const bones = collectSkinnedBones(root)
    expect(bones).toEqual([body, head, helper])
    expect(buildRigCatalog(bones)).toEqual([
      { name: 'Body', parentName: null, depth: 0, helper: false },
      { name: 'Head', parentName: 'Body', depth: 1, helper: false },
      { name: 'PoleTarget.L', parentName: null, depth: 0, helper: true },
    ])
  })

  it('filters unknown clip names but preserves order and durations', () => {
    expect(
      animationCatalog(
        [
          { name: 'Idle', duration: 3 },
          { name: 'Custom', duration: 1 },
          { name: 'Wave', duration: 2 },
        ],
        ['Idle', 'Wave'],
      ),
    ).toEqual([
      {
        name: 'Idle',
        duration: 3,
        description: '放松站立与呼吸',
        affectsHead: false,
        affectsNeck: false,
      },
      {
        name: 'Wave',
        duration: 2,
        description: '抬手挥手问候',
        affectsHead: false,
        affectsNeck: false,
      },
    ])
  })

  it('derives gaze conflicts from head and neck transform tracks, not morph tracks', () => {
    expect(
      animationCatalog(
        [
          {
            name: 'Wave',
            duration: 2,
            tracks: [
              new QuaternionKeyframeTrack(
                'Neck.quaternion',
                [0, 2],
                [0, 0, 0, 1, 0, 0, 0, 1],
              ),
              new NumberKeyframeTrack('Head.morphTargetInfluences[0]', [0, 2], [0, 1]),
            ],
          },
          {
            name: 'Idle',
            duration: 2,
            tracks: [
              new NumberKeyframeTrack('Head.morphTargetInfluences[0]', [0, 2], [0, 1]),
            ],
          },
        ],
        ['Wave', 'Idle'],
      ),
    ).toMatchObject([
      { name: 'Wave', affectsHead: false, affectsNeck: true },
      { name: 'Idle', affectsHead: false, affectsNeck: false },
    ])
  })
})
