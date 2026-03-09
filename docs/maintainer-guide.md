## Maintainer Guide

This document explains the internal architecture of the core library for contributors. It covers code organization, the two runtimes (CPU and WebGPU), the module system, and major subsystems like the spatial grid, pipelines, and oscillators.

### Code organization

- `packages/core/src/`
  - [`engine.ts`](../packages/core/src/engine.ts): facade that selects runtime (`cpu`/`webgpu`/`auto`) and delegates the full `IEngine` API
  - [`interfaces.ts`](../packages/core/src/interfaces.ts): `IEngine`, `IParticle`, `AbstractEngine` common logic (view, modules, config, oscillators, export/import, FPS)
  - [`module.ts`](../packages/core/src/module.ts): `Module` base class, `ModuleRole`, `DataType`, and uniform plumbing
  - [`modules/forces/*`](../packages/core/src/modules/forces/): built-in forces (environment, boundary, collisions, behavior, fluids, sensors, interaction, joints, grab)
  - [`modules/grids/*`](../packages/core/src/modules/grids/): built-in grid simulations (Game of Life, reaction-diffusion, elementary CA)
  - [`modules/render/*`](../packages/core/src/modules/render/): built-in render modules (particles, trails, lines)
  - [`grid/*`](../packages/core/src/grid/): shared grid geometry + `GridStore` utilities used by CPU + WebGPU
  - [`runtimes/cpu/*`](../packages/core/src/runtimes/cpu/): CPU engine and helpers (Canvas2D rendering, neighbor queries, descriptors)
  - [`runtimes/webgpu/*`](../packages/core/src/runtimes/webgpu/): WebGPU engine and builders (GPU resources, program/pipeline builders, spatial grid, shaders)

### Engine selection and lifecycle

- Top-level [`Engine`](../packages/core/src/engine.ts) constructs either [`WebGPUEngine`](../packages/core/src/runtimes/webgpu/engine.ts) or [`CPUEngine`](../packages/core/src/runtimes/cpu/engine.ts) based on `runtime`.
- When `runtime === "auto"`, initialization attempts WebGPU first and falls back to CPU if device/adapter creation fails (cleanup is handled, and the CPU engine is re-initialized with the same options).
- The selected concrete engine provides all `IEngine` methods; the facade also exposes helpers like pin/unpin and `isSupported(module)`.

Note on particle readbacks

- On WebGPU, `getParticles()` requires a GPU → CPU readback of the full particle buffer and can be expensive for large scenes.
- Prefer local queries like `getParticlesInRadius(center, radius, { maxResults })` for tool-like occupancy checks.
- `getParticlesInRadius(...)` is implemented in WebGPU via a small compute compaction pass (see `runtimes/webgpu/local-query.ts`) that only reads back a bounded result buffer.

### AbstractEngine responsibilities

Shared functionality across both runtimes:

- Animation control: `play()/pause()/stop()/toggle()`, dt clamping, FPS smoothing
- View: `View` tracks camera, zoom, and canvas size; view changes trigger runtime hooks
- Configuration: `cellSize`, `maxNeighbors`, `maxParticles`, `constrainIterations`, `clearColor`
- Modules: array of `Module` instances; `export()`/`import()` serialize module inputs, including `enabled`
- Oscillators: `OscillatorManager` writes into module inputs each frame via `module.write()` and triggers `onModuleSettingsChanged()`

### WebGPU runtime

Key components (see [`runtimes/webgpu/`](../packages/core/src/runtimes/webgpu/)):

- [`GPUResources`](../packages/core/src/runtimes/webgpu/gpu-resources.ts): device/context acquisition, swapchain, shared bind groups, uniform buffers, scene textures
- [`ModuleRegistry`](../packages/core/src/runtimes/webgpu/module-registry.ts): collects modules; attaches uniform writers/readers; materializes pass/phase requirements
- [`SimulationPipeline`](../packages/core/src/runtimes/webgpu/simulation-pipeline.ts): builds the compute program by concatenating module-provided WGSL snippets across phases (`global`, `state`, `apply`, `constrain`, `correct`); dispatches with configured `workgroupSize`
- [`RenderPipeline`](../packages/core/src/runtimes/webgpu/render-pipeline.ts): executes module render passes (Fullscreen/Compute/Instanced) in sequence, ping-ponging the scene texture as needed
- [`SpacialGrid`](../packages/core/src/runtimes/webgpu/spacial-grid.ts): grid uniforms/buffers and neighbor iterators used by simulation WGSL
- [`ParticleStore`](../packages/core/src/runtimes/webgpu/particle-store.ts): GPU storage for particle arrays (positions, velocities, size, mass, color, etc.) with known stride
- [`LocalQuery`](../packages/core/src/runtimes/webgpu/local-query.ts): compact local particle queries (`getParticlesInRadius`) without full-scene readback

Execution order (per frame):

