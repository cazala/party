# Spec: Add WebGL2 runtime fallback (WebGPU → WebGL2 → CPU)

## Status

- **Owner**: TBD
- **Last updated**: 2026-01-08
- **Target release**: TBD (recommend: minor release if API remains backward compatible)

## Summary

When `WebGPU` is not available (or fails to initialize), the engine should **prefer WebGL2** before falling back to the CPU runtime. Today, `runtime: "auto"` tries WebGPU and falls back directly to CPU. This spec introduces a **third runtime** (`"webgl2"`) and updates the runtime selection, module contracts, docs, and the playground accordingly.

The core constraint is that `@packages/core` is built around:

- **CPU runtime**: simulation + rendering are executed in TypeScript and Canvas2D.
- **WebGPU runtime**: simulation + rendering are executed in WGSL via compute + render pipelines.

WebGL2 can do fast rendering everywhere, but “general compute” is awkward (no compute shaders, limited atomics, no SSBOs). However, if the goal is **meaningful speedups vs CPU**, WebGL2 must also run the **simulation** on the GPU.

This spec therefore targets a **true WebGL2 GPU-simulation runtime**:

- **WebGL2 runtime = GPU simulation + GPU rendering** implemented via “compute-by-rendering” (render-to-texture ping-pong).
- **CPU runtime** remains the universal fallback.
- For practicality, the roadmap is phased: start with GPU state + integration + a few forces, then implement neighbor queries (grid/sort), then port all modules.

## Goals

- **G1**: Add a new supported runtime: `"webgl2"`.
- **G2**: Update `runtime: "auto"` selection order to:
  - **try WebGPU first**, then **WebGL2**, then **CPU**.
- **G3**: Ensure **all built-in modules** remain functional under `"webgl2"` **and execute on the GPU** (simulation + render), with acceptable parity vs WebGPU.
- **G4**: Deliver a **real performance win** vs CPU for particle counts where CPU becomes the bottleneck.
- **G5**: Keep the public API as stable as possible; avoid breaking custom modules.
- **G6**: Update documentation and playground UX to reflect the new runtime and fallback path.

## Non-goals (initial release)

- **NG1**: Perfect 1:1 feature/perf parity with WebGPU across all devices and particle counts.
- **NG2**: Perfect visual parity between WebGPU render passes and WebGL2 render passes (acceptable minor differences due to precision, blending, filtering).
- **NG3**: Identical performance across all browsers/devices (we will define minimum capability requirements and clear fallback rules).

## User-facing API changes

### Engine construction (`EngineOptions.runtime`)

Current:

- `runtime: "cpu" | "webgpu" | "auto"`

Proposed:

- `runtime: "cpu" | "webgpu" | "webgl2" | "auto"`

Semantics:

- **"webgpu"**: force WebGPU; throw if initialization fails.
- **"webgl2"**: force WebGL2; throw if WebGL2 init fails or required extensions are missing.
- **"cpu"**: force CPU.
- **"auto"**: attempt **WebGPU**, then **WebGL2**, then **CPU**.

### Engine runtime introspection

Current:

- `engine.getActualRuntime(): "cpu" | "webgpu"`

Proposed:

- `engine.getActualRuntime(): "cpu" | "webgpu" | "webgl2"`

### Module support checks

Current:

- `engine.isSupported(module)` checks `module.webgpu()` or `module.cpu()` (and treats thrown errors as “unsupported”).

Proposed:

- When actual runtime is `"webgl2"`, `engine.isSupported(module)` should check `module.webgl2()` (see “Module contract changes”).

### Optional: runtime capability query (recommended)

Add a small helper to enable better UX:

- `Engine.getRuntimeCapabilities(): { webgpu: boolean; webgl2: boolean; cpu: true; reason?: string }`

This can be added without breaking changes and used by the playground to show meaningful banners. If not added, the playground can continue to infer from `getActualRuntime()` post-initialize.

## Runtime selection behavior

### Detection

Define synchronous checks:

