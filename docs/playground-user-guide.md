# Playground User Guide

The Party Playground is an interactive web application for creating, experimenting with, and managing particle physics simulations. This guide covers all user-facing features, controls, and workflows.

## Getting Started

### Launching the Playground

```bash
npm run dev
```

Visit `http://localhost:5173` to access the playground interface.

### Interface Overview

The playground consists of four main areas:

1. **Top Bar**: Play/pause, clear, restart, save/load, and help controls
2. **Left Sidebar**: Initialization (INIT) panel for spawning particles
3. **Center Canvas**: Interactive simulation viewport with tool overlay
4. **Right Sidebar**: Physics modules for controlling simulation behavior

## Canvas and Simulation

### Basic Controls

- **Play/Pause**: Spacebar or top bar button
- **Camera**: Mouse wheel to zoom, middle-click drag to pan
- **Clear**: Remove all particles and joints
- **Restart**: Reset simulation using current INIT panel settings

### Tools

Access tools via the toolbar or hotkeys. Active tool is highlighted and shows cursor overlay.

#### Spawn Tool (S)

- **Purpose**: Add particles to the simulation
- **Usage**: Click or drag to spawn particles
- **Modifiers**:
  - Hold Shift: Spawn larger particles
  - Hold Alt: Spawn with different properties

#### Grab Tool (G)

- **Purpose**: Move particles with mouse
- **Usage**: Click and drag particles around the canvas
- **Features**: Physics-based dragging with smooth interpolation

#### Joint Tool (J)

- **Purpose**: Create distance constraints between particles
- **Usage**: Click first particle, then click second particle to create joint
- **Visualization**: Joints appear as lines connecting particles

#### Pin Tool (P)

- **Purpose**: Pin/unpin particles (make them immovable)
- **Usage**: Click particles to toggle pinned state
- **Visualization**: Pinned particles appear as rings instead of filled circles

#### Remove Tool (R)

- **Purpose**: Delete particles and joints
- **Usage**: Click particles or joints to remove them
- **Features**: Visual feedback when hovering over removable objects

#### Draw Tool (D)

- **Purpose**: Draw particle trails by dragging
- **Usage**: Click and drag to create connected particle chains
- **Features**: Automatic joint creation between drawn particles

#### Emit Tool (E)

- **Purpose**: Place particle emitters
- **Usage**: Click to place emitter at location
- **Features**: Emitters continuously spawn particles over time

#### Interact Tool (I)

- **Purpose**: Create attraction/repulsion fields
- **Usage**:
  - Left-click and hold: Attract particles to cursor
  - Right-click and hold: Repel particles from cursor
- **Features**: Visual force field indicator

## Hotkeys and Shortcuts

### Playback Control

- **Spacebar**: Play/pause simulation
- **C**: Clear all particles and joints
- **Cmd/Ctrl + R**: Restart with current settings

### Tools

- **S**: Spawn tool
- **G**: Grab tool
- **J**: Joint tool
- **P**: Pin tool
- **R**: Remove tool
- **D**: Draw tool
- **E**: Emit tool
- **I**: Interact tool

### View Control

- **Mouse Wheel**: Zoom in/out
- **Middle Mouse**: Pan camera
- **Cmd/Ctrl + 0**: Reset zoom and center camera

### Interface

- **Cmd/Ctrl + B**: Toggle sidebar visibility
- **F**: Enter/exit fullscreen mode
- **H**: Show/hide help modal

### Session Management

- **Cmd/Ctrl + S**: Save session
- **Cmd/Ctrl + O**: Load session
- **Cmd/Ctrl + Z**: Undo
- **Cmd/Ctrl + Shift + Z**: Redo
- **Cmd/Ctrl + Y**: Redo (alternative)

### Numerical Hotkeys (1-9)

- Quickload sessions 1-9 when available
- **Cmd/Ctrl + [1-9]**: Load specific session

## Initialization (INIT) Panel

The INIT panel controls how particles are spawned when using the Restart button or spawn tool.

### Shape Options

- **Random**: Particles spawned randomly across canvas
- **Grid**: Particles arranged in a regular grid pattern
- **Circle**: Particles arranged in a circular formation
- **Square**: Particles arranged in a square perimeter

### Particle Properties

- **Count**: Number of particles to spawn (1-10,000)
- **Size**: Particle radius range
- **Mass**: Particle mass range
- **Velocity**: Initial velocity range and direction

### Advanced Options

- **Grid Joints**: Automatically create joints between adjacent grid particles
- **Velocity Distribution**: Control initial particle movement patterns

## Physics Modules

Each module controls a different aspect of particle physics. Modules can be enabled/disabled and have adjustable parameters.

### Environment

Global physics affecting all particles:

- **Gravity**: Strength and direction of gravitational force
- **Inertia**: Momentum preservation from previous movement
- **Friction**: Velocity damping over time
- **Damping**: Direct velocity reduction each frame

### Boundary

Controls how particles interact with canvas edges:

- **Mode**: Bounce, wrap, kill, or no boundary
- **Restitution**: Energy retention on bounce (0 = sticky, 1 = perfect bounce)
- **Friction**: Tangential friction when hitting boundaries
- **Repel**: Push particles away from edges

### Collisions

Particle-to-particle collision detection:

- **Restitution**: Collision elasticity (0 = sticky, 1 = perfect bounce)
- **Enable**: Toggle collision detection on/off

### Behavior (Flocking)

Emergent group behaviors based on local interactions:

