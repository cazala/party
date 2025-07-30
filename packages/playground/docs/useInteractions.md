# useInteractions Hook Documentation

## Overview

The `useInteractions` hook is the core interaction system for the particle playground. It handles all mouse and keyboard interactions across multiple tool modes, providing a comprehensive set of controls for spawning, manipulating, connecting, and interacting with particles and joints in real-time.

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

#### Global Shortcuts

- **Ctrl/⌘ + Z**: Undo last action
- **Ctrl/⌘ + Shift + Z**: Redo last undone action
- **Shift + Space**: Play/Pause simulation

### Tool Modes

The hook supports multiple tool modes, each with specific behaviors:

#### Spawn Mode (Default)

- **Single Mode**: Standard particle spawning with drag controls
- **Stream Mode**: Continuous particle creation at cursor position
- **Draw Mode**: Connected particle chains created by dragging
- **Shape Mode**: Geometric formations with all-to-all joint connections

#### Joint Mode

- **Joint Creation**: Click particles to connect them with joints
- **Visual Preview**: Live preview line from selected particle to cursor
- **Duplicate Prevention**: Prevents creating joints that already exist
- **Continuous Creation**: Hold Shift to create multiple joints without deselecting
- **Joint Recording**: All joint operations tracked for undo/redo

#### Grab Mode

- **Particle Dragging**: Click and drag particles during simulation
- **Physics Integration**: Dragged particles interact with physics
- **Throwing Mechanics**: Release particles with velocity based on drag speed
- **Visual Feedback**: Particle highlighting and cursor changes
- **Grab State**: Particles marked as grabbed for physics system handling

#### Pin Mode

- **Pin Toggling**: Click particles to toggle pinned state
- **State Tracking**: Tracks pin changes for undo/redo functionality
- **Visual Feedback**: Particle highlighting and pin state indication
- **Physics Integration**: Pinned particles become static but still influence others

#### Remove Mode

- **Area Removal**: Click or drag to remove particles in circular area
- **Live Preview**: Visual removal area preview while hovering
- **Continuous Removal**: Hold and drag to remove multiple particles
- **Joint Cleanup**: Automatically removes joints connected to removed particles
- **Undo Support**: All removal operations tracked for undo functionality

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
- **Shape Mode**: Spawns geometric shapes with all-to-all connections using Spawner class

#### Preview Systems

- **Particle Preview**: Real-time visual feedback during drag operations
- **Velocity Preview**: Arrow showing particle direction and speed in velocity mode
- **Joint Preview**: Live line preview when creating joints between particles
- **Removal Preview**: Circular area preview showing removal radius
- **Particle Highlighting**: Visual highlighting of particles under cursor in relevant modes

#### Color System

- **Adaptive Colors**: Preview colors adapt to current renderer color mode
- **Velocity-Based**: Colors change based on calculated velocity in velocity mode
- **Custom Colors**: Respects custom color settings from renderer
- **Pin Color Override**: Shows pinned particle color when pin mode is enabled
- **Consistent Streaming**: Maintains color consistency during stream operations

## State Management

### MouseState Interface

The hook maintains a comprehensive state object tracking:

