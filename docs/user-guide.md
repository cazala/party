## Party User Guide

This guide shows how to use the core library as an end user: creating an engine, selecting a runtime (CPU/WebGPU), configuring modules, adding particles, and using oscillators. It also documents all built-in force and render modules with their main inputs and simple examples.

### Installation

```bash
npm install @cazala/party
```

### Quick start

```ts
import {
  Engine,
  // Force modules
  Environment,
  Boundary,
  Collisions,
  Behavior,
  Fluids,
  Sensors,
  Interaction,
  Joints,
  Grab,
  // Render modules
  Trails,
  Lines,
  Particles,
} from "@cazala/party";

const canvas = document.querySelector("canvas")!;

const forces = [
  // Environment: gravity + damping/friction/inertia
  new Environment({
    gravityStrength: 600,
    gravityDirection: "down", // "up"|"down"|"left"|"right"|"inwards"|"outwards"|"custom"
    inertia: 0.05,
    friction: 0.01,
    damping: 0.0,
  }),

  // Boundary: keep particles within view; small tangential friction
  new Boundary({
    mode: "bounce", // "bounce"|"warp"|"kill"|"none"
    restitution: 0.9,
    friction: 0.1,
    repelDistance: 20,
    repelStrength: 50,
  }),

  // Collisions: elastic-ish collisions
  new Collisions({ restitution: 0.85 }),

  // Behavior: boids-style steering
  new Behavior({
    cohesion: 1.5,
    alignment: 1.2,
    repulsion: 2.0,
    separation: 12,
    viewRadius: 100,
    viewAngle: Math.PI, // 180° field of view
    wander: 20,
  }),

  // Fluids: SPH approximation; conservative defaults
  new Fluids({
    influenceRadius: 80,
    targetDensity: 1.0,
    pressureMultiplier: 25,
    viscosity: 0.8,
    nearPressureMultiplier: 40,
    nearThreshold: 18,
    enableNearPressure: true,
    maxAcceleration: 60,
  }),

  // Sensors: physarum polycephalum slime
  new Sensors({
    sensorDistance: 30,
    sensorAngle: Math.PI / 6,
    sensorRadius: 3,
    sensorThreshold: 0.15,
    sensorStrength: 800,
    followBehavior: "any", // "any"|"same"|"different"|"none"
    fleeBehavior: "none",
    colorSimilarityThreshold: 0.5,
    fleeAngle: Math.PI / 2,
  }),

  // Interaction: point attract/repel (inactive until setActive(true))
  new Interaction({
    mode: "attract",
    strength: 12000,
    radius: 300,
    active: false,
  }),

  // Joints: constraints (no joints yet, but configure dynamics)
  new Joints({
    momentum: 0.7,
    restitution: 0.9,
    separation: 0.5,
    steps: 2,
    friction: 0.02,
    enableParticleCollisions: false,
    enableJointCollisions: false,
  }),

  // Grab: single-particle dragging (provide inputs at interaction time)
  new Grab(),
];

const render = [
  new Trails({ trailDecay: 10, trailDiffuse: 4 }),
  new Lines({ lineWidth: 2 }),
  new Particles({ colorType: 2, hue: 0.55 }), // 2 = Hue, try 0..1
];

const engine = new Engine({
  canvas,
  forces,
  render,
  runtime: "auto", // "auto" picks WebGPU when available, otherwise CPU
});

await engine.initialize();
engine.play();
```

### Engine API

- **Construction (required)**: `new Engine({ canvas, forces, render, runtime, ... })`

  - **canvas**: HTMLCanvasElement used for rendering
  - **forces**: `Module[]` list of force modules
  - **render**: `Module[]` list of render modules
  - **runtime**: `"cpu" | "webgpu" | "auto"` (use "auto" for best experience)
  - Optional: `constrainIterations`, `clearColor`, `cellSize`, `maxNeighbors`, `maxParticles`, `workgroupSize`

- **Lifecycle**: `initialize()`, `play()`, `pause()`, `stop()`, `toggle()`, `destroy()`
- **State**: `isPlaying()`, `getFPS()`
- **View**: `getSize()`, `setSize(w,h)`, `setCamera(x,y)`, `getCamera()`, `setZoom(z)`, `getZoom()`
- **Particles**: `addParticle(p)`, `setParticles(p[])`, `getParticles()`, `getParticle(i)`, `clear()`, `getCount()`
- **Config**: `getClearColor()/setClearColor()`, `getCellSize()/setCellSize()`, `getMaxNeighbors()/setMaxNeighbors()`, `getConstrainIterations()/setConstrainIterations()`
- **Modules**: `getModule(name)` returns the module instance by name
- **Serialization**: `export()` returns `{ [moduleName]: settings }`; `import(settings)` applies them
- **Oscillators**: see “Oscillators” below

