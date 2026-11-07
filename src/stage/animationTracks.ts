import { Euler, Quaternion } from 'three'
import type { AnimationClip } from 'three'

function removeIdleHeadYaw(clip: AnimationClip) {
  const track = clip.tracks.find((candidate) => candidate.name === 'Head.quaternion')
  if (!track || track.values.length === 0) return

  const quaternion = new Quaternion()
  const euler = new Euler()
  for (let offset = 0; offset < track.values.length; offset += 4) {
    quaternion.fromArray(track.values, offset)
    euler.setFromQuaternion(quaternion)
    euler.y = 0
    quaternion.setFromEuler(euler).toArray(track.values, offset)
    for (let component = offset; component < offset + 4; component += 1) {
      if (Object.is(track.values[component], -0)) track.values[component] = 0
    }
  }
}

export function hasMorphTargetTrack(
  clip: AnimationClip | undefined,
  meshName: string,
  targetIndex: number,
) {
  if (!clip) return false
  return clip.tracks.some(
    (track) => track.name === `${meshName}.morphTargetInfluences[${targetIndex}]`,
  )
}

export function splitAnimationClip(clip: AnimationClip) {
  const autoClip = clip.clone()
  const manualClip = clip.clone()
  const expressionClip = autoClip.clone()
  if (clip.name === 'Idle') removeIdleHeadYaw(autoClip)
  if (clip.name === 'Idle') removeIdleHeadYaw(expressionClip)
  manualClip.tracks = manualClip.tracks.filter(
    (track) => !/\.morphTargetInfluences(?:\[|$)/.test(track.name),
  )
  expressionClip.tracks = expressionClip.tracks.filter(
    (track) => !/\.morphTargetInfluences(?:\[|$)/.test(track.name),
  )
  return { autoClip, manualClip, expressionClip }
}

export function selectClipVariant<T>(
  variants: { autoClip: T; manualClip: T; expressionClip: T },
  manualOwner: boolean,
  expressionOverride = false,
) {
  if (manualOwner) return variants.manualClip
  return expressionOverride ? variants.expressionClip : variants.autoClip
}

export function shouldPauseAutomaticIdle(
  prefersReducedMotion: boolean,
  clipName: string,
  manualOwner: boolean,
) {
  return prefersReducedMotion && clipName === 'Idle' && !manualOwner
}

export function isLegacyLoopingClip(clipName: string) {
  return ['Dance', 'Idle', 'Running', 'Sitting', 'Standing', 'Walking'].includes(clipName)
}
