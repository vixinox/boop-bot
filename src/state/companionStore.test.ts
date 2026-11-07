import { beforeEach, describe, expect, it } from 'vitest'
import { useCompanionStore } from './companionStore'
import type { AnimationTimelineStep } from './companionStore'

const joints = [
  { name: 'Body', parentName: null, depth: 0, helper: false },
  { name: 'Head', parentName: 'Body', depth: 1, helper: false },
]
const animations = [
  { name: 'Idle' as const, duration: 3 },
  { name: 'Dance' as const, duration: 2 },
  { name: 'Sitting' as const, duration: 1 },
  { name: 'Standing' as const, duration: 1 },
  { name: 'Wave' as const, duration: 1 },
  { name: 'Death' as const, duration: 1 },
]

describe('useCompanionStore', () => {
  beforeEach(() => {
    useCompanionStore.setState({
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
      expressionWeights: { Angry: 0, Surprised: 0, Sad: 0 },
      timeline: null,
      timelineRevision: 0,
      timelineStepIndex: 0,
      timelineExpressionTargets: null,
      heldFinalPose: false,
      clipPreview: null,
    })
    useCompanionStore.getState().setRigCatalog(joints, animations)
  })

  it('starts with Idle as the manual looping clip', () => {
    expect(useCompanionStore.getState()).toMatchObject({
      animationSource: 'Idle',
      animation: 'Idle',
      rigJoints: joints,
      animations,
      selectedBoneName: 'Body',
    })
  })

  it('recovers to Auto idempotently and clears manual pose/expression overrides', () => {
    const state = useCompanionStore.getState()
    state.setBoneRotation('Head', { x: 30, y: 10, z: -4 })
    state.setExpressionWeight('Sad', 0.75)
    state.startAnimationTimeline(
      [
        {
          animation: 'Wave',
          repeat_count: 1,
          speed: 1,
          transition_ms: 250,
          easing: 'ease_in_out',
        },
      ],
      1000,
    )

    useCompanionStore.getState().recoverCompanionToAuto()
    expect(useCompanionStore.getState()).toMatchObject({
      animationSource: 'Idle',
      animation: 'Idle',
      animationLoop: true,
      animationPlaying: true,
      animationSpeed: 1,
      animationTime: 0,
      timeline: null,
      boneRotations: {},
      expressionWeights: { Angry: 0, Surprised: 0, Sad: 0 },
      playbackOwner: 'auto',
      controlSource: 'auto',
    })
    const revision = useCompanionStore.getState().timelineRevision
    useCompanionStore.getState().recoverCompanionToAuto()
    expect(useCompanionStore.getState().timelineRevision).toBe(revision + 1)
  })

  it('plays clip previews once without entering persistent Manual mode', () => {
    const state = useCompanionStore.getState()
    expect(state.startClipPreview('Wave')).toBe(true)
    expect(useCompanionStore.getState()).toMatchObject({
      animation: 'Wave',
      animationLoop: false,
      animationPlaying: true,
      playbackOwner: 'preview',
      controlSource: 'preview',
      clipPreview: 'Wave',
    })

    useCompanionStore.getState().recoverCompanionToAuto()
    expect(useCompanionStore.getState()).toMatchObject({
      animation: 'Idle',
      animationLoop: true,
      animationPlaying: true,
      playbackOwner: 'auto',
      controlSource: 'auto',
      clipPreview: null,
    })
  })

  it('lets manual transport take over and clear an active clip preview', () => {
    const state = useCompanionStore.getState()
    state.startClipPreview('Wave')
    state.setAnimationPlaying(false)
    expect(useCompanionStore.getState()).toMatchObject({
      animation: 'Wave',
      animationPlaying: false,
      playbackOwner: 'manual',
      controlSource: 'manual',
      clipPreview: null,
    })
  })

  it('selecting a clip hands playback to the user and Idle enables looping', () => {
    const state = useCompanionStore.getState()
    state.setAnimationSource('Death')
    expect(useCompanionStore.getState()).toMatchObject({
      animationSource: 'Death',
      animation: 'Death',
      animationPlaying: true,
      animationTime: 0,
    })
    state.setAnimationSource('Idle')
    expect(useCompanionStore.getState()).toMatchObject({
      animationSource: 'Idle',
      animation: 'Idle',
      animationLoop: true,
      animationPlaying: true,
    })
  })

  it('ignores missing animation and bone names', () => {
    const before = useCompanionStore.getState()
    before.setAnimationSource('Missing' as never)
    before.setSelectedBone('Missing')
    before.setBoneRotation('Missing', { x: 10, y: 0, z: 0 })
    expect(useCompanionStore.getState()).toMatchObject({
      animationSource: 'Idle',
      selectedBoneName: 'Body',
      boneRotations: {},
    })
  })

  it('clamps bone rotations and expression weights while Auto is selected', () => {
    const state = useCompanionStore.getState()
    state.setBoneRotation('Head', { x: 270, y: -25.23, z: Number.NaN })
    state.setExpressionWeight('Sad', 1.5)
    expect(useCompanionStore.getState()).toMatchObject({
      boneRotations: { Head: { x: 180, y: -25.2, z: 0 } },
      expressionWeights: { Angry: 0, Surprised: 0, Sad: 1 },
    })
  })

  it('hands only expression control to the inspector and cancels its active timeline', () => {
    const state = useCompanionStore.getState()
    useCompanionStore.setState({ playbackOwner: 'auto' })
    state.startExpressionTimeline(
      [{ expression: 'Sad', to: 0.5, fade_in_ms: 100, hold_ms: 100, fade_out_ms: 100 }],
      300,
    )
    state.takeExpressionControl()
    state.setExpressionWeight('Angry', 0.6)
    expect(useCompanionStore.getState()).toMatchObject({
      controlSource: 'manual',
      playbackOwner: 'auto',
      animation: 'Idle',
      animationPlaying: true,
      expressionTimeline: null,
      expressionWeights: { Angry: 0.6, Surprised: 0, Sad: 0 },
    })
  })

  it('keeps rig offsets and morph values when switching animation sources', () => {
    const state = useCompanionStore.getState()
    state.setBoneRotation('Head', { x: 20, y: 0, z: 0 })
    state.setExpressionWeight('Sad', 0.7)
    state.setAnimationSource('Dance')
    state.setAnimationSource('Idle')
    expect(useCompanionStore.getState()).toMatchObject({
      boneRotations: { Head: { x: 20, y: 0, z: 0 } },
      expressionWeights: { Angry: 0, Surprised: 0, Sad: 0.7 },
    })
  })

  it('resets selected and all bone offsets', () => {
    const state = useCompanionStore.getState()
    state.setBoneRotation('Body', { x: 10, y: 20, z: 30 })
    state.setBoneRotation('Head', { x: 5, y: 6, z: 7 })
    state.resetBoneRotation('Head')
    expect(useCompanionStore.getState().boneRotations).toEqual({
      Body: { x: 10, y: 20, z: 30 },
    })
    state.resetAllBoneRotations()
    expect(useCompanionStore.getState().boneRotations).toEqual({})
  })

  it('clamps animation speed and time and raises seek revision', () => {
    const state = useCompanionStore.getState()
    state.setAnimationSource('Dance')
    state.setAnimationSpeed(8)
    state.setAnimationTime(9)
    expect(useCompanionStore.getState()).toMatchObject({
      animationSpeed: 2,
      animationTime: 2,
      seekRevision: 2,
    })
  })

  it('restarts a finished non-looping clip from the beginning', () => {
    const state = useCompanionStore.getState()
    state.setAnimationSource('Dance')
    state.setAnimationLoop(false)
    state.setAnimationTime(2)
    state.setAnimationPlaying(false)
    state.setAnimationPlaying(true)
    expect(useCompanionStore.getState()).toMatchObject({
      animationPlaying: true,
      animationTime: 0,
      seekRevision: 3,
    })
  })

  it('uses explicit manual ownership for clip playback', () => {
    const state = useCompanionStore.getState()
    state.setAnimationSource('Dance')
    expect(useCompanionStore.getState()).toMatchObject({
      animationSource: 'Dance',
      animation: 'Dance',
      animationLoop: false,
      animationPlaying: true,
    })
    state.setAnimationSource('Idle')
    expect(useCompanionStore.getState()).toMatchObject({
      animationSource: 'Idle',
      animation: 'Idle',
      animationLoop: true,
    })
  })

  it('allows clip transport changes without an Auto mode', () => {
    const state = useCompanionStore.getState()
    state.setAnimationPlaying(false)
    state.setAnimationSpeed(1.8)
    state.setAnimationLoop(false)
    state.setAnimationTime(1)
    expect(useCompanionStore.getState()).toMatchObject({
      animationSource: 'Idle',
      animationPlaying: false,
      animationSpeed: 1.8,
      animationLoop: false,
      animationTime: 1,
    })
  })

  it('starts, replaces, cancels and completes a finite timeline by id', () => {
    const state = useCompanionStore.getState()
    const step: AnimationTimelineStep = {
      animation: 'Dance' as const,
      repeat_count: 2,
      speed: 1.2,
      transition_ms: 200,
      easing: 'ease_out' as const,
      expressions: [
        {
          expression: 'Surprised',
          to: 0.3,
          fade_in_ms: 100,
          hold_ms: 200,
          fade_out_ms: 100,
        },
      ],
    }
    state.startAnimationTimeline([step], 2000, 'call-a')
    const firstId = useCompanionStore.getState().timeline?.id
    expect(useCompanionStore.getState().timeline?.callId).toBe('call-a')
    state.setAnimationSource('Idle')
    expect(useCompanionStore.getState().timeline).toBeNull()
    expect(useCompanionStore.getState().animation).toBe('Idle')
    state.startAnimationTimeline([{ ...step, animation: 'Wave' }], 1000, 'call-b')
    const secondId = useCompanionStore.getState().timeline?.id
    expect(secondId).toBeGreaterThan(firstId ?? 0)
    expect(state.finishAnimationTimeline(firstId ?? 0)).toBe(false)
    expect(useCompanionStore.getState().timeline?.id).toBe(secondId)
    state.advanceAnimationTimeline(secondId ?? 0, 0)
    state.finishAnimationTimeline(secondId ?? 0)
    expect(useCompanionStore.getState()).toMatchObject({
      timeline: null,
      timelineExpressionTargets: null,
      animationSource: 'Idle',
      animation: 'Idle',
      animationLoop: true,
      animationPlaying: true,
      heldFinalPose: false,
      controlSource: 'ai_timeline',
      playbackOwner: 'ai_timeline',
    })
  })

  it('clears the active timeline when selecting a manual clip', () => {
    const state = useCompanionStore.getState()
    state.startAnimationTimeline(
      [
        {
          animation: 'Wave',
          repeat_count: 1,
          speed: 1,
          transition_ms: 250,
          easing: 'linear',
        },
      ],
      1000,
    )
    state.setAnimationSource('Dance')
    expect(useCompanionStore.getState()).toMatchObject({
      timeline: null,
      animationSource: 'Dance',
      controlSource: 'manual',
    })
  })

  it('cancels an AI timeline back to companion Idle instead of manual final-pose hold', () => {
    const state = useCompanionStore.getState()
    state.startAnimationTimeline(
      [
        {
          animation: 'Wave',
          repeat_count: 1,
          speed: 1,
          transition_ms: 250,
          easing: 'linear',
        },
      ],
      1000,
    )
    expect(state.cancelAnimationTimeline()).toBe(true)
    expect(useCompanionStore.getState()).toMatchObject({
      animation: 'Idle',
      timeline: null,
      animationLoop: true,
      animationPlaying: true,
      heldFinalPose: false,
      controlSource: 'ai_timeline',
      playbackOwner: 'ai_timeline',
    })
  })

  it('hands transport control to the inspector when the user changes an active AI timeline', () => {
    const state = useCompanionStore.getState()
    state.startAnimationTimeline(
      [
        {
          animation: 'Wave',
          repeat_count: 2,
          speed: 1,
          transition_ms: 250,
          easing: 'linear',
        },
      ],
      2000,
    )
    state.setAnimationSpeed(1.5)
    expect(useCompanionStore.getState()).toMatchObject({
      timeline: null,
      timelineExpressionTargets: null,
      animationSource: 'Wave',
      animationSpeed: 1.5,
    })
  })

  it('runs a companion one-shot and recovers to looping Idle without claiming manual ownership', () => {
    const state = useCompanionStore.getState()
    const step: AnimationTimelineStep = {
      animation: 'Wave' as const,
      repeat_count: 1,
      speed: 1,
      transition_ms: 250,
      easing: 'ease_in_out' as const,
      expressions: [
        {
          expression: 'Surprised',
          to: 0.2,
          fade_in_ms: 100,
          hold_ms: 100,
          fade_out_ms: 100,
        },
      ],
    }
    expect(state.startCompanionAction(41, [step], 1000)).toBe(true)
    expect(useCompanionStore.getState()).toMatchObject({
      animation: 'Wave',
      timeline: { behaviorReactionId: 41 },
      timelineExpressionTargets: [
        {
          expression: 'Surprised',
          to: 0.2,
          fade_in_ms: 100,
          hold_ms: 100,
          fade_out_ms: 100,
        },
      ],
      controlSource: 'ai_timeline',
      playbackOwner: 'ai_timeline',
    })
    expect(state.finishCompanionAction(40)).toBe(false)
    expect(state.finishCompanionAction(41)).toBe(true)
    expect(useCompanionStore.getState()).toMatchObject({
      animation: 'Idle',
      animationSource: 'Idle',
      animationLoop: true,
      animationPlaying: true,
      timeline: null,
      timelineExpressionTargets: null,
      heldFinalPose: false,
      controlSource: 'ai_timeline',
      playbackOwner: 'ai_timeline',
    })
  })

  it('captures the expression baseline and clears only the matching one-shot timeline', () => {
    const state = useCompanionStore.getState()
    state.setExpressionWeight('Sad', 0.24)
    const cues = [
      {
        expression: 'Sad' as const,
        to: 0.5,
        fade_in_ms: 100,
        hold_ms: 200,
        fade_out_ms: 100,
      },
    ]
    const previousRevision = useCompanionStore.getState().expressionTimelineRevision
    expect(state.startExpressionTimeline(cues, 400)).toBe(true)
    expect(useCompanionStore.getState().expressionTimeline).toMatchObject({
      id: previousRevision + 1,
      baseline: { Sad: 0.24 },
    })
    expect(state.clearExpressionTimeline()).toBe(true)
    expect(useCompanionStore.getState().expressionTimeline).toBeNull()
    expect(useCompanionStore.getState().expressionWeights.Sad).toBe(0.24)
  })

  it('cancels only the matching companion action and recovers to Idle', () => {
    const state = useCompanionStore.getState()
    const step = {
      animation: 'Wave' as const,
      repeat_count: 1,
      speed: 1,
      transition_ms: 250,
      easing: 'linear' as const,
    }
    state.startCompanionAction(7, [step], 1000)
    expect(state.cancelCompanionAction(8)).toBe(false)
    expect(useCompanionStore.getState().animation).toBe('Wave')
    expect(state.cancelCompanionAction(7)).toBe(true)
    expect(useCompanionStore.getState()).toMatchObject({
      animation: 'Idle',
      timeline: null,
      animationLoop: true,
      heldFinalPose: false,
    })
  })

  it('holds a persistent companion action at its final pose until replaced', () => {
    const state = useCompanionStore.getState()
    state.startCompanionAction(
      19,
      [
        {
          animation: 'Sitting',
          repeat_count: 1,
          speed: 1,
          transition_ms: 180,
          easing: 'ease_in_out',
        },
      ],
      1000,
      true,
    )
    expect(state.holdCompanionAction(18)).toBe(false)
    expect(state.holdCompanionAction(19)).toBe(true)
    expect(useCompanionStore.getState()).toMatchObject({
      timeline: null,
      animation: 'Sitting',
      animationLoop: false,
      animationPlaying: false,
      heldFinalPose: true,
    })
    useCompanionStore.getState().startCompanionAction(
      20,
      [
        {
          animation: 'Standing',
          repeat_count: 1,
          speed: 1,
          transition_ms: 180,
          easing: 'ease_in_out',
        },
      ],
      500,
    )
    expect(useCompanionStore.getState()).toMatchObject({
      animation: 'Standing',
      heldFinalPose: false,
      timeline: { behaviorReactionId: 20 },
    })
  })

  it('keeps the idle animation active for pose-only companion states', () => {
    const state = useCompanionStore.getState()
    expect(state.animation).toBe('Idle')
    expect(state.animationLoop).toBe(true)
    expect(state.animationPlaying).toBe(true)
    expect(state.timeline).toBeNull()
  })
})