Notes

- When `runtime: "auto"`, the engine tries WebGPU first, then falls back to CPU if unavailable.
- Pinned particles are represented by a negative `mass`. The top-level `Engine` also includes helpers `pinParticles([...])`, `unpinParticles([...])`, `unpinAll()` (CPU + WebGPU friendly).

#### Engine methods and lifecycles

- `initialize()`
  - Creates runtime resources (GPU device/queues or CPU canvas context), binds module uniforms, and builds pipelines. Await this before `play()`.
  - In `runtime: "auto"`, falls back to CPU if WebGPU initialization fails.
- `play()` / `pause()` / `stop()` / `toggle()`
  - Controls the animation loop. Per frame the engine updates oscillators, runs simulation (state → apply → constrain×N → correct), then renders.
  - `stop()` halts and cancels the loop; `pause()` only toggles playing state.
- `destroy()`
  - Disposes GPU/canvas resources and detaches listeners. Call when the canvas/engine is no longer needed.
- `getSize()` / `setSize(w, h)`
  - Updates view and internal textures/buffers on resize. Call on window/canvas size changes.
- `setCamera(x, y)` / `getCamera()` and `setZoom(z)` / `getZoom()`
  - Adjusts the world-to-screen transform. Affects bounds, neighbor grid extents, and rendering.
- `addParticle(p)` / `setParticles(p[])` / `getParticles()` / `getParticle(i)` / `clear()`
  - Manage particle data. For bulk changes prefer `setParticles()` to minimize sync overhead.
- `getCount()` / `getFPS()`
  - Inspect particle count and smoothed FPS estimate.
- `export()` / `import(settings)`
  - Serialize/restore module inputs (including `enabled`). Great for presets and sharing scenes.
- `getModule(name)`
  - Fetch a module instance to tweak inputs at runtime.
- `getActualRuntime()`
  - Returns `"cpu" | "webgpu"` for the active runtime.

Performance-critical settings

- `setCellSize(size: number)`
  - Spatial grid resolution for neighbor queries. Smaller cells improve locality but increase bookkeeping; larger cells reduce overhead but widen searches. Typical: 8–64.
- `setMaxNeighbors(value: number)`
  - Cap neighbors considered per particle in neighbor-based modules (collisions, behavior, fluids). Higher = more accurate in dense scenes, but slower. Typical: 64–256.
- `setConstrainIterations(iterations: number)`
  - Number of constraint iterations per frame (affects boundary/collision correction and joints). More = more stable/rigid, but slower. Defaults: CPU ≈ 5, WebGPU ≈ 50.

### Runtime selection

- Use `runtime: "auto"` unless you explicitly need one runtime.
- WebGPU unlocks large particle counts and GPU compute; CPU offers maximum compatibility.

### Camera and coordinates

- World coordinates are independent of canvas pixels; `setCamera(x,y)` centers the view and `setZoom(z)` controls scale.
- Bounds-aware modules (e.g., `Boundary`) use the camera and zoom to compute visible extents consistently across runtimes.

### Oscillators

Oscillators modulate module inputs continuously over time.

#### Oscillator API

- `addOscillator(params)` - Add an oscillator to animate a module input
- `removeOscillator(moduleName, inputName)` - Remove a specific oscillator
- `updateOscillatorSpeed(moduleName, inputName, speedHz)` - Change oscillation speed
- `updateOscillatorBounds(moduleName, inputName, min, max)` - Change oscillation range
- `clearOscillators()` - Remove all oscillators
- `clearModuleOscillators(moduleName)` - Remove all oscillators for a specific module

```ts
// Animate boundary restitution between 0.4 and 0.95 at 0.2 Hz
const oscId = engine.addOscillator({
  moduleName: "boundary",
  inputName: "restitution",
  min: 0.4,
  max: 0.95,
  speedHz: 0.2,
});

// Later
engine.updateOscillatorSpeed("boundary", "restitution", 0.4);
engine.removeOscillator("boundary", "restitution");

// Clear all oscillators for a specific module
engine.clearModuleOscillators("boundary");

// Clear all oscillators
engine.clearOscillators();
```

Inputs are addressed by the module’s input keys (documented per module below). Oscillators write values exactly as if you had called the module’s setters.

---

## Built-in Modules

