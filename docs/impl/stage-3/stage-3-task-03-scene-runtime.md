# Stage 3 Task 03: Scene State, Rendering and Camera

- Status: Implemented; automated verification passed. Human visual/interaction acceptance is pending.
- Goal: add a serializable scene model for primitive objects and editable lights, render it declaratively, and let tools move the existing camera without creating a camera.
- Read first: the Stage 3 specification and [Task 01](./stage-3-task-01-persona-and-tool-protocol.md).
- Dependency: Task 01 defines supported geometries, light types, mutation schemas, structural numeric rules and scene snapshot fields.

## Scope

- Add an independent scene store for user primitives, editable built-in/add-on lights and normalized camera commands/view. Keep Object3D, PerspectiveCamera and OrbitControls references inside React Three Fiber components.
- Start with no user primitives and the existing stage appearance. Represent editable `ambient`, `key`, and `fill` lights with stable built-in IDs; report both fixed hemisphere lights as read-only environment data. Built-in lights cannot be deleted or retyped.
- Render the supported box, sphere, cylinder, cone and torus primitives from typed parameters and one solid hex color. Render add-on directional, point and spot lights from validated state. Preserve the existing floor, robot and layout.
- Implement atomic store operations for create, update and delete. Generate stable IDs in the browser. Update preserves geometry/light kind. Do not add product-level entity-count, geometry size/position, or light-intensity upper caps; reject non-finite values, non-positive geometry dimensions, invalid colors and structurally invalid light fields.
- Add an imperative command boundary from `StageCamera` to the actual existing camera/OrbitControls. Tween `position`, look-at `target`, and `fov` on that camera. Keep FOV finite and strictly within 0..180, require position and target to differ, and leave camera type/near/far unchanged. Manual camera input or reset cancels AI motion immediately.
- Publish the current camera position/target/FOV for model context. Preserve the live view on resize and keep the existing reset button behavior intact.

## Exclusions

- No second camera, arbitrary Object3D graph, imported assets, textures, unrestricted postprocessing, persistence, or new scene authoring UI.
- No direct Three.js values in Zustand, tool outputs or model context; scene data is JSON-safe and renderer-owned objects are ephemeral.

## Acceptance and validation

- Store/validator tests cover empty initial object inventory, create/update/delete, stable IDs, shape-specific values, no partial mutation, finite-number/positive-dimension checks, and editable/built-in/add-on light rules without product quotas.
- Camera helper/runtime tests cover position/target/FOV validation, stale command replacement, and user/reset interruption.
- Stage integration verifies rendering derives from store state and does not reparent or mutate the robot rig. Keep camera and scene tests deterministic without requiring browser acceptance.
- Run `pnpm test`, `pnpm typecheck`, `pnpm lint`, and `pnpm format:check` for owned files.
