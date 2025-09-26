/**
 * Fluid (Force Module)
 *
 * SPH-inspired fluid approximation. Two-phase algorithm:
 * - state(): compute particle density and near-density using neighbor kernels
 * - apply(): compute pressure gradient and viscosity forces; clamp max accel
 * Stores per-particle state in shared SIM_STATE via the Program-provided helpers.
 */
import {
  Module,
  type WebGPUDescriptor,
  ModuleRole,
  CPUDescriptor,
} from "../../module";

type FluidsInputKeys =
  | "influenceRadius"
  | "targetDensity"
  | "pressureMultiplier"
  | "viscosity"
  | "nearPressureMultiplier"
  | "nearThreshold"
  | "enableNearPressure"
  | "maxAcceleration";

export const DEFAULT_FLUIDS_INFLUENCE_RADIUS = 100;
export const DEFAULT_FLUIDS_TARGET_DENSITY = 1;
export const DEFAULT_FLUIDS_PRESSURE_MULTIPLIER = 30;
export const DEFAULT_FLUIDS_VISCOSITY = 1;
export const DEFAULT_FLUIDS_NEAR_PRESSURE_MULTIPLIER = 50;
export const DEFAULT_FLUIDS_NEAR_THRESHOLD = 20;
export const DEFAULT_FLUIDS_ENABLE_NEAR_PRESSURE = true;
export const DEFAULT_FLUIDS_MAX_ACCELERATION = 75;

type FluidStateKeys = "density" | "nearDensity";

export class Fluids extends Module<"fluids", FluidsInputKeys, FluidStateKeys> {
  readonly name = "fluids" as const;
  readonly role = ModuleRole.Force;
  readonly keys = [
    "influenceRadius",
    "targetDensity",
    "pressureMultiplier",
    "viscosity",
    "nearPressureMultiplier",
    "nearThreshold",
    "enableNearPressure",
    "maxAcceleration",
  ] as const;

  constructor(opts?: {
    enabled?: boolean;
    influenceRadius?: number;
    targetDensity?: number;
    pressureMultiplier?: number;
    viscosity?: number;
    nearPressureMultiplier?: number;
    nearThreshold?: number;
    enableNearPressure?: boolean;
    maxAcceleration?: number;
  }) {
    super();
    this.write({
      influenceRadius: opts?.influenceRadius ?? DEFAULT_FLUIDS_INFLUENCE_RADIUS,
      targetDensity: opts?.targetDensity ?? DEFAULT_FLUIDS_TARGET_DENSITY,
      pressureMultiplier:
        opts?.pressureMultiplier ?? DEFAULT_FLUIDS_PRESSURE_MULTIPLIER,
      viscosity: opts?.viscosity ?? DEFAULT_FLUIDS_VISCOSITY,
      nearPressureMultiplier:
        opts?.nearPressureMultiplier ?? DEFAULT_FLUIDS_NEAR_PRESSURE_MULTIPLIER,
      nearThreshold: opts?.nearThreshold ?? DEFAULT_FLUIDS_NEAR_THRESHOLD,
      enableNearPressure:
        opts?.enableNearPressure ?? DEFAULT_FLUIDS_ENABLE_NEAR_PRESSURE ? 1 : 0,
      maxAcceleration: opts?.maxAcceleration ?? DEFAULT_FLUIDS_MAX_ACCELERATION,
    });
    if (opts?.enabled !== undefined) {
      this.setEnabled(!!opts.enabled);
    }
  }

  setInfluenceRadius(v: number): void {
    this.write({ influenceRadius: v });
  }
  setTargetDensity(v: number): void {
    this.write({ targetDensity: v });
  }
  setPressureMultiplier(v: number): void {
    this.write({ pressureMultiplier: v });
  }
  setViscosity(v: number): void {
    this.write({ viscosity: v });
  }
  setNearPressureMultiplier(v: number): void {
    this.write({ nearPressureMultiplier: v });
  }
  setNearThreshold(v: number): void {
    this.write({ nearThreshold: v });
  }
  setEnableNearPressure(enabled: boolean): void {
    this.write({ enableNearPressure: enabled ? 1 : 0 });
  }

  setMaxAcceleration(v: number): void {
    this.write({ maxAcceleration: v });
  }