Modules come in two public roles:

- **Force**: contribute to simulation (acceleration/velocity/constraints)
- **Render**: draw into the scene texture or canvas

Differences and when they run

- Force modules execute during the simulation step. They may:
  - Add forces to `particle.acceleration` (e.g., gravity, boids steering)
  - Directly modify `particle.velocity` (e.g., viscosity, sensor steering)
  - Adjust `particle.position` in constraint phases (e.g., collisions, joints)
- Render modules execute after simulation each frame. They may:
  - Draw instanced particles or lines via fullscreen passes
  - Post-process the scene texture via compute-like passes (e.g., trails decay/diffuse)
- Toggle modules on/off at runtime via `setEnabled(boolean)` to isolate effects and optimize performance.

Each module exposes a `name` and typed `inputs`. You can toggle any module on/off with `module.setEnabled(boolean)` and read current inputs via `module.read()`; use `getModule(name)` to retrieve instances from the engine.

### Force modules

#### Environment (`environment`)

- Purpose: global gravity, inertia, friction, velocity damping
- Inputs (defaults in parentheses):
  - `gravityStrength` (0): magnitude of gravity acceleration applied toward a direction/origin.
  - `dirX`, `dirY` (derived): gravity direction when `mode` is directional/custom; normalized internally.
  - `inertia` (0): acceleration term along current velocity (`velocity * dt * inertia`) to preserve momentum.
  - `friction` (0): deceleration opposite to velocity (`-velocity * friction`).
  - `damping` (0): multiplicative velocity damping each step.
  - `mode` (0): 0 directional/custom, 1 inwards (to view center), 2 outwards (from view center).
- Helpers:
  - `setGravityStrength(v)`
  - `setGravityDirection("up"|"down"|"left"|"right"|"inwards"|"outwards"|"custom")`
  - `setGravityAngle(radians)` (used when direction is `custom`)
  - `setDirection(x,y)`, `setInertia(v)`, `setFriction(v)`, `setDamping(v)`

Example

```ts
const env = new Environment({
  gravityStrength: 1200,
  gravityDirection: "down",
});
env.setFriction(0.02);
```

#### Boundary (`boundary`)

- Purpose: enforce world bounds with optional repel force
- Inputs (defaults):
  - `restitution` (0.9): bounce energy retention.
  - `friction` (0.1): tangential damping on contact.
  - `mode` ("bounce"): 0 bounce, 1 warp (wrap once fully outside), 2 kill (remove by `mass=0`), 3 none.
  - `repelDistance` (0): inner distance from edges to start push.
  - `repelStrength` (0): magnitude of inward push (outside=full, inside=scaled).

Example

```ts
const boundary = new Boundary({
  mode: "bounce",
  restitution: 0.85,
  friction: 0.1,
});
```

#### Collisions (`collisions`)

- Purpose: particle–particle collision resolution and bounce impulse
- Inputs (defaults):
  - `restitution` (0.8): elasticity along contact normal.
    Notes
- Uses spatial grid neighbor iteration up to `maxNeighbors`; resolves deepest overlap and applies impulse; small jitter reduces bias.

```ts
const collisions = new Collisions({ restitution: 0.8 });
```

#### Behavior (`behavior`)

- Purpose: boids-like steering (separation, alignment, cohesion, chase/avoid, wander)
- Inputs (defaults):
  - `wander` (20): pseudo-random lateral perturbation magnitude.
  - `cohesion` (1.5): steer toward neighbor centroid.
  - `alignment` (1.5): steer toward neighbor average velocity.
  - `repulsion` (2): steer away when within `separation` distance.
  - `chase` (0): chase lighter neighbors (mass delta bias).
  - `avoid` (0): flee heavier neighbors (within half `viewRadius`).
  - `separation` (10): personal space radius for repulsion.
  - `viewRadius` (100): neighbor search radius.
  - `viewAngle` (1.5π): field-of-view in radians.
    Notes
- FOV uses velocity direction; falls back to a default forward if nearly zero velocity.

```ts
const behavior = new Behavior({
  cohesion: 1.5,
  alignment: 1.5,
  separation: 10,
  viewRadius: 100,
});
```

#### Fluids (`fluids`)

- Purpose: SPH-inspired fluid approximation (density pre-pass + pressure/viscosity apply)
- Inputs (defaults):
  - `influenceRadius` (100): neighbor radius for kernels.
  - `targetDensity` (1): rest density.
  - `pressureMultiplier` (30): scales pressure from density difference.
  - `viscosity` (1): smooths velocity differences.
  - `nearPressureMultiplier` (50): strong short-range pressure.
  - `nearThreshold` (20): near-pressure distance.
  - `enableNearPressure` (true): toggle for near-pressure.
  - `maxAcceleration` (75): clamp for stability.
    Notes