1. Update oscillators and inputs; flush uniform buffers when settings changed
2. Simulation `state` pass (optional), then `apply` (forces), then `constrain` (iterated), then `correct`
3. Rendering: render passes run in declared order; compute passes may read/write the scene texture; fullscreen passes composite
4. Present

Performance considerations:

- `workgroupSize` (default 64) and `maxParticles` are configurable
- dt is clamped to improve stability (`<= 100ms`)
- Neighbor queries depend on `cellSize` and `maxNeighbors`; tune for density

### CPU runtime

Parallels the WebGPU phases with pure TypeScript:

- Simulation phases implemented via `CPUDescriptor` callbacks (`state`, `apply`, `constrain`, `correct`)
- Neighbor queries via a spatial grid with `getNeighbors(position, radius)` (see [`spatial-grid.ts`](../packages/core/src/runtimes/cpu/spatial-grid.ts))
- Rendering via Canvas2D
  - Composition: modules declare how to interact with the canvas clear/draw order
  - Effects like Trails use immediate-mode approximations (decay fill, canvas blur)

### Module system

- Each module declares `name`, `role`, and `inputs` (NUMBER/ARRAY); the engine binds them as uniforms/buffers
- The base `Module` exposes `write()` to update inputs and `read()` to snapshot them; `setEnabled()` toggles an implicit `enabled` input
- For force modules, both runtimes support the lifecycle hooks; render modules contribute render passes
- Arrays are supported and surfaced in WGSL via `getLength()` and indexed `getUniform()` access

### Grid modules and pipeline

Grid modules (`ModuleRole.Grid`) are for simulations that live on a cell lattice (Conway, reaction-diffusion, cellular automata). They have their own storage and update pipeline, but can interoperate with particles.

Key concepts:

- `gridSpec` lives on the module and describes the lattice:
  - `width`/`height` cell resolution.
  - `format` determines channel count (e.g. `r`, `rg`, `rgba`). Storage is currently float for both runtimes.
  - `wrapMode` controls addressing (`Clamp` or `Repeat`).
- The engine holds one `GridStore` per grid module, with ping-pong buffers for read/write.
- `getGrid(name)` / `setGrid(name, data)` is part of the public engine API.
  - On WebGPU these perform GPU ↔ CPU transfers; avoid in hot paths.

Pipeline timing:

- CPU: grid steps run before particle simulation by default. Each module gets:
  - `init` (optional one-time seed), `step` (per-frame update), `post` (optional correction).
  - `render` callbacks can read the grid for Canvas2D drawing.
- WebGPU: grid steps run in compute passes via `grid-pipeline.ts`:
  - `init`/`step`/`post` are WGSL snippets per module.
  - Each step ping-pongs read/write storage buffers.
  - Grid modules can add render passes (fullscreen/compute) that bind grid buffers.

Interop with particles:

- `GridFieldForce` reads a grid field to apply per-particle forces.
- `ParticleDepositGrid` writes particle data into a grid.
- Interop modules must know which grid they target and attach its spec before WebGPU program build.

Relation to the spatial grid:

- The particle neighbor spatial grid is distinct from grid modules.
- Both share `GridGeometry` helpers for world↔cell conversions to keep math consistent across runtimes.

### Built-in module notes

- Environment: gravity/inertia/friction/damping; inward/outward/custom directions use grid/view transforms per runtime
- Boundary: bounce/warp/kill/none modes; optional repel with inside/outside scaling; tangential friction
- Collisions: position correction + impulse; handles identical-position separation
- Behavior: separation/alignment/cohesion/wander; consistent FOV checks; pseudo-random jitter to reduce bias
- Fluids: SPH density (`state`) and pressure/viscosity (`apply`); near-pressure for dense packs; force clamping
- Sensors: trail/color sampling; consistent world↔UV mapping and CPU sampling
- Interaction: falloff-based point force; attract/repel
- Joints: CSR incident lists; momentum preservation; optional particle↔joint and joint↔joint CCD
- Grab: single-particle override applied in `correct`
- Render: Particles (instanced soft-discs; ring for pinned), Trails (decay+diffuse compute), Lines (instanced quads)

### Export/Import and settings change propagation

- `export()` iterates modules and collects current input values plus `enabled`
- `import()` writes values back and toggles `enabled`, then triggers `onModuleSettingsChanged()`
- Oscillators update via a centralized manager; input writes also flow through the same mechanism

### Extending the system

- Add new modules under [`modules/forces/*`](../packages/core/src/modules/forces/) or [`modules/render/*`](../packages/core/src/modules/render/)
- For WebGPU: extend builders if the WGSL DSL needs new helpers
- For CPU: ensure compositing and sampling utilities cover your pass
- Update the playground to expose controls for new inputs

### References

- Authoring: [`module-author-guide.md`](./module-author-guide.md)
- User Guide: [`user-guide.md`](./user-guide.md)