  getInfluenceRadius(): number {
    return this.readValue("influenceRadius");
  }
  getTargetDensity(): number {
    return this.readValue("targetDensity");
  }
  getPressureMultiplier(): number {
    return this.readValue("pressureMultiplier");
  }
  getViscosity(): number {
    return this.readValue("viscosity");
  }
  getNearPressureMultiplier(): number {
    return this.readValue("nearPressureMultiplier");
  }
  getNearThreshold(): number {
    return this.readValue("nearThreshold");
  }
  getEnableNearPressure(): number {
    return this.readValue("enableNearPressure");
  }
  getMaxAcceleration(): number {
    return this.readValue("maxAcceleration");
  }

  webgpu(): WebGPUDescriptor<FluidsInputKeys, FluidStateKeys> {
    return {
      states: ["density", "nearDensity"],
      // State pass: precompute density and near-density per particle
      state: ({ particleVar, dtVar, getUniform, setState }) => `{
  // Predict current particle position for this frame (approximate)
  let rad = ${getUniform("influenceRadius")};
  let posPred = ${particleVar}.position + ${particleVar}.velocity * (${dtVar});
  var density: f32 = 0.0;
  var nearDensity: f32 = 0.0;

  // Precompute radius powers for kernels
  let r2 = rad * rad;
  let r4 = r2 * r2;
  let r6 = r4 * r2;
  let r8 = r4 * r4;

  // Iterate neighbors using the spatial grid
  var it = neighbor_iter_init(posPred, rad);
  loop {
    let j = neighbor_iter_next(&it, index);
    if (j == NEIGHBOR_NONE) { break; }
    let other = particles[j];

    let d = posPred - other.position;
    let dist2 = dot(d, d);
    if (dist2 <= 0.0) { continue; }
    let dist = sqrt(dist2);
    let factor = max(rad - dist, 0.0);
    if (factor <= 0.0) { continue; }

    // Density kernel (CPU: (factor^2) / (pi/6 * r^4))
    let kDensity = (factor * factor) / ((3.14159265 / 6.0) * r4);
    density = density + kDensity * 1000.0 * other.mass;

    // Near-density kernel (CPU: (factor^4) / (pi/15 * r^6))
    if (${getUniform("enableNearPressure")} != 0.0) {
      let f2 = factor * factor;
      let kNear = (f2 * f2) / ((3.14159265 / 15.0) * r6);
      nearDensity = nearDensity + kNear * 1000.0 * other.mass;
    }
  }

  // Store results in shared SIM_STATE for use in apply pass
  ${setState("density", "density")};
  ${setState("nearDensity", "nearDensity")};
}`,
      // Apply pass: compute pressure and viscosity forces using precomputed densities
      apply: ({ particleVar, getUniform, getState }) => `{
  let rad = ${getUniform("influenceRadius")};
  let targetDensity = ${getUniform("targetDensity")};
  let pressureMul = ${getUniform("pressureMultiplier")};
  let visc = ${getUniform("viscosity")};
  let nearMul = ${getUniform("nearPressureMultiplier")};
  let nearThreshold = ${getUniform("nearThreshold")};
  let useNear = ${getUniform("enableNearPressure")};

  let myDensity = max(${getState("density")}, 1e-6);

  // Precompute radius powers for kernels
  let r2 = rad * rad;
  let r4 = r2 * r2;
  let r6 = r4 * r2;
  let r8 = r4 * r4;

  // Pressure gradient accumulation
  var gradSum: vec2<f32> = vec2<f32>(0.0, 0.0);
  var it1 = neighbor_iter_init(${particleVar}.position, rad);
  loop {
    let j = neighbor_iter_next(&it1, index);
    if (j == NEIGHBOR_NONE) { break; }
    let other = particles[j];
    let delta = other.position - ${particleVar}.position;
    let dist2 = dot(delta, delta);
    if (dist2 <= 0.0) { continue; }
    let dist = sqrt(dist2);
    if (dist <= 0.0 || dist >= rad) { continue; }
    let dir = delta / dist;

    // Derivative kernel (CPU: scale * (dist - rad), scale = (-12/pi)/r^4)
    let scale = (-12.0 / 3.14159265) / r4;
    let slope = (dist - rad) * scale;

    // Neighbor pressures from precomputed densities
    let dN = max(${getState("density", "j")}, 1e-6);
    let nearN = select(0.0, ${getState("nearDensity", "j")}, useNear != 0.0);
    let densityDiff = dN - targetDensity;
    let pressure = densityDiff * pressureMul;
    let nearPressure = nearN * nearMul;
    let effectivePressure = select(pressure, nearPressure, dist < nearThreshold);

    // Gradient contribution
    gradSum = gradSum + (dir * (effectivePressure * slope) / dN);
  }
  // Pressure force is negative gradient
  var pressureForce = -gradSum;

  // Viscosity accumulation
  var viscosityForce: vec2<f32> = vec2<f32>(0.0, 0.0);
  if (visc != 0.0) {
    var it2 = neighbor_iter_init(${particleVar}.position, rad);
    loop {
      let j = neighbor_iter_next(&it2, index);
      if (j == NEIGHBOR_NONE) { break; }
      let other = particles[j];
      let delta = other.position - ${particleVar}.position;
      let dist2 = dot(delta, delta);
      if (dist2 <= 0.0) { continue; }
      let dist = sqrt(dist2);
      if (dist >= rad) { continue; }
      // Viscosity kernel (CPU: (max(0, r^2 - d^2)^3) / (pi/4 * r^8))
      let val = max(0.0, r2 - dist2);
      let kVisc = (val * val * val) / ((3.14159265 / 4.0) * r8);
      viscosityForce = viscosityForce + (other.velocity - ${particleVar}.velocity) * kVisc;
    }
    viscosityForce = viscosityForce * visc;
  }

  // Convert to acceleration-like effect: a = F / density
  var force = (pressureForce / myDensity) * 1000000.0;
  if (visc != 0.0) {
    force = force + (viscosityForce * 1000.0) / myDensity;
  }

  // Clamp force magnitude to avoid instabilities (tunable)
  let maxLen = ${getUniform("maxAcceleration")};
  let f2 = dot(force, force);
  if (f2 > maxLen * maxLen) {
    let fLen = sqrt(f2);
    force = force * (maxLen / fLen);
  }

  // Apply directly to velocity (CPU mirrors this behavior)
  ${particleVar}.velocity = ${particleVar}.velocity + force;
}`,
    };
  }