- **WebGPU availability**: `typeof navigator !== "undefined" && !!navigator.gpu`
- **WebGL2 availability**: `canvas.getContext("webgl2", ...) != null` (or use an OffscreenCanvas if desired)

Important: “available” must also include “meets minimum capability requirements” (see WebGL2 requirements below). If requirements are not met, treat WebGL2 as unavailable and fall back to CPU.

### Selection algorithm (pseudo-code)

```
if runtime === "cpu": use CPUEngine
if runtime === "webgl2": use WebGL2Engine
if runtime === "webgpu": use WebGPUEngine

if runtime === "auto":
  try WebGPUEngine.initialize()
    if success: actualRuntime = "webgpu"
    else:
      try WebGL2Engine.initialize()
        if success: actualRuntime = "webgl2"
        else:
          actualRuntime = "cpu"
          CPUEngine.initialize()
```

Implementation detail:

- Initialization failures should **clean up** partially created resources before falling back (mirroring current WebGPU→CPU logic).
- Console logging should clearly state which runtime was attempted and which fallback was selected.

## Core architecture changes (`@packages/core`)

### Add a new runtime folder

Add:

- `packages/core/src/runtimes/webgl2/`
  - `engine.ts` (main WebGL2 engine implementation)
  - `gl-resources.ts` (context + shader + texture + FBO + buffer management)
  - `render-pipeline.ts` (execute WebGL2 render passes with ping-pong targets)
  - `particle-uploader.ts` (upload particle data to GPU buffers/textures per frame)
  - `scene-readback.ts` (optional but needed for Sensors; see below)
  - `shaders/*` (shared GLSL sources, helper chunks)

Keep the CPU runtime unchanged.

### WebGL2Engine design (MVP)

**Key decision**: WebGL2Engine runs **simulation on the GPU** using render-to-texture (RTT) passes that update particle state textures (or transform feedback buffers).

That means:

- `WebGL2Engine` extends `AbstractEngine`.
- The “simulation phases” (`state/apply/integrate/constrain/correct`) are executed as WebGL2 passes that update GPU particle state.
- CPU can still be used for orchestration (inputs, UI, oscillators), but the particle loop should not run in JS for performance.

#### WebGL2Engine responsibilities

- **Initialize**
  - Acquire `WebGL2RenderingContext`
  - Allocate particle state storage on GPU (textures or buffers) and seed from CPU particle data
  - Create/resize scene render targets (textures + FBOs) for ping-pong rendering (like WebGPU’s scene textures)
  - Create GL programs needed for simulation passes + built-in render modules (Particles/Lines/Trails) and any shared full-screen blit/copy program
  - Attach module uniform writers/readers; upload module inputs to GPU each frame (UBOs/textures)
  - Validate required WebGL2 extensions/capabilities; fail fast if missing
- **Per frame**
  - If playing:
    - Update oscillators (`AbstractEngine` already does this)
    - Run simulation phases on GPU (state/apply/integrate/constrain/correct), updating particle state ping-pong
  - Execute WebGL2 render passes into scene ping-pong targets
  - Execute WebGL2 render passes into scene ping-pong targets
  - Present final texture to the canvas
  - Maintain FPS estimate via `AbstractEngine.updateFPS()`
- **Resize**
  - On `setSize`, resize GL viewport and recreate scene textures/FBOs if needed
- **Destroy**
  - Delete GL programs, buffers, textures, and framebuffers; detach references

### WebGL2 simulation architecture (GPU)

WebGL2 has no compute shaders, so we treat simulation as **a sequence of fullscreen draws** into floating-point textures (or transform feedback). The most compatible path for complex kernels is **RTT textures + FBO ping-pong**.

#### Particle state layout

Represent \(N\) particles in a 2D texture atlas of size \(W \times H\) where \(W \cdot H \ge N\). Each particle maps to texel index `pid` ↔ `(x = pid % W, y = pid / W)`.

Recommended MRT attachments (float where possible):

