## Undo/Redo Design for Playground Tools

### Goals & Scope

- **Provide undo/redo** for tool actions in the playground.
- **In scope tools**: spawn, remove, pin, unpin, create joints, draw, shape.
- **Batching requirements**:
  - **Draw** and **Shape**: internally create multiple particles/joints; undo/redo must act atomically.
  - **Pin/Unpin** and **Remove**: often affect many particles at once (circle selection or drag); these must be batched as one operation.
- **Keyboard shortcuts**: Cmd+Z (Undo), Shift+Cmd+Z or Cmd+Y (Redo).

### High-Level Approach

- **Command pattern** with explicit history stacks:
  - `Command`: `{ id, label, timestamp, do(ctx), undo(ctx) }` and optional `tryMergeWith(next)`.
  - `TransactionCommand`: groups multiple `Command`s into a single atomic unit.
  - **History manager** maintains two stacks: `past[]` and `future[]`, with a configurable capacity.
  - **New command**: executes `do`, pushes onto `past`, clears `future`.
  - **Undo**: pops from `past`, calls `undo`, pushes onto `future`.
  - **Redo**: pops from `future`, calls `do`, pushes onto `past`.
- **Batching API** exposed to tools:
  - `beginTransaction(label)` / `commitTransaction()` / `cancelTransaction()`.
  - Tools add subcommands during the active transaction; the commit pushes a single `TransactionCommand` to history.
- **Integration**: Commands receive a shared `ctx` (engine instance, entity registries/selectors, store dispatchers) to apply changes reliably.

### Files and Modules to Add/Modify

- **Types**
  - Add `packages/playground/src/types/history.ts`
    - `export interface Command` and `export class TransactionCommand`.
    - `export interface HistoryContext` (engine, stores, selectors).
- **State**
  - Add `packages/playground/src/slices/history.ts` (Redux slice)
    - State: `{ past: Command[], future: Command[], capacity: number, transaction?: { label: string, commands: Command[] } }`.
    - Reducers/actions: `execute(command)`, `undo()`, `redo()`, `beginTransaction(label)`, `commitTransaction()`, `cancelTransaction()`, `clear()`.
    - Side-effect helpers to invoke `command.do/undo` with `HistoryContext`.
- **Hooks**
  - Add `packages/playground/src/hooks/useHistory.ts`
    - Returns: `undo, redo, canUndo, canRedo, beginTransaction, commitTransaction, cancelTransaction, executeCommand`.
    - Injects `HistoryContext` (via `EngineContext` + selectors).
- **Tool Integration**
  - Update relevant tool components under `packages/playground/src/components` to use the history API:
    - Spawn: wrap each create as a `SpawnCommand` or accumulate in a transaction if multi-spawn.
    - Remove: compute affected entity ids first, then a single `RemoveCommand` (or a transaction of `RemoveParticleCommand` + `RemoveJointCommand`).
    - Pin/Unpin: compute affected ids once; create one `PinCommand`/`UnpinCommand` with the full set.
    - Create joints: single `CreateJointCommand` (or batched if tool creates multiple at once).
    - Draw/Shape: `beginTransaction` on pointer down, emit subcommands during draw, `commitTransaction` on pointer up.
- **UI**
  - Add undo/redo buttons (disabled states) to the main toolbar and wire shortcuts in `packages/playground/src/App.tsx`.

### Command Specifications

All commands must be deterministic and reversible using only captured data and `HistoryContext`.

- **SpawnCommand**

  - Data: `{ label, created: Array<{ type: 'particle'|'joint'|'shape', snapshot }> }`.
  - `do(ctx)`: for each item, create via engine API; record assigned ids.
  - `undo(ctx)`: remove created entities by id.

- **RemoveCommand** (batched)

  - Data: `{ label, snapshots: Array<{ entityType, snapshot }>} where snapshot contains full state needed to restore (particles + all connected joints/constraints).`
  - `do(ctx)`: remove all entities; ensure joints referencing removed particles are removed.
  - `undo(ctx)`: restore entities from snapshots; re-link joints by original ids; if engine reassigns ids, map to consistent ids (see "Identity & Snapshots").

- **PinCommand / UnpinCommand** (batched)

  - Data: `{ label, particleIds: string[], previousPinStates?: Record<string, boolean> }`.
  - `do(ctx)`: set pinned state for all ids to true/false.
  - `undo(ctx)`: restore previousPinStates.

- **CreateJointCommand**

  - Data: `{ label, joints: Array<{ snapshot }> }`.
  - `do(ctx)`: create joints; capture ids.
  - `undo(ctx)`: remove created joints by id.

- **DrawCommand / ShapeCommand**
  - Implemented as `TransactionCommand` containing the sequence of Spawn/CreateJoint subcommands generated between pointer down/up.
  - Label includes count e.g., "Draw (24 particles, 23 joints)".

### Identity & Snapshots

- **Stable identity** is required to undo/redo reliably:
  - Prefer engine APIs that accept a caller-provided id for entities; if unavailable, maintain a mapping `{ tempId -> engineId }` after creation.
  - Snapshots should contain all attributes necessary to restore equivalently:
    - Particles: id, position, velocity, mass, radius, restitution, friction, pinned state, any custom attributes used by renderer/solver.
    - Joints/Constraints: id, type, endpoints (particle ids), parameters (rest length, stiffness, limits, etc.).
  - For remove, include all connected joints in the same snapshot group to preserve topology on undo.

