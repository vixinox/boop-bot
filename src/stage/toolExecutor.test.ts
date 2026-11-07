import { beforeEach, describe, expect, it } from 'vitest'
import { useCompanionStore } from '../state/companionStore'
import { dispatchBehaviorEvent, useBehaviorStore } from '../state/behaviorStore'
import { useSceneStore } from '../state/sceneStore'
import {
  beginPresentationTurn,
  abandonAiPresentation,
  cancelAllAiPresentations,
  completeAiPresentation,
  executeRobotTool,
  getActiveAiPresentationReactionId,
  resetPresentationQueueForTests,
} from './toolExecutor'

const catalog = [{ name: 'Head', parentName: 'Body', depth: 1, helper: false }]
const animations = [
  { name: 'Idle' as const, duration: 2, description: '站立' },
  { name: 'Wave' as const, duration: 1, description: '挥手' },
  { name: 'Dance' as const, duration: 1, description: '庆祝' },
  { name: 'Yes' as const, duration: 1, description: '点头' },
  { name: 'Sitting' as const, duration: 1, description: '坐下' },
  { name: 'Standing' as const, duration: 1, description: '站起' },
  { name: 'ThumbsUp' as const, duration: 1, description: '点赞' },
  { name: 'Death' as const, duration: 1 },
  { name: 'Punch' as const, duration: 1 },
]

