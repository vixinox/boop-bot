# Task 01: Behavior Runtime and Lifecycle

- Status: Implemented; phases, owners, stable reaction IDs, touch targets, tagged timeline recovery, Inspector takeover/resume, visibility suspension, and the pauseable settle deadline are complete. Focused policy/store tests pass.
- Parent specification: [Stage 4: Reactive Companion Behavior](./stage-4-development-spec.md).
- Scope status: fully specified by the parent; no unresolved product decisions remain.
- Goal: create one predictable behavior lifecycle that owns the underlying interaction phase and temporary presentation actions.

## Scope and result

- Model the phases Available, Listening, Thinking, Responding, Settling, and Suspended as specified by the parent. Keep Manual Override as a separate control owner.
- Keep `manual` as a control owner, not a conversation phase. Existing `playbackOwner: 'manual'` is the initial animation-store value and must not imply that the user has taken control.
- Represent temporary action overlays separately from the underlying phase, so a reaction can finish back into an ongoing response or tool operation.
- Implement ownership and priority for Manual Inspector, direct interaction, conversation performance, and ambient idle behavior.
- Define begin, replace, interrupt, complete, cancel, failure, resume, and expiry behavior. Temporary actions return to a valid underlying pose; stale completion events cannot take ownership back.
- Provide one explicit resume-companion transition after manual Inspector control.
- Keep Three.js objects, mixer references, animation clocks, and DOM/timer handles outside Zustand state; keep product behavior state and transitions in the state/policy layer.
- Preserve existing AI timeline bounds and manual Inspector transport semantics, except that companion-owned transient actions no longer hold their final pose by default.

## Code entry points and ownership

- Add `src/state/behaviorPolicy.ts` for a pure event-to-transition policy. It owns phase transitions, priority arbitration, event coalescing, and recovery decisions.
- Add `src/state/behaviorStore.ts` for the Zustand behavior snapshot and `dispatchBehaviorEvent` entry point. It owns interaction phase, control owner, active reaction identity, and latest attention intent; it does not duplicate clip time, loaded clip metadata, or expression baseline weights.
- `src/state/behaviorPolicy.ts` exports `BehaviorEvent`, `BehaviorPhase`, `BehaviorOwner`, `BehaviorReaction`, `BehaviorIntent`, `AttentionTarget`, `transitionBehavior`, and the initial state. `src/state/behaviorStore.ts` exports `useBehaviorStore` and `dispatchBehaviorEvent`; its snapshot is `{ phase, owner, activeReaction, attentionTarget, cameraSettled, suspendedPhase, suspendedOwner, lastTransition }`.
- `avatar_touch_started` carries `region` and an optional finite world-space `point`; direct reactions copy that point to `BehaviorReaction.target`. `ai_action_started` carries the semantic action only; the policy allocates its stable reaction ID. Owners are `ambient`, `conversation`, `direct_interaction`, or `manual`.
- `src/state/companionStore.ts` preserves clip time, loaded clip metadata, manual joint offsets, expression baselines, and AI timeline ownership. `startCompanionAction(reactionId, steps, totalMs)`, `finishCompanionAction(reactionId)`, and `cancelCompanionAction(reactionId)` execute single-step companion actions tagged with the stable behavior ID. Tagged timeline completion/cancellation recovers to looping Idle, retains non-manual ownership, and dispatches the matching behavior lifecycle event; callers must not dispatch a duplicate completion/cancellation for those timelines. Ordinary AI timelines also recover to Idle when they finish or are canceled; manual Inspector setters retain explicit manual takeover behavior. `startAnimationTimeline` accepts optional fourth argument `behaviorReactionId` for a model-selected action.
- Adapt `src/ui/ManualInspector.tsx` to emit explicit `manual_takeover` and `resume_companion` events. Do not derive manual takeover from the current `playbackOwner` value alone.
- `src/stage/RiggedRobot.tsx` remains the only runtime writer to Three.js bones and morph weights. Other Stage 4 packages consume the contract published here; Task 01 does not implement their event sources.
- Add `src/state/behaviorPolicy.test.ts` and `src/state/behaviorStore.test.ts`; retain and extend `src/state/companionStore.test.ts` only for animation-store integration.

## State and transition invariants

- Conversation phase is one of `available`, `listening`, `thinking`, `responding`, `settling`, or `suspended`.
- Control owner is one of `ambient`, `conversation`, `direct_interaction`, or `manual`; ownership and phase are independent.
- The current phase may change while a temporary reaction is playing. On reaction completion, recover to the latest phase, not a phase captured when the reaction began.
- At most one body action owns the body channel. Attention and expression may run alongside it only when the active clip does not own the affected joints/face channels.
- Temporary actions have stable IDs so late completion/cancel events from replaced actions are ignored.
- Direct interactions are coalesced, not queued. Supported first-release hit regions are head, torso, and hand taps; head-hold petting is excluded.
- Page suspension pauses behavior deadlines and emits no catch-up actions on resume. A hidden page must not leave temporary ownership active.
- Manual control does not block updates to the underlying conversation phase; Resume Companion returns to the latest valid phase.
- Settling automatically returns to Available after 900 ms. This is an implementation default, not a user-facing setting. Hiding the page preserves the remaining settling interval; showing it resumes only that remainder.

## Exclusions

- Chat event wiring, pointer hit testing, camera gaze, and idle variation are implemented by dependent packages.
- No new scene tools, animation assets, or LLM-visible arbitrary pose controls.

## Acceptance and validation

- Pure tests cover every phase transition and invalid/stale transition, including transition to Thinking/Responding while a temporary action is still active.
- Higher-priority owner prevents lower-priority writes; releasing an owner restores the current underlying phase.
- Replacing/canceling an action fades to a valid pose and clears transient expressions.
- A completed one-shot action returns to the phase active at completion, not a stale phase captured at start.
- Manual Inspector ownership persists until explicit resume-companion input.
- Visibility suspension creates no catch-up action when the page returns.
- Initial animation `playbackOwner: 'manual'` does not set behavior owner to manual; explicit Inspector input does.
- Targeted validation: `pnpm exec vitest run src/state/behaviorPolicy.test.ts src/state/behaviorStore.test.ts src/state/companionStore.test.ts` (29 tests pass); `pnpm exec tsc -b --pretty false` passes; scoped `oxfmt --check` passes.

## Integration

Publish the behavior event/action contract before Tasks 02–04 begin integration. Because Task 04 and Task 03 both integrate with `RiggedRobot`, Task 03 follows Task 04. Task 05 owns cross-feature acceptance.
