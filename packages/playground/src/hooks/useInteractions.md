# useInteractions Hook Documentation

## Overview

The `useInteractions` hook is the core interaction system for the particle playground. It handles all mouse and keyboard interactions, providing a rich set of controls for spawning, manipulating, and interacting with particles in real-time.

## Features

### Core Mouse Controls

#### Basic Particle Spawning
- **Click**: Spawn a single particle at cursor position using configured size and mass
- **Click & Drag**: Set particle size based on drag distance (drag-to-size)
- **Ctrl/⌘ + Click & Drag**: Set particle direction and speed (drag-to-velocity)

#### Particle Interaction
- **Right Click**: Attract particles to cursor position
- **Ctrl/⌘ + Right Click**: Repel particles from cursor position
- **Mouse Wheel/Trackpad Scroll**: Zoom in/out on the simulation

### Keyboard Modifiers

#### Streaming Mode
- **Hold Shift + Click**: Stream particles continuously at cursor
- **Hold Shift + Click & Drag**: Stream particles with drag-to-size behavior
- **Shift + Click (after drag)**: Continue streaming with preserved size/mass from previous drag

#### Mode Switching
- **Ctrl/⌘ during drag**: Switch from size mode to velocity mode
- **Escape**: Cancel current drag operation

### Advanced Features

#### Mass Configuration System
The hook respects the mass configuration from the Particle Spawner Controls:

1. **Regular Spawning**: Uses configured mass from spawner controls
2. **Drag-to-Size**: Calculates mass proportional to particle area
3. **Drag-to-Velocity from Click**: Uses configured mass from spawner controls
4. **Drag-to-Velocity from Drag**: Uses mass calculated from drag size

#### Active Size/Mass Preservation
- **Size Preservation**: Maintains particle size across multiple stream operations
- **Mass Preservation**: Maintains particle mass across multiple stream operations
- **State Persistence**: Preserved values cleared when SHIFT is released

#### Mode Switching
- **Dynamic Switching**: Switch between size and velocity modes during drag
- **State Preservation**: Maintains current size when switching modes
- **Visual Feedback**: Real-time preview updates during mode changes

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
  shiftPressed: boolean;
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

#### Active Stream Size/Mass
- **Purpose**: Preserves size and mass values across multiple stream operations
- **Lifecycle**: Set during drag operations, cleared when SHIFT is released
- **Behavior**: Allows continuing streams with consistent particle properties

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
5. **Streaming**: Uses preserved mass or falls back to configured mass

## Streaming System

### Stream Lifecycle
1. **Initiation**: SHIFT + Click or configured stream mode
2. **Continuation**: Interval-based particle spawning
3. **Termination**: SHIFT release or mode change
4. **Cleanup**: State reset and undo tracking

### Stream Configuration
- **Rate**: Configurable particles per second (1-50)
- **Size**: Uses drag size or configured default
- **Mass**: Uses preserved mass or configured default
- **Color**: Respects spawn configuration

## Event Handlers

### Mouse Events
- **onMouseDown**: Initiates interactions, sets mode, starts streaming
- **onMouseMove**: Updates drag state, provides visual feedback
- **onMouseUp**: Finalizes interactions, spawns particles
- **onMouseLeave**: Cleanup and state reset
- **onWheel**: Zoom control with momentum

### Keyboard Events
- **onKeyDown**: Handles modifier key presses (Shift, Ctrl/⌘)
- **onKeyUp**: Handles modifier key releases and state cleanup

## Undo/Redo Integration

### Tracked Operations
- **Single Particle Spawn**: Individual particle creation
- **Streaming Sessions**: Batch particle creation during streaming
- **Particle Removal**: Removal tool operations
- **Clear Operations**: Bulk particle removal

### State Management
- **Automatic Tracking**: All particle modifications are tracked
- **Batch Operations**: Streaming treated as single undoable operation
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

### Mass Configuration Enhancement
- **Independent Mass Control**: Mass can now be configured independently from size
- **Preserved Mass Behavior**: Mass is preserved across streaming operations
- **Smart Mass Calculation**: Different mass calculation based on interaction type

### Improved State Management
- **Original Drag Intent**: Better tracking of user intentions
- **Active Mass Preservation**: Consistent mass behavior across operations
- **Enhanced Cleanup**: Proper state reset and memory management

### Performance Improvements
- **DRY Code**: Eliminated duplicate mass calculation formulas
- **Optimized Updates**: Reduced unnecessary state changes
- **Better Memory Usage**: Improved cleanup and state management