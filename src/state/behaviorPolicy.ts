export type BehaviorPhase =
  | 'available'
  | 'listening'
  | 'thinking'
  | 'responding'
  | 'settling'
  | 'suspended'

export type BehaviorOwner = 'ambient' | 'conversation' | 'direct_interaction' | 'manual'
export type ControlMode = 'auto' | 'manual'
export type CompanionEmotion = 'neutral' | 'happy' | 'comfort' | 'sleepy'
export type SemanticAction =
  | 'greet'
  | 'affection'
  | 'praise'
  | 'celebrate'
  | 'comfort'
  | 'sleep'
  | 'wake'

export type TouchRegion = 'head' | 'torso' | 'hand'
export type ReactionKind =
  | 'head_affection'
  | 'torso_attention'
  | 'hand_wave'
  | 'thumbs_up'
  | 'ai_action'
  | 'semantic_action'

export type AttentionTarget = { x: number; y: number; z: number }

export type BehaviorEvent =
  | { type: 'conversation_submitted' }
  | { type: 'conversation_processing' }
  | { type: 'conversation_text_started' }
  | { type: 'conversation_tool_started' }
  | { type: 'conversation_turn_finished' }
  | { type: 'conversation_failed' }
  | { type: 'camera_user_changed'; target: AttentionTarget }
  | { type: 'camera_user_settled'; target: AttentionTarget }
  | { type: 'avatar_touch_started'; region: TouchRegion; point?: AttentionTarget }
  | { type: 'avatar_touch_ended'; region: TouchRegion }
  | { type: 'manual_takeover' }
  | { type: 'resume_companion' }
  | { type: 'page_hidden' }
  | { type: 'page_visible' }
  | { type: 'idle_deadline' }
  | { type: 'reaction_completed'; reactionId: number }
  | { type: 'reaction_held'; reactionId: number }
  | { type: 'reaction_cancelled'; reactionId: number; reason: string }
  | { type: 'ai_action_started'; action: string }
  | { type: 'emotion_changed'; emotion: CompanionEmotion }
  | {
      type: 'semantic_action_requested'
      action: SemanticAction
      source: 'shortcut' | 'model' | 'emotion'
    }

export type BehaviorReaction = {
  id: number
  kind: ReactionKind
  action: string
  owner: 'conversation' | 'direct_interaction' | 'ambient'
  target?: AttentionTarget
  persistent?: boolean
  followupAction?: SemanticAction
}

export type BehaviorState = {
  phase: BehaviorPhase
  emotion: CompanionEmotion
  controlMode: ControlMode
  owner: BehaviorOwner
  activeReaction: BehaviorReaction | null
  attentionTarget: AttentionTarget | null
  cameraSettled: boolean
  suspendedPhase: Exclude<BehaviorPhase, 'suspended'> | null
  suspendedOwner: BehaviorOwner | null
  lastTransition: { event: BehaviorEvent['type']; reason: string } | null
}

export type BehaviorIntent =
  | { type: 'start_reaction'; reaction: BehaviorReaction }
  | { type: 'cancel_reaction'; reactionId: number; reason: string }
  | { type: 'phase_changed'; phase: BehaviorPhase; previous: BehaviorPhase }
  | { type: 'attention_changed'; target: AttentionTarget | null }

export const initialBehaviorState: BehaviorState = {
  phase: 'available',
  emotion: 'neutral',
  controlMode: 'auto',
  owner: 'ambient',
  activeReaction: null,
  attentionTarget: null,
  cameraSettled: true,
  suspendedPhase: null,
  suspendedOwner: null,
  lastTransition: null,
}

export type BehaviorTransition = {
  state: BehaviorState
  intents: BehaviorIntent[]
}

const phaseForEvent: Partial<Record<BehaviorEvent['type'], BehaviorPhase>> = {
  conversation_submitted: 'listening',
  conversation_processing: 'thinking',
  conversation_text_started: 'responding',
  conversation_tool_started: 'thinking',
  conversation_turn_finished: 'settling',
  conversation_failed: 'settling',
}

function reactionForTouch(
  event: Extract<BehaviorEvent, { type: 'avatar_touch_started' }>,
) {
  const mapping: Record<TouchRegion, { kind: ReactionKind; action: string }> = {
    head: { kind: 'head_affection', action: 'head_nod' },
    torso: { kind: 'torso_attention', action: 'look_at_touch' },
    hand: { kind: 'hand_wave', action: 'Wave' },
  }
  return mapping[event.region]
}

function finiteTarget(target: AttentionTarget | undefined): AttentionTarget | undefined {
  if (
    !target ||
    !Number.isFinite(target.x) ||
    !Number.isFinite(target.y) ||
    !Number.isFinite(target.z)
  )
    return undefined
  return { x: target.x, y: target.y, z: target.z }
}

function phaseAfterReaction(phase: BehaviorPhase): BehaviorPhase {
  return phase === 'settling' ? 'available' : phase
}

