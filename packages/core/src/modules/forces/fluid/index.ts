import { Force, System } from "../../system";
import {
  FluidCPU,
  DEFAULT_FLUID_ENABLED,
  DEFAULT_INFLUENCE_RADIUS,
  DEFAULT_TARGET_DENSITY,
  DEFAULT_PRESSURE_MULTIPLIER,
  DEFAULT_VISCOSITY,
  DEFAULT_NEAR_PRESSURE_MULTIPLIER,
  DEFAULT_NEAR_THRESHOLD,
} from "./cpu";
import { FluidWebGPU } from "./webgpu";

export {
  DEFAULT_FLUID_ENABLED,
  DEFAULT_INFLUENCE_RADIUS,
  DEFAULT_TARGET_DENSITY,
  DEFAULT_PRESSURE_MULTIPLIER,
  DEFAULT_VISCOSITY,
  DEFAULT_NEAR_PRESSURE_MULTIPLIER,
  DEFAULT_NEAR_THRESHOLD,
};

// Re-export helpers used by renderer and tools for backward compatibility
export { calculateDensity, calculateNearDensity } from "./cpu";

export class Fluid implements Force {
  private implementation: FluidCPU | FluidWebGPU;

  public get enabled() {
    return this.implementation.enabled;
  }
  public set enabled(v: boolean) {
    this.implementation.setEnabled(v);
  }
  // Back-compat method used in UI
  public setEnabled(v: boolean) {
    this.enabled = v;
  }
  public get influenceRadius() {
    return (this.implementation as any).influenceRadius;
  }
  public set influenceRadius(v: number) {
    (this.implementation as any).influenceRadius = v;
  }
  public get targetDensity() {
    return (this.implementation as any).targetDensity;
  }
  public set targetDensity(v: number) {
    (this.implementation as any).targetDensity = v;
  }
  public get pressureMultiplier() {
    return (this.implementation as any).pressureMultiplier;
  }
  public set pressureMultiplier(v: number) {
    (this.implementation as any).pressureMultiplier = v;
  }
  public get viscosity() {
    return (this.implementation as any).viscosity;
  }
  public set viscosity(v: number) {
    (this.implementation as any).viscosity = v;
  }
  public get nearPressureMultiplier() {
    return (this.implementation as any).nearPressureMultiplier;
  }
  public set nearPressureMultiplier(v: number) {
    (this.implementation as any).nearPressureMultiplier = v;
  }
  public get nearThreshold() {
    return (this.implementation as any).nearThreshold;
  }
  public set nearThreshold(v: number) {
    (this.implementation as any).nearThreshold = v;
  }

  constructor(
    options: {
      enabled?: boolean;
      influenceRadius?: number;
      targetDensity?: number;
      pressureMultiplier?: number;
      viscosity?: number;
      nearPressureMultiplier?: number;
      nearThreshold?: number;
    } = {}
  ) {
    this.implementation = new FluidCPU(options);
  }

  before(particles: any, delta?: any) {
    return (this.implementation as any).before?.(particles, delta);
  }
  apply(particles: any, spatialGrid: any) {
    return (this.implementation as any).apply(particles, spatialGrid);
  }
  clear() {
    return (this.implementation as any).clear?.();
  }

  setBackend(backend: "cpu" | "webgpu"): boolean {
    const wantsWebGPU = backend === "webgpu";
    const isWebGPU = this.implementation instanceof FluidWebGPU;
    if (wantsWebGPU === isWebGPU) return true;

    const current = this.implementation as any;
    const options = {
      enabled: current.enabled,
      influenceRadius: current.influenceRadius,
      targetDensity: current.targetDensity,
      pressureMultiplier: current.pressureMultiplier,
      viscosity: current.viscosity,
      nearPressureMultiplier: current.nearPressureMultiplier,
      nearThreshold: current.nearThreshold,
    };

    if (wantsWebGPU) {
      const canUseWebGPU =
        typeof navigator !== "undefined" && !!(navigator as any).gpu;
      if (!canUseWebGPU) return false;
      this.implementation = new FluidWebGPU(options);
      return true;
    }
    this.implementation = new FluidCPU(options);
    return true;
  }

  getBackend(): "cpu" | "webgpu" {
    return this.implementation instanceof FluidWebGPU ? "webgpu" : "cpu";
  }

  init?(_system: System): void {
    const canUseWebGPU =
      typeof navigator !== "undefined" && !!(navigator as any).gpu;
    if (canUseWebGPU && !(this.implementation instanceof FluidWebGPU)) {
      this.setBackend("webgpu");
    }
  }

  // Backward-compatibility helpers used by renderer
  calculatePressureForce(point: any, particles: any) {
    if (
      typeof (this.implementation as any).calculatePressureForce === "function"
    ) {
      return (this.implementation as any).calculatePressureForce(
        point,
        particles
      );
    }
    // Fallback: zero vector
    return { x: 0, y: 0 } as any;
  }

  convertDensityToPressure(density: number, nearDensity: number) {
    if (
      typeof (this.implementation as any).convertDensityToPressure ===
      "function"
    ) {
      return (this.implementation as any).convertDensityToPressure(
        density,
        nearDensity
      );
    }
    // Fallback compute from current properties
    const densityDifference = density - (this as any).targetDensity;
    const pressure = densityDifference * (this as any).pressureMultiplier;
    const nearPressure = nearDensity * (this as any).nearPressureMultiplier;
    return { pressure, nearPressure };
  }
}

export function createFluidForce(options?: {
  enabled?: boolean;
  influenceRadius?: number;
  targetDensity?: number;
  pressureMultiplier?: number;
  viscosity?: number;
  nearPressureMultiplier?: number;
  nearThreshold?: number;
}) {
  return new Fluid(options);
}
