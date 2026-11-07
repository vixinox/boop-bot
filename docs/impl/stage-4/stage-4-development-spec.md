# Stage 4: Reactive Companion Behavior

## Status and startup instruction

- Status: Verified. Original Stage 4 Tasks 01–05 and the approved addendum for local emotion routing, shortcut interactions, and finite semantic companion actions are implemented. Addendum automated checks pass; real-model visual acceptance and the requested MP4 demonstration are handed off for user acceptance.
- Goal: evolve Boop Bot from an animation tool controlled by chat into a companion that remains present, responds to conversation and direct interaction, and reliably returns to a suitable resting state.
- Read first: this specification and the task package assigned for implementation.
- Scope boundary: this document defines the Stage 4 target and actual implementation. It supersedes earlier requirements only for companion presentation lifecycle, idle behavior, attention, non-conversational reactions, and chat-to-presentation behavior. Existing scene creation, lights, camera tools, chat protocol, and manual animation inspector remain supported unless a criterion below explicitly changes them.

## Problem and expected result

The current runtime starts in looping Idle and can play finite AI animation timelines. A completed AI timeline intentionally stops at its final pose. Camera input changes the camera but does not direct the robot's gaze. Chat activity is not represented as companion behavior states, and direct stage interactions do not produce reactions. This leaves animation playback available without a complete behavior lifecycle.

After this iteration, the companion must:

- remain visibly present while idle, using the available idle animation plus restrained attention or posture changes;
- acknowledge meaningful conversation phases without requiring a full-body animation for every message;
- react to supported direct inputs, including touching the character and moving the view;
- coordinate attention, face, body action, conversation, and explicit manual control without competing animations;
- end or cancel every temporary reaction predictably and return to the active conversation state or idle baseline;
- expose enough runtime state and event history to explain its behavior during development.

## Pre-Stage 4 implementation baseline

- The baseline was the current workspace source before this iteration; staged/unstaged diff intent was not considered, and the project root has no Git metadata.
- The baseline started in looping `Idle`, but `useCompanionStore.playbackOwner` defaulted to `manual` without an explicit user takeover. Stage 4 separates behavior ownership so this store default does not imply manual control.
- Baseline AI timelines were bounded to 12 steps, five repeats per step, and 30 seconds total, with optional `Angry`, `Surprised`, and `Sad` weights; timeline completion held the final pose. Stage 4 now returns temporary AI timelines to looping Idle while preserving manual Inspector ownership.
- Baseline chat exposed busy state, streamed text, tool calls/results, errors, and cancellation but did not map them to companion phases. `ChatOverlay.send` remains single-flight and does not queue overlapping sends.
- Baseline camera input controlled view rotation, pan, zoom, and reset but did not update character attention or generate touch reactions. Scene editing and camera/scene tools remain supported.
- The Stage 3 refactor required full visual feedback on every ordinary turn, conflicting with the existing persona. Stage 4 resolves this with light phase feedback and full actions only when semantically useful.

## Implemented behavior status

- `behaviorPolicy` and `behaviorStore` own typed phases, control priority, stable reaction IDs, attention targets, touch targets, visibility suspension, and a pauseable 900 ms settling deadline. Manual Inspector ownership is explicit and conversation phases continue updating beneath it.
- Chat submission, processing, streamed text, tool calls, completion, and failure dispatch behavior events. Listening and thinking use small smoothed posture cues; responding returns to neutral. Model animation timelines and direct one-shot reactions recover to looping Idle or the latest active conversation phase; manual Inspector playback remains persistent until Resume Companion.
- User-originated camera changes and reset publish a live camera target. AI camera commands do not publish user attention. Attention policy turns the head first and the body after a sustained 700 ms substantial turn; direct taps distinguish head, torso, and hand from camera drags.
- Head tap uses the existing `Yes` nod as its affection acknowledgment; torso tap briefly turns toward the world-space hit point with a bounded procedural lean fallback; hand tap plays the existing `Wave`. `ThumbsUp` remains available to the model for explicit praise/approval. Local touches never enter the model API.
- Automatic animation playback uses the prepared `autoClip`, which removes Idle head yaw and preserves GLB morph tracks; manual Inspector playback uses a morph-free manual clip. Existing Idle provides a numerically continuous 3.333 second loop, so Stage 4 adds no random autonomous gestures.
- Reduced-motion preference pauses autonomous Idle and camera gaze. Direct user taps and explicit AI semantic actions remain available; changing the preference does not restart canceled actions or play missed motion later.
- Debug Console behavior events record phase, owner, reaction lifecycle, suppression/interruption/recovery, and throttled quantized attention direction. They do not log raw pointer coordinates or every frame.
- Verified GLB clip durations, joint tracks, semantic mapping, and expression limits are recorded in the capability table below. Subjective appearance and gesture ergonomics remain post-implementation human acceptance.

