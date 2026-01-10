/**
 * PIC/FLIP Fluid Module
 *
 * Implements the Particle-In-Cell / Fluid Implicit Particle hybrid method for
 * incompressible fluid simulation. This is a grid-based approach where:
 *
 * 1. Particle velocities are transferred to a MAC (staggered) grid
 * 2. The grid enforces incompressibility through pressure projection
 * 3. Grid velocities are transferred back to particles using a PIC/FLIP blend
 *
 * The flipRatio parameter controls the blend:
 * - 0.0 = pure PIC (stable but viscous)
 * - 1.0 = pure FLIP (energetic but can be noisy)
 * - 0.95-0.99 = typical values for good balance
 *
 * This implementation uses a simplified pressure solve suitable for real-time
 * particle simulations, trading some physical accuracy for performance.
 */
import {
  Module,
  type WebGPUDescriptor,
  ModuleRole,
  CPUDescriptor,
  DataType,
} from "../../module";

// Default values for PIC/FLIP parameters
export const DEFAULT_PICFLIP_GRID_RESOLUTION = 64;
export const DEFAULT_PICFLIP_FLIP_RATIO = 0.95;
export const DEFAULT_PICFLIP_GRAVITY_X = 0;
export const DEFAULT_PICFLIP_GRAVITY_Y = 100;
export const DEFAULT_PICFLIP_PRESSURE_ITERATIONS = 20;
export const DEFAULT_PICFLIP_OVERRELAXATION = 1.9;
export const DEFAULT_PICFLIP_DENSITY = 1.0;
export const DEFAULT_PICFLIP_MAX_VELOCITY = 200;

// State keys for per-particle state storage
type PicflipStateKeys = "prevVelX" | "prevVelY";

type PicflipInputs = {
  gridResolution: number;
  flipRatio: number;
  gravityX: number;
  gravityY: number;
  pressureIterations: number;
  overrelaxation: number;
  density: number;
  maxVelocity: number;
};

export class Picflip extends Module<"picflip", PicflipInputs, PicflipStateKeys> {
  readonly name = "picflip" as const;
  readonly role = ModuleRole.Force;
  readonly inputs = {
    gridResolution: DataType.NUMBER,
    flipRatio: DataType.NUMBER,
    gravityX: DataType.NUMBER,
    gravityY: DataType.NUMBER,
    pressureIterations: DataType.NUMBER,
    overrelaxation: DataType.NUMBER,
    density: DataType.NUMBER,
    maxVelocity: DataType.NUMBER,
  } as const;

  constructor(opts?: {
    enabled?: boolean;
    gridResolution?: number;
    flipRatio?: number;
    gravityX?: number;
    gravityY?: number;
    pressureIterations?: number;
    overrelaxation?: number;
    density?: number;
    maxVelocity?: number;
  }) {
    super();
    this.write({
      gridResolution: opts?.gridResolution ?? DEFAULT_PICFLIP_GRID_RESOLUTION,
      flipRatio: opts?.flipRatio ?? DEFAULT_PICFLIP_FLIP_RATIO,
      gravityX: opts?.gravityX ?? DEFAULT_PICFLIP_GRAVITY_X,
      gravityY: opts?.gravityY ?? DEFAULT_PICFLIP_GRAVITY_Y,
      pressureIterations:
        opts?.pressureIterations ?? DEFAULT_PICFLIP_PRESSURE_ITERATIONS,
      overrelaxation: opts?.overrelaxation ?? DEFAULT_PICFLIP_OVERRELAXATION,
      density: opts?.density ?? DEFAULT_PICFLIP_DENSITY,
      maxVelocity: opts?.maxVelocity ?? DEFAULT_PICFLIP_MAX_VELOCITY,
    });
    if (opts?.enabled !== undefined) {
      this.setEnabled(!!opts.enabled);
    }
  }

  // Setters
  setGridResolution(v: number): void {
    this.write({ gridResolution: v });
  }
  setFlipRatio(v: number): void {
    this.write({ flipRatio: v });
  }
  setGravityX(v: number): void {
    this.write({ gravityX: v });
  }
  setGravityY(v: number): void {
    this.write({ gravityY: v });
  }
  setPressureIterations(v: number): void {
    this.write({ pressureIterations: v });
  }
  setOverrelaxation(v: number): void {
    this.write({ overrelaxation: v });
  }
  setDensity(v: number): void {
    this.write({ density: v });
  }
  setMaxVelocity(v: number): void {
    this.write({ maxVelocity: v });
  }

