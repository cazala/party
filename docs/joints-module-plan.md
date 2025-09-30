### Joints Module – Implementation Plan (Core + Playground)

Goal: Implement a new Joints module in the beta core with WebGPU and CPU support, allowing creation of constraints between two particles by index. For v1, implement fixed-distance constraints (infinite stiffness) with infinite tolerance (joints do not break). Ensure collisions against joints (particle–joint) and joints vs joints can be handled, with a toggle to disable joint collisions. Provide a playground tool to create joints, plus slice/hook plumbing.

---

## Scope (v1 MVP)

- Fixed-distance joint constraints only (rest length provided); treat as infinite stiffness.
- No tolerance/strength logic (joints never break in v1).
- Joint collisions:
  - Particle–joint: enable resolution similar to legacy, but add global `enableJointCollisions` input to toggle.
  - Joint–joint: enable collision handling; also gated by the same toggle (for v1 a simple prevention method is acceptable).
- Pinned/removed semantics: removed particles (mass == 0) are skipped; pinned particles (mass < 0) still participate and are treated as infinite mass (immovable) by joint constraints/collisions.

---

## Data Model and Inputs

Joints module inputs (arrays, parallel by joint index):

- `aIndexes: number[]` – particle A indices
- `bIndexes: number[]` – particle B indices
- `restLengths: number[]` – desired distance between A and B
- `enableCollisions: number` – 1 or 0 (global toggle)

Future (not v1):

- `stiffness: number[]` – spring-like stiffness per joint
- `tolerance: number[]` – break threshold per joint

Notes:

- Arrays are bound as storage buffers in WebGPU; lengths determine joint count.
- For v1, `stiffness` and `tolerance` are omitted; behave as infinite-stiffness, infinite-tolerance.
- Uniqueness & canonical ordering: Each joint is an unordered pair. Store as `(min(a,b), max(a,b))`. Maintain arrays sorted by `aIndexes` then `bIndexes` for binary searching a particle’s joints.

---

## Core Implementation

### 1) Module Skeleton

- New file: `packages/core/src/beta/modules/forces/joints.ts` exporting `Joints extends Module("joints", Inputs)`; this module provides BOTH Force and Render descriptors (first dual-behavior module):
  - Force: `state/apply/constrain/correct` as needed (v1: `constrain` only).
  - Render: draws joint lines between particle A and particle B with color = particle A’s color.
- Inputs: `aIndexes`, `bIndexes`, `restLengths` (DataType.ARRAY), `enableCollisions` (DataType.NUMBER), optional `lineWidth` (DataType.NUMBER, default ~1.5).

### 2) WebGPU – Constraint Solving

- Use the `constrain` pass (multiple iterations via engine `constrainIterations`).
- Strategy: Per particle kernel (Strategy A) with binary search over sorted joints:
  - Keep joints sorted by `(a asc, b asc)`. For current `index`, binary-search the contiguous slice where `a == index` and iterate it. For joints where `b == index`, either perform a second binary search on `b` (if we keep a mirrored index in future) or linearly scan as a fallback in v1.
  - For each joint touching `index`:
    - Identify `self` and `other`, fetch positions and masses.
    - Skip if either is removed (`mass == 0`).
    - Compute `delta = pos_other - pos_self`, `dist = length(delta)`. If `dist` ~ 0, apply small epsilon to avoid NaN.
    - Required correction magnitude along normalized direction to satisfy `restLength`.
    - Inverse-mass split: `invM_self = self.mass > 0 ? 1/self.mass : 0` (pinned → 0), `invM_other = other.mass > 0 ? 1/other.mass : 0`. If both zero (both pinned), skip.
    - Apply local share for `self`: `self.position += corr * (invM_self / (invM_self + invM_other))` (sign according to direction). The partner will get its share in its own pass (acceptable for v1).

### 3) WebGPU – Joint Collisions (v1 minimal)

- Particle–joint: When `enableCollisions==1`, for current particle, compute distance to segments for joints (O(J) for v1). If below `(particle.size + eps)`, push particle out along shortest vector. Treat pinned endpoints as invM=0 (they do not move); v1 can push only particle for simplicity.
- Joint–joint: Segment–segment intersection test; if intersecting, separate endpoints along collision normal. Respect inv-mass split (pinned endpoints do not move). For v1, keep checks minimal and possibly sampled to limit cost.

### 4) CPU – Constraint Solving

- Iterate all joints per `constrain` pass, multiple iterations:
  - `a, b, rest`. Skip if either removed (`mass == 0`). Pinned (`mass < 0`) → invM=0.
  - Compute delta/distance, correct positions using inverse-mass split (as above). If both pinned → skip.
- Collisions (v1 simplified) follow the same rules as WebGPU for parity.