## Feature inventory

Priority meanings: P0 is required for the iteration to be deliverable; P1 completes the core companion experience; P2 is a follow-up or optional product control.

The first-release interaction set is confirmed: tap the head, torso, or hand. The camera-follow behavior in B06 and ordinary-chat feedback strength are also confirmed.

| ID  | Feature                            | Current status                                                               | Required result                                                                                                                                                                                                                                                                        | Priority |
| --- | ---------------------------------- | ---------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| B01 | Resting baseline                   | Implemented: looping Idle is the initial and recovery baseline               | Idle remains the stable fallback whenever no higher-priority behavior is active. It is animated and does not become a frozen pose after a temporary action.                                                                                                                            | P0       |
| B02 | Temporary action lifecycle         | Implemented: stable IDs and automatic Idle/phase recovery                    | AI and local one-shot reactions blend into the active underlying state when complete, canceled, replaced, failed, or interrupted. Persistent poses are explicit and never the default for ordinary reactions.                                                                          | P0       |
| B03 | Behavior ownership and arbitration | Implemented: pure policy and browser behavior store                          | Manual Inspector control, direct user reactions, chat performance, and ambient idle behavior follow one documented priority policy. Lower-priority behavior cannot overwrite a higher-priority owner.                                                                                  | P0       |
| B04 | Conversation phases                | Implemented: chat lifecycle events                                           | Character presents listening, thinking/tool work, responding, and settling states from existing chat lifecycle events. A failed or canceled turn exits safely.                                                                                                                         | P0       |
| B05 | Semantic AI performance            | Implemented: persona guidance and tagged finite timeline                     | AI instructions explain which existing actions and expressions fit which intents, when to keep feedback subtle, and that temporary presentation returns automatically. AI cannot leave an indefinite action or claim an unplayed reaction.                                             | P0       |
| B06 | Camera-driven attention            | Implemented: user camera position drives staged gaze                         | Moving the view updates the robot's attention target. The head leads; the torso follows only after a sustained, substantial turn. Camera controls remain usable and independent.                                                                                                       | P1       |
| B07 | Character touch reaction           | Implemented: head, torso, and hand tap reactions                             | Head tap gives a warm affection acknowledgment, torso tap calls for attention, and hand tap plays a brief `Wave`. AI may choose `ThumbsUp` for explicit praise/approval. Head-hold petting is excluded. Every reaction returns to the underlying phase; dragging never triggers touch. | P1       |
| B08 | Idle liveliness                    | Implemented using the audited Idle loop and user-driven attention            | Reuse the continuous 3.333-second Idle motion and camera attention; add no random autonomous gesture scheduler. Direct reactions coalesce while active and no idle head-shake loop plays.                                                                                              | P1       |
| B09 | Expression behavior                | Implemented: finite expression cues, three morphs, and baseline recovery     | Standalone and animation-synchronized cues define target weight plus fade-in, hold, and fade-out durations. Temporary expressions return to the captured baseline on completion or interruption.                                                                                       | P1       |
| B10 | Input event coverage               | Implemented: typed chat, camera, touch, visibility, and manual events        | Camera start/movement/settle/reset, avatar tap/release, chat lifecycle, tool progress/result, explicit manual control, idle timers, and page visibility are represented as behavior-relevant events. Repeated low-level pointer movement is coalesced into meaningful input.           | P1       |
| B11 | Manual control handoff             | Implemented: explicit Inspector takeover and Resume Companion                | Manual Inspector actions visibly own the relevant controls and cannot be overwritten by companion behavior. A clear user action resumes companion control and returns to its baseline.                                                                                                 | P1       |
| B12 | Action and emotion catalog         | Implemented: GLB and track audit complete; visual acceptance pending         | Existing assets are audited and mapped to semantic intents. The head-touch and camera-follow experiences are visually verified against the actual rig; missing asset capability is recorded rather than represented as an unavailable expression or clip.                              | P1       |
| B13 | Runtime observability              | Implemented: compact bounded behavior diagnostics                            | Debug view identifies current behavior phase, active reaction, owner/priority, attention target, transition reason, completion/interruption, and recovery. It does not expose raw frame-by-frame logs by default.                                                                      | P1       |
| B14 | User activity control              | Missing                                                                      | Follow-up only, outside Stage 4: optional Quiet / Balanced / Lively setting adjusts ambient reaction frequency and intensity; a pause control disables autonomous reactions while keeping direct manual controls usable.                                                               | P2       |
| B15 | Resilience and accessibility       | Implemented: cancellation, suspension, recovery, and reduced-motion baseline | Hidden tab, model reload, request timeout/error, user takeover, missing clip, and reduced-motion preference leave no stale timers, frozen transient expressions, or surprise burst on resume.                                                                                          | P1       |
| B16 | Existing product behavior          | Existing: chat, scene tools, camera tools, Inspector                         | Scene CRUD, lights, camera commands, manual animation inspection, chat history flow, and current desktop/mobile layouts regress cleanly.                                                                                                                                               | P0       |

