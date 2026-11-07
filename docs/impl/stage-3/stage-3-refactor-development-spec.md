# Stage 3 Refactor: Presentation Feedback and Explicit Playback Ownership

## Status and startup instruction

- Status: Verified (automated implementation checks pass; manual visual/provider acceptance remains).
- This document records the verified Stage 3 implementation baseline. Stage 4 now supersedes its final-pose-hold and no-gaze behavior with automatic recovery and user-camera attention. Stage 4 also resolves the ordinary-turn policy: light phase feedback, with full actions only when semantically useful.
- This document supersedes conflicting Stage 3 requirements about Auto, automatic director behavior, pointer gaze, timeline completion, default loop state, and camera pan.
- Read this document together with the tool contract specification before implementation. It is the source of truth for this refactor.

## Goal

Make every ordinary user turn visibly responsive while keeping animation behavior deterministic and user-controllable. Manual clips, LLM timelines, the inspector sidebar, and camera controls must expose one consistent state model.

## Superseded constraints

The earlier Stage 3 statements that the robot returns to Auto after timeline completion and that mouse/touch head tracking is preserved are retired. Auto is removed as a user-visible or runtime control mode. Pointer attention, gaze tracking, and their director triggers are removed; touch remains available for camera control.

## Confirmed behavior

- Idle is the first Available clip and the initial clip. Initial Idle loops.
- Selecting Idle enables looping; selecting any other clip disables looping by default.
- A manual click on the currently selected clip restarts it from time zero.
- Non-looping manual clips and completed LLM timelines hold their final pose until another action or manual takeover.
- LLM timelines remain finite: at most 12 steps, five repeats per step, and 30 seconds total effective playback.
- A new user turn immediately interrupts an active LLM timeline; the new turn chooses its own feedback.
- Manual playback, seeking, loop changes, and clip selection immediately take ownership from an LLM timeline.
- The sidebar mirrors the same store state as the stage and labels the controller as AI or manual.
- Playback speed remains an LLM timeline parameter but is removed from the manual sidebar.
- Slider-controlled bone, expression, and timeline presentation values use eased visual output; input values remain responsive.
- Camera controls are left-button rotate, middle-button pan, wheel zoom, with touch camera controls preserved.

## LLM presentation workflow

The system instructions must require this ordered process for each user turn:

1. Classify the interaction and detect sensitive or serious context.
2. Choose feedback intensity. Ordinary turns require an action; sensitive/serious turns may omit it or use a minimal pose.
3. Select an available clip, preferring not to repeat a recently successful clip unless semantic fit requires it.
4. Use a one-step timeline for simple turns and a finite multi-step timeline for complex work. For scene work, actions accompany the work and include a completion gesture.
5. Execute the animation tool before the final text response, then execute scene/light/camera tools as needed.
6. Treat tool results as authoritative. Repair one failed animation call using its structured error; after a second failure, answer naturally without claiming that the action happened.
7. Do not expose the internal plan to the user.

## State and interface requirements

Replace the overloaded `animationSource: 'Auto' | AnimationName` model with explicit playback ownership (`manual` or `ai_timeline`) plus current clip, play state, loop state, timeline progress, and held-final-pose state. Remove Auto director state, `attentionPointer`, gaze updates, and pointer-driven director behavior. Keep the finite timeline interface and current tool names.

The sidebar must render current clip, progress, play/pause, loop, timeline step, and ownership from this state. Remove the Auto button and manual playback-speed slider. The timeline tool may still update the same state and must be visible in the sidebar immediately.

## Milestones

1. Refactor companion state and timeline lifecycle, including final-pose holding and manual takeover.
2. Remove Auto director and pointer attention/gaze paths while retaining camera touch input.
3. Update inspector ordering, loop defaults, repeated-click restart, source badge, slider easing, and remove speed control.
4. Add middle-button camera pan and regression tests.
5. Rewrite persona instructions and eval tests around the ordered presentation workflow.
6. Run full validation and perform manual visual/provider acceptance.

## Implementation results

- Completed the explicit `manual` / `ai_timeline` playback ownership model with Idle-first defaults, repeated-click restart, finite timeline final-pose holding, and manual takeover.
- Removed Auto director, pointer attention/gaze runtime paths, and orphan attention modules. Retained touch camera controls and added middle-button pan.
- Updated the sidebar for Idle-first clips, AI/manual ownership, loop defaults, no manual speed control, and timeline visibility.
- Updated system/tool instructions so timeline completion holds the final pose and manual takeover is explicit; no old Auto-return contract remains in model-facing descriptions.
- Automated verification: `pnpm test` (62 tests), `pnpm typecheck`, `pnpm lint`, targeted formatting, and `pnpm build` passed. Full `pnpm format:check` still includes pre-existing formatting failures in `.vscode/settings.json` and six shadcn UI files.

## Acceptance and validation

- Automated tests cover every confirmed behavior above, including timeline cancellation, final-pose holding, ownership changes, repeated clicks, and camera middle-button pan.
- Persona tests assert the ordered workflow, mandatory ordinary-turn feedback, sensitive-context downgrade, clip de-duplication, one retry, and no false success claims.
- Run `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, and `pnpm build`.
- Manual acceptance covers chat invitation to Sitting, multi-object scene creation with actions spanning the work, AI-to-manual takeover, held final poses, and middle-button panning.

## Non-goals

- No infinite LLM timeline or cross-turn animation loop.
- No new animation assets, arbitrary joint authoring, or new scene tools.
- No application-layer forced retry request beyond the model workflow and existing continuation limit.
