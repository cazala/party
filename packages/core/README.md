# @cazala/party

A TypeScript particle physics engine featuring advanced force systems, spatial optimization, and comprehensive rendering capabilities.

## Features

- High performance spatial grid optimization for O(1) neighbor queries
- Modular force system with pluggable architecture and lifecycle management
- Real-time simulation capable of 60+ FPS with thousands of particles
- Advanced Canvas2D rendering with trails, glow effects, density visualization, and particle lifetime effects
- Comprehensive physics including gravity, collisions, flocking, fluid dynamics, breakable elastic joints, particle emitters, and more
- Spatial optimization with efficient collision detection and neighbor finding
- Interactive user-controlled forces and particle manipulation
- Serializable system configurations for export/import

## Installation

```bash
npm install @cazala/party
```

## Quick Start

```typescript
import { System, Particle, Vector2D, Physics, Boundary } from "@cazala/party";

// Create a particle system
const system = new System({ width: 800, height: 600 });

// Add some particles
for (let i = 0; i < 100; i++) {
  const particle = new Particle({
    position: new Vector2D(Math.random() * 800, Math.random() * 600),
    velocity: new Vector2D(
      (Math.random() - 0.5) * 2,
      (Math.random() - 0.5) * 2
    ),
    mass: 1 + Math.random() * 2,
    size: 3 + Math.random() * 7,
    color: `hsl(${Math.random() * 360}, 70%, 60%)`,
  });
  system.addParticle(particle);
}

// Add physics forces
system.addForce(
  new Physics({
    gravity: { strength: 0.1, direction: { x: 0, y: 1 } },
    friction: 0.01,
    inertia: 0.99,
  })
);

// Add boundary constraints
system.addForce(
  new Boundary({
    mode: "bounce",
    bounce: 0.8,
    friction: 0.1,
  })
);

// Start the simulation
system.play();
```

## Core Concepts

### System

The `System` class is the main orchestrator that manages particles, forces, and the simulation lifecycle:

```typescript
const system = new System({
  width: 800,
  height: 600,
  cellSize: 50, // Spatial grid cell size for optimization
});

// Particle management
system.addParticle(particle);
system.removeParticle(particle);
system.getParticle(id);

// Force management
system.addForce(force);
system.removeForce(force);

// Animation control
system.play();
system.pause();
system.toggle();
system.reset();
```

### Particles

Particles are individual entities with physics properties:

```typescript
const particle = new Particle({
  position: new Vector2D(100, 100),
  velocity: new Vector2D(1, -2),
  mass: 2.5,
  size: 8,
  color: "#ff6b35",
  pinned: false, // Whether particle is affected by forces
  
  // Lifetime properties (optional)
  duration: 5000, // Particle lifetime in milliseconds (undefined = infinite)
  endSizeMultiplier: 0.1, // Final size multiplier (interpolated over lifetime)
  endAlpha: 0, // Final alpha value for fade out effect
  endColor: ["#ff0000", "#00ff00"], // Array of possible end colors (random selection)
  endSpeedMultiplier: 2.0, // Final speed multiplier (accelerate/decelerate over time)
});

// Apply forces to particles
particle.applyForce(new Vector2D(0, -9.8));

// Update physics (called automatically by System)
particle.update(deltaTime);

// Check if particle has exceeded its lifetime
if (particle.isDead()) {
  system.removeParticle(particle);
}
```

### Forces

Forces implement the `Force` interface with a four-phase lifecycle:

```typescript
interface Force {
  before?(particles: Particle[], deltaTime: number): void;
  apply(particle: Particle, spatialGrid: SpatialGrid): void;
  constraints?(particles: Particle[], spatialGrid: SpatialGrid): void;
  after?(
    particles: Particle[],
    deltaTime: number,
    spatialGrid: SpatialGrid
  ): void;
  clear?(): void;
}
```

## Available Forces

### Physics

Basic physics simulation with gravity, inertia, and friction:

```typescript
import { Physics } from "@cazala/party";

const physics = new Physics({
  gravity: {
    strength: 0.2,
    direction: { x: 0, y: 1 }, // Downward
  },
  inertia: 0.99, // Momentum preservation (0-1)
  friction: 0.01, // Velocity damping (0-1)
});
```

### Boundary

Boundary interactions for keeping particles within limits:

```typescript
import { Boundary } from "@cazala/party";

const boundary = new Boundary({
  mode: "bounce", // 'bounce', 'kill', or 'warp'
  bounce: 0.8, // Energy retention on bounce
  repelDistance: 50, // Distance to start repel force
  repelStrength: 0.5, // Strength of boundary repulsion
  physics: physicsForce, // Optional: reference to physics for friction
});
```

### Collisions

Particle-to-particle collision detection and response:

