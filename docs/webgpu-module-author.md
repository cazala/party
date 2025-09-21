## Writing WebGPU modules (force + render)

This guide explains how to create your own modules for the WebGPU engine. There are two public kinds of modules you can author:

- Force modules: run on the compute simulation pipeline; can contribute to per-particle state and forces.
- Render modules: draw the scene via either fullscreen raster passes or compute image passes.

System modules are internal and documented in the maintainer guide.

### Concepts

- A module is a class extending `Module<Name, BindingKeys, StateKeys?>` and implementing `descriptor()`.
- The `descriptor()` declares:
  - `name` (string literal)
  - `role` (`ModuleRole.Force` or `ModuleRole.Render`)
  - `bindings`: list of uniform names that are exposed to the CPU and uploaded to GPU
  - For force modules: any of `global`, `state`, `apply`, `constrain`, `correct` hooks
  - For render modules: an array of `passes` (fullscreen or compute) with their bindings
- Uniforms are laid out in a compact `vec4`-packed struct per module. You write to uniforms via the base class `this.write({ key: value })` or expose setters that call `this.write(...)`.
- The base class also supports `setEnabled()` to toggle a module at runtime; this writes an `enabled` flag into uniforms automatically.

### Force modules

Force modules run across multiple compute passes. You may implement any subset of these hooks:

- `global({ getUniform }) => string`: optional WGSL emitted once at global scope (utility functions, constants). Use `getUniform('<bindingName>')` to reference your uniforms.
- `state({ particleVar, dtVar, getUniform, getState, setState }) => string`: run before forces to compute per-particle values. Use `getState(name, pid?)`/`setState(name, value, pid?)` to read/write your declared `states` in the shared `SIM_STATE` buffer.
- `apply({ particleVar, dtVar, getUniform, getState, setState }) => string`: add forces by modifying `particle.acceleration` and/or `particle.velocity`.
- `constrain({ ... }) => string`: enforce constraints on position/velocity; may run multiple iterations.
- `correct({ ... }) => string`: after constraints, correct velocity artifacts.

The `args` objects provide:

- `particleVar`: name of the local WGSL variable representing the current particle
- `dtVar`: WGSL expression to the current delta time
- `getUniform(id)`: returns a WGSL expression to read your uniform
- `getState(name, pidVar?)` / `setState(name, expr, pidVar?)`: helpers to access shared simulation state

Example: a minimal force module

```ts
class MyForce extends Module<"myforce", "strength"> {
  private strength = 10;
  attachUniformWriter(w: (v: Partial<Record<string, number>>) => void) {
    super.attachUniformWriter(w);
    this.write({ strength: this.strength });
  }
  descriptor() {
    return {
      name: "myforce" as const,
      role: ModuleRole.Force,
      bindings: ["strength"] as const,
      apply: ({ particleVar, getUniform }) => `{
        let k = ${getUniform("strength")};
        ${particleVar}.acceleration += vec2<f32>(k, 0.0);
      }`,
    };
  }
}
```

Stateful force example (declare `states` and use in `state`/`apply`): see `fluid.ts` for density/nearDensity.

Neighbor iteration: use grid helpers from the `grid` system module (`neighbor_iter_init/neighbor_iter_next`) to scan nearby particles efficiently. See `behavior.ts`, `collisions.ts`, `fluid.ts` for patterns.

Tips:

- Prefer branch-light code and clamp/division guards to maintain stability.
- Use `mass == 0` as a convention for culled/pinned particles.
- Keep `state` light and cache results you need across passes.

#### Stateful force module example (inline)

Below is a minimal stateful module that maintains a per-particle `heat` value in `SIM_STATE`. The `state` pass cools the particle over time and optionally warms it based on speed; the `apply` pass pushes hotter particles outward a bit.

```ts
type HeatKeys = "cooling" | "warmup";
type HeatStateKeys = "heat";

class Heat extends Module<"heat", HeatKeys, HeatStateKeys> {
  private cooling = 0.2;
  private warmup = 0.1;

  attachUniformWriter(w: (v: Partial<Record<string, number>>) => void) {
    super.attachUniformWriter(w);
    this.write({ cooling: this.cooling, warmup: this.warmup });
  }

  descriptor() {
    return {
      name: "heat" as const,
      role: ModuleRole.Force,
      states: ["heat"] as const,
      bindings: ["cooling", "warmup"] as const,
      // Precompute: update heat from last frame
      state: ({ particleVar, dtVar, getUniform, getState, setState }) => `{
  var h = ${getState("heat")};
  // cool down proportionally to dt
  h = max(0.0, h - ${getUniform("cooling")} * ${dtVar});
  // add a bit of heat from speed (simple proxy)
  let speed = length(${particleVar}.velocity);
  h = min(1.0, h + speed * ${getUniform("warmup")} * ${dtVar});
  ${setState("heat", "h")};
}`,
      // Use heat to add a tiny outward force from world center
      apply: ({ particleVar, getState }) => `{
  let h = ${getState("heat")};
  if (h > 0.0) {
    let cx = (GRID_MINX() + GRID_MAXX()) * 0.5;
    let cy = (GRID_MINY() + GRID_MAXY()) * 0.5;
    let dir = ${particleVar}.position - vec2<f32>(cx, cy);
    let len = max(1e-4, length(dir));
    ${particleVar}.acceleration += (dir / len) * (h * 50.0);
  }
}`,
    } as const;
  }
}
```

