import { describe, expect, it } from 'vitest'
import { AnimationClip, NumberKeyframeTrack, QuaternionKeyframeTrack } from 'three'
import {
  hasMorphTargetTrack,
  isLegacyLoopingClip,
  selectClipVariant,
  shouldPauseAutomaticIdle,
  splitAnimationClip,
} from './animationTracks'

describe('animation clip preparation', () => {
  it('keeps Auto Idle pose while giving manual expression control its own morph-free clip', () => {
    const clip = new AnimationClip('Wave', 2, [
      new NumberKeyframeTrack('Head.morphTargetInfluences[0]', [0, 2], [0, 1]),
      new NumberKeyframeTrack('Head.quaternion[0]', [0, 2], [0, 1]),
    ])
    const { autoClip, manualClip, expressionClip } = splitAnimationClip(clip)
    expect(autoClip.tracks).toHaveLength(2)
    expect(manualClip.tracks.map((track) => track.name)).toEqual(['Head.quaternion[0]'])
    expect(selectClipVariant({ autoClip, manualClip, expressionClip }, false)).toBe(autoClip)
    expect(selectClipVariant({ autoClip, manualClip, expressionClip }, true)).toBe(
      manualClip,
    )
    expect(
      hasMorphTargetTrack(
        selectClipVariant({ autoClip, manualClip, expressionClip }, false),
        'Head',
        0,
      ),
    ).toBe(true)
    expect(
      hasMorphTargetTrack(selectClipVariant({ autoClip, manualClip, expressionClip }, true), 'Head', 0),
    ).toBe(false)
    expect(selectClipVariant({ autoClip, manualClip, expressionClip }, false, true)).toBe(
      expressionClip,
    )
    expect(
      hasMorphTargetTrack(
        selectClipVariant({ autoClip, manualClip, expressionClip }, false, true),
        'Head',
        0,
      ),
    ).toBe(false)
  })

  it('removes Idle head yaw in Auto and expression-only control, but preserves it in behavior manual', () => {
    const sourceValues = [0, 0, 0, 1, 0, 0.3826834, 0, 0.9238795]
    const clip = new AnimationClip('Idle', 1, [
      new QuaternionKeyframeTrack('Head.quaternion', [0, 1], sourceValues),
      new NumberKeyframeTrack('Head.morphTargetInfluences[0]', [0, 1], [0, 0]),
    ])

    const { autoClip, manualClip, expressionClip } = splitAnimationClip(clip)

    expect(Array.from(autoClip.tracks[0]?.values ?? [])).toEqual([0, 0, 0, 1, 0, 0, 0, 1])
    expect(Array.from(expressionClip.tracks[0]?.values ?? [])).toEqual(
      Array.from(autoClip.tracks[0]?.values ?? []),
    )
    expect(Array.from(clip.tracks[0]?.values ?? [])).toEqual(
      Array.from(new Float32Array(sourceValues)),
    )
    expect(Array.from(manualClip.tracks[0]?.values ?? [])).not.toEqual(
      Array.from(autoClip.tracks[0]?.values ?? []),
    )
    expect(autoClip.tracks).toHaveLength(2)
    expect(expressionClip.tracks).toHaveLength(1)
    expect(manualClip.tracks).toHaveLength(1)
  })

  it('loops only the specified continuous clips by default', () => {
    expect(isLegacyLoopingClip('Idle')).toBe(true)
    expect(isLegacyLoopingClip('Running')).toBe(true)
    expect(isLegacyLoopingClip('Jump')).toBe(false)
  })

  it('reduces autonomous Idle motion while preserving explicit actions', () => {
    expect(shouldPauseAutomaticIdle(true, 'Idle', false)).toBe(true)
    expect(shouldPauseAutomaticIdle(true, 'Idle', true)).toBe(false)
    expect(shouldPauseAutomaticIdle(true, 'Wave', false)).toBe(false)
    expect(shouldPauseAutomaticIdle(false, 'Idle', false)).toBe(false)
  })

  it('matches morph tracks to their mesh and target index', () => {
    const clip = new AnimationClip('Wave', 2, [
      new NumberKeyframeTrack('Head.morphTargetInfluences[1]', [0, 2], [0, 1]),
    ])
    expect(hasMorphTargetTrack(clip, 'Head', 1)).toBe(true)
    expect(hasMorphTargetTrack(clip, 'Head', 0)).toBe(false)
    expect(hasMorphTargetTrack(clip, 'Body', 1)).toBe(false)
  })
})
