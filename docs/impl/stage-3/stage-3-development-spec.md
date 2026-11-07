# Stage 3: AI Companion Performance and Scene Creation

## Status and startup instruction

- Status: Implemented; automated verification passed. Human visual/provider acceptance is pending.
- Historical implementation record: the original Stage 3 startup instruction below applied to that completed task only. It is not authorization or an instruction to begin Stage 4 implementation.
- Superseded for the animation/control refactor by [Stage 3 Refactor: Presentation Feedback and Explicit Playback Ownership](./stage-3-refactor-development-spec.md). Where this document mentions Auto ownership, automatic director behavior, pointer gaze/head tracking, returning to Auto after timeline completion, or disabled camera pan, the refactor specification is authoritative.
- The implemented [Stage 4](../stage-4/stage-4-development-spec.md) supersedes this document on companion recovery, camera attention, direct interaction, idle behavior, and ordinary-turn presentation intensity. Stage 3 remains a historical implementation record for scene/tool behavior not changed by Stage 4.
- Historical Stage 3 goal: deliver a reliable AI companion demo and prepare a product showcase video. The companion selects from existing animation clips, performs bounded expression changes, and creates or edits a Three.js scene through validated declarative commands.
- Read this specification first, then the task packages required by the assigned milestone. This specification is the source of truth for this iteration and supersedes conflicting Stage 3 wording in earlier task packages and progress notes.
- The user requested both documentation and implementation. Start implementation after the document handoff gate passes; no further implementation approval is required.

## Problem and user/system model

- Boop Bot is a Chinese-speaking screen companion. The LLM chooses when a short animation or scene edit suits the conversation; the browser owns animation, scene, camera, and rendering state.
- The primary demo story is visible co-creation: the user asks for a simple scene, Boop Bot performs a short existing animation while creating/editing geometry and lights, then frames the result. The created result remains visible; the robot returns to Auto.
- Video delivery is the highest product priority. Prefer repeatable, composed, readable actions over unbounded control surface.

## Pre-iteration source baseline

- Current workspace source is the implementation baseline. Staged/unstaged diff intent was not inspected or used as a decision source.
- The app uses React Three Fiber, Three.js, Zustand, a browser-owned SSE tool dispatcher, and a stateless OpenAI Responses continuation loop.
- The model has 14 GLB animation clips and three morph expressions. The LLM catalog will curate 12 clips; the manual Inspector continues to expose all 14. `RiggedRobot` owns the mixer and per-frame writes. Auto and manual clip variants are currently split; the manual variant removes morph tracks. A clip switch currently uses a fixed 250 ms cross-fade.
- `play_choreography` currently allows the model to target arbitrary catalog joints. It is ephemeral and returns to Auto on completion. The direct `set_animation` tool switches to persistent manual mode; direct expression and attention tools can leave persistent state.
- Head tracking uses gaze pivots around `Neck` and `Head`; pointer input is currently gated by Auto mode. The existing manual inspector and human camera reset/drag controls are separate user workflows.
- `CompanionStage` owns a fixed floor, five hard-coded lights (including two hemisphere lights), an existing perspective camera and OrbitControls. The camera is not in Zustand and there are no user-created scene objects or lights.
- The browser currently sends one animation/joint capability snapshot at the start of a chat turn and reuses it for continuations. Tool calls are synchronous browser state updates and tool results are replayed with the original Responses `call_id`.
- Automated commands available from `package.json`: `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm build`.

## Decision status

### Confirmed

