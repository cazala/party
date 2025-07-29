# useInteractions Hook Documentation

## Overview

The `useInteractions` hook is the core interaction system for the particle playground. It handles all mouse and keyboard interactions, providing a rich set of controls for spawning, manipulating, and interacting with particles in real-time.

## Features

### Core Mouse Controls

#### Basic Particle Spawning
- **Click**: Spawn a single particle at cursor position using configured size and mass
- **Click & Drag**: Set particle size based on drag distance (drag-to-size) - Single mode only
- **Ctrl/⌘ + Click & Drag**: Set particle direction and speed (drag-to-velocity) - Single mode only

#### Particle Interaction
- **Right Click**: Attract particles to cursor position
- **Ctrl/⌘ + Right Click**: Repel particles from cursor position
- **Mouse Wheel/Trackpad Scroll**: Zoom in/out on the simulation

### Keyboard Modifiers

#### Mode Switching
- **Ctrl/⌘ during drag**: Switch from size mode to velocity mode (Single mode only)
- **Escape**: Cancel current drag operation

#### Tool-Specific Modifiers
- **Shift in Joint Mode**: Continue creating joints without deselecting particles

### Advanced Features

#### Mass Configuration System
The hook respects the mass configuration from the Particle Spawner Controls:

1. **Regular Spawning**: Uses configured mass from spawner controls
2. **Drag-to-Size**: Calculates mass proportional to particle area
3. **Drag-to-Velocity from Click**: Uses configured mass from spawner controls
4. **Drag-to-Velocity from Drag**: Uses mass calculated from drag size

#### Mode Switching
- **Dynamic Switching**: Switch between size and velocity modes during drag (Single mode only)
- **State Preservation**: Maintains current size when switching modes
- **Visual Feedback**: Real-time preview updates during mode changes

#### Spawn Mode System
- **Single Mode**: Standard spawning with drag-to-size and drag-to-velocity features
- **Stream Mode**: Continuous particle spawning at cursor position
- **Draw Mode**: Creates connected particle chains by dragging
- **Shape Mode**: Spawns geometric shapes with all-to-all connections

## State Management

### MouseState Interface
The hook maintains a comprehensive state object tracking:

```typescript
interface MouseState {
  // Basic interaction state
  isDown: boolean;
  startPos: { x: number; y: number };
  currentPos: { x: number; y: number };
  isDragging: boolean;
  dragThreshold: number;
  
  // Streaming state
  isStreaming: boolean;
  streamInterval: number | null;
  streamSize: number;
  streamPosition: { x: number; y: number };
  activeStreamSize: number;
  activeStreamMass: number;
  
  // Mode tracking
  shiftPressed: boolean; // Used for joint mode continuity
  cmdPressed: boolean;
  isDragToVelocity: boolean;
  originalDragIntent: "size" | "velocity" | null;
  
  // Size and mass management
  velocityModeSize: number;
  activeVelocitySize: number;
  lastCalculatedSize: number;
  
  // Interaction modes
  isRightClicking: boolean;
  rightClickMode: "attract" | "repel";
  
  // Undo/Redo tracking
  streamedParticles: Particle[];
  removedParticles: Particle[];
}
```

### Key State Variables

#### Original Drag Intent
- **Purpose**: Tracks whether a drag operation was initiated for sizing or velocity
- **Values**: `"size"` | `"velocity"` | `null`
- **Usage**: Determines correct mass calculation for drag-to-velocity operations

#### Shift Key Usage
- **Purpose**: Used in Joint mode for continuous joint creation
- **Behavior**: When held, allows creating multiple joints without deselecting particles
- **Note**: No longer used for streaming - streaming is now only available via Stream mode

## Mass Calculation Logic

### Mass Calculation Flow

```typescript
// For drag-to-velocity operations
if (mouseState.isDragToVelocity) {
  if (!mouseState.isDragging) {
    // Simple click in velocity mode
    finalMass = spawnConfig.defaultMass;
  } else if (mouseState.originalDragIntent === "velocity") {
    // Drag-to-velocity from simple click (Ctrl+click+drag)
    finalMass = spawnConfig.defaultMass;
  } else {
    // Drag-to-velocity from drag-to-size (click+drag+ctrl)
    finalMass = calculateMassFromSize(finalSize);
  }
} else {
  // Size mode operations
  if (mouseState.isDragging) {
    // Drag-to-size
    finalMass = calculateMassFromSize(finalSize);
  } else {
    // Simple click
    finalMass = spawnConfig.defaultMass;
  }
}
```

### Mass Calculation Scenarios

1. **Regular Click**: Uses `spawnConfig.defaultMass`
2. **Drag-to-Size**: Uses `calculateMassFromSize(dragSize)`
3. **Ctrl+Click+Drag**: Uses `spawnConfig.defaultMass`
4. **Click+Drag+Ctrl**: Uses `calculateMassFromSize(dragSize)`
5. **Stream Mode**: Uses configured mass from spawn controls

## Spawn Mode System