## Verified character asset capability (Task 04)

This table was parsed from `public/RobotExpressive.glb` and cross-checked against the runtime track catalog. A `yes` means the clip has a transform track for that named bone; all clips also have Body tracks. It does not claim that a clip is visually suitable for unrelated intents. The Head mesh exposes exactly `Angry`, `Surprised`, and `Sad` morph targets.

| Clip       | Duration (s) | Head track | Neck track | Verified semantic use                                                |
| ---------- | -----------: | ---------- | ---------- | -------------------------------------------------------------------- |
| `Dance`    |        3.333 | Yes        | No         | Energetic celebration                                                |
| `Death`    |        0.958 | Yes        | No         | Fall and remain down; unavailable to the model                       |
| `Idle`     |        3.333 | Yes        | No         | Relaxed breathing/posture loop; automatic clip removes head yaw      |
| `Jump`     |        0.708 | Yes        | Yes        | Brief hop                                                            |
| `No`       |        1.667 | Yes        | No         | Head shake for negation                                              |
| `Punch`    |        0.833 | Yes        | No         | Forward punch; unavailable to the model                              |
| `Running`  |        0.958 | Yes        | Yes        | In-place running loop                                                |
| `Sitting`  |        0.417 | Yes        | No         | Sit down                                                             |
| `Standing` |        0.417 | Yes        | No         | Stand up                                                             |
| `ThumbsUp` |        1.583 | Yes        | No         | Explicit praise or approval                                          |
| `Walking`  |        0.958 | Yes        | Yes        | In-place walking loop                                                |
| `WalkJump` |        0.833 | Yes        | Yes        | Walk followed by a hop                                               |
| `Wave`     |        1.833 | Yes        | No         | Greeting and hand-tap acknowledgment                                 |
| `Yes`      |        1.667 | Yes        | No         | Affirmative nod; used as the available head-affection acknowledgment |

