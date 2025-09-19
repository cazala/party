## WebGPU architecture refactor plan

### Goals

- **Separation of concerns**: split simulation, rendering, particles, grid, modules, and view state.
- **Composable orchestration**: a small top-level orchestrator wiring independent subsystems.
- **Clear APIs**: each subsystem exposes a minimal, intention-revealing surface.
- **Testability**: isolate logic from GPU side-effects where possible.
- **Extensibility**: new modules/passes/backends without touching orchestration code.

### Current issues in `WebGPUParticleSystem`

- **Monolith**: owns canvas/context, resources, modules, render/sim pipelines, grid, view, and the loop.
- **Tight coupling**: particle storage, grid sizing, modules, and passes live in one class.
- **Hard to evolve**: adding a new render module or simulation phase requires reading a large file.

### Proposed architecture

At a high level:

- `Engine` (tiny orchestrator)
  - Wires subsystems, owns lifecycle and the frame loop.
  - Delegates work to `ParticleStore`, `ModuleRegistry`, `SimulationPipeline`, `RenderPipeline`, `GridSystem`, and `ViewController`.
- `GPUResourceManager` (keeps existing `GPUResources` but used purely as a dependency)

Subsystems and responsibilities:

1. `ParticleStore`

- **Responsibility**: CPU representation and GPU synchronization of particles.
- **Owns**: count, max, CPU buffers, write slices/full buffer.
- **API**:
  - `setParticles(list: WebGPUParticle[])`
  - `addParticle(p: WebGPUParticle)`
  - `clear()`
  - `getCount(): number`
  - `syncToGPU(resources: GPUResourceManager)` (called by pipelines as needed)

2. `ModuleRegistry`

- **Responsibility**: module enablement, program building, uniform writers/readers.
- **Owns**: `modules: Module[]`, `program: Program`, module uniform state.
- **API**:
  - `initialize(resources)` → builds program, allocates module uniform buffers
  - `getProgram(): Program`
  - `getUniformWriter(name): (values) => void`
  - `getUniformReader(name): () => Record<string, number>`
  - `getEnabledRenderDescriptors(): RenderModuleDescriptor[]`
  - `writeAllModuleUniforms(resources)` (or granular per-module writes)

3. `SimulationPipeline`

- **Responsibility**: builds and runs compute pipelines for grid + physics.
- **Owns**: pipeline handles and constant parameters (e.g., `workgroupSize`).
- **API**:
  - `initialize(resources, program)` → build layouts and compute pipelines
  - `runPasses(encoder, resources, params)` where `params` includes particle count, grid cell count, workgroup size, constrain iterations

4. `RenderPipeline`

- **Responsibility**: render graph execution and copy-to-canvas.
- **Owns**: fullscreen/compute image pipeline caches, scene ping‑pong textures.
- **API**:
  - `ensureTargets(resources, width, height)`
  - `runPasses(encoder, descriptors, program, resources, viewSize, particleCount): GPUTextureView` (wraps `runRenderPasses`)
  - `present(encoder, resources, sourceView?)` (copy pass)

5. `GridSystem`

- **Responsibility**: grid sizing and GPU storage; writing grid uniforms.
- **Owns**: computed grid dimensions, max per cell, device buffers tied to grid.
- **API**:
  - `configure(view: ViewSnapshot, resources, program)` → creates storage + writes uniforms
  - `resizeIfNeeded(view: ViewSnapshot, resources, program)`
  - `getCellCount()`

6. `ViewController`

- **Responsibility**: canvas size, camera, zoom, constraints; render uniforms.
- **API**:
  - `setSize(w, h)` / `getSize()`
  - `setCamera(x, y)` / `getCamera()`
  - `setZoom(z)` / `getZoom()` (enforces limits)
  - `getSnapshot(): ViewSnapshot` (width, height, cx, cy, zoom)
  - `writeRenderUniforms(resources)`

