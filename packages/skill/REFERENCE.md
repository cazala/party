# Party Reference

Concise reference for the `@cazala/party` library (engine + modules + particles).

## Engine setup

```ts
const engine = new Engine({
  canvas,
  forces: [new Environment(), new Boundary(), new Collisions()],
  render: [new Trails(), new Particles()],
  runtime: "auto",
});

await engine.initialize();
engine.play();
```

## Particle shape

```ts
{
  position: { x: 0, y: 0 },
  velocity: { x: 0, y: 0 },
  size: 3,
  mass: 1,
  color: { r: 1, g: 1, b: 1, a: 1 },
}
```

Pinned: `mass < 0`  
Removed: `mass === 0`

## Core API

Lifecycle:

- `initialize()`, `play()`, `pause()`, `stop()`, `destroy()`

View:

- `getSize()`, `setSize(w,h)`, `setCamera(x,y)`, `setZoom(z)`

Particles:

- `addParticle(p)`, `setParticles(p[])`, `setParticle(i,p)`
- `setParticleMass(i,mass)`, `getParticle(i)`, `clear()`

Queries:

- `getParticlesInRadius(center, radius, { maxResults })`
- `getCount()`, `getFPS()`

Modules:

- `getModule(name)` → module instance
- `module.setEnabled(bool)` + input setters

Serialization:

- `export()`, `import(settings)`

Oscillators:

- `addOscillator`, `removeOscillator`, `clearOscillators`

## Force modules

- `Environment`: gravity + inertia/friction/damping
- `Boundary`: bounce/warp/kill bounds, repel distance/strength
- `Collisions`: elastic-ish particle collisions
- `Behavior`: boids steering (cohesion/alignment/separation)
- `Fluids`: SPH density + pressure/viscosity
- `Sensors`: trail/color sampling steering
- `Interaction`: point attract/repel
- `Joints`: distance constraints
- `Grab`: single-particle dragging

## Render modules

- `Particles`: disc rendering, multiple color modes
- `Trails`: decay/diffuse scene texture
- `Lines`: line rendering between particle indices

## Performance tips

- WebGPU `getParticles()` is expensive; avoid in hot paths.
- Prefer `getParticlesInRadius`, `setParticle`, `setParticleMass`.
- Tune `cellSize`, `maxNeighbors`, `constrainIterations`, `maxParticles`.
