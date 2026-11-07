# Task 03: Attention and Direct Interaction

- Status: Implemented; pure attention/touch tests and TypeScript/lint checks pass. Real-model touch ergonomics and gaze appearance remain post-implementation human acceptance.
- Parent specification: [Stage 4: Reactive Companion Behavior](./stage-4-development-spec.md).
- Dependencies: Task 01 behavior event/action contract and Task 04 verified asset/joint ownership catalog.
- Confirmed scope: camera attention makes the head lead and the torso follow after a sustained substantial turn. Direct interaction is tap-only on head, torso, and hand; meanings are head=affection, torso=call for attention, hand=`Wave`. The model may choose `ThumbsUp` for explicit praise/approval; local touch handling does not infer sentiment from raw text. Head-hold petting is excluded. This task follows Tasks 01 and 04.
- Goal: make view movement and deliberate direct character input visible to the companion without confusing camera controls.

## Scope and result

- Use live user-originated camera position while OrbitControls moves as a smoothed attention target; do not wait for the committed camera snapshot at drag end. Reset and direct user orbit update attention; AI-issued `set_camera_pose` does not count as the user looking at the character.
- Make the head lead the camera turn. Bring the torso along only after a substantial direction change remains for a sustained interval; return both naturally when the view recenters.
- Suppress gaze writes only for joints owned by a conflicting clip, preserve the latest target, and resume attention when the clip releases those joints.
- Add hit-tested zones for head, torso, and hand. A head tap means warm affection; a torso tap means "notice me" and turns briefly toward the hit region, then toward the user; a hand tap plays a brief `Wave`. The model may choose `ThumbsUp` for explicit praise/approval; local touch handling does not infer sentiment from raw text.
- Only taps are recognized as direct interaction. There is no head press-and-hold response. Never restart a one-shot clip every frame or every pointer event.
- Coalesce repeated taps while a reaction is active or cooling down; do not queue repeated one-shot clips.
- Distinguish a tap from camera rotation using pointer movement. A stationary press becomes a tap only on release and has no separate hold response. Dragging from or across the character remains camera input and must never produce a pat. Pointer cancellation, multi-touch, and clicks on chat/Inspector controls must not produce a character reaction.
- Tap movement threshold is 7 CSS pixels. Hit regions use the placed avatar group's local coordinates, normalized to a 1.55-unit model height; the torso reaction receives the finite world-space ray hit point.
- The current camera policy waits 700 ms before torso follow for a sustained direction change above 0.62 radians, and returns the body toward center inside 0.24 radians. Head yaw is bounded to 0.85 radians and pitch to 0.35 radians. These are code tuning constants, not user settings.
- Support desktop pointer and touch input while preserving current orbit, pan, zoom, and reset behavior.
- During manual Inspector ownership, show attention input only when it does not overwrite the user's controlled pose.

## Code entry points and ownership

- `src/stage/CompanionStage.tsx` owns OrbitControls input, camera start/end/reset events, pointer capture, and the stage canvas. It emits typed events to the behavior store; it does not choose animation clips.
- `src/state/sceneStore.ts` stores the committed camera snapshot for tools and diagnostics. Live attention comes from the active R3F camera in `CompanionStage`; AI camera commands remain a separate source.
- `src/stage/RiggedRobot.tsx` owns gaze-pivot and staged head/body application. It consumes the action/attention contract from Task 01 and asset ownership metadata from Task 04.
- Add pure helpers for hit-region and click/hold/drag classification under `src/stage/` and test them without WebGL. Do not add hit handling to chat/Inspector overlay DOM.
- `src/stage/rig.ts` and the Task 04 capability table identify whether loaded clips own `Head` or `Neck`; this task must not infer joint ownership from clip names.

## Exclusions

- No camera or microphone sensing outside the app's own camera controls.
- No gaze at OS cursor movement when the camera is stationary.
- No dragging/picking up/repositioning the character and no direct limb manipulation.
- No new camera behavior or scene interaction tools.

## Acceptance and validation

- A camera orbit turns the head toward the new viewpoint, then the torso follows only when the defined sustained-angle policy is met.
- Camera reset updates the target; orbit, pan, zoom, and reset still work.
- Each head, torso, and hand hit region produces its specified semantic response, including the brief `Wave` response for a hand tap. Pointer cancellation exits cleanly to the underlying phase; head-hold behavior is not implemented or tested as a feature.
- Repeated taps coalesce and cannot build a reaction backlog.
- Dragging across or starting on the character continues camera rotation without triggering touch. Multi-touch camera gestures and taps on overlays do not trigger character reactions or leave a stuck state.
- Head/neck animation ownership prevents competing gaze writes and applies the latest valid camera target after release.
- Targeted validation: `pnpm exec vitest run src/stage/attention.test.ts src/stage/touchInteraction.test.ts` passes; full Stage 4 checks are recorded in the parent specification. Manual real-model checks at desktop and narrow mobile sizes remain post-implementation.