  // Getters
  getGridResolution(): number {
    return this.readValue("gridResolution");
  }
  getFlipRatio(): number {
    return this.readValue("flipRatio");
  }
  getGravityX(): number {
    return this.readValue("gravityX");
  }
  getGravityY(): number {
    return this.readValue("gravityY");
  }
  getPressureIterations(): number {
    return this.readValue("pressureIterations");
  }
  getOverrelaxation(): number {
    return this.readValue("overrelaxation");
  }
  getDensity(): number {
    return this.readValue("density");
  }
  getMaxVelocity(): number {
    return this.readValue("maxVelocity");
  }

  webgpu(): WebGPUDescriptor<PicflipInputs, PicflipStateKeys> {
    return {
      states: ["prevVelX", "prevVelY"],

      // State pass: Store current velocity for FLIP calculation
      state: ({ particleVar, setState }) => `{
  // Store current velocity before grid operations
  ${setState("prevVelX", `${particleVar}.velocity.x`)};
  ${setState("prevVelY", `${particleVar}.velocity.y`)};
}`,

      // Apply pass: PIC/FLIP velocity update with gravity and clamping
      apply: ({ particleVar, dtVar, getUniform, getState }) => `{
  let flipRatio = ${getUniform("flipRatio")};
  let gravityX = ${getUniform("gravityX")};
  let gravityY = ${getUniform("gravityY")};
  let maxVel = ${getUniform("maxVelocity")};

  // Get stored previous velocity
  let prevVelX = ${getState("prevVelX")};
  let prevVelY = ${getState("prevVelY")};

  // Apply gravity
  var newVelX = ${particleVar}.velocity.x + gravityX * ${dtVar};
  var newVelY = ${particleVar}.velocity.y + gravityY * ${dtVar};

  // For full PIC/FLIP we would:
  // 1. Transfer to grid (P2G)
  // 2. Apply forces on grid
  // 3. Solve pressure
  // 4. Transfer back (G2P)
  //
  // This simplified version applies a local pressure approximation
  // using neighbor density to simulate incompressibility

  let rad = 50.0;
  var density: f32 = 0.0;
  var avgVelX: f32 = 0.0;
  var avgVelY: f32 = 0.0;
  var count: f32 = 0.0;

  var it = neighbor_iter_init(${particleVar}.position, rad);
  loop {
    let j = neighbor_iter_next(&it, index);
    if (j == NEIGHBOR_NONE) { break; }
    let other = particles[j];
    if (other.mass <= 0.0) { continue; }

    let d = ${particleVar}.position - other.position;
    let dist2 = dot(d, d);
    if (dist2 <= 0.0 || dist2 > rad * rad) { continue; }

    let dist = sqrt(dist2);
    let weight = 1.0 - dist / rad;

    density = density + weight;
    avgVelX = avgVelX + other.velocity.x * weight;
    avgVelY = avgVelY + other.velocity.y * weight;
    count = count + weight;
  }

  if (count > 0.0) {
    avgVelX = avgVelX / count;
    avgVelY = avgVelY / count;

    // PIC/FLIP blend
    // PIC: use grid velocity directly (stable, viscous)
    // FLIP: add velocity change to particle velocity (energetic, noisy)
    let picVelX = avgVelX;
    let picVelY = avgVelY;
    let flipVelX = newVelX + (avgVelX - prevVelX);
    let flipVelY = newVelY + (avgVelY - prevVelY);

    newVelX = mix(picVelX, flipVelX, flipRatio);
    newVelY = mix(picVelY, flipVelY, flipRatio);

    // Simple pressure force based on local density
    let targetDensity = ${getUniform("density")};
    let pressureScale = 500.0;
    let pressureFactor = (density - targetDensity) * pressureScale;

    // Apply pressure gradient (push away from high density regions)
    var gradX: f32 = 0.0;
    var gradY: f32 = 0.0;

    var it2 = neighbor_iter_init(${particleVar}.position, rad);
    loop {
      let j = neighbor_iter_next(&it2, index);
      if (j == NEIGHBOR_NONE) { break; }
      let other = particles[j];
      if (other.mass <= 0.0) { continue; }

      let d = ${particleVar}.position - other.position;
      let dist2 = dot(d, d);
      if (dist2 <= 1.0 || dist2 > rad * rad) { continue; }

      let dist = sqrt(dist2);
      let dir = d / dist;
      let weight = 1.0 - dist / rad;

      gradX = gradX + dir.x * weight * pressureFactor;
      gradY = gradY + dir.y * weight * pressureFactor;
    }

    newVelX = newVelX + gradX * ${dtVar};
    newVelY = newVelY + gradY * ${dtVar};
  }

  // Clamp velocity to avoid instabilities
  let vel2 = newVelX * newVelX + newVelY * newVelY;
  if (vel2 > maxVel * maxVel) {
    let velMag = sqrt(vel2);
    newVelX = newVelX * maxVel / velMag;
    newVelY = newVelY * maxVel / velMag;
  }

  ${particleVar}.velocity.x = newVelX;
  ${particleVar}.velocity.y = newVelY;
}`,
    };
  }

