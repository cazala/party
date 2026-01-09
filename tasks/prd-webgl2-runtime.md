# PRD: WebGL2 Runtime (GPU Simulation + GPU Rendering) Fallback

## 1. Introduction / Overview

Add a new supported runtime to `@cazala/party`: **WebGL2**. When WebGPU is unavailable (or fails to initialize), `runtime: "auto"` should fall back to **WebGL2** before falling back to **CPU**.

This WebGL2 runtime is intended to be **meaningfully faster than CPU** for simulations where JS becomes the bottleneck. Therefore, WebGL2 must run:

- **Simulation on GPU** (via render-to-texture / “compute by rendering” passes in GLSL ES 3.0).
- **Rendering on GPU** (WebGL2 scene pipeline similar in spirit to WebGPU’s render pipeline).

Reference spec: `docs/webgl2-runtime-spec.md`.

## 2. Goals

- Provide a third runtime option: `runtime: "webgl2"`.
- Update `runtime: "auto"` selection order to: **WebGPU → WebGL2 → CPU**.
- WebGL2 runtime supports **all built-in modules** (forces + render) and executes their core logic **on GPU**.
- Provide clear runtime introspection: `getActualRuntime(): "webgpu" | "webgl2" | "cpu"`.
- Maintain stable public API where feasible (minimal breaking changes for module authors/users).
- Update playground and docs to accurately reflect runtime behavior and fallbacks.

## 3. User Stories

### US-001: Add WebGL2 runtime option to Engine API
**Description:** As a library user, I want to select `runtime: "webgl2"` so I can run the engine on GPUs where WebGPU is unavailable.

**Acceptance Criteria:**
- [ ] `EngineOptions.runtime` type includes `"webgl2"`.
- [ ] `Engine#getActualRuntime()` can return `"webgl2"`.
- [ ] `runtime: "webgl2"` throws a clear error if WebGL2 initialization fails.
- [ ] Typecheck passes

### US-002: Auto runtime selects WebGL2 before CPU
**Description:** As a library user, I want `runtime: "auto"` to try WebGPU first, then WebGL2, then CPU, so I get the best performance my browser supports.

**Acceptance Criteria:**
- [ ] In a WebGPU-disabled environment with WebGL2 available, `runtime: "auto"` selects WebGL2.
- [ ] If WebGL2 initialization fails, `runtime: "auto"` falls back to CPU.
- [ ] Console logs make the fallback chain explicit (attempted + selected).
- [ ] Typecheck passes

### US-003: Implement WebGL2 GPU particle store + ping-pong simulation pipeline
**Description:** As a developer, I want particle state to live on the GPU in WebGL2 so simulation can run without per-particle JS loops.

**Acceptance Criteria:**
- [ ] WebGL2 runtime allocates particle state storage on GPU (textures or buffers) and seeds it from `setParticles()`.
- [ ] A baseline simulation loop exists on GPU: integrate velocity/position, reset acceleration (no forces).
- [ ] `play()/pause()/stop()` work and do not leak GL resources.
- [ ] `setSize()` updates viewport and render targets correctly.
- [ ] Typecheck passes

### US-004: Implement WebGL2 render pipeline and Particles render module
**Description:** As a user, I want to see particles rendered correctly under WebGL2 runtime.

**Acceptance Criteria:**
- [ ] WebGL2 render pipeline supports a scene texture/FBO ping-pong and a final present to canvas.
- [ ] `Particles.webgl2()` renders from the WebGL2 particle store (no CPU draw loop).
- [ ] Rendering respects `clearColor` and module `enabled` state.
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

### US-005: Implement WebGL2 force modules that do not require neighbor queries
**Description:** As a user, I want core forces to work on WebGL2 with real performance gains.

**Acceptance Criteria:**
- [ ] `Environment.webgl2()` implements GPU kernels for relevant phases.
- [ ] `Interaction.webgl2()` implements GPU kernels for attract/repel.
- [ ] `Boundary.webgl2()` implements GPU kernels for bounce/warp/kill/none behavior.
- [ ] `Grab.webgl2()` implements GPU kernels for single-particle grabbing.
- [ ] Behavior is reasonably consistent with existing runtimes (document acceptable differences).
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

