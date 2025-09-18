### WebGPU Architecture Refactor Plan

Goal: simplify and clarify responsibilities across the WebGPU codebase by separating concerns (descriptors, codegen, runtime, rendering, and app-facing API). Reduce duplication, remove legacy layering from the CPU era, and make it easy to plug new system/force/render modules without touching the core.

---

### Problems in the current layout

- Types + builders + role descriptors live together (`compute.ts`), mixing concerns with codegen and enums.
- `WebGPUParticleSystem` contains both simulation orchestration and render-graph responsibilities, plus shader assembly specifics.
- `WebGPURenderer` is a thin wrapper with view/camera/loop, but many methods are pass-throughs to the system, making the split unintuitive.
- Shader scaffolding and codegen snippets are embedded in multiple places (system, particle system), violating DRY.

---

### High-level design

Introduce a clean separation into five layers:

1. Descriptors & Roles (data-only, no codegen)

- Define module roles and pass descriptors; no WGSL generation here.
- File: `core/shaders/descriptors.ts`
  - `ModuleRole`, `RenderPassKind`
  - `BaseModuleDescriptor<T>`, `SystemModuleDescriptor`, `ForceModuleDescriptor`, `RenderModuleDescriptor`
  - `FullscreenRenderPass`, `ComputeRenderPass`, `RenderPass`

2. Codegen Builders (pure functions)

- Assemble WGSL for the simulation pipelines (state/apply/integrate/etc.).
- Compile helpers needed by system modules (grid/simulation) and expose shared WGSL templates.
- File group: `core/shaders/builder/`
  - `compute-builder.ts`: builds monolithic compute kernel WGSL (current `buildComputeProgram`), returns layouts and extra bindings
  - `wgsl-templates.ts`: particle struct, uniforms, helper snippets (render uniforms, copy shader, etc.)
  - `render-dsl-builder.ts`: converts render DSL (fullscreen/compute hooks) into WGSL entrypoints for the render graph

3. Runtime Resources (WebGPU state, buffers, textures)

- Encapsulate device, pipelines, bind group layouts, buffers, and scene textures.
- Split responsibilities so allocation and resizing are not mixed with orchestration logic.
- File group: `core/runtime/`
  - `gpu-context.ts`: device/context acquisition, canvas format, feature limits
  - `gpu-resources.ts`: particles buffer, module uniform buffers, grid buffers, SIM_STATE, scene textures, samplers
  - `pipeline-cache.ts`: optional cache for created pipelines per pass/module

4. Runners (simulation and render graph)

- Small orchestrators that issue commands on an existing `GPUCommandEncoder` using `gpu-resources` and `builder` outputs.
- File group: `core/runtime/`
  - `simulation-runner.ts`: runs grid_clear/grid_build, state/apply/integrate/constrain/correct
  - `render-graph-runner.ts`: executes render modules in order (compute ping-pong and fullscreen draws), tracks last written scene view

5. Public API: Engine and Renderer

- `WebGPUEngine`: headless engine controlling modules, uniforms, particles, and stepping the simulation. No canvas.
- `WebGPURenderer`: view/camera/time loop + composition UI. Owns the canvas and attaches a `WebGPUEngine` to render. Minimal pass-throughs.
- Files:
  - `core/engine/WebGPUEngine.ts`: replaces most of `WebGPUParticleSystem.ts` (simulation control, particle CRUD, uniform writes, integrate with runners)
  - `core/engine/WebGPURenderer.ts`: event loop, camera, zoom, resize, calls into engine each frame to update+render

---

### Proposed file layout

- `packages/core/src/modules/webgpu/shaders/`
  - `descriptors.ts` (roles, enums, pass types, module descriptors)
  - `builder/compute-builder.ts` (was `buildComputeProgram` from `compute.ts`)
  - `builder/render-dsl-builder.ts` (WGSL generation for render passes)
  - `builder/wgsl-templates.ts` (shared WGSL snippets: Particle, RenderUniforms, copy shader, helpers)
- `packages/core/src/modules/webgpu/runtime/`
  - `gpu-context.ts`
  - `gpu-resources.ts`
  - `pipeline-cache.ts` (optional, behind a simple interface)
  - `simulation-runner.ts`
  - `render-graph-runner.ts`