function ownerForPhase(phase: BehaviorPhase): BehaviorOwner {
  return phase === 'available' || phase === 'settling' || phase === 'suspended'
    ? 'ambient'
    : 'conversation'
}

const emotionForAction: Partial<Record<SemanticAction, CompanionEmotion>> = {
  praise: 'happy',
  celebrate: 'happy',
  comfort: 'comfort',
  sleep: 'sleepy',
  wake: 'neutral',
}

export function transitionBehavior(
  current: BehaviorState,
  event: BehaviorEvent,
  nextReactionId: number,
): BehaviorTransition {
  let state = current
  const intents: BehaviorIntent[] = []
  let reason: string = event.type

  if (event.type === 'page_hidden') {
    if (current.phase === 'suspended') return { state: current, intents }
    if (current.activeReaction)
      intents.push({
        type: 'cancel_reaction',
        reactionId: current.activeReaction.id,
        reason: 'page_hidden',
      })
    state = {
      ...current,
      suspendedPhase: current.phase,
      suspendedOwner: current.owner,
      phase: 'suspended',
      owner: 'ambient',
      activeReaction: null,
      cameraSettled: true,
    }
    reason = 'page_hidden_clears_temporary_behavior'
  } else if (event.type === 'page_visible') {
    if (current.phase !== 'suspended') return { state: current, intents }
    state = {
      ...current,
      phase: current.suspendedPhase ?? 'available',
      owner:
        current.suspendedOwner === 'manual'
          ? 'manual'
          : ownerForPhase(current.suspendedPhase ?? 'available'),
      suspendedPhase: null,
      suspendedOwner: null,
    }
    reason = 'page_visible_resume_without_catchup'
  } else if (event.type === 'manual_takeover') {
    if (current.phase === 'suspended') return { state: current, intents }
    if (current.activeReaction)
      intents.push({
        type: 'cancel_reaction',
        reactionId: current.activeReaction.id,
        reason: 'manual_takeover',
      })
    state = {
      ...current,
      controlMode: 'manual',
      owner: 'manual',
      activeReaction: null,
    }
  } else if (event.type === 'resume_companion') {
    if (current.phase === 'suspended') return { state: current, intents }
    if (current.activeReaction)
      intents.push({
        type: 'cancel_reaction',
        reactionId: current.activeReaction.id,
        reason: 'resume_auto',
      })
    state = {
      ...current,
      controlMode: 'auto',
      owner: ownerForPhase(current.phase === 'settling' ? 'available' : current.phase),
      phase: current.phase === 'settling' ? 'available' : current.phase,
      activeReaction: null,
    }
    reason = 'auto_control_restored'
  } else if (
    event.type === 'camera_user_changed' ||
    event.type === 'camera_user_settled'
  ) {
    state = {
      ...current,
      attentionTarget: event.target,
      cameraSettled: event.type === 'camera_user_settled',
    }
    intents.push({ type: 'attention_changed', target: event.target })
  } else if (event.type === 'avatar_touch_started') {
    if (current.phase === 'suspended' || current.owner === 'manual')
      return { state: current, intents }
    if (current.activeReaction?.owner === 'direct_interaction')
      return { state: current, intents }
    if (current.activeReaction)
      intents.push({
        type: 'cancel_reaction',
        reactionId: current.activeReaction.id,
        reason: 'replaced_by_direct_interaction',
      })
    const response = reactionForTouch(event)
    const reaction: BehaviorReaction = {
      id: nextReactionId,
      kind: response.kind,
      action: response.action,
      owner: 'direct_interaction',
      ...(finiteTarget(event.point) ? { target: finiteTarget(event.point) } : {}),
    }
    state = { ...current, owner: 'direct_interaction', activeReaction: reaction }
    intents.push({ type: 'start_reaction', reaction })
  } else if (event.type === 'avatar_touch_ended') {
    return { state: current, intents }
  } else if (event.type === 'emotion_changed') {
    if (current.phase === 'suspended' || current.emotion === 'sleepy')
      return { state: current, intents }
    if (current.emotion === event.emotion) return { state: current, intents }
    if (current.activeReaction?.owner === 'conversation')
      intents.push({
        type: 'cancel_reaction',
        reactionId: current.activeReaction.id,
        reason: 'emotion_changed',
      })
    if (current.activeReaction?.owner === 'conversation')
      intents.push({
        type: 'phase_changed',
        phase: current.phase,
        previous: current.phase,
      })
    state = {
      ...current,
      emotion: event.emotion,
      activeReaction:
        current.activeReaction?.owner === 'conversation' ? null : current.activeReaction,
      owner:
        current.owner === 'manual' ||
        current.activeReaction?.owner === 'direct_interaction'
          ? current.owner
          : ownerForPhase(current.phase),
    }
  } else if (event.type === 'semantic_action_requested') {
    if (current.phase === 'suspended') return { state: current, intents }
    if (current.owner === 'manual' && event.source === 'model')
      return { state: current, intents }
    const wakeThenAction =
      current.emotion === 'sleepy' &&
      event.source === 'shortcut' &&
      (event.action === 'affection' || event.action === 'praise')
    if (current.emotion === 'sleepy' && event.action !== 'wake' && !wakeThenAction)
      return { state: current, intents }
    if (
      event.source === 'model' &&
      current.activeReaction?.kind === 'semantic_action' &&
      current.activeReaction.action === event.action
    )
      return { state: current, intents }
    const requestedAction = wakeThenAction ? 'wake' : event.action
    const emotion =
      requestedAction === 'wake'
        ? 'neutral'
        : (emotionForAction[requestedAction] ?? current.emotion)
    const owner = event.source === 'shortcut' ? 'direct_interaction' : 'conversation'
    if (current.owner === 'manual') {
      state = { ...current, emotion }
      reason = 'manual_control_suppressed_action'
    } else if (
      event.source === 'model' &&
      current.activeReaction?.owner === 'direct_interaction'
    ) {
      return { state: current, intents }
    } else {
      if (current.activeReaction)
        intents.push({
          type: 'cancel_reaction',
          reactionId: current.activeReaction.id,
          reason: 'replaced_by_semantic_action',
        })
      const reaction: BehaviorReaction = {
        id: nextReactionId,
        kind: 'semantic_action',
        action: requestedAction,
        owner,
        persistent: requestedAction === 'sleep',
        ...(wakeThenAction ? { followupAction: event.action } : {}),
      }
      state = { ...current, emotion, owner, activeReaction: reaction }
      intents.push({ type: 'start_reaction', reaction })
    }
  } else if (event.type === 'ai_action_started') {
    if (
      current.phase === 'suspended' ||
      current.owner === 'manual' ||
      current.emotion === 'sleepy' ||
      current.activeReaction?.owner === 'direct_interaction'
    )
      return { state: current, intents }
    if (current.activeReaction)
      intents.push({
        type: 'cancel_reaction',
        reactionId: current.activeReaction.id,
        reason: 'replaced_by_ai_action',
      })
    const reaction: BehaviorReaction = {
      id: nextReactionId,
      kind: 'ai_action',
      action: event.action,
      owner: 'conversation',
    }
    state = { ...current, owner: 'conversation', activeReaction: reaction }
    intents.push({ type: 'start_reaction', reaction })
  } else if (event.type === 'reaction_held') {
    if (current.activeReaction?.id !== event.reactionId)
      return { state: current, intents }
    state = { ...current, owner: current.activeReaction.owner }
    reason = 'persistent_action_holding_pose'
  } else if (event.type === 'reaction_completed' || event.type === 'reaction_cancelled') {
    if (current.activeReaction?.id !== event.reactionId)
      return { state: current, intents }
    const followupAction =
      event.type === 'reaction_completed' && current.activeReaction.followupAction
        ? current.activeReaction.followupAction
        : undefined
    state = {
      ...current,
      activeReaction: null,
      owner:
        current.phase === 'available' || current.phase === 'settling'
          ? 'ambient'
          : 'conversation',
      phase: phaseAfterReaction(current.phase),
    }
    if (current.activeReaction.kind === 'semantic_action') {
      const action = current.activeReaction.action as SemanticAction
      const emotion =
        action === 'sleep' || action === 'wake'
          ? current.emotion
          : emotionForAction[action]
      if (emotion) state = { ...state, emotion }
    }
    if (followupAction) {
      const reaction: BehaviorReaction = {
        id: nextReactionId,
        kind: 'semantic_action',
        action: followupAction,
        owner: current.activeReaction.owner,
      }
      state = {
        ...state,
        emotion: emotionForAction[followupAction] ?? state.emotion,
        activeReaction: reaction,
        owner: reaction.owner,
      }
      intents.push({ type: 'start_reaction', reaction })
    }
    reason = event.type === 'reaction_cancelled' ? event.reason : 'reaction_completed'
  } else if (event.type === 'idle_deadline') {
    if (current.phase !== 'settling' || current.activeReaction)
      return { state: current, intents }
    state = {
      ...current,
      phase: 'available',
      owner: current.owner === 'manual' ? 'manual' : 'ambient',
    }
    reason = 'settling_deadline_elapsed'
  } else {
    if (current.phase === 'suspended') return { state: current, intents }
    const phase = phaseForEvent[event.type]
    if (!phase) return { state: current, intents }
    state = {
      ...current,
      phase,
      owner:
        current.owner === 'manual'
          ? 'manual'
          : current.activeReaction?.owner === 'direct_interaction'
            ? 'direct_interaction'
            : ownerForPhase(phase),
    }
  }

  if (state.phase !== current.phase)
    intents.push({ type: 'phase_changed', phase: state.phase, previous: current.phase })
  state = { ...state, lastTransition: { event: event.type, reason } }
  return { state, intents }
}