```typescript
import { Collisions } from "@cazala/party";

const collisions = new Collisions({
  enabled: true,
  eat: true, // Larger particles consume smaller ones
  restitution: 0.8, // Collision elasticity
  momentum: 0.9, // Momentum preservation for joint particles
  joints: jointsForce, // Optional: reference to joints for joint-particle collisions
  physics: physicsForce, // Optional: reference to physics for friction
});
```

### Behavior (Flocking)

Emergent group behaviors based on local interactions:

```typescript
import { Behavior } from "@cazala/party";

const behavior = new Behavior({
  enabled: true, // Enable/disable behavior force
  cohesionWeight: 0.1, // Attraction to group center
  alignmentWeight: 0.1, // Velocity matching
  separationWeight: 0.15, // Avoidance of crowding
  wanderWeight: 0.05, // Random exploration
  chaseWeight: 0.02, // Pursuit of different colors
  avoidWeight: 0.03, // Avoidance of different colors
  viewRadius: 50, // Neighbor detection distance
  viewAngle: Math.PI, // Field of view in radians (Math.PI = 180°)
  separationRange: 25, // Personal space radius
});
```

### Fluid

Smoothed Particle Hydrodynamics (SPH) for fluid simulation:

```typescript
import { Fluid } from "@cazala/party";

const fluid = new Fluid({
  enabled: true, // Enable/disable fluid simulation
  influenceRadius: 30, // Particle interaction distance
  targetDensity: 1.0, // Desired fluid density
  pressureMultiplier: 0.1, // Pressure force strength
  viscosity: 1.0, // Fluid viscosity for internal friction
  nearPressureMultiplier: 10.0, // Near pressure force strength for particles in close proximity
  nearThreshold: 30, // Distance threshold (in pixels) for switching to near pressure
});
```

**Near Pressure System:**
The fluid simulation features a dual-pressure system for enhanced particle interaction:

- **Regular pressure**: Applied to particles at normal distances based on density differences
- **Near pressure**: Applied when particles are closer than `nearThreshold`, using a spiky kernel for stronger short-range forces
- This prevents particle overlap and creates more realistic fluid behavior, especially in dense configurations

### Sensors

Environmental sensing with trail-following behaviors:

```typescript
import { Sensors } from "@cazala/party";

const sensors = new Sensors({
  enableTrail: true, // Particles leave visual trails
  trailDecay: 0.05, // Trail fade rate
  trailDiffuse: 0.02, // Trail blur amount
  enableSensors: true, // Enable sensor navigation
  sensorDistance: 20, // Sensor projection distance
  sensorAngle: Math.PI / 6, // Sensor angle offset in radians (π/6 = 30°)
  sensorRadius: 3, // Sensor detection radius
  sensorThreshold: 0.1, // Minimum detection threshold
  sensorStrength: 0.1, // Steering force strength
  followBehavior: "any", // 'any', 'same', 'different', 'none'
  fleeBehavior: "different", // 'any', 'same', 'different', 'none'
  fleeAngle: Math.PI / 2, // Flee angle in radians (π/2 = 90°)
  colorSimilarityThreshold: 0.8,
});
```

### Joints

Distance constraints between particles with configurable elasticity and stress-based breaking:

```typescript
import { Joints } from "@cazala/party";

const joints = new Joints({
  enabled: true, // Enable/disable joints system
  enableCollisions: true, // Joints interact with collisions
});

// Create joints between particles
joints.createJoint({
  particleA: particle1,
  particleB: particle2,
  restLength: 50, // Optional: custom rest length
  stiffness: 1.0, // Optional: joint stiffness (0.0 = elastic, 1.0 = rigid)
  tolerance: 1.0, // Optional: stress tolerance (0.0 = break easily, 1.0 = never break)
});

// Global stiffness and tolerance control
joints.setGlobalStiffness(0.5); // Apply to all existing joints
joints.setGlobalTolerance(0.8); // Apply to all existing joints
const currentStiffness = joints.getGlobalStiffness();
const currentTolerance = joints.getGlobalTolerance();
```

**Joint Stiffness Values:**

- `1.0` - Rigid constraint (default behavior)
- `0.5` - Semi-elastic joint
- `0.1` - Very elastic joint
- `0.0` - No constraint (effectively disabled)

**Joint Tolerance Values:**

- `1.0` - Never break under stress (default behavior)
- `0.5` - Break when stress exceeds 50% of maximum expected
- `0.1` - Break easily under small stress
- `0.0` - Break immediately with any disturbance

### Interaction

User-controlled attraction and repulsion:

```typescript
import { Interaction } from "@cazala/party";

const interaction = new Interaction({
  position: new Vector2D(0, 0), // Optional: initial position
  radius: 200, // Interaction area radius
  strength: 5000, // Force strength
});

// Control interaction
interaction.setPosition(mouseX, mouseY);
interaction.attract(); // or interaction.repel()
interaction.setActive(true); // Enable/disable
```