- LLM animation control is limited to the existing animation clips. Remove free-form joint targets and do not add custom/user-authored animation authoring.
- An LLM animation request is a finite timeline. It may select clips, repeat them a bounded number of times, set playback speed, set clip cross-fade duration, and set expression targets. On completion or cancellation, temporary robot presentation state returns to Auto/Idle.
- Preserve mouse/touch head tracking. An active animation that writes a gaze-controlled joint takes priority; suppress gaze contribution during that conflict and resume it smoothly afterward.
- LLM scene creation uses basic geometry, basic geometry parameters, and solid-color material overrides only. LLM scene lighting uses a small set of common light types and finite, renderer-valid properties.
- Do not create or replace the camera. LLM may set position, look-at target and FOV on the existing user camera. Preserve the current user reset control and allow direct user input to interrupt AI camera motion.
- Give the LLM a current scene description so it can make informed edits. Scene objects and lights belong to the current browser session; they remain visible after the robot action returns to Auto and clear on page reload.
- The LLM-facing animation list excludes `Death` and `Punch`; the manual Inspector continues to show them.
- Scene tools cover query and full basic CRUD for primitives and lights. The built-in `ambient`, `key`, and `fill` lights may be edited but cannot be deleted or retyped.
- No product-level upper quotas are imposed on scene-object count, geometry dimensions/positions or light intensity. Numeric inputs must still be finite; dimensions must be positive, colors valid, and camera FOV/render inputs valid. Browser, GPU and provider context limits remain inherent platform constraints.
- No raw Three.js objects, JavaScript, external assets, or arbitrary model-space mutation are exposed to the LLM.

### Adopted defaults

- Animation timeline tool: `play_animation_timeline({ steps: [{ animation, repeat_count, speed, transition_ms, easing, expressions? }] })`; `cancel_animation_timeline({})` cancels it. Each step names one LLM-available runtime clip. `repeat_count` is finite, 1-5; speed is 0.5-1.5; transition is a cross-fade from 0-800 ms with `linear`, `ease_in`, `ease_out`, or `ease_in_out` easing. At most 12 steps and 30 seconds of effective playback. Durations come from the runtime clip duration divided by speed and multiplied by repeats. Expressions are partial weights in 0..1 and blend over the step/cross-fade; omitted values return smoothly to the clip's expression track or neutral. No infinite model-owned loop.
- Runtime animation metadata includes clip duration, a concise semantic description, and whether tracks touch `Head` or `Neck`. Affected-joint metadata is derived from loaded clip tracks, not invented by the model. If a clip directly animates `Head` or `Neck`, disable the additive gaze pivots until that clip releases them.
- LLM timelines remain Auto-owned rather than switching to manual inspector mode. A separate active presentation state pauses the Auto director while the timeline runs. Manual user clip selection cancels an AI timeline and retains user ownership.
- Supported primitives: box, sphere, cylinder, cone, and torus. Each has a typed, shape-specific dimension schema. Dimensions must be finite and positive; positions must be finite. There is no product-level entity-count, size, or coordinate upper bound. Solid color is `#RRGGBB`; no image maps, procedural textures, or material code.
- Scene state uses stable generated IDs. `create_primitive`, `update_primitive`, and `delete_scene_object` operate only on those IDs and validated typed values. Updating geometry preserves the object's shape kind. Invalid changes do not partially mutate the scene.
- The editable stage lights have stable IDs `ambient`, `key`, and `fill`; they can be modified but cannot be deleted or retyped. Add-on lights may be directional, point, or spot and have full basic CRUD. Colors are `#RRGGBB`; intensity is finite and non-negative; positions/targets are finite; point distance is finite and non-negative; spot angle is finite and between 0 and 180 degrees. There is no product-level light-count or intensity upper bound. The two fixed hemisphere lights remain read-only and are both included in the scene summary.
- `set_camera_pose` changes position, look-at target and FOV on the existing perspective camera, with a 200-1500 ms transition and finite coordinates. Position and target must differ; FOV must be finite and between 0 and 180 degrees. It cannot create cameras, change camera type/near/far, or disable user controls. Manual orbit, reset, visibility loss, or unmount cancels the AI tween. OrbitControls must accept valid AI camera positions rather than silently snapping them back to its previous clamps.
- Tools: `play_animation_timeline`, `cancel_animation_timeline`, `inspect_scene`, `create_primitive`, `update_primitive`, `delete_scene_object`, `create_light`, `update_light`, `delete_light`, and `set_camera_pose`. The old `set_animation`, `set_behavior`, `set_expression`, `set_attention`, `play_choreography`, and `cancel_choreography` tools are removed from the model-visible registry. All remaining tools use strict schemas, browser-side validation, structured results, and current-session state.
- The current browser scene summary is included with every initial and continuation Responses request. It reports loaded animation metadata, current animation/presentation status, expressions, head-tracking status, object IDs/types/parameters, editable lights and fixed environment summary, and the current camera view. `inspect_scene` returns the same validated snapshot on demand.
- A newer LLM timeline replaces the active LLM timeline. Browser manual animation input interrupts it and keeps manual mode. API/tool failure, cancellation, visibility loss, model unmount/reload, and completion release the presentation state and resume Auto; temporary expression values fade to the clip/default state. Scene object/light mutations already applied remain in the scene. A camera tween is separately interrupted by user camera input and does not block other scene actions.
- Tool operations are applied synchronously and validated before mutation. `call_id` correlation and full local transcript replay remain intact; tool rounds continue until the model finishes or the request is aborted. Capabilities are rebuilt before each continuation so the model sees earlier mutations from the same turn.