All seven `Idle` animation channels have identical first and last keyframe values at 3.333 seconds, so the numeric loop seam is continuous. The automatic variant removes repeated head yaw while preserving the original clip for Inspector control. `Wave` animates the right shoulder, arm, and fingers; `ThumbsUp` animates the right arm, thumb, and fingers. The asset has no facial happiness morph, dedicated head-pat clip, or hand high-five clip. Subjective warmth, touch-zone ergonomics, torso-turn readability, and camera-follow appearance remain post-implementation visual review items.

## Behavior model and lifecycle

The product model has one underlying interaction phase, a separate control owner, and temporary presentation layers. It is not a single flat state per every combination.

| Underlying phase | Entry signal                                                         | Visible intent                                                             | Exit signal                                                                         |
| ---------------- | -------------------------------------------------------------------- | -------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Available        | Initial load or completed settling                                   | Loop Idle; maintain subtle presence and a relaxed attention target         | Chat submission, direct interaction, manual takeover, or page suspension            |
| Listening        | User message accepted                                                | Acknowledge attention without a large action by default                    | Request starts processing                                                           |
| Thinking         | Model request, tool execution, or continuation is in progress        | Calm anticipation; action may accompany meaningful tool work               | Text begins, request fails, or request is canceled                                  |
| Responding       | Assistant text is streaming or a response segment is being presented | Match expression/action to semantic intent when useful                     | More tool work begins or the complete user turn ends                                |
| Settling         | User turn finishes, fails, or is canceled                            | Blend temporary action and expression back to the current underlying phase | Blend completes, then return to Available                                           |
| Suspended        | Document hidden or stage unavailable                                 | Pause behavior scheduling and avoid catch-up actions                       | Page/model becomes available; resume safely from baseline or valid underlying phase |

Temporary reactions are overlays, not replacements for the underlying conversation phase. A head-touch reaction can end and return to Thinking if a tool is still running; an AI wave can end and return to Responding if text is still streaming. If no other phase is active, temporary actions return to Available/Idle.

Control ownership is independent from phase: `ambient`, `conversation`, `direct_interaction`, or `manual`. Explicit Inspector playback enters manual ownership and persists until Resume Companion. The default `playbackOwner: 'manual'` value in the existing animation store is an implementation detail and is not evidence of user takeover. Inspector expression sliders define user baseline values; temporary automatic expressions blend back to those values.

## State ownership and event contract

The following implementation defaults are adopted for this specification so task owners do not need to choose another module split.

- `src/state/behaviorPolicy.ts` owns pure transition rules and returns a next behavior state plus presentation intents; it does not access Three.js objects, timers, DOM events, or network calls.
- `src/state/behaviorStore.ts` owns the browser-side interaction phase, control owner, active temporary reaction, latest user attention target, and a 900 ms pausable settle deadline. It must not duplicate current animation time, loaded clip catalog, or Inspector expression baseline.
- `useCompanionStore` remains the source of truth for animation transport, loaded clip catalog, manual bone offsets, expression baseline weights, and executing animation timeline. `SceneStore.camera` stores the committed camera pose; live user camera position is emitted directly from `StageCamera` for continuous attention.
- `RiggedRobot` remains the only writer to model bones and morph influences. It consumes behavior intents and applies blending; no chat handler or pointer handler writes model transforms.
- `ChatOverlay` translates chat lifecycle into behavior events. `CompanionStage` translates user-originated camera controls and avatar hit gestures into behavior events. Local pointer/touch events are not sent to the LLM.
- The AI uses bounded `play_animation_timeline` for semantic conversation performance and `play_expression_timeline` for independent finite expression cues. Local user reactions use browser policy and do not require a new model-visible tool.