- `stateA0`: position.xy, velocity.xy
- `stateA1`: acceleration.xy, size, mass
- `stateA2`: color.rgba (or pack into normalized RGBA8 if needed)

Ping-pong: `A` → `B` each phase or per-step, similar to WebGPU buffers.

#### Simulation passes

Define GLSL “kernels” that execute per particle:

- **State pass**: optional, writes per-particle auxiliary state needed by later passes (e.g., fluid densities). If large auxiliary state is required, store in separate textures (ping-pong or single).
- **Apply pass**: computes acceleration/velocity deltas from enabled force modules.
- **Integrate pass**: velocity + position integration; reset acceleration.
- **Constrain pass** (iterated): positional constraints (boundary, collisions, joints, etc.).
- **Correct pass**: post-integration velocity correction (mirrors CPU/WebGPU semantics).

To preserve current engine semantics, keep the same phase ordering and per-frame constrain iteration loop.

#### The neighbor-query problem (grid/sort)

Several modules depend on “neighbor queries” via the spatial grid (collisions/behavior/fluids/joints). WebGL2 lacks atomics/SSBOs, so we cannot directly build linked lists like WebGPU.

The practical GPU approach is:

1. **Compute a cell key** per particle: `cellId = morton2D(floor(pos/cellSize))` (or linear grid id).
2. **Sort particles by cellId** entirely on GPU (bitonic sort network over textures).
3. Build a **cell range table**: for each cell, store `[start,end)` indices into the sorted particle list.
4. For each particle, to iterate neighbors:
   - compute neighboring cellIds (3×3 or 5×5 region)
   - for each cell, scan `sortedIndex ∈ [start,end)` and test actual distance/radius
   - stop at `maxNeighbors`

This matches the conceptual model of the existing grid iterator and makes it possible to port current WGSL logic to GLSL.

Costs/constraints:

- Sorting is \(O(N \log^2 N)\) (bitonic), heavy but feasible for mid-sized \(N\) on GPU.
- Cell table size depends on view/world extents; may be capped and/or derived from camera bounds similarly to current `SpacialGrid`.

#### What about transform feedback?

Transform feedback can update per-particle state efficiently for **neighbor-free** forces (environment, interaction, boundary) but does not solve neighbor queries. It can be considered as an optimization later, but RTT + sort is the more general plan for feature parity.

### WebGL2 minimum capability requirements

At minimum, MVP needs:

- WebGL2 context available.
- Rendering to textures support:
  - Prefer `EXT_color_buffer_float` for float render targets if required by Trails/blur kernels.
  - Alternatively, allow `RGBA8` targets and do Trails in LDR (lower quality) as a fallback.
- Instanced rendering support (core in WebGL2): `drawArraysInstanced`, `vertexAttribDivisor`.

The engine should have a capability table:

- **Required**:
  - `webgl2` context
  - `OES_texture_float_linear` *optional* (only for nicer filtering; not required if using `texelFetch`)
- **Preferred**:
  - `EXT_color_buffer_float` (enables float scene textures for better Trails quality)

Define behavior:

- If required capabilities missing → **fail WebGL2 initialization** and fall back (auto) or throw (forced).
- If preferred missing → run with reduced quality (documented).

### Uniforms & module inputs under WebGL2

WebGPU uses per-module uniform buffers and a combined array storage buffer. WebGL2 does not have SSBOs (in WebGL2), but does have:

- Uniforms and uniform blocks (UBOs)
- Textures (including 1D-in-2D textures) for large arrays

MVP approach:

- **Scalar inputs**: store in per-module UBO (std140 layout) or pack into a single uniform array, matching the existing “vec4 packing” model used by WebGPU layouts.
- **Array inputs**: store in 1D “array texture”:
  - internal format `R32F` if available; otherwise pack into `RGBA32F` / `RGBA8` with encode/decode.
  - access via `texelFetch(arrayTex, ivec2(i, 0), 0)` style.

The WebGL2 runtime should provide a `WebGL2ModuleRegistry` equivalent that:

