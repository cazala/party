## Tools cleanup and unification plan

### Goals

- Reduce duplication across tools (event handling, overlays, cursor/circle drawing, world/screen math, undo/redo patterns).
- Standardize APIs and state handling so tools are plug-and-play and consistent.
- Improve type safety (remove `any`/`unknown` where practical) and document extensibility.
- Preserve current behaviors and performance; simplify mental model for future tools.

### Key observations (current state)

- Mouse and overlay patterns vary:

  - Some tools keep module-level state to sync overlay and handlers (good pattern), others mix refs/local state.
  - Several tools (spawn/draw/shape) expose `setMousePosition`/`updateMousePosition` while others use the `mouse` param passed into `renderOverlay`.
  - Cursor-hiding logic is duplicated (pin/remove/joint).
  - Repeated drawing primitives (dashed line, dashed circle, small dot markers).

- Event-handling differences:

  - Some handlers call `stopImmediatePropagation` (blocks overlay updates), others only `stopPropagation`.
  - PreventDefault/propagation policy is inconsistent.

- Coordinate conversions:

  - `worldToScreen` logic is reimplemented in some tools (e.g., joint) while `useOverlay` already relies on `screenToWorld`.

- Undo/redo patterns:
  - Commands sometimes use `any`/`unknown`, and multi-step commands (draw/shape) roll up into transactions.
  - Concurrency guard for redo/undo was missing; now added via `isUndoing/isRedoing`.

### Proposed architecture (unify APIs)

1. Tool interface unification

- Standardize tool overlay signature across all tools:
  - `renderOverlay(ctx, canvasSize, mouse?)` as already defined in `tools/types.ts`.
  - Remove tool-specific `setMousePosition`/`updateMousePosition` public methods; overlays should rely on the `mouse` param and the tool's own module-level state when needed.
- Standardize event policy in all tools:
  - Use `ev.preventDefault()` + `ev.stopPropagation()`.
  - Avoid `stopImmediatePropagation()` to keep overlay mouse tracking live.
- Adopt module-level state for every tool that has overlay previews (already used by draw/shape/remove/pin/joint) for cross-instance consistency.

2. Centralized helpers in a shared module (new `hooks/tools/shared.ts`)

- Drawing helpers:
  - `drawDashedLine(ctx, from, to, color = rgba(255,255,255,0.8), width = 2, dash = [6,6])`
  - `drawDashedCircle(ctx, center, radius, color = rgba(255,255,255,0.8), width = 2, dash = [8,4])`
  - `drawDot(ctx, center, radius = 3, color = #fff)`
- Coordinate helpers:
  - `worldToScreen(engine, world)` for the rare cases a tool needs it (most should use overlay `mouse`).
- Cursor control:
  - Do not set cursor styles from tool hooks. Cursor visibility/style must be handled via CSS classes on the canvas (e.g., `#canvas.spawn-tool`, `#canvas.pin-tool`, etc.) defined in `App.css` and applied in `Canvas.tsx`.

3. Event handling utilities (optional)

- Provide a thin wrapper for tool mouse handlers to normalize extraction of `(sx, sy)` and modifier keys.
  - `getMouseInfo(ev, canvas): { sx, sy, ctrl, shift }`.
  - Use across tools to reduce boilerplate.

4. Undo/redo improvements

- Keep `useHistory` concurrency guards (`isUndoing/isRedoing`)—done.
- Add `type-safe` Command shape:
  - Define `Command<Ctx = HistoryContext>` with explicit `do(ctx: Ctx): void | Promise<void>` and `undo(ctx: Ctx): void | Promise<void>`.
  - Remove casts to `unknown` and `any` in new/updated code.
  - For grouped commands (transactions), store `__childIds` as now, but type it via an interface.

### Standard API surface (target state)

- Each tool hook returns:
  - `handlers: ToolHandlers` (normalized event policy)
  - `renderOverlay: ToolRenderFunction` (uses `mouse` when available)
  - Optional read-only booleans (e.g., `isGrabbing`) when needed by UI.
- `useTools()` remains the aggregator; remove spawn-only `updateMousePosition` plumbing once spawn/draw/shape overlays rely on the `mouse` param exclusively.
- Tools must not alter cursor styles; rely on canvas classes added in `Canvas.tsx` and rules in `App.css`.

### Specific cleanups per tool

- Spawn

  - Remove `updateMousePosition/startDrag/updateDrag/endDrag` from the public API if feasible.
  - Use module-level state for overlay preview (already present) but seed solely via overlay `mouse`.

- Draw

  - Keep module-level state for size-adjust/step logic.
  - No `stopImmediatePropagation` in handlers.
  - Use shared helpers for dashed line/circle/dot rendering.

- Shape

  - Keep module-level state; standardize overlay drawing via shared helpers.
  - Replace `any`/`unknown` in command creation with typed `Command`.

- Remove/Pin

  - Rely on `Canvas.tsx` to add `pin-tool`/`remove-tool` classes and `App.css` to hide the cursor. No cursor manipulation inside hooks.
  - Use shared dashed circle helpers for overlays.

- Joint

  - Keep module-level state (selection sync resolved the overlay bug).
  - Use shared `drawDashedLine` for preview and remove ad-hoc styles.
  - Use shared `worldToScreen` helper when needed.
  - Cursor hidden via `joint-tool` CSS class on the canvas, not from the hook.

- Grab/Interact/Emitter
  - Ensure consistent handler policy; overlays use shared helpers (grab likely no overlay).
  - Emitter: when implemented, follow the standard pattern.

### Typing strategy

- Introduce/extend types in `tools/types.ts`:
  - `ToolMouse = { x: number; y: number }`.
  - `CanvasSize = { width: number; height: number }`.
  - `DrawColor = { r: number; g: number; b: number; a: number }`.
  - `Command<Ctx = HistoryContext>` typed as above.
- Replace `any` and `unknown` in commands and engine particles with clear interfaces (e.g., `Particle`, `Joint`, etc.) where available from `@cazala/party` or local `types`.

### Migration plan (incremental, safe)

1. Create `hooks/tools/shared.ts` with the drawing, coordinate, and cursor helpers.
2. Update overlay renderers to use shared helpers (no behavior changes).
3. Standardize event policy across tools (remove `stopImmediatePropagation`).
4. Remove spawn/draw/shape `setMousePosition/updateMousePosition` from the public `useTools` façade:
   - Use the `mouse` param exclusively in overlays.
   - Keep internal state seeding for spawn if drag interactions are required; otherwise rely on `Overlay` mouse.
5. Type improvements:
   - Add typed `Command` and update tools that construct commands to use it.
   - Replace `any/unknown` in new edits only; follow up to retrofit older code.
6. Verify undo/redo concurrency guard under rapid key repeats.
7. QA checklist (see below).

### QA checklist

- Overlay visuals unchanged except for intentional style tweaks.
- Joint selection preview renders correctly and cursor hidden when active.
- Draw size-adjust behaves after multiple strokes; preview follows cursor.
- Remove/Pin radius previews use shared helpers and hide cursor correctly.
- Rapid redo during draw/shape redoes only once until completion.
- No regressions in interaction/grab behavior.

### Acceptance criteria

- All tools implement the standardized handler + overlay interface.
- `useTools` no longer exports spawn-specific mouse plumbing (unless truly required by drag interactions).
- Shared helpers exist and are used by at least draw/shape/remove/pin/joint.
- Commands are typed; no new `any`/`unknown` added.
- Linter passes; no TypeScript downgrades in safety.

### Follow-up (optional niceties)

- Add a storybook-like dev overlay toggle to display debug cursor position and tool state.
- Benchmark overlay drawing perf with the new helpers; prebind dash arrays and colors for fewer allocations.

### Minimal examples (illustrative)

```ts
// hooks/tools/shared.ts (new)
export function drawDashedLine(
  ctx: CanvasRenderingContext2D,
  from: { x: number; y: number },
  to: { x: number; y: number },
  color = "rgba(255,255,255,0.8)",
  width = 2,
  dash: number[] = [6, 6]
) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.setLineDash(dash);
  ctx.beginPath();
  ctx.moveTo(from.x, from.y);
  ctx.lineTo(to.x, to.y);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
}
```

```ts
// tools/types.ts (extensions)
export interface Command<Ctx = HistoryContext> {
  id: string;
  label: string;
  timestamp: number;
  do: (ctx: Ctx) => void | Promise<void>;
  undo: (ctx: Ctx) => void | Promise<void>;
}
```