Event categories include conversation lifecycle (`conversation_submitted`, `conversation_processing`, `conversation_text_started`, `conversation_tool_started`, `conversation_turn_finished`, `conversation_failed`), user attention (`camera_user_changed`, `camera_user_settled`), direct touch (`avatar_touch_started`, `avatar_touch_ended`), ownership (`manual_takeover`, `resume_companion`), visibility/deadline (`page_hidden`, `page_visible`, `idle_deadline`), and action lifecycle (`ai_action_started`, `reaction_completed`, `reaction_cancelled`). Each `BehaviorReaction` has a stable numeric `id`, semantic `kind`, executable `action`, and owner; a torso reaction may carry a finite world-space target. `startAnimationTimeline` tags AI choreography with that reaction ID, and the companion store centrally reports matching completion/cancellation. Touch events carry `head`, `torso`, or `hand`; head-hold events are not part of Stage 4. Camera attention uses the latest world-space camera position.

## Direct interaction scope

Direct interaction means the user deliberately taps the character itself. Camera attention means the user changes the viewing angle; these are separate inputs and must not compete for the same gesture. The first release supports head, torso, and hand taps only.

| User input                                          | Recognition                                                   | Character response                                                                                | End behavior                                       |
| --------------------------------------------------- | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| Tap/click head                                      | Pointer/touch ends on the head without becoming a drag        | Warm affection acknowledgment using the existing `Yes` nod                                        | Blend back to the active phase or Idle             |
| Tap/click torso                                     | Pointer/touch ends on the torso without becoming a drag       | "Notice me" response: turn briefly toward the world-space hit point, then attend to the user      | Blend back to the active phase or Idle             |
| Tap/click hand                                      | Pointer/touch ends on a hand without becoming a drag          | Play a brief `Wave`; `ThumbsUp` is available for an AI-selected explicit praise/approval response | Blend back to the active phase or Idle             |
| Drag from the stage, including across the character | Pointer movement crosses the camera-drag threshold            | Treat as camera control and update camera attention; do not generate a pat                        | Continue existing camera controls                  |
| Repeated taps during an active reaction             | Further taps arrive before the current response/cooldown ends | Coalesce duplicates; do not queue or start a second reaction                                      | Complete the current reaction and recover normally |

Chat submission, Inspector controls, camera reset, zoom, and pan are not character-touch events. They may affect conversation, manual ownership, or camera attention through their own event paths. Dragging, picking up, repositioning, or directly manipulating the character's limbs is outside this iteration.

Confirmed first-release mapping: head tap expresses affection using the available `Yes` nod; torso tap means "notice me" and briefly orients toward the touch before looking back toward the user; hand tap is a social greeting and plays `Wave`. The model may choose `ThumbsUp` for an explicit praise/approval response. The local click handler does not infer sentiment from raw conversation text. This semantic contract does not promise an unsupported pose or morph. Head-hold petting is excluded because it competes with the existing camera drag gesture. Task 04 audited the actual GLB; any capability gap is recorded as a limitation and does not expand the asset scope.

## Priority and interruption defaults

These adopted implementation defaults do not require further product decisions. Exact angular thresholds, click-versus-drag distance, cooldown durations, and blend durations are tuned and tested within the stated behavior boundaries. A stationary hold does not create a separate reaction; it is recognized as a tap only when it ends within the click-versus-drag movement threshold.

1. Explicit Manual Inspector control owns the channels it changes until the user resumes companion control.
2. Direct user interaction takes precedence over AI and ambient actions. Human camera input updates attention; avatar tap/release drives the selected touch-reaction lifecycle.
3. Conversation performance can use body/face channels that are not currently owned by manual or direct input.
4. The looping Idle baseline has the lowest priority. Stage 4 adds no random ambient gestures; explicit reactions and camera attention remain tied to semantic or deliberate input.

New direct input replaces or merges a lower-priority transient reaction; transient events are not queued into a backlog. A head/neck animation may temporarily suppress camera gaze on those joints, but the latest camera target is retained and applied when the conflicting action ends. Cancellation and replacement always use a short blend to a valid underlying pose.

## Decisions and defaults

### Confirmed by the user

- Initial behavior should be Idle.
- A one-shot AI wave should not leave the character motionless in its final pose.
- The iteration includes non-conversational reactions beyond a single head-touch feature.
- Camera movement should make the character attend to the screen, with the head turning before the body.
- Ordinary chat receives phase-level light feedback; a full-body action plays only when semantically useful.
- This request is for a complete development plan, not implementation in this turn.

