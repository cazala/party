import { Force } from "../system";
import { Particle } from "../particle";
import { SpatialGrid } from "../spatial-grid";

// Default constants for Trail
export const DEFAULT_TRAIL_ENABLED = false;
export const DEFAULT_TRAIL_DECAY = 0.5;
export const DEFAULT_TRAIL_DIFFUSE = 1;

export interface SensorsOptions {
  enableTrail?: boolean;
  trailDecay?: number;
  trailDiffuse?: number;
}

export class Sensors implements Force {
  // Trail configuration
  public enableTrail: boolean;
  public trailDecay: number;
  public trailDiffuse: number;

  constructor(options: SensorsOptions = {}) {
    // Trail configuration
    this.enableTrail = options.enableTrail ?? DEFAULT_TRAIL_ENABLED;
    this.trailDecay = options.trailDecay ?? DEFAULT_TRAIL_DECAY;
    this.trailDiffuse = options.trailDiffuse ?? DEFAULT_TRAIL_DIFFUSE;
  }

  setEnableTrail(enableTrail: boolean): void {
    this.enableTrail = enableTrail;
  }

  setTrailDecay(trailDecay: number): void {
    this.trailDecay = Math.max(0, Math.min(1, trailDecay));
  }

  setTrailDiffuse(trailDiffuse: number): void {
    this.trailDiffuse = Math.max(0, Math.min(3, Math.round(trailDiffuse)));
  }

  apply(_particle: Particle, _spatialGrid: SpatialGrid): void {
    // Sensors force is purely for trail functionality
    // No actual force application needed
  }
}

export function createSensorsForce(
  enableTrail: boolean = DEFAULT_TRAIL_ENABLED,
  trailDecay: number = DEFAULT_TRAIL_DECAY,
  trailDiffuse: number = DEFAULT_TRAIL_DIFFUSE
): Sensors {
  return new Sensors({ enableTrail, trailDecay, trailDiffuse });
}

export const defaultSensors = createSensorsForce();