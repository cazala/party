# Undo/Redo System Documentation

## Overview

The undo/redo system provides comprehensive history tracking for all particle and joint operations in the playground. It uses a dual-stack architecture with surgical precision - only affecting the specific particles and joints that were added or removed, while preserving the physics simulation state for all other entities.

## Key Features

### Surgical Operations

- **Spawn Undo**: Only removes the spawned particles, preserves physics state of existing particles
- **Remove Undo**: Only restores the removed particles, maintains current state of all other particles
- **Joint Operations**: Tracks joint creation/removal with particle state preservation
- **Pin State**: Tracks pin state changes with precise state restoration
- **Clear Undo**: Restores all particles that were cleared (only operation that affects all particles)

### Dual-Stack Architecture

- **Undo History**: Tracks actions that can be undone
- **Redo History**: Tracks actions that can be redone
- **Automatic Clearing**: New actions clear the redo history

### History Management

- **50 Action Limit**: Maintains up to 50 operations in history
- **ID Preservation**: Maintains particle and joint IDs across operations for consistency
- **Timestamp Tracking**: Each action includes a timestamp for debugging
- **Joint System Integration**: Full support for joint operations alongside particle operations

## Supported Operations

| Operation       | Type                  | Description                            | Undo Behavior                       |
| --------------- | --------------------- | -------------------------------------- | ----------------------------------- |
| `SPAWN_SINGLE`  | Single click          | Spawns one particle                    | Removes the spawned particle        |
| `SPAWN_BATCH`   | Streaming/Shift+click | Spawns multiple particles              | Removes all spawned particles       |
| `DRAW_BATCH`    | Draw mode             | Spawns connected particles with joints | Removes particles and their joints  |
| `SHAPE_SPAWN`   | Shape mode            | Spawns geometric shapes with joints    | Removes shape particles and joints  |
| `REMOVE_SINGLE` | Click in remove mode  | Removes one particle                   | Restores the removed particle       |
| `REMOVE_BATCH`  | Drag in remove mode   | Removes multiple particles             | Restores all removed particles      |
| `SYSTEM_CLEAR`  | Clear button          | Removes all particles                  | Restores all particles              |
| `JOINT_CREATE`  | Joint tool            | Creates a joint between particles      | Removes the created joint           |
| `JOINT_REMOVE`  | Joint deletion        | Removes a joint                        | Restores the removed joint          |
| `PIN_TOGGLE`    | Pin tool              | Toggles particle pin state             | Restores previous pin/grabbed state |

## Usage

### Basic Usage

```typescript
import { useUndoRedo } from "./hooks/useUndoRedo";

const undoRedo = useUndoRedo(
  () => systemRef.current,
  () => jointsRef.current
);

// Check if undo/redo is available
const canUndo = undoRedo.canUndo;
const canRedo = undoRedo.canRedo;

// Perform undo/redo
undoRedo.undo();
undoRedo.redo();
```

### Recording Operations

```typescript
// Record particle operations
undoRedo.recordSpawnSingle(particle, getIdCounter());
undoRedo.recordSpawnBatch(particles, getIdCounter());
undoRedo.recordRemoveSingle(particle, getIdCounter());
undoRedo.recordRemoveBatch(particles, getIdCounter());
undoRedo.recordSystemClear(allParticles, getIdCounter());

// Record draw/shape operations (particles + joints)
undoRedo.recordDrawBatch(particles, joints, getIdCounter());
undoRedo.recordShapeSpawn(particles, joints, getIdCounter());

// Record joint operations
undoRedo.recordJointCreate(joint, getIdCounter());
undoRedo.recordJointRemove(joint, getIdCounter());

// Record pin state changes
undoRedo.recordPinToggle(
  particleId,
  wasStaticBefore,
  wasGrabbedBefore,
  getIdCounter()
);
```

## Keyboard Shortcuts

- **Ctrl+Z / Cmd+Z**: Undo last action
- **Ctrl+Shift+Z / Cmd+Shift+Z**: Redo last undone action

## Technical Implementation

### Data Structures

```typescript
interface SerializedParticle {
  id: number;
  position: { x: number; y: number };
  velocity: { x: number; y: number };
  acceleration: { x: number; y: number };
  mass: number;
  size: number;
  color: string;
  pinned?: boolean;
  grabbed?: boolean;
}

interface SerializedJoint {
  id: string;
  particleAId: number;
  particleBId: number;
  restLength: number;
  stiffness: number;
  tolerance: number;
  isBroken: boolean;
}

interface PinStateChange {
  particleId: number;
  wasStaticBefore: boolean;
  wasGrabbedBefore: boolean;
}

interface UndoAction {
  type:
    | "SPAWN_SINGLE"
    | "SPAWN_BATCH"
    | "REMOVE_SINGLE"
    | "REMOVE_BATCH"
    | "SYSTEM_CLEAR"
    | "DRAW_BATCH"
    | "SHAPE_SPAWN"
    | "JOINT_CREATE"
    | "JOINT_REMOVE"
    | "PIN_TOGGLE";
  timestamp: number;
  particles?: SerializedParticle[];
  joints?: SerializedJoint[];
  pinChanges?: PinStateChange[];
  idCounter?: number;
}
```

### Architecture

```
┌─────────────────┐    ┌─────────────────┐
│   Undo History  │    │   Redo History  │
│                 │    │                 │
│ [Action N]      │    │ [Action X]      │
│ [Action N-1]    │    │ [Action X-1]    │
│ [Action N-2]    │    │ [Action X-2]    │
│ ...             │    │ ...             │
│ [Action 1]      │    │                 │
└─────────────────┘    └─────────────────┘
        │                        │
        │                        │
        ▼                        ▼
   ┌─────────────────────────────────┐
   │       Undo Operation            │
   │                                 │
   │ 1. Move last action to redo     │
   │ 2. Apply inverse operation      │
   │ 3. Update ID counter            │
   │ 4. Handle joint dependencies    │
   └─────────────────────────────────┘
```

### Particle and Joint Serialization

The system includes comprehensive serialization for both particles and joints:

#### Particle Serialization

- **Physics State**: Position, velocity, acceleration, mass, size
- **Visual State**: Color
- **Interaction State**: Pinned status, grabbed status
- **ID Preservation**: Original particle ID maintained across operations

#### Joint Serialization

- **Structure**: Particle A and B IDs, rest length
- **Physics**: Stiffness, tolerance values
- **State**: Broken status tracking
- **ID Preservation**: Original joint ID maintained

## Physics Preservation

The system is designed to preserve physics simulation state across all operations:

### Particle Operations

```
1. Spawn particles A, B
2. A and B collide with existing particles C, D (all particles move)
3. Undo spawn of A, B
4. ✅ Only A, B are removed, C, D keep their current positions
```

### Joint Operations

```
1. Create joint between particles A and B
2. Joint affects particle movement during simulation
3. Undo joint creation
4. ✅ Only the joint is removed, particles A, B keep current physics state
```

### Pin State Operations

```
1. Pin particle A (particle stops moving)
2. Particle A affects collisions while static
3. Undo pin toggle
4. ✅ Particle A resumes previous motion, other particles unaffected
```

## Advanced Features

### Draw Mode Support

Draw mode creates connected particle chains with joints:

```typescript
// Drawing creates both particles and joints
const drawnParticles = [p1, p2, p3];
const connectingJoints = [joint1to2, joint2to3];

// Undo removes both particles and joints as a unit
undoRedo.recordDrawBatch(drawnParticles, connectingJoints, idCounter);
```

### Shape Mode Support

Shape mode creates geometric formations with multiple joints:

```typescript
// Shape creates particles in formation with all-to-all joints
const shapeParticles = [p1, p2, p3]; // Triangle
const shapeJoints = [joint1to2, joint2to3, joint3to1]; // All connections

// Undo removes entire shape as a unit
undoRedo.recordShapeSpawn(shapeParticles, shapeJoints, idCounter);
```

### Pin State Tracking

Pin operations track both current and previous states:

```typescript
// Before pin toggle
const wasStaticBefore = particle.pinned;
const wasGrabbedBefore = particle.grabbed;

// Toggle pin state
particle.pinned = !particle.pinned;

// Record for undo
undoRedo.recordPinToggle(
  particle.id,
  wasStaticBefore,
  wasGrabbedBefore,
  idCounter
);
```

## Error Handling

- **System Unavailable**: Operations gracefully skip if particle/joint systems are not available
- **Entity Not Found**: Operations handle missing particles/joints (may have been auto-removed)
- **Empty History**: Undo/redo operations safely handle empty history stacks
- **ID Conflicts**: Particle and joint recreation preserves original IDs to prevent conflicts
- **Joint Dependencies**: Joint operations check for valid particle references before restoration

## Performance Considerations

- **Memoization**: Hook return value is memoized to prevent unnecessary re-renders
- **Batch Operations**: Multiple particles and joints are handled efficiently in single operations
- **History Limit**: Automatic cleanup prevents memory leaks from long sessions
- **Lazy Evaluation**: Operations are only performed when actually needed
- **Selective Serialization**: Only necessary properties are serialized to minimize memory usage

## Integration Points

### With useInteractions

- Records all user interaction operations (spawn, remove, joint, pin)
- Handles keyboard shortcuts (Ctrl+Z, Ctrl+Shift+Z)
- Integrates with mouse and touch events across all tool modes

### With usePlayground

- Provides undo/redo functionality to the main playground
- Integrates with particle and joint system lifecycles
- Manages ID counter state across systems

### With Particle System

- Uses `getParticle()` for finding particles by ID during restoration
- Uses `addParticle()` and `removeParticle()` for particle modifications
- Respects the mass=0 removal pattern for consistency

### With Joint System

- Uses joint creation and removal APIs
- Tracks joint state and dependencies
- Handles joint-particle relationship restoration
