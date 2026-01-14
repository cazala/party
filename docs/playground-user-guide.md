# Playground User Guide

The Party Playground is an interactive web application for creating, experimenting with, and managing particle physics simulations. This guide covers all user-facing features, controls, and workflows.

## Getting Started

### Launching the Playground

```bash
npm run dev
```

Visit `http://localhost:3000` to access the playground interface.

> Note: the dev server port is configured in `packages/playground/vite.config.js`.

### Interface Overview

The playground consists of four main areas:

1. **Top Bar**: Play/pause, clear, restart, save/load, and help controls
2. **Left Sidebar**: Initialization (INIT) panel for spawning particles
3. **Center Canvas**: Interactive simulation viewport with tool overlay
4. **Right Sidebar**: Physics modules for controlling simulation behavior

## Canvas and Simulation

### Basic Controls

- **Play/Pause**: Spacebar or top bar button
- **Camera**: Mouse wheel (or trackpad) to zoom
- **Clear**: Top bar **Clear** button (clears particles/joints)
- **Restart**: Top bar **Restart** button (re-spawns from current INIT settings)

### Tools

Access tools via the toolbar or hotkeys. Active tool is highlighted and shows cursor overlay.

#### Spawn Tool (Cmd/Ctrl + S)

- **Purpose**: Add particles to the simulation
- **Usage**:
  - Click: Spawn particle (persisted size)
  - Drag: Set initial velocity (arrow)
- **Modifiers**:
  - Ctrl/Cmd + Drag: Adjust size (persists, does not spawn)
  - Shift: Stream while dragging

#### Grab Tool (Cmd/Ctrl + G)

- **Purpose**: Move particles with mouse
- **Usage**: Click and drag particles around the canvas
- **Features**: Physics-based dragging with smooth interpolation

#### Joint Tool (Cmd/Ctrl + H)

- **Purpose**: Create distance constraints between particles
- **Usage**: Click to create joints between selected particles
- **Visualization**: Joints appear as lines connecting particles

#### Pin Tool (Cmd/Ctrl + F)

- **Purpose**: Pin/unpin particles (make them immovable)
- **Usage**: Click/drag to pin inside the dashed circle
- **Visualization**: Pinned particles appear as rings instead of filled circles
- **Modifiers**:
  - Shift + Click/Drag: Unpin inside circle
  - Ctrl/Cmd + Drag: Adjust pin radius

#### Remove Tool (Cmd/Ctrl + D)

- **Purpose**: Delete particles and joints
- **Usage**: Click/drag to remove inside the dashed circle
- **Modifiers**:
  - Ctrl/Cmd + Drag: Adjust removal radius

#### Draw Tool (Cmd/Ctrl + J)

- **Purpose**: Draw particle trails by dragging
- **Usage**: Click & drag to draw particles and auto-connect joints
- **Features**: Automatic joint creation between drawn particles
- **Modifiers**:
  - Shift: Pin while drawing
  - Ctrl/Cmd + Drag: Adjust particle size

#### Brush Tool (Cmd/Ctrl + K)

- **Purpose**: Paint multiple particles at once in a circular area
- **Usage**: Click/drag to fill the dashed circle with non-overlapping particles (uses current INIT particle size)
- **Modifiers**:
  - Hold Shift: Spawn pinned particles
  - Hold Cmd/Ctrl while dragging: Resize brush radius

#### Interact Tool (Cmd/Ctrl + A)

- **Purpose**: Create attraction/repulsion fields
- **Usage**:
  - Left-click and hold: Attract particles to cursor
  - Right-click and hold: Repel particles from cursor
- **Features**: Visual force field indicator
- **Modifiers**:
  - Ctrl/Cmd + Drag: Adjust interaction radius
  - Shift + Drag: Adjust strength

#### Shape Tool (Cmd/Ctrl + L)

- **Purpose**: Spawn a full-mesh polygon (particles + joints)
- **Usage**:
  - Click: Spawn full-mesh polygon
- **Modifiers**:
  - Ctrl/Cmd + Drag: Adjust radius
  - Shift + Drag: Adjust sides (3-6)

## Hotkeys and Shortcuts

### Playback Control

- **Spacebar**: Play/pause simulation

### Tools

- **Cmd/Ctrl + A**: Interact tool
- **Cmd/Ctrl + S**: Spawn tool
- **Cmd/Ctrl + D**: Remove tool
- **Cmd/Ctrl + F**: Pin tool
- **Cmd/Ctrl + G**: Grab tool
- **Cmd/Ctrl + H**: Joint tool
- **Cmd/Ctrl + J**: Draw tool
- **Cmd/Ctrl + K**: Brush tool
- **Cmd/Ctrl + L**: Shape tool

### View Control

- **Mouse Wheel / Trackpad**: Zoom in/out

