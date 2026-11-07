import { useCompanionStore } from '../state/companionStore'
import type { CompanionState } from '../state/companionStore'
import { dispatchBehaviorEvent, useBehaviorStore } from '../state/behaviorStore'
import { useSceneStore } from '../state/sceneStore'
import type { SceneState } from '../state/sceneStore'
import { validateAnimationTimeline } from './animationTimeline'
import { validateExpressionCues } from './expressionTimeline'
import {
  validateCameraPose,
  validateLightCreate,
  validateLightUpdate,
  validatePrimitiveCreate,
  validatePrimitiveUpdate,
  validateSceneAnimations,
} from './sceneValidation'
import { createSceneSnapshot } from './sceneSnapshot'
import { SEMANTIC_ACTIONS } from './companionActions'
import type { SemanticAction } from '../state/behaviorPolicy'
import type { AnimationTimelineStep } from '../state/companionStore'

export type ToolResult =
  | { ok: true; toolName: string; result: unknown }
  | { ok: false; toolName: string; error: ToolError; errorText: string }

export type ToolError = {
  code: string
  message: string
  path?: string
  expected?: string
  repair?: string
}

type AiPresentationRequest =
  | {
      kind: 'timeline'
      steps: AnimationTimelineStep[]
      durationMs: number
      callId?: string
      state: CompanionState
    }
  | {
      kind: 'semantic'
      action: SemanticAction
      state: CompanionState
    }

const MAX_AI_PRESENTATIONS_PER_TURN = 3
let acceptedThisTurn = 0
let activePresentationReactionId: number | null = null
let queuedPresentations: AiPresentationRequest[] = []

export function beginPresentationTurn(_turnId?: string) {
  queuedPresentations = []
  acceptedThisTurn = 0
}

export function resetPresentationQueueForTests() {
  queuedPresentations = []
  acceptedThisTurn = 0
  activePresentationReactionId = null
}

export function getActiveAiPresentationReactionId() {
  return activePresentationReactionId
}

export function cancelQueuedPresentations(_reason: string) {
  queuedPresentations = []
}

function startAiPresentation(request: AiPresentationRequest) {
  const behavior = useBehaviorStore.getState()
  if (behavior.owner === 'manual')
    return { status: 'suppressed', reason: 'manual_control_active' } as const
  if (
    behavior.emotion === 'sleepy' &&
    (request.kind === 'timeline' ||
      (request.kind === 'semantic' && request.action !== 'wake'))
  )
    return { status: 'suppressed', reason: 'companion_sleeping' } as const

  if (request.kind === 'timeline') {
    const reactionAction = request.steps.map((step) => step.animation).join(' -> ')
    const intents = dispatchBehaviorEvent({
      type: 'ai_action_started',
      action: reactionAction,
    })
    const reaction = useBehaviorStore.getState().activeReaction
    if (!reaction || !intents.some((intent) => intent.type === 'start_reaction'))
      return { status: 'suppressed', reason: 'higher_priority_behavior_active' } as const
    request.state.startAnimationTimeline(
      request.steps,
      request.durationMs,
      request.callId,
      reaction.id,
    )
    if (useCompanionStore.getState().timeline?.behaviorReactionId !== reaction.id) {
      acceptedThisTurn -= 1
      dispatchBehaviorEvent({
        type: 'reaction_cancelled',
        reactionId: reaction.id,
        reason: 'timeline_start_failed',
      })
      return { status: 'suppressed', reason: 'presentation_start_failed' } as const
    }
    activePresentationReactionId = reaction.id
    return {
      status: 'started',
      steps: request.steps.length,
      durationMs: request.durationMs,
      reactionId: reaction.id,
    } as const
  }

  const intents = dispatchBehaviorEvent({
    type: 'semantic_action_requested',
    action: request.action,
    source: 'model',
  })
  const reaction = useBehaviorStore.getState().activeReaction
  if (!reaction || !intents.some((intent) => intent.type === 'start_reaction'))
    return {
      status: 'suppressed',
      reason:
        useBehaviorStore.getState().emotion === 'sleepy'
          ? 'companion_sleeping'
          : useBehaviorStore.getState().owner === 'manual'
            ? 'manual_control_active'
            : useBehaviorStore.getState().activeReaction?.action === request.action
              ? 'action_already_active'
              : 'higher_priority_behavior_active',
    } as const
  activePresentationReactionId = request.action === 'sleep' ? null : reaction.id
  return { status: 'started', action: request.action, reactionId: reaction.id } as const
}

function startNextQueuedPresentation() {
  while (queuedPresentations.length > 0) {
    const request = queuedPresentations.shift()!
    const result = startAiPresentation(request)
    if (result.status === 'started') return
  }
}