describe('browser tool executor', () => {
  beforeEach(() => {
    resetPresentationQueueForTests()
    useBehaviorStore.getState().resetBehavior()
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
      animationDuration: 2,
      seekRevision: 0,
      rigJoints: catalog,
      animations,
      selectedBoneName: 'Head',
      boneRotations: {},
      expressionWeights: { Angry: 0, Surprised: 0, Sad: 0 },
      timeline: null,
      timelineRevision: 0,
      timelineStepIndex: 0,
      timelineExpressionTargets: null,
      heldFinalPose: false,
    })
    useSceneStore.setState({
      objects: [],
      lights: [
        {
          id: 'ambient',
          type: 'ambient',
          color: '#ffffff',
          intensity: 1.4,
          builtIn: true,
        },
        {
          id: 'key',
          type: 'directional',
          color: '#ffffff',
          intensity: 3.1,
          position: { x: 3, y: 5, z: 4 },
          target: { x: 0, y: 0, z: 0 },
          builtIn: true,
        },
        {
          id: 'fill',
          type: 'directional',
          color: '#c7d7ef',
          intensity: 1.15,
          position: { x: -4, y: 2, z: -3 },
          target: { x: 0, y: 0, z: 0 },
          builtIn: true,
        },
      ],
      camera: {
        position: { x: 0, y: 1.65, z: 4.6 },
        target: { x: 0, y: 1.06, z: 0 },
        fov: 34,
      },
      cameraCommand: null,
      sceneAnimation: null,
      sceneAnimationRevision: 0,
      revision: 0,
      cameraRevision: 0,
      nextEntityId: 1,
    })
  })

  it('starts finite AI timelines and rejects clips excluded from the model catalog', () => {
    const valid = executeRobotTool(
      'play_animation_timeline',
      JSON.stringify({
        steps: [
          {
            animation: 'Wave',
            repeat_count: 2,
            speed: 1,
            transition_ms: 250,
            easing: 'ease_in_out',
            expressions: [
              {
                expression: 'Surprised',
                to: 0.3,
                fade_in_ms: 100,
                hold_ms: 200,
                fade_out_ms: 100,
              },
            ],
          },
        ],
      }),
      'call-1',
    )
    expect(valid).toMatchObject({
      ok: true,
      result: { status: 'started', durationMs: 2000, reactionId: 1 },
    })
    expect(useCompanionStore.getState().timeline).toMatchObject({
      callId: 'call-1',
      behaviorReactionId: 1,
    })
    expect(useBehaviorStore.getState().activeReaction).toMatchObject({
      id: 1,
      kind: 'ai_action',
      action: 'Wave',
    })
    const before = useCompanionStore.getState().timeline
    const invalid = executeRobotTool(
      'play_animation_timeline',
      JSON.stringify({
        steps: [
          {
            animation: 'Death',
            repeat_count: 1,
            speed: 1,
            transition_ms: 0,
            easing: 'linear',
          },
        ],
      }),
    )
    expect(invalid.ok).toBe(false)
    expect(useCompanionStore.getState().timeline).toBe(before)
    expect(useBehaviorStore.getState().activeReaction?.id).toBe(1)
    expect(executeRobotTool('cancel_companion_presentation', '{}')).toMatchObject({
      ok: true,
      result: { status: 'cancelled' },
    })
    expect(useCompanionStore.getState()).toMatchObject({
      timeline: null,
      animation: 'Idle',
    })
    expect(useBehaviorStore.getState().activeReaction).toBeNull()
  })

  it('does not start a model animation while explicit manual ownership is active', () => {
    dispatchBehaviorEvent({ type: 'manual_takeover' })
    const result = executeRobotTool(
      'play_animation_timeline',
      JSON.stringify({
        steps: [
          {
            animation: 'Wave',
            repeat_count: 1,
            speed: 1,
            transition_ms: 250,
            easing: 'ease_in_out',
          },
        ],
      }),
    )

    expect(result).toMatchObject({
      ok: true,
      result: { status: 'suppressed', reason: 'manual_control_active' },
    })
    expect(useCompanionStore.getState().timeline).toBeNull()
    expect(useBehaviorStore.getState().activeReaction).toBeNull()
  })

  it('runs and replaces standalone expression timelines without taking body ownership', () => {
    const result = executeRobotTool(
      'play_expression_timeline',
      JSON.stringify({
        expressions: [
          {
            expression: 'Sad',
            to: 0.42,
            fade_in_ms: 180,
            hold_ms: 700,
            fade_out_ms: 320,
          },
        ],
      }),
      'expression-call',
    )
    expect(result).toMatchObject({
      ok: true,
      result: { status: 'started', cues: 1, durationMs: 1200 },
    })
    expect(useCompanionStore.getState().expressionTimeline).toMatchObject({
      cues: [{ expression: 'Sad', to: 0.42 }],
      baseline: { Angry: 0, Surprised: 0, Sad: 0 },
    })
    expect(getActiveAiPresentationReactionId()).toBeNull()
    const second = executeRobotTool(
      'play_expression_timeline',
      '{"expressions":[{"expression":"Surprised","to":0.25,"fade_in_ms":100,"hold_ms":200,"fade_out_ms":100}]}',
    )
    expect(second).toMatchObject({
      ok: true,
      result: { status: 'started' },
    })
    expect(useCompanionStore.getState().expressionTimeline).toMatchObject({
      cues: [{ expression: 'Surprised', to: 0.25 }],
    })
    expect(executeRobotTool('cancel_companion_presentation', '{}')).toMatchObject({
      ok: true,
      result: { status: 'already_idle' },
    })
    expect(useCompanionStore.getState().expressionTimeline).toBeNull()
    expect(useBehaviorStore.getState().activeReaction).toBeNull()
  })

  it('overlays local comfort without interrupting its reaction and preserves it on expression cancellation', () => {
    dispatchBehaviorEvent({
      type: 'semantic_action_requested',
      action: 'comfort',
      source: 'emotion',
    })
    const localReaction = useBehaviorStore.getState().activeReaction!
    useCompanionStore.getState().startCompanionAction(
      localReaction.id,
      [
        {
          animation: 'Yes',
          repeat_count: 1,
          speed: 1,
          transition_ms: 180,
          easing: 'ease_in_out',
          expressions: [
            {
              expression: 'Sad',
              to: 0.38,
              fade_in_ms: 150,
              hold_ms: 500,
              fade_out_ms: 250,
            },
          ],
        },
      ],
      1000,
    )
    const localTimelineId = useCompanionStore.getState().timeline?.id
    const result = executeRobotTool(
      'play_expression_timeline',
      '{"expressions":[{"expression":"Sad","to":0.6,"fade_in_ms":100,"hold_ms":200,"fade_out_ms":100}]}',
    )
    expect(result).toMatchObject({ ok: true, result: { status: 'started' } })
    expect(useBehaviorStore.getState().activeReaction?.id).toBe(localReaction.id)
    expect(useCompanionStore.getState().timeline?.id).toBe(localTimelineId)
    expect(executeRobotTool('cancel_companion_presentation', '{}')).toMatchObject({
      ok: true,
      result: { status: 'already_idle' },
    })
    expect(useCompanionStore.getState().expressionTimeline).toBeNull()
    expect(useBehaviorStore.getState().activeReaction?.id).toBe(localReaction.id)
    expect(useCompanionStore.getState().timeline?.id).toBe(localTimelineId)
  })

  it('suppresses expression timelines during manual, direct, sleeping, and suspended states', () => {
    const invoke = () =>
      executeRobotTool(
        'play_expression_timeline',
        '{"expressions":[{"expression":"Sad","to":0.3,"fade_in_ms":100,"hold_ms":200,"fade_out_ms":100}]}',
      )
    dispatchBehaviorEvent({ type: 'manual_takeover' })
    expect(invoke()).toMatchObject({
      ok: true,
      result: { status: 'suppressed', reason: 'manual_control_active' },
    })
    useBehaviorStore.getState().resetBehavior()
    resetPresentationQueueForTests()
    useCompanionStore.getState().recoverCompanionToAuto()
    dispatchBehaviorEvent({ type: 'avatar_touch_started', region: 'head' })
    expect(invoke()).toMatchObject({
      ok: true,
      result: { status: 'suppressed', reason: 'higher_priority_behavior_active' },
    })
    dispatchBehaviorEvent({ type: 'reaction_cancelled', reactionId: 1, reason: 'test' })
    useBehaviorStore.getState().resetBehavior()
    executeRobotTool('perform_companion_action', '{"action":"sleep"}')
    expect(invoke()).toMatchObject({
      ok: true,
      result: { status: 'suppressed', reason: 'companion_sleeping' },
    })
    useBehaviorStore.getState().resetBehavior()
    dispatchBehaviorEvent({ type: 'page_hidden' })
    expect(invoke()).toMatchObject({
      ok: true,
      result: { status: 'suppressed', reason: 'page_suspended' },
    })
  })

  it('runs only registered semantic actions and leaves scene state untouched', () => {
    const before = useSceneStore.getState().objects
    expect(
      executeRobotTool('perform_companion_action', '{"action":"celebrate"}'),
    ).toMatchObject({
      ok: true,
      result: { status: 'started', action: 'celebrate', reactionId: 1 },
    })
    expect(useBehaviorStore.getState().activeReaction).toMatchObject({
      kind: 'semantic_action',
      action: 'celebrate',
    })
    expect(useSceneStore.getState().objects).toBe(before)

    const created = executeRobotTool(
      'create_primitive',
      JSON.stringify({
        shape: 'sphere',
        position: { x: 0, y: 3, z: 0 },
        dimensions: { radius: 0.3 },
        color: '#f2c14e',
      }),
    )
    expect(created).toMatchObject({ ok: true, result: { id: 'object-1' } })
    expect(useBehaviorStore.getState().activeReaction?.action).toBe('celebrate')
    expect(useSceneStore.getState().objects).toHaveLength(1)

    const invalid = executeRobotTool(
      'perform_companion_action',
      '{"action":"set_bone","joint":"Head","rotation":90}',
    )
    expect(invalid).toMatchObject({
      ok: false,
      error: { code: 'INVALID_COMPANION_ACTION' },
    })
    expect(useBehaviorStore.getState().activeReaction?.action).toBe('celebrate')
  })

  it('locks model semantic actions and animation timelines during sleep until explicit wake', () => {
    expect(
      executeRobotTool('perform_companion_action', '{"action":"sleep"}'),
    ).toMatchObject({
      ok: true,
      result: { status: 'started', action: 'sleep' },
    })
    expect(useBehaviorStore.getState().emotion).toBe('sleepy')
    expect(useBehaviorStore.getState().activeReaction).toMatchObject({ action: 'sleep' })
    expect(useCompanionStore.getState()).toMatchObject({
      animation: 'Idle',
      animationLoop: true,
      animationPlaying: true,
      timeline: null,
    })
    expect(
      executeRobotTool('perform_companion_action', '{"action":"celebrate"}'),
    ).toMatchObject({
      ok: true,
      result: { status: 'suppressed', reason: 'companion_sleeping' },
    })
    expect(
      executeRobotTool(
        'play_animation_timeline',
        JSON.stringify({
          steps: [
            {
              animation: 'Wave',
              repeat_count: 1,
              speed: 1,
              transition_ms: 0,
              easing: 'linear',
            },
          ],
        }),
      ),
    ).toMatchObject({
      ok: true,
      result: { status: 'suppressed', reason: 'companion_sleeping' },
    })
    expect(
      executeRobotTool('perform_companion_action', '{"action":"wake"}'),
    ).toMatchObject({
      ok: true,
      result: { status: 'started', action: 'wake' },
    })
    expect(useBehaviorStore.getState().emotion).toBe('neutral')
    expect(useBehaviorStore.getState().activeReaction).toMatchObject({ action: 'wake' })
    expect(useCompanionStore.getState()).toMatchObject({
      animation: 'Idle',
      animationLoop: true,
      animationPlaying: true,
      timeline: null,
    })
  })

  it('suppresses semantic actions during explicit manual ownership', () => {
    dispatchBehaviorEvent({ type: 'manual_takeover' })
    expect(
      executeRobotTool('perform_companion_action', '{"action":"greet"}'),
    ).toMatchObject({
      ok: true,
      result: { status: 'suppressed', reason: 'manual_control_active' },
    })
    expect(useCompanionStore.getState().timeline).toBeNull()
  })

  it('suppresses duplicate model actions while the same action is still active', () => {
    expect(
      executeRobotTool('perform_companion_action', '{"action":"greet"}'),
    ).toMatchObject({
      ok: true,
      result: { status: 'started' },
    })
    expect(
      executeRobotTool('perform_companion_action', '{"action":"greet"}'),
    ).toMatchObject({
      ok: true,
      result: { status: 'suppressed', reason: 'action_already_active' },
    })
    expect(useBehaviorStore.getState().activeReaction?.id).toBe(1)
  })

  it('queues AI role performances sequentially and advances only on matching completion', () => {
    beginPresentationTurn('turn-a')
    const first = executeRobotTool('perform_companion_action', '{"action":"greet"}')
    const second = executeRobotTool('perform_companion_action', '{"action":"praise"}')
    const third = executeRobotTool(
      'play_animation_timeline',
      JSON.stringify({
        steps: [
          {
            animation: 'Wave',
            repeat_count: 1,
            speed: 1,
            transition_ms: 0,
            easing: 'linear',
          },
        ],
      }),
    )
    const overflow = executeRobotTool('perform_companion_action', '{"action":"comfort"}')

    expect(first).toMatchObject({
      ok: true,
      result: { status: 'started', action: 'greet' },
    })
    expect(second).toMatchObject({ ok: true, result: { status: 'queued', position: 1 } })
    expect(third).toMatchObject({ ok: true, result: { status: 'queued', position: 2 } })
    expect(overflow).toMatchObject({
      ok: true,
      result: { status: 'suppressed', reason: 'presentation_queue_full' },
    })
    expect(useBehaviorStore.getState().activeReaction?.action).toBe('greet')
    const firstId = getActiveAiPresentationReactionId()
    expect(firstId).not.toBeNull()
    expect(completeAiPresentation(firstId!)).toBe(true)
    expect(useBehaviorStore.getState().activeReaction?.action).toBe('praise')
    const secondId = getActiveAiPresentationReactionId()
    expect(completeAiPresentation(firstId!)).toBe(false)
    expect(getActiveAiPresentationReactionId()).toBe(secondId)
    expect(completeAiPresentation(secondId!)).toBe(true)
    expect(useBehaviorStore.getState().activeReaction?.kind).toBe('ai_action')
    expect(useBehaviorStore.getState().activeReaction?.action).toBe('Wave')
  })

  it('starts pose-only sleep and suppresses later model presentations instead of queueing them', () => {
    beginPresentationTurn('sleep-turn')
    expect(
      executeRobotTool('perform_companion_action', '{"action":"sleep"}'),
    ).toMatchObject({ ok: true, result: { status: 'started', action: 'sleep' } })
    expect(getActiveAiPresentationReactionId()).toBeNull()
    expect(
      executeRobotTool('perform_companion_action', '{"action":"celebrate"}'),
    ).toMatchObject({
      ok: true,
      result: { status: 'suppressed', reason: 'companion_sleeping' },
    })
  })

  it('cancels the exact active reaction and queued AI items but leaves scene animations intact', () => {
    beginPresentationTurn('cancel-turn')
    executeRobotTool('perform_companion_action', '{"action":"greet"}')
    executeRobotTool('perform_companion_action', '{"action":"praise"}')
    const activeId = getActiveAiPresentationReactionId()
    const sceneBefore = useSceneStore.getState().sceneAnimation
    expect(cancelAllAiPresentations('test_cancel')).toMatchObject({
      status: 'cancelled',
      activeReactionId: activeId,
      cancelledQueued: 1,
    })
    expect(useBehaviorStore.getState().activeReaction).toBeNull()
    expect(useCompanionStore.getState().timeline).toBeNull()
    expect(useSceneStore.getState().sceneAnimation).toBe(sceneBefore)
  })

  it('does not cancel presentation while explicit manual control is active', () => {
    beginPresentationTurn('manual-turn')
    executeRobotTool('perform_companion_action', '{"action":"greet"}')
    dispatchBehaviorEvent({ type: 'manual_takeover' })
    expect(executeRobotTool('cancel_companion_presentation', '{}')).toMatchObject({
      ok: true,
      result: { status: 'suppressed', reason: 'manual_control_active' },
    })
  })

  it('clears the active and queued AI presentation IDs when abandoning a failed request', () => {
    beginPresentationTurn('failed-turn')
    executeRobotTool('perform_companion_action', '{"action":"greet"}')
    executeRobotTool('perform_companion_action', '{"action":"praise"}')
    const activeId = getActiveAiPresentationReactionId()
    expect(abandonAiPresentation(activeId!)).toBe(true)
    expect(getActiveAiPresentationReactionId()).toBeNull()
    beginPresentationTurn('next-turn')
    expect(
      executeRobotTool('perform_companion_action', '{"action":"comfort"}'),
    ).toMatchObject({
      ok: true,
      result: { status: 'started', action: 'comfort' },
    })
    expect(useBehaviorStore.getState().activeReaction?.action).toBe('comfort')
  })

  it('creates, inspects, updates and deletes typed primitives atomically', () => {
    const created = executeRobotTool(
      'create_primitive',
      JSON.stringify({
        shape: 'sphere',
        position: { x: 0, y: 1, z: 0 },
        dimensions: { radius: 0.5 },
        color: '#336699',
      }),
    )
    expect(created).toMatchObject({ ok: true, result: { id: 'object-1' } })
    const snapshot = executeRobotTool('inspect_scene', '{}')
    expect(snapshot).toMatchObject({
      ok: true,
      result: { scene: { objects: [{ id: 'object-1', shape: 'sphere' }] } },
    })
    expect(
      executeRobotTool(
        'update_primitive',
        JSON.stringify({
          id: 'object-1',
          color: '#abcdef',
          dimensions: { radius: 1.25 },
        }),
      ),
    ).toMatchObject({ ok: true })
    expect(useSceneStore.getState().objects[0]).toMatchObject({
      dimensions: { radius: 1.25 },
      color: '#abcdef',
    })
    const before = useSceneStore.getState().objects[0]
    expect(
      executeRobotTool(
        'update_primitive',
        JSON.stringify({ id: 'object-1', dimensions: { width: 2 } }),
      ).ok,
    ).toBe(false)
    const rejectedShape = executeRobotTool(
      'create_primitive',
      JSON.stringify({
        shape: 'box',
        position: { x: 0, y: 0, z: 0 },
        dimensions: { width: 1, height: 2, depth: 0.3, radius: 0.2 },
        color: '#72B7D9',
      }),
    )
    expect(rejectedShape).toMatchObject({
      ok: false,
      error: {
        code: 'INVALID_DIMENSIONS_FOR_SHAPE',
        path: 'dimensions',
        expected: 'width, height, depth',
        repair: expect.stringContaining('Keep only width, height, depth'),
      },
    })
    const corrected = executeRobotTool(
      'create_primitive',
      JSON.stringify({
        shape: 'box',
        position: { x: 0, y: 0, z: 0 },
        dimensions: { width: 1, height: 2, depth: 0.3 },
        color: '#72B7D9',
      }),
    )
    expect(corrected.ok).toBe(true)
    if (corrected.ok)
      executeRobotTool('delete_scene_object', JSON.stringify(corrected.result))
    expect(useSceneStore.getState().objects[0]).toBe(before)
    expect(executeRobotTool('delete_scene_object', '{"id":"object-1"}')).toMatchObject({
      ok: true,
    })
    expect(useSceneStore.getState().objects).toEqual([])
  })

  it('returns structured actionable errors for camera constraints and unknown IDs', () => {
    expect(executeRobotTool('delete_scene_object', '{"id":"stale"}')).toMatchObject({
      ok: false,
      error: {
        code: 'UNKNOWN_PRIMITIVE_ID',
        path: 'id',
        repair: expect.stringContaining('inspect_scene'),
      },
    })
    expect(
      executeRobotTool(
        'set_camera_pose',
        '{"position":{"x":0,"y":0,"z":0},"target":{"x":0,"y":0,"z":0},"fov":34,"duration_ms":800}',
      ),
    ).toMatchObject({
      ok: false,
      error: {
        code: 'CAMERA_TARGET_EQUALS_POSITION',
        path: 'target',
        repair: expect.stringContaining('different'),
      },
    })
  })

  it('edits built-in lights, manages user lights, and validates the existing camera', () => {
    expect(
      executeRobotTool(
        'update_light',
        '{"id":"key","type":"directional","intensity":4.2}',
      ),
    ).toMatchObject({ ok: true })
    expect(
      useSceneStore.getState().lights.find((light) => light.id === 'key')?.intensity,
    ).toBe(4.2)
    expect(
      executeRobotTool('update_light', '{"id":"key","type":"point","intensity":3}'),
    ).toMatchObject({
      ok: false,
      error: { code: 'LIGHT_TYPE_MISMATCH', path: 'type', expected: 'directional' },
    })
    expect(executeRobotTool('delete_light', '{"id":"key"}').ok).toBe(false)
    const created = executeRobotTool(
      'create_light',
      JSON.stringify({
        type: 'spot',
        color: '#ffcc88',
        intensity: 2,
        position: { x: 1, y: 3, z: 2 },
        angle_deg: 45,
      }),
    )
    expect(created).toMatchObject({ ok: true, result: { id: 'light-1' } })
    expect(executeRobotTool('delete_light', '{"id":"light-1"}')).toMatchObject({
      ok: true,
    })
    expect(
      executeRobotTool(
        'set_camera_pose',
        JSON.stringify({
          position: { x: 2, y: 2, z: 4 },
          target: { x: 0, y: 1, z: 0 },
          fov: 42,
          duration_ms: 800,
        }),
      ),
    ).toMatchObject({ ok: true, result: { status: 'moving' } })
    expect(useSceneStore.getState().cameraCommand?.fov).toBe(42)
    expect(
      executeRobotTool(
        'set_camera_pose',
        '{"position":{"x":0,"y":0,"z":0},"target":{"x":0,"y":0,"z":0},"fov":34,"duration_ms":800}',
      ).ok,
    ).toBe(false)
  })

  it('starts looping primitive and light animations atomically and can replace or cancel them', () => {
    const objectId = useSceneStore.getState().createPrimitive({
      shape: 'sphere',
      position: { x: 1, y: 0, z: 0 },
      dimensions: { radius: 0.3 },
      color: '#ffffff',
    })
    const args = JSON.stringify({
      objects: [
        {
          id: objectId,
          orbit: {
            center: { x: 0, y: 0, z: 0 },
            radius: 2,
            period_ms: 10000,
            phase_deg: 90,
          },
          spin: { axis: { x: 0, y: 2, z: 0 }, period_ms: 1000, phase_deg: 0 },
        },
      ],
      lights: [
        { id: 'key', intensity: { min: 0.5, max: 3, period_ms: 2000, phase_deg: 0 } },
      ],
    })
    expect(executeRobotTool('animate_scene_nodes', args)).toMatchObject({
      ok: true,
      result: { status: 'started', objectCount: 1, lightCount: 1 },
    })
    const command = useSceneStore.getState().sceneAnimation
    expect(command?.objects[0].spin?.axis).toEqual({ x: 0, y: 1, z: 0 })
    expect(
      executeRobotTool(
        'animate_scene_nodes',
        JSON.stringify({
          objects: [
            {
              id: objectId,
              spin: { axis: { x: 1, y: 0, z: 0 }, period_ms: 3000, phase_deg: 0 },
            },
          ],
          lights: [],
        }),
      ).ok,
    ).toBe(true)
    expect(useSceneStore.getState().sceneAnimation?.objects).toHaveLength(1)
    expect(executeRobotTool('cancel_scene_animations', '{}')).toMatchObject({
      ok: true,
      result: { status: 'cancelled' },
    })
    expect(useSceneStore.getState().sceneAnimation).toBeNull()
    expect(executeRobotTool('cancel_scene_animations', '{}')).toMatchObject({
      ok: true,
      result: { status: 'already_idle' },
    })
  })

  it('rejects stale IDs and invalid animation values without replacing the active command', () => {
    const good = JSON.stringify({
      objects: [],
      lights: [
        {
          id: 'key',
          intensity: { min: 1, max: 2, period_ms: 1000, phase_deg: 0 },
        },
      ],
    })
    executeRobotTool('animate_scene_nodes', good)
    const before = useSceneStore.getState().sceneAnimation
    const stale = executeRobotTool(
      'animate_scene_nodes',
      JSON.stringify({
        objects: [
          {
            id: 'object-stale',
            spin: { axis: { x: 0, y: 1, z: 0 }, period_ms: 1000, phase_deg: 0 },
          },
        ],
        lights: [],
      }),
    )
    expect(stale).toMatchObject({
      ok: false,
      error: { code: 'INVALID_SCENE_ANIMATION', repair: expect.any(String) },
    })
    const invalid = executeRobotTool(
      'animate_scene_nodes',
      JSON.stringify({
        objects: [],
        lights: [
          { id: 'key', intensity: { min: 2, max: 1, period_ms: 0, phase_deg: 0 } },
        ],
      }),
    )
    expect(invalid.ok).toBe(false)
    expect(useSceneStore.getState().sceneAnimation).toBe(before)
  })
})