### 5) Interop with Other Modules

- Collisions (particle–particle) remains separate; Joints runs in constraint phase.
- Fluids unaffected. Pinned semantics enforced via inv-mass (0).
- If both endpoints pinned, joint is inert.

### 6) Inputs/Uniform Binding & Ordering

- Arrays bound as storage buffers; lengths passed via numeric uniforms. Read-only in kernels.
- Maintain canonical ordering `(min(a,b), max(a,b))` and keep arrays sorted by `aIndexes` (secondary `bIndexes`) to enable binary search.

### 7) Rendering Joints (lines)

- WebGPU: Add a Render descriptor on `Joints` that draws lines between A and B:
  - Approach A (compute image pass): For each line segment, write into the scene texture by marking pixels within distance threshold of AB; color = particle A color; thickness via `lineWidth`. Do simple blending to accumulate lines.
  - Approach B (future): Raster fullscreen pass instancing per joint (vertex builds two-triangle quads aligned to segment) for better performance/quality.
- CPU: In the module’s `render` callback, iterate joints and `context.strokeStyle = colorOfA; context.lineWidth = lineWidth; draw line from A to B`.
- Render order: place `Joints` in render array before particle discs so lines appear under particles (or configurable).

---

## Playground Integration

### 1) Redux Slice – `slices/modules/joints.ts`

- State: `{ enabled: boolean; enableCollisions: boolean; aIndexes: number[]; bIndexes: number[]; restLengths: number[]; lineWidth: number }`.
- Actions: setEnabled, setEnableCollisions, setLineWidth, setJoints({ aIndexes, bIndexes, restLengths }), addJoint({ a, b, rest }), removeJoint(index), reset, importSettings.
- `addJoint` canonicalizes `(min(a,b), max(a,b))` and deduplicates.
- Combine in `slices/modules/index.ts`.

### 2) Hook – `hooks/modules/useJoints.ts`

- Reads from Redux; writes to engine module (`joints.set...`).
- Provides helpers: `addJoint(a,b,rest)`, `removeJoint(i)`, `setEnableCollisions(bool)`, `setLineWidth(v)` with canonicalization & uniqueness checks.

### 3) Tool – `hooks/tools/individual-tools/useJointTool.ts`

- UX:
  - Click-first particle (highlight), click-second particle → create joint with `rest=distance(world(A),world(B))`.
  - ESC cancels selection.
- Implementation:
  - On each click, find nearest particle within radius; store selected index.
  - On second click, compute rest, canonicalize `(min,max)`, call `addJoint` (dedup enforced).
  - Optional overlay for preview line.

### 4) Engine Wiring – `useEngineInternal.ts`

- Instantiate `new Joints({ enabled: false })` and include the SAME instance in both `forces` and `render` arrays.
- Keep reference for hook; sync Redux → engine when changed.

### 5) UI

- Add Joints module toggle, collisions toggle, and line width control.
- Add Joint tool button to toolbar.

---

## API – Core Joints Module (v1)

- Methods:
  - `setAIndexes(number[])`
  - `setBIndexes(number[])`
  - `setRestLengths(number[])`
  - `setEnableCollisions(number)` (1/0)
  - `setJoints({ aIndexes, bIndexes, restLengths })`
  - `setLineWidth(number)` (optional)
- CPU/WebGPU `constrain` applies fixed-distance corrections with inverse-mass split (pinned → invM=0).
- Render pass draws lines with color of particle A and `lineWidth`.

---

## Collision Handling Details (v1 Simplified)

- Particle–Joint: point-to-segment distance; push particle outward when too close. Respect inv-mass (pinned endpoints fixed). Skip if `enableCollisions==0`.
- Joint–Joint: segment–segment intersection; separate endpoints with small correction; respect inv-mass (pinned fixed). Skip if `enableCollisions==0`.
- Performance: keep simple; if heavy, sample or cap checks.

---

## Pinned/Removed Semantics

- Removed (mass == 0): skip in constraints and collisions.
- Pinned (mass < 0): participate with invM=0; only non-pinned partner moves; both pinned → skip.

---

## Testing & Validation

- Parity checks CPU/WebGPU.
- Cases:
  - Two particles at rest distance → stable.
  - Pulled apart → constrained back to rest.
  - Pinned + dynamic → only dynamic moves.
  - Particle–joint collision separation.
  - Joint–joint crossing separation when enabled.
  - Collisions disabled toggle honored.
  - Lines render between A and B; line color equals particle A color; line width respected.

---

## Future Phases

- Per-joint `stiffness` and `tolerance` (breakage), momentum blending.
- Spatial indexing for joints in WebGPU.
- Overlay rendering for joints; editing/removal tool.
