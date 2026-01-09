## Maintainer Guide

This document explains the internal architecture of the core library for contributors. It covers code organization, the three runtimes (CPU, WebGPU, and WebGL2), the module system, and major subsystems like the spatial grid, pipelines, and oscillators.

### Code organization

- `packages/core/src/`
  - [`engine.ts`](../packages/core/src/engine.ts): facade that selects runtime (`cpu`/`webgpu`/`webgl2`/`auto`) and delegates the full `IEngine` API
  - [`interfaces.ts`](../packages/core/src/interfaces.ts): `IEngine`, `IParticle`, `AbstractEngine` common logic (view, modules, config, oscillators, export/import, FPS)
  - [`module.ts`](../packages/core/src/module.ts): `Module` base class, `ModuleRole`, `DataType`, and uniform plumbing
  - [`modules/forces/*`](../packages/core/src/modules/forces/): built-in forces (environment, boundary, collisions, behavior, fluids, sensors, interaction, joints, grab)
  - [`modules/render/*`](../packages/core/src/modules/render/): built-in render modules (particles, trails, lines)
  - [`runtimes/cpu/*`](../packages/core/src/runtimes/cpu/): CPU engine and helpers (Canvas2D rendering, neighbor queries, descriptors)
  - [`runtimes/webgpu/*`](../packages/core/src/runtimes/webgpu/): WebGPU engine and builders (GPU resources, program/pipeline builders, spatial grid, shaders)
  - [`runtimes/webgl2/*`](../packages/core/src/runtimes/webgl2/): WebGL2 engine (fragment-shader-based simulation, texture particle store, GL2 resources, spatial grid)

### Engine selection and lifecycle

- Top-level [`Engine`](../packages/core/src/engine.ts) constructs [`WebGPUEngine`](../packages/core/src/runtimes/webgpu/engine.ts), [`WebGL2Engine`](../packages/core/src/runtimes/webgl2/engine.ts), or [`CPUEngine`](../packages/core/src/runtimes/cpu/engine.ts) based on `runtime`.
- When `runtime === "auto"`, initialization attempts WebGPU first, then WebGL2, then falls back to CPU if all GPU runtimes fail (cleanup is handled, and fallback engines are re-initialized with the same options).
- The selected concrete engine provides all `IEngine` methods; the facade also exposes helpers like pin/unpin and `isSupported(module)`.

### AbstractEngine responsibilities

Shared functionality across all runtimes:

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

Execution order (per frame):

1. Update oscillators and inputs; flush uniform buffers when settings changed
2. Simulation `state` pass (optional), then `apply` (forces), then `constrain` (iterated), then `correct`
3. Rendering: render passes run in declared order; compute passes may read/write the scene texture; fullscreen passes composite
4. Present

Performance considerations:

- `workgroupSize` (default 64) and `maxParticles` are configurable
- dt is clamped to improve stability (`<= 100ms`)
- Neighbor queries depend on `cellSize` and `maxNeighbors`; tune for density

### WebGL2 runtime

Key components (see [`runtimes/webgl2/`](../packages/core/src/runtimes/webgl2/)):

- [`GL2Resources`](../packages/core/src/runtimes/webgl2/gl2-resources.ts): WebGL2 context, texture management, FBO creation, shader compilation
- [`ParticleStore`](../packages/core/src/runtimes/webgl2/particle-store.ts): CPU-side particle array with GPU synchronization via RGBA32F textures
- [`SpacialGrid`](../packages/core/src/runtimes/webgl2/spacial-grid.ts): texture-based grid for neighbor queries (cellIds, sortedIndices, cellRanges)
- [`shaders.ts`](../packages/core/src/runtimes/webgl2/shaders.ts): GLSL shaders for simulation, rendering, grid passes, and neighbor iteration helpers

Architecture overview:

- **Texture-based particle storage**: RGBA32F textures with 3 texels per particle (12 floats total)
  - Texel 0: `[pos.x, pos.y, vel.x, vel.y]`
  - Texel 1: `[accel.x, accel.y, size, mass]`
  - Texel 2: `[color.r, color.g, color.b, color.a]`
- **Ping-pong rendering**: read from current texture, write to "other" texture, swap references
- **Fragment shader simulation**: no compute shaders; all simulation via fullscreen fragment passes

Execution order (per frame):

1. Update oscillators and inputs; read module settings at render time via `readValue()`
2. Grid passes: assign cell IDs → sort (structure only) → build cell ranges
3. Force pass: concatenate module force code, convert WGSL→GLSL, apply forces to acceleration
4. Integration pass: Verlet integration (pos += vel*dt + 0.5*accel*dt², vel += accel*dt), reset acceleration
5. Rendering: render modules in order (Trails first if enabled), scene texture ping-pong, present to canvas

Key differences from WebGPU:

- No storage buffers; all data in textures or uniforms
- Module uniforms use naming convention `u_<moduleName>_<inputName>`
- Force shader dynamically built by concatenating WGSL-style code from enabled modules
- WGSL→GLSL conversion handles: `let`/`var` → local variables, `vec2<f32>` → `vec2`, `select()` → ternary

Performance considerations:

- Bitonic sort is stubbed (uses unsorted indices for functional neighbor queries)
- Grid textures resize when view changes (pan/zoom/resize)
- `EXT_color_buffer_float` extension required for RGBA32F render targets

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
- For force modules, all three runtimes support the lifecycle hooks; render modules contribute render passes
- Arrays are supported and surfaced in WGSL/GLSL via `getLength()` and indexed `getUniform()` access
- Modules implement `webgpu()`, `webgl2()`, and `cpu()` descriptors; WebGL2 uses WGSL-style code converted to GLSL

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
- For WebGL2: add GLSL helpers in `shaders.ts`; extend `convertWGSLtoGLSL()` for new WGSL constructs
- For CPU: ensure compositing and sampling utilities cover your pass
- Update the playground to expose controls for new inputs
- Implement all three runtime descriptors (`webgpu()`, `webgl2()`, `cpu()`) for full platform support

### References

- Authoring: [`module-author-guide.md`](./module-author-guide.md)
- User Guide: [`user-guide.md`](./user-guide.md)