### Transaction & Batching Rules

- **When to start/commit**
  - Draw/Shape: `beginTransaction` on pointer down; `commitTransaction` on pointer up or tool switch; `cancelTransaction` if gesture aborted.
  - Pin/Unpin: compute affected particles once (on gesture end) and push a single command; if continuous feedback is required during drag, collect subcommands but only commit once at the end.
  - Remove: similarly, compute selection set; single command or a transaction of subcommands; prefer one `RemoveCommand` with all snapshots for performance.
- **Merging**
  - Optional: `tryMergeWith` can coalesce consecutive small commands (e.g., repeated single spawns from rapid clicks) within a short time window and same tool.

### Keyboard & UI Behavior

- **Shortcuts**
  - Undo: Cmd+Z (macOS) / Ctrl+Z (others).
  - Redo: Shift+Cmd+Z or Cmd+Y (macOS) / Ctrl+Y (others).
- **Buttons**
  - Add Undo/Redo buttons to the toolbar with tooltip labels sourced from the last/next command label.
  - Disabled when `past.length === 0` or `future.length === 0`.

### Integration with Engine & Context

- **HistoryContext** should provide:
  - `engine`: reference to the running engine (from `packages/playground/src/contexts/EngineContext.tsx`).
  - `selectors`: utilities to find particles by region, collect connected joints, etc.
  - `entityRegistry`: helpers to map external ids to engine ids and vice versa if needed.
- **Selectors/Utilities**
  - Add `packages/playground/src/utils/selection.ts` for region-based selection (circle, lasso) returning particle ids and attached joints.
  - Add `packages/playground/src/utils/snapshot.ts` to build/restore snapshots for particles/joints.

### Edge Cases & Invariants

- **Redo invalidation**: executing any new command after undo clears the `future` stack.
- **Engine reset / scene load**: clear history (or provide a scene-aware history id to prevent applying commands across scenes).
- **Performance**: avoid deep clones of engine internals; serialize only needed fields into compact snapshots.
- **Ordering**: During restore, create particles first, then joints; remove in reverse order (joints before particles).
- **Capacity**: evict oldest commands when exceeding capacity (configurable, e.g., 100 transactions).

### Implementation Steps

1. **Scaffold history types and slice**
   - Create `Command`, `TransactionCommand`, `HistoryContext`.
   - Implement `history` slice with stacks and transaction state.
2. **Hook into `EngineContext`**
   - Provide `HistoryContext` via `useHistory` hook by reading engine and selectors.
3. **Utilities for selection and snapshots**
   - Implement region selection for circle/drag tools.
   - Implement snapshot capture and restore for particles and joints.
4. **Implement commands**
   - `SpawnCommand`, `RemoveCommand`, `PinCommand`, `UnpinCommand`, `CreateJointCommand`.
5. **Wire tools**
   - Update spawn/remove/pin/unpin/joint tools to dispatch commands.
   - Add draw/shape transaction lifecycles (pointer down/up).
6. **UI & Shortcuts**
   - Add toolbar buttons and keyboard handlers.
7. **Testing**
   - Unit tests for commands (do/undo/redo idempotence, ordering).
   - Integration tests for batched transactions (draw/shape, mass pin/unpin, mass remove).

### Testing Plan (Brief)

- **Unit tests**
  - Each command: `do` then `undo` yields original engine state; `do` after `undo` yields same as initial `do`.
  - Transaction: subcommands all applied/rolled back together.
- **Integration tests**
  - Simulate draw gesture: many particles/joints created; single history entry; undo removes all; redo restores all.
  - Mass pin/unpin: all targeted particles toggle together; undo restores previous states.
  - Remove region: removes particles and connected joints; undo restores both.

### Risks & Mitigations

- **ID stability**: If engine assigns non-deterministic ids, maintain a mapping layer inside snapshots to faithfully reconnect joints on restore.
- **Partial failures**: `do/undo` must be exception-safe; if any step fails, roll back within the command to maintain invariants.
- **Memory usage**: Large snapshots (draw/shape) can be heavy; cap history and consider compressing snapshots (omit defaults).

### Open Questions

- Does the engine allow caller-specified ids for particles/joints? If yes, prefer that to simplify snapshots.
- Are there existing selectors/utilities for region selection we can reuse in `packages/playground/src/hooks`?
- Should history be persisted across reloads (likely no for now)?

### Minimal Public API (Playground Layer)

```ts
// packages/playground/src/types/history.ts
export interface Command {
  id: string;
  label: string;
  timestamp: number;
  do(ctx: HistoryContext): void;
  undo(ctx: HistoryContext): void;
  tryMergeWith?(next: Command): Command | null; // optional
}

export interface HistoryContext {
  engine: Engine; // from EngineContext
  selectors: Selectors;
  entityRegistry: EntityRegistry;
}

export class TransactionCommand implements Command {
  // wraps multiple commands; applies/undoes in order/reverse
}
```

This plan isolates undo/redo as a cohesive layer, provides clear batching semantics for draw/shape and mass operations, and minimizes coupling by using a typed `HistoryContext` shared via hooks.
