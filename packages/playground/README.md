# Party Playground

Interactive web application for experimenting with particle physics simulations. Built with React, TypeScript, and the [@cazala/party](../core) particle physics engine featuring dual runtime support (WebGPU + CPU fallback).

## Features

### Core Capabilities
- **Dual Runtime Support**: Automatic WebGPU/CPU selection with seamless fallback
- **Interactive Tools**: Spawn, grab, joint, pin, remove, draw, brush, shape, and interact tools
- **Real-time Physics**: Live parameter adjustment during simulation playback
- **Advanced Session Management**: Save, load, rename, duplicate, reorder, export/import sessions
- **Sophisticated Undo/Redo**: Command pattern with transaction support and action grouping
- **Parameter Oscillators**: Animate any module parameter with configurable frequency and bounds
- **Comprehensive Hotkeys**: Efficient keyboard-driven workflow
- **Text Shape Spawn**: Type text to spawn particles in the INIT panel

### Physics Modules
- **Environment**: Gravity, inertia, friction, damping with directional/radial options
- **Boundary**: Bounce, kill, warp modes with repel forces and tangential friction
- **Collisions**: Elastic particle-particle collision detection and response
- **Behavior**: Flocking behaviors (cohesion, alignment, separation, wander, chase/avoid)
- **Fluids**: Smoothed Particle Hydrodynamics (SPH) with near-pressure optimization
- **Sensors**: Trail-following and color-based steering with configurable behaviors
- **Interaction**: User-controlled attraction/repulsion with visual force fields
- **Joints**: Distance constraints with momentum preservation

### Visual Effects
- **Particle Rendering**: Multiple color modes, size scaling, pinned particle visualization
- **Trails**: Decay and diffusion effects with performance optimization
- **Lines**: Joint visualization with configurable styling
- **Overlays**: Optional spatial grid overlay

## Quick Start

### Development Setup

```bash
# Clone the repository
git clone https://github.com/cazala/party.git
cd party

# Install dependencies
npm run setup

# Start development server
npm run dev
```

Visit `http://localhost:3000` to access the playground.

> **Note**: This project uses pnpm workspaces internally. Run all commands from the root directory using `npm run <script>`.

### Production Build

```bash
# Build for production
npm run build

# Or build only playground
npm run build:playground

# Preview production build (from playground directory)
cd packages/playground && npm run preview
```

## Interface Overview

The playground features a **four-panel layout** with comprehensive controls:

```
┌─────────────────────────────────────────────────────────────────┐
│                          Top Bar                                │
│  Play/Pause • Clear • Restart • Save • Load • Fullscreen       │
├───────────────┬─────────────────────────────┬───────────────────┤
│               │                             │                   │
│   Left Panel  │           Canvas            │   Right Panel     │
│   (280px)     │        (expandable)         │    (320px)        │
│               │                             │                   │
│ • INIT Panel  │  • Interactive Tools        │ • Physics Modules │
│ • Spawn       │  • Real-time Simulation     │ • Environment     │
│ • Particles   │  • Zoom/Pan Camera          │ • Boundary        │
│ • Tools       │  • Visual Overlays          │ • Collisions      │
│               │                             │ • Behavior        │
│               │                             │ • Fluids          │
│               │                             │ • Sensors         │
│               │                             │ • Interaction     │
│               │                             │ • Joints          │
└───────────────┴─────────────────────────────┴───────────────────┘
```

## Tools System

### Interactive Tools

Access via toolbar or hotkeys. Active tool shows visual cursor overlay and handles mouse interactions.

- **Interact Tool (Cmd/Ctrl + A)**: Manual attraction/repulsion with visual feedback
- **Spawn Tool (Cmd/Ctrl + S)**: Add particles with click/drag, size/velocity control
- **Remove Tool (Cmd/Ctrl + D)**: Delete particles and joints with area selection
- **Pin Tool (Cmd/Ctrl + F)**: Toggle particle pinned state (immovable)
- **Grab Tool (Cmd/Ctrl + G)**: Physics-based particle dragging with momentum
- **Joint Tool (Cmd/Ctrl + H)**: Create distance constraints between particles
- **Draw Tool (Cmd/Ctrl + J)**: Create connected particle chains with automatic joints
- **Brush Tool (Cmd/Ctrl + K)**: Paint many particles in a circle
- **Shape Tool (Cmd/Ctrl + L)**: Spawn a polygon mesh (particles + joints)

### Tool Features
- **Visual Feedback**: Cursor overlays and hover effects
- **Modifier Keys**: Shift/Alt for tool variations
- **Undo Integration**: All tool actions support undo/redo
- **Performance Optimized**: Efficient rendering and interaction handling

## Hotkeys and Shortcuts

### Essential Hotkeys
- **Spacebar**: Play/pause simulation
- **Cmd/Ctrl + A/S/D/F/G/H/J/K/L**: Switch tools
- **Cmd/Ctrl + Z**: Undo
- **Cmd/Ctrl + Shift + Z** or **Cmd/Ctrl + Y**: Redo
- **Cmd/Ctrl + B**: Toggle sidebars
- **Cmd/Ctrl + 1-9**: Quick load sessions

### Advanced Shortcuts
- **Mouse Wheel**: Zoom in/out
- **Middle Mouse**: Pan camera