### User-proposed interaction examples

- Touching the head can mean a head pat.
- Moving the view can make the character face the screen, with the head turning before the body.
- A hand interaction may be expressed as a thumbs-up or wave.

### Adopted implementation defaults

- Local interaction events are handled by the browser behavior runtime; pointer movement is not sent to the LLM.
- Head, torso, and hand taps are in scope; head-hold petting is excluded. The mapping is head=affection, torso=attention, hand=`Wave`; the model can choose `ThumbsUp` for explicit praise/approval. The local click handler does not infer sentiment from raw text.
- Serious or sensitive turns use minimal motion or text alone when appropriate.
- Only the current GLB and bounded procedural poses may be used. Asset audit gaps are recorded as limitations; no assets are added or commissioned and no model or rig replacement is introduced in Stage 4.
- Keep behavior local to the current browser session. No new account, server persistence, camera access, microphone access, or external sensing is introduced.
- Human camera operations update attention; AI camera commands do not count as the user looking at the character.
- Keep one chat turn active at a time as the current UI does. Direct interaction may interrupt visual presentation but does not abort the in-flight chat request.
- Exact angular thresholds, click-versus-drag distance, cooldown durations, and blend durations are implementation tuning values validated by interaction tests; they are not product settings in the first release.
- Idle motion uses the existing continuous GLB `Idle` loop plus user-driven camera attention. Stage 4 does not add a random ambient gesture scheduler; AI and direct gestures remain tied to semantic or deliberate input.
- When `prefers-reduced-motion` is enabled, autonomous Idle and camera gaze pause. Deliberate touch reactions and explicit AI actions remain available, while hidden-page cancellation prevents catch-up motion.

### Decision status

- No blocking product decisions remain. Interaction scope and asset boundaries are confirmed above.
- Quiet / Balanced / Lively remains P2 and is outside Stage 4; prioritizing it requires a future product iteration.

## Non-goals and compatibility

- No new scene editing, lighting, or camera tools.
- No camera, microphone, biometric, or real-world user sensing.
- No LLM-generated arbitrary bone rotations, frame-by-frame animation, or unbounded animation loops.
- No mandatory full-body gesture for every ordinary sentence.
- No replacement of the existing manual Inspector; it remains a development/manual control surface.
- No promise that the current GLB has a Happy morph, eyelid blink, or dedicated head-pat clip. Asset audit must establish actual capability.
- No new, acquired, commissioned, or replacement character assets, and no rig redesign. If a response cannot be represented clearly, document the capability gap and deliver the rest of Stage 4 within the confirmed limits.
- No autonomous scene manipulation or user activity analytics.

## Implementation milestones and dependencies

| Milestone | Package                                                                                                | Dependency           | Result                                                                                             |
| --------- | ------------------------------------------------------------------------------------------------------ | -------------------- | -------------------------------------------------------------------------------------------------- |
| M1        | [Task 01: Behavior runtime and lifecycle](./stage-4-task-01-behavior-runtime.md)                       | None                 | A single source of truth for phases, action ownership, interruption, and recovery.                 |
| M2        | [Task 02: Conversation performance](./stage-4-task-02-conversation-performance.md)                     | M1                   | Chat and tool lifecycle produces visible, semantically appropriate feedback.                       |
| M2        | [Task 04: Idle, expressions, and asset coverage](./stage-4-task-04-idle-expression-assets.md)          | M1                   | Resting behavior is alive but restrained; expressions/actions have a verified semantic catalog.    |
| M3        | [Task 03: Attention and direct interaction](./stage-4-task-03-attention-interaction.md)                | M1 and Task 04       | Camera attention and head, torso, and hand tap reactions work on desktop and touch.                |
| M4        | [Task 05: Integration, diagnostics, and release checks](./stage-4-task-05-integration-verification.md) | Tasks 02–04 complete | Full behavior, docs, automated regression coverage, and human acceptance checklist are reconciled. |

