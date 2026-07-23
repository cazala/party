# Party API reference

Use this reference for application code. Consult the repository guides when authoring custom modules or changing Party internals.

## Particle shape

```ts
type IParticle = {
  position: { x: number; y: number };
  velocity: { x: number; y: number };
  size: number;
  mass: number;
  color: { r: number; g: number; b: number; a: number };
};
```

Color channels are floats from `0` through `1`. A particle with `mass < 0` is pinned; `mass === 0` marks it as removed.

## Engine lifecycle

```ts
const engine = new Engine({
  canvas,
  forces,
  render,
  runtime: "auto",
  constrainIterations: 1,
  cellSize: 40,
  maxNeighbors: 128,
  maxParticles: 10_000,
  clearColor: { r: 0, g: 0, b: 0, a: 1 },
});

await engine.initialize();
engine.setSize(width, height);
engine.setParticles(particles);
engine.play();

engine.pause();
engine.stop();
await engine.destroy();
```

`runtime: "auto"` attempts WebGPU and falls back to CPU during `initialize()`. Inspect the selected runtime with `engine.getActualRuntime()`.

## View and coordinates

- `getSize()` / `setSize(width, height)`
- `getCamera()` / `setCamera(x, y)`
- `getZoom()` / `setZoom(zoom)`
- `getClearColor()` / `setClearColor(color)`

The camera is the world coordinate at the canvas center. Convert a pointer from canvas coordinates to world coordinates with:

```ts
const camera = engine.getCamera();
const zoom = engine.getZoom();
const world = {
  x: camera.x + (screenX - canvas.clientWidth / 2) / zoom,
  y: camera.y + (screenY - canvas.clientHeight / 2) / zoom,
};
```

## Spawner

`new Spawner().initParticles(options)` returns `IParticle[]`.

- Shapes: `grid`, `random`, `circle`, `donut`, `square`, `text`, `image`
- Velocity directions: `random`, `in`, `out`, `clockwise`, `counter-clockwise`, `custom`
- Shared options: `count`, `center`, `size`, `mass`, `colors`, `velocity`
- Shape options: `spacing`, `bounds`, `radius`, `innerRadius`, `squareSize`, `cornerRadius`
- Text options: `text`, `font`, `textSize`, `position`, `align`
- Image options: `imageData`, `imageSize`, `position`, `align`

Text and image spawning require browser canvas APIs. Image spawning accepts decoded `ImageData`, not a URL.

## Particle operations

- `setParticles(particles)` replaces the complete collection efficiently.
- `addParticle(particle)` returns its index.
- `setParticle(index, particle)` updates one particle.
- `setParticleMass(index, mass)` pins, unpins, or removes without replacing everything.
- `clear()` removes all particles.
- `getCount()` and `getFPS()` are synchronous metrics.
- `getParticle(index)` and `getParticles()` are asynchronous.

Use bounded queries instead of full readback in interactive code:

```ts
const { particles, truncated } = await engine.getParticlesInRadius(
  { x: 0, y: 0 },
  120,
  { maxResults: 200 }
);
```

## Force modules

- `Environment`: directional, inward, or outward gravity; inertia, friction, damping.
- `Boundary`: `bounce`, `warp`, `kill`, or `none`; optional edge repulsion.
- `Collisions`: particle collision restitution.
- `Behavior`: wander, cohesion, alignment, repulsion, chase, avoid, separation.
- `Fluids`: `FluidsMethod.Sph` for particle-neighborhood fluid forces or `FluidsMethod.Picflip` for a PIC/FLIP-style velocity update.
- `Sensors`: sample rendered trails/colors ahead of particles and steer toward or away from them.
- `Interaction`: pointer-position attract or repel field.
- `Joints`: distance constraints between indexed particles.
- `Grab`: drag one indexed particle.

## Render modules

- `Particles`: particle discs. Use `ParticlesColorType.Default`, `.Custom`, or `.Hue`.
- `Trails`: persistent scene texture controlled by `trailDecay` and `trailDiffuse`.
- `Lines`: render line segments between indexed particles, usually with `Joints`.

Create module instances once, keep references to modules that need live updates, and use their setters:

```ts
const interaction = new Interaction({ mode: "repel", radius: 220 });
interaction.setPosition(world.x, world.y);
interaction.setActive(true);
```

## Oscillators

Oscillators animate numeric module inputs without rebuilding modules:

```ts
engine.addOscillator({
  moduleName: "particles",
  inputName: "hue",
  min: 0,
  max: 1,
  speedHz: 0.01,
});
```

Use `removeOscillator(moduleName, inputName)`, `clearModuleOscillators(name)`, or `clearOscillators()` to remove them.

## Serialization and configuration

- `engine.export()` / `engine.import(settings)` serialize module input settings.
- `setCellSize(value)` tunes the spatial grid.
- `setMaxNeighbors(value)` caps local neighbor work.
- `setConstrainIterations(value)` tunes constraint passes.
- `setMaxParticles(value | null)` caps simulation size.