- `packages/core/src/modules/webgpu/engine/`
  - `WebGPUEngine.ts` (headless; owns resources, builds code with builders, uses runners)
  - `WebGPURenderer.ts` (loop + camera; composes an engine instance)

---

### Responsibilities (before → after)

- `compute.ts`

  - BEFORE: enums, descriptors, uniform packing, codegen building, grid helpers.
  - AFTER: moves to `descriptors.ts` (types+enums only). The codegen and packing logic move to `builder/compute-builder.ts` and `wgsl-templates.ts`.

- `WebGPUParticleSystem.ts`

  - BEFORE: device setup, pipeline layouts, buffers, simulation passes, render graph, scene textures, copy-to-canvas, DSL execution.
  - AFTER: replaced by `WebGPUEngine` (headless). It initializes resources, compiles compute code once, attaches per-module writers/readers, and delegates:
    - to `simulation-runner.ts` for physics passes
    - to `render-graph-runner.ts` for render passes
  - All shader text lives in `builder/` templates; runners just select pipelines and bind resources.

- `WebGPURenderer.ts`
  - BEFORE: thin wrapper around system, camera, zoom, loop
  - AFTER: owns the loop and view. Delegates step/update/render to an injected `WebGPUEngine`. Provides only UX-centric APIs (play/pause, setSize, camera, zoom), no resource knowledge.

---

### Data flow & lifecycles

- Initialization

  1. Renderer creates `gpu-context` (device/context).
  2. Engine created with modules list, receives context; engine uses `compute-builder` to build compute WGSL and `gpu-resources` to allocate buffers/textures.
  3. Engine registers module uniform writers/readers.

- Frame

  1. Renderer ticks: updates camera/zoom/size and calls `engine.step(dt)`.
  2. Engine: writes simulation uniforms; uses `simulation-runner` to dispatch grid+physics; uses `render-graph-runner` to run render modules; finally copies scene texture to canvas.

- Resize

  - Renderer sets new canvas size; engine updates `gpu-resources` (scene textures, grid uniforms) and rebuilds any dependent bind groups.

- Particles API
  - Engine handles particle buffer CRUD (set/add/remove/clear) and simulation uniforms.

---

### DRY & consistency improvements

- Centralize WGSL structs and helpers in `wgsl-templates.ts`.
- Uniform packing is defined once by `compute-builder`, and `render-dsl-builder` references the mapping via `getUniform`.
- Runners never embed WGSL; they operate with pipelines and prepared shaders.
- Render DSL ensures identical binding layouts per pass kind (fullscreen/compute), so runtime doesn’t branch per module.

---

### Migration plan

1. Move descriptor/enums from `compute.ts` → `descriptors.ts`; update imports across modules.
2. Extract `buildComputeProgram` from `compute.ts` → `builder/compute-builder.ts`. Move utility WGSL strings to `wgsl-templates.ts`.
3. Extract the render DSL scaffolding from `WebGPUParticleSystem` → `builder/render-dsl-builder.ts` (keeping current behavior, no functional changes).
4. Create `gpu-context.ts` and `gpu-resources.ts`. Migrate device/format acquisition and resource allocation out of `WebGPUParticleSystem`.
5. Create `simulation-runner.ts` and `render-graph-runner.ts`. Move passes execution logic from `WebGPUParticleSystem`.
6. Introduce `WebGPUEngine.ts` that composes builders, resources, and runners (replacing most of `WebGPUParticleSystem`). Keep the same public particle/uniform APIs.
7. Slim `WebGPURenderer.ts` to a pure loop/camera/resize surface, referencing an engine instance.
8. Delete retired code paths; ensure lints and examples (Trails + ParticleRenderer) run unchanged.

---

### Benefits

- Clear contracts: data (descriptors) vs codegen (builders) vs runtime (resources/runners) vs API (engine/renderer).
- Easier to maintain and test: each layer is small and focused.
- Extensible: new render/system/force modules plug in without touching engine/renderer.
- DRY: single source for WGSL templates and uniform packing.
