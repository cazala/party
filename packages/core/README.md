# @cazala/party

A high-performance TypeScript particle physics engine with dual runtime support (WebGPU compute + CPU fallback), modular architecture, and real-time parameter oscillation.

## Features

- **Dual Runtime Architecture**: Automatic WebGPU/CPU runtime selection with seamless fallback
- **GPU Compute Performance**: WebGPU shaders for parallel particle processing at scale
- **Modular Force System**: Pluggable physics modules with four-phase lifecycle
- **Spatial Grid Optimization**: Efficient O(1) neighbor queries for collision detection
- **Real-time Oscillators**: Animate any module parameter with configurable frequency and bounds
- **Advanced Rendering**: Trails, particle instancing, line rendering with multiple color modes
- **Export/Import Presets**: Export/import module settings (inputs + enabled state)
- **Cross-platform**: Works in all modern browsers with automatic feature detection

## Installation

```bash
npm install @cazala/party
```

> **Development Note**: This package is part of a pnpm workspace. For development, clone the full repository and use `npm run setup` from the root.

## Quick Start

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
  new Environment({
    gravityStrength: 600,
    gravityDirection: "down",
    inertia: 0.05,
    friction: 0.01,
  }),
  new Boundary({
    mode: "bounce",
    restitution: 0.9,
    friction: 0.1,
  }),
  new Collisions({ restitution: 0.85 }),
  new Behavior({
    cohesion: 1.5,
    alignment: 1.2,
    separation: 12,
    viewRadius: 100,
  }),
  new Fluids({
    influenceRadius: 80,
    pressureMultiplier: 25,
    viscosity: 0.8,
  }),
];

const render = [
  new Trails({ trailDecay: 10, trailDiffuse: 4 }),
  new Particles({ colorType: 2, hue: 0.55 }),
];

const engine = new Engine({
  canvas,
  forces,
  render,
  runtime: "auto", // Auto-selects WebGPU when available
});

await engine.initialize();

// Add particles
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

## Core Concepts

### Engine

The `Engine` class provides a unified API that automatically selects the best runtime:

```typescript
const engine = new Engine({
  canvas: HTMLCanvasElement,
  forces: Module[],      // Force modules
  render: Module[],      // Render modules
  runtime: "auto",       // "auto" | "webgpu" | "cpu"
  
  // Optional configuration
  constrainIterations: 50,    // Constraint solver iterations
  cellSize: 32,              // Spatial grid cell size
  maxNeighbors: 128,         // Max neighbors per particle
  maxParticles: 10000,       // WebGPU buffer allocation + effective sim/render cap
  clearColor: { r: 0, g: 0, b: 0, a: 1 }, // Background color
});

// Lifecycle
await engine.initialize();
engine.play();
engine.pause();
engine.stop();
await engine.destroy();

// State
const isPlaying = engine.isPlaying();
const fps = engine.getFPS();
const count = engine.getCount();

// Particles
engine.addParticle({
  position: { x, y },
  velocity: { x: vx, y: vy },
  mass,
  size,
  color: { r: 1, g: 1, b: 1, a: 1 },
});
engine.setParticles([...particles]);
const particles = await engine.getParticles();
engine.clear();

// View
engine.setSize(width, height);
engine.setCamera(x, y);
engine.setZoom(scale);

// Configuration
const config = engine.export();
engine.import(config);
```

### Runtime Selection

- **"auto"**: Tries WebGPU first, falls back to CPU if unavailable
- **"webgpu"**: GPU compute with WGSL shaders (Chrome 113+, Edge 113+)
- **"cpu"**: JavaScript simulation with Canvas2D rendering (universal compatibility)

```typescript
// Check which runtime is active
const runtime = engine.getActualRuntime(); // "webgpu" | "cpu"

// Test module support
const isSupported = engine.isSupported(module);
```

### Particles

Particles are simple data structures with physics properties:

```typescript
const particle = {
  position: { x: 100, y: 100 },   // Position
  velocity: { x: 1, y: -2 },      // Velocity
  mass: 2.5,                // Mass (negative = pinned)
  size: 8,                  // Visual size
  color: { r: 1, g: 0.42, b: 0.21, a: 1 }, // Color (0..1 floats)
};

// Bulk operations (preferred for performance)
engine.setParticles(particles);
const allParticles = await engine.getParticles();

// Individual operations
engine.addParticle(particle);
const singleParticle = await engine.getParticle(index);

// Pin/unpin helpers
engine.pinParticles([0, 1, 2]);
engine.unpinParticles([0, 1, 2]);
engine.unpinAll();
```

### Modules

Modules are pluggable components that contribute to simulation or rendering:

```typescript
// Force modules affect particle physics
const forces = [
  new Environment({ gravityStrength: 1000 }),
  new Boundary({ mode: "bounce" }),
  new Collisions({ restitution: 0.8 }),
];

// Render modules draw visual effects
const render = [
  new Particles({ colorType: 2, hue: 0.5 }),
  new Trails({ trailDecay: 10 }),
];

// Module control
const module = engine.getModule("environment");
module.setEnabled(false);
const isEnabled = module.isEnabled();

// Read/write module inputs
const inputs = module.read();
module.write({ gravityStrength: 500 });
```

