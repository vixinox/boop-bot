# Stage 3 Task 02: Bounded Animation Timeline

> Superseded for playback ownership, completion pose, and gaze behavior by [Stage 3 refactor specification](./stage-3-refactor-development-spec.md). Use that specification: timelines hold their final pose, no Auto director resumes, and pointer gaze is removed.
>
> For the proposed next-iteration behavior, the Stage 3 final-pose hold and no-gaze rules are superseded by [Stage 4](../stage-4/stage-4-development-spec.md). Until Stage 4 is implemented, this task remains a historical record of current behavior.

- Status: Implemented; automated verification passed. Human visual/interaction acceptance is pending.
- Goal: execute finite sequences of existing clips and expression targets while preserving Auto ownership and giving active animation priority over conflicting head tracking.
- Read first: the Stage 3 specification and [Task 01](./stage-3-task-01-persona-and-tool-protocol.md).
- Dependency: Task 01 defines the timeline schema, clip metadata and validation limits.

## Scope

- Replace choreography and arbitrary-joint runtime state in `companionStore` with an active animation timeline, monotonically increasing revision, current step, finite repeat configuration, playback speed, transition duration, and expression targets.
- Keep Three.js actions, clocks, action completion handlers and interpolation state inside `RiggedRobot`. Store only serializable validated timeline data.
- Use the loaded runtime clip catalog and mixer. A step plays the named clip for its finite repeat count, at its validated speed, then advances using its validated cross-fade duration. Expression targets blend through the existing morph path and return to clip/neutral values when released.
- Keep `animationSource` in Auto for AI timelines. Pause the Auto director while the timeline owns presentation. Resume Auto/Idle and its normal scheduling after completion/cancellation.
- Derive whether each clip writes `Head` or `Neck` from actual track bindings. Suppress gaze pivots while the active clip writes either joint, damp them back to neutral, and resume tracking smoothly from the live pointer after the clip releases the conflict.
- A manual inspector clip selection cancels the AI timeline and retains manual inspector ownership. New AI timelines replace active AI timelines. Cancel, hidden page, unmount/model reload and failed runtime startup clear active presentation and transient expressions.

## Exclusions

- No arbitrary joint targets, custom animation, saved timeline library, or changes to the existing manual inspector controls.
- Do not treat an Auto timeline as a manual animation source merely to suppress pointer/camera interactions; track presentation ownership explicitly.

## Acceptance and validation

- Pure runtime tests cover bounded playback duration at speed/repeat limits, valid clip metadata, invalid empty/overlong timelines, finite repeats, step order, cross-fade settings, expression blend/release, completion to Auto/Idle, replacement/cancellation, and stale completion protection.
- Auto director tests prove no autonomous clip can replace the active AI timeline and that scheduling resumes after release.
- Track tests prove gaze conflicts are derived from loaded `Head`/`Neck` tracks; runtime tests prove only conflicting clips suppress tracking and that live pointer tracking resumes afterward.
- Lifecycle tests cover manual inspector interruption, visibility loss, model unmount/reload, and cleanup after runtime failure.
- Run `pnpm test`, `pnpm typecheck`, `pnpm lint`, and `pnpm format:check` for owned files.
