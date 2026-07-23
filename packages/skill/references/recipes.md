# Creative recipes

These recipes distill Party playground demos into smaller starting points suitable for generated apps and CPU fallback. Copy the complete, tested implementations from `assets/starter/src/scenes.ts`, then tune one layer at a time.

## Recipe index

| Recipe | Spawn | Primary motion | Visual signature |
| --- | --- | --- | --- |
| Neon vortex | Donut, clockwise | Inward gravity + flocking | Persistent hue-shifting trails |
| Slime filaments | Random field | Trail-sampling sensors | Branching self-following paths |
| Viscous ink | Dense random cloud | SPH + collisions | Dark cohesive blob on a light field |
| PIC/FLIP liquid | Compact grid | PIC/FLIP + gravity | Splashing colored sheet |
| Living word | Text | Pointer repulsion | Readable type that disperses under the pointer |

The original playground demos use tens of thousands of particles and wide camera views. These versions deliberately use smaller counts and viewport-relative dimensions.

## Neon vortex

Use a donut spawn with tangential velocity so the composition is visible before forces settle. Add inward gravity to retain the ring and moderate flocking to create coherent strands.

```ts
const forces = [
  new Environment({ gravityStrength: 750, gravityDirection: "inwards" }),
  new Boundary({ mode: "warp" }),
  new Behavior({
    wander: 12,
    cohesion: 1.5,
    alignment: 4.8,
    repulsion: 3,
    separation: 42,
    viewRadius: 90,
    viewAngle: Math.PI * 2,
  }),
];

const particles = new Spawner().initParticles({
  count: 5_000,
  shape: "donut",
  center: { x: 0, y: 0 },
  radius: Math.min(width, height) * 0.42,
  innerRadius: Math.min(width, height) * 0.12,
  velocity: { speed: 150, direction: "clockwise" },
  size: 2.5,
  mass: 1,
});
```

Render with `Trails({ trailDecay: 8, trailDiffuse: 1 })` and hue particles. Oscillate `particles.hue` from `0` to `1` at about `0.01 Hz`. If the ring collapses, reduce inward gravity; if it becomes a uniform band, increase wander or separation slightly.

## Slime filaments

Sensors sample the scene texture ahead of each particle. With trails enabled, particles create the field they subsequently follow, producing branching paths.

```ts
const sensors = new Sensors({
  sensorDistance: 20,
  sensorAngle: Math.PI / 4.5,
  sensorRadius: 3,
  sensorThreshold: 0.02,
  sensorStrength: 2_200,
  followBehavior: "any",
  fleeBehavior: "none",
});

const forces = [new Boundary({ mode: "warp" }), sensors];
const render = [
  new Trails({ trailDecay: 9, trailDiffuse: 0 }),
  new Particles({ colorType: ParticlesColorType.Hue, hue: 0.08 }),
];
```

Spawn a random field with random velocity around `100–160`. Slowly oscillate `sensorDistance` between roughly `18` and `70`, `sensorAngle` between `0.3` and `0.8` radians, and hue. If the screen becomes solid, increase trail decay or reduce count. If paths do not form, confirm Trails renders before Particles and lower the sensor threshold.

## Viscous ink

Use SPH for local density/viscosity and collisions for a heavy, cohesive mass. A light clear color and dark particles create an ink-like graphic without a CSS inversion filter.

```ts
const forces = [
  new Boundary({ mode: "bounce", restitution: 0, friction: 1 }),
  new Collisions({ restitution: 0.25 }),
  new Fluids({
    method: FluidsMethod.Sph,
    influenceRadius: 58,
    targetDensity: 0.8,
    pressureMultiplier: 70,
    viscosity: 7.5,
    nearPressureMultiplier: 20,
    nearThreshold: 30,
    enableNearPressure: true,
    maxAcceleration: 45,
  }),
];
```

Spawn a compact random cloud with low outward velocity, particle size around `3`, and mass around `0.3`. Use a `cellSize` close to the influence radius and raise `maxNeighbors` only as needed. Fluids are sensitive to density and scale; tune count, bounds, mass, radius, and target density together.

## PIC/FLIP liquid

Begin with a compact grid so density is predictable. Use a bounce boundary and downward gravity, then stir it with pointer interaction.

```ts
const interaction = new Interaction({
  mode: "repel",
  strength: 7_000,
  radius: 180,
});

const forces = [
  new Environment({ gravityStrength: 420, gravityDirection: "down" }),
  new Boundary({ mode: "bounce", restitution: 0.25, friction: 0.08 }),
  new Fluids({
    method: FluidsMethod.Picflip,
    influenceRadius: 44,
    targetDensity: 2,
    pressureMultiplier: 420,
    flipRatio: 0.2,
  }),
  interaction,
];
```

Spawn a grid with spacing around `7`, zero velocity, and 4,000–6,000 particles. Lower `flipRatio` for smoother PIC-like motion; raise it for more energetic FLIP-like motion. Do not pass SPH-only settings such as viscosity or near pressure to a PIC/FLIP constructor.

## Living word

Text spawning turns Canvas2D glyph pixels into particles. Keep the initial speed at zero so the word remains readable, then use pointer repulsion to make it disperse on demand.

```ts
const particles = new Spawner().initParticles({
  count: 12_000,
  shape: "text",
  text: "PARTY",
  font: "sans-serif",
  textSize: Math.min(width * 0.18, 180),
  center: { x: 0, y: 0 },
  position: { x: 0, y: 0 },
  align: { horizontal: "center", vertical: "center" },
  velocity: { speed: 0, direction: "out" },
  size: 3,
  mass: 1,
  colors: ["#f7f7ff", "#8be9fd", "#bd93f9"],
});
```

Use a warp `Boundary`, Trails, and a repel `Interaction`. Text sampling may return fewer particles than requested because the count is capped by sampled glyph pixels. Keep zero initial velocity and let interaction provide the dramatic motion.

## Adapting a recipe

Change in this order:

1. Scale spawn dimensions to the target viewport.
2. Establish the desired speed and containment.
3. Tune the primary force system.
4. Choose the palette and trail persistence.
5. Add pointer interaction.
6. Add no more than three slow oscillators.
7. Increase particle count only after testing both the selected runtime and fallback behavior.
