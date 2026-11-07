import { create } from 'zustand'
import { initialBehaviorState, transitionBehavior } from './behaviorPolicy'
import type { BehaviorEvent, BehaviorIntent, BehaviorState } from './behaviorPolicy'
import { logBehaviorDiagnostic } from './debugConsoleStore'

export type BehaviorStoreState = BehaviorState & {
  dispatchBehaviorEvent: (event: BehaviorEvent) => BehaviorIntent[]
  resetBehavior: () => void
}

let nextReactionId = 1
const SETTLING_DURATION_MS = 900
let settlingTimer: ReturnType<typeof setTimeout> | undefined
let settlingStartedAt: number | undefined
let settlingRemainingMs = SETTLING_DURATION_MS

function clearSettlingTimer(preserveRemaining = false) {
  if (settlingTimer !== undefined) {
    if (preserveRemaining && settlingStartedAt !== undefined)
      settlingRemainingMs = Math.max(
        0,
        settlingRemainingMs - (Date.now() - settlingStartedAt),
      )
    clearTimeout(settlingTimer)
  }
  settlingTimer = undefined
  settlingStartedAt = undefined
}

function scheduleSettlingTimer(delay = settlingRemainingMs) {
  clearSettlingTimer()
  settlingRemainingMs = Math.max(0, delay)
  settlingStartedAt = Date.now()
  settlingTimer = setTimeout(() => {
    settlingTimer = undefined
    settlingStartedAt = undefined
    settlingRemainingMs = SETTLING_DURATION_MS
    dispatchBehaviorEvent({ type: 'idle_deadline' })
  }, settlingRemainingMs)
}

function maintainSettlingTimer(previous: BehaviorState, next: BehaviorState) {
  if (next.phase === 'suspended') {
    if (previous.phase === 'settling') clearSettlingTimer(true)
    return
  }
  if (previous.phase === 'suspended' && next.phase === 'settling') {
    scheduleSettlingTimer()
    return
  }
  if (previous.phase !== 'settling' && next.phase === 'settling') {
    settlingRemainingMs = SETTLING_DURATION_MS
    scheduleSettlingTimer()
    return
  }
  if (previous.phase === 'settling' && next.phase !== 'settling') {
    clearSettlingTimer()
    settlingRemainingMs = SETTLING_DURATION_MS
  }
}

export const useBehaviorStore = create<BehaviorStoreState>((set, get) => ({
  ...initialBehaviorState,
  dispatchBehaviorEvent: (event) => {
    const previous = get()
    const transition = transitionBehavior(previous, event, nextReactionId)
    if (
      transition.state.activeReaction &&
      transition.state.activeReaction.id === nextReactionId &&
      previous.activeReaction?.id !== nextReactionId
    )
      nextReactionId += 1
    if (transition.state !== previous) {
      set(transition.state)
      maintainSettlingTimer(previous, transition.state)
      if (previous.phase !== transition.state.phase)
        logBehaviorDiagnostic({
          event: 'phase_changed',
          phase: transition.state.phase,
          previousPhase: previous.phase,
          owner: transition.state.owner,
          reason: transition.state.lastTransition?.reason,
        })
      if (previous.owner !== transition.state.owner)
        logBehaviorDiagnostic({
          event: 'owner_changed',
          phase: transition.state.phase,
          owner: transition.state.owner,
          reason: transition.state.lastTransition?.reason,
        })
      if (
        (event.type === 'camera_user_changed' || event.type === 'camera_user_settled') &&
        previous.attentionTarget !== transition.state.attentionTarget
      ) {
        const target = transition.state.attentionTarget
        if (target) {
          const x = target.x
          const y = target.y - 1.1
          const z = target.z
          logBehaviorDiagnostic({
            event: 'attention_changed',
            phase: transition.state.phase,
            owner: transition.state.owner,
            attentionDirection: {
              yawRadians: Math.atan2(x, z),
              pitchRadians: Math.atan2(y, Math.hypot(x, z)),
            },
          })
        }
      }
    }
    for (const intent of transition.intents) {
      if (intent.type === 'start_reaction')
        logBehaviorDiagnostic({
          event: 'reaction_started',
          phase: transition.state.phase,
          owner: transition.state.owner,
          reactionId: intent.reaction.id,
          action: intent.reaction.action,
          reason: event.type,
        })
      if (intent.type === 'cancel_reaction')
        logBehaviorDiagnostic({
          event: 'interrupted',
          phase: transition.state.phase,
          owner: transition.state.owner,
          reactionId: intent.reactionId,
          reason: intent.reason,
        })
    }
    if (
      (event.type === 'reaction_completed' || event.type === 'reaction_cancelled') &&
      previous.activeReaction?.id === event.reactionId &&
      !transition.state.activeReaction
    ) {
      logBehaviorDiagnostic({
        event: event.type === 'reaction_completed' ? 'reaction_ended' : 'interrupted',
        phase: transition.state.phase,
        owner: transition.state.owner,
        reactionId: event.reactionId,
        action: previous.activeReaction.action,
        reason: event.type === 'reaction_cancelled' ? event.reason : 'completed',
      })
      if (event.type === 'reaction_completed')
        logBehaviorDiagnostic({
          event: 'recovered',
          phase: transition.state.phase,
          owner: transition.state.owner,
          reactionId: event.reactionId,
          reason: 'temporary_action_returned_to_underlying_phase',
        })
    }
    if (event.type === 'conversation_failed')
      logBehaviorDiagnostic({
        event: 'failed',
        phase: transition.state.phase,
        owner: transition.state.owner,
        reason: 'conversation_failed',
      })
    if (
      (event.type === 'avatar_touch_started' ||
        event.type === 'ai_action_started' ||
        event.type === 'semantic_action_requested') &&
      !transition.intents.some((intent) => intent.type === 'start_reaction')
    )
      logBehaviorDiagnostic({
        event: 'suppressed',
        phase: previous.phase,
        owner: previous.owner,
        action: event.type === 'avatar_touch_started' ? event.region : event.action,
        reason:
          previous.owner === 'manual'
            ? 'manual_control_active'
            : previous.phase === 'suspended'
              ? 'page_suspended'
              : previous.activeReaction?.owner === 'direct_interaction'
                ? 'direct_reaction_active'
                : 'reaction_coalesced_or_not_eligible',
      })
    return transition.intents
  },
  resetBehavior: () => {
    clearSettlingTimer()
    settlingRemainingMs = SETTLING_DURATION_MS
    nextReactionId = 1
    set(initialBehaviorState)
  },
}))

export function dispatchBehaviorEvent(event: BehaviorEvent) {
  return useBehaviorStore.getState().dispatchBehaviorEvent(event)
}
