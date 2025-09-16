### Issue 3: Convert existing `simulation` to a `system` ComputeModule

Objective

- Adapt `simulation.ts` to the new `system` role-based descriptor so its WGSL contributions are modular.

Context

- `simulation.ts` currently exposes time-step and integration setup in a bespoke manner. We want its WGSL (`global/apply`) to be stitched by the builder alongside other modules, before forces.

Deliverables

1. `simulation.ts` returns `role: "system"` with:
   - `global()` providing uniforms/constants for delta time and integration helpers used by forces
   - `apply()` providing the per-frame integration scaffolding code
2. `compute.ts` assembles `system` (`simulation` then other system modules), followed by `force` contributions.

Step-by-step

1. Update `packages/core/src/modules/webgpu/shaders/modules/simulation.ts`
   - Implement `descriptor(): SystemModuleDescriptor<"simulation", Keys>` with required `bindings` (e.g., sim state uniforms) and `global/apply` strings extracted from the current implementation.
2. Update `compute.ts`
   - Ensure the assembly injects `simulation.global()` early and `simulation.apply()` at the appropriate phase before force modules.

Files

- `packages/core/src/modules/webgpu/shaders/modules/simulation.ts`
- `packages/core/src/modules/webgpu/shaders/compute.ts`

Acceptance Criteria

- Identical behavior for time step and integration vs. current build.
- Project builds; playground runs.

Non-goals

- Render graph; system auto-injection; grid (handled in other issues).