Tasks 02 and 04 may proceed in parallel after Task 01 publishes the behavior interface. Task 03 follows Task 04 because both integrate with `RiggedRobot`. Task 05 integrates all task packages after Tasks 02–04 are complete.

## Acceptance and validation

### Product acceptance

- Fresh load starts in looping Idle with a neutral baseline and no stale action or expression.
- An AI one-shot Wave blends back to Idle when no other phase is active; if conversation is still active, it returns to that phase. It never holds the final pose by default.
- An ordinary message shows listening/thinking/responding/settling feedback. Full-body actions are used only when semantically useful; serious or sensitive messages can remain subtle. Tool progress is distinguishable from a final successful result.
- Head, torso, and hand taps produce their specified responses: affection, attention, and a brief `Wave`. The model may choose `ThumbsUp` for explicit praise/approval; local touch handling does not infer sentiment from raw text. Head-hold petting is excluded. Repeated taps are coalesced rather than queued.
- A drag from or across the character continues camera rotation and does not trigger a pat. Chat and Inspector controls never count as character touches.
- As the camera orbits, the character tracks its position smoothly. The head leads, and the body follows only after a sustained substantial change. Resetting the camera updates attention without breaking camera controls.
- Repeated camera pointer movement only updates the attention target and never starts a full-body action. Repeated direct taps are coalesced while a direct reaction is active.
- Manual Inspector playback cannot be overwritten by AI, touch, gaze, or idle behavior. Resume companion control returns to the active phase or Idle.
- Completion, replacement, cancellation, request error, timeout, hidden-page suspension, and model remount all clear transient ownership and restore a valid presentation.
- Existing scene creation/editing/deletion, lights, camera tools, Inspector controls, and desktop/mobile layout still work.

### Development-time verification

- Added focused state/policy, chat lifecycle/persona, animation/tool, attention/touch classification, and diagnostics tests.
- Development-time checks pass: `pnpm test` (106 tests across 21 files), `pnpm typecheck`, `pnpm lint`, and `pnpm build`.
- The production build reports a single JavaScript bundle above 500 kB; this is a non-blocking size advisory.
- Full `pnpm format:check` reports 7 pre-existing files (`.vscode/settings.json` and `src/components/ui/{checkbox,input,select,slider,switch,tabs}.tsx`). All Stage 4 source and planning files are checked separately.

### Post-implementation human acceptance

At desktop and narrow mobile widths, use a configured chat provider and the real GLB to exercise an ordinary greeting, a serious message, a tool-driven scene edit, camera orbit/return, head/torso/hand taps, manual takeover/resume, an interrupted request, and tab hide/show. Confirm reactions read naturally within the existing asset limits, the head leads the torso, gestures do not repeat rapidly, and every transient behavior settles to the correct state. Record any visual capability gap without adding assets or blocking unrelated acceptance. This visual judgment is separate from automated development checks.

## Documentation reconciliation

- Stage 2 Auto/attention documents remain historical records. Root README and `docs/roadmap.md` describe Stage 4 as implemented, and `docs/impl/README.md` links the verified task packages and records the actual validation results.
- Stage 3 final-pose-hold and no-gaze behavior remain true only for the historical implementation; Stage 4 returns actions to Idle and adds user-camera attention.
- `ChatOverlay.send` remains single-flight. Direct touch can interrupt a visual presentation without canceling the in-flight API request.
- Ordinary-turn feedback is phase-level and light; full-body actions are reserved for semantically useful moments, and serious/sensitive turns may use text alone.

## Stage 4 addendum: emotion interaction and semantic actions

### Goal and decisions

