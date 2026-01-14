# PRD: Improve Brush Tool (Fill Consistency + Performance)

## Summary
The Brush tool should:

1. **Fill the brush circle consistently** (no “missing rows” / striping depending on where you click).
2. **Stay smooth while dragging** (avoid stalls caused by reading back/copying all particles, especially in WebGPU).

This PRD proposes improvements that work across **CPU + WebGPU** runtimes, and keeps current UX: dashed grey circle overlay, click/drag to paint, **Shift = pinned**, **Cmd/Ctrl+drag = resize**.

---

## Background / Current Behavior
The current Brush implementation:

- Generates candidate points via a hex-ish packing inside the circle.
- Avoids overlaps by building a spatial index that includes existing particles, currently derived by calling `engine.getParticles()` (which is expensive on WebGPU: GPU → CPU readback of all particles).
- During a drag, it repeatedly stamps along the path, continuing to check overlaps.

---

## Problems

### Problem 1 — Fill inconsistencies (“missing rows”)
Users report that sometimes the circle fills densely, but other times there are visible gaps / whole rows missing (often alternating-row patterns).

**Likely causes**
- **Packing phase instability**: the packing lattice is effectively anchored to the click location (or bounding box min corner), so small coordinate differences change row parity/phase and produce visible stripes.
- **Correlated rejection**: overlap checks can reject many candidates in a structured way (e.g., an entire row), especially if candidates are near the overlap threshold.
- **Floating point drift**: incremental stepping in world space can accumulate error and shift candidate positions enough to flip overlap outcomes.

### Problem 2 — Dragging performance (lag / stutter)
Stroke painting can lag because it needs occupancy checks against existing particles, and the current strategy reads back **all particles** from the engine.

On WebGPU this is particularly expensive because it implies copying a large GPU buffer back to CPU.

---

## Goals

### G1 — Deterministic, dense fill
- A single click on an empty area should pack particles so the circle is **uniformly filled** (no striping).
- Clicking again at the same position should place **0** new particles (if particles haven’t moved).
- Fill density should be stable for slight changes in click position.

### G2 — Smooth drag painting
- Painting strokes should remain responsive even at high particle counts (e.g., 50k–100k).
- Avoid full-scene particle readback during painting.
- Must work on **all runtimes** (CPU and WebGPU).

### G3 — Correct overlap avoidance
- Do not place particles overlapping existing particles (using each particle’s physics radius).
- Do not overlap particles placed earlier in the same brush gesture.
- Maintain Shift (spawn pinned) and Cmd/Ctrl resize behavior.

---

## Non-Goals
- Perfect “no overlap” guarantees against particles that are moving rapidly during a long drag (we’ll define practical semantics below).
- Changing visual UI/overlay design beyond what’s needed for correctness/performance.

---

## Proposed Solution

### A) Fix fill inconsistencies with a globally anchored hex lattice
Instead of anchoring the lattice to the click’s bounding box or minY/minX, define a **global lattice** in world coordinates:

- Let particle radius = `r`
- Hex packing step:
  - \(dx = 2r\)
  - \(dy = \sqrt{3}r\)
- Lattice anchor (world): choose a stable origin, e.g. `(0, 0)`.

**Candidate generation approach**
- Compute the lattice coordinate range that overlaps the circle’s bounding box.
- For each lattice point, test if it is inside the brush circle (optionally using an “effective radius” so particles don’t extend outside).
- Perform overlap checks and spawn where free.

**Why this helps**
- Row parity and phase stay stable as the user moves/clicks.
- Removes the “every other row missing” artifact caused by phase flipping.

**Acceptance check**
- Repeated clicks at nearby positions produce consistent packing density and no systematic missing rows.

---

### B) Avoid full particle readback with a regional query API
Introduce an engine-level API to fetch only particles near a region:

**Proposed API (core engine)**
- `engine.getParticlesInRadius(center, radius, opts?) -> { particles, truncated }`

Where `particles` contains only what the Brush needs for occupancy:
- `position: {x, y}`
- `size` (physics radius)
- `mass` (to ignore removed particles where `mass === 0`)
Optionally also:
- `id` or `index` (for tracking/undo integrations if needed)