This follows the same pattern used by `fluid.ts` which declares `states: ["density", "nearDensity"]` and fills them during `state`, then consumes them during `apply`.

#### Neighbor scanning example (inline)

Neighbor iteration uses helpers emitted by the `grid` system module and is available in both `state` and `apply` hooks. This pattern shows how to visit neighbors within a radius and accumulate a value.

```ts
// inside descriptor().apply
apply: ({ particleVar, getUniform }) => `{
  let r = ${getUniform("radius")};
  var it = neighbor_iter_init(${particleVar}.position, r);
  var count: f32 = 0.0;
  var sumDir = vec2<f32>(0.0, 0.0);
  loop {
    let j = neighbor_iter_next(&it, index);
    if (j == NEIGHBOR_NONE) { break; }
    let other = particles[j];
    let d = other.position - ${particleVar}.position;
    let dist2 = dot(d, d);
    if (dist2 <= 0.0) { continue; }
    let dist = sqrt(dist2);
    if (dist > r) { continue; }
    sumDir = sumDir + d / max(dist, 1e-3);
    count = count + 1.0;
  }
  if (count > 0.0) {
    let avg = sumDir / count;
    ${particleVar}.acceleration += normalize(avg) * 200.0;
  }
}`;
```

You can see richer variants in `behavior.ts` (flocking-style steering) and `collisions.ts` (contact selection + resolution). For scan-order bias reduction tricks, see comments in `collisions.ts`.

### Render modules

Render modules declare one or more `passes`:

- Fullscreen pass: rasterizes a screen-aligned quad. Set `instanced: true` (default) to draw per particle.
- Compute image pass: reads from the scene texture and writes into the other scene texture (ping-pong). Use for post effects like trails/blur.

Bindings for render modules are still uniform fields; you can expose setters to update them.

Fullscreen pass example (see `modules/render/particle.ts`):

```ts
passes: [
  {
    kind: RenderPassKind.Fullscreen,
    fragment: ({ sampleScene }) => `{
    // color and uv are provided by the default vertex shader
    let center = vec2<f32>(0.5, 0.5);
    let dist = distance(uv, center);
    let alpha = 1.0 - smoothstep(0.45, 0.5, dist);
    return vec4<f32>(color.rgb, color.a * alpha);
  }`,
    bindings: ["myUniform"] as const,
    readsScene: false,
    writesScene: true,
    instanced: true,
  },
];
```

Compute image pass example (see `modules/render/trails.ts`):

```ts
passes: [
  {
    kind: RenderPassKind.Compute,
    kernel: ({ getUniform, readScene, writeScene }) => `{
    let coords = vec2<i32>(i32(gid.x), i32(gid.y));
    let current = ${readScene("coords")};
    let d = clamp(${getUniform("trailDecay")}, 0.0, 1.0);
    ${writeScene("coords", "mix(current, vec4<f32>(0,0,0,0), d)")};
  }`,
    bindings: ["trailDecay"] as const,
    readsScene: true,
    writesScene: true,
  },
];
```

### Module lifecycle and uniforms

When `Engine.initialize()` runs, it builds the program and allocates one GPU uniform buffer per module based on the declared `bindings`. The base `Module` class calls your `attachUniformWriter(...)` where you should seed initial values via `this.write({ ... })`. Later, setters can update live uniform values; they immediately flush to GPU.

Enable/disable: call `setEnabled(boolean)`; the registry writes `enabled` into your uniform buffer and the compute pipeline will gate your functions accordingly.

### Testing and debugging

- Start with small particle counts and increase gradually.
- Validate `apply` without `constrain/correct` first; then add constraints with low iteration counts.
- For render passes, confirm `writesScene` is correct; otherwise ping-pong may not update as expected.
- Use temporary uniforms for tuning constants; expose them in your module and UI as needed.
