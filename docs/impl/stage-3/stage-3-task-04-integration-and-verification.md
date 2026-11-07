# Stage 3 Task 04: Chat Integration and Verification

- Status: Implemented; automated verification passed. Real-provider and human acceptance are pending.
- Goal: connect the final animation and scene tools to browser-owned state, give every model response current scene context, reconcile all Stage 3 documentation, and verify the completed behavior.
- Dependencies: Tasks 01, 02 and 03.

## Scope

- Replace the old choreography/direct-state dispatcher branches with the ten tools in Task 01. Keep mutations in the browser and validate again against current stores before state changes.
- Build one capability snapshot function from the current animation, companion, scene and camera state. Call it for the initial response and again before every tool continuation so earlier calls in the same turn are reflected.
- Keep the full local transcript, exact assistant function-call items and matching `function_call_output` entries with original `call_id`; preserve the existing SSE event names and continue tool rounds until the model finishes or the request is aborted.
- On user manual animation input or failed/aborted chat turns, release any active LLM timeline. A camera tween has independent user/reset cancellation. Scene edits that already succeeded remain visible.
- Log tool inputs, outputs, failures and lifecycle IDs in the existing debug console without exposing credentials or stack traces.
- Update the Stage 3 main specification, Tasks 01-04, `docs/impl/README.md`, and Stage 3 roadmap text. Remove stale “Stage 3 undecided”, old tool-count and arbitrary-joint claims; keep historical Stage 1/2 notes intact.

## Explicit exclusions

- No chat redesign, object-authoring UI, persistence, provider-side response storage, or changes to the existing SSE protocol.
- Complex visual/interaction acceptance and recording the final showcase video remain a human post-implementation task.

## Acceptance and validation

- Chat-flow tests prove initial context and each continuation use a newly built snapshot after preceding tool mutations, while preserving history and `call_id` correlation.
- Dispatcher tests cover every current tool, current ID/catalog validation, structured failures and no partial mutation. Old direct-set and free-joint tools are absent from the model registry.
- Documentation references resolve; no active Stage 3 index/roadmap text contradicts the final tool contract or status.
- Run `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, and `pnpm build`; record exact results and any pre-existing failures in the Stage 3 specification.
