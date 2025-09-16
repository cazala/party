### Issue 7: Auto-inject `system` modules (simulation, grid)

Objective

- Make `WebGPUParticleSystem` automatically prepend `simulation` and `grid` system modules so users only pass force and render modules.

Why

- System modules are core and mandatory. Auto-injection prevents user mistakes and standardizes ordering.

What to build

1. Constructor injection
   - In `WebGPUParticleSystem`, take the user-provided module list and build an internal list:
     - If no `simulation` module is present (role: "system"), construct one and insert at index 0
     - If no `grid` module is present (role: "system"), construct one and insert at index 1 (after simulation)
   - Preserve original order of the user-provided modules afterwards
2. Ordering guarantee
   - Ensure final order is: system → force → render
   - If users pass modules in mixed order, keep their relative order within each role but group by role at initialization time (stable partition)

Implementation notes

- Detect roles via `descriptor().role`
- `simulation` and `grid` concrete classes:
  - `packages/core/src/modules/webgpu/shaders/modules/simulation.ts`
  - `packages/core/src/modules/webgpu/shaders/modules/grid.ts` (introduced in Issue 2)

Files

- `packages/core/src/modules/webgpu/WebGPUParticleSystem.ts`

Acceptance Criteria

- Users can pass only force/render modules; system modules are added implicitly.
- Effective order is: simulation, grid, ...user force..., ...user render...
- If user includes their own `simulation` or `grid`, auto-injection should not duplicate them.

Non-goals

- Changes to simulation/grid behavior.
