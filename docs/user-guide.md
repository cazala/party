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
  new Environment({ gravityStrength: 0, inertia: 0.05, friction: 0.01 }),
  new Boundary({ mode: "bounce", restitution: 0.9, friction: 0.1 }),
  new Collisions({ restitution: 0.8 }),
  new Behavior({ enabled: false }),
  new Fluids({ enabled: false }),
  new Sensors({ enabled: false }),
  new Interaction({ enabled: false }),
  new Joints({ enabled: false }),
  new Grab({ enabled: false }),
];

const render = [new Trails({ trailDecay: 8 }), new Lines(), new Particles()];

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

### Runtime selection

- Use `runtime: "auto"` unless you explicitly need one runtime.
- WebGPU unlocks large particle counts and GPU compute; CPU offers maximum compatibility.

### Camera and coordinates

- World coordinates are independent of canvas pixels; `setCamera(x,y)` centers the view and `setZoom(z)` controls scale.
- Bounds-aware modules (e.g., `Boundary`) use the camera and zoom to compute visible extents consistently across runtimes.

### Oscillators

Oscillators modulate module inputs continuously over time.

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
```

Inputs are addressed by the module’s input keys (documented per module below). Oscillators write values exactly as if you had called the module’s setters.

---

## Built-in Modules

Modules come in two public roles:

- **Force**: contribute to simulation (acceleration/velocity/constraints)
- **Render**: draw into the scene texture or canvas

Each module exposes a `name` and typed `inputs`. You can toggle any module on/off with `module.setEnabled(boolean)` and read current inputs via `module.read()`; use `getModule(name)` to retrieve instances from the engine.

### Force modules

#### Environment (`environment`)

- Purpose: global gravity, inertia, friction, velocity damping
- Key inputs: `gravityStrength`, `dirX`, `dirY`, `inertia`, `friction`, `damping`, `mode`
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
- Modes: `"bounce" | "warp" | "kill" | "none"`
- Inputs: `restitution`, `friction`, `mode`, `repelDistance`, `repelStrength`

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
- Input: `restitution`

```ts
const collisions = new Collisions({ restitution: 0.8 });
```

#### Behavior (`behavior`)

- Purpose: boids-like steering (separation, alignment, cohesion, chase/avoid, wander)
- Inputs: `wander`, `cohesion`, `alignment`, `repulsion`, `chase`, `avoid`, `separation`, `viewRadius`, `viewAngle`

```ts
const behavior = new Behavior({
  cohesion: 1.5,
  alignment: 1.5,
  separation: 10,
  viewRadius: 100,
});
```

#### Fluids (`fluids`)

- Purpose: SPH-inspired fluid approximation
- Inputs: `influenceRadius`, `targetDensity`, `pressureMultiplier`, `viscosity`, `nearPressureMultiplier`, `nearThreshold`, `enableNearPressure`, `maxAcceleration`

```ts
const fluids = new Fluids({
  influenceRadius: 80,
  pressureMultiplier: 25,
  viscosity: 0.8,
});
```

#### Sensors (`sensors`)

- Purpose: trail/color sampling based steering (follow and/or flee)
- Inputs: `sensorDistance`, `sensorAngle`, `sensorRadius`, `sensorThreshold`, `sensorStrength`, `colorSimilarityThreshold`, `followBehavior`, `fleeBehavior`, `fleeAngle`

```ts
const sensors = new Sensors({
  sensorDistance: 30,
  sensorAngle: Math.PI / 6,
  followBehavior: "any",
});
```

#### Interaction (`interaction`)

- Purpose: point attract/repel under user control
- Inputs: `mode` (0 attract, 1 repel), `strength`, `radius`, `positionX`, `positionY`, `active`

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
- Inputs (arrays): `aIndexes`, `bIndexes`, `restLengths`, derived `groupIds` and CSR fields; scalars: `enableParticleCollisions`, `enableJointCollisions`, `momentum`, `restitution`, `separation`, `steps`, `friction`
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
- Inputs: `colorType` (Default|Custom|Hue), `customColorR/G/B`, `hue`

```ts
const particles = new Particles();
particles.setColorType(2); // Hue
particles.setHue(0.5);
```

#### Trails (`trails`)

- Purpose: decay + diffuse passes over the scene texture
- Inputs: `trailDecay`, `trailDiffuse`

```ts
const trails = new Trails({ trailDecay: 12, trailDiffuse: 4 });
```

#### Lines (`lines`)

- Purpose: draw lines between particle pairs (indices)
- Inputs: `aIndexes[]`, `bIndexes[]`, `lineWidth`, optional `lineColorR/G/B` override
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