## Available Modules

### Force Modules

#### Environment
Global physics: gravity, inertia, friction, damping

```typescript
new Environment({
  gravityStrength: 600,           // Gravity magnitude
  gravityDirection: "down",       // "up"|"down"|"left"|"right"|"inwards"|"outwards"|"custom"
  gravityAngle: Math.PI / 4,      // Custom angle (when direction = "custom")
  inertia: 0.05,                  // Momentum preservation (0-1)
  friction: 0.01,                 // Velocity damping (0-1)
  damping: 0.02,                  // Direct velocity reduction (0-1)
})
```

#### Boundary
Boundary interactions and containment

```typescript
new Boundary({
  mode: "bounce",                 // "bounce"|"warp"|"kill"|"none"
  restitution: 0.9,              // Bounce energy retention (0-1)
  friction: 0.1,                 // Tangential friction (0-1)
  repelDistance: 50,             // Distance to start repel force
  repelStrength: 0.5,            // Repel force magnitude
})
```

#### Collisions
Particle-particle collision detection and response

```typescript
new Collisions({
  restitution: 0.8,              // Collision elasticity (0-1)
})
```

#### Behavior
Flocking behaviors (boids-style steering)

```typescript
new Behavior({
  cohesion: 1.5,                 // Attraction to group center
  alignment: 1.2,                // Velocity matching
  repulsion: 2.0,                // Separation force
  separation: 12,                // Personal space radius
  viewRadius: 100,               // Neighbor detection radius
  viewAngle: Math.PI,            // Field of view (radians)
  wander: 20,                    // Random exploration
  chase: 0.5,                    // Pursue lighter particles
  avoid: 0.3,                    // Flee heavier particles
})
```

#### Fluids
Smoothed Particle Hydrodynamics (SPH) fluid simulation

```typescript
new Fluids({
  influenceRadius: 80,           // Particle interaction radius
  targetDensity: 1.0,            // Rest density
  pressureMultiplier: 25,        // Pressure force strength
  viscosity: 0.8,                // Internal friction
  nearPressureMultiplier: 40,    // Near-field pressure
  nearThreshold: 18,             // Near-field distance
  enableNearPressure: true,      // Enable near-field forces
  maxAcceleration: 60,           // Force clamping for stability
})
```

#### Sensors
Trail-following and color-based steering

```typescript
new Sensors({
  sensorDistance: 30,            // Sensor projection distance
  sensorAngle: Math.PI / 6,      // Sensor angle offset (30°)
  sensorRadius: 3,               // Sensor detection radius
  sensorThreshold: 0.15,         // Minimum detection threshold
  sensorStrength: 800,           // Steering force magnitude
  followBehavior: "any",         // "any"|"same"|"different"|"none"
  fleeBehavior: "none",          // "any"|"same"|"different"|"none"
  colorSimilarityThreshold: 0.5, // Color matching threshold
  fleeAngle: Math.PI / 2,        // Flee direction offset (90°)
})
```

#### Interaction
User-controlled attraction and repulsion

```typescript
const interaction = new Interaction({
  mode: "attract",               // "attract"|"repel"
  strength: 12000,               // Force magnitude
  radius: 300,                   // Interaction radius
  active: false,                 // Initially inactive
});

// Control interaction
interaction.setPosition(mouseX, mouseY);
interaction.setActive(true);
interaction.setMode("repel");
```

#### Joints
Distance constraints between particles

```typescript
const joints = new Joints({
  momentum: 0.7,                 // Momentum preservation (0-1)
  restitution: 0.9,             // Joint elasticity
  separation: 0.5,              // Separation force strength
  steps: 2,                     // Constraint iterations
  friction: 0.02,               // Joint friction
  enableParticleCollisions: false, // Particle-joint collisions
  enableJointCollisions: false,    // Joint-joint collisions
});

// Manage joints
joints.setJoints([
  { aIndex: 0, bIndex: 1, restLength: 50 },
  { aIndex: 1, bIndex: 2, restLength: 75 },
]);
joints.add({ aIndex: 2, bIndex: 3, restLength: 100 });
joints.remove(0, 1);
joints.removeAll();
```

#### Grab
Single-particle mouse/touch dragging

```typescript
const grab = new Grab();

// Grab particle
grab.grabParticle(particleIndex, { x: mouseX, y: mouseY });

// Update position
grab.updatePosition(newX, newY);

// Release
grab.releaseParticle();

// Check state
const isGrabbing = grab.isGrabbing();
```

### Render Modules

#### Particles
Instanced particle rendering with multiple color modes

