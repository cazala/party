## Module Author Guide

This guide explains how to build your own modules for the engine. There are two public roles you can implement:

- **Force**: runs in the simulation pipeline; can add to `acceleration`/`velocity` and perform constraints/corrections
- **Render**: runs in the rendering pipeline; can draw fullscreen, draw per-instance quads, or compute over the scene texture

Modules should support both runtimes when possible:

- CPU: implement a `cpu()` descriptor
- WebGPU: implement a `webgpu()` descriptor

If you only implement one runtime, the other will be unsupported on that module. The top-level `Engine#isSupported(module)` can be used to test support.

### Module base class

Create a TypeScript class extending `Module<Name, Inputs, StateKeys?>` and declare:

- `name`: string literal, globally unique
- `role`: `ModuleRole.Force` or `ModuleRole.Render`
- `inputs`: a map of input names to `DataType.NUMBER` or `DataType.ARRAY`

The base class provides:

- `write(partialInputs)` and `read()/readValue(key)/readArray(key)`
- `setEnabled(boolean)` and `isEnabled()`
- Uniform plumbing (the engine binds inputs into GPU buffers automatically)

Example skeleton

```ts
import {
  Module,
  ModuleRole,
  DataType,
  type WebGPUDescriptor,
  type CPUDescriptor,
} from "@cazala/party";

type WindInputs = { strength: number; dirX: number; dirY: number };

export class Wind extends Module<"wind", WindInputs> {
  readonly name = "wind" as const;
  readonly role = ModuleRole.Force;
  readonly inputs = {
    strength: DataType.NUMBER,
    dirX: DataType.NUMBER,
    dirY: DataType.NUMBER,
  } as const;

  constructor() {
    super();
    this.write({ strength: 100, dirX: 1, dirY: 0 });
  }

  webgpu(): WebGPUDescriptor<WindInputs> {
    return {
      apply: ({ particleVar, getUniform }) => `{
        let d = vec2<f32>(${getUniform("dirX")}, ${getUniform("dirY")});
        let l = length(d);
        if (l > 0.0) { ${particleVar}.acceleration += normalize(d) * ${getUniform(
        "strength"
      )}; }
      }`,
    };
  }

  cpu(): CPUDescriptor<WindInputs> {
    return {
      apply: ({ particle, input }) => {
        const len = Math.hypot(input.dirX, input.dirY) || 1;
        particle.acceleration.x += (input.dirX / len) * input.strength;
        particle.acceleration.y += (input.dirY / len) * input.strength;
      },
    };
  }
}
```

### Force module lifecycles

Both runtimes support a subset of hooks. Implement only the ones you need:

- `global()`: injects global WGSL helpers (WebGPU only)
- `state(...)`: per-particle pre-pass to compute and store state (e.g., fluid density)
- `apply(...)`: add forces via `acceleration` or adjust `velocity`
- `constrain(...)`: position constraints (runs multiple iterations per frame)
- `correct(...)`: correct velocities post-integration

WebGPU descriptor context includes helpers such as:

- `getUniform(name[, indexExpr])`
- `getState(name[, indexExpr])` and `setState(name, expr)`
- `getLength(arrayName)` for array-backed inputs
- Neighbor iteration utilities (e.g., `neighbor_iter_init(position, radius)`)

CPU descriptor context includes helpers such as:

- `getNeighbors(position, radius)` for neighbor queries
- `getImageData(x, y, w, h)` for sampling the canvas (used by sensors)
- `view` camera/zoom access

See built-in forces for examples:

- [`Environment`](../packages/core/src/modules/forces/environment.ts): global forces and damping
- [`Boundary`](../packages/core/src/modules/forces/boundary.ts): bounds, warp/kill, tangential friction, optional repulsion
- [`Collisions`](../packages/core/src/modules/forces/collisions.ts): pairwise collision response with position correction
- [`Behavior`](../packages/core/src/modules/forces/behavior.ts): boids-like steering
- [`Fluids`](../packages/core/src/modules/forces/fluids.ts): SPH-like density and pressure with state + apply
- [`Sensors`](../packages/core/src/modules/forces/sensors.ts): trail/color sampling steering
- [`Interaction`](../packages/core/src/modules/forces/interaction.ts): mouse-driven attract/repel
- [`Joints`](../packages/core/src/modules/forces/joints.ts): distance constraints with collision options and momentum preservation
- [`Grab`](../packages/core/src/modules/forces/grab.ts): single-particle grabbing during drag

### Render modules

Render modules contribute passes to the render pipeline.

WebGPU render descriptor

- Fullscreen pass: `{ kind: RenderPassKind.Fullscreen, vertex?, fragment, bindings, readsScene, writesScene }`
- Compute pass over the scene texture: `{ kind: RenderPassKind.Compute, kernel, bindings, readsScene, writesScene }`
- Instanced fullscreen: `{ instanced: true, instanceFrom: "someArrayInput" }` (see [`Lines`](../packages/core/src/modules/render/lines.ts))

CPU render descriptor

- `composition`: how the module participates in the canvas draw order (`RequiresClear`, `HandlesBackground`, `Additive`, etc.)
- `setup(...)` and/or `render(...)` callbacks that receive screen-space coordinates, utilities, and the 2D context

Examples in core:

- [`Particles`](../packages/core/src/modules/render/particles.ts): fullscreen draw of instanced particles; custom color and hue modes; ring style for pinned particles
- [`Trails`](../packages/core/src/modules/render/trails.ts): compute-like two-pass effect (decay + blur) or canvas equivalents on CPU
- [`Lines`](../packages/core/src/modules/render/lines.ts): instanced line quads on GPU, stroke lines on CPU

### Arrays and large inputs

- Declare array inputs with `DataType.ARRAY` (e.g., index lists for [`Lines`](../packages/core/src/modules/render/lines.ts)/[`Joints`](../packages/core/src/modules/forces/joints.ts)).
- WebGPU path uploads them to buffers; CPU path receives them as JS arrays.
- Use `getLength(name)` and `getUniform(name, indexExpr)` in WGSL to read items.

### Spatial grid and neighbor queries

- The engine maintains a spatial grid sized by `cellSize` for neighbor queries.
- WebGPU exposes lightweight neighbor iterators; CPU provides `getNeighbors()`.
- Tune `cellSize` and `maxNeighbors` via the engine for performance vs. accuracy.

### Supporting both runtimes

When possible:

- Implement both `webgpu()` and `cpu()` for feature parity.
- Keep numeric scales similar across runtimes (e.g., damping factors) so scenes feel consistent.
- For images/trails sampling, prefer engine-provided helpers over direct DOM access on CPU.

### Testing modules

- Instantiate your module in the playground or your app and include it in the `forces` or `render` arrays.
- Use `runtime: "auto"` and confirm behavior matches on both CPU and WebGPU.
- Validate export/import: the engine will serialize and restore your module inputs automatically.

### Cross-references

- See also: [`user-guide.md`](./user-guide.md) for how users wire modules into an engine.
- See also: [`maintainer-guide.md`](./maintainer-guide.md) for internal architecture details.