7. `Engine`

- **Responsibility**: lifecycle + frame loop; delegates domain work.
- **API**:
  - `initialize()`
  - `play()` / `pause()` / `toggle()`
  - `destroy()`
  - `setSize`, `setCamera`, `setZoom`
  - `setParticles`, `addParticle`, `clear`

### Data flow per frame

1. `Engine` computes `deltaTime` and updates view (`ViewController.writeRenderUniforms`).
2. `GridSystem.resizeIfNeeded(view)` may reallocate grid storage and re‑write grid uniforms.
3. `SimulationPipeline.runPasses(encoder, resources, params)` updates grid and particle state.
4. `RenderPipeline.ensureTargets(width, height)` ensures ping‑pong targets exist.
5. `RenderPipeline.runPasses(...)` executes render modules via `runRenderPasses` and returns the last written scene view.
6. `RenderPipeline.present(encoder, resources, lastView)` copies last scene to the canvas.
7. Queue submit.

### Lifecycle

- `Engine.initialize()`:
  - `resources.initialize()` and core buffer allocations.
  - `ModuleRegistry.initialize(resources)` → builds `Program` and module uniform buffers.
  - `SimulationPipeline.initialize(resources, program)`.
  - `RenderPipeline.ensureTargets(size)`.
  - `GridSystem.configure(view, resources, program)`.
  - Attach per‑module uniform writers/readers through `ModuleRegistry`.

### Responsibilities matrix (quick reference)

- **Engine**: loop + coordination
- **GPUResourceManager**: device, pipelines, buffers (existing)
- **ParticleStore**: particle CPU data + GPU writes
- **ModuleRegistry**: modules, program, uniform state
- **SimulationPipeline**: compute phases
- **RenderPipeline**: render phases + present
- **GridSystem**: grid math + storage + uniforms
- **ViewController**: size/camera/zoom + render uniforms

### API sketch (TypeScript)

```ts
class Engine {
  constructor(canvas: HTMLCanvasElement, modules: Module[]) {}
  initialize(): Promise<void> {}
  play(): void {}
  pause(): void {}
  toggle(): void {}
  destroy(): void {}
  setSize(w: number, h: number): void {}
  setCamera(x: number, y: number): void {}
  setZoom(z: number): void {}
  setParticles(p: WebGPUParticle[]): void {}
  addParticle(p: WebGPUParticle): void {}
}
```

Internally, `Engine` composes:

```ts
class Engine {
  private resources: GPUResourceManager;
  private particles: ParticleStore;
  private modules: ModuleRegistry;
  private sim: SimulationPipeline;
  private render: RenderPipeline;
  private grid: GridSystem;
  private view: ViewController;
}
```

### Migration plan

1. Implement new subsystems (no backwards compatibility during development):
   - `ViewController`, `ParticleStore`, `ModuleRegistry`, `GridSystem`, `SimulationPipeline`, `RenderPipeline`.
   - Follow the APIs defined above;
2. Implement `Engine` that composes all subsystems and wires lifecycle + frame loop.
   - Implement per-frame flow (view uniforms → grid resize → simulation → render → present).
   - Provide convenience methods: `setParticles`, `addParticle`, `clear`, `setSize`, `setCamera`, `setZoom`, `play/pause/toggle`.
3. Replace playground integration:
   - Swap `WebGPUParticleSystem` usage with `Engine` and update imports/types.
   - Remove adaptation/shims; update controls to call `Engine` methods directly.
4. Remove legacy:
   - Delete `WebGPUParticleSystem` and any dead code paths; migrate useful helpers into subsystems.
   - Update docs and examples to reference `Engine` and new subsystems.

### Notes on render DSL and pipeline caches

- `RenderPipeline` owns pipeline caches and uses the DSL builders to generate WGSL per pass (already handled in builder files).
- `ModuleRegistry` provides `program.layouts` and module uniform buffers for both pipelines.
