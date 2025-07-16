# Undo/Redo System Documentation

## Overview

The undo/redo system provides comprehensive history tracking for all particle operations in the playground. It uses a dual-stack architecture with surgical precision - only affecting the specific particles that were added or removed, while preserving the physics simulation state for all other particles.

## Key Features

### 🎯 Surgical Operations

- **Spawn Undo**: Only removes the spawned particles, preserves physics state of existing particles
- **Remove Undo**: Only restores the removed particles, maintains current state of all other particles
- **Clear Undo**: Restores all particles that were cleared (only operation that affects all particles)

### 🔄 Dual-Stack Architecture

- **Undo History**: Tracks actions that can be undone
- **Redo History**: Tracks actions that can be redone
- **Automatic Clearing**: New actions clear the redo history

### 📊 History Management

- **50 Action Limit**: Maintains up to 50 operations in history
- **ID Preservation**: Maintains particle IDs across operations for consistency
- **Timestamp Tracking**: Each action includes a timestamp for debugging

## Supported Operations

| Operation       | Type                  | Description                | Undo Behavior                  |
| --------------- | --------------------- | -------------------------- | ------------------------------ |
| `SPAWN_SINGLE`  | Single click          | Spawns one particle        | Removes the spawned particle   |
| `SPAWN_BATCH`   | Streaming/Shift+click | Spawns multiple particles  | Removes all spawned particles  |
| `REMOVE_SINGLE` | Click in remove mode  | Removes one particle       | Restores the removed particle  |
| `REMOVE_BATCH`  | Drag in remove mode   | Removes multiple particles | Restores all removed particles |
| `SYSTEM_CLEAR`  | Clear button          | Removes all particles      | Restores all particles         |

## Usage

### Basic Usage

```typescript
import { useUndoRedo } from "./hooks/useUndoRedo";

const undoRedo = useUndoRedo(() => systemRef.current);

// Check if undo/redo is available
const canUndo = undoRedo.canUndo;
const canRedo = undoRedo.canRedo;

// Perform undo/redo
undoRedo.undo();
undoRedo.redo();
```

### Recording Operations

```typescript
// Record a single particle spawn
undoRedo.recordSpawnSingle(particle, getIdCounter());

// Record a batch of particles (streaming mode)
undoRedo.recordSpawnBatch(particles, getIdCounter());

// Record a single particle removal
undoRedo.recordRemoveSingle(particle, getIdCounter());

// Record a batch removal (drag removal)
undoRedo.recordRemoveBatch(particles, getIdCounter());

// Record a system clear
undoRedo.recordSystemClear(allParticles, getIdCounter());
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
}

interface UndoAction {
  type:
    | "SPAWN_SINGLE"
    | "SPAWN_BATCH"
    | "REMOVE_SINGLE"
    | "REMOVE_BATCH"
    | "SYSTEM_CLEAR";
  timestamp: number;
  particles: SerializedParticle[];
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
   └─────────────────────────────────┘
```

## Physics Preservation

The system is designed to preserve physics simulation state:

### Before (Old System)

```
1. Spawn particle A
2. A collides with B, C, D (all particles move)
3. Undo spawn of A
4. ❌ All particles reset to pre-spawn positions
```

### After (Current System)

```
1. Spawn particle A
2. A collides with B, C, D (all particles move)
3. Undo spawn of A
4. ✅ Only A is removed, B, C, D keep their current positions
```

## Error Handling

- **System Unavailable**: Operations gracefully skip if particle system is not available
- **Particle Not Found**: Removal operations handle missing particles (may have been auto-removed)
- **Empty History**: Undo/redo operations safely handle empty history stacks
- **ID Conflicts**: Particle cloning preserves original IDs to prevent conflicts

## Performance Considerations

- **Memoization**: Hook return value is memoized to prevent unnecessary re-renders
- **Batch Operations**: Multiple particles are handled efficiently in single operations
- **History Limit**: Automatic cleanup prevents memory leaks from long sessions
- **Lazy Evaluation**: Operations are only performed when actually needed

## Integration Points

### With useInteractions

- Records operations during user interactions
- Handles keyboard shortcuts (Ctrl+Z, Ctrl+Shift+Z)
- Integrates with mouse and touch events

### With usePlayground

- Provides undo/redo functionality to the main playground
- Integrates with particle system lifecycle
- Manages ID counter state

### With Particle System

- Uses `getParticle()` for finding particles by ID
- Uses `addParticle()` and `removeParticle()` for modifications
- Respects the mass=0 removal pattern for consistency
