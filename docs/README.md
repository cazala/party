# Party 🎉

Party is a high-performance TypeScript particle system and physics engine for
the web. It runs simulations with WebGPU compute when available and falls back
to a CPU runtime, giving you one API for everything from small interactive
effects to large real-time particle scenes.

[Open the playground](https://caza.la/party/) ·
[View on npm](https://www.npmjs.com/package/@cazala/party) ·
[View on GitHub](https://github.com/cazala/party)

## What can you build with Party?

Use Party for interactive particle effects, generative art, physics sketches,
flocking and swarm behavior, fluid-like motion, connected particle systems,
and custom simulations. The included playground lets you explore the engine
and share scenes before writing any code.

## Key features

- **WebGPU and CPU runtimes** — use GPU compute for large simulations, with an
  automatic CPU fallback for broader browser compatibility.
- **Modular physics** — combine gravity, boundaries, collisions, flocking,
  fluids, sensors, joints, pointer interaction, and particle grabbing.
- **Composable rendering** — render particles and connecting lines, then add
  configurable trail decay and diffusion.
- **One TypeScript API** — create, query, update, pin, remove, and serialize
  particles the same way on either runtime.
- **Designed for scale** — spatial-grid neighbor lookup and local particle
  queries avoid unnecessary full-scene work and GPU readbacks.
- **Live parameters** — enable modules at runtime and animate any numeric input
  with oscillators.
- **Extensible on both runtimes** — author custom force and render modules with
  CPU and WebGPU implementations.
- **Interactive playground** — experiment with modules, tools, presets, and
  shareable sessions at [caza.la/party](https://caza.la/party/).

## Quick start

Install the package:

```bash
npm install @cazala/party
```

Create an engine, add a few modules and particles, then start the simulation:

```ts
import {
  Boundary,
  Collisions,
  Engine,
  Environment,
  Particles,
  Trails,
} from "@cazala/party";

const canvas = document.querySelector<HTMLCanvasElement>("#party")!;

const engine = new Engine({
  canvas,
  runtime: "auto",
  forces: [
    new Environment({
      gravityStrength: 600,
      gravityDirection: "down",
      friction: 0.01,
    }),
    new Boundary({
      mode: "bounce",
      restitution: 0.9,
      friction: 0.1,
    }),
    new Collisions({ restitution: 0.85 }),
  ],
  render: [
    new Trails({ trailDecay: 10, trailDiffuse: 4 }),
    new Particles({ colorType: 2, hue: 0.55 }),
  ],
});

await engine.initialize();

for (let i = 0; i < 500; i++) {
  engine.addParticle({
    position: {
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
    },
    velocity: {
      x: (Math.random() - 0.5) * 4,
      y: (Math.random() - 0.5) * 4,
    },
    size: 3 + Math.random() * 5,
    mass: 1,
    color: { r: 1, g: 1, b: 1, a: 1 },
  });
}

engine.play();
```

`runtime: "auto"` tries WebGPU first and falls back to CPU during
`initialize()`. You can also request `"webgpu"` or `"cpu"` explicitly. The
rest of the engine API stays the same.

## Where to go next

- **[Engine user guide](./user-guide.md)** — learn the engine API, particle
  model, built-in modules, oscillators, serialization, and performance
  patterns.
- **[Module author guide](./module-author-guide.md)** — build custom force and
  render modules for both CPU and WebGPU.
- **[Playground user guide](./playground-user-guide.md)** — learn the visual
  tools, hotkeys, sessions, and workflow.

## Contributing and internals

- **[Engine maintainer guide](./maintainer-guide.md)** — understand the module
  lifecycle, runtime architecture, pipelines, resources, and spatial grid.
- **[Playground maintainer guide](./playground-maintainer-guide.md)** — explore
  the React, Redux, hooks, tools, and engine integration patterns.

Party is released under the MIT License.
