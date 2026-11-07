# Task 04: Idle, Expressions, and Asset Coverage

- Status: Implemented; the existing GLB audit, auto/manual clip variants, temporary reaction playback, and focused tests pass. Subjective visual acceptance remains post-implementation.
- Parent specification: [Stage 4: Reactive Companion Behavior](./stage-4-development-spec.md).
- Dependency: Task 01 behavior event/action contract.
- Dependency order: complete before Task 03 because both tasks integrate with `RiggedRobot`.
- Goal: make resting behavior feel present, define available expression/action semantics, and verify that the real rig can support the required reactions.

## Scope and result

- Audit all loaded animation clips, tracks, joint ownership, and morph targets used by this product. Record available intents, durations, loop safety, and conflicts with head/neck attention.
- Deliver a capability table with actual clip name, duration, loop suitability, semantic intent, affected body/head/neck channels, and actual morph target names. Keep unsupported names out of prompts and tests.
- Verify the Idle loop at its seam. Reuse the existing continuous clip and user-driven camera attention; do not add random ambient gestures when the existing loop supplies subtle motion.
- Define the policy for attention shifts, posture changes, reaction cooldowns, repeated-event coalescing, and suppression during serious conversation or manual control.
- Give `Angry`, `Surprised`, and `Sad` explicit semantic guidance and bounded weight ranges. Keep neutral as the base value; blend temporary targets back to the configured baseline.
- Verify whether current clips/rig can express a warm head-touch acknowledgment, a torso call-for-attention, a `Wave` hand-touch greeting, a semantic `ThumbsUp` praise/approval response, and staged head-to-body turning. Do not imply that these clips provide facial happiness; the current named morph set is `Angry`, `Surprised`, and `Sad`. The required interaction scope is head, torso, and hand taps; head-hold is excluded. Record any missing capability as a limitation.
- Use only the existing GLB, existing clips/morphs, and bounded procedural poses. Do not add or acquire animation assets, replace the model, redesign the rig, or silently rename/fabricate model capabilities. An unmet visual capability is recorded and does not reopen this confirmed scope.

## Code entry points and ownership

- `public/RobotExpressive.glb` is the only current character asset. Do not assume a Happy morph, eye blink, dedicated head-pat clip, or hand high-five clip exists.
- `src/stage/rig.ts` owns `animationCatalog`, clip descriptions, duration, and actual Head/Neck track metadata.
- `src/stage/animationTracks.ts` owns the manual/auto clip split and existing Idle head-yaw treatment. Verify the actual result before changing it.
- `src/stage/RiggedRobot.tsx` owns clip mixer actions, cross-fades, transient expression blending, and model writes. Task 04 establishes clip playback and reaction ownership before Task 03 adds camera attention integration.
- `src/stage/animationTimeline.ts` and `src/state/companionStore.ts` retain finite timeline bounds and Inspector expression baseline semantics. Temporary companion-owned actions recover through the Task 01 contract.
- The parent specification records the completed asset audit, semantic mapping, and known visual limitations. The audit does not authorize or require new assets.

## Exclusions

- No replacement model, rig redesign, or new animation assets. Work within the confirmed existing-GLB and procedural-pose boundary.
- No continuous random full-body animation and no unbounded spontaneous gestures.
- Quiet/Balanced/Lively UI is outside Stage 4 and may be considered in a future product iteration.

## Acceptance and validation

- Idle appears continuous at loop boundaries and does not create a repetitive head shake.
- The continuous Idle clip provides baseline motion without random ambient gestures; camera attention and explicit interactions are suppressed by higher-priority manual/reaction ownership.
- Expression mappings have tests for bounds, blending, interruption, and return to baseline.
- `prefers-reduced-motion` pauses autonomous Idle and camera gaze without canceling deliberate touch or explicit AI actions.
- Asset catalog only reports clips and morphs present in the loaded GLB.
- Head-touch and camera-follow behavior are reviewed on the real model; any asset gap is documented as a limitation. It does not block delivery of unrelated Stage 4 behavior and does not trigger asset acquisition.
- Targeted validation: `pnpm exec vitest run src/stage/animationTimeline.test.ts src/stage/animationTracks.test.ts src/state/companionStore.test.ts` passes; full Stage 4 checks are recorded in the parent specification.
