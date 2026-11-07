# Stage 3 Task 01: Animation and Scene Protocol

- Status: Implemented; automated verification passed. Human provider acceptance is pending.
- Goal: replace the free-form choreography API with a finite existing-clip timeline and define validated browser-owned scene-editing tools.
- Read first: the Stage 3 specification is authoritative for defaults, bounds, lifecycle and compatibility.

## Scope

- Replace `set_animation`, `set_behavior`, `set_expression`, `set_attention`, `play_choreography`, and `cancel_choreography` in the model-visible registry with the exact ten tools named in the Stage 3 specification.
- Define runtime capability data for loaded clip name/duration/semantic description/head-neck track flags, current presentation state, object and editable-light inventories, fixed environment summary, and camera view.
- Define strict schemas for finite animation timelines, scene inspection, primitive create/update/delete, light create/update/delete, and existing-camera view commands.
- Add pure validation for the adopted rules. Animation count/duration/repeat/speed/transition are bounded as specified. Scene counts, dimensions, coordinates, and light intensity have no product-level upper caps but require finite values and positive geometry dimensions. Primitive updates preserve shape kind; built-in lights can be updated but not deleted or retyped. Reject unknown fields and invalid shape/light combinations before browser state mutation.
- Update the Chinese companion instructions: choose existing clips only; prefer restrained finite actions; use scene tools for visual requests; never claim a scene mutation succeeded without successful tool results; do not mention internal tools.
- Keep server schema generation independent from browser state mutation. The browser executor remains the final authority for clip metadata, IDs, and current scene limits.

## Interface contract

- `play_animation_timeline`: 1-12 steps, `repeat_count` 1-5, speed 0.5-1.5, transition 0-800 ms, easing `linear | ease_in | ease_out | ease_in_out`, optional expression weights 0-1, total effective clip playback <= 30000 ms. The LLM animation enum excludes Death and Punch; the manual inspector is unaffected.
- `cancel_animation_timeline` and `inspect_scene` accept empty objects.
- Primitive kinds are `box`, `sphere`, `cylinder`, `cone`, and `torus`; dimensions are shape-specific and positive, all numeric inputs are finite, and colors are `#RRGGBB`. There are no product-level object-count, size, or position caps.
- Editable built-in light IDs are `ambient`, `key`, and `fill`; they may be updated but not deleted or retyped. Add-on types are `directional`, `point`, and `spot`; two fixed hemisphere lights are read-only context. There are no product-level light-count or intensity caps.
- `set_camera_pose` changes `position`, `target`, `fov`, and a 200-1500 ms tween duration on the existing perspective camera only. Position/target are finite and distinct; FOV is finite and strictly within 0..180 degrees. It never creates a camera, changes camera type/near/far, or disables user controls.
- Tool results remain `{ ok:true, toolName, result }` or `{ ok:false, toolName, error }`. Every mutation is all-or-nothing.

## Explicit exclusions

- No joint names/angles in LLM tool arguments, custom animation curves, non-finite/infinite clip loops, texture maps, arbitrary material parameters, raw Three.js objects, or server-side Three.js/Zustand mutation.
- No provider-side conversation storage; preserve local continuation and `call_id` behavior.

## Acceptance and validation

- Server tests assert exact tool set and strict schemas, capability-bound clip enums, structured clip semantics, all numeric/string bounds, malformed payload failures, and no partial update on rejection.
- Tests cover unknown object/light IDs, built-in light delete/type-change rejection, shape-specific geometry, and camera bounds.
- Run `pnpm test`, `pnpm typecheck`, `pnpm lint`, and `pnpm format:check` for owned files.
