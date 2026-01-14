# Tools (Playground)

This folder contains the Playground tool system: a small orchestrator (`useTools`) plus one hook per tool.

The intent is:

- Tools are **self-contained** and implement only their own gesture/overlay logic
- A single mouse/pointer “router” delegates events to the active tool
- Tool mode is stored in Redux (`slices/tools.ts`)

## Core files

- **`index.ts`**: `useTools()` orchestrator (wires tool hooks + overlay + mouse handler)
- **`types.ts`**: shared tool types (`ToolHandlers`, `ToolRenderFunction`, `UseToolsReturn`)
- **`useToolManager.ts`**: Redux integration for tool mode (`toolMode`, `setToolMode`, selectors)
- **`useMouseHandler.ts`**: attaches pointer/mouse/touch listeners to the canvas and delegates to the active tool
- **`useOverlay.ts`**: draws the background grid + coordinates overlay rendering order
- **`shared.ts`**: shared overlay drawing helpers (dashed circles/lines, mouse parsing, etc.)
- **`utils.ts`**: shared tool utilities (color parsing, random color selection, etc.)

## Tool hook contract

Each tool hook in `individual-tools/` follows the same pattern:

```typescript
export function useMyTool(isActive: boolean) {
  const renderOverlay: ToolRenderFunction = useCallback((ctx, size, mouse) => {
    if (!isActive) return;
    // draw tool-specific overlay
  }, [isActive]);

  const handlers: ToolHandlers = {
    onMouseDown: (e) => { /* ... */ },
    onMouseMove: (e) => { /* ... */ },
    onMouseUp: (e) => { /* ... */ },
  };

  return { renderOverlay, handlers };
}
```

Notes:

- Many tools use **module-level state** (file-scope objects) to keep overlays and event handlers in sync without React re-render timing issues.
- For **undo/redo**, tools either:
  - use transactions (`beginTransaction` / `appendToTransaction` / `commitTransaction`) when commands are applied as discrete steps, or
  - record a command without re-executing side effects at gesture end (`recordCommand`) when the tool already applied changes live during the gesture.

## Current tools (wired in `index.ts`)

These tool hooks are currently registered and used by the playground:

- **`useInteractTool.ts`**: drives the `Interaction` module
  - **Left click** attract, **right click** repel
  - **Ctrl/Cmd + drag** adjusts radius, **Shift + drag** adjusts strength
- **`useSpawnTool.ts`**: spawns single particles
  - click/drag to set initial velocity
  - **Ctrl/Cmd + drag** adjusts spawn size (persists)
  - **Shift** streams particles while dragging (spawn burst)
- **`useRemoveTool.ts`**: removes particles inside a circle
  - **Ctrl/Cmd + drag** adjusts radius
  - performance: uses `engine.getParticlesInRadius(...)` + `engine.setParticleMass(i, 0)` (no full `getParticles()` scan on drag)
- **`usePinTool.ts`**: pins/unpins particles inside a circle
  - **Shift** switches to unpin
  - **Ctrl/Cmd + drag** adjusts radius
  - performance: uses `engine.getParticlesInRadius(...)` + `engine.setParticleMass(...)` (no full `getParticles()` scan on drag)
- **`useGrabTool.ts`**: grabs a single particle and drags it using the `Grab` module
  - note: selection currently scans particles to find the closest hit (may be optimized later)
- **`useJointTool.ts`**: creates joints between two particles
  - click particle A, then click particle B to create a joint
  - **Ctrl/Cmd** chains joints from the last endpoint, **Esc** cancels selection
- **`useDrawTool.ts`**: draws particles + auto-connects joints while dragging
  - **Shift** pins while drawing
  - **Ctrl/Cmd + drag** adjusts draw particle size
- **`useBrushTool.ts`**: paints many particles in a circle
  - globally anchored hex lattice to avoid striping
  - **Shift** spawns pinned, **Ctrl/Cmd + drag** resizes radius
  - supports “hold to paint”
- **`useShapeTool.ts`**: spawns a polygon mesh (particles + joints)
  - **Ctrl/Cmd + drag** adjusts radius
  - **Shift + drag** adjusts sides

## Performance guidance for tool authors

- Avoid calling `engine.getParticles()` in hot paths (mouse move / drag) on WebGPU: it forces a full GPU→CPU readback.
- Prefer:
  - `engine.getParticlesInRadius(center, radius, { maxResults })`
  - `engine.setParticleMass(i, mass)` / `engine.setParticle(i, particle)`
  - batching into a single undoable command at gesture end (record, don’t re-run side effects).
