import { useCompanionStore } from '../state/companionStore'
import type { CompanionState } from '../state/companionStore'
import { useSceneStore } from '../state/sceneStore'
import type { SceneState } from '../state/sceneStore'
import { useBehaviorStore } from '../state/behaviorStore'
import type { BehaviorState } from '../state/behaviorPolicy'

export const FIXED_HEMISPHERE_LIGHTS = [
  {
    id: 'hemisphere-stage',
    type: 'hemisphere',
    skyColor: '#ffffff',
    groundColor: '#73847e',
    intensity: 0.55,
    editable: false,
  },
  {
    id: 'hemisphere-canvas',
    type: 'hemisphere',
    skyColor: '#ffffff',
    groundColor: '#73847e',
    intensity: 0.55,
    editable: false,
  },
] as const

export function createSceneSnapshot(
  companion: CompanionState = useCompanionStore.getState(),
  scene: SceneState = useSceneStore.getState(),
  behavior: Pick<
    BehaviorState,
    'phase' | 'emotion' | 'owner'
  > = useBehaviorStore.getState(),
) {
  const currentClip = companion.animations.find(
    (animation) => animation.name === companion.animation,
  )
  return {
    animations: companion.animations
      .filter((animation) => animation.name !== 'Death' && animation.name !== 'Punch')
      .map(({ name, duration, description, affectsHead, affectsNeck }) => ({
        name,
        duration,
        description: description ?? name,
        affectsHead: affectsHead === true,
        affectsNeck: affectsNeck === true,
      })),
    robot: {
      behaviorPhase: behavior.phase,
      emotion: behavior.emotion,
      behaviorOwner: behavior.owner,
      animationSource: companion.animationSource,
      animation: companion.animation,
      timelineActive: companion.timeline !== null,
      timelineStep: companion.timeline ? companion.timelineStepIndex + 1 : null,
      timelineSteps: companion.timeline?.steps.length ?? 0,
      expressions: companion.expressionWeights,
      gazeSuppressedJoints: {
        head: currentClip?.affectsHead === true,
        neck: currentClip?.affectsNeck === true,
      },
    },
    scene: {
      objects: scene.objects,
      lights: scene.lights,
      activeAnimations: scene.sceneAnimation
        ? {
            objects: scene.sceneAnimation.objects,
            lights: scene.sceneAnimation.lights,
          }
        : null,
      fixedLights: FIXED_HEMISPHERE_LIGHTS,
    },
    camera: scene.camera,
  }
}
