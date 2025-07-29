# @cazala/playground

Interactive web playground for experimenting with particle system simulations. Built with React, TypeScript, and the [@cazala/party](../core) particle system library.

## Features

- Interactive canvas with real-time particle manipulation using mouse/touch controls
- Multiple tools: spawn, grab, joint, pin, and remove modes
- Real-time controls for adjusting physics parameters while simulation runs
- Session management for saving and loading complete simulation states
- Undo/redo system
- Visual effects including trails, glow, density fields, and velocity visualization
- Keyboard shortcuts for efficient workflow
- Responsive design that works on desktop and mobile devices
- Educational tool for learning physics concepts and particle behaviors

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
│ • Spawn     │  • Interactive      │ • Bounds        │
│ • Tools     │  • Real-time        │ • Collisions    │
│ • Render    │  • Zoom/Pan         │ • Behavior      │
│ • Settings  │                     │ • Fluid         │
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
- **Visual Effects**: Trails, glow, blur effects
- **Debug Overlays**: Spatial grid, density field, velocity arrows
- **Performance**: FPS display and particle count

### Physics Controls (Right Panel)

#### Physics

- **Gravity**: Direction and strength
- **Inertia**: Momentum preservation (0-1)
- **Friction**: Global velocity damping

#### Bounds

- **Mode**: Bounce, Kill, or Warp at boundaries
- **Bounce**: Energy retention on collision
- **Repel**: Boundary repulsion settings

#### Collisions

- **Enable**: Particle-particle collisions
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
- **Viscosity**: Resistance and wobble factors

#### Sensors

- **Trail System**: Visual trail parameters
- **Environmental Sensing**: Detection and steering
- **Color Sensitivity**: Same/different color behaviors

#### Joints

- **Constraint Settings**: Restitution and friction
- **Collision Integration**: Joint-collision interactions

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
- Complete physics configuration
- Visual settings and camera position
- Active tool mode and spawn settings

## Educational Use

The playground is excellent for exploring physics concepts:

### Basic Physics

- **Gravity**: Observe acceleration and terminal velocity
- **Friction**: Study energy dissipation
- **Collisions**: Elastic and inelastic interactions

### Emergent Behaviors

- **Flocking**: Craig Reynolds' boids algorithm
- **Phase Transitions**: Order/disorder in particle systems
- **Self-Organization**: Pattern formation from simple rules

### Fluid Dynamics

- **SPH Method**: Smoothed Particle Hydrodynamics
- **Pressure Systems**: Density-based force generation
- **Viscosity**: Inter-particle friction effects

### Complex Systems

- **Sensor Networks**: Environmental navigation
- **Constraint Systems**: Joint-based structures
- **Multi-agent Systems**: Individual vs collective behavior

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
