# Party 🎉 - [caza.la/party](https://caza.la/party)

A high-performance particle physics simulation system with interactive playground, built with TypeScript and WebGPU/CPU dual runtime support.

## Key Features

- **Dual Runtime Architecture**: Auto-selection between WebGPU (GPU compute) and CPU fallback for maximum compatibility
- **High Performance**: Spatial grid optimization, configurable workgroup sizes, and efficient neighbor queries
- **Modular Force System**: Environment, boundary, collisions, behavior (flocking), fluid dynamics (SPH + PIC/FLIP), sensors, joints, interaction, and grab modules
- **Advanced Rendering**: Trails with decay/diffusion, particle instancing, line rendering, and multiple color modes
- **Grid Simulations**: Built-in grid modules (Game of Life, reaction-diffusion, elementary cellular automata)
- **Playground Sessions**: Save/load/share sessions (module settings, oscillators, and optional particles/joints)
- **Real-time Oscillators**: Animate any module parameter with configurable frequency and bounds
- **Interactive Playground**: React-based interface with undo/redo, hotkeys, and live parameter adjustment
- **Text/Image Spawner**: Spawn particles from text or images in the core spawner and INIT UI

## Documentation

Comprehensive documentation is available in the [`docs/`](./docs) directory:

- **[User Guide](./docs/user-guide.md)**: Complete guide for using the core library as an end user. Covers engine API, runtime selection, module configuration, particle management, oscillators, and all built-in force and render modules with examples.

- **[Module Author Guide](./docs/module-author-guide.md)**: Step-by-step guide for creating custom force and render modules. Covers the module lifecycle, input/output system, CPU and WebGPU implementations, and best practices.

- **[Maintainer Guide](./docs/maintainer-guide.md)**: Internal architecture documentation for contributors. Explains code organization, dual runtime system (CPU/WebGPU), module system, spatial grid, pipelines, oscillators, and how to extend the system.

- **[Playground User Guide](./docs/playground-user-guide.md)**: Guide for using the interactive playground application. Covers the UI, tools, session management, oscillators, hotkeys, and workflow tips.

- **[Playground Maintainer Guide](./docs/playground-maintainer-guide.md)**: Technical documentation for maintaining and extending the playground. Covers architecture, state management (Redux), component structure, hooks, tools system, and development workflows.

## Packages

This is a monorepo containing:

### [@cazala/party](./packages/core) - Core Engine

The heart of the system - a TypeScript particle physics engine featuring:

- **Engine**: Unified API with automatic WebGPU/CPU runtime selection
- **Modular Architecture**: Pluggable force and render modules with lifecycle management
- **Spatial Optimization**: Efficient neighbor queries via spatial grid partitioning
- **Advanced Physics**: Gravity, collisions, flocking, fluid dynamics, joints, and more
- **Oscillators**: Animate any module parameter over time with smooth interpolation
- **Configuration Export/Import**: Serialize complete simulation states

### [Playground](./packages/playground) - Interactive Application

A React-based web application providing:

- **Visual Interface**: Real-time controls for all simulation parameters
- **Multiple Tools**: Interaction, spawn, remove, joint, grab, pin, draw, brush, and shape modes
- **Session System**: Save, load, rename, duplicate, and reorder sessions with drag-and-drop
- **Oscillator UI**: Visual sliders with speed cycling and parameter automation
- **Hotkeys**: Cmd/Ctrl + A/S/D/F/G/H/J/K/L for tools, Cmd/Ctrl + B for sidebar toggle, plus undo/redo and quick-load shortcuts
- **Undo/Redo**: Full history system for non-destructive editing

### [`worker`](./packages/worker) - Cloudflare Worker

A route-scoped reverse proxy that serves the playground at `caza.la/party` while proxying to `party.caza.la`.

### [`skill`](./packages/skill) - Party Skill

Agent skill for the `@cazala/party` library.

Install with:

```bash
npx skills add cazala/party
```

## Quick Start

### Installation

```bash
# Clone the repository
git clone https://github.com/cazala/party.git
cd party

# Install dependencies
npm run setup

# Start the playground in development mode
npm run dev
```

Visit `http://localhost:3000` to access the interactive playground.

> **Note**: This project uses pnpm workspaces internally for optimal monorepo management, but all commands are available through npm scripts. You only need npm installed.

### Using the Core Library

