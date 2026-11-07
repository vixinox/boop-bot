import { create } from 'zustand'
import { dispatchBehaviorEvent } from './behaviorStore'

export const ANIMATION_NAMES = [
  'Idle',
  'Dance',
  'Death',
  'Jump',
  'No',
  'Punch',
  'Running',
  'Sitting',
  'Standing',
  'ThumbsUp',
  'Walking',
  'WalkJump',
  'Wave',
  'Yes',
] as const
export const AI_ANIMATION_NAMES = ANIMATION_NAMES.filter(
  (name) => name !== 'Death' && name !== 'Punch',
)
export const EXPRESSION_NAMES = ['Angry', 'Surprised', 'Sad'] as const
export type AnimationName = (typeof ANIMATION_NAMES)[number]
export type AnimationSource = AnimationName | 'auto' | 'preview'
export type PlaybackOwner = 'manual' | 'ai_timeline' | 'auto' | 'preview'
export type ExpressionName = (typeof EXPRESSION_NAMES)[number]
export type ExpressionCue = {
  expression: ExpressionName
  to: number
  fade_in_ms: number
  hold_ms: number
  fade_out_ms: number
}
export type BoneRotation = { x: number; y: number; z: number }
export type TimelineEasing = 'linear' | 'ease_in' | 'ease_out' | 'ease_in_out'
export type AnimationTimelineStep = {
  animation: AnimationName
  repeat_count: number
  speed: number
  transition_ms: number
  easing: TimelineEasing
  expressions?: ExpressionCue[]
}
export type ExpressionTimeline = {
  id: number
  cues: ExpressionCue[]
  durationMs: number
  baseline: ExpressionWeights
}
export type AnimationTimeline = {
  id: number
  callId?: string
  behaviorReactionId?: number
  steps: AnimationTimelineStep[]
  totalMs: number
  holdFinalPose?: boolean
}
export type ExpressionWeights = Record<ExpressionName, number>
export interface RigJoint {
  name: string
  parentName: string | null
  depth: number
  helper: boolean
}
export interface AnimationInfo {
  name: AnimationName
  duration: number
  description?: string
  affectsHead?: boolean
  affectsNeck?: boolean
}

export interface CompanionState {
  animationSource: AnimationSource
  playbackOwner: PlaybackOwner
  controlSource: PlaybackOwner
  animation: AnimationName
  animationPlaying: boolean
  animationSpeed: number
  animationLoop: boolean
  animationTransitionMs: number
  animationTransitionEasing: TimelineEasing
  animationTime: number
  animationDuration: number
  seekRevision: number
  rigJoints: RigJoint[]
  animations: AnimationInfo[]
  selectedBoneName: string | null
  boneRotations: Record<string, BoneRotation>
  expressionWeights: ExpressionWeights
  timeline: AnimationTimeline | null
  timelineRevision: number
  timelineStepIndex: number
  timelineExpressionTargets: ExpressionCue[] | null
  expressionTimeline: ExpressionTimeline | null
  expressionTimelineRevision: number
  heldFinalPose: boolean
  clipPreview: AnimationName | null
  recoverCompanionToAuto: () => void
  takeExpressionControl: () => void
  startClipPreview: (source: AnimationName) => boolean
  setAnimationSource: (source: AnimationName) => void
  setAnimationPlaying: (playing: boolean) => void
  setAnimationSpeed: (speed: number) => void
  setAnimationLoop: (loop: boolean) => void
  setAnimationTime: (seconds: number) => void
  reportAnimationTime: (seconds: number) => void
  setRigCatalog: (joints: RigJoint[], animations: AnimationInfo[]) => void
  setSelectedBone: (name: string) => void
  setBoneRotation: (name: string, rotation: BoneRotation) => void
  resetBoneRotation: (name: string) => void
  resetAllBoneRotations: () => void
  setExpressionWeight: (name: ExpressionName, value: number) => void
  startAnimationTimeline: (
    steps: AnimationTimelineStep[],
    totalMs: number,
    callId?: string,
    behaviorReactionId?: number,
  ) => void
  startExpressionTimeline: (cues: ExpressionCue[], durationMs: number) => boolean
  clearExpressionTimeline: () => boolean
  advanceAnimationTimeline: (id: number, nextIndex: number) => boolean
  cancelAnimationTimeline: () => boolean
  finishAnimationTimeline: (id: number) => boolean
  startCompanionAction: (
    reactionId: number,
    steps: AnimationTimelineStep[],
    totalMs: number,
    holdFinalPose?: boolean,
  ) => boolean
  holdCompanionAction: (reactionId: number) => boolean
  finishCompanionAction: (reactionId: number) => boolean
  cancelCompanionAction: (reactionId: number) => boolean
  resumeCompanionAnimation: () => void
}