For complete hotkey reference, see [User Guide](../../docs/playground-user-guide.md).

## Module System

### Physics Configuration

Each module provides real-time controls for different physics aspects:

#### Environment
- **Gravity**: Directional/radial gravity with custom angles
- **Inertia**: Momentum preservation (0-1)
- **Friction**: Velocity damping (0-1) 
- **Damping**: Direct velocity reduction (0-1)

#### Boundary
- **Modes**: Bounce, warp, kill, none
- **Restitution**: Energy retention on bounce (0-1)
- **Friction**: Tangential friction (0-1)
- **Repel**: Edge repulsion with distance/strength control

#### Fluids (SPH)
- **Influence Radius**: Particle interaction distance
- **Pressure**: Density-based force strength
- **Near Pressure**: Enhanced close-range interactions
- **Viscosity**: Internal friction for realistic flow

### Parameter Oscillators

Animate any module parameter over time:

1. **Enable**: Cmd/Ctrl + click any slider
2. **Speed Control**: Click speed badge to cycle rates (0.1Hz - 2Hz)
3. **Range**: Uses current slider min/max bounds
4. **Visual Feedback**: Animated sliders with speed indicators

## Session Management

### Advanced Session Features
- **Quick Load**: Click session name for fast parameter-only loading
- **Full Load**: Complete restoration including particles and joints
- **Drag Reordering**: Custom session display order
- **Export/Import**: JSON file backup and sharing
- **Metadata**: Creation dates, particle counts, data inclusion status
- **Rename/Duplicate**: In-place session management

### Session Contents
- All module parameters and states
- Particle positions, velocities, properties (≤1000 particles)
- Joint network topology and properties
- Oscillator configurations and states
- Camera position and zoom level

## Performance and Optimization

### Runtime Performance
- **WebGPU**: GPU compute for thousands of particles at 60+ FPS
- **CPU Fallback**: Universal browser compatibility
- **Auto-Detection**: Seamless runtime selection
- **Performance Monitoring**: Real-time FPS display

### Optimization Guidelines
- **Module Control**: Disable unused modules for better performance
- **Particle Limits**: 1K-2K for smooth performance, up to 10K supported
- **Trail Settings**: Reduce diffusion if experiencing slowdown
- **Joint Complexity**: Fewer joints for large simulations

## Architecture

### Tech Stack
- **React 18**: Modern component architecture with hooks
- **TypeScript**: Full type safety with strict configuration
- **Redux Toolkit**: State management with modern patterns
- **Vite**: Fast development server and optimized builds
- **CSS Modules**: Scoped styling with PostCSS processing

### Key Architectural Patterns
- **Module Hook Pattern**: Redux abstraction layer for components
- **Dual-Write Pattern**: Immediate engine updates for responsive UI
- **Command Pattern**: Sophisticated undo/redo with transactions
- **Tool System**: Standardized hook-based tool interfaces
- **Engine Context**: Centralized engine and utility access

For detailed architecture information, see [Maintainer Guide](../../docs/playground-maintainer-guide.md).

## Development Workflows

### Adding New Modules
1. Create Redux slice with consistent action patterns
2. Implement module hook following dual-write pattern
3. Build UI component using standardized controls
4. Integrate into sidebar and engine synchronization

### Adding New Tools
1. Implement tool hook with handlers and overlay rendering
2. Register in tool system with hotkey mapping
3. Add UI controls to toolbar
4. Integrate with undo/redo system

### Code Quality Standards
- **No Direct Redux**: Always use module hooks in components
- **Memoization**: useCallback for functions, useMemo for objects
- **Individual Exports**: Export properties separately, not state objects
- **Type Safety**: Comprehensive TypeScript coverage

## Educational Applications

### Physics Concepts
- **Classical Mechanics**: Gravity, inertia, friction, collisions
- **Fluid Dynamics**: SPH method, pressure systems, viscosity
- **Constraint Systems**: Distance constraints, momentum preservation
- **Emergent Behavior**: Flocking, self-organization, phase transitions

### Computer Science Topics
- **Spatial Optimization**: Grid-based neighbor queries
- **Parallel Computing**: WebGPU compute shaders
- **State Management**: Redux patterns and immutable updates
- **Command Pattern**: Undo/redo and transaction handling

## Browser Support

- **WebGPU**: Chrome 113+, Edge 113+ for optimal performance
- **CPU Fallback**: All modern browsers with Canvas2D support
- **Mobile**: Limited support due to touch interface requirements
- **Feature Detection**: Automatic capability detection and graceful degradation

## Contributing

### Development Setup
```bash
npm run setup                  # Install dependencies for all packages
npm run dev                   # Start development server
npm test                      # Run test suite
npm run type-check           # TypeScript verification for all packages
```

### Guidelines
- Follow established architectural patterns
- Maintain comprehensive TypeScript coverage
- Write tests for new functionality
- Update documentation for user-facing changes

For detailed contribution guidelines, see [Maintainer Guide](../../docs/playground-maintainer-guide.md).

## Documentation

- **[User Guide](../../docs/playground-user-guide.md)**: Complete feature documentation and workflows
- **[Maintainer Guide](../../docs/playground-maintainer-guide.md)**: Architecture, patterns, and development guidelines
- **[Core Engine Guide](../../docs/user-guide.md)**: Engine API and module development

## License

MIT © cazala