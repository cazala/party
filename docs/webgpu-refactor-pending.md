### WebGPU Architecture Refactor – Pending Tasks

This document tracks remaining work to complete the refactor described in `docs/webgpu-architecture-refactor.md`.

### Completed (high-level)

- Descriptors split: `shaders/descriptors.ts` created; `ModuleDescriptor`/roles centralized.
- Codegen builders:
  - `builder/compute-builder.ts` builds compute WGSL and uniform layouts.
  - `builder/render-dsl-builder.ts` generates WGSL for fullscreen and image compute passes.
  - `builder/wgsl-templates.ts` holds shared WGSL snippets.
- Runtime:
  - `runtime/gpu-resources.ts` manages buffers, scene textures, bind group layouts, and now builds/caches compute/render pipelines and compute bind groups.
  - `runtime/simulation-runner.ts` orchestrates physics dispatch.
  - `runtime/render-graph-runner.ts` executes render passes via an executor.
- Engine/Renderer:
  - `engine/WebGPUEngine.ts` builds compute program, allocates resources, and builds compute layouts/pipelines once.
  - `WebGPUParticleSystem` slimmed to a thin orchestrator; uses runners, builders, and `GPUResources` for pipelines and bind groups.
  - `WebGPURenderer.setSize` calls system `resize`; grid/scene textures update correctly.
- Copy-to-canvas: moved into `GPUResources.getCopyPipeline` with caching.
- Pipeline caching: fullscreen and image compute pipelines cached in `GPUResources` (hash-based keys).

### Pending Tasks

1. Finalize Engine-first Public API

- [ ] Promote `WebGPUEngine` as the primary public API for headless control (particles CRUD, uniforms, step, resize), and make `WebGPURenderer` compose an engine instance.
- [ ] Provide a migration layer or wrapper to phase out direct usage of `WebGPUParticleSystem` (keep temporarily for compatibility, marked deprecated).
- [ ] Update playground to construct `WebGPUEngine` + `WebGPURenderer` explicitly and stop depending on `WebGPUParticleSystem`.

2. Render Graph Integration Cleanup

- [ ] Move per-pass WGSL assembly selection from `WebGPUParticleSystem` into a render execution utility (e.g., `runtime/render-graph-runner.ts` variant) so the system no longer embeds WGSL assembly logic; it should only pass descriptors and receive pipelines/bind groups.
- [ ] Prebuild and cache render-pass pipelines (fullscreen/compute) per module+pass in `GPUResources`, keyed by module name + pass signature (includes uniform layout hash and pass body hash).
- [ ] Ensure `RenderExecutor` usage is internalized so the system merely triggers “run render graph” on precompiled pipelines.

3. Uniforms and Layouts

- [ ] Centralize any remaining uniform struct declarations for render passes in builder helpers; ensure `GPUResources` does not need to embed any WGSL snippets beyond entry signatures.
- [ ] Ensure consistent use of `RenderPassKind` enum at call sites (replace string literals like "fullscreen"/"compute" where possible).
- [ ] Validate that uniform packing from `compute-builder` is the single source-of-truth (no duplicate packing paths).

4. Resource Ownership & Lifecycle

- [ ] Finish removing remaining buffer/layout/pipeline concerns from `WebGPUParticleSystem` (fields or methods that are now provided by `GPUResources`).
- [ ] Ensure `GPUResources.resize` flow updates any dependent bind groups if/when required (scene texture bindings, grid buffers, etc.).
- [ ] Add a `dispose()` on `GPUResources` to destroy all buffers/textures/pipelines when tearing down the engine.

5. Cleanup and Dead Code

- [ ] Remove `runtime/pipeline-cache.ts` if no longer used anywhere.
- [ ] Audit imports: remove any stale imports from `WebGPUParticleSystem` and other modules.
- [ ] Ensure all modules/shaders under `shaders/modules/*` import from `descriptors.ts` (no direct coupling to old `compute.ts`).

6. Docs & Examples

- [ ] Update `docs/` with an overview of the new 5-layer architecture, including diagrams and data flow.
- [ ] Update playground and examples (Trails + ParticleRenderer) to confirm no functional regressions.
- [ ] Add a short "Migration" section for users of the old API (what changed, how to upgrade).

7. QA & Performance

- [ ] Validate performance is equal or better after pipeline caching (compare FPS and GPU time before/after).
- [ ] Add sanity checks and small unit/integration tests for builder outputs (uniform layout counts, entrypoint presence).
- [ ] Add guardrails for large grid sizes (OOM prevention) and assert meaningful errors.

### Nice-to-haves (post-refactor)

- [ ] Offline pipeline compilation/caching toggle to avoid runtime stutters during the first frame.
- [ ] Optional pipeline cache persistence across sessions (behind a feature flag).
- [ ] Telemetry hooks for debug overlays (counts, timings, pass order).
