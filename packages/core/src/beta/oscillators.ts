export type OscillatorKey = string; // `${moduleName}:${inputName}`

export interface AddOscillatorOptions {
  curveExponent?: number; // default 2
  jitter?: boolean | number; // false | true (0.8–1.2) | explicit multiplier
  initialDirection?: -1 | 1; // seed desired direction
  currentValue?: number; // optional starting value to preserve continuity on start
}

export interface OscillatorConfigInternal {
  moduleName: string;
  inputName: string;
  min: number;
  max: number;
  speedHz: number;
  curveExponent: number;
  jitterMultiplier: number;
  phaseOffset: number;
  lastValue: number;
  lastDirection: -1 | 0 | 1;
  active: boolean;
}

export interface OscillatorPublicConfig {
  moduleName: string;
  inputName: string;
  min: number;
  max: number;
  speedHz: number;
  curveExponent: number;
  jitterMultiplier: number;
  phaseOffset: number;
  lastDirection: -1 | 0 | 1;
  active: boolean;
}

function fnv1a32(str: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = (hash >>> 0) * 0x01000193;
    hash >>>= 0;
  }
  return hash >>> 0;
}

function hashToUnitInterval(input: string): number {
  return fnv1a32(input) / 4294967296; // 2^32
}

export class OscillatorManager {
  private keyToIndex: Map<OscillatorKey, number> = new Map();
  private oscillators: OscillatorConfigInternal[] = [];
  private elapsedSeconds: number = 0;
  private setInput: (
    moduleName: string,
    inputName: string,
    value: number
  ) => void;
  private listeners: Map<OscillatorKey, Set<(value: number) => void>> =
    new Map();

  constructor(
    setInput: (moduleName: string, inputName: string, value: number) => void
  ) {
    this.setInput = setInput;
  }

  private static makeKey(moduleName: string, inputName: string): OscillatorKey {
    return `${moduleName}:${inputName}`;
  }

  addOscillator(params: {
    moduleName: string;
    inputName: string;
    min: number;
    max: number;
    speedHz: number;
    options?: AddOscillatorOptions;
  }): OscillatorKey {
    const { moduleName, inputName, min, max, speedHz } = params;
    const opts = params.options ?? {};
    const key = OscillatorManager.makeKey(moduleName, inputName);

    const jitterMultiplier =
      typeof opts.jitter === "number"
        ? Math.max(0, opts.jitter)
        : opts.jitter === true
        ? 0.8 + 0.4 * hashToUnitInterval(key)
        : 1;

    const curveExponent = opts.curveExponent ?? 2;

    // Preserve direction if overwriting
    let lastDirection: -1 | 0 | 1 = 0;
    const existingIndex = this.keyToIndex.get(key);
    if (existingIndex !== undefined) {
      lastDirection = this.oscillators[existingIndex].lastDirection;
    }

    const config: OscillatorConfigInternal = {
      moduleName,
      inputName,
      min,
      max,
      speedHz,
      curveExponent,
      jitterMultiplier,
      phaseOffset: 0,
      lastValue: typeof opts.currentValue === "number" ? opts.currentValue : 0,
      lastDirection,
      active: true,
    };

    if (existingIndex !== undefined) {
      this.oscillators[existingIndex] = config;
      this.recalculatePhaseOffset(this.oscillators[existingIndex]);
      return key;
    }

    const index = this.oscillators.length;
    this.oscillators.push(config);
    this.keyToIndex.set(key, index);
    this.recalculatePhaseOffset(this.oscillators[index]);
    return key;
  }

  removeOscillator(moduleName: string, inputName: string): void {
    const key = OscillatorManager.makeKey(moduleName, inputName);
    const index = this.keyToIndex.get(key);
    if (index === undefined) return;
    const lastIndex = this.oscillators.length - 1;
    // swap-remove
    [this.oscillators[index], this.oscillators[lastIndex]] = [
      this.oscillators[lastIndex],
      this.oscillators[index],
    ];
    const moved = this.oscillators[index];
    const movedKey = OscillatorManager.makeKey(
      moved.moduleName,
      moved.inputName
    );
    this.keyToIndex.set(movedKey, index);
    this.oscillators.pop();
    this.keyToIndex.delete(key);
  }

  updateOscillatorSpeed(
    moduleName: string,
    inputName: string,
    speedHz: number
  ): void {
    const key = OscillatorManager.makeKey(moduleName, inputName);
    const index = this.keyToIndex.get(key);
    if (index === undefined) return;
    this.oscillators[index].speedHz = speedHz;
    this.recalculatePhaseOffset(this.oscillators[index]);
  }

  updateOscillatorBounds(
    moduleName: string,
    inputName: string,
    min: number,
    max: number
  ): void {
    const key = OscillatorManager.makeKey(moduleName, inputName);
    const index = this.keyToIndex.get(key);
    if (index === undefined) return;
    this.oscillators[index].min = min;
    this.oscillators[index].max = max;
    this.recalculatePhaseOffset(this.oscillators[index]);
  }

  hasOscillator(moduleName: string, inputName: string): boolean {
    return this.keyToIndex.has(
      OscillatorManager.makeKey(moduleName, inputName)
    );
  }

  getOscillator(
    moduleName: string,
    inputName: string
  ): OscillatorPublicConfig | undefined {
    const key = OscillatorManager.makeKey(moduleName, inputName);
    const index = this.keyToIndex.get(key);
    if (index === undefined) return undefined;
    const cfg = this.oscillators[index];
    return {
      moduleName: cfg.moduleName,
      inputName: cfg.inputName,
      min: cfg.min,
      max: cfg.max,
      speedHz: cfg.speedHz,
      curveExponent: cfg.curveExponent,
      jitterMultiplier: cfg.jitterMultiplier,
      phaseOffset: cfg.phaseOffset,
      lastDirection: cfg.lastDirection,
      active: cfg.active,
    };
  }

  clear(): void {
    this.keyToIndex.clear();
    this.oscillators = [];
    this.elapsedSeconds = 0;
    this.listeners.clear();
  }

  clearModule(moduleName: string): void {
    const indicesToRemove: number[] = [];
    for (let i = 0; i < this.oscillators.length; i++) {
      if (this.oscillators[i].moduleName === moduleName) {
        indicesToRemove.push(i);
      }
    }
    
    // Remove in reverse order to maintain indices
    for (let i = indicesToRemove.length - 1; i >= 0; i--) {
      const index = indicesToRemove[i];
      const osc = this.oscillators[index];
      const key = OscillatorManager.makeKey(osc.moduleName, osc.inputName);
      
      // Remove from keyToIndex map
      this.keyToIndex.delete(key);
      
      // Remove from listeners
      this.listeners.delete(key);
      
      // Swap-remove from oscillators array
      const lastIndex = this.oscillators.length - 1;
      if (index !== lastIndex) {
        this.oscillators[index] = this.oscillators[lastIndex];
        const moved = this.oscillators[index];
        const movedKey = OscillatorManager.makeKey(moved.moduleName, moved.inputName);
        this.keyToIndex.set(movedKey, index);
      }
      this.oscillators.pop();
    }
  }

  updateAll(dtSeconds: number): void {
    if (dtSeconds <= 0 || this.oscillators.length === 0) return;
    this.elapsedSeconds += dtSeconds;

    for (let i = 0; i < this.oscillators.length; i++) {
      const o = this.oscillators[i];
      if (!o.active) continue;

      const range = o.max - o.min;
      const center = o.min + range / 2;
      const amplitude = range / 2;
      if (amplitude <= 0) {
        this.setInput(o.moduleName, o.inputName, center);
        o.lastValue = center;
        o.lastDirection = 0;
        continue;
      }

      const effectiveHz = o.speedHz * o.jitterMultiplier;
      const phase =
        this.elapsedSeconds * effectiveHz * 2 * Math.PI + o.phaseOffset;
      const s = Math.sin(phase);
      const k = o.curveExponent;
      const curve = Math.sign(s) * Math.pow(Math.abs(s), k);
      const value = center + curve * amplitude;
      const clamped = Math.max(o.min, Math.min(o.max, value));

      const delta = clamped - o.lastValue;
      if (Math.abs(delta) > 1e-9) {
        o.lastDirection = delta > 0 ? 1 : -1;
      }
      o.lastValue = clamped;
      this.setInput(o.moduleName, o.inputName, clamped);
      const key = OscillatorManager.makeKey(o.moduleName, o.inputName);
      const fns = this.listeners.get(key);
      if (fns) {
        for (const fn of fns) {
          try {
            fn(clamped);
          } catch {}
        }
      }
    }
  }

  private recalculatePhaseOffset(o: OscillatorConfigInternal): void {
    const range = o.max - o.min;
    const center = o.min + range / 2;
    const amplitude = range / 2;
    if (amplitude <= 0) {
      o.phaseOffset = 0;
      return;
    }
    const normalizedValue = (o.lastValue - center) / amplitude;
    const clampedNormalized = Math.max(-1, Math.min(1, normalizedValue));
    // inverse of sign(sin) * |sin|^k
    let targetSin: number;
    if (Math.abs(clampedNormalized) < 1e-10) {
      targetSin = 0;
    } else {
      targetSin =
        Math.sign(clampedNormalized) *
        Math.pow(Math.abs(clampedNormalized), 1 / o.curveExponent);
    }
    targetSin = Math.max(-1, Math.min(1, targetSin));
    const asinVal = Math.asin(targetSin);
    const candidate0 = asinVal; // [-pi/2, pi/2]
    const candidate1 = Math.PI - asinVal;
    const desiredDir = o.lastDirection;
    const cos0 = Math.cos(candidate0);
    let targetPhase = candidate0;
    if (desiredDir < 0) {
      targetPhase = cos0 < 0 ? candidate0 : candidate1;
    } else if (desiredDir > 0) {
      targetPhase = cos0 >= 0 ? candidate0 : candidate1;
    }
    // Account for current elapsed time so new speed/bounds continue from current position
    const effectiveHz = o.speedHz * o.jitterMultiplier;
    const elapsedPhase = this.elapsedSeconds * effectiveHz * 2 * Math.PI;
    o.phaseOffset = targetPhase - elapsedPhase;
    if (Math.abs(Math.cos(o.phaseOffset)) < 1e-6) {
      const epsilon = 1e-3;
      o.phaseOffset += (desiredDir >= 0 ? 1 : -1) * epsilon;
    }
    // Normalize to [-pi, pi] to avoid drift
    if (o.phaseOffset > Math.PI || o.phaseOffset < -Math.PI) {
      o.phaseOffset = ((o.phaseOffset + Math.PI) % (2 * Math.PI)) - Math.PI;
    }
  }

  addOscillatorListener(
    moduleName: string,
    inputName: string,
    handler: (value: number) => void
  ): void {
    const key = OscillatorManager.makeKey(moduleName, inputName);
    let set = this.listeners.get(key);
    if (!set) {
      set = new Set();
      this.listeners.set(key, set);
    }
    set.add(handler);
  }

  removeOscillatorListener(
    moduleName: string,
    inputName: string,
    handler: (value: number) => void
  ): void {
    const key = OscillatorManager.makeKey(moduleName, inputName);
    const set = this.listeners.get(key);
    if (!set) return;
    set.delete(handler);
    if (set.size === 0) this.listeners.delete(key);
  }
}
