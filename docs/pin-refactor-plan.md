### Pin Refactor Plan — use mass = -1 to represent pinned particles

**Goal**: Remove the dedicated Pin force module and its Redux/hooks usage. Represent pinned particles via a shared convention: mass < 0 (use -1). Leverage this in compute/render to make pinned particles static and visually distinct (red), without extra array inputs.

---

## Objectives

- **Simplify**: Eliminate the `Pin` module and the separate pinned-index array plumbing.
- **Unify semantics**: Use mass as the single source of truth:
  - mass = 0 → removed/dead
  - mass < 0 → pinned (static, still rendered)
  - mass > 0 → normal
- **Optimize**: Skip physics work for pinned and removed particles; render pinned red directly from particle data.

---

## Core library changes (packages/core)

1. Remove Pin force module

- Delete `packages/core/src/beta/modules/forces/pin.ts` and stop exporting it from any module index files.
- Remove any references/usages in examples/tests.

2. Mass semantics + runtime guards

- In WebGPU program builder (`packages/core/src/beta/runtimes/webgpu/builders/program.ts`):
  - Update all compute passes (apply, integrate, constrain, correct) early-returns to skip both removed and pinned:
    - Current: `if (particle.mass == 0.0) { return; }`
    - Change to: `if (particle.mass <= 0.0) { return; }` (treat negatives as pinned/static)
- In CPU engine (`packages/core/src/beta/runtimes/cpu/engine.ts`):
  - Add equivalent guards in force application, integration, constraints, and corrections so particles with mass <= 0 are skipped for physics updates.

3. Rendering pinned particles (no extra inputs)

- WebGPU particle render module (`packages/core/src/beta/modules/render/particle.ts`):
  - Remove `redParticleIndexes` input, bindings, and loops.
  - In fragment, read `let p = particles[index];` and set color to red if `p.mass < 0.0`.
  - Keep rendering removed particles (mass = 0) culled; pinned (mass < 0) must still render.
- CPU render path: when drawing a particle, override color to red if `particle.mass < 0`.

4. Engine APIs for pinning

- Add helpers: `engine.pinParticles(indexes)`, `engine.unpinParticles(indexes)`, `engine.unpinAll()` which internally call `setParticles` and sets to set their masses to -1 or calculate the masses from the sizes.

5. Input validation/guards

- Ensure no code prevents negative masses:
  - Spawner defaults and any validation should allow mass < 0.
  - Remove/minimize clamps like `Math.max(mass, 0)` where inappropriate.

---

6. Collisions: infinite-mass behavior for pinned

- In the collisions force module, treat `mass < 0` as infinite mass in response/impulse calculations:
  - Use zero inverse mass for pinned particles; do not change their velocities/positions from collision resolution.
  - Apply full resolution to the non-pinned participant only.
  - Where equations include terms like `(invMassA + invMassB)`, clamp the pinned side to `0.0`.
- This reduces unnecessary math and matches the semantics of pinned particles.

## Playground changes (packages/playground)

1. Remove Pin state and hook

- Delete `slices/modules/pin.ts`; remove from combined reducer and selectors.
- Delete `hooks/modules/usePin.ts` and any re-exports.
- Remove Pin module construction/registration in `hooks/useEngineInternal.ts`.

2. Update Pin tool

- Refactor `hooks/tools/individual-tools/usePinTool.ts`:
  - Keep the UX overlay and radius logic.
  - Replace calls through `usePin()` with direct engine API:
    - Compute affected indexes (current logic already gathers indexes via `engine.getParticles()` + radius).
    - Call `engine.pinParticles(indexes)` to pin.
  - Clicking and dragging should pin particles as if it was a brush.
  - We should toggle particle pinning instead of just pinning, so we can unpin particles too (with engine.unpinParticles).

3. Particle render state cleanup

- Remove `redParticleIndexes` from `slices/modules/particle.ts`, related actions/selectors, and `hooks/modules/useParticle.ts`.
- Remove any usage that set red indexes (e.g., from the old Pin hook).

4. UI cleanup

- Remove Pin module toggle/controls from any module sidebars.
- Keep the Pin tool in the toolbar; it now simply sets mass.

---

## Step-by-step migration

1. Update runtime guards

- WebGPU builder (`packages/core/src/beta/runtimes/webgpu/builders/program.ts`): change all compute-pass early-returns from `particle.mass == 0.0` to `particle.mass <= 0.0` so both removed (0) and pinned (< 0) are skipped by physics.
- CPU engine (`packages/core/src/beta/runtimes/cpu/engine.ts`): add equivalent checks to skip applying forces, integrating, constraining, and correcting when `particle.mass <= 0`.

2. Render pinned without extra inputs

- WebGPU particle render (`packages/core/src/beta/modules/render/particle.ts`): remove `redParticleIndexes` input, bindings, and loops. In the fragment, use the instanced particle and set color to red when its mass is `< 0.0`. Ensure removed (mass = 0) remain culled via vertex path.
- CPU render path: when drawing, override to red if `particle.mass < 0`.

3. Remove Pin module from core and references

- Delete `packages/core/src/beta/modules/forces/pin.ts` and stop exporting it.
- Remove any import/usages in examples/tests.

4. Engine helpers for pinning/unpinning

- Add helpers on the engine: `engine.pinParticles(indexes)`, `engine.unpinParticles(indexes)`, `engine.unpinAll()`.
- Internally, invoke a `setParticles`-style mutation that updates masses: set to `-1` for pinned; for unpin, compute masses from sizes (or a deterministic size→mass mapping) and write them. Support CPU (in-memory) and WebGPU (storage buffer writes) efficiently.

5. Playground: remove Pin slice/hook and initialization

- Delete `slices/modules/pin.ts`, remove it from the combined reducer/exports, and delete `hooks/modules/usePin.ts`.
- In `hooks/useEngineInternal.ts`, stop creating/adding the Pin force module; remove refs/cleanup.

6. Refactor Pin tool to brush + toggle

- In `hooks/tools/individual-tools/usePinTool.ts`, keep the dashed-circle overlay and radius logic.
- Make the tool operate as a brush on click/drag: gather indexes within the radius (via `engine.getParticles()`), then toggle pin state per index: if mass `< 0` → unpin (restore computed mass), else pin (set to `-1`).
- Use the new engine helpers (`pinParticles`/`unpinParticles`) for batch operations.

7. Particle state cleanup in playground

- Remove `redParticleIndexes` from `slices/modules/particle.ts` and any references in `hooks/modules/useParticle.ts`.
- Remove any wiring that set red indexes from the old Pin hook.

8. Build and type checks

- Ensure all module interfaces/types compile after removing array inputs from particle render.
- Verify render-pass builder compiles WGSL with the new fragment logic and that no stale bindings remain.

---

7. Tests/manual QA

- Spawn particles, use Pin tool → particles turn red and remain static.
- Enable forces (gravity, behavior) → pinned don’t move; others do.
- Collisions with pinned act as infinite-mass anchors if applicable (future optimization below).
- Unpin path restores normal behavior.
- CPU and WebGPU runtimes behave consistently.

---

## Future optimizations (optional)

- Neighbor queries: skip including pinned particles where not needed.
- Rendering: small visual affordance (halo) for pinned; configurable color.

---

## Risk & rollback

- If issues arise, you can temporarily keep the Pin tool but switch it to update masses while the old Pin module remains removed. Roll back by re-adding the Pin module file and slice if necessary.