- Maintains CPU-side state of module inputs (same as WebGPU registry does)
- Uploads scalar state to UBOs
- Uploads array inputs into array textures

Note: In this plan, WebGL2 must maintain **module uniform/array data on GPU** for both simulation and render phases.

## Module contract changes

### Add `webgl2()` support without breaking custom modules

Today `Module` requires:

- `webgpu(): WebGPUDescriptor`
- `cpu(): CPUDescriptor`

We want to add WebGL2 while minimizing breakage:

- Add a **non-abstract** method `webgl2()` to the base `Module` that **throws** by default:
  - This preserves backward compatibility for third-party modules at compile time.
  - At runtime, `engine.isSupported(module)` can detect missing implementation by catching the thrown error.

Proposed addition in `module.ts`:

- `export type WebGL2Descriptor = WebGL2ForceDescriptor | WebGL2RenderDescriptor;`
- `webgl2(): WebGL2Descriptor { throw new Error("WebGL2 descriptor not implemented"); }`

### Descriptor types

#### Force modules

For WebGL2 GPU simulation, force modules must provide GLSL kernels per phase, analogous to WGSL snippets in WebGPU:

- `export type WebGL2ForceDescriptor = {`
  - `globals?(): string` (GLSL helper functions/constants)
  - `state?(): string`
  - `apply?(): string`
  - `constrain?(): string`
  - `correct?(): string`
  - `states?: readonly StateKeys[]` (optional additional per-particle state textures)
  - `readsScene?: boolean` (for Sensors)
`}`

To reduce author burden, we should provide a **migration utility**:

- Built-in modules get hand-written GLSL versions.
- Third-party modules can initially remain CPU/WebGPU only; `Engine.isSupported()` will report unsupported for `webgl2` until they implement `webgl2()`.

#### Render modules

Define a WebGL2 render descriptor that mirrors the existing WebGPU render pass abstraction, but uses GLSL ES 3.0:

- `WebGL2RenderDescriptor = { passes: WebGL2RenderPass[] }`

Where `WebGL2RenderPass` supports:

- **Fullscreen pass**: render a quad into the current scene texture
- **Compute-like pass**: implemented as a fullscreen fragment shader pass that reads `currentScene` and writes to `otherScene` (FBO ping-pong)
- **Instanced pass**: draw instanced quads (Particles, Lines) using instancing + per-instance attributes (or texture-based indexing)

Recommended shape (example, not final API):

- `kind: "fullscreen" | "compute" | "instanced"`
- `vertexGLSL?: string | (helpers) => string`
- `fragmentGLSL: string | (helpers) => string`
- `bindings: (keyof Inputs)[]` (to declare which module inputs must be bound/uploaded)
- `readsScene?: boolean`
- `writesScene?: true`
- `instanced?: boolean`
- `instanceFrom?: keyof Inputs` (same semantics as WebGPU: count driven by array length)

### Update built-in modules (all modules)

Each built-in module in `packages/core/src/modules/**` must override `webgl2()`:

- **Force modules** (`environment`, `boundary`, `collisions`, `behavior`, `fluids`, `sensors`, `interaction`, `joints`, `grab`):
  - Implement `webgl2()` by returning **GLSL phase kernels** (`state/apply/constrain/correct`) that operate on the WebGL2 particle state textures/buffers.
  - Neighbor-based modules must use the WebGL2 neighbor iterator utilities (grid/sort ranges) to match current semantics.
- **Render modules** (`particles`, `lines`, `trails`):
  - Implement `webgl2()` returning `WebGL2RenderDescriptor` using GLSL passes.

This satisfies the requirement “add it to all modules” while meeting the performance goal (GPU simulation).

## Sensors under WebGL2 (scene sampling)

`Sensors` relies on sampling the “scene” to steer particles. In CPU runtime, it uses Canvas2D `getImageData()`. In WebGPU runtime, it samples the GPU scene texture.

In WebGL2 runtime (GPU simulation), `Sensors.webgl2()` should sample the WebGL2 scene texture **directly in the shader**, matching the WebGPU approach:

