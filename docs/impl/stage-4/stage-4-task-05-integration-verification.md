# Task 05: Integration, Diagnostics, and Release Checks

- Status: Implemented; diagnostics and documentation reconciliation are complete. Parent specification records final automated checks and pending human acceptance.
- Parent specification: [Stage 4: Reactive Companion Behavior](./stage-4-development-spec.md).
- Dependencies: Tasks 02, 03, and 04.
- Goal: verify the complete user experience, make behavior explainable during development, and reconcile current documentation with delivered behavior.

## Scope and result

- Integrate conversation, camera attention, touch reactions, idle behavior, expression control, and manual Inspector ownership through the shared behavior contract.
- Extend the debug console with compact behavior-state events: phase change, reaction start/end, owner/priority, attention target change, suppression, interruption, recovery, and failure reason.
- Keep debug events bounded and useful for diagnosis; do not log every animation frame or raw pointer coordinate.
- Update `README.md`, `docs/roadmap.md`, `docs/impl/README.md`, and Stage 2/Stage 3 supersession notes so current capabilities, historical behavior, implemented Stage 4 behavior, and remaining manual acceptance are distinct.
- Preserve chat, scene tools, lights, camera controls, Inspector, and narrow-screen layout.
- Run all required automated checks and record any pre-existing format-check failures separately.

## Code and document ownership

- `src/state/debugConsoleStore.ts` owns behavior event types and retention; `src/ui/DebugConsole.tsx` renders the compact state history.
- Integration may touch `src/ui/ChatOverlay.tsx`, `src/stage/CompanionStage.tsx`, and `src/stage/RiggedRobot.tsx` only to connect the Task 01 event/action contract. Do not introduce a second behavior transition policy in these files.
- Update `docs/roadmap.md` and root `README.md` to describe actual current features, mark Stage 4 implemented after automated validation, and list human visual acceptance separately.
- Add a Stage 4 supersession note to `docs/impl/stage-3/stage-3-refactor-development-spec.md` and `docs/impl/stage-3/stage-3-development-spec.md`; keep their original verified implementation history intact.
- Keep old Stage 2 documents as historical records, but ensure the implementation index labels them as superseded rather than current behavior requirements.

## Acceptance and validation

- End-to-end scenarios in the parent specification pass with both a real model and mocked chat/tool events.
- Desktop and narrow mobile acceptance covers a greeting, serious reply, tool-driven scene edit, camera orbit/reset, head affection tap, torso attention tap, hand `Wave` tap, manual takeover/resume, request error/abort, and page hide/show. Head-hold petting is excluded.
- Verify interaction responses against the existing GLB and bounded procedural poses. Record capability gaps as limitations; do not add assets or make them a blocker for unrelated behavior acceptance.
- Debug history explains why a behavior started, was suppressed/interrupted, and where it recovered without frame-level noise.
- Root README no longer advertises removed Auto/pointer-attention behavior as current.
- `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, and `pnpm build` have recorded results.
- Targeted validation for debug events: `pnpm exec vitest run src/state/debugConsoleStore.test.ts` passes. Full validation results are recorded in the parent specification.
- Human visual acceptance is listed separately from automated verification and is performed after implementation, not used in place of required tests.
