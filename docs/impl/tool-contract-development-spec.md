# Tool Contract Development Specification

## Status and startup instruction

- Status: Verified (implementation complete; one repository-wide format check remains blocked by pre-existing files outside this change).
- Goal: prevent new model-visible tools from shipping with incomplete guidance or a schema/runtime mismatch.
- Read this specification before adding or changing a tool. Treat the registered tool schema and runtime validator as one public contract.
- Baseline: current workspace source behavior is authoritative. Staged/unstaged diff intent was not considered.

## Current implementation facts

- Tool definitions are registered in `server/tools.ts` and sent to the Responses API by `server/index.ts`.
- Tool execution is centralized in `src/stage/toolExecutor.ts`; scene validation lives in `src/stage/sceneValidation.ts` and animation validation in `src/stage/animationTimeline.ts`.
- Tool call results are returned to the model through the continuation transcript in `src/ui/chatFlow.ts`.
- Existing tests cover tool definitions, validators, executors, and continuation separately. New work must test their contract together.

## Decisions and invariants

- Confirmed: use layered gates covering descriptions, schemas, runtime validation, contract tests, and CI checks.
- Confirmed: fix existing scene-tool guidance and add reusable requirements for future tools.
- Confirmed: failures must contain actionable repair guidance so the model can decide whether and how to retry.
- Adopted default: retain the current registration/execution architecture; do not introduce generated code or a new tool framework in this change.
- Adopted default: structured failures use `code`, `message`, optional `path` and `expected`, and required `repair`. Successful result shapes remain unchanged.

## New tool checklist

Every tool change must provide all of the following in the same change:

1. A model-facing description stating purpose, boundaries, preconditions, units, defaults, and field relationships.
2. A strict schema that exposes only legal fields and uses the same required fields and numeric boundaries as runtime validation.
3. Runtime validation before state mutation. Validation failures must identify a stable error code and give a direct repair instruction; include a field path and expected value/shape when meaningful.
4. An executor branch that preserves atomicity and returns the established success shape.
5. Positive and negative contract tests linking accepted schema inputs to successful execution and rejected inputs to actionable errors.
6. A continuation test when failure recovery or a multi-step workflow is involved.
7. Passing development checks: `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, and `pnpm build`.

For conditional fields, encode the relationship in the model-visible schema. Do not put fields for unrelated variants in an unconstrained shared object. For example, primitive dimensions must be constrained by shape; light fields must be constrained by light type. Do not attempt to solve a schema defect only by expanding system instructions, and do not add runtime-only restrictions without updating the model-visible schema.

## Error and recovery contract

Tool failures are returned to the model as structured JSON and remain available in debug traces. User-facing trace text may display `message`, but must not replace or discard the structured result. Repair guidance must identify the next action, such as the exact allowed fields, valid range, or need to call `inspect_scene` for a current ID. The client continues tool rounds until the model finishes or the request is aborted; the model must not claim success before a successful tool result.

## Acceptance and validation

- Every registered tool has a substantive description and strict object schemas.
- Conditional schema branches match runtime validation, including exact field sets and boundaries.
- Each tool has at least one valid case and one invalid case; invalid cases assert error code and repair guidance.
- Representative schema-valid calls execute successfully, and invalid calls do not mutate state.
- Structured failures survive serialization into continuation outputs.
- All five commands in the checklist pass. Complex real-model/browser acceptance is a separate human check, not a substitute for automated validation.

## Non-goals

- No generated schema/runtime system or wholesale tool architecture rewrite.
- No new model capabilities beyond the currently registered tools.
- No change to successful tool result semantics.

## Implementation progress

- Complete: primitive tool schemas now constrain each shape to its own fields; light/camera/ID guidance is explicit; runtime failures carry structured actionable details; continuation preserves the structured result.
- Complete: the registered-tool test pins the tool list and recursively checks strict object boundaries, so adding a tool requires explicitly updating contract coverage.
- `pnpm test`: passed (70 tests across 18 files).
- `pnpm typecheck`: passed.
- `pnpm lint`: passed.
- `pnpm build`: passed; Vite reports the existing non-blocking bundle-size warning (1.53 MB JS).
- `pnpm format:check`: blocked by existing formatting in `.vscode/settings.json` and `src/components/ui/{checkbox,input,select,slider,switch,tabs}.tsx`; all files changed for this work were formatted.
- Deviation: the repository has no CI configuration to wire a new workflow into. The required command gate is documented in this specification and `docs/impl/README.md`; the test suite enforces the registered-tool inventory/schema coverage locally.
