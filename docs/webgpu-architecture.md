## WebGPU architecture (maintainers)

This document explains how the WebGPU framework in `packages/core/src/modules/webgpu/` works, how the pieces fit together, and what to watch for when evolving the architecture.

### High-level components

- **Engine**: top-level orchestrator. Initializes GPU, builds the program from modules, configures pipelines, runs the animation loop, and presents frames.
- **GPUResources**: owns the WebGPU device/context, buffers, textures, bind group layouts, and pipeline caches. Provides helpers to create bind groups and write data.
- **ModuleRegistry**: takes a list of `Module` instances, generates a single WGSL program (compute) via the builders, allocates per-module uniform buffers, and wires uniform writers/readers for each module.
- **Builders**:
  - `module-builder.ts`: builds the compute WGSL program by packing module uniforms, composing global helpers, generating force functions (state/apply/constrain/correct), defining simulation entrypoints, and assigning extra bind group bindings.
  - `render-pass-builder.ts`: builds WGSL for render modules, either fullscreen (raster) or image-compute.
- **Pipelines**:
  - `SimulationPipeline`: builds compute pipeline layouts/pipelines from the generated program and runs available passes each frame.
  - `RenderPipeline`: manages ping-pong scene textures and executes render passes from enabled render modules (fullscreen or compute) and presents the final texture to the canvas.
- **Systems**:
  - `GridSystem`: computes grid extents from the current view, allocates grid storage buffers, and writes uniforms to the `grid` system module.
  - `ViewController`: tracks canvas width/height, camera, and zoom; writes render uniforms.
  - `ParticleStore`: CPU-side packed `Float32Array` for particle attributes; syncs to GPU storage buffer.

### Frame lifecycle (CPU → GPU)

1. Engine computes `dt`, smooths FPS estimate.
2. View uniforms (canvas size, camera, zoom) are written.
3. GridSystem `resizeIfNeeded(...)` keeps grid uniforms/storage in sync with view.
4. Simulation uniforms (`dt`, `count`) are updated through the `simulation` module writer.
5. CommandEncoder is created; SimulationPipeline runs compute passes; RenderPipeline runs render passes; final scene is presented.

### Program generation (compute)

`ModuleRegistry.initialize(resources)` calls `buildProgram(modules)` which produces:

- **Packed per-module uniforms**: Each module’s `bindings` become fields in `Uniforms_<ModuleName>`. Fields are packed into `vec4<f32>` rows and are mapped by name to flat indices. `ModuleRegistry` mirrors CPU uniform state and writes `Float32Array` payloads into dedicated per-module uniform buffers.
- **Extra bindings (`Program.extraBindings`)**: Additional resources in the compute bind group:
  - `grid`: counts/indices storage for spatial hashing
  - `simState`: shared `SIM_STATE` storage buffer (per-particle, per-slot)
  - `sceneTexture`: 2D texture for read-only sampling in compute (e.g., sensors)
- **System globals/entrypoints**: System modules (e.g., `simulation`, `grid`) can emit global WGSL helpers (uniform accessors, iterator helpers) and compute entrypoints (`grid_clear`, `grid_build`).
- **Force functions**: For each force module, any of `state`, `apply`, `constrain`, `correct` hooks are turned into WGSL functions gated by the module’s `enabled` uniform. The simulation passes call these functions in sequence where available.
- **Passes**:
  - `state_pass` → per-particle state precomputation into `SIM_STATE`
  - `apply_pass` → accumulate forces/accelerations
  - `integrate_pass` → integrate velocity/position; store previous/current positions into `SIM_STATE`
  - `constrain_pass` → constraints (iterated `DEFAULTS.constrainIterations` times)
  - `correct_pass` → velocity correction to remove numerical artifacts
  - `main` → fallback no-op when specialized passes are not provided

The `SimulationPipeline` builds compute layouts (bind group layout, pipeline layout) from `Program` and creates pipelines for any entrypoints present. At runtime, it binds the single compute bind group (particles + all module uniform buffers + any extra bindings) and dispatches the configured passes.

### Render pipeline and ping-pong

- `GPUResources.ensureSceneTextures()` maintains two `rgba8unorm` scene textures A/B and a sampler. `RenderPipeline.runPasses()` maintains a pair of `currentView`/`otherView` and a flag for whether anything has written the scene.
- **Fullscreen pass**: Generates a WGSL vertex + fragment program. Vertex is either instanced (per-particle) or non-instanced. Bindings: particle storage, render uniforms, `scene_texture` + `scene_sampler`, and the module’s uniform buffer.
- **Compute image pass**: Generates a WGSL program with `input_texture` and `output_texture` plus the module uniform buffer. Passes that write the scene cause a ping-pong swap.
- After all render passes, `RenderPipeline.present()` copies the chosen scene view to the canvas using a cached copy pipeline.

### Spatial grid

- `GridSystem` derives world extents from `ViewController` (camera/zoom) and writes them to the `grid` module’s uniform buffer. It also sizes storage for grid counts and indices, used by `grid_build` to populate per-cell particle indices.
- `grid.ts` (system module) defines helpers like `neighbor_iter_init/next` to iterate neighbors in a radius and wraps the grid clear/build entrypoints.

### Particle storage format

`ParticleStore` packs each particle as 12 floats (pos2, vel2, accel2, size, mass, color4). CPU writes active slices to the GPU particle buffer via `GPUResources.writeParticleBuffer`.

### Pipeline caching and hashing

- `GPUResources` caches pipelines:
  - copy pipelines keyed by canvas format
  - fullscreen pipelines keyed by WGSL hash
  - image compute pipelines keyed by WGSL hash
- The WGSL hash is a simple djb2 variant to avoid re-creating identical pipelines.

### Error handling and lifecycle

- `GPUResources.initialize()` guards missing support and sets up the canvas.
- All `get*` methods validate initialization and throw informative errors.
- `Engine.destroy()` disposes GPU resources; internal caches and buffers are cleaned up.

### Adding or modifying system modules (internal)

- Define `descriptor()` with `role: ModuleRole.System` and `bindings` for uniforms.
- Use `global({ getUniform })` to emit helper functions accessible to all compute code.
- Optionally provide `entrypoints()` returning WGSL for specialized compute passes (e.g., grid build/clear). The builder will auto-detect and create pipelines for them if present.
- When adding new global resources, extend `Program.extraBindings` and update `GPUResources.buildComputeLayouts()` to add matching bind group entries.

### Performance considerations

- Workgroup size defaults to `DEFAULTS.workgroupSize` for particle passes and 8×8 for image compute; adjust if you tune for device limits.
- `constrain_pass` iterations default to `DEFAULTS.constrainIterations` (trade realism vs speed).
- Keep WGSL branchless where possible; avoid unbounded loops.
- Use `mass == 0` convention to mark culled/pinned particles.