- Add presentation emotions `neutral`, `happy`, `comfort`, and `sleepy` independently from conversation phases and control ownership.
- Classify each submitted Chinese user message locally. A clear mood changes the presentation; ambiguous text resets to `neutral`. The same mood does not replay its entry action. `sleepy` persists until an explicit wake button or wake phrase.
- Add three icon buttons after Send: head affection, praise, and sleep. While sleepy, the sleep button becomes wake; affection and praise wake first, then run the selected action. Shortcuts are local actions and do not submit synthetic chat messages.
- Expose `perform_companion_action` with only `greet`, `affection`, `praise`, `celebrate`, `comfort`, `sleep`, and `wake`. Do not expose bones, joint rotations, arbitrary poses, or loops.
- Reuse only verified GLB clips/morphs and bounded runtime poses. Scene tool state remains independent from companion actions and must survive action execution.

### Implementation mapping

| Emotion/action    | Presentation                                                                               |
| ----------------- | ------------------------------------------------------------------------------------------ |
| neutral           | Existing looping `Idle`, neutral emotion morph targets                                     |
| happy / praise    | `ThumbsUp` entry action and restrained happy body posture; explicit celebrate uses `Dance` |
| comfort           | `Yes` nod with a bounded `Sad` morph target and subdued posture                            |
| sleepy / sleep    | Keep looping `Idle` with a smoothed, bounded lowered-head pose until wake                  |
| wake              | Smoothly raise the head while `Idle` continues; queued shortcut action starts afterward    |
| greet / affection | `Wave` / `Yes`                                                                             |

Semantic actions are finite reactions, except sleep, which is a persistent behavior state over looping `Idle`. Ordinary actions recover to looping `Idle` while preserving the current conversation phase. Wake is a bounded head-pose transition; a direct affection or praise shortcut issued during sleep waits for wake to complete before starting its clip. Manual Inspector retains its control priority, and unavailable actions return a structured suppressed result. `Auto / Stage 4` remains an explicit Inspector mode alongside the manually playable clips.

### Auto recovery and tool arbitration

- `controlMode` in the behavior store is authoritative for Auto versus Manual; animation source labels describe playback provenance only. The Inspector's Auto action is idempotent, restores looping `Idle`, and clears manual bone/expression overrides without changing emotion or scene state.
- Available clip selections are one-shot previews and return to Auto. Playback transport, loop, timeline seeking, bone edits, and expression edits enter persistent Manual mode until Auto is explicitly selected.
- `play_animation_timeline` and `perform_companion_action` share a FIFO body-presentation queue with a limit of three accepted AI presentations per user turn. `play_expression_timeline` uses a separate one-shot lane: it may overlay conversation-owned local or AI body reactions, replaces the preceding expression cue, and does not consume body queue capacity. Manual control, direct interaction, sleep, and page suspension suppress or clear it.
- `cancel_companion_presentation` cancels the active AI body presentation, pending body presentations, and any active expression cue. It preserves a conversation-owned local semantic action when there is no active AI body presentation. It does not cancel scene animation or override Manual mode. User shortcuts, a new user message, request failure, page suspension, and Inspector takeover clear or cancel the applicable temporary work.

### Addendum verification

- Unit tests cover local Chinese routing, neutral fallback, sleepy lock/wake, no repeated same-mood entry action, semantic tool validation/suppression, Auto recovery, previews, queue ordering/cancellation, and scene state preservation; full suite: `pnpm test` (138 tests across 24 files) passes.
- Validation passed: `pnpm test` (122 tests / 24 files), `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, and `pnpm build`.
- Oxlint excludes generated shadcn UI components and `.vscode`; Oxfmt excludes `.vscode`. The six shadcn files previously reported by format check were formatted; local VS Code settings are ignored by lint, format, and Git.
- Post-implementation human acceptance uses the real GLB at desktop and narrow mobile sizes. Exercise solar-system scene tool calls interleaved with emotional text, shortcut actions, sleep/wake, camera attention, and Inspector takeover/resume. Confirm scene objects persist and each mood/action is legible within the actual asset limits.
- Capture a 1–2 minute MP4 for human delivery during acceptance; the recording is not a substitute for automated checks.
- For isolated acceptance, use a free API port without stopping existing sessions and start Vite with the same `BOOP_API_PORT` so the acceptance page uses the updated tool schema.
