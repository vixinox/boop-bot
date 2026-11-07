# Task 02: Conversation Performance

- Status: Implemented; chat lifecycle and persona tests pass. Cross-feature checks are recorded in the parent specification.
- Parent specification: [Stage 4: Reactive Companion Behavior](./stage-4-development-spec.md).
- Dependency: Task 01 behavior event/action contract.
- Confirmed behavior: ordinary turns receive light phase feedback; full-body actions play only when semantically useful. Serious or sensitive turns use minimal motion or text alone when appropriate.
- Goal: connect the existing chat lifecycle to coherent companion feedback and give the model bounded semantic presentation guidance.

## Scope and result

- Map accepted user submission to Listening, request/continuation/tool execution to Thinking, streamed assistant text to Responding, and completed turns to Settling.
- Map `ChatOverlay.send` start to Listening, first request/continuation work to Thinking, first `text_delta` to Responding, `tool_call`/tool continuation back to Thinking, and completion of the entire `continueToolRounds` flow to Settling then Available.
- Map timeout, API error, tool error, abort, and request cancellation to a calm recovery path; do not show completion behavior for unconfirmed work.
- Show listening and thinking with restrained smoothed posture cues; return to neutral for streamed response and settling. Suppress these cues under manual ownership, an active reaction, or reduced-motion preference.
- Move between Thinking and Responding as tool rounds and streamed text alternate.
- Refine the persona and animation tool descriptions so available clip and expression meanings are explicit, ordinary turns may use subtle feedback, serious context may use minimal motion, and no response depends on an unbounded timeline.
- Keep local pointer/touch events out of the model API. The model selects semantic conversation performance; the local runtime handles timing, interruption, and return behavior.
- Preserve tool schemas unless the asset audit or behavior interface proves a new bounded semantic field is necessary. Any tool contract change must follow `tool-contract-development-spec.md`.
- Preserve the current single-flight chat flow: `send` ignores submissions while `busy`; do not add overlapping requests or a queue in this task. Direct interaction may interrupt a visual action without aborting the API request.
- Keep scene/tool success independent from presentation success. A gesture may fail while the scene operation succeeds, and vice versa.

## Code entry points and ownership

- `src/ui/ChatOverlay.tsx` owns browser chat lifecycle events and dispatches behavior events. It must not set robot clips or morph values directly.
- `src/ui/chatFlow.ts` owns tool-round continuation boundaries. The final turn event is emitted only after all tool rounds complete.
- `server/persona.ts` owns model-facing intent guidance. It describes available semantics and safety boundaries but does not own local behavior timing or recovery.
- `server/tools.ts` changes only if an expression/action schema needs a bounded contract change. Existing `play_animation_timeline` remains finite and uses the verified loaded clip list.
- Existing focused validation is `pnpm exec vitest run src/ui/chatFlow.test.ts server/persona.test.ts`; add event-mapping tests alongside the UI chat flow tests without adding a new chat protocol.

## Exclusions

- No new chat protocol, model provider, scene tool, or conversational content policy.
- No forced full-body animation for every text delta or every ordinary user sentence.

## Acceptance and validation

- Tests cover send, streamed text, multiple tool rounds, tool-only turns, errors, timeout, abort, and final settling.
- The conversation phase moves back to Thinking during tool work after text streaming and enters Settling only after the entire turn finishes.
- A second submission while `busy` is rejected as it is today; the character can still acknowledge local interaction without changing or aborting the in-flight request.
- Tool progress never appears as a confirmed final result, and failure feedback does not imply the scene edit succeeded.
- A one-shot animation can finish while Thinking/Responding continues and returns to that phase.
- A new reaction or manual takeover cannot be overwritten by delayed chat completion events.
- Persona/schema tests verify semantic descriptions, bounded actions, serious-context downgrade, and no promise of unsupported clips or expressions.
- Targeted validation: `pnpm exec vitest run src/ui/chatFlow.test.ts server/persona.test.ts` passes; full Stage 4 checks are recorded in the parent specification.