- Two passes: `state` (density/near-density), `apply` (pressure/viscosity → velocity).

```ts
const fluids = new Fluids({
  influenceRadius: 80,
  pressureMultiplier: 25,
  viscosity: 0.8,
});
```

#### Sensors (`sensors`)

- Purpose: trail/color sampling based steering (follow and/or flee)
- Inputs (defaults):
  - `sensorDistance` (30), `sensorAngle` (π/6), `sensorRadius` (3)
  - `sensorThreshold` (0.1), `sensorStrength` (1000)
  - `colorSimilarityThreshold` (0.4)
  - `followBehavior` (any): 0 any, 1 same, 2 different, 3 none
  - `fleeBehavior` (none): 0 any, 1 same, 2 different, 3 none
  - `fleeAngle` (π/2)
    Notes
- Samples scene texture consistently across runtimes; no trails required.

```ts
const sensors = new Sensors({
  sensorDistance: 30,
  sensorAngle: Math.PI / 6,
  followBehavior: "any",
});
```

#### Interaction (`interaction`)

- Purpose: point attract/repel under user control
- Inputs (defaults):
  - `mode` (attract: 0/repel: 1), `strength` (10000), `radius` (500)
  - `positionX/Y` (0), `active` (false)

```ts
const interaction = new Interaction({
  mode: "attract",
  radius: 300,
  strength: 12000,
});
interaction.setPosition(0, 0);
interaction.setActive(true);
```

#### Joints (`joints`)

- Purpose: distance constraints between particles, optional collisions, momentum preservation
- Inputs (defaults):
  - Arrays: `aIndexes[]`, `bIndexes[]`, `restLengths[]`, CSR `incidentJointOffsets/incidentJointIndices`, derived `groupIds[]`
  - Scalars: `enableParticleCollisions` (0), `enableJointCollisions` (0), `momentum` (0.7), `restitution` (0.9), `separation` (0.5), `steps` (1), `friction` (0.01)
- Helpers: `setJoints([...])`, `add({ aIndex, bIndex, restLength })`, `remove(a,b)`, `removeAll()`, setters for all scalar inputs

```ts
const joints = new Joints();
joints.setJoints([{ aIndex: 0, bIndex: 1, restLength: 50 }]);
joints.setMomentum(0.7);
```

#### Grab (`grab`)

- Purpose: efficient mouse-drag grabbing of a single particle (updates one particle per frame)
- Inputs: `grabbedIndex`, `positionX`, `positionY`
- Helpers: `grabParticle(index, {x,y})`, `releaseParticle()`, `isGrabbing()`

```ts
const grab = new Grab();
grab.grabParticle(42, { x: 100, y: 100 });
```

### Render modules

#### Particles (`particles`)

- Purpose: draw particles as soft discs; pinned particles render as rings
- Inputs (defaults):
  - `colorType` (Default: 0, Custom: 1, Hue: 2)
  - `customColorR/G/B` (1/1/1) when `colorType=Custom`
  - `hue` (0) when `colorType=Hue`

```ts
const particles = new Particles();
particles.setColorType(2); // Hue
particles.setHue(0.5);
```

#### Trails (`trails`)

- Purpose: decay + diffuse passes over the scene texture
- Inputs (defaults):
  - `trailDecay` (10): fade speed toward clear color
  - `trailDiffuse` (0): blur radius (0–12 typical)

```ts
const trails = new Trails({ trailDecay: 12, trailDiffuse: 4 });
```

#### Lines (`lines`)

- Purpose: draw lines between particle pairs (indices)
- Inputs (defaults):
  - `aIndexes[]`, `bIndexes[]`: segment endpoints by particle index
  - `lineWidth` (1.5)
  - `lineColorR/G/B` (-1/-1/-1): negative = use particle color
- Helpers: `setLines([...])`, `add({ aIndex, bIndex })`, `remove(a,b)`, `setLineWidth(v)`, `setLineColor(color|null)`

```ts
const lines = new Lines({ lines: [{ aIndex: 0, bIndex: 1 }] });
lines.setLineWidth(2);
```

---

### Tips

- Start with a small number of modules enabled; add more as needed.
- Increase `cellSize` for sparser scenes; reduce it for dense ones.
- WebGPU: prefer `runtime: "auto"` and let the engine fall back if needed.