const clamp = (value: number, min: number, max: number, step: number) => {
  if (!Number.isFinite(value)) value = min <= 0 && max >= 0 ? 0 : min
  const rounded = Math.round(Math.min(max, Math.max(min, value)) / step) * step
  return Number(rounded.toFixed(step < 1 ? Math.ceil(-Math.log10(step)) : 0))
}
const zeroWeights: ExpressionWeights = { Angry: 0, Surprised: 0, Sad: 0 }

function idleRecovery(state: CompanionState) {
  const idle = state.animations.find((item) => item.name === 'Idle')
  return {
    timeline: null,
    timelineRevision: state.timelineRevision + 1,
    timelineStepIndex: 0,
    timelineExpressionTargets: null,
    expressionTimeline: null,
    expressionTimelineRevision: state.expressionTimelineRevision + 1,
    animationSource: idle?.name ?? state.animationSource,
    animation: idle?.name ?? state.animation,
    animationDuration: idle?.duration ?? state.animationDuration,
    animationLoop: true,
    animationPlaying: true,
    animationTime: 0,
    seekRevision: state.seekRevision + 1,
    playbackOwner: 'ai_timeline' as const,
    controlSource: 'ai_timeline' as const,
    heldFinalPose: false,
    clipPreview: null,
  }
}

function autoRecovery(state: CompanionState) {
  const idle = state.animations.find((item) => item.name === 'Idle')
  return {
    ...idleRecovery(state),
    animationSource: (idle?.name ?? 'auto') as AnimationSource,
    animation: idle?.name ?? state.animation,
    animationDuration: idle?.duration ?? state.animationDuration,
    animationSpeed: 1,
    animationTransitionMs: 250,
    animationTransitionEasing: 'ease_in_out' as const,
    boneRotations: {},
    expressionWeights: { ...zeroWeights },
    playbackOwner: 'auto' as const,
    controlSource: 'auto' as const,
    clipPreview: null,
  }
}