### Interface

- **Cmd/Ctrl + B**: Toggle sidebar visibility

### Undo / Redo

- **Cmd/Ctrl + Z**: Undo
- **Cmd/Ctrl + Shift + Z** or **Cmd/Ctrl + Y**: Redo

### Numerical Hotkeys (1–9)

- **Cmd/Ctrl + 1–9**: Quick load sessions 1–9 (when available)

## Initialization (INIT) Panel

The INIT panel controls how particles are spawned when using the Restart button or spawn tool.

### Shape Options

- **Random**: Particles spawned randomly across canvas
- **Grid**: Particles arranged in a regular grid pattern
- **Circle**: Particles arranged in a circular formation
- **Donut**: Particles arranged in a ring (inner + outer radius)
- **Square**: Particles arranged in a square
- **Text**: Particles spawn to form the typed text

### Particle Properties

- **Number of Particles**: 100–100,000
- **Particle Size**: 1–50 (this is the physics radius)
- **Particle Mass**: 0.1–10 (can be auto-derived from size)
- **Colors**: Optional palette (defaults to white if empty)
- **Velocity Speed**: 0–500
- **Velocity Direction**:
  - Random
  - In (towards center)
  - Out (from center)
  - Clockwise / Counter-Clockwise
  - Custom (with an angle slider)

### Advanced Options

- **Grid spacing**: Only for Grid shape (minimum is \(2 \times\) particle size)
- **Join Rows and Columns**: Only for Grid shape (creates joints + lines after spawn)
- **Circle/Donut radius**: Radius / Outer Radius sliders (Circle/Donut)
- **Donut inner radius**: Inner Radius slider (Donut)
- **Square size**: Square Size slider (Square)
- **Square corner radius**: Corner Radius slider (Square)
- **Text fields**: Text, Text Size, and Font (Sans Serif / Serif / Monospace)

## Physics Modules

Each module controls a different aspect of particle physics. Modules can be enabled/disabled and have adjustable parameters.

### Environment

Global physics affecting all particles:

- **Gravity Strength**: Scales the gravity acceleration applied each frame.
- **Gravity Direction**: Direction of gravity (Down / Up / Left / Right / Inwards / Outwards / Custom).
- **Gravity Angle**: Sets the gravity direction when using Custom (in degrees).
- **Inertia**: Adds acceleration in the direction of current velocity (a “keep moving” boost).
- **Friction**: Linear drag; accelerates against velocity to slow particles down.
- **Damping**: Directly scales velocity each frame (extra velocity decay).

### Boundary

Controls how particles interact with canvas edges:

- **Mode**: Boundary handling (Bounce = reflect, Warp = wrap around, Kill = remove when outside, None = no boundary constraint).
- **Restitution**: Bounciness when using Bounce (higher = more elastic).
- **Friction**: Tangential velocity damping when using Bounce (higher = more sliding loss).
- **Repel Distance**: How far from an edge the repel force starts pushing particles inward.
- **Repel Strength**: Strength of the repel force near/outside the bounds (applies in all modes).

### Collisions

Particle-to-particle collision detection:

- **Restitution**: Elasticity of particle–particle collisions (higher = bouncier).

### Behavior (Flocking)

Emergent group behaviors based on local interactions:

- **Wander**: Adds small random steering (perpendicular jitter) to break symmetry.
- **Cohesion**: Steers particles toward the local neighborhood’s center of mass.
- **Alignment**: Steers particles toward the average velocity of nearby neighbors.
- **Repulsion**: Strength of the “move away” steering when neighbors are too close.
- **Separation**: Distance threshold under which repulsion kicks in.
- **Chase**: Makes heavier particles steer toward lighter ones (predator-like behavior).
- **Avoid**: Makes lighter particles steer away from heavier ones (prey-like behavior).
- **View Radius**: How far each particle searches for neighbors.
- **View Angle**: Field-of-view cone for neighbor influence (in degrees).

### Fluids

Fluid-like behavior, with selectable solver method:

- **Method**: SPH (density/pressure fluid) or PIC/FLIP (velocity-grid-inspired blend).
- **Influence Radius**: Neighbor search radius used by the fluid solver kernels.
- **Density**: Target density for the fluid (higher = “more crowded” before pressure pushes back).
- **Pressure**: Scales how strongly density deviations push particles apart/together.
- **PIC/FLIP Ratio**: Only when Method = PIC/FLIP; 0 = pure PIC (smoother), 1 = pure FLIP (more energetic).
- **SPH-only controls**:
  - **Max Acceleration**: Caps the maximum fluid impulse to reduce instability.
  - **Viscosity**: Velocity smoothing between neighbors (higher = thicker fluid).
  - **Enable Near Pressure**: Enables an additional “near-density” pressure term for sharper clumping/structure.
  - **Near Pressure**: Strength multiplier for the near-pressure term.
  - **Near Threshold**: Distance threshold where near-pressure dominates over regular pressure.