### Single Mode
- **Drag-to-Size**: Click and drag to set particle size
- **Drag-to-Velocity**: Ctrl/⌘ + click and drag to set particle direction and speed
- **Mode Switching**: Press Ctrl/⌘ during drag to switch between size and velocity modes

### Stream Mode
- **Continuous Spawning**: Automatically spawns particles at cursor position
- **Rate Control**: Configurable particles per second (1-50)
- **Size/Mass**: Uses configured values from spawn controls

### Draw Mode
- **Connected Chains**: Creates particles connected by joints as you drag
- **Step Size**: Configurable distance between particles
- **Auto-Joints**: Automatically creates joints between consecutive particles

### Shape Mode
- **Geometric Shapes**: Spawns particles in polygon formations
- **All-to-All Connections**: Creates joints between every pair of particles
- **Configurable**: Adjustable number of sides and size

## Event Handlers

### Mouse Events
- **onMouseDown**: Initiates interactions, determines spawn mode behavior
- **onMouseMove**: Updates drag state, provides visual feedback, handles mode switching
- **onMouseUp**: Finalizes interactions, spawns particles
- **onMouseLeave**: Cleanup and state reset
- **onWheel**: Zoom control with momentum

### Keyboard Events
- **onKeyDown**: Handles modifier key presses (Shift for joints, Ctrl/⌘ for mode switching)
- **onKeyUp**: Handles modifier key releases and state cleanup

## Undo/Redo Integration

### Tracked Operations
- **Single Particle Spawn**: Individual particle creation
- **Stream Sessions**: Batch particle creation during stream mode
- **Draw Sessions**: Connected particle chains with joints
- **Shape Spawns**: Geometric shapes with all joints
- **Particle Removal**: Removal tool operations
- **Joint Operations**: Joint creation and removal
- **Pin/Unpin Operations**: Particle pinning state changes

### State Management
- **Automatic Tracking**: All particle modifications are tracked
- **Batch Operations**: Multi-particle operations treated as single undoable operations
- **State Cleanup**: Proper cleanup on undo/redo operations

## Performance Optimizations

### Efficient State Updates
- **Minimal Re-renders**: State changes optimized for performance
- **Batch Updates**: Multiple state changes batched where possible
- **Memory Management**: Proper cleanup of intervals and event listeners

### Visual Feedback
- **Real-time Preview**: Live particle preview during drag operations
- **Smooth Transitions**: Optimized rendering for smooth interactions
- **Responsive Controls**: Low-latency input handling

## Integration Points

### System Integration
- **Particle System**: Direct integration with core particle system
- **Renderer**: Real-time visual feedback and preview rendering
- **Forces**: Interaction with physics forces (attraction/repulsion)
- **Spawn Configuration**: Respects user-configured particle properties

### Component Integration
- **Spawn Controls**: Reads size, mass, and color configuration
- **Tool Mode**: Integrates with different interaction modes
- **Undo/Redo**: Seamless integration with undo/redo system

## Usage Example

```typescript
const interactions = useInteractions({
  getSystem: () => particleSystem,
  getRenderer: () => renderer,
  getCanvas: () => canvasElement,
  getInteraction: () => interactionSystem,
  getSpawnConfig: () => spawnConfiguration,
  onZoom: (deltaY, centerX, centerY) => handleZoom(deltaY, centerX, centerY),
  toolMode: currentToolMode,
  undoRedo: undoRedoRef
});

// Apply event handlers to canvas
<canvas
  onMouseDown={interactions.onMouseDown}
  onMouseMove={interactions.onMouseMove}
  onMouseUp={interactions.onMouseUp}
  onMouseLeave={interactions.onMouseLeave}
  onWheel={interactions.onWheel}
  onKeyDown={interactions.onKeyDown}
  onKeyUp={interactions.onKeyUp}
/>
```

## Recent Updates

### Spawn Mode Restrictions (Latest)
- **Mode-Specific Features**: Drag-to-size and drag-to-velocity now only work in Single mode
- **Prevented Conflicts**: Removed ability to trigger drag-to-velocity during Draw/Shape mode operations
- **Shift Key Streaming Removed**: Streaming is now only available via dedicated Stream mode
- **Enhanced Pin Feature**: Cmd+Shift+F now pins grabbed particles or toggles spawn control pin setting

### Mass Configuration Enhancement
- **Independent Mass Control**: Mass can now be configured independently from size
- **Smart Mass Calculation**: Different mass calculation based on interaction type
- **Mode-Aware Behavior**: Mass calculation respects spawn mode constraints

### Improved State Management
- **Original Drag Intent**: Better tracking of user intentions
- **Mode-Specific Logic**: Enhanced logic to prevent inappropriate mode switching
- **Enhanced Cleanup**: Proper state reset and memory management

### Performance Improvements
- **DRY Code**: Eliminated duplicate mass calculation formulas
- **Optimized Updates**: Reduced unnecessary state changes
- **Better Memory Usage**: Improved cleanup and state management