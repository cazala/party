# Tools Architecture

This directory contains the refactored tools system that replaces the monolithic `useTools.ts` hook with a modular, scalable architecture.

## Architecture Overview

The tools system is now split into focused, single-responsibility modules:

### Core Files

- **`index.ts`** - Main orchestrating hook that combines all tool functionality
- **`types.ts`** - Shared TypeScript interfaces and types
- **`utils.ts`** - Common utilities (color parsing, random selection, etc.)
- **`useToolManager.ts`** - Redux tool mode management and state selectors
- **`useOverlay.ts`** - Grid rendering and overlay coordination
- **`useMouseHandler.ts`** - Global mouse event handling and delegation to tools

### Individual Tools (`individual-tools/`)

Each tool has its own dedicated hook with consistent interface:

- **`useSpawnTool.ts`** - Particle spawning with streaming, drag modes, etc. (~300 lines)
- **`useCursorTool.ts`** - Cursor/interaction tool with engine interaction module
- **`useRemoveTool.ts`** - Particle removal tool (placeholder for future implementation)
- **`useJointTool.ts`** - Joint creation tool (placeholder)
- **`usePinTool.ts`** - Particle pinning tool (placeholder)
- **`useGrabTool.ts`** - Particle grabbing/selection tool (placeholder)
- **`useEmitterTool.ts`** - Particle emitter tool (placeholder)

## Benefits

### ✅ **Maintainability**
- Each tool is self-contained in ~100-300 lines max
- Clear separation of concerns
- Easy to find and modify specific tool logic

### ✅ **Scalability**
- Adding new tools requires only creating a new hook file
- No modification to existing tool logic
- Consistent patterns across all tools

### ✅ **Testability**
- Each hook can be unit tested independently
- Clear interfaces for mocking dependencies
- Isolated tool state and behavior

### ✅ **Developer Experience**
- Better code organization and navigation
- Reduced cognitive load when working on individual tools
- TypeScript support with shared interfaces

## Tool Structure

Each tool hook follows this consistent pattern:

```typescript
export function useToolName(isActive: boolean) {
  // Tool-specific state and logic
  
  const renderOverlay: ToolRenderFunction = useCallback(() => {
    // Tool-specific overlay rendering
  }, [dependencies]);

  const handlers: ToolHandlers = {
    onMouseDown: () => { /* tool-specific mouse handling */ },
    onMouseMove: () => { /* tool-specific mouse handling */ },
    onMouseUp: () => { /* tool-specific mouse handling */ },
  };

  return {
    renderOverlay,
    handlers,
    // Tool-specific functions (for spawn tool compatibility)
  };
}
```

## Usage

The main `useTools()` hook maintains the same interface as before:

```typescript
import { useTools } from "./hooks/useTools";

function MyComponent() {
  const {
    toolMode,
    isSpawnMode,
    renderOverlay,
    updateMousePosition,
    startDrag,
    updateDrag,
    endDrag,
    // ... all other functions
  } = useTools();

  // Same usage as before - no breaking changes!
}
```

## Migration Summary

- **Before**: 1000+ lines in single file
- **After**: ~700 lines split across 11 focused files
- **Compatibility**: 100% backward compatible - no API changes
- **New Features**: Grid rendering system, ready for future tools

## File Size Breakdown

| File | Lines | Purpose |
|------|-------|---------|
| `index.ts` | ~90 | Main orchestrator |
| `useToolManager.ts` | ~50 | Redux integration |
| `useOverlay.ts` | ~60 | Grid rendering |
| `useMouseHandler.ts` | ~60 | Mouse events |
| `useCursorTool.ts` | ~70 | Cursor + interaction |
| `useSpawnTool.ts` | ~300 | Spawn tool logic |
| `types.ts` | ~70 | Shared interfaces |
| `utils.ts` | ~30 | Shared utilities |
| Other tools | ~20 each | Future implementations |

**Total: Same functionality, much better organized!**

## Future Tool Implementation

To add a new tool:

1. Create `useMyTool.ts` in `individual-tools/`
2. Implement the standard tool interface
3. Add tool to the main `index.ts` orchestrator
4. No changes needed to existing tools!

Example:
```typescript
// individual-tools/useMyTool.ts
export function useMyTool(isActive: boolean) {
  const renderOverlay = useCallback(() => {
    if (!isActive) return;
    // My tool's overlay rendering
  }, [isActive]);

  const handlers = {
    onMouseDown: () => { /* my tool logic */ },
    onMouseMove: () => { /* my tool logic */ },
    onMouseUp: () => { /* my tool logic */ },
  };

  return { renderOverlay, handlers };
}
```

The architecture is now ready to scale to dozens of tools without becoming unmanageable!