### Emitters

Particle emitters continuously spawn particles at a specified rate with configurable properties:

```typescript
import { Emitter } from "@cazala/party";

const emitter = new Emitter({
  position: new Vector2D(400, 300), // Emitter position
  rate: 20, // Particles per second
  direction: 0, // Emission direction in radians (0 = right)
  speed: 150, // Initial particle speed
  amplitude: Math.PI / 4, // Spread angle in radians (π/4 = 45°)
  particleSize: 6,
  particleMass: 1.2,
  colors: ["#ff6b35", "#f7931e", "#ffd700"], // Particle colors (random selection)
  
  // Particle lifetime configuration
  infinite: false, // If false, particles have limited lifetime
  duration: 3000, // Particle lifetime in milliseconds
  endSizeMultiplier: 0.2, // Particles shrink over time
  endAlpha: 0, // Particles fade out completely
  endColors: ["#8B4513", "#654321"], // End colors for color transitions
  endSpeedMultiplier: 0.1, // Particles slow down over time (friction-like)
});

// Add emitter to system
system.emitters.addEmitter(emitter);

// Control emitter
emitter.setEnabled(true);
emitter.setRate(50); // Change emission rate
emitter.setPosition(newX, newY);
emitter.setDirection(Math.PI / 2); // Point upward

// Manage emitters collection
const emitterId = system.emitters.addEmitter(emitter);
const foundEmitter = system.emitters.getEmitter(emitterId);
system.emitters.removeEmitter(emitterId);
system.emitters.setEnabled(false); // Disable all emitters
```

**Particle Lifetime Effects:**

Emitted particles can have dynamic properties that change over their lifetime:

- **Size Changes**: `endSizeMultiplier` controls final size (1.0 = no change, 0.1 = shrink, 2.0 = grow)
- **Fade Effects**: `endAlpha` creates fade in/out effects (1.0 = opaque, 0.0 = transparent)
- **Color Transitions**: `endColors` array provides possible end colors for smooth transitions
- **Speed Modulation**: `endSpeedMultiplier` can simulate friction (< 1.0) or acceleration (> 1.0)

## Rendering

The library includes a comprehensive Canvas2D renderer:

```typescript
import { Canvas2DRenderer, createCanvas2DRenderer } from "@cazala/party";

const renderer = createCanvas2DRenderer({
  canvas: canvasElement,
  width: 800,
  height: 600,
});

// Rendering features
renderer.setColorMode("velocity"); // 'particle', 'custom', 'velocity', 'hue'
renderer.setCustomColor("#ff6b35");
renderer.setTrailEnabled(true);
renderer.setTrailDecay(0.05);
renderer.setGlowEnabled(true);

// Visual overlays
renderer.setShowSpatialGrid(true);
renderer.setShowDensityField(true);
renderer.setShowVelocityField(true);

// Camera controls
renderer.setZoom(1.5);
renderer.setCamera(centerX, centerY);
```

## Spatial Grid Optimization

The system uses spatial partitioning for efficient performance:

```typescript
import { SpatialGrid } from "@cazala/party";

const spatialGrid = new SpatialGrid({
  width: 800,
  height: 600,
  cellSize: 50, // Adjust based on particle density
});

// Efficient neighbor queries
const neighbors = spatialGrid.getNeighbors(particle, radius);
const nearby = spatialGrid.getNearbyParticles(x, y, radius);
```

## Advanced Usage

### Custom Forces

Create custom forces by implementing the `Force` interface:

```typescript
class CustomForce implements Force {
  apply(particle: Particle, spatialGrid: SpatialGrid): void {
    // Apply custom force logic
    const force = new Vector2D(0, -0.1);
    particle.applyForce(force);
  }

  constraints?(particles: Particle[]): void {
    // Optional: constraint resolution
  }
}

system.addForce(new CustomForce());
```

### Configuration Management

Export and import complete system configurations:

```typescript
// Export current configuration
const config = system.export();

// Apply configuration to system
system.import(config);

// Partial configuration updates
system.import({
  physics: {
    gravity: { strength: 0.3 },
  },
  behavior: {
    enabled: true,
    cohesionWeight: 0.2,
  },
  fluid: {
    enabled: true,
    pressureMultiplier: 0.2,
    nearPressureMultiplier: 15.0,
    nearThreshold: 25,
  },
  joints: {
    enabled: true,
    stiffness: 0.8, // Set global joint stiffness
    tolerance: 0.6, // Set global joint tolerance
    enableCollisions: true,
  },
  emitters: {
    enabled: true,
    emitterConfigs: [
      // Emitter configurations are automatically serialized
      // and restored as part of the system export/import
    ],
  },
});
```
