## Migration Plan: Move Oscillators Into Core Engine

### Goals

- **Centralize** oscillator logic inside the core engine so updates occur in the engine’s single animation loop.
- **Replace** UI/Redux-driven oscillators with engine-managed ones.
- **Use numeric speed** (Hz) instead of string presets, while preserving current UX behavior.

### Public Engine API

Add an `OscillatorManager` accessible via the engine instance. The engine updates all oscillators each frame.

```ts
// Public types
export interface AddOscillatorOptions {
  curveExponent?: number; // default: 2 (matches current feel)
  jitter?: boolean | number; // false | true (→ 0.8–1.2) | explicit multiplier
  initialDirection?: -1 | 1; // optional direction seed
}

export interface OscillatorConfig {
  moduleName: string;
  inputName: string;
  min: number;
  max: number;
  speedHz: number; // cycles per second
  curveExponent: number;
  jitterMultiplier: number; // applied to speedHz
  phaseOffset: number; // radians
  lastValue: number;
  lastDirection: -1 | 0 | 1;
  active: boolean;
  createdAt: number; // ms
}

// Engine surface
interface OscillatorAPI {
  addOscillator(params: {
    moduleName: string;
    inputName: string;
    min: number;
    max: number;
    speedHz: number;
    options?: AddOscillatorOptions;
  }): string; // returns key "module:input"

  removeOscillator(moduleName: string, inputName: string): void;
  updateOscillatorSpeed(
    moduleName: string,
    inputName: string,
    speedHz: number
  ): void;
  updateOscillatorBounds(
    moduleName: string,
    inputName: string,
    min: number,
    max: number
  ): void;
  hasOscillator(moduleName: string, inputName: string): boolean;
  getOscillator(
    moduleName: string,
    inputName: string
  ): OscillatorConfig | undefined;
  clearOscillators(): void;
}
```

Integration point:

- The engine calls `oscillatorManager.updateAll(dtSeconds, nowMs)` inside the main animation loop (once per frame/tick).
- `updateAll` computes values and writes them back into modules via an existing engine setter (e.g., `engine.setInput(moduleName, inputName, value)`).

### Internal Data Model

- Key derivation: `key = `${moduleName}:${inputName}``.
- Store oscillators in a flat array for hot-path iteration and a `Map<string, index>` for O(1) lookup.
- Deterministic jitter: hash `key` to \([0,1)\), map to \([0.8, 1.2]\) when `jitter === true`.

### Oscillation Algorithm

Let center and amplitude be:

- `center = min + (max - min) / 2`
- `amplitude = (max - min) / 2`

Per frame, advance phase and compute value:

- Effective frequency: `effectiveHz = speedHz * jitterMultiplier`
- Phase: `phase = 2π · effectiveHz · elapsedSeconds + phaseOffset`
- Curve (matched to UI feel): `value = center + sign(sin(phase)) · |sin(phase)|^k · amplitude`, with `k = curveExponent`.
- Clamp to \([min, max]\). Track `lastDirection` from delta sign.

Start/resume from current value preserving direction:

- Normalize: `normalized = (value - center) / amplitude` (guard `amplitude = 0` → `value = center`).
- Invert curve: `targetSin = sign(normalized) · |normalized|^(1/k)`, clamp to \([-1,1]\).
- Candidates: `asin(targetSin)` and `π - asin(targetSin)`. Choose by desired direction via the sign of `cos(phase)`.
- Nudge away from extrema with a small epsilon if `|cos(phase)| ≈ 0`.

### Engine Loop Integration

In the engine’s tick:

- Compute `dtSeconds` and `nowMs`.
- Skip updates when engine is globally paused.
- Call `oscillatorManager.updateAll(dtSeconds, nowMs)`.

`updateAll` iterates all active oscillators, computes next values, and applies them with `engine.setInput(...)`.

### Serialization

Provide optional persistence for exact continuity:

```ts
type SerializedOscillator = Pick<OscillatorConfig,
  'moduleName' | 'inputName' | 'min' | 'max' | 'speedHz' | 'curveExponent' | 'jitterMultiplier' | 'phaseOffset' | 'lastDirection'
>;

engine.serializeOscillators(): SerializedOscillator[];
engine.deserializeOscillators(data: SerializedOscillator[]): void;
```

### Recommended UI Speed Presets (optional)

If the UI cycles through named speeds, use numeric values:

- `slow`: `0.01 Hz` (≈ 100 s period)
- `normal`: `0.05 Hz` (≈ 20 s period)
- `fast`: `0.2 Hz` (≈ 5 s period)

### Redux State and Hook Pattern (Playground)

- Slice (`packages/playground/src/slices/oscillators.ts`):

  - Keep oscillators in Redux as the source of truth, keyed by `moduleName:inputName`.
  - Store numeric `speedHz`, `min`, `max`, and optional `options` (e.g., `curveExponent`). Playground should set defaults and not expose extra controls yet.
  - Actions: `setOscillator`, `removeOscillator`, `updateOscillatorSpeedHz`, `updateOscillatorBounds`, `clearAllOscillators`.
  - Optional migration helper to map legacy string speeds to Hz.