```typescript
interface MouseState {
  // === Basic Mouse Interaction State ===
  isDown: boolean;
  startPos: { x: number; y: number };
  currentPos: { x: number; y: number };
  isDragging: boolean;
  dragThreshold: number;
  previewColor: string;

  // === Streaming State ===
  isStreaming: boolean;
  streamInterval: number | null;
  streamSize: number;
  streamPosition: { x: number; y: number };
  shiftPressed: boolean;
  wasStreaming: boolean;
  activeStreamSize: number;
  activeStreamMass: number;
  streamColors: string[];

  // === Velocity Mode State ===
  cmdPressed: boolean;
  isDragToVelocity: boolean;
  initialVelocity: { x: number; y: number };
  velocityModeSize: number;
  activeVelocitySize: number;

  // === Mode Switching State ===
  originalDragIntent: "size" | "velocity" | null;
  lastCalculatedSize: number;

  // === Right-click Interaction State ===
  isRightClicking: boolean;
  rightClickMode: "attract" | "repel";

  // === Removal Mode State ===
  removalRadius: number;
  removalPreviewActive: boolean;
  isRemoving: boolean;

  // === Joint Mode State ===
  selectedParticle: Particle | null;
  highlightedParticle: Particle | null;
  isCreatingJoint: boolean;
  createdJoints: string[];

  // === Grab Mode State ===
  grabbedParticle: Particle | null;
  isGrabbing: boolean;
  grabOffset: { x: number; y: number };
  grabPreviousPos: { x: number; y: number };
  grabLastMoveTime: number;
  grabVelocity: { x: number; y: number };

  // === Pin Mode State ===
  isPinning: boolean;

  // === Draw Mode State ===
  isDrawing: boolean;
  lastDrawnParticle: Particle | null;
  lastDrawnPosition: { x: number; y: number };
  drawnParticles: Particle[];
  drawnJoints: Joint[];

  // === Undo/Redo Tracking ===
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

- **Single Particle Spawn**: Individual particle creation (`recordSpawnSingle`)
- **Stream Sessions**: Batch particle creation during stream mode (`recordSpawnBatch`)
- **Draw Sessions**: Connected particle chains with joints (`recordDrawBatch`)
- **Shape Spawns**: Geometric shapes with all joints (`recordShapeSpawn`)
- **Single Particle Removal**: Individual particle removal (`recordRemoveSingle`)
- **Batch Particle Removal**: Multiple particle removal in one operation (`recordRemoveBatch`)
- **System Clear**: Complete particle system clearing (`recordSystemClear`)
- **Joint Creation**: Individual joint creation (`recordJointCreate`)
- **Joint Removal**: Individual joint removal (`recordJointRemove`)
- **Pin State Changes**: Particle pinning state toggles (`recordPinToggle`)

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
- **Joint System**: Full integration with joint creation and management (`getJoints`)
- **Camera/Zoom**: Zoom integration with wheel events and position calculations
- **Spatial Grid**: Works with spatial grid for efficient particle finding
- **Spawner Class**: Uses Spawner for geometric shape creation

### Component Integration

- **Spawn Controls**: Reads size, mass, and color configuration
- **Tool Mode**: Integrates with different interaction modes
- **Undo/Redo**: Seamless integration with undo/redo system
- **Cursor Management**: Manages cursor state for grabbed particle styling

### Error Handling and Safety

- **Null Safety**: Comprehensive null checks for all system references
- **Particle Validation**: Checks for valid particles before operations
- **Joint Validation**: Prevents duplicate joint creation and validates particle references
- **State Cleanup**: Proper cleanup on mouse leave and mode changes
- **Physics Integration**: Safe handling of grabbed and pinned particle states
- **Memory Management**: Proper cleanup of intervals and event listeners
- **Tool Mode Safety**: Prevents inappropriate operations in wrong tool modes

## Usage Example

```typescript
const interactions = useInteractions({
  getSystem: () => particleSystem,
  getRenderer: () => renderer,
  getCanvas: () => canvasElement,
  getInteraction: () => interactionSystem,
  getJoints: () => jointsSystem,
  getSpawnConfig: () => spawnConfiguration,
  onZoom: (deltaY, centerX, centerY) => handleZoom(deltaY, centerX, centerY),
  toolMode: currentToolMode,
  undoRedo: undoRedoRef,
});

// Apply event handlers to canvas
<canvas
  onMouseDown={interactions.onMouseDown}
  onMouseMove={interactions.onMouseMove}
  onMouseUp={interactions.onMouseUp}
  onMouseLeave={interactions.onMouseLeave}
  onContextMenu={interactions.onContextMenu}
  onWheel={interactions.onWheel}
/>;

// Note: Keyboard events are handled globally via setupKeyboardListeners()
// Access to currently grabbed particle for cursor styling
const grabbedParticle = interactions.currentlyGrabbedParticle;
```

## Recent Updates

### Comprehensive Tool Mode System (Latest)

- **Multi-Tool Support**: Full support for Spawn, Joint, Grab, Pin, and Remove tool modes
- **Tool-Specific Behaviors**: Each tool mode has dedicated logic and state management
- **Preview Systems**: Real-time visual feedback for all tool modes
- **Mode Safety**: Prevents inappropriate operations in wrong tool modes

### Enhanced Joint System Integration

- **Full Joint Support**: Complete integration with joint creation, removal, and management
- **Joint Previews**: Live visual preview lines when creating joints
- **Duplicate Prevention**: Automatic prevention of duplicate joint creation
- **Joint Undo/Redo**: Full undo/redo support for all joint operations

### Advanced Grab and Pin Modes

- **Physics Integration**: Grabbed particles interact properly with physics simulation
- **Throwing Mechanics**: Velocity-based particle throwing on release
- **Pin State Tracking**: Complete pin state management with undo support
- **Visual Feedback**: Particle highlighting and cursor state management

### Comprehensive Removal System

- **Area-Based Removal**: Circular removal area with live preview
- **Continuous Removal**: Drag-to-remove multiple particles
- **Joint Cleanup**: Automatic removal of joints connected to removed particles
- **Undo Support**: Full undo/redo support for removal operations

### Enhanced State Management

- **Tool-Specific State**: Dedicated state management for each tool mode
- **Preview State Tracking**: Comprehensive preview system state management
- **Safety and Cleanup**: Robust error handling and state cleanup
- **Memory Management**: Proper cleanup of intervals and event listeners

### Performance and Reliability

- **Null Safety**: Comprehensive null checking throughout the system
- **Efficient Updates**: Optimized state updates and rendering
- **Global Keyboard Handling**: Improved keyboard event management
- **Canvas Focus Management**: Better focus and event handling