### Requirements

- WebGL2 render pipeline must expose the “current scene” as a sampler2D to simulation passes that set `readsScene: true`.
- Define a shared helper for world→scene UV mapping consistent with WebGPU (`View` uniforms: camera, zoom, canvas size).

### Optional fallback (not preferred)

If a device cannot support the required scene texture formats, `Sensors` may be marked unsupported in `webgl2` and `runtime: "auto"` should then fall back to CPU (or users disable Sensors). Avoid `gl.readPixels()`-based CPU readback in the default WebGL2 runtime, as it defeats the performance goal.

## Playground changes (`@packages/playground`)

Update UX to reflect the new runtime:

- **Runtime selection controls**: add `"webgl2"` to any runtime dropdowns.
- **Fallback banners**:
  - Current: `WebGPUFallbackBanner`
  - Proposed: either generalize to `RuntimeFallbackBanner` or add a second banner:
    - WebGPU → WebGL2 fallback
    - WebGL2 → CPU fallback
- **Capabilities reporting**:
  - Show `getActualRuntime()` and optionally `getRuntimeCapabilities()`.
  - When auto selects WebGL2, communicate that it is **GPU simulation + GPU rendering** (WebGPU-like phases implemented via RTT).

## Documentation updates (`@docs` + core README)

Update all places that mention “dual runtime” / “auto fallback to CPU”:

- `docs/user-guide.md`
  - Update runtime selection section: **auto = WebGPU → WebGL2 → CPU**
  - Add a short section describing what WebGL2 runtime means (GPU sim + GPU render, implemented via WebGL2 RTT)
  - Update `getActualRuntime()` return type and examples
- `docs/module-author-guide.md`
  - Introduce `webgl2()` and `WebGL2Descriptor`
  - Provide guidance:
    - Force modules: provide GLSL phase kernels; note neighbor-iteration constraints
    - Render modules: provide GLSL passes (examples from built-ins)
  - Update “supporting both runtimes” → “supporting all runtimes”
- `docs/maintainer-guide.md`
  - Add `runtimes/webgl2/*` architecture and how it parallels CPU/WebGPU
  - Document WebGL2 scene sampling (GPU texture access) and capability fallbacks
- `packages/core/README.md`
  - Update “Dual Runtime” → “Multi-runtime (WebGPU/WebGL2/CPU)”
  - Update browser support section

## Implementation roadmap

### Phase 0 — Design + scaffolding (1–2 days)

- Add runtime enum/union changes in `EngineOptions` and `getActualRuntime()`.
- Add detection helpers.
- Add `webgl2()` method + descriptor types in `module.ts` (default throws).
- Update `Engine.isSupported()` to use `webgl2()` when applicable.
- Add empty `WebGL2Engine` that can initialize, clear, present a blank frame.

Deliverable:

- `runtime: "webgl2"` compiles and can initialize on capable browsers (renders clear color).

### Phase 1 — WebGL2 GPU particle store + integration (3–7 days)

- Implement `gl-resources`:
  - context init, shader compile/link, program caching
  - particle state textures (float where possible) + FBO ping-pong
  - scene textures + FBO ping-pong (render pipeline)
  - full-screen blit to canvas
- Implement `particle-store` utilities:
  - CPU→GPU seeding from `setParticles()`
  - GPU→CPU readback for `getParticles()/getParticle()` (slow path; not per-frame)
- Implement simulation passes:
  - `integrate` pass (velocity/position update; accel reset)
  - per-frame uniforms (dt, count, maxSize, iteration, maxNeighbors, maxParticles)

Deliverable:

- WebGL2 runtime can simulate and render “no forces” correctly (particles move with initial velocity), with stable ping-pong and resize.

### Phase 2 — Basic force modules on GPU (3–10 days)

- Implement GLSL versions (webgl2 descriptors) for forces that do not need neighbor queries:
  - `Environment`, `Interaction`, `Boundary`, `Grab` (and any simple clamps)
