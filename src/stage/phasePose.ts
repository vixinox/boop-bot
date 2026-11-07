import type {
  BehaviorOwner,
  BehaviorPhase,
  CompanionEmotion,
} from '../state/behaviorPolicy'

export type PhasePose = { tiltX: number; tiltZ: number }

const NEUTRAL_POSE: PhasePose = { tiltX: 0, tiltZ: 0 }

export function phasePose(
  phase: BehaviorPhase,
  owner: BehaviorOwner,
  hasActiveReaction: boolean,
  prefersReducedMotion: boolean,
  emotion: CompanionEmotion = 'neutral',
): PhasePose {
  if (
    owner === 'manual' ||
    (hasActiveReaction && emotion !== 'sleepy') ||
    prefersReducedMotion
  )
    return NEUTRAL_POSE

  if (emotion === 'happy') return { tiltX: -0.015, tiltZ: 0 }
  if (emotion === 'comfort') return { tiltX: 0.035, tiltZ: -0.012 }
  if (emotion === 'sleepy') return NEUTRAL_POSE

  if (phase === 'listening') return { tiltX: -0.018, tiltZ: 0.012 }
  if (phase === 'thinking') return { tiltX: 0.022, tiltZ: -0.008 }
  if (phase === 'settling') return { tiltX: 0.012, tiltZ: 0 }
  return NEUTRAL_POSE
}