## Domain model, state ownership, and interfaces

- `companionStore` remains the source of truth for Auto/manual inspector state, loaded clip catalog, active AI animation timeline, expression transition values, and gaze suppression metadata. Three mixer actions, clocks, clip transition progress, and Object3D references stay inside `RiggedRobot`.
- A new scene store owns serializable user primitives, editable lights, and the last normalized camera view/command. It stores no Three.js objects. `CompanionStage` renders store-backed primitives and lights; the existing camera and OrbitControls remain the sole camera implementation.
- Runtime capability payloads are derived from both stores immediately before a Responses call. `server/tools.ts` exposes matching strict schemas; `server/persona.ts` describes the available clips, scene bounds and behavior, not raw implementation details.
- `executeRobotTool` is the browser mutation boundary. It validates against runtime clip metadata, scene IDs and structural numeric requirements before calling store actions. Only stage renderer components mutate Three.js objects.
- Stable light IDs identify three editable built-in lights plus generated add-on lights. Fixed hemisphere fill is reported as read-only environment metadata.

## Behavior and lifecycle

- A timeline starts at its first clip with bounded speed and repeat count. A finite mixer completion advances to the next step using the requested cross-fade and easing. An explicit expression target blends while its step is active. The final clip completion clears the timeline, fades temporary expressions out, sets Auto/Idle, and restarts the Auto director.
- The active clip's track metadata determines gaze arbitration. When `Head` or `Neck` is animated, gaze contribution is zero and its damped transform returns toward neutral; after release, it resumes from the current pointer rather than a stale pointer snapshot.
- The Auto director does not schedule while an AI timeline is active. The manual inspector may interrupt an AI timeline; direct LLM tools never invoke persistent manual mode.
- Scene creates/updates/deletes validate the whole operation first. Invalid numeric values, unknown IDs, invalid shape-property combinations, incompatible light fields and malformed colors return structured errors without mutation. Creation returns the generated ID for subsequent calls. Entity count and positive dimension/intensity magnitudes have no product-level upper cap.
- Camera commands tween the existing PerspectiveCamera position, target and FOV. Any user camera input or reset takes ownership immediately and cancels the tween. Resize preserves the live view and reset continues to restore the current canonical view.
- Conversation history and scene outputs are browser-session state; page refresh clears chat and created content. OpenAI credentials remain server-only.

## Non-goals and compatibility

