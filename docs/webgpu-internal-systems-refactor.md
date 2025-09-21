## Proposal: Inline simulation/grid WGSL in program builder and remove System modules

Goal: keep user-extensible modules limited to Force and Render. Move simulation/grid concerns into internal engine scaffolding so users cannot (and need not) author "system" modules.

### Current state (summary)

- Public `SystemModuleDescriptor` with `role: system` is used to:
  - Define uniform blocks for `simulation` (dt, count, simStride) and `grid` (extents, sizing).
  - Emit global WGSL helpers (SIM_STATE access, neighbor iteration) and system entrypoints (grid_clear/grid_build).
- `ModuleRegistry.buildProgram(...)` composes system + force modules into a single compute WGSL program and produces `Program.layouts` for all modules (including system), plus `Program.extraBindings`.
- `GridSystem` writes uniforms into the `grid` layout; `Engine` updates `simulation` uniforms via a writer looked up by name.

### Problems

- System modules are not meant to be authored or extended by users but appear as first-class modules in the API.
- The presence of public system descriptors encourages accidental coupling and increases the conceptual surface for module authors.

### Design principles for the refactor

1. Only Force and Render modules are public extensibility points.
2. Simulation flow, SIM_STATE management, grid neighborhood iteration, and grid entrypoints become internal scaffolding.
3. Reserve binding indices and uniform layouts for internal systems, but do not expose them as user modules.
4. Preserve (or improve) performance and shader caching characteristics.

### Simplified plan (what to do now)

Keep the existing builder in `packages/core/src/modules/webgpu/builders/program.ts` and inline the `simulation` and `grid` WGSL directly there. Remove the public "system" role and descriptors entirely.

1. Types/API surface

- In `module-descriptors.ts`:
  - Remove `ModuleRole.System` and `SystemModuleDescriptor` from the public API.
  - `ModuleRole` only includes `Force` and `Render`.
- Remove `modules/system/{simulation.ts, grid.ts}` and their re-exports from `modules/index.ts`.

2. Inline internal WGSL in builder/program.ts

- Always declare two internal uniform blocks at the top of the generated program:
  - `simulation_uniforms` with fields `dt`, `count`, `simStride`.
  - `grid_uniforms` with fields `minX`, `minY`, `maxX`, `maxY`, `cols`, `rows`, `cellSize`, `maxPerCell`.
- Prepend their struct/var declarations to `uniformDecls` and their entries to `layouts` so the CPU can still look them up by name (`simulation`, `grid`). Mark them internal in comments; no public module is required.
- Inline the global WGSL helpers from today’s `modules/system/simulation.ts` and `modules/system/grid.ts`:
  - SIM*STATE helpers: `SIM_STATE_STRIDE`, `SIM_COUNT`, `sim_state*{read,write}`.
  - Grid helpers: neighbor iterator (`neighbor_iter_init/next`), hashing, and constants.
- Inline the grid entrypoints `grid_clear` and `grid_build` unconditionally in the program.
- Reserve extra storage/texture bindings in the same way (counts/indices, SIM_STATE, scene texture) and keep publishing them via `Program.extraBindings`.
- Remove all descriptor-time checks for `role === System` and any code paths that iterate system modules.

3. Binding order in compute bind group

- `@group(0)` bindings become: 0. particles (storage)
  1. simulation_uniforms (uniform)
  2. grid_uniforms (uniform)
     3..N user module uniforms (uniform) in module order
     X..X+3 internal storages/textures (counts, indices, SIM_STATE, scene_texture) from `extraBindings`

4. Engine/registry/grid wiring

- `ModuleRegistry` is only responsible for user modules (Force + Render): building user layouts, CPU uniform state, and writers/readers.
- `Engine.initialize()` no longer injects `Simulation` and `Grid` as modules. Instead:
  - After `buildProgram(...)`, it locates the `simulation` and `grid` layouts by name in `program.layouts` and keeps their indices.
  - The existing `GridSystem` writes its uniforms by index using `GPUResources.writeModuleUniform(...)` and same for `Engine` writing `dt`/`count` into the `simulation` layout (like it already does via the writer, but now direct).
- `SimulationPipeline` and `GPUResources` remain unchanged except for the fixed internal uniform binding order established above.

### Migration steps (short list)

1. Remove `SystemModuleDescriptor` and `ModuleRole.System` from `module-descriptors.ts` and fix imports/usages.
2. Delete `packages/core/src/modules/webgpu/modules/system/*` and remove exports from `modules/index.ts` and any code that was constructing them.
3. Modify `builders/program.ts`:
   - Prepend internal `simulation`/`grid` uniform layouts and WGSL (globals + entrypoints) to the assembled code.
   - Set binding indices so user module uniforms start at 3.
   - Remove all code that iterates `role === System`.
4. Adjust `Engine` to write `dt/count` directly to the `simulation` layout (lookup by name from `program.layouts`).
5. Adjust `GridSystem.configure/resizeIfNeeded` to write to `grid` layout via `program.layouts` lookup.
6. Run and validate: grid still builds, neighbor iteration works, and simulation uniforms update per frame.

### Risks and mitigations

- Binding index churn: mitigate by pinning internal uniform bindings to fixed slots (1 and 2) and keeping extra bindings enumerated in `Program.extraBindings`.
- Shader cache keys: assembler changes WGSL composition ordering. Continue hashing final WGSL to keep cache correctness. No change needed to cache logic.
- Hidden coupling: although internal, `grid`/`simulation` semantics remain stable WGSL helpers; document their guarantees in maintainer docs to ease future maintenance.

### Optional improvements (post-refactor)

- Pre-built neighbor iterator variants (radius tiers) to reduce per-pass branching.
- Separate "capabilities" bitmask in `Program` to describe which internal helpers/passes are present; allows smaller programs when certain features are disabled.
- Allow opt-out of grid-based neighbor scanning for simple scenes to reduce memory traffic.

### Summary

This streamlined plan avoids introducing new internal managers. We simply inline the WGSL from `simulation.ts` and `grid.ts` into the program builder, fix the binding order, and remove the public "system" role. Force/Render modules remain unchanged and users keep the same authoring experience, with fewer concepts to learn.
