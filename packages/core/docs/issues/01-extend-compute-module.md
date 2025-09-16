### Issue 1: Extend ComputeModule to support roles (system | force | render)

Objective

- Make the existing `ComputeModule` capable of describing three categories of modules via a role-based descriptor API:
  - `system`: core system functionality (e.g., grid, simulation timing)
  - `force`: physics/behavior compute modules (existing)
  - `render`: scene-effects modules executed by a render graph (trails, post-process)

Why

- We need one unified extension surface so future features don’t require parallel hierarchies or hardcoding.

Deliverables

1. Type-level updates to support role-based descriptors without altering runtime behavior.
2. Minimal glue so the builder can accept the new descriptor shapes (no-op for render/system until later issues wire them in).

Step-by-step

1. Add roles and base descriptor
   - In `packages/core/src/modules/webgpu/shaders/compute.ts` (or shared types), add:
     - `export type ComputeModuleRole = "system" | "force" | "render";`
     - `export interface BaseModuleDescriptor<Name extends string> { name: Name; role: ComputeModuleRole; bindings: readonly string[]; }`
2. Define role-specific descriptors
   - `SystemModuleDescriptor<Name, Keys>` with optional `global?: () => string`, `apply?: (ctx) => string`
   - `ForceModuleDescriptor<Name, Keys>` with optional `global?, state?, apply?, constrain?, correct?`
   - `RenderModuleDescriptor<Name, Keys>` with required `passes: Array<{ kind: "fullscreen" | "compute"; code: string; vsEntry?; fsEntry?; csEntry?; bindings: readonly Keys[]; readsScene?; writesScene?; }>`
3. Export union type
   - `export type ComputeModuleDescriptor<Name extends string, Keys extends string> = SystemModuleDescriptor<Name, Keys> | ForceModuleDescriptor<Name, Keys> | RenderModuleDescriptor<Name, Keys>;`
4. Update `ComputeModule` base class
   - Change `descriptor()` return type to the union. Keep `attachUniformWriter`, `setEnabled`, `isEnabled` as-is.
5. Ensure existing modules still compile
   - Adjust their descriptor return types if necessary (type-only changes). No WGSL or logic changes.
6. Make `compute.ts` tolerant of the new union type
   - Only use the `force`-related fields for now; ignore `system`/`render` roles (subsequent issues wire these in).

Files

- `packages/core/src/modules/webgpu/shaders/compute.ts` (types + union)
- `packages/core/src/modules/webgpu/shaders/modules/*` (type-only touch-ups)
- `packages/core/src/modules/webgpu/shaders/modules/index.ts` (likely no change)

Acceptance Criteria

- Build succeeds; playground runs identically.
- No behavior or shader output changes.
- Existing modules remain untouched at logic level.

Non-goals

- Grid extraction, simulation refactor, render graph implementation, or module conversions.