  cpu(): CPUDescriptor<FluidsInputKeys, FluidStateKeys> {
    return {
      states: ["density", "nearDensity"],

      // State pass: precompute density and near-density per particle
      state: ({ particle, getNeighbors, dt, setState }) => {
        // Get fluid parameters
        const rad = this.readValue("influenceRadius");
        const enableNearPressure = this.readValue("enableNearPressure");

        // Predict current particle position for this frame (approximate)
        const posPredX = particle.position.x + particle.velocity.x * dt;
        const posPredY = particle.position.y + particle.velocity.y * dt;
        let density = 0.0;
        let nearDensity = 0.0;

        // Precompute radius powers for kernels
        const r2 = rad * rad;
        const r4 = r2 * r2;
        const r6 = r4 * r2;

        // Get neighbors using predicted position
        const neighbors = getNeighbors({ x: posPredX, y: posPredY }, rad);

        for (const other of neighbors) {
          if (other.id === particle.id) continue; // Skip self

          const dX = posPredX - other.position.x;
          const dY = posPredY - other.position.y;
          const dist2 = dX * dX + dY * dY;

          if (dist2 <= 0.0) continue;

          const dist = Math.sqrt(dist2);
          const factor = Math.max(rad - dist, 0.0);
          if (factor <= 0.0) continue;

          // Density kernel: (factor^2) / (pi/6 * r^4)
          const kDensity = (factor * factor) / ((Math.PI / 6.0) * r4);
          density += kDensity * 1000.0 * other.mass;

          // Near-density kernel: (factor^4) / (pi/15 * r^6)
          if (enableNearPressure !== 0.0) {
            const f2 = factor * factor;
            const kNear = (f2 * f2) / ((Math.PI / 15.0) * r6);
            nearDensity += kNear * 1000.0 * other.mass;
          }
        }

        // Store results in shared state for use in apply pass
        setState("density", density);
        setState("nearDensity", nearDensity);
      },

      // Apply pass: compute pressure and viscosity forces using precomputed densities
      apply: ({ particle, getNeighbors, getState }) => {
        // Get fluid parameters
        const rad = this.readValue("influenceRadius");
        const targetDensity = this.readValue("targetDensity");
        const pressureMul = this.readValue("pressureMultiplier");
        const visc = this.readValue("viscosity");
        const nearMul = this.readValue("nearPressureMultiplier");
        const nearThreshold = this.readValue("nearThreshold");
        const useNear = this.readValue("enableNearPressure");
        const maxAccel = this.readValue("maxAcceleration");

        const myDensity = Math.max(getState("density"), 1e-6);

        // Precompute radius powers for kernels
        const r2 = rad * rad;
        const r4 = r2 * r2;
        const r8 = r4 * r4;

        // Pressure gradient accumulation
        let gradSumX = 0.0;
        let gradSumY = 0.0;

        const neighbors = getNeighbors(particle.position, rad);

        for (const other of neighbors) {
          if (other.id === particle.id) continue; // Skip self

          const deltaX = other.position.x - particle.position.x;
          const deltaY = other.position.y - particle.position.y;
          const dist2 = deltaX * deltaX + deltaY * deltaY;

          if (dist2 <= 0.0) continue;

          const dist = Math.sqrt(dist2);
          if (dist <= 0.0 || dist >= rad) continue;

          const dirX = deltaX / dist;
          const dirY = deltaY / dist;

          // Derivative kernel: scale * (dist - rad), scale = (-12/pi)/r^4
          const scale = -12.0 / Math.PI / r4;
          const slope = (dist - rad) * scale;

          // Neighbor pressures from precomputed densities
          const dN = Math.max(getState("density", other.id), 1e-6);
          const nearN =
            useNear !== 0.0 ? getState("nearDensity", other.id) : 0.0;
          const densityDiff = dN - targetDensity;
          const pressure = densityDiff * pressureMul;
          const nearPressure = nearN * nearMul;
          const effectivePressure =
            dist < nearThreshold ? nearPressure : pressure;

          // Gradient contribution
          const gradContribX = (dirX * (effectivePressure * slope)) / dN;
          const gradContribY = (dirY * (effectivePressure * slope)) / dN;
          gradSumX += gradContribX;
          gradSumY += gradContribY;
        }

        // Pressure force is negative gradient
        let pressureForceX = -gradSumX;
        let pressureForceY = -gradSumY;

        // Viscosity accumulation
        let viscosityForceX = 0.0;
        let viscosityForceY = 0.0;

        if (visc !== 0.0) {
          for (const other of neighbors) {
            if (other.id === particle.id) continue; // Skip self

            const deltaX = other.position.x - particle.position.x;
            const deltaY = other.position.y - particle.position.y;
            const dist2 = deltaX * deltaX + deltaY * deltaY;

            if (dist2 <= 0.0) continue;

            const dist = Math.sqrt(dist2);
            if (dist >= rad) continue;

            // Viscosity kernel: (max(0, r^2 - d^2)^3) / (pi/4 * r^8)
            const val = Math.max(0.0, r2 - dist2);
            const kVisc = (val * val * val) / ((Math.PI / 4.0) * r8);

            viscosityForceX += (other.velocity.x - particle.velocity.x) * kVisc;
            viscosityForceY += (other.velocity.y - particle.velocity.y) * kVisc;
          }

          viscosityForceX *= visc;
          viscosityForceY *= visc;
        }

        // Convert to acceleration-like effect: a = F / density
        let forceX = (pressureForceX / myDensity) * 1000000.0;
        let forceY = (pressureForceY / myDensity) * 1000000.0;

        if (visc !== 0.0) {
          forceX += (viscosityForceX * 1000.0) / myDensity;
          forceY += (viscosityForceY * 1000.0) / myDensity;
        }

        // Clamp force magnitude to avoid instabilities
        const f2 = forceX * forceX + forceY * forceY;
        if (f2 > maxAccel * maxAccel) {
          const fLen = Math.sqrt(f2);
          forceX = forceX * (maxAccel / fLen);
          forceY = forceY * (maxAccel / fLen);
        }

        // Apply directly to velocity (matching WebGPU behavior)
        particle.velocity.x += forceX;
        particle.velocity.y += forceY;
      },
    };
  }
}