- **Cohesion**: Attraction to nearby particles
- **Alignment**: Matching velocity of neighbors
- **Separation**: Avoidance of crowding
- **View Radius**: Detection distance for neighbors
- **Wander**: Random exploration behavior

### Fluids

Smoothed Particle Hydrodynamics (SPH) for fluid-like behavior:

- **Influence Radius**: Distance for particle interactions
- **Pressure**: Force strength based on density
- **Viscosity**: Internal friction between particles
- **Target Density**: Desired fluid density

### Sensors

Trail-following and color-based steering:

- **Sensor Distance**: How far ahead particles "look"
- **Sensor Strength**: Steering force magnitude
- **Follow/Flee**: Behavior toward detected trails
- **Trail Decay**: How quickly trails fade

### Interaction

Manual attraction/repulsion control:

- **Strength**: Force magnitude
- **Radius**: Interaction distance
- **Mode**: Attract or repel

### Joints

Distance constraints between particles:

- **Momentum**: How much constraint-solving affects velocity
- **Stiffness**: Joint rigidity (global control)
- **Tolerance**: Stress threshold before joints break

## Oscillators

Oscillators animate module parameters over time, creating dynamic effects.

### Using Oscillators

1. **Enable**: Cmd/Ctrl + click any slider to enable oscillation
2. **Speed Control**: Click the speed indicator to cycle through rates:
   - Very Slow (0.1 Hz)
   - Slow (0.25 Hz)
   - Medium (0.5 Hz)
   - Fast (1 Hz)
   - Very Fast (2 Hz)
3. **Range**: Oscillation occurs between current slider min/max bounds
4. **Disable**: Cmd/Ctrl + click again to disable

### Visual Indicators

- **Speed Badge**: Shows current oscillation frequency
- **Animated Slider**: Handle moves automatically when oscillating
- **Color Coding**: Oscillating sliders have distinctive styling

## Session Management

### Saving Sessions

1. Click "Save" button or use Cmd/Ctrl + S
2. Enter session name in modal
3. Session includes:
   - All module settings
   - Particle positions and properties (if ≤1000 particles)
   - Joints and their properties
   - Oscillator configurations
   - Camera position and zoom

### Loading Sessions

1. Click "Load" button or use Cmd/Ctrl + O
2. Browse available sessions with metadata:
   - Creation and modification dates
   - Particle count
   - Whether particle data is included
3. **Quick Load**: Click session name for fast loading (excludes particles/joints)
4. **Full Load**: Click "Load" button for complete restoration

### Session Management Features

- **Rename**: Click pencil icon to rename sessions
- **Duplicate**: Click copy icon to create session copy
- **Delete**: Click trash icon with confirmation
- **Reorder**: Drag sessions to change display order
- **Export**: Export session as JSON file
- **Import**: Import session from JSON file

### Quick Session Loading

- **Number Keys 1-9**: Instantly load sessions with visual feedback
- **Cmd/Ctrl + Number**: Alternative quick load method

## Rendering and Visual Effects

### Particle Visualization

- **Color Modes**: Default, custom color, or hue-based coloring
- **Size Scaling**: Visual particle size can differ from physics size
- **Pinned Particles**: Render as rings to indicate immovable state

### Trails

- **Decay**: Control how quickly trails fade
- **Diffusion**: Blur amount for smooth trail effects
- **Performance**: Automatically optimized for frame rate

### Lines

- **Joint Visualization**: Distance constraints shown as lines
- **Custom Styling**: Configurable line width and colors

## Undo/Redo System

### Supported Actions

- Particle spawning and removal
- Joint creation and deletion
- Pin/unpin operations
- Module setting changes
- Draw tool strokes

### Usage

- **Undo**: Cmd/Ctrl + Z
- **Redo**: Cmd/Ctrl + Shift + Z or Cmd/Ctrl + Y
- **Visual Feedback**: Actions show brief status messages
- **Grouping**: Related actions (like draw strokes) are grouped together

### Optimization Tips

- Disable unused modules for better performance
- Reduce trail diffusion if experiencing slowdown
- Use fewer joints for complex simulations
- Monitor FPS indicator in sidebar

### Runtime Information

- **WebGPU**: Better performance with many particles
- **CPU Fallback**: Universal compatibility
- **Auto-Selection**: Engine chooses best available runtime

## Tips and Tricks

### Creative Workflows

1. **Start Simple**: Begin with basic gravity + boundary
2. **Layer Effects**: Add modules one at a time to understand interactions
3. **Save Presets**: Create sessions for different effect combinations
4. **Experiment**: Try extreme parameter values for unexpected results

### Performance Optimization

1. **Profile First**: Use browser dev tools to identify bottlenecks
2. **Modular Approach**: Enable only needed modules
3. **Batch Operations**: Use restart instead of manual spawning for many particles

### Advanced Techniques

1. **Oscillator Choreography**: Coordinate multiple oscillating parameters
2. **Dynamic Interactions**: Use interact tool during playback for live effects
3. **Joint Structures**: Create complex mechanical systems with joints
4. **Trail Art**: Use draw tool with trails for artistic effects

### Keyboard Efficiency

1. **Learn Number Keys**: Quick session switching saves time
2. **Tool Switching**: Memorize tool hotkeys for fluid workflow
3. **Modifier Keys**: Use Shift/Alt with tools for variations

This playground provides a powerful, flexible environment for exploring particle physics and creating dynamic visual effects. Experiment with different combinations of modules, tools, and parameters to discover unique behaviors and stunning visual results.
