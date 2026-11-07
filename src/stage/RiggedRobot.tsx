import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import { clone } from 'three/addons/utils/SkeletonUtils.js'
import {
  AnimationMixer,
  Bone,
  Box3,
  Group,
  LoopOnce,
  LoopRepeat,
  MathUtils,
  Mesh,
  Quaternion,
  Vector3,
} from 'three'
import type { AnimationAction, Object3D } from 'three'
import {
  ANIMATION_NAMES,
  EXPRESSION_NAMES,
  useCompanionStore,
} from '../state/companionStore'
import type { AnimationTimeline, BoneRotation } from '../state/companionStore'
import type { ExpressionName, ExpressionWeights } from '../state/companionStore'
import { dispatchBehaviorEvent, useBehaviorStore } from '../state/behaviorStore'
import type { AttentionTarget } from '../state/behaviorPolicy'
import { companionActionPresentation } from './companionActions'
import {
  abandonAiPresentation,
  completeAiPresentation,
  cancelAllAiPresentations,
  cancelQueuedPresentations,
  getActiveAiPresentationReactionId,
} from './toolExecutor'
import { animationCatalog, buildRigCatalog, collectSkinnedBones } from './rig'
import {
  hasMorphTargetTrack,
  selectClipVariant,
  shouldPauseAutomaticIdle,
  splitAnimationClip,
} from './animationTracks'
import {
  applyBoneRotationOffsets,
  dampBoneRotationOffsets,
  restoreAnimatedQuaternions,
} from './bonePose'
import { easeTimeline } from './animationTimeline'
import { sampleExpressionCue, shouldApplyExpressionOutput } from './expressionTimeline'
import { createAttentionState, stepAttention } from './attention'
import { phasePose } from './phasePose'
import { logDebugEvent } from '../state/debugConsoleStore'

const MODEL_URL = '/RobotExpressive.glb'
const MODEL_HEIGHT = 1.55
type TimelineRuntime = {
  id: number | null
  elapsedMs: number
  segmentIndex: number
}
type ExpressionCueRuntime = {
  key: string | null
  elapsedMs: number
  from: Partial<Record<ExpressionName, number>>
  baseline: ExpressionWeights
}

type ProceduralReaction = {
  id: number
  kind: 'torso_attention' | 'wake'
  elapsedMs: number
  target?: AttentionTarget
}

const REACTION_TRANSITION_MS = 180
const TORSO_REACTION_MS = 720
const TORSO_REACTION_TILT = 0.075
const TORSO_REACTION_MAX_YAW = 0.42
const WAKE_TRANSITION_MS = 360
const SLEEP_HEAD_PITCH = 0.2

function completeAiPresentationAndRecover(reactionId: number) {
  completeAiPresentation(reactionId)
  if (
    getActiveAiPresentationReactionId() === null &&
    useBehaviorStore.getState().controlMode === 'auto'
  )
    useCompanionStore.getState().recoverCompanionToAuto()
}

function emptyTimelineRuntime(): TimelineRuntime {
  return { id: null, elapsedMs: 0, segmentIndex: -1 }
}
function emptyExpressionCueRuntime(): ExpressionCueRuntime {
  return {
    key: null,
    elapsedMs: 0,
    from: {},
    baseline: { Angry: 0, Surprised: 0, Sad: 0 },
  }
}

export function RiggedRobot() {
  const { scene, animations } = useGLTF(MODEL_URL)
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  )
  const model = useMemo(() => {
    const cloned = clone(scene)
    let neck: Bone | undefined
    let head: Bone | undefined
    cloned.traverse((object) => {
      if (!(object instanceof Bone)) return
      if (object.name === 'Neck' && !neck) neck = object
      if (object.name === 'Head' && !head) head = object
    })

    if (neck?.parent) {
      const pivot = new Group()
      pivot.name = 'GazePivot.Neck'
      pivot.position.copy(neck.position)
      neck.position.set(0, 0, 0)
      neck.parent.add(pivot)
      neck.parent.remove(neck)
      pivot.add(neck)
    }
    if (head?.parent) {
      const pivot = new Group()
      pivot.name = 'GazePivot.Head'
      head.parent.add(pivot)
      head.parent.remove(head)
      pivot.add(head)
    }
    return cloned
  }, [scene])
  const modelRef = useRef<Object3D>(null)
  const animationSource = useCompanionStore((state) => state.animationSource)
  const animationName = useCompanionStore((state) => state.animation)
  const animationPlaying = useCompanionStore((state) => state.animationPlaying)
  const animationSpeed = useCompanionStore((state) => state.animationSpeed)
  const animationLoop = useCompanionStore((state) => state.animationLoop)
  const timeline = useCompanionStore((state) => state.timeline)
  const timelineStepIndex = useCompanionStore((state) => state.timelineStepIndex)
  const expressionTimeline = useCompanionStore((state) => state.expressionTimeline)
  const controlSource = useCompanionStore((state) => state.controlSource)
  const timelineRevision = useCompanionStore((state) => state.timelineRevision)
  const seekRevision = useCompanionStore((state) => state.seekRevision)
  const boneRotations = useCompanionStore((state) => state.boneRotations)
  const expressionWeights = useCompanionStore((state) => state.expressionWeights)
  const behaviorOwner = useBehaviorStore((state) => state.owner)
  const behaviorPhase = useBehaviorStore((state) => state.phase)
  const behaviorEmotion = useBehaviorStore((state) => state.emotion)
  const activeReaction = useBehaviorStore((state) => state.activeReaction)
  const attentionTarget = useBehaviorStore((state) => state.attentionTarget)

  const bones = useMemo(() => collectSkinnedBones(model), [model])
  const boneByName = useMemo(
    () => new Map(bones.map((bone) => [bone.name, bone])),
    [bones],
  )
  const clips = useMemo(
    () => new Map(animations.map((clip) => [clip.name, splitAnimationClip(clip)])),
    [animations],
  )
  const validAnimations = useMemo(
    () => animationCatalog(animations, ANIMATION_NAMES),
    [animations],
  )
  const mixer = useMemo(() => new AnimationMixer(model), [model])
  const actionMap = useMemo(() => {
    const pairs = new Map<
      string,
      {
        autoClip: AnimationAction
        manualClip: AnimationAction
        expressionClip: AnimationAction
      }
    >()
    for (const [name, split] of clips) {
      pairs.set(name, {
        autoClip: mixer.clipAction(split.autoClip),
        manualClip: mixer.clipAction(split.manualClip),
        expressionClip: mixer.clipAction(split.expressionClip),
      })
    }
    return pairs
  }, [clips, mixer])
  const activeAction = useRef<AnimationAction | null>(null)
  const previousAction = useRef<AnimationAction | null>(null)
  const animatedQuaternions = useMemo(
    () => new Map(bones.map((bone) => [bone, bone.quaternion.clone()])),
    [bones],
  )
  const bodyRestPosition = useMemo(() => {
    const body = boneByName.get('Body')
    return body?.position.clone()
  }, [boneByName])
  const gazePivotHead = useMemo(
    () => model.getObjectByName('GazePivot.Head') ?? null,
    [model],
  )
  const morphMeshes = useMemo(() => {
    const result: Mesh[] = []
    model.traverse((object) => {
      if (
        object instanceof Mesh &&
        object.morphTargetDictionary &&
        object.morphTargetInfluences
      )
        result.push(object)
    })
    return result
  }, [model])
  const placement = useMemo(() => {
    model.updateMatrixWorld(true)
    const bounds = new Box3().setFromObject(model, true)
    const size = bounds.getSize(new Vector3())
    const center = bounds.getCenter(new Vector3())
    const scale = MODEL_HEIGHT / Math.max(size.y, 0.001)
    return {
      scale,
      position: [-center.x * scale, -bounds.min.y * scale, -center.z * scale] as [
        number,
        number,
        number,
      ],
    }
  }, [model])
  const progressTimeRef = useRef(0)
  const smoothedBoneRotations = useRef(new Map<string, BoneRotation>())
  const touchOrigin = useRef(new Vector3())
  const touchDirection = useRef(new Vector3())
  const touchParentQuaternion = useRef(new Quaternion())
  const timelineRuntime = useRef<TimelineRuntime>(emptyTimelineRuntime())
  const expressionCueRuntime = useRef<ExpressionCueRuntime>(emptyExpressionCueRuntime())
  const expressionInfluenceRef = useRef(new Map<string, number>())
  const proceduralReaction = useRef<ProceduralReaction | null>(null)
  const attentionState = useRef(createAttentionState())
  const attentionTargetVector = useRef(new Vector3())
  const attentionOriginVector = useRef(new Vector3())
  const crossFade = useRef<{
    previous: AnimationAction
    next: AnimationAction
    elapsedMs: number
    durationMs: number
    easing: AnimationTimeline['steps'][number]['easing']
  } | null>(null)

  useEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)')
    const updatePreference = () => setPrefersReducedMotion(preference.matches)
    preference.addEventListener('change', updatePreference)
    return () => preference.removeEventListener('change', updatePreference)
  }, [])
  const splitActiveClip = clips.get(animationName)
  const activeClip = splitActiveClip
    ? selectClipVariant(
        splitActiveClip,
        behaviorOwner === 'manual',
        controlSource === 'manual',
      )
    : undefined

  useEffect(() => {
    const rigCatalog = buildRigCatalog(bones)
    useCompanionStore.getState().setRigCatalog(rigCatalog, validAnimations)
  }, [bones, validAnimations])

  useEffect(() => {
    const runtime = timelineRuntime.current
    runtime.id = timeline?.id ?? null
    runtime.elapsedMs = 0
    runtime.segmentIndex = timeline ? timelineStepIndex : -1
  }, [timeline?.id, timelineRevision, timelineStepIndex])

  useEffect(() => {
    const runtime = expressionCueRuntime.current
    runtime.key = null
    runtime.elapsedMs = 0
  }, [expressionTimeline?.id])

  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.hidden) {
        cancelAllAiPresentations('page_hidden')
        useCompanionStore.getState().clearExpressionTimeline()
        const preview = useCompanionStore.getState().clipPreview
        if (preview) {
          dispatchBehaviorEvent({ type: 'resume_companion' })
          useCompanionStore.getState().recoverCompanionToAuto()
        }
        const active = useCompanionStore.getState().timeline
        if (active) {
          logDebugEvent({
            source: 'system',
            type: 'tool_result',
            summary: '动画时间线因页面隐藏而停止',
            detail: {
              callId: active.callId,
              timelineId: active.id,
              status: 'cancelled',
            },
          })
          useCompanionStore.getState().cancelAnimationTimeline()
        }
        const reaction = useBehaviorStore.getState().activeReaction
        if (reaction && reaction.owner !== 'direct_interaction')
          dispatchBehaviorEvent({
            type: 'reaction_cancelled',
            reactionId: reaction.id,
            reason: 'page_hidden',
          })
      }
    }
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => document.removeEventListener('visibilitychange', onVisibilityChange)
  }, [])

  useEffect(() => {
    const unsubscribe = useBehaviorStore.subscribe((state, previous) => {
      if (
        state.activeReaction?.owner === 'direct_interaction' &&
        previous.activeReaction?.id !== state.activeReaction.id
      ) {
        cancelAllAiPresentations('direct_interaction')
        useCompanionStore.getState().clearExpressionTimeline()
        const timeline = useCompanionStore.getState().timeline
        if (timeline?.behaviorReactionId !== undefined)
          useCompanionStore.getState().cancelCompanionAction(timeline.behaviorReactionId)
      }
      if (state.controlMode === 'manual' && previous.controlMode !== 'manual') {
        cancelAllAiPresentations('manual_takeover')
        useCompanionStore.getState().clearExpressionTimeline()
        cancelQueuedPresentations('manual_takeover')
        const companion = useCompanionStore.getState()
        const preview = companion.clipPreview
        if (preview) useCompanionStore.getState().recoverCompanionToAuto()
        else if (companion.timeline?.behaviorReactionId !== undefined)
          companion.cancelCompanionAction(companion.timeline.behaviorReactionId)
      }
      if (state.controlMode === 'auto' && previous.controlMode !== 'auto') {
        cancelAllAiPresentations('resume_auto')
        useCompanionStore.getState().clearExpressionTimeline()
        useCompanionStore.getState().recoverCompanionToAuto()
      }
    })
    return unsubscribe
  }, [])

  useEffect(() => {
    const current = useCompanionStore.getState()
    const runningReactionId = current.timeline?.behaviorReactionId
    if (!activeReaction) {
      proceduralReaction.current = null
      if (runningReactionId !== undefined)
        current.cancelCompanionAction(runningReactionId)
      else if (current.heldFinalPose && behaviorOwner === 'manual')
        current.resumeCompanionAnimation()
      return
    }

    if (runningReactionId === activeReaction.id) return
    if (runningReactionId !== undefined) current.cancelCompanionAction(runningReactionId)

    if (activeReaction.kind === 'torso_attention') {
      proceduralReaction.current = {
        id: activeReaction.id,
        kind: 'torso_attention',
        elapsedMs: 0,
        target: activeReaction.target,
      }
      return
    }

    proceduralReaction.current = null
    const presentation =
      activeReaction.kind === 'semantic_action'
        ? companionActionPresentation(
            activeReaction.action as Parameters<typeof companionActionPresentation>[0],
          )
        : null
    if (presentation?.pose === 'sleep') {
      proceduralReaction.current = null
      return
    }
    if (presentation?.pose === 'wake') {
      proceduralReaction.current = {
        id: activeReaction.id,
        kind: 'wake',
        elapsedMs: 0,
      }
      return
    }
    const animation =
      presentation?.animation ??
      (activeReaction.kind === 'head_affection'
        ? 'Yes'
        : activeReaction.kind === 'thumbs_up'
          ? 'ThumbsUp'
          : activeReaction.action)
    const clip = current.animations.find((item) => item.name === animation)
    if (!clip) {
      dispatchBehaviorEvent({
        type: 'reaction_cancelled',
        reactionId: activeReaction.id,
        reason: `missing_clip:${animation}`,
      })
      return
    }

    const started = current.startCompanionAction(
      activeReaction.id,
      [
        {
          animation: clip.name,
          repeat_count: 1,
          speed: 1,
          transition_ms: REACTION_TRANSITION_MS,
          easing: 'ease_in_out',
          ...(presentation?.expressions ? { expressions: presentation.expressions } : {}),
        },
      ],
      clip.duration * 1000,
      activeReaction.persistent ?? false,
    )
    if (!started)
      dispatchBehaviorEvent({
        type: 'reaction_cancelled',
        reactionId: activeReaction.id,
        reason: `unable_to_start:${animation}`,
      })
  }, [activeReaction?.id, activeReaction?.kind, activeReaction?.action, behaviorOwner])

  useEffect(() => {
    const pair = actionMap.get(animationName)
    const next =
      pair &&
      selectClipVariant(
        pair,
        behaviorOwner === 'manual',
        controlSource === 'manual',
      )
    if (!next) return
    const previous = activeAction.current
    const previousTime = previous?.time ?? useCompanionStore.getState().animationTime
    const oldFade = crossFade.current
    if (oldFade && oldFade.previous !== previous) oldFade.previous.stop()
    crossFade.current = null
    next.reset()
    next.time = previousTime
    next.enabled = true
    const current = useCompanionStore.getState()
    next.setEffectiveTimeScale(current.animationSpeed)
    next.setLoop(
      current.animationLoop ? LoopRepeat : LoopOnce,
      current.animationLoop ? Infinity : 1,
    )
    next.clampWhenFinished = !current.animationLoop
    next.setEffectiveWeight(previous && previous !== next ? 0 : 1)
    next.play()
    next.paused = !current.animationPlaying
    if (previous && previous !== next) {
      const durationMs = current.animationTransitionMs
      if (durationMs === 0) {
        previous.stop()
        next.setEffectiveWeight(1)
      } else {
        crossFade.current = {
          previous,
          next,
          elapsedMs: 0,
          durationMs,
          easing: current.animationTransitionEasing,
        }
      }
      previousAction.current = previous
    }
    activeAction.current = next
    progressTimeRef.current = 0
  }, [
    actionMap,
    animationName,
    animationSource,
    behaviorOwner,
    controlSource,
    timelineRevision,
    timelineStepIndex,
  ])

  useEffect(() => {
    const action = activeAction.current
    if (!action) return
    action.setEffectiveTimeScale(animationSpeed)
    action.setLoop(animationLoop ? LoopRepeat : LoopOnce, animationLoop ? Infinity : 1)
    action.clampWhenFinished = !animationLoop
    action.paused =
      !animationPlaying ||
      shouldPauseAutomaticIdle(
        prefersReducedMotion,
        animationName,
        behaviorOwner === 'manual',
      )
  }, [
    animationLoop,
    animationName,
    animationPlaying,
    animationSpeed,
    animationSource,
    behaviorOwner,
    prefersReducedMotion,
  ])

  useEffect(() => {
    const action = activeAction.current
    if (!action) return
    action.time = useCompanionStore.getState().animationTime
    action.paused = true
    mixer.update(0)
    action.paused = !useCompanionStore.getState().animationPlaying
  }, [mixer, seekRevision])

  useEffect(() => {
    const onFinished = (event: { action: AnimationAction }) => {
      const state = useCompanionStore.getState()
      if (event.action !== activeAction.current) return
      state.reportAnimationTime(event.action.time)
      const preview = state.clipPreview
      const timeline = state.timeline
      const reactionId = timeline?.behaviorReactionId
      if (preview && state.animation === preview) {
        dispatchBehaviorEvent({ type: 'resume_companion' })
        state.recoverCompanionToAuto()
        return
      }
      if (timeline && reactionId === undefined && !timeline.callId) {
        state.finishAnimationTimeline(timeline.id)
        return
      }
      if (
        reactionId !== undefined &&
        timeline &&
        !timeline?.callId &&
        timeline.steps.length === 1 &&
        !timeline.holdFinalPose
      ) {
        state.finishCompanionAction(reactionId)
        completeAiPresentationAndRecover(reactionId)
        return
      }
      if (!state.animationLoop) state.setAnimationPlaying(false)
    }
    mixer.addEventListener('finished', onFinished)
    return () => mixer.removeEventListener('finished', onFinished)
  }, [animationName, mixer])

  useEffect(() => {
    return () => {
      const active = useBehaviorStore.getState().activeReaction
      useCompanionStore.getState().cancelAnimationTimeline()
      useCompanionStore.getState().clearExpressionTimeline()
      if (
        active?.owner === 'direct_interaction' ||
        (active?.kind === 'semantic_action' && active.action === 'wake')
      )
        dispatchBehaviorEvent({
          type: 'reaction_cancelled',
          reactionId: active.id,
          reason: 'model_unmounted',
        })
      if (active?.id === getActiveAiPresentationReactionId())
        abandonAiPresentation(active.id)
      cancelAllAiPresentations('model_unmounted')
      cancelQueuedPresentations('model_unmounted')
      proceduralReaction.current = null
      crossFade.current = null
      mixer.stopAllAction()
      mixer.uncacheRoot(model)
      activeAction.current = null
      previousAction.current = null
    }
  }, [mixer, model])

  useEffect(() => {
    const canvas = document.querySelector('canvas')
    if (!canvas) return
    canvas.style.touchAction = 'none'
    return () => {
      canvas.style.touchAction = ''
    }
  }, [])

  useFrame((_, delta) => {
    if (document.hidden) return
    const step = timeline?.steps[timelineStepIndex]
    const cues = expressionTimeline?.cues ?? step?.expressions ?? []
    const cueBaseline = expressionTimeline?.baseline ?? expressionWeights
    const cueKey = expressionTimeline
      ? `expression:${expressionTimeline.id}`
      : timeline && cues.length
        ? `animation:${timeline.id}:${timelineStepIndex}`
        : null
    const cueRuntime = expressionCueRuntime.current
    if (cueRuntime.key !== cueKey) {
      cueRuntime.key = cueKey
      cueRuntime.elapsedMs = 0
      cueRuntime.from = {}
      cueRuntime.baseline = expressionTimeline
        ? { ...expressionTimeline.baseline }
        : { ...cueBaseline }
    }
    if (cueKey !== null) cueRuntime.elapsedMs += delta * 1000
    if (timeline) timelineRuntime.current.elapsedMs += delta * 1000
    const transition = crossFade.current
    if (transition) {
      transition.elapsedMs += delta * 1000
      const progress = easeTimeline(
        transition.easing,
        transition.elapsedMs / transition.durationMs,
      )
      transition.previous.setEffectiveWeight(1 - progress)
      transition.next.setEffectiveWeight(progress)
      if (progress >= 1) {
        transition.previous.stop()
        crossFade.current = null
        previousAction.current = null
      }
    }
    restoreAnimatedQuaternions(animatedQuaternions)
    mixer.update(delta)

    const body = boneByName.get('Body')
    if (!timeline && body && bodyRestPosition) {
      body.position.x = bodyRestPosition.x
      body.position.z = bodyRestPosition.z
    }

    const displayedBoneRotations = dampBoneRotationOffsets(
      smoothedBoneRotations.current,
      boneRotations,
      delta,
    )
    applyBoneRotationOffsets(boneByName, displayedBoneRotations, animatedQuaternions)

    const outer = modelRef.current
    if (outer) {
      const posture = phasePose(
        behaviorPhase,
        behaviorOwner,
        Boolean(activeReaction),
        prefersReducedMotion,
        behaviorEmotion,
      )
      const targetTilt = posture.tiltZ
      const targetBow = posture.tiltX
      outer.rotation.z = MathUtils.damp(outer.rotation.z, targetTilt, 3.5, delta)
      outer.rotation.x = MathUtils.damp(outer.rotation.x, targetBow, 3.5, delta)

      const attentionCanMoveBody = behaviorOwner !== 'manual' && !prefersReducedMotion
      if (attentionCanMoveBody) {
        let localDirection: Vector3 | null = null
        if (attentionTarget && outer.parent) {
          outer.parent.updateWorldMatrix(true, false)
          attentionTargetVector.current.set(
            attentionTarget.x,
            attentionTarget.y,
            attentionTarget.z,
          )
          outer.parent.worldToLocal(attentionTargetVector.current)
          outer.getWorldPosition(attentionOriginVector.current)
          outer.parent.worldToLocal(attentionOriginVector.current)
          localDirection = attentionTargetVector.current.sub(
            attentionOriginVector.current,
          )
        }
        attentionState.current = stepAttention(
          attentionState.current,
          localDirection,
          delta,
        )
        outer.rotation.y = attentionState.current.bodyYaw
      }

      const activeInfo = validAnimations.find((item) => item.name === animationName)
      const headIsAnimationOwned =
        animationName !== 'Idle' && (activeInfo?.affectsHead || activeInfo?.affectsNeck)
      if (
        behaviorOwner !== 'manual' &&
        gazePivotHead instanceof Group &&
        (behaviorEmotion === 'sleepy' || (!prefersReducedMotion && !headIsAnimationOwned))
      ) {
        const targetPitch =
          behaviorEmotion === 'sleepy'
            ? SLEEP_HEAD_PITCH
            : -attentionState.current.headPitch
        const targetYaw =
          behaviorEmotion === 'sleepy' ? 0 : attentionState.current.headYaw
        if (prefersReducedMotion) {
          gazePivotHead.rotation.y = targetYaw
          gazePivotHead.rotation.x = targetPitch
        } else {
          gazePivotHead.rotation.y = MathUtils.damp(
            gazePivotHead.rotation.y,
            targetYaw,
            5,
            delta,
          )
          gazePivotHead.rotation.x = MathUtils.damp(
            gazePivotHead.rotation.x,
            targetPitch,
            5,
            delta,
          )
        }
      }
    }

    const procedural = proceduralReaction.current
    if (procedural) {
      procedural.elapsedMs += delta * 1000
      if (procedural.kind === 'torso_attention') {
        const progress = Math.min(1, procedural.elapsedMs / TORSO_REACTION_MS)
        const body = boneByName.get('Body')
        if (body) {
          const envelope = Math.sin(Math.PI * progress)
          body.rotation.x += envelope * TORSO_REACTION_TILT
          if (procedural.target) {
            body.updateWorldMatrix(true, false)
            body.getWorldPosition(touchOrigin.current)
            touchDirection.current.set(
              procedural.target.x - touchOrigin.current.x,
              0,
              procedural.target.z - touchOrigin.current.z,
            )
            if (body.parent) {
              body.parent.getWorldQuaternion(touchParentQuaternion.current).invert()
              touchDirection.current.applyQuaternion(touchParentQuaternion.current)
            }
            if (touchDirection.current.lengthSq() > 0.0001) {
              const yaw = MathUtils.clamp(
                Math.atan2(touchDirection.current.x, touchDirection.current.z),
                -TORSO_REACTION_MAX_YAW,
                TORSO_REACTION_MAX_YAW,
              )
              body.rotation.y += yaw * envelope
            }
          }
        }
        if (progress >= 1) {
          proceduralReaction.current = null
          dispatchBehaviorEvent({
            type: 'reaction_completed',
            reactionId: procedural.id,
          })
        }
      } else if (procedural.elapsedMs >= WAKE_TRANSITION_MS) {
        proceduralReaction.current = null
        dispatchBehaviorEvent({
          type: 'reaction_completed',
          reactionId: procedural.id,
        })
        completeAiPresentationAndRecover(procedural.id)
      }
    }

    for (const mesh of morphMeshes) {
      const influences = mesh.morphTargetInfluences
      const dictionary = mesh.morphTargetDictionary
      if (!influences || !dictionary) continue
      for (const expression of EXPRESSION_NAMES) {
        const index = dictionary[expression]
        if (index === undefined) continue
        const hasClipTrack = hasMorphTargetTrack(activeClip, mesh.name, index)
        const cue = cues.find((item) => item.expression === expression)
        if (cue) {
          const influenceKey = `${mesh.uuid}:${expression}`
          const currentInfluence =
            expressionInfluenceRef.current.get(influenceKey) ?? influences[index] ?? 0
          cueRuntime.from[expression] ??= currentInfluence
          const sampled = sampleExpressionCue(
            cue,
            expressionTimeline
              ? cueRuntime.elapsedMs
              : Math.min(
                  cueRuntime.elapsedMs,
                  cue.fade_in_ms + cue.hold_ms + cue.fade_out_ms,
                ),
            cueRuntime.from[expression] ?? 0,
            cueRuntime.baseline[expression],
          )
          expressionInfluenceRef.current.set(influenceKey, sampled)
          influences[index] = sampled
        } else if (
          shouldApplyExpressionOutput(
            expressionTimeline !== null,
            expressionWeights[expression],
            behaviorEmotion === 'comfort',
            hasClipTrack,
          )
        ) {
          const influenceKey = `${mesh.uuid}:${expression}`
          const currentInfluence =
            expressionInfluenceRef.current.get(influenceKey) ?? influences[index] ?? 0
          const target = expressionWeights[expression]
          const damped = MathUtils.damp(
            currentInfluence,
            behaviorEmotion === 'comfort' && expression === 'Sad' ? 0.3 : target,
            10,
            delta,
          )
          expressionInfluenceRef.current.set(influenceKey, damped)
          influences[index] = damped
        }
      }
    }

    if (expressionTimeline && cueRuntime.elapsedMs >= expressionTimeline.durationMs)
      useCompanionStore.getState().clearExpressionTimeline()

    const action = activeAction.current
    if (action && action.isRunning() && action.time !== progressTimeRef.current) {
      progressTimeRef.current = action.time
      const displayed = useCompanionStore.getState().animationTime
      if (action.time - displayed > 0.1 || action.time < displayed - 0.1)
        useCompanionStore.getState().reportAnimationTime(action.time)
    }
    if (timeline) {
      const runtime = timelineRuntime.current
      if (runtime.id !== timeline.id) return
      const step = timeline.steps[timelineStepIndex]
      const info = step && validAnimations.find((item) => item.name === step.animation)
      if (!step || !info) {
        useCompanionStore.getState().cancelAnimationTimeline()
        return
      }
      const durationMs = (info.duration * 1000 * step.repeat_count) / step.speed
      if (runtime.elapsedMs >= durationMs) {
        if (timelineStepIndex + 1 < timeline.steps.length) {
          useCompanionStore
            .getState()
            .advanceAnimationTimeline(timeline.id, timelineStepIndex + 1)
          runtime.elapsedMs = 0
          runtime.segmentIndex = timelineStepIndex + 1
        } else {
          logDebugEvent({
            source: 'system',
            type: 'tool_result',
            summary: '动画时间线完成',
            detail: {
              callId: timeline.callId,
              timelineId: timeline.id,
              status: 'complete',
            },
          })
          if (timeline.behaviorReactionId !== undefined) {
            const reactionId = timeline.behaviorReactionId
            if (
              timeline.holdFinalPose &&
              useCompanionStore.getState().holdCompanionAction(reactionId)
            )
              dispatchBehaviorEvent({ type: 'reaction_held', reactionId })
            else {
              useCompanionStore.getState().finishCompanionAction(reactionId)
              completeAiPresentationAndRecover(reactionId)
            }
          } else {
            useCompanionStore.getState().finishAnimationTimeline(timeline.id)
          }
        }
      }
    }
  })

  return (
    <group ref={modelRef} position={placement.position} scale={placement.scale}>
      <primitive object={model} dispose={null} />
    </group>
  )
}

useGLTF.preload(MODEL_URL)