export const useCompanionStore = create<CompanionState>((set, get) => ({
  animationSource: 'Idle',
  playbackOwner: 'manual',
  controlSource: 'manual',
  animation: 'Idle',
  animationPlaying: true,
  animationSpeed: 1,
  animationLoop: true,
  animationTransitionMs: 250,
  animationTransitionEasing: 'ease_in_out',
  animationTime: 0,
  animationDuration: 0,
  seekRevision: 0,
  rigJoints: [],
  animations: [],
  selectedBoneName: null,
  boneRotations: {},
  expressionWeights: { ...zeroWeights },
  timeline: null,
  timelineRevision: 0,
  timelineStepIndex: 0,
  timelineExpressionTargets: null,
  expressionTimeline: null,
  expressionTimelineRevision: 0,
  heldFinalPose: false,
  clipPreview: null,
  recoverCompanionToAuto: () => set(autoRecovery(get())),
  takeExpressionControl: () =>
    set({
      controlSource: 'manual',
      expressionTimeline: null,
      expressionTimelineRevision: get().expressionTimelineRevision + 1,
    }),
  startClipPreview: (source) => {
    const state = get()
    const clip = state.animations.find((item) => item.name === source)
    if (!clip) return false
    if (source === 'Idle') {
      get().recoverCompanionToAuto()
      return true
    }
    set({
      animationSource: source,
      playbackOwner: 'preview',
      controlSource: 'preview',
      animation: source,
      animationDuration: clip.duration,
      animationLoop: false,
      animationPlaying: true,
      animationTime: 0,
      animationSpeed: 1,
      animationTransitionMs: 250,
      animationTransitionEasing: 'ease_in_out',
      seekRevision: state.seekRevision + 1,
      timeline: null,
      timelineRevision: state.timelineRevision + 1,
      timelineStepIndex: 0,
      timelineExpressionTargets: null,
      expressionTimeline: null,
      heldFinalPose: false,
      clipPreview: source,
    })
    return true
  },
  setAnimationSource: (source) => {
    const state = get()
    const clip = state.animations.find((item) => item.name === source)
    if (!clip) return
    const restart = state.animationSource === source
    set({
      animationSource: source,
      playbackOwner: 'manual',
      controlSource: 'manual',
      animation: source,
      animationDuration: clip.duration,
      animationLoop: source === 'Idle',
      animationPlaying: true,
      animationTime: 0,
      animationSpeed: 1,
      animationTransitionMs: 250,
      animationTransitionEasing: 'ease_in_out',
      seekRevision: state.seekRevision + 1,
      timeline: null,
      timelineRevision: state.timelineRevision + 1,
      timelineStepIndex: 0,
      timelineExpressionTargets: null,
      expressionTimeline: null,
      heldFinalPose: !restart && state.heldFinalPose,
      clipPreview: null,
    })
  },
  setAnimationPlaying: (playing) => {
    const state = get()
    const restarting =
      playing &&
      !state.animationLoop &&
      state.animationTime >= state.animationDuration - 0.02
    set({
      playbackOwner: 'manual',
      controlSource: 'manual',
      timeline: null,
      timelineRevision: state.timelineRevision + 1,
      timelineStepIndex: 0,
      timelineExpressionTargets: null,
      expressionTimeline: null,
      animationPlaying: playing,
      animationTime: restarting ? 0 : state.animationTime,
      seekRevision: state.seekRevision + (restarting ? 1 : 0),
      heldFinalPose: false,
      clipPreview: null,
    })
  },
  setAnimationSpeed: (speed) =>
    set({
      playbackOwner: 'manual',
      controlSource: 'manual',
      timeline: null,
      animationSpeed: clamp(speed, 0.1, 2, 0.1),
      clipPreview: null,
    }),
  setAnimationLoop: (loop) => {
    const state = get()
    set({
      playbackOwner: 'manual',
      controlSource: 'manual',
      timeline: null,
      timelineRevision: state.timelineRevision + 1,
      timelineExpressionTargets: null,
      expressionTimeline: null,
      animationLoop: loop,
      heldFinalPose: false,
      clipPreview: null,
    })
  },
  setAnimationTime: (time) => {
    const state = get()
    set({
      playbackOwner: 'manual',
      controlSource: 'manual',
      timeline: null,
      timelineRevision: state.timelineRevision + 1,
      timelineExpressionTargets: null,
      expressionTimeline: null,
      animationTime: clamp(time, 0, state.animationDuration, 0.001),
      seekRevision: state.seekRevision + 1,
      heldFinalPose: false,
      clipPreview: null,
    })
  },
  reportAnimationTime: (time) =>
    set({ animationTime: clamp(time, 0, get().animationDuration, 0.001) }),
  setRigCatalog: (joints, animations) => {
    const state = get()
    const current =
      animations.find((item) => item.name === state.animationSource) ??
      animations.find((item) => item.name === 'Idle') ??
      animations[0]
    set({
      rigJoints: joints,
      animations,
      selectedBoneName: joints.some((joint) => joint.name === state.selectedBoneName)
        ? state.selectedBoneName
        : (joints[0]?.name ?? null),
      animation: current?.name ?? 'Idle',
      animationSource: current?.name ?? 'Idle',
      animationDuration: current?.duration ?? 0,
      animationLoop: current?.name === 'Idle',
      timeline: null,
      timelineRevision: state.timelineRevision + 1,
      timelineStepIndex: 0,
      timelineExpressionTargets: null,
      expressionTimeline: null,
      clipPreview: null,
    })
  },
  setSelectedBone: (name) => {
    if (get().rigJoints.some((joint) => joint.name === name))
      set({ selectedBoneName: name })
  },
  setBoneRotation: (name, rotation) => {
    const state = get()
    if (!state.rigJoints.some((joint) => joint.name === name)) return
    set({
      boneRotations: {
        ...state.boneRotations,
        [name]: {
          x: clamp(rotation.x, -180, 180, 0.1),
          y: clamp(rotation.y, -180, 180, 0.1),
          z: clamp(rotation.z, -180, 180, 0.1),
        },
      },
    })
  },
  resetBoneRotation: (name) => {
    const rotations = { ...get().boneRotations }
    delete rotations[name]
    set({ boneRotations: rotations })
  },
  resetAllBoneRotations: () => set({ boneRotations: {} }),
  setExpressionWeight: (name, value) =>
    set({
      expressionWeights: { ...get().expressionWeights, [name]: clamp(value, 0, 1, 0.01) },
    }),
  startAnimationTimeline: (steps, totalMs, callId, behaviorReactionId) => {
    const state = get()
    const first = steps[0]
    if (!first) return
    const clip = state.animations.find((item) => item.name === first.animation)
    if (!clip) return
    const id = state.timelineRevision + 1
    set({
      playbackOwner: 'ai_timeline',
      controlSource: 'ai_timeline',
      timeline: { id, callId, behaviorReactionId, steps, totalMs },
      timelineRevision: id,
      timelineStepIndex: 0,
      timelineExpressionTargets: first.expressions ?? null,
      expressionTimeline: null,
      animationSource: first.animation,
      animation: first.animation,
      animationDuration: clip.duration,
      animationLoop: first.repeat_count > 1,
      animationSpeed: first.speed,
      animationTransitionMs: first.transition_ms,
      animationTransitionEasing: first.easing,
      animationPlaying: true,
      animationTime: 0,
      seekRevision: state.seekRevision + 1,
      heldFinalPose: false,
    })
  },
  startExpressionTimeline: (cues, durationMs) => {
    const state = get()
    if (!cues.length || durationMs <= 0) return false
    const id = state.expressionTimelineRevision + 1
    set({
      expressionTimeline: {
        id,
        cues,
        durationMs,
        baseline: { ...state.expressionWeights },
      },
      expressionTimelineRevision: id,
    })
    return true
  },
  clearExpressionTimeline: () => {
    const active = get().expressionTimeline
    if (!active) return false
    set({ expressionTimeline: null })
    return true
  },
  advanceAnimationTimeline: (id, nextIndex) => {
    const state = get()
    const timeline = state.timeline
    const step = timeline?.steps[nextIndex]
    if (!timeline || timeline.id !== id || !step) return false
    const clip = state.animations.find((item) => item.name === step.animation)
    if (!clip) return false
    set({
      timelineStepIndex: nextIndex,
      timelineExpressionTargets: step.expressions ?? null,
      animationSource: step.animation,
      animation: step.animation,
      animationDuration: clip.duration,
      animationLoop: step.repeat_count > 1,
      animationSpeed: step.speed,
      animationTransitionMs: step.transition_ms,
      animationTransitionEasing: step.easing,
      animationPlaying: true,
      animationTime: 0,
      seekRevision: state.seekRevision + 1,
    })
    return true
  },
  cancelAnimationTimeline: () => {
    const state = get()
    if (!state.timeline) return false
    const reactionId = state.timeline.behaviorReactionId
    set(idleRecovery(state))
    if (reactionId !== undefined)
      dispatchBehaviorEvent({
        type: 'reaction_cancelled',
        reactionId,
        reason: 'animation_timeline_cancelled',
      })
    return true
  },
  finishAnimationTimeline: (id) => {
    const state = get()
    if (state.timeline?.id !== id) return false
    const reactionId = state.timeline.behaviorReactionId
    set(idleRecovery(state))
    if (reactionId !== undefined)
      dispatchBehaviorEvent({ type: 'reaction_completed', reactionId })
    return true
  },
  startCompanionAction: (reactionId, steps, totalMs, holdFinalPose = false) => {
    const state = get()
    const first = steps[0]
    if (!Number.isInteger(reactionId) || reactionId < 1 || !first || steps.length !== 1)
      return false
    const clip = state.animations.find((item) => item.name === first.animation)
    if (!clip || !Number.isFinite(totalMs) || totalMs <= 0) return false
    const id = state.timelineRevision + 1
    set({
      ...idleRecovery(state),
      timeline: { id, behaviorReactionId: reactionId, steps, totalMs, holdFinalPose },
      timelineRevision: id,
      timelineStepIndex: 0,
      timelineExpressionTargets: first.expressions ?? null,
      expressionTimeline: null,
      animationSource: first.animation,
      animation: first.animation,
      animationDuration: clip.duration,
      animationLoop: first.repeat_count > 1,
      animationSpeed: first.speed,
      animationTransitionMs: first.transition_ms,
      animationTransitionEasing: first.easing,
      animationPlaying: true,
      animationTime: 0,
      seekRevision: state.seekRevision + 1,
      heldFinalPose: false,
    })
    return true
  },
  finishCompanionAction: (reactionId) => {
    const state = get()
    if (state.timeline?.behaviorReactionId !== reactionId) return false
    return get().finishAnimationTimeline(state.timeline.id)
  },
  holdCompanionAction: (reactionId) => {
    const state = get()
    if (
      state.timeline?.behaviorReactionId !== reactionId ||
      !state.timeline.holdFinalPose
    )
      return false
    set({
      timeline: null,
      timelineRevision: state.timelineRevision + 1,
      timelineStepIndex: 0,
      timelineExpressionTargets: null,
      expressionTimeline: null,
      animationLoop: false,
      animationPlaying: false,
      animationTime: state.animationDuration,
      seekRevision: state.seekRevision + 1,
      heldFinalPose: true,
      controlSource: 'ai_timeline',
      playbackOwner: 'ai_timeline',
    })
    return true
  },
  cancelCompanionAction: (reactionId) => {
    const state = get()
    if (state.timeline?.behaviorReactionId !== reactionId) return false
    return get().cancelAnimationTimeline()
  },
  resumeCompanionAnimation: () => set(idleRecovery(get())),
}))