**CPU implementation**
- Use the existing spatial grid / neighbor query mechanism used by force modules.
- Runtime cost scales with local density, not global count.

**WebGPU implementation**
- Use a compute step that:
  - scans the spatial grid cells overlapping the query region,
  - compacts candidate indices into a small buffer (bounded),
  - reads back only that compact buffer (small GPU → CPU transfer).
- Return `truncated: true` if `maxResults` is exceeded.

**Why this helps**
- Brush no longer needs `getParticles()` (full-scene readback).
- Per-stamp cost becomes proportional to particles near the brush region.

---

## Brush Tool Behavior (after improvements)

### Gesture start (mouse down)
1. Compute `worldCenter` and `worldRadius`.
2. Call `getParticlesInRadius(worldCenter, worldRadius + r, { maxResults })`.
3. Build a local spatial hash (or uniform grid) from returned particles (ignoring removed).
4. Enumerate globally anchored lattice candidates inside the brush circle.
5. For each candidate:
   - Reject if overlaps indexed particle.
   - Otherwise spawn particle and insert it into the local index.

### Dragging (mouse move)
Use a stroke threshold so we don’t stamp on every pointer event:
- threshold ≈ `max(0.8 * 2r, some minimum)` in world or derived from zoom in screen space.

On each stamp:
- **Fast path (default)**: reuse current local index; only check against what we already know + what we spawned so far.
- **Refresh path (optional)**: if the brush moved far enough that the stamped region is largely new, query additional particles for the new area and merge into the local index.

### Semantics with moving particles
Define placement correctness relative to a **snapshot of nearby particles at the time they are queried**.
- This avoids constant re-query cost while still behaving correctly for typical painting (where particles don’t move drastically between events).

---

## Performance Targets
- No full-scene particle readback during brush usage.
- Stroke start (first query + stamp):
  - CPU: typically < 5ms on moderate density.
  - WebGPU: typically < 10–20ms; readback bounded by `maxResults`.
- During drag:
  - Per-stamp work should generally stay under ~4–8ms for smooth 60fps interaction.

**Caps / safety**
- `maxResults` (e.g. 20,000) to prevent pathological dense-area queries from freezing the UI.
- Tool can degrade gracefully if `truncated` (see below).

---

## Degradation Strategy (when query is truncated)
If `getParticlesInRadius` returns `truncated: true`:
- Prefer correctness over density:
  - reduce stamp rate (increase stroke threshold),
  - reduce per-stamp spawn cap,
  - optionally show a subtle UI hint (non-blocking) that the area is very dense.

---

## Alternatives Considered

### Alternative 1 — `engine.canPlaceParticle(position, radius)` / `engine.stamp(...)`
Higher-level engine APIs to decide placement per-candidate or in a batch.

- Pros: tool stays simple, engine owns overlap rules.
- Cons: hard to implement efficiently without some form of regional indexing/query; may still require readbacks.

### Alternative 2 — Tool-only “assume empty” occupancy (no engine query)
Only avoid overlap among particles spawned in this gesture.

- Pros: fast.
- Cons: violates requirement (can overlap existing particles).

---

## Acceptance Criteria

### Fill consistency
- No recurring striping/missing-row artifacts when clicking in similar areas.
- Same radius yields similar density across clicks.

### Correctness
- No overlapping spawned particles within the brush overlay.
- No spawning on top of existing particles (within snapshot semantics).
- Shift spawns pinned; Cmd/Ctrl resize unchanged.

### Performance
- Drag painting stays responsive in large scenes (50k–100k particles).
- No full-scene readbacks triggered by brush usage.

---

## Rollout Plan
1. Add `getParticlesInRadius` to core engine interface + CPU implementation.
2. Add WebGPU implementation with bounded compaction + small readback.
3. Update Brush tool to:
   - use globally anchored lattice
   - use regional query for initial occupancy
   - optionally refresh occupancy during long drags
4. Add perf logging in dev builds to validate targets.