- Ensure phase ordering matches WebGPU: state→apply→integrate→constrain×N→correct
- Implement `Particles.webgl2()` render pass (instanced quads reading particle state textures)

Deliverable:

- WebGL2 runtime shows clear performance gains vs CPU for medium particle counts, with core forces working.

### Phase 3 — Neighbor infrastructure (grid + sort) (1–3+ weeks)

- Implement GPU cellId computation pass.
- Implement GPU sorting of `(cellId, particleId)` (bitonic sort over textures).
- Implement cell range table build pass (store start/end for each populated cell).
- Implement GLSL neighbor iterator helpers that mirror current WGSL usage patterns, honoring `maxNeighbors`.

Deliverable:

- WebGL2 runtime supports neighbor iteration in shaders with acceptable performance on target devices.

### Phase 4 — Port neighbor-based modules (1–4+ weeks)

- Implement GLSL ports for:
  - `Collisions`, `Behavior`, `Fluids`, `Joints`, `Sensors`
- Validate parity vs WebGPU and CPU (within defined tolerance).

Deliverable:

- All built-in force modules run on WebGL2 GPU simulation.

### Phase 5 — Complete render modules + polish (3–10 days)

- Implement `Lines.webgl2()` render pass.
- Implement `Trails.webgl2()` decay/diffuse passes (fullscreen ping-pong).
- Ensure render ordering and scene ping-pong semantics match WebGPU.

Deliverable:

- All built-in render modules run under WebGL2.

### Phase 6 — Auto fallback + docs + playground (1–4 days)

- Update `runtime: "auto"` fallback order: WebGPU → WebGL2 → CPU
- Update playground UI and banners
- Update docs and README
- Add a small compatibility note section and troubleshooting tips

Deliverable:

- End-to-end user experience: “auto” selects WebGL2 on non-WebGPU browsers, runs reliably.

### Phase 7 — Performance tuning + optional enhancements (ongoing)

- Reduce pipeline count and texture bandwidth (pack state, minimize MRT)
- Optimize sort/grid passes (tile-based sort, reduce precision where safe)
- Optional: hybrid paths (transform feedback for some phases), device-specific tuning

## Testing plan

### Automated (unit/integration)

- **Runtime selection**
  - When `navigator.gpu` missing and WebGL2 available → `auto` picks WebGL2
  - When WebGL2 init fails → `auto` falls back to CPU
  - When forced runtime fails → throws (no silent fallback)
- **Module support**
  - `Engine.isSupported()` returns true/false correctly for each runtime
- **Serialization**
  - `export()/import()` works the same across runtimes (module inputs + enabled)

### Manual / playground smoke tests

- Verify Particles/Lines/Trails visuals under each runtime.
- Verify Sensors behavior under WebGL2 with and without Trails enabled.
- Verify resizing works (canvas resize, device pixel ratio, zoom/camera changes).
- Verify mobile Safari/Chrome behavior (WebGL2 availability, performance).

## Acceptance criteria

- **AC1**: `runtime: "auto"` attempts WebGPU, then WebGL2, then CPU, with correct logging and cleanup.
- **AC2**: `runtime: "webgl2"` is a first-class option and initializes reliably on WebGL2-capable browsers.
- **AC3**: `engine.getActualRuntime()` includes `"webgl2"` and is accurate.
- **AC4**: All built-in modules have a `webgl2()` implementation and function under `"webgl2"`.
- **AC5**: Docs and playground correctly describe and demonstrate the new runtime and fallback logic.

## Risks & mitigations

- **GPU readback stalls (Sensors)**:
  - Mitigate with downsample + throttle; allow disabling if needed.
- **WebGL2 float texture support variance**:
  - Prefer RGBA8 fallback for scene textures; document reduced quality.
- **Precision differences vs WebGPU**:
  - Accept minor differences; keep CPU physics identical in MVP.
- **API creep / breaking third-party modules**:
  - Keep `webgl2()` non-abstract with default throw; update docs on how to add WebGL2 support progressively.

