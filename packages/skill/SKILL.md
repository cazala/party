---
name: party
description: Build creative particle effects, generative art, interactive physics scenes, and production integrations with @cazala/party across WebGPU and CPU. Use when creating or tuning simulations, composing modules, spawning shape/text/image particles, translating Party playground demos into code, optimizing performance, or authoring custom modules.
---

# Party

Build a visible result first, then tune it. Treat a Party scene as four layers:

1. Spawn geometry and initial velocity.
2. One or two primary force modules.
3. Render treatment such as trails, lines, or color.
4. Slow animation of a few meaningful parameters.

## Start with a working scene

Use semantic enums and create particles before calling `play()`:

```ts
import {
  Behavior,
  Boundary,
  Engine,
  Particles,
  ParticlesColorType,
  Spawner,
  Trails,
} from "@cazala/party";

const canvas = document.querySelector<HTMLCanvasElement>("canvas")!;
const width = window.innerWidth;
const height = window.innerHeight;

const forces = [
  new Boundary({ mode: "warp" }),
  new Behavior({
    wander: 18,
    cohesion: 1.4,
    alignment: 4,
    separation: 35,
    viewRadius: 80,
  }),
];
const render = [
  new Trails({ trailDecay: 8, trailDiffuse: 1 }),
  new Particles({ colorType: ParticlesColorType.Hue, hue: 0.62 }),
];
const particles = new Spawner().initParticles({
  count: 4_000,
  shape: "donut",
  center: { x: 0, y: 0 },
  radius: Math.min(width, height) * 0.38,
  innerRadius: Math.min(width, height) * 0.12,
  size: 2.5,
  mass: 1,
  velocity: { speed: 120, direction: "clockwise" },
  colors: ["#ffffff"],
});

const engine = new Engine({
  canvas,
  forces,
  render,
  runtime: "auto",
  cellSize: 40,
  maxNeighbors: 128,
});

await engine.initialize();
engine.setSize(width, height);
engine.setParticles(particles);
engine.addOscillator({
  moduleName: "particles",
  inputName: "hue",
  min: 0,
  max: 1,
  speedHz: 0.01,
});
engine.play();
```

Copy [the full Vite starter](assets/starter/) when building a new app. It includes responsive sizing, pointer interaction, cleanup, and five selectable scenes. Read its [tested scene source](assets/starter/src/scenes.ts) when adapting a recipe.

## Choose modules by visual intent

| Intent | Start with |
| --- | --- |
| Falling, bouncing particles | `Environment` + `Boundary`; add `Collisions` if particles must hit each other |
| Orbital motion | Tangential Spawner velocity + inward `Environment` |
| Swarms and flocking | `Behavior`; add `Trails` for readable motion |
| Slime-mold filaments | `Sensors` + `Trails` + a warp `Boundary` |
| Liquid or viscous blobs | `Fluids` + `Boundary`; add gravity or pointer `Interaction` |
| Pointer fields | `Interaction` for attract/repel or `Grab` for one particle |
| Ropes and structures | `Joints` + `Lines` |
| Text/image dissolves | Text/image `Spawner` + outward velocity + `Trails` or `Behavior` |

Use the smallest combination that expresses the idea. Adding every module usually makes the motion harder to control.

## Work creatively

1. Define the desired silhouette and motion in one sentence.
2. Select the matching composition above.
3. Start with 2,000–5,000 particles so CPU fallback remains useful.
4. Tune spawn speed and the primary force before adding effects.
5. Add trails or color only after the motion reads clearly.
6. Oscillate one to three inputs slowly; avoid animating everything.
7. Inspect the scene near startup and after several seconds. Fix blank, explosive, static, or visually noisy states before increasing particle count.

Read [creative-workflow.md](references/creative-workflow.md) for parameter intuition and iteration guidance. Read [recipes.md](references/recipes.md) for five compositions derived from Party playground demos.

## Preserve runtime performance

- Use `runtime: "auto"` unless the user requires a specific runtime.
- Treat `getParticles()` as an expensive full WebGPU-to-CPU readback. Never call it in an animation, pointer-move, or drag loop.
- Use `await engine.getParticlesInRadius(...)` for bounded local queries.
- Prefer `setParticle(...)` and `setParticleMass(...)` for local mutations.
- Keep `cellSize` near the largest active neighborhood radius, and cap `maxNeighbors` deliberately.
- Scale particle count after the composition works. Large playground demos are WebGPU showcase budgets, not safe defaults.

## Load the right detail

- Read [api.md](references/api.md) for particle shape, lifecycle, modules, spawning, interaction, and queries.
- Read [creative-workflow.md](references/creative-workflow.md) before inventing or substantially tuning a visual scene.
- Read [recipes.md](references/recipes.md) when adapting a known effect or playground demo.
- Read [troubleshooting.md](references/troubleshooting.md) when output is blank, unstable, slow, or visually weak.
- Read the repository `docs/module-author-guide.md` only when authoring a new force or render module from a full Party checkout.

## Validate the result

- Compile the implementation; do not rely on plausible-looking option names.
- Confirm particles are spawned after initialization and the canvas has a non-zero size.
- Exercise CPU fallback with a reduced count when practical.
- Verify pointer coordinates are converted from screen space to Party world space.
- Remove listeners and call `await engine.destroy()` during teardown.
- Visually inspect the running scene. A successful creative task must be coherent and interesting, not merely error-free.