### US-006: Add WebGL2 neighbor infrastructure (grid + sort + cell ranges)
**Description:** As a developer, I need a GPU neighbor-iteration primitive in WebGL2 so neighbor-based modules can be ported.

**Acceptance Criteria:**
- [ ] GPU pass computes `cellId` per particle based on view/world grid settings.
- [ ] GPU sorting exists for `(cellId, particleId)` (bitonic or similar), fully on GPU.
- [ ] GPU pass builds a per-cell range table `[start,end)` over the sorted particle list.
- [ ] GLSL helpers expose a neighbor iterator that supports scanning neighboring cells and respects `maxNeighbors`.
- [ ] Typecheck passes

### US-007: Port neighbor-based force modules to WebGL2 GPU simulation
**Description:** As a user, I want collisions/fluids/behavior/joints/sensors to work under WebGL2 with performance comparable to WebGPU on non-WebGPU browsers.

**Acceptance Criteria:**
- [ ] `Collisions.webgl2()` uses the neighbor iterator and applies constraint/correct logic on GPU.
- [ ] `Behavior.webgl2()` uses the neighbor iterator for boids-style steering.
- [ ] `Fluids.webgl2()` uses `state` + `apply` passes on GPU (density/pressure/viscosity).
- [ ] `Joints.webgl2()` supports array inputs (a/b indices, rest lengths, CSR lists) and runs on GPU.
- [ ] `Sensors.webgl2()` samples the scene texture on GPU (no default `readPixels` CPU readback path).
- [ ] Modules respect `enabled` and produce stable results (define tolerance tests or visual checks).
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

### US-008: Implement WebGL2 render modules Lines + Trails
**Description:** As a user, I want WebGL2 rendering parity with the existing built-in render modules.

**Acceptance Criteria:**
- [ ] `Lines.webgl2()` renders line segments based on module array inputs.
- [ ] `Trails.webgl2()` implements decay + diffuse using fullscreen passes and scene ping-pong.
- [ ] Render ordering matches `render[]` array order semantics.
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

### US-009: Update playground UX for WebGL2 + fallbacks
**Description:** As a playground user, I want to see which runtime I’m on and why, and to be able to force WebGL2.

**Acceptance Criteria:**
- [ ] Playground runtime selector includes `"webgl2"`.
- [ ] Fallback banner supports: WebGPU→WebGL2 and WebGL2→CPU.
- [ ] UI displays `getActualRuntime()` result.
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

### US-010: Update docs for WebGL2 runtime
**Description:** As a library user/module author, I need documentation explaining what WebGL2 runtime is, how “auto” behaves, and how to support WebGL2 in custom modules.

**Acceptance Criteria:**
- [ ] `docs/user-guide.md` updated: runtime selection now WebGPU→WebGL2→CPU; examples updated.
- [ ] `docs/module-author-guide.md` updated: add `webgl2()` descriptor guidance and constraints (neighbor infra, arrays, scene sampling).
- [ ] `docs/maintainer-guide.md` updated: document new WebGL2 runtime architecture and key components.
- [ ] `packages/core/README.md` updated: multi-runtime messaging and browser support.
- [ ] Typecheck passes

## 4. Functional Requirements

- **FR-1:** Engine must support `runtime: "webgl2"` as an explicit runtime option.
- **FR-2:** Engine must support `runtime: "auto"` with fallback order **WebGPU → WebGL2 → CPU** and must clean up failed runtime resources before falling back.
- **FR-3:** WebGL2 runtime must maintain particle state on GPU and update it per frame without a per-particle JS loop.
- **FR-4:** WebGL2 runtime must implement simulation phases analogous to current design: `state` (optional) → `apply` → `integrate` → `constrain` (iterated) → `correct`.
- **FR-5:** WebGL2 runtime must support module inputs (scalars + arrays) with GPU upload/binding each frame as needed.
- **FR-6:** WebGL2 runtime must support a neighbor iteration primitive on GPU (grid + sorted ranges) sufficient for collisions/behavior/fluids/joints.
- **FR-7:** WebGL2 runtime must support a scene texture pipeline and expose the scene to:
  - render passes (for Trails)
  - simulation passes that read scene (for Sensors)