export function completeAiPresentation(reactionId: number) {
  if (activePresentationReactionId !== reactionId) return false
  activePresentationReactionId = null
  startNextQueuedPresentation()
  return true
}

export function abandonAiPresentation(reactionId: number) {
  if (activePresentationReactionId !== reactionId) return false
  activePresentationReactionId = null
  return true
}

export function cancelAllAiPresentations(reason: string) {
  const cancelledQueued = queuedPresentations.length
  const reactionId = activePresentationReactionId
  const behavior = useBehaviorStore.getState()
  useCompanionStore.getState().clearExpressionTimeline()
  if (behavior.owner === 'manual') {
    return {
      status: 'suppressed',
      reason: 'manual_control_active',
      activeReactionId: reactionId,
      cancelledQueued: 0,
    } as const
  }
  queuedPresentations = []
  activePresentationReactionId = null
  if (reactionId === null)
    return { status: 'already_idle', activeReactionId: null, cancelledQueued } as const
  if (behavior.activeReaction?.id === reactionId) {
    const timeline = useCompanionStore.getState().timeline
    if (timeline?.behaviorReactionId === reactionId)
      useCompanionStore.getState().cancelCompanionAction(reactionId)
    else {
      dispatchBehaviorEvent({ type: 'reaction_cancelled', reactionId, reason })
    }
  }
  return {
    status: 'cancelled',
    activeReactionId: reactionId,
    cancelledQueued,
  } as const
}

export function cancelAllAiPresentationsAndResumeAuto(reason: string) {
  const hadActiveAiReaction = activePresentationReactionId !== null
  const result = cancelAllAiPresentations(reason)
  if (result.status === 'suppressed') return result
  const currentReaction = useBehaviorStore.getState().activeReaction
  if (
    !hadActiveAiReaction &&
    currentReaction?.owner === 'conversation' &&
    currentReaction.kind !== 'ai_action'
  )
    return result
  dispatchBehaviorEvent({ type: 'resume_companion' })
  useCompanionStore.getState().recoverCompanionToAuto()
  return result
}