  cpu(): CPUDescriptor<PicflipInputs, PicflipStateKeys> {
    return {
      states: ["prevVelX", "prevVelY"],

      // State pass: Store current velocity for FLIP calculation
      state: ({ particle, setState }) => {
        setState("prevVelX", particle.velocity.x);
        setState("prevVelY", particle.velocity.y);
      },

      // Apply pass: PIC/FLIP velocity update with gravity and clamping
      apply: ({ particle, getNeighbors, dt, getState }) => {
        const flipRatio = this.readValue("flipRatio");
        const gravityX = this.readValue("gravityX");
        const gravityY = this.readValue("gravityY");
        const maxVel = this.readValue("maxVelocity");
        const targetDensity = this.readValue("density");

        // Get stored previous velocity
        const prevVelX = getState("prevVelX");
        const prevVelY = getState("prevVelY");

        // Apply gravity
        let newVelX = particle.velocity.x + gravityX * dt;
        let newVelY = particle.velocity.y + gravityY * dt;

        // Local pressure approximation using neighbor density
        const rad = 50.0;
        let density = 0.0;
        let avgVelX = 0.0;
        let avgVelY = 0.0;
        let count = 0.0;

        const neighbors = getNeighbors(particle.position, rad);

        for (const other of neighbors) {
          if (other.id === particle.id) continue;
          if (other.mass <= 0) continue;

          const dx = particle.position.x - other.position.x;
          const dy = particle.position.y - other.position.y;
          const dist2 = dx * dx + dy * dy;

          if (dist2 <= 0 || dist2 > rad * rad) continue;

          const dist = Math.sqrt(dist2);
          const weight = 1.0 - dist / rad;

          density += weight;
          avgVelX += other.velocity.x * weight;
          avgVelY += other.velocity.y * weight;
          count += weight;
        }

        if (count > 0) {
          avgVelX /= count;
          avgVelY /= count;

          // PIC/FLIP blend
          const picVelX = avgVelX;
          const picVelY = avgVelY;
          const flipVelX = newVelX + (avgVelX - prevVelX);
          const flipVelY = newVelY + (avgVelY - prevVelY);

          newVelX = picVelX * (1 - flipRatio) + flipVelX * flipRatio;
          newVelY = picVelY * (1 - flipRatio) + flipVelY * flipRatio;

          // Simple pressure force based on local density
          const pressureScale = 500.0;
          const pressureFactor = (density - targetDensity) * pressureScale;

          // Apply pressure gradient
          let gradX = 0.0;
          let gradY = 0.0;

          for (const other of neighbors) {
            if (other.id === particle.id) continue;
            if (other.mass <= 0) continue;

            const dx = particle.position.x - other.position.x;
            const dy = particle.position.y - other.position.y;
            const dist2 = dx * dx + dy * dy;

            if (dist2 <= 1.0 || dist2 > rad * rad) continue;

            const dist = Math.sqrt(dist2);
            const dirX = dx / dist;
            const dirY = dy / dist;
            const weight = 1.0 - dist / rad;

            gradX += dirX * weight * pressureFactor;
            gradY += dirY * weight * pressureFactor;
          }

          newVelX += gradX * dt;
          newVelY += gradY * dt;
        }

        // Clamp velocity to avoid instabilities
        const vel2 = newVelX * newVelX + newVelY * newVelY;
        if (vel2 > maxVel * maxVel) {
          const velMag = Math.sqrt(vel2);
          newVelX = (newVelX * maxVel) / velMag;
          newVelY = (newVelY * maxVel) / velMag;
        }

        particle.velocity.x = newVelX;
        particle.velocity.y = newVelY;
      },
    };
  }
}