- **FR-8:** `Engine.isSupported(module)` must correctly reflect WebGL2 support (via `module.webgl2()`), without breaking existing modules at compile time.
- **FR-9:** Built-in modules must implement `webgl2()`:
  - force modules: GLSL kernels per phase
  - render modules: GLSL passes
- **FR-10:** Playground must allow selecting WebGL2 and must clearly communicate fallbacks.

## 5. Non-Goals (Out of Scope)

- Full WebGPU feature/performance parity on every device and particle count.
- Implementing a general-purpose “shader compiler” from WGSL→GLSL.
- Supporting WebGL1.
- Making `gl.readPixels()` a default dependency for Sensors in WebGL2 runtime.

## 6. Design Considerations (Optional)

- **Playground messaging:** clear, non-scary explanation of “why you’re on WebGL2” when WebGPU isn’t available.
- **Runtime selector UX:** keep `auto` as the default and recommended choice.
- **Fallback banners:** avoid noisy warnings; show concise info + optional “learn more” link to docs.

## 7. Technical Considerations (Optional)

- **GPU storage format:**
  - Prefer float textures (`RGBA16F`/`RGBA32F`) when supported; define fallback strategy if not.
  - Define texture atlas dimensions and particle-id mapping.
- **Precision + determinism:** WebGL2 GLSL precision varies by device; define acceptable tolerances.
- **Neighbor infra complexity:** GPU sort and range table is the major engineering cost and needs careful perf benchmarking.
- **Arrays as textures:** module array inputs (e.g., Lines and Joints) must be accessible from GLSL via texelFetch and known packing.
- **Readback APIs:** `getParticles()`/`getParticle()` under WebGL2 likely require GPU→CPU readback and should be documented as slow compared to CPU runtime.

## 8. Success Metrics

- **Adoption:** % of sessions on non-WebGPU browsers that successfully run with WebGL2 (vs CPU fallback).
- **Performance:** On a representative non-WebGPU browser/device:
  - maintain 60fps at a particle count where CPU runtime is <30fps (define target scenes).
- **Stability:** low crash/black-screen rate; clear fallback logs.
- **Parity:** module behavior within defined tolerances vs CPU/WebGPU for the same scene preset.

## 9. Open Questions (Clarifying Questions)

1. What is the primary success target for WebGL2 performance?
   A. “Be faster than CPU for ~10k particles”
   B. “Be faster than CPU for ~50k particles”
   C. “Be faster than CPU for ~100k particles”
   D. Other: [specify target device + particle count]

2. Which browsers/devices are the key targets for WebGL2 runtime?
   A. iOS Safari (WebGPU absent/limited)
   B. Android Chrome low/mid-range
   C. Desktop Safari (macOS)
   D. Other: [list]

3. What is the acceptable module parity bar for the first WebGL2 release?
   A. All built-in modules must work (even if some are slower)
   B. Only a subset must work initially (list which can be missing)
   C. All must work, but some may be “quality reduced” (e.g., Trails LDR)
   D. Other: [specify]

4. Should `runtime: "auto"` fall back from WebGL2 to CPU if any enabled module is unsupported in WebGL2?
   A. Yes (auto must guarantee “scene runs”)
   B. No (keep WebGL2 runtime and just skip unsupported modules)
   C. Only for critical modules (define list)
   D. Other: [specify]

5. What’s the desired approach for third-party module authors?
   A. Provide a minimal `webgl2()` API that can be implemented manually (GLSL)
   B. Provide a compatibility layer (helpers that resemble WGSL DSL)
   C. “No promise” initially; only built-ins supported for WebGL2
   D. Other: [specify]

