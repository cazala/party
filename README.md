# Party

A comprehensive particle physics simulation system with interactive playground, built with TypeScript.

### Key Features

- High performance spatial grid optimization for efficient collision detection
- Modular architecture with pluggable force system and lifecycle management
- Real-time interaction with mouse/touch controls
- Rendering with multiple color modes, trails, glow effects, and visual overlays
- Comprehensive forces including physics, flocking, fluid dynamics, collisions, constraints, sensors, and more
- Session management for saving and loading complete simulation states
- Undo/redo system

## Packages

This is a monorepo containing two main packages:

### [@cazala/party](./packages/core) - Core Particle System

The heart of the system - a TypeScript particle system library featuring:

- **Particle System**: Individual entities with position, velocity, mass, and color
- **Forces**: Pluggable architecture supporting gravity, collisions, flocking, fluid dynamics, and more
- **Spatial Grid**: Efficient spatial partitioning for performance optimization
- **Rendering**: Canvas2D renderer with advanced visual effects
- **Configuration**: Comprehensive settings for all physics parameters

### [@cazala/playground](./packages/playground) - Interactive Playground

A React-based web application that provides:

- **Visual Interface**: Controls for all simulation parameters
- **Multiple Tools**: Spawn, grab, joint, pin, and remove modes
- **Real-time Editing**: Immediate parameter adjustment during simulation
- **Session Management**: Save and load complete configurations
- **Hotkeys**: Keyboard shortcuts

## Quick Start

### Installation

```bash
# Clone the repository
git clone https://github.com/cazala/party.git
cd party

# Install dependencies
npm install

# Start the playground in development mode
npm dev
```

### Using the Core Library

```typescript
import { System, Particle, Physics, Bounds } from "@cazala/party";

// Create a particle system
const system = new System({ width: 800, height: 600 });

// Add some particles
for (let i = 0; i < 100; i++) {
  const particle = new Particle({
    position: new Vector2D(Math.random() * 800, Math.random() * 600),
    mass: 1,
    size: 5,
    color: "#0066ff",
  });
  system.addParticle(particle);
}

// Add forces
system.addForce(new Physics({ gravity: { strength: 0.1 } }));
system.addForce(new Bounds({ mode: "bounce" }));

// Start the simulation
system.play();
```

### Running the Playground

The playground provides a complete interactive environment:

```bash
npm dev
```

Visit `http://localhost:3000` to access the playground interface.

## Architecture

### Core Components

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│     System      │    │    Particle     │    │      Force      │
│                 │    │                 │    │                 │
│ • Lifecycle     │◄──►│ • Physics       │    │ • before()      │
│ • Particles[]   │    │ • Properties    │    │ • apply()       │
│ • Forces[]      │    │ • Update cycle  │    │ • constraints() │
│ • Spatial Grid  │    │                 │    │ • after()       │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 ▼
                    ┌─────────────────┐
                    │  Spatial Grid   │
                    │                 │
                    │ • Performance   │
                    │ • Neighbor      │
                    │   Queries       │
                    │ • Collision     │
                    │   Detection     │
                    └─────────────────┘
```

### Force System

The force system uses a four-phase lifecycle:

1. **before**: Global setup and calculations
2. **apply**: Per-particle force application
3. **constraints**: Position corrections and constraints
4. **after**: Post-processing and cleanup

Available forces include:

- **Physics**: Gravity, inertia, friction
- **Bounds**: Boundary interactions (bounce, kill, warp)
- **Collisions**: Particle-particle collision detection and response
- **Behavior**: Flocking behaviors (cohesion, alignment, separation, wander)
- **Fluid**: Smoothed Particle Hydrodynamics (SPH) implementation
- **Sensors**: Environmental sensing with trail-following behaviors
- **Joints**: Distance constraints between particles
- **Interaction**: User-controlled attraction/repulsion forces

## Development

### Setup

```bash
# Install dependencies
npm install

# Build the core library
npm build:core

# Start development server
npm dev

# Build everything
npm build
```

### Project Structure

```
party/
├── packages/
│   ├── core/                 # Core library
│   │   ├── src/
│   │   │   ├── modules/      # Core modules
│   │   │   │   ├── forces/   # Force implementations
│   │   │   │   ├── system.ts # Main system class
│   │   │   │   ├── particle.ts
│   │   │   │   ├── render.ts
│   │   │   │   └── ...
│   │   │   └── index.ts      # Public API
│   │   └── package.json
│   └── playground/           # React playground app
│       ├── src/
│       │   ├── components/   # UI components
│       │   ├── hooks/        # React hooks
│       │   └── utils/        # Utilities
│       └── package.json
├── package.json              # Root workspace config
└── README.md
```

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