```typescript
import {
  Engine,
  // Force modules
  Environment,
  Boundary,
  Collisions,
  Behavior,
  Fluids,
  // Render modules
  Particles,
  Trails,
} from "@cazala/party";

const canvas = document.querySelector("canvas")!;

const forces = [
  // Environmental physics
  new Environment({
    gravityStrength: 600,
    gravityDirection: "down",
    inertia: 0.05,
    friction: 0.01,
  }),

  // Boundary interactions
  new Boundary({
    mode: "bounce",
    restitution: 0.9,
    friction: 0.1,
  }),

  // Particle collisions
  new Collisions({ restitution: 0.85 }),

  // Flocking behavior
  new Behavior({
    cohesion: 1.5,
    alignment: 1.2,
    separation: 12,
    viewRadius: 100,
  }),

  // Fluid dynamics (SPH by default; can switch to PIC/FLIP with setMethod)
  new Fluids({
    influenceRadius: 80,
    pressureMultiplier: 25,
    viscosity: 0.8,
  }),
];

const render = [
  new Trails({ trailDecay: 10, trailDiffuse: 4 }),
  new Particles({ colorType: 2, hue: 0.55 }), // Hue-based coloring
];

const engine = new Engine({
  canvas,
  forces,
  render,
  runtime: "auto", // Auto-selects WebGPU when available, fallback to CPU
});

await engine.initialize();

// Add some particles
for (let i = 0; i < 100; i++) {
  engine.addParticle({
    position: { x: Math.random() * canvas.width, y: Math.random() * canvas.height },
    velocity: { x: (Math.random() - 0.5) * 4, y: (Math.random() - 0.5) * 4 },
    mass: 1 + Math.random() * 2,
    size: 3 + Math.random() * 7,
    color: { r: 1, g: 1, b: 1, a: 1 },
  });
}

engine.play();
```

## Architecture

### Engine Runtime Selection

Runtime behavior is straightforward:

- `runtime: "webgpu"`: use the WebGPU runtime.
- `runtime: "cpu"`: use the CPU runtime.
- `runtime: "auto"`: try WebGPU first during `initialize()`, then fall back to CPU if WebGPU initialization fails.

After initialization, you use the same `Engine` API regardless of which runtime is active.

### Module System

The engine runs modules by role each frame:

- **Force modules** update simulation state using the force lifecycle (`state` → `apply` → `constrain` → `correct`).
- **Render modules** draw the current simulation state.
- **Oscillators** animate module inputs over time, without changing module wiring.

Modules are registered once and then executed each frame according to their role.

### Force System Lifecycle

The force system uses a multi-phase lifecycle for optimal performance:

1. **state**: Global pre-computation (e.g., fluid density calculation)
2. **apply**: Per-particle force application (acceleration/velocity changes)
3. **constrain**: Position corrections and constraints (iterative)
4. **correct**: Post-integration velocity corrections

### Available Modules

#### Force Modules

- **Environment**: Gravity, inertia, friction, and damping with directional/radial options
- **Boundary**: Boundary interactions (bounce, kill, warp) with repel forces and friction
- **Collisions**: Particle-particle collision detection and elastic response
- **Behavior**: Flocking behaviors (cohesion, alignment, separation, wander, chase/avoid)
- **Fluids**: Switchable SPH or PIC/FLIP method with density/pressure, viscosity, and method-specific tuning controls
- **Sensors**: Trail-following and color-based steering with configurable behaviors
- **Interaction**: User-controlled attraction/repulsion with falloff
- **Joints**: Distance constraints between particles with momentum preservation
- **Grab**: Efficient single-particle mouse/touch dragging

#### Render Modules

- **Particles**: Instanced particle rendering with multiple color modes and pinned particle visualization
- **Trails**: Decay and diffusion effects with performance-optimized compute passes
- **Lines**: Line rendering between particle pairs with configurable styling

## Development

### Setup

```bash
# Install dependencies for all packages
npm run setup

# Build the core library
npm run build:core

# Start development server for playground
npm run dev

# Build everything for production
npm run build

# Type check all packages
npm run type-check
```

## Performance

### WebGPU Runtime

- **GPU Compute**: Parallel particle processing with configurable workgroup sizes
- **Spatial Grid**: GPU-accelerated neighbor queries
- **Memory Efficiency**: Optimized buffer layouts and minimal CPU-GPU transfers
- **Scalability**: Handles thousands of particles at 60+ FPS

### CPU Runtime

- **Fallback Compatibility**: Works on all devices without WebGPU support
- **Spatial Optimization**: Efficient neighbor queries via spatial partitioning
- **Canvas2D Rendering**: Hardware-accelerated 2D graphics
- **Memory Management**: Minimal allocations in tight loops

### Configuration

- **cellSize**: Spatial grid resolution (8-64 typical)
- **maxNeighbors**: Neighbor query limit (64-256 typical)
- **constrainIterations**: Constraint solver iterations (CPU: ~5, WebGPU: ~50)
- **workgroupSize**: WebGPU compute workgroup size (32-256)
- **maxParticles**: Limit the number of particles processed in simulation and rendering. When set to a number, only particles with index < `maxParticles` are processed. Set to `null` (default) to process all particles. Useful for performance tuning. 

## Browser Support

- **WebGPU**: Chrome 113+, Edge 113+, Safari 18+, Firefox
- **Mobile**: iOS 18+ (Safari), Android (Chrome 113+)
- **CPU Fallback**: All modern browsers with Canvas2D support
- **Auto-Detection**: Seamless fallback when WebGPU is unavailable

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Contributing

We welcome contributions! Please see our [maintainer guide](docs/maintainer-guide.md) for architecture details and [module author guide](docs/module-author-guide.md) for creating custom modules.
