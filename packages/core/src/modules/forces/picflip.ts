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
export const DEFAULT_PICFLIP_FLIP_RATIO = 0.9;
export const DEFAULT_PICFLIP_PRESSURE_ITERATIONS = 20;
export const DEFAULT_PICFLIP_OVERRELAXATION = 1.9;
export const DEFAULT_PICFLIP_DENSITY = 5.0;
export const DEFAULT_PICFLIP_RADIUS = 50.0;
export const DEFAULT_PICFLIP_PRESSURE = 500.0;

// State keys for per-particle state storage
type PicflipStateKeys = "prevVelX" | "prevVelY";

type PicflipInputs = {
  gridResolution: number;
  flipRatio: number;
  pressureIterations: number;
  overrelaxation: number;
  density: number;
  radius: number;
  pressure: number;
};

export class Picflip extends Module<"picflip", PicflipInputs, PicflipStateKeys> {
  readonly name = "picflip" as const;
  readonly role = ModuleRole.Force;
  readonly inputs = {
    gridResolution: DataType.NUMBER,
    flipRatio: DataType.NUMBER,
    pressureIterations: DataType.NUMBER,
    overrelaxation: DataType.NUMBER,
    density: DataType.NUMBER,
    radius: DataType.NUMBER,
    pressure: DataType.NUMBER,
  } as const;

  constructor(opts?: {
    enabled?: boolean;
    gridResolution?: number;
    flipRatio?: number;
    pressureIterations?: number;
    overrelaxation?: number;
    density?: number;
    radius?: number;
    pressure?: number;
  }) {
    super();
    this.write({
      gridResolution: opts?.gridResolution ?? DEFAULT_PICFLIP_GRID_RESOLUTION,
      flipRatio: opts?.flipRatio ?? DEFAULT_PICFLIP_FLIP_RATIO,
      pressureIterations:
        opts?.pressureIterations ?? DEFAULT_PICFLIP_PRESSURE_ITERATIONS,
      overrelaxation: opts?.overrelaxation ?? DEFAULT_PICFLIP_OVERRELAXATION,
      density: opts?.density ?? DEFAULT_PICFLIP_DENSITY,
      radius: opts?.radius ?? DEFAULT_PICFLIP_RADIUS,
      pressure: opts?.pressure ?? DEFAULT_PICFLIP_PRESSURE,
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
  setPressureIterations(v: number): void {
    this.write({ pressureIterations: v });
  }
  setOverrelaxation(v: number): void {
    this.write({ overrelaxation: v });
  }
  setDensity(v: number): void {
    this.write({ density: v });
  }
  setRadius(v: number): void {
    this.write({ radius: v });
  }
  setPressure(v: number): void {
    this.write({ pressure: v });
  }

  // Getters
  getGridResolution(): number {
    return this.readValue("gridResolution");
  }
  getFlipRatio(): number {
    return this.readValue("flipRatio");
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
  getRadius(): number {
    return this.readValue("radius");
  }
  getPressure(): number {
    return this.readValue("pressure");
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

      // Apply pass: PIC/FLIP velocity update
      apply: ({ particleVar, dtVar, getUniform, getState }) => `{
  let flipRatio = ${getUniform("flipRatio")};
  let rad = ${getUniform("radius")};
  let pressureScale = ${getUniform("pressure")};

  // Get stored previous velocity
  let prevVelX = ${getState("prevVelX")};
  let prevVelY = ${getState("prevVelY")};

  // Gravity is handled by the Environment module; keep Picflip focused on the
  // PIC/FLIP blend and density-pressure response.
  var newVelX = ${particleVar}.velocity.x;
  var newVelY = ${particleVar}.velocity.y;

  // For full PIC/FLIP we would:
  // 1. Transfer to grid (P2G)
  // 2. Apply forces on grid
  // 3. Solve pressure
  // 4. Transfer back (G2P)
  //
  // This simplified version applies a local pressure approximation
  // using neighbor density to simulate incompressibility

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
    // NOTE: This simplified pressure term can be "stiff" and become frame-rate sensitive.
    // We clamp its strength and the resulting acceleration so behavior remains stable across
    // 60Hz/120Hz displays (and under occasional dt spikes).
    let maxPressureFactor = abs(pressureScale) * 10.0;
    let pressureFactor = clamp(
      (density - targetDensity) * pressureScale,
      -maxPressureFactor,
      maxPressureFactor
    );

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

    // Clamp acceleration magnitude (units: velocity / second)
    let maxAccel = 20000.0;
    var grad = vec2<f32>(gradX, gradY);
    let gl = length(grad);
    if (gl > maxAccel) {
      grad = grad * (maxAccel / max(gl, 1e-6));
    }

    newVelX = newVelX + grad.x * ${dtVar};
    newVelY = newVelY + grad.y * ${dtVar};
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

      // Apply pass: PIC/FLIP velocity update
      apply: ({ particle, getNeighbors, dt, getState }) => {
        const flipRatio = this.readValue("flipRatio");
        const targetDensity = this.readValue("density");
        const rad = this.readValue("radius");
        const pressureScale = this.readValue("pressure");

        // Get stored previous velocity
        const prevVelX = getState("prevVelX");
        const prevVelY = getState("prevVelY");

        // Gravity is handled by the Environment module; keep Picflip focused on the
        // PIC/FLIP blend and density-pressure response.
        let newVelX = particle.velocity.x;
        let newVelY = particle.velocity.y;

        // Local pressure approximation using neighbor density
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
          // NOTE: This simplified pressure term can be stiff; clamp to avoid dt-dependent
          // instability (notably visible at lower FPS / larger dt).
          const maxPressureFactor = Math.abs(pressureScale) * 10.0;
          const rawPressureFactor = (density - targetDensity) * pressureScale;
          const pressureFactor = Math.max(
            -maxPressureFactor,
            Math.min(maxPressureFactor, rawPressureFactor)
          );

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

          // Clamp acceleration magnitude (units: velocity / second)
          const maxAccel = 20000.0;
          const gradLen = Math.hypot(gradX, gradY);
          if (gradLen > maxAccel && gradLen > 1e-6) {
            const s = maxAccel / gradLen;
            gradX *= s;
            gradY *= s;
          }

          newVelX += gradX * dt;
          newVelY += gradY * dt;
        }

        particle.velocity.x = newVelX;
        particle.velocity.y = newVelY;
      },
    };
  }
}
