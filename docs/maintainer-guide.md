## Maintainer Guide

This document explains the internal architecture of the core library for contributors. It covers code organization, the two runtimes (CPU and WebGPU), the module system, and major subsystems like the spatial grid, pipelines, and oscillators.

### Code organization

- `packages/core/src/`
  - [`engine.ts`](../../packages/core/src/engine.ts): facade that selects runtime (`cpu`/`webgpu`/`auto`) and delegates the full `IEngine` API
  - [`interfaces.ts`](../../packages/core/src/interfaces.ts): `IEngine`, `IParticle`, `AbstractEngine` common logic (view, modules, config, oscillators, export/import, FPS)
  - [`module.ts`](../../packages/core/src/module.ts): `Module` base class, `ModuleRole`, `DataType`, and uniform plumbing
  - [`modules/forces/*`](../../packages/core/src/modules/forces/): built-in forces (environment, boundary, collisions, behavior, fluids, sensors, interaction, joints, grab)
  - [`modules/render/*`](../../packages/core/src/modules/render/): built-in render modules (particles, trails, lines)
  - [`runtimes/cpu/*`](../../packages/core/src/runtimes/cpu/): CPU engine and helpers (Canvas2D rendering, neighbor queries, descriptors)
  - [`runtimes/webgpu/*`](../../packages/core/src/runtimes/webgpu/): WebGPU engine and builders (GPU resources, program/pipeline builders, spatial grid, shaders)

### Engine selection and lifecycle

- Top-level [`Engine`](../../packages/core/src/engine.ts) constructs either [`WebGPUEngine`](../../packages/core/src/runtimes/webgpu/engine.ts) or [`CPUEngine`](../../packages/core/src/runtimes/cpu/engine.ts) based on `runtime`.
- When `runtime === "auto"`, initialization attempts WebGPU first and falls back to CPU if device/adapter creation fails (cleanup is handled, and the CPU engine is re-initialized with the same options).
- The selected concrete engine provides all `IEngine` methods; the facade also exposes helpers like pin/unpin and `isSupported(module)`.

### AbstractEngine responsibilities

Shared functionality across both runtimes:

- Animation control: `play()/pause()/stop()/toggle()`, dt clamping, FPS smoothing
- View: `View` tracks camera, zoom, and canvas size; view changes trigger runtime hooks
- Configuration: `cellSize`, `maxNeighbors`, `maxParticles`, `constrainIterations`, `clearColor`
- Modules: array of `Module` instances; `export()`/`import()` serialize module inputs, including `enabled`
- Oscillators: `OscillatorManager` writes into module inputs each frame via `module.write()` and triggers `onModuleSettingsChanged()`

### WebGPU runtime

Key components (see [`runtimes/webgpu/`](../../packages/core/src/runtimes/webgpu/)):

- [`GPUResources`](../../packages/core/src/runtimes/webgpu/gpu-resources.ts): device/context acquisition, swapchain, shared bind groups, uniform buffers, scene textures
- [`ModuleRegistry`](../../packages/core/src/runtimes/webgpu/module-registry.ts): collects modules; attaches uniform writers/readers; materializes pass/phase requirements
- [`SimulationPipeline`](../../packages/core/src/runtimes/webgpu/simulation-pipeline.ts): builds the compute program by concatenating module-provided WGSL snippets across phases (`global`, `state`, `apply`, `constrain`, `correct`); dispatches with configured `workgroupSize`
- [`RenderPipeline`](../../packages/core/src/runtimes/webgpu/render-pipeline.ts): executes module render passes (Fullscreen/Compute/Instanced) in sequence, ping-ponging the scene texture as needed
- [`SpacialGrid`](../../packages/core/src/runtimes/webgpu/spacial-grid.ts): grid uniforms/buffers and neighbor iterators used by simulation WGSL
- [`ParticleStore`](../../packages/core/src/runtimes/webgpu/particle-store.ts): GPU storage for particle arrays (positions, velocities, size, mass, color, etc.) with known stride

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
- Neighbor queries via a spatial grid with `getNeighbors(position, radius)` (see [`spatial-grid.ts`](../../packages/core/src/runtimes/cpu/spatial-grid.ts))
- Rendering via Canvas2D
  - Composition: modules declare how to interact with the canvas clear/draw order
  - Effects like Trails use immediate-mode approximations (decay fill, canvas blur)

### Module system

- Each module declares `name`, `role`, and `inputs` (NUMBER/ARRAY); the engine binds them as uniforms/buffers
- The base `Module` exposes `write()` to update inputs and `read()` to snapshot them; `setEnabled()` toggles an implicit `enabled` input
- For force modules, both runtimes support the lifecycle hooks; render modules contribute render passes
- Arrays are supported and surfaced in WGSL via `getLength()` and indexed `getUniform()` access

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

- Add new modules under [`modules/forces/*`](../../packages/core/src/modules/forces/) or [`modules/render/*`](../../packages/core/src/modules/render/)
- For WebGPU: extend builders if the WGSL DSL needs new helpers
- For CPU: ensure compositing and sampling utilities cover your pass
- Update the playground to expose controls for new inputs

### References

- Authoring: [`module-author-guide.md`](./module-author-guide.md)
- User Guide: [`user-guide.md`](./user-guide.md)