- No custom keyframe authoring, arbitrary joint rotations, external animation/3D assets, arbitrary JavaScript, scene graph access, model upload, persistence/database, hardware control, or new camera instances.
- Keep the chat UI, SSE event names, Responses `call_id` behavior, local-history continuation model, current human manual inspector, mouse/touch attention gesture, stage reset button, and existing app layout.
- The exact tool contract from this specification supersedes the previous four-tool-only language and the old `play_choreography` arbitrary-joint contract. Remove old tools from the model-visible registry and retire their runtime/types/tests where no longer used. Historical implementation notes must be labeled superseded rather than left as current constraints.
- Complex visual choreography, actual provider calls, and final showcase-video capture are post-implementation user acceptance. They do not replace automated implementation checks.

## Implementation milestones and dependencies

1. [Task 01: Animation and scene protocol](./stage-3-task-01-persona-and-tool-protocol.md) freezes tool schemas, runtime capability shape, validators, and persona instructions.
2. [Task 02: Bounded animation timeline](./stage-3-task-02-choreography-runtime.md) implements finite clip sequencing, expression blending, Auto director ownership, gaze arbitration and interruption. Depends on Task 01.
3. [Task 03: Scene state, rendering and camera](./stage-3-task-03-scene-runtime.md) implements validated primitive/light state, stage rendering, camera commands and user interruption. Depends on Task 01.
4. [Task 04: Chat integration and verification](./stage-3-task-04-integration-and-verification.md) replaces the old dispatcher tools, refreshes scene context per continuation, integrates diagnostics, runs required checks and updates the index. Depends on Tasks 01-03.

## Acceptance and validation

- Protocol tests cover all tool names/schemas, the curated 12-clip model catalog, runtime-only scene IDs, malformed and unknown fields, animation caps, finite numeric checks, shape-specific parameters, editable built-in light rules, camera validity and no partial mutation on rejection.
- Animation tests cover clip duration calculation at speed/repeat bounds, finite loop completion, cross-fades, expression blending/return, sequential steps, replacement/cancel, Auto director suspension/resume, manual inspector interruption, visibility/unmount cleanup, and gaze suppression only for head/neck-conflicting clips.
- Scene tests cover initial state, create/read/update/delete, stable IDs, geometry/light validation, built-in light restrictions, current snapshot serialization, camera pose/FOV validity and user/reset cancellation. Store tests must not duplicate implementation logic; test observable state transitions and invariants.
- Chat-flow tests prove the current snapshot is included on initial and every continuation request, reflecting tool mutations earlier in the same turn while preserving complete local transcript and original `call_id` outputs.
- Required development-time commands: `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm build`.
- Historical Stage 3 human acceptance: prompt a multi-clip/repeated animation and check its then-required behavior; create and edit scene objects; use the AI camera; repeat at desktop and narrow viewport. Real provider acceptance requires configured `.env`; showcase video capture is separate release preparation, not Stage 4 behavior work.

## Open questions and blockers

- None block implementation. The supported primitive/light types, transition duration range, and finite-value requirements are adopted defaults; the user confirmed finite animation limits, no product-level scene entity/dimension/intensity caps, full existing-camera position/target/FOV control, removal of legacy direct tools, and editable but undeletable built-in lights.

## Progress

- [x] Baseline and stale Stage 3 wording inspected; this specification supersedes prior joint choreography and no-scene-edit constraints.
- [x] Task 01: protocol and validation.
- [x] Task 02: animation timeline and gaze arbitration.
- [x] Task 03: scene rendering and camera control.
- [x] Task 04: chat integration, automated verification and documentation reconciliation.

## Implementation results

- `pnpm test`: passed, 69 tests across 18 files.
- `pnpm typecheck`: passed.
- `pnpm lint`: passed.
- `pnpm build`: passed; Vite reports the existing single application bundle exceeds 500 kB.
- `pnpm format:check`: blocked by seven files outside this iteration: `.vscode/settings.json` and `src/components/ui/{checkbox,input,select,slider,switch,tabs}.tsx`. No Stage 3 implementation or documentation files were reported by the formatter.
- Real-provider and human visual/interaction acceptance remain pending; they are separate from implementation verification. Showcase-video recording is separate release preparation and is not Stage 4 behavior scope.