function submitAiPresentation(request: AiPresentationRequest) {
  if (acceptedThisTurn >= MAX_AI_PRESENTATIONS_PER_TURN)
    return { status: 'suppressed', reason: 'presentation_queue_full' } as const

  const behavior = useBehaviorStore.getState()
  if (behavior.owner === 'manual')
    return { status: 'suppressed', reason: 'manual_control_active' } as const
  if (behavior.emotion === 'sleepy') {
    if (
      request.kind === 'timeline' ||
      (request.kind === 'semantic' && request.action !== 'wake')
    )
      return { status: 'suppressed', reason: 'companion_sleeping' } as const
  }

  if (
    behavior.activeReaction?.owner === 'direct_interaction' &&
    ((request.kind === 'semantic' && request.action !== 'wake') ||
      request.kind === 'timeline')
  )
    return { status: 'suppressed', reason: 'higher_priority_behavior_active' } as const

  if (
    request.kind === 'semantic' &&
    request.action !== 'wake' &&
    request.action !== 'sleep' &&
    (behavior.activeReaction?.action === request.action ||
      queuedPresentations.some(
        (queued) => queued.kind === 'semantic' && queued.action === request.action,
      ))
  )
    return { status: 'suppressed', reason: 'action_already_active' } as const

  acceptedThisTurn += 1
  const persistentSleepActive =
    behavior.emotion === 'sleepy' && behavior.activeReaction?.action === 'sleep'
  if (activePresentationReactionId !== null && !persistentSleepActive) {
    queuedPresentations.push(request)
    return { status: 'queued', position: queuedPresentations.length } as const
  }
  const result = startAiPresentation(request)
  if (
    result.status === 'started' &&
    request.kind === 'semantic' &&
    request.action === 'sleep'
  )
    activePresentationReactionId = null
  return result
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

export function executeRobotTool(
  name: string,
  raw: string,
  callId?: string,
  state: CompanionState = useCompanionStore.getState(),
  scene: SceneState = useSceneStore.getState(),
): ToolResult {
  const fail = (error: string | ToolError): ToolResult => {
    const detail: ToolError =
      typeof error === 'string' ? describeToolError(name, error, {}) : error
    return { ok: false, toolName: name, error: detail, errorText: detail.message }
  }
  const succeed = (result: unknown): ToolResult => ({ ok: true, toolName: name, result })
  try {
    const args = JSON.parse(raw) as unknown
    if (!isRecord(args)) return fail('Arguments must be an object')

    if (name === 'play_animation_timeline') {
      const validated = validateAnimationTimeline(args, state.animations)
      if (!validated.ok) return fail(validated.error)
      return succeed(
        submitAiPresentation({
          kind: 'timeline',
          steps: validated.value,
          durationMs: validated.durationMs,
          callId,
          state,
        }),
      )
    }

    if (name === 'play_expression_timeline') {
      const validated = validateExpressionCues(args.expressions)
      if (!validated.ok) return fail(validated.error)
      if (Object.keys(args).length !== 1)
        return fail('Expression timeline accepts only expressions')
      const behavior = useBehaviorStore.getState()
      if (behavior.phase === 'suspended')
        return succeed({ status: 'suppressed', reason: 'page_suspended' })
      if (behavior.owner === 'manual')
        return succeed({ status: 'suppressed', reason: 'manual_control_active' })
      if (behavior.owner === 'direct_interaction')
        return succeed({
          status: 'suppressed',
          reason: 'higher_priority_behavior_active',
        })
      if (behavior.emotion === 'sleepy')
        return succeed({ status: 'suppressed', reason: 'companion_sleeping' })
      const started = state.startExpressionTimeline(validated.value, validated.durationMs)
      return succeed({
        status: started ? 'started' : 'suppressed',
        ...(!started ? { reason: 'expression_timeline_start_failed' } : {}),
        cues: validated.value.length,
        durationMs: validated.durationMs,
        expressionTimelineId: useCompanionStore.getState().expressionTimeline?.id,
      })
    }

    if (name === 'perform_companion_action') {
      if (
        Object.keys(args).length !== 1 ||
        typeof args.action !== 'string' ||
        !SEMANTIC_ACTIONS.includes(args.action as SemanticAction)
      )
        return fail({
          code: 'INVALID_COMPANION_ACTION',
          message: 'A supported semantic companion action is required.',
          path: 'action',
          expected: SEMANTIC_ACTIONS.join(', '),
          repair: 'Choose one action from the registered semantic action list.',
        })
      const action = args.action as SemanticAction
      return succeed(submitAiPresentation({ kind: 'semantic', action, state }))
    }

    if (name === 'cancel_companion_presentation') {
      if (Object.keys(args).length) return fail('Cancellation takes no arguments')
      return succeed(cancelAllAiPresentationsAndResumeAuto('cancelled_by_model'))
    }

    if (name === 'animate_scene_nodes') {
      const validated = validateSceneAnimations(
        args,
        scene.objects.map((object) => object.id),
        scene.lights.map((light) => light.id),
      )
      if (!validated.ok) return fail(validated.error)
      const commandId = scene.startSceneAnimation({
        ...validated.value,
        startedAtMs: performance.now(),
      })
      return succeed({
        status: 'started',
        commandId,
        objectCount: validated.value.objects.length,
        lightCount: validated.value.lights.length,
      })
    }

    if (name === 'cancel_scene_animations') {
      if (Object.keys(args).length)
        return fail('Scene animation cancellation takes no arguments')
      return succeed({
        status: scene.cancelSceneAnimation() ? 'cancelled' : 'already_idle',
      })
    }

    if (name === 'inspect_scene') {
      if (Object.keys(args).length) return fail('Scene inspection takes no arguments')
      return succeed(createSceneSnapshot(state, scene, useBehaviorStore.getState()))
    }

    if (name === 'create_primitive') {
      const validated = validatePrimitiveCreate(args)
      if (!validated.ok) return fail(validated.error)
      return succeed({ id: scene.createPrimitive(validated.value) })
    }

    if (name === 'update_primitive') {
      if (typeof args.id !== 'string' || !args.id) return fail('Primitive id is required')
      const current = scene.objects.find((object) => object.id === args.id)
      if (!current) return fail(`Unknown primitive id: ${args.id}`)
      const patch: Record<string, unknown> = { ...args }
      delete patch.id
      const validated = validatePrimitiveUpdate(current, patch)
      if (!validated.ok) return fail(validated.error)
      scene.updatePrimitive(args.id, validated.value)
      return succeed({ id: args.id, status: 'updated' })
    }

    if (name === 'delete_scene_object') {
      if (Object.keys(args).length !== 1 || typeof args.id !== 'string' || !args.id)
        return fail('A primitive id is required')
      return scene.deletePrimitive(args.id)
        ? succeed({ id: args.id, status: 'deleted' })
        : fail(`Unknown primitive id: ${args.id}`)
    }

    if (name === 'create_light') {
      const validated = validateLightCreate(args)
      if (!validated.ok) return fail(validated.error)
      const value = {
        ...validated.value,
        ...(validated.value.type === 'directional' || validated.value.type === 'spot'
          ? { target: validated.value.target ?? { x: 0, y: 0, z: 0 } }
          : {}),
      }
      return succeed({ id: scene.createLight(value) })
    }

    if (name === 'update_light') {
      if (typeof args.id !== 'string' || !args.id) return fail('Light id is required')
      const current = scene.lights.find((light) => light.id === args.id)
      if (!current) return fail(`Unknown light id: ${args.id}`)
      if (args.type !== current.type)
        return fail({
          code: 'LIGHT_TYPE_MISMATCH',
          message: `Light ${args.id} is ${current.type}, not ${String(args.type)}`,
          path: 'type',
          expected: current.type,
          repair: 'Use the current type reported by inspect_scene and retry.',
        })
      const patch: Record<string, unknown> = { ...args }
      delete patch.id
      delete patch.type
      const validated = validateLightUpdate(current, patch)
      if (!validated.ok) return fail(validated.error)
      scene.updateLight(args.id, validated.value)
      return succeed({ id: args.id, status: 'updated' })
    }

    if (name === 'delete_light') {
      if (Object.keys(args).length !== 1 || typeof args.id !== 'string' || !args.id)
        return fail('A light id is required')
      const current = scene.lights.find((light) => light.id === args.id)
      if (!current) return fail(`Unknown light id: ${args.id}`)
      if (current.builtIn) return fail('Built-in lights cannot be deleted')
      scene.deleteLight(args.id)
      return succeed({ id: args.id, status: 'deleted' })
    }

    if (name === 'set_camera_pose') {
      const validated = validateCameraPose(args)
      if (!validated.ok) return fail(validated.error)
      const id = scene.requestCameraPose(validated.value)
      return succeed({ status: 'moving', commandId: id })
    }

    return fail('Unknown tool')
  } catch {
    return fail('Invalid tool arguments')
  }
}

function describeToolError(
  name: string,
  message: string,
  args: Record<string, unknown>,
): ToolError {
  const dimensions = args.dimensions
  if (
    message === 'Invalid dimensions for box' ||
    message === 'Invalid dimensions for sphere' ||
    message === 'Invalid dimensions for cylinder' ||
    message === 'Invalid dimensions for cone' ||
    message === 'Invalid dimensions for torus'
  ) {
    const shape =
      typeof args.shape === 'string'
        ? args.shape
        : message.replace('Invalid dimensions for ', '')
    const expected: Record<string, string> = {
      box: 'width, height, depth',
      sphere: 'radius',
      cylinder: 'radius_top, radius_bottom, height',
      cone: 'radius, height',
      torus: 'major_radius, tube_radius',
    }
    return {
      code: 'INVALID_DIMENSIONS_FOR_SHAPE',
      message: `${shape} dimensions contain unsupported or missing fields`,
      path: 'dimensions',
      expected: expected[shape] ?? 'shape-specific dimensions',
      repair: `Keep only ${expected[shape] ?? 'the dimensions supported by the selected shape'} and provide every listed field with a finite number greater than 0.`,
    }
  }
  if (message === 'Dimensions must be finite positive numbers')
    return {
      code: 'INVALID_DIMENSION_VALUE',
      message,
      path: 'dimensions',
      expected: 'finite numbers greater than 0',
      repair: 'Replace every dimension with a finite number greater than 0.',
    }
  if (message.includes('Unknown primitive id'))
    return {
      code: 'UNKNOWN_PRIMITIVE_ID',
      message,
      path: 'id',
      expected: 'an ID returned by inspect_scene',
      repair: 'Call inspect_scene and retry using the current primitive ID.',
    }
  if (message.includes('Unknown light id'))
    return {
      code: 'UNKNOWN_LIGHT_ID',
      message,
      path: 'id',
      expected: 'an ID returned by inspect_scene',
      repair: 'Call inspect_scene and retry using the current light ID.',
    }
  if (message.includes('Camera position and target'))
    return {
      code: 'CAMERA_TARGET_EQUALS_POSITION',
      message,
      path: 'target',
      expected: 'a target different from position',
      repair: 'Choose a look-at target different from the camera position.',
    }
  if (message.includes('Only ') && (name === 'create_light' || name === 'update_light'))
    return {
      code: 'UNSUPPORTED_LIGHT_FIELD',
      message,
      path: 'light property',
      repair: 'Remove properties unsupported by the selected light type and retry.',
    }
  return {
    code: 'INVALID_TOOL_ARGUMENTS',
    message,
    repair: dimensions
      ? 'Check the tool description and retry with only supported fields.'
      : 'Check the tool schema and retry with valid arguments.',
  }
}