```typescript
new Particles({
  colorType: 2,                  // 0=Default, 1=Custom, 2=Hue
  customColorR: 1.0,            // Custom color red (0-1)
  customColorG: 0.4,            // Custom color green (0-1)
  customColorB: 0.2,            // Custom color blue (0-1)
  hue: 0.55,                    // Hue value (0-1) when colorType=2
})

// Pinned particles render as rings
// Particle size and color come from particle data
```

#### Trails
Decay and diffusion effects

```typescript
new Trails({
  trailDecay: 10,               // Fade speed (higher = faster fade)
  trailDiffuse: 4,              // Blur amount (0-12 typical)
})
```

#### Lines
Line rendering between particle pairs

```typescript
const lines = new Lines({
  lineWidth: 2.0,               // Line thickness
  lineColorR: -1,               // Line color (-1 = use particle color)
  lineColorG: -1,
  lineColorB: -1,
});

// Manage lines
lines.setLines([
  { aIndex: 0, bIndex: 1 },
  { aIndex: 1, bIndex: 2 },
]);
lines.add({ aIndex: 2, bIndex: 3 });
lines.remove(0, 1);
lines.setLineColor("#ff0000"); // Or null for particle colors
```

## Oscillators

Oscillators animate module parameters over time with smooth interpolation:

```typescript
// Add oscillator to animate boundary restitution
engine.addOscillator({
  moduleName: "boundary",
  inputName: "restitution",
  min: 0.4,                     // Minimum value
  max: 0.95,                    // Maximum value
  speedHz: 0.2,                 // Frequency (cycles per second)
});

// Update oscillator parameters
engine.updateOscillatorSpeed("boundary", "restitution", 0.5);
engine.updateOscillatorBounds("boundary", "restitution", 0.2, 0.8);

// Remove oscillators
engine.removeOscillator("boundary", "restitution");
engine.clearModuleOscillators("boundary");
engine.clearOscillators();
```

## Configuration Management

Export and import complete simulation states:

```typescript
// Export current configuration
const config = engine.export();

// Configuration format
const config = {
  environment: {
    enabled: true,
    gravityStrength: 600,
    gravityDirection: "down",
    // ... all module inputs
  },
  boundary: {
    enabled: true,
    mode: "bounce",
    restitution: 0.9,
    // ... all module inputs
  },
  // ... all modules
};

// Import configuration
engine.import(config);

// Partial import (only specified modules)
engine.import({
  environment: { gravityStrength: 1000 },
  collisions: { restitution: 0.5 },
});
```

## Performance Optimization

### Spatial Grid

The engine uses spatial partitioning for efficient neighbor queries:

```typescript
engine.setCellSize(32);           // Smaller = more precise, larger = faster
engine.setMaxNeighbors(128);      // Higher = more accurate, slower
```

**Cell Size Guidelines:**
- Dense simulations: 16-32
- Sparse simulations: 64-128
- Rule of thumb: 2-4x average particle size

### Constraint Iterations

Control physics solver accuracy vs performance:

```typescript
engine.setConstrainIterations(50);  // Higher = more stable, slower
```

**Typical Values:**
- CPU: 5-10 iterations
- WebGPU: 20-100 iterations (GPU can handle more)

### WebGPU Configuration

```typescript
const engine = new Engine({
  runtime: "webgpu",
  workgroupSize: 64,            // 32, 64, 128, or 256
  maxParticles: 10000,          // Pre-allocate GPU buffers
});
```

## Advanced Usage

### Custom Modules

Create custom force modules by extending the Module class:

```typescript
import { Module, ModuleRole, DataType } from "@cazala/party";

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

  // WebGPU implementation
  webgpu() {
    return {
      apply: ({ particleVar, getUniform }) => `{
        let d = vec2<f32>(${getUniform("dirX")}, ${getUniform("dirY")});
        if (length(d) > 0.0) {
          ${particleVar}.acceleration += normalize(d) * ${getUniform("strength")};
        }
      }`,
    };
  }

  // CPU implementation
  cpu() {
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

### Error Handling

```typescript
try {
  await engine.initialize();
} catch (error) {
  if (error.message.includes("WebGPU")) {
    console.log("WebGPU not supported, falling back to CPU");
    // Engine automatically falls back when runtime: "auto"
  }
}

// Check module support
if (!engine.isSupported(customModule)) {
  console.warn("Custom module not supported in current runtime");
}
```

## Browser Support

- **WebGPU**: Chrome 113+, Edge 113+, Firefox Nightly (experimental)
- **CPU Fallback**: All modern browsers with Canvas2D support
- **Feature Detection**: Automatic runtime selection with graceful fallback

## TypeScript Support

Full TypeScript support with comprehensive type definitions:

```typescript
import type { IEngine, IParticle, Module } from "@cazala/party";

const engine: IEngine = new Engine({ /* ... */ });
const particle: IParticle = {
  position: { x: 0, y: 0 },
  velocity: { x: 1, y: 1 },
  mass: 1,
  size: 5,
  color: { r: 1, g: 1, b: 1, a: 1 },
};
```

## License

MIT License - see [LICENSE](../../LICENSE) file for details.