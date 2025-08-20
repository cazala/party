# @cazala/playground

Interactive web playground for experimenting with particle system simulations. Built with React, TypeScript, and the [@cazala/party](../core) particle system library.

## Features

- Interactive canvas with real-time particle manipulation using mouse/touch controls
- Multiple tools: spawn, grab, joint, pin, and remove modes
- Real-time controls for adjusting psimulation parameters while it runs runs
- Session management for saving and loading complete simulation states
- Undo/redo system
- Visual effects including trails, configurable glow effects, density fields, velocity visualization, and particle lifetime effects
- Keyboard shortcuts for efficient workflow

## Getting Started

### Development Setup

```bash
# Clone the repository
git clone https://github.com/cazala/party.git
cd party

# Install dependencies
npm install

# Start development server
npm dev
```

Visit `http://localhost:3000` to access the playground.

### Production Build

```bash
# Build for production
npm build

# Preview production build
npm preview
```

## Interface Overview

### Layout

The playground uses a three-panel layout:

```
┌─────────────┬─────────────────────┬─────────────────┐
│             │                     │                 │
│   System    │                     │    Physics      │
│  Controls   │      Canvas         │   Controls      │
│  (280px)    │    (expandable)     │   (320px)       │
│             │                     │                 │
│ • Init      │  • Particles        │ • Physics       │
│ • Spawn     │  • Interactive      │ • Boundary      │
│ • Emitters  │  • Real-time        │ • Collisions    │
│ • Render    │  • Zoom/Pan         │ • Behavior      │
│ •   │                     │ • Fluid         │
│             │                     │ • Sensors       │
│             │                     │ • Joints        │
└─────────────┴─────────────────────┴─────────────────┘
```

### Top Bar

- **Play/Pause**: Control simulation state
- **Clear/Reset**: Remove particles or reset simulation
- **Tool Selection**: Switch between interaction modes
- **Save/Load**: Session management
- **Help**: Access documentation and shortcuts

## Tool Modes

### 1. Spawn Mode (Default)

Create particles with various interaction methods:

- **Click**: Spawn single particle
- **Click + Drag**: Drag-to-size (Single mode only)
- **Ctrl/⌘ + Click + Drag**: Drag-to-velocity (Single mode only)
- **Ctrl/⌘ during drag**: Switch between size and velocity modes

**Spawn Modes**:

- **Single**: Standard spawning with drag controls
- **Stream**: Continuous particle creation
- **Draw**: Connected particle chains
- **Shape**: Geometric formations with joints

### 2. Joint Mode

Create distance constraints between particles:

- **Click particles**: Connect with joints
- **Shift + Click**: Continue connecting without deselecting
- **Escape**: Cancel joint creation

### 3. Grab Mode

Manually manipulate particles during simulation:

- **Click + Drag**: Move particles with physics influence
- **Release**: Apply momentum from drag movement
- **Multiple particles**: Grab individual particles

### 4. Pin Mode

Fix particles in place:

- **Click**: Toggle particle pinned state
- **Pinned particles**: Unaffected by forces but still influence others

### 5. Remove Mode

Delete particles from simulation:

- **Click**: Remove single particle
- **Click + Drag**: Remove multiple particles in area
- **Visual feedback**: Preview removal area

## Controls Reference

### System Controls (Left Panel)

#### Initialization

- **Particle Count**: Number of particles to spawn
- **Spawn Pattern**: Grid, Random, Circle, Donut, Square
- **Initial Velocity**: Random, directional, or zero
- **Size/Mass**: Configure initial particle properties
- **Colors**: Set particle color palette

#### Spawn Configuration

- **Size/Mass**: Real-time adjustment of spawn parameters
- **Pin**: Whether new particles are pinned
- **Mode**: Single, Stream, Draw, Shape
- **Stream Rate**: Particles per second for stream mode
- **Draw Step Size**: Distance between particles in draw mode
- **Shape Parameters**: Sides and size for shape mode

#### Rendering Options

- **Color Mode**: Particle, Custom, Velocity-based, Rotating Hue
- **Glow Effects**: Enable/disable particle shadow-based glow effects (disabled by default for better performance)
- **Visual Effects**: Trails, blur effects, and other visual enhancements
- **Debug Overlays**: Spatial grid, density field, velocity arrows
- **Performance**: FPS display and particle count

**Performance Note**: Glow effects use Canvas2D shadow operations which are computationally expensive. Disabling glow effects can significantly improve frame rates, especially with many particles. When trails are enabled, glow effects are automatically bypassed to prevent conflicts.

#### Emitter Configuration

- **Basic Properties**: Particle size, mass, rate, direction, speed, and spread
- **Colors**: Color palette for emitted particles
- **Infinite Particles**: Toggle for unlimited vs limited particle lifetime
- **Lifetime Controls** (when infinite is disabled):
  - **Duration**: Particle lifetime in milliseconds (0.1s - 10s)
  - **Size Multiplier**: Final size scaling over lifetime (-5x to 5x)
  - **Alpha**: Final transparency for fade effects (0.0 to 1.0)
  - **End Colors**: Color transition targets (multiple colors supported)
  - **Speed Multiplier**: Acceleration/deceleration over lifetime (-5x to 5x)

### Physics Controls (Right Panel)

#### Environment

- **Gravity**: Direction and strength with support for directional, radial, and custom angles
- **Inertia**: Position-based momentum preservation (0-1)
- **Friction**: Force-based velocity damping proportional to mass (0-1)
- **Damping**: Direct velocity multiplication factor (0-1)

#### Boundary

- **Mode**: Bounce, Kill, Warp, or None at boundaries
- **Bounce**: Energy retention on collision (0-1)
- **Friction**: Tangential friction during boundary collisions (0-1)
- **Repel**: Boundary repulsion distance and strength settings

#### Collisions

- **Enable Collisions**: Master switch for entire collision system
- **Particle vs Particle**: Enable particle-particle collisions
- **Particle vs Joint**: Enable particle-joint collisions
- **Joint vs Joint**: Enable joint crossing resolution
- **Restitution**: Collision elasticity (0-1)
- **Friction**: Tangential friction during collisions (0-1)
- **Eating**: Larger particles consume smaller ones

#### Behavior (Flocking)

- **Cohesion**: Attraction to group center
- **Alignment**: Velocity matching with neighbors
- **Separation**: Personal space maintenance
- **Wander**: Random exploration
- **Chase/Avoid**: Color-based interactions
- **View Parameters**: Detection radius and field of view

#### Fluid Dynamics

- **SPH Settings**: Influence radius, target density
- **Pressure**: Force multiplier for fluid behavior
- **Near Pressure**: Enhanced short-range particle interaction
- **Near Threshold**: Distance for switching to near pressure mode
- **Viscosity**: Internal friction for realistic fluid behavior

#### Sensors

- **Trail System**: Visual trail parameters
- **Environmental Sensing**: Detection and steering
- **Color Sensitivity**: Same/different color behaviors

#### Joints

- **Enable Joints**: Master switch for joint system
- **Tolerance**: Joint breaking stress tolerance (0-1)
- **Max Iterations**: Constraint solving iterations for rigidity
- **Momentum**: Momentum preservation for joint particles (0-1)
- **Clear All**: Remove all existing joints

## Keyboard Shortcuts

### Animation Control

- **Shift + Space**: Play/Pause simulation
- **Escape**: Cancel current operation

### Undo/Redo

- **Ctrl/⌘ + Z**: Undo last action
- **Ctrl/⌘ + Shift + Z**: Redo last undone action

### Tool Switching

- **Ctrl/⌘ + A**: Spawn tool
- **Ctrl/⌘ + S**: Joint tool
- **Ctrl/⌘ + D**: Grab tool
- **Ctrl/⌘ + F**: Pin tool
- **Ctrl/⌘ + G**: Remove tool

### Quick Actions

- **Ctrl/⌘ + Shift + A**: Cycle spawn modes
- **Ctrl/⌘ + Shift + F**: Toggle pin setting (or pin grabbed particle)
- **?**: Open help modal

### Mouse Controls

- **Right Click**: Attract particles to cursor
- **Ctrl/⌘ + Right Click**: Repel particles from cursor
- **Mouse Wheel**: Zoom in/out
- **Middle Mouse + Drag**: Pan camera (when zoomed)

## Session Management

### Saving Sessions

1. Configure your simulation
2. Click **Save** in the top bar
3. Enter a descriptive name
4. Session is saved to browser localStorage

### Loading Sessions

1. Click **Load** in the top bar
2. Select from saved sessions
3. Complete simulation state is restored

### Session Contents

Saved sessions include:

- All particle positions, velocities, and properties
- Complete physics configuration (environment, boundary, collisions, behavior, fluid, sensors, joints)
- Visual settings and camera position
- Active tool mode and spawn settings
- Emitter configurations with lifetime settings
- Joint network topology and properties

## Educational Use

The playground is excellent for exploring physics concepts:

### Basic Physics

- **Gravity**: Observe acceleration and terminal velocity with multiple gravity modes
- **Inertia vs Friction vs Damping**: Compare different momentum preservation and energy dissipation methods
- **Collisions**: Elastic and inelastic interactions with tangential friction effects
- **Boundary Interactions**: Study different boundary behaviors and their friction effects

### Emergent Behaviors

- **Flocking**: Craig Reynolds' boids algorithm
- **Phase Transitions**: Order/disorder in particle systems
- **Self-Organization**: Pattern formation from simple rules

### Fluid Dynamics

- **SPH Method**: Smoothed Particle Hydrodynamics
- **Pressure Systems**: Density-based force generation
- **Near Pressure**: Dual-pressure system with spiky kernels for close-range interactions
- **Viscosity**: Inter-particle friction effects

### Complex Systems

- **Sensor Networks**: Environmental navigation and trail-following
- **Constraint Systems**: Joint-based structures with momentum preservation
- **Multi-agent Systems**: Individual vs collective behavior
- **Rigid Body Dynamics**: Joint networks with collision interactions and stress-based breaking

## Development

### Project Structure

```
playground/
├── src/
│   ├── components/          # React components
│   │   ├── control-sections/   # Parameter controls
│   │   ├── modals/            # Save/load dialogs
│   │   ├── HelpModal.tsx      # Documentation
│   │   └── TopBar.tsx         # Main navigation
│   ├── hooks/               # React hooks
│   │   ├── usePlayground.ts    # Main playground logic
│   │   ├── useInteractions.ts  # User input handling
│   │   ├── useUndoRedo.ts     # History management
│   │   └── useToolMode.ts     # Tool state
│   ├── utils/               # Utilities
│   │   ├── SessionManager.ts   # Save/load logic
│   │   └── particle.ts        # Particle utilities
│   └── styles/              # CSS files
├── index.html               # Entry point
└── vite.config.js          # Build configuration
```

## License

MIT © cazala
