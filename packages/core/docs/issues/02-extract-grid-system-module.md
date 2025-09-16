### Issue 2: Extract Grid logic into a `system` ComputeModule

Objective

- Move spatial grid (binning/culling/neighbor iteration) out of the monolithic builder into a dedicated `Grid` module with `role: "system"`.

Context

- Today, grid uniforms, neighbor iteration helpers, and the compute passes for grid clear/build are embedded in `compute.ts`. We need them as a reusable system module that contributes WGSL to the final compute program.

Deliverables

1. A new `grid.ts` module exporting a `ComputeModule` with `role: "system"` that provides:
   - `global()` WGSL: grid uniforms, constants, and neighbor iteration helpers (`GRID_MINX/MAXX/MINY/MAXY`, `neighbor_iter_*`).
   - `apply()` WGSL: the code paths for `grid_clear` and `grid_build` passes (both cleared at frame start and built before force passes rely on neighbor lookup).
2. Builder changes in `compute.ts` to concatenate `system.global/apply` contributions before force module code.

Step-by-step

1. Create `packages/core/src/modules/webgpu/shaders/modules/grid.ts`
   - Implement `class Grid extends ComputeModule<"grid", /*bindings*/>` returning `role: "system"`.
   - Include existing padding/offscreen-culling behavior and two-cells padding as currently configured.
   - Expose any required uniform bindings (e.g., counts/indices buffers) via `bindings`.
2. Update `compute.ts`
   - Remove inlined grid WGSL code.
   - Add a phase to collect `system` modules and stitch their `global()` snippets near the top of the shader and their `apply()` snippets at the correct execution points (before force `state/apply/constrain/correct`).
   - Maintain current bind group binding indices for grid buffers.
3. Ensure neighbor iteration API (`neighbor_iter_init/next`) remains identical so force modules (collisions, sensors, fluid) keep working.

Files

- `packages/core/src/modules/webgpu/shaders/modules/grid.ts` (new)
- `packages/core/src/modules/webgpu/shaders/compute.ts` (builder changes)

Acceptance Criteria

- Visual and performance parity with current grid (including offscreen culling with 2-cell padding).
- Collisions/fluid/sensors operate identically (no behavior changes).
- Playground functions without regressions.

Non-goals

- Render graph; simulation refactor (next issue covers simulation).
