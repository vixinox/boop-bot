import { describe, expect, it } from 'vitest'
import { visibleRigJoints } from './ManualInspector'
import type { RigJoint } from '../state/companionStore'

const joints: RigJoint[] = [
  { name: 'Root', parentName: null, depth: 0, helper: false },
  { name: 'Body', parentName: 'Root', depth: 1, helper: false },
  { name: 'Head', parentName: 'Body', depth: 2, helper: false },
  { name: 'PoleTarget.L', parentName: 'Root', depth: 1, helper: true },
]

describe('visibleRigJoints', () => {
  it('keeps matching joints and their ancestors visible during search', () => {
    expect(
      visibleRigJoints(joints, 'head', new Set()).map((joint) => joint.name),
    ).toEqual(['Root', 'Body', 'Head'])
  })

  it('hides descendants of collapsed joints outside search', () => {
    expect(
      visibleRigJoints(joints, '', new Set(['Body'])).map((joint) => joint.name),
    ).toEqual(['Root', 'Body', 'PoleTarget.L'])
  })

  it('does not let collapsed ancestors hide a search result', () => {
    expect(
      visibleRigJoints(joints, 'head', new Set(['Body'])).map((joint) => joint.name),
    ).toEqual(['Root', 'Body', 'Head'])
  })
})