### Sensors

Sensor-based steering using the trails buffer:

- **Distance**: How far ahead the left/right sensors sample.
- **Angle**: How far left/right the sensors are rotated from the movement direction.
- **Radius**: Sampling radius (in screen texture space via zoom) around each sensor point.
- **Threshold**: Minimum trail intensity required to trigger a follow/flee decision.
- **Strength**: Sets the resulting steering velocity magnitude when a sensor “wins”.
- **Follow Behavior**: What to follow (None / Any intensity / Same color / Different color).
- **Flee Behavior**: What to avoid (None / Any intensity / Same color / Different color).
- **Color Similarity Threshold**: Only when Follow/Flee uses Same/Different; how strict color matching is.
- **Flee Angle**: Only when Flee Behavior is not None; how sharply to turn away when fleeing.

### Interaction

There is no Interaction module panel in the sidebar: interaction is controlled by the **Interact Tool** (see Tools section).

### Joints

Distance constraints between particles:

- **Momentum**: Blends velocity toward the actual post-constraint motion (helps reduce jitter in joint chains).
- **Particle Collisions**: Enables particle-vs-joint segment collision handling.
- **Joint Collisions**: Enables joint-vs-joint crossing resolution (nudges intersecting segments apart).
- **Steps**: Substeps for collision checking (higher = more robust CCD, slower).
- **Friction**: Tangential damping when particles collide with joint segments.
- **Restitution**: Bounciness when particles collide with joint segments.
- **Separation**: Push-apart amount used when resolving joint-vs-joint intersections.

## Oscillators

Oscillators animate module parameters over time, creating dynamic effects.

### Using Oscillators

1. **Enable**: Cmd/Ctrl + click any slider to enable oscillation
2. **Speed Control**: Cmd/Ctrl + click repeatedly to cycle: Slow → Normal → Fast
3. **Range**: Oscillation starts with the slider’s min/max bounds; you can adjust the oscillator min/max handles
4. **Disable**: Click the slider (without Cmd/Ctrl) to stop the oscillator

### Visual Indicators

- **Speed Badge**: Shows current oscillation frequency
- **Animated Slider**: Handle moves automatically when oscillating
- **Color Coding**: Speed badge color reflects slow/normal/fast

## Session Management

### Saving Sessions

1. Click the **Save** button in the top bar
2. Enter session name in modal
3. Session includes:
   - All module settings
   - Particle positions and properties (if ≤1000 particles)
   - Joints and their properties
   - Oscillator configurations
   - Camera position and zoom

### Loading Sessions

1. Click the **Load** button in the top bar
2. Browse available sessions with metadata:
   - Creation and modification dates
   - Particle count
   - Whether particle data is included
3. Click a session row to load it (full restore when particle data exists; otherwise respawns from config)

### Session Management Features

- **Rename**: Click pencil icon to rename sessions
- **Duplicate**: Click copy icon to create session copy
- **Delete**: Click trash icon with confirmation
- **Reorder**: Drag sessions to change display order
- **Export**: Export session as JSON file
- **Import**: Import session from JSON file

### Quick Session Loading

- **Cmd/Ctrl + 1–9**: Quick load a session (settings only)

## Rendering and Visual Effects

### Particle Visualization

- **Show Particles**: Toggle particle rendering
- **Particle Color Type**: Default / Custom / Hue
- **Pinned Particles**: Render as rings to indicate immovable state

### Trails

- **Show Trails**: Toggle trails rendering
- **Trail Decay**
- **Trail Diffuse**

### Lines

- **Show Lines**: Toggle line rendering
- **Line Color**
- **Line Width**

### Global Render Options

- **Invert Colors**
- **Clear Color**

## Undo/Redo System

### Supported Actions

- Spawn tool gestures
- Remove tool gestures
- Pin/unpin tool gestures
- Joint tool operations
- Draw tool strokes
- Shape tool spawns
- Brush tool strokes

### Usage

- **Undo**: Cmd/Ctrl + Z
- **Redo**: Cmd/Ctrl + Shift + Z or Cmd/Ctrl + Y
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

## Performance Panel

The PERFORMANCE panel includes runtime and tuning options:

- **Use WebGPU**: Toggle runtime (when supported)
- **Constrain Iterations**
- **Max Neighbors**
- **Grid Cell Size**
- **Show Grid**
- **Particles / FPS** counters

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
3. **Modifier Keys**: Use Shift/Cmd/Ctrl with tools for variations

This playground provides a powerful, flexible environment for exploring particle physics and creating dynamic visual effects. Experiment with different combinations of modules, tools, and parameters to discover unique behaviors and stunning visual results.