- Hook (`packages/playground/src/hooks/useOscillators.ts`):

  - Wrap selectors/dispatch with app hooks and expose values/setters for a given `moduleName/inputName`.
  - `useEffect` syncs Redux → engine:
    - When a config is present/changes, call `engine.addOscillator` or update APIs.
    - When a config is removed, call `engine.removeOscillator`.
    - Respect engine pause/resume.

- `Slider.tsx` (UI):
  - Use `useOscillators` to read/update Redux; do not call engine directly.
  - Toggle/cycle: dispatch to set or adjust `speedHz` in Redux.
  - Stop: dispatch `removeOscillator` for that `moduleName/inputName`.
  - Min/max drag end: dispatch `updateOscillatorBounds`.
  - Manual slider change: remove/pause oscillator via Redux and set the value via the normal input pathway.
  - Keep step rounding/snapping in UI; the engine runs continuous values.
  - Do not expose `curveExponent` controls in Playground (use engine defaults per oscillator).

### Breaking Changes

- Oscillator speed is numeric (`speedHz`) and required.
- Engine owns all oscillator animation; UI no longer runs its own animation loop for oscillation.
- Redux slice shape updated to store `speedHz`, `min`, `max` per `moduleName:inputName`.

### Migration Plan (Simple and Direct)

1. Core: Oscillator Manager

- Create `packages/core/src/beta/engine/oscillator-manager.ts` implementing:
  - Key derivation `key = moduleName:inputName`.
  - `addOscillator`, `removeOscillator`, `updateOscillatorSpeed`, `updateOscillatorBounds`, `hasOscillator`, `getOscillator`, `clearOscillators`.
  - Data structures: flat array for iteration, key→index map for lookup.
  - `add` overwrites existing config for the same key (idempotent).

2. Core: Engine Integration

- Export manager from `packages/core/src/beta/engine.ts`.
- Call `oscillatorManager.updateAll(dtSeconds, nowMs)` inside the engine loop.
- In `updateAll`, compute values using curve exponent and deterministic jitter, then `engine.setInput(moduleName, inputName, value)`.

3. Playground: Redux Slice

- Update `packages/playground/src/slices/oscillators.ts` to store numeric `speedHz`, `min`, `max` keyed by `moduleName:inputName`.
- Actions: `setOscillator({ key or names, min, max, speedHz })`, `removeOscillator`, `updateOscillatorSpeedHz`, `updateOscillatorBounds`, `clearAllOscillators`.

4. Playground: useOscillators Hook

- Implement selectors/dispatchers and an effect to sync Redux → engine:
  - On config create/change → `engine.addOscillator`/update methods.
  - On config removal → `engine.removeOscillator`.
  - No UI component calls the engine directly.

5. Playground: Slider Integration

- Replace local RAF/animation/phase math with simple Redux updates via `useOscillators`:
  - Toggle/cycle → dispatch `speedHz` updates (use the preset values above if cycling by name).
  - Stop → dispatch `removeOscillator`.
  - Drag bounds end → dispatch `updateOscillatorBounds`.
- Keep UI-only step rounding/snapping; the engine computes continuous values.

6. Clean-up

- Remove obsolete oscillator animation logic from `Slider.tsx` and any other UI files.
- Ensure only the hook effects synchronize with the engine.

7. Documentation

- Update user docs/help to reflect numeric speeds and the new engine-owned oscillation behavior.

### Performance

- `updateAll` is O(n) with no per-frame allocations.
- Precompute invariants where possible; keep hot path minimal.

### File/Code Organization

- Core:

  - `packages/core/src/beta/engine/oscillator-manager.ts` (new)
  - Export via `packages/core/src/beta/engine.ts`
  - Common types in `packages/core/src/beta/interfaces.ts`
  - Hash util: `packages/core/src/beta/utils/hash.ts` (FNV-1a)

- Playground:
  - `packages/playground/src/slices/oscillators.ts` (ensure numeric `speedHz` and required actions)
  - `packages/playground/src/hooks/useOscillators.ts` (selectors/dispatchers + sync effect)
  - `packages/playground/src/components/ui/Slider.tsx` (consume the hook; no direct engine calls)

### Rollout Steps

1. Core manager + engine loop integration
2. Playground slice (numeric `speedHz`) + actions
3. `useOscillators` hook with Redux → engine effect
4. `Slider.tsx` uses the hook; remove local animation
5. Clean-up + docs

### Decisions

- Multiple oscillators targeting the same `moduleName:inputName` overwrite by key (idempotent add).
- Only global engine pause is supported for now (no per-oscillator pause/resume yet).
- `curveExponent` remains configurable per oscillator in the core API; Playground will create oscillators with the default exponent and will not expose changing it in the UI for now.
