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
  DataType,
} from "../../module";

export enum FluidsMethod {
  Sph = "sph",
  Picflip = "picflip",
}

export const DEFAULT_FLUIDS_INFLUENCE_RADIUS = 100;
export const DEFAULT_FLUIDS_TARGET_DENSITY = 2;
export const DEFAULT_FLUIDS_PRESSURE_MULTIPLIER = 30;
export const DEFAULT_FLUIDS_VISCOSITY = 1;
export const DEFAULT_FLUIDS_NEAR_PRESSURE_MULTIPLIER = 50;
export const DEFAULT_FLUIDS_NEAR_THRESHOLD = 20;
export const DEFAULT_FLUIDS_ENABLE_NEAR_PRESSURE = true;
export const DEFAULT_FLUIDS_MAX_ACCELERATION = 75;

// Default values for PIC/FLIP parameters (exposed via Fluids when method=picflip)
export const DEFAULT_PICFLIP_FLIP_RATIO = 0.9;
export const DEFAULT_PICFLIP_TARGET_DENSITY = 2.0;
export const DEFAULT_PICFLIP_INFLUENCE_RADIUS = 50.0;
export const DEFAULT_PICFLIP_PRESSURE_MULTIPLIER = 500.0;
export const DEFAULT_PICFLIP_INTERNAL_MAX_ACCELERATION = 20000.0;

// Backwards-compatible aliases for previous standalone Picflip module constants.
// (The recommended names are the *_TARGET_DENSITY / *_INFLUENCE_RADIUS / *_PRESSURE_MULTIPLIER ones.)
export const DEFAULT_PICFLIP_DENSITY = DEFAULT_PICFLIP_TARGET_DENSITY;
export const DEFAULT_PICFLIP_RADIUS = DEFAULT_PICFLIP_INFLUENCE_RADIUS;
export const DEFAULT_PICFLIP_PRESSURE = DEFAULT_PICFLIP_PRESSURE_MULTIPLIER;

type FluidStateKeys = "density" | "nearDensity" | "prevVelX" | "prevVelY";

type FluidsInputs = {
  // 0 = SPH, 1 = PICFLIP
  method: number;
  influenceRadius: number;
  targetDensity: number;
  pressureMultiplier: number;
  viscosity: number;
  nearPressureMultiplier: number;
  nearThreshold: number;
  enableNearPressure: number;
  maxAcceleration: number;
  // PIC/FLIP-only (still always present as a uniform)
  flipRatio: number;
};

export class Fluids extends Module<"fluids", FluidsInputs, FluidStateKeys> {
  readonly name = "fluids" as const;
  readonly role = ModuleRole.Force;
  readonly inputs = {
    method: DataType.NUMBER,
    influenceRadius: DataType.NUMBER,
    targetDensity: DataType.NUMBER,
    pressureMultiplier: DataType.NUMBER,
    viscosity: DataType.NUMBER,
    nearPressureMultiplier: DataType.NUMBER,
    nearThreshold: DataType.NUMBER,
    enableNearPressure: DataType.NUMBER,
    maxAcceleration: DataType.NUMBER,
    flipRatio: DataType.NUMBER,
  } as const;

  constructor(
    opts?:
      | ({
          enabled?: boolean;
          method?: FluidsMethod.Sph;
          influenceRadius?: number;
          targetDensity?: number;
          pressureMultiplier?: number;
          viscosity?: number;
          nearPressureMultiplier?: number;
          nearThreshold?: number;
          enableNearPressure?: boolean;
          maxAcceleration?: number;
        } & { flipRatio?: never })
      | {
          enabled?: boolean;
          method: FluidsMethod.Picflip;
          influenceRadius?: number;
          targetDensity?: number;
          pressureMultiplier?: number;
          viscosity?: never;
          flipRatio?: number;
          // Not used by PICFLIP; disallow to keep the union strongly typed.
          maxAcceleration?: never;
          nearPressureMultiplier?: never;
          nearThreshold?: never;
          enableNearPressure?: never;
        }
  ) {
    super();

    const method = opts?.method ?? FluidsMethod.Sph;
    const isPicflip = method === FluidsMethod.Picflip;

    if (isPicflip) {
      const o = opts as Extract<typeof opts, { method: FluidsMethod.Picflip }>;
      this.write({
        method: 1,
        influenceRadius:
          o?.influenceRadius ?? DEFAULT_PICFLIP_INFLUENCE_RADIUS,
        targetDensity: o?.targetDensity ?? DEFAULT_PICFLIP_TARGET_DENSITY,
        pressureMultiplier:
          o?.pressureMultiplier ?? DEFAULT_PICFLIP_PRESSURE_MULTIPLIER,
        // SPH-only; keep initialized but unused for PICFLIP
        viscosity: 0,
        // Keep SPH-only uniforms initialized (unused when method=picflip)
        nearPressureMultiplier: DEFAULT_FLUIDS_NEAR_PRESSURE_MULTIPLIER,
        nearThreshold: DEFAULT_FLUIDS_NEAR_THRESHOLD,
        enableNearPressure: DEFAULT_FLUIDS_ENABLE_NEAR_PRESSURE ? 1 : 0,
        maxAcceleration: DEFAULT_FLUIDS_MAX_ACCELERATION,
        flipRatio: o?.flipRatio ?? DEFAULT_PICFLIP_FLIP_RATIO,
      });
    } else {
      const o = opts as Exclude<typeof opts, { method: FluidsMethod.Picflip }>;
      this.write({
        method: 0,
        influenceRadius: o?.influenceRadius ?? DEFAULT_FLUIDS_INFLUENCE_RADIUS,
        targetDensity: o?.targetDensity ?? DEFAULT_FLUIDS_TARGET_DENSITY,
        pressureMultiplier:
          o?.pressureMultiplier ?? DEFAULT_FLUIDS_PRESSURE_MULTIPLIER,
        viscosity: o?.viscosity ?? DEFAULT_FLUIDS_VISCOSITY,
        nearPressureMultiplier:
          o?.nearPressureMultiplier ?? DEFAULT_FLUIDS_NEAR_PRESSURE_MULTIPLIER,
        nearThreshold: o?.nearThreshold ?? DEFAULT_FLUIDS_NEAR_THRESHOLD,
        enableNearPressure:
          o?.enableNearPressure ?? DEFAULT_FLUIDS_ENABLE_NEAR_PRESSURE ? 1 : 0,
        maxAcceleration:
          o?.maxAcceleration ?? DEFAULT_FLUIDS_MAX_ACCELERATION,
        // Keep PICFLIP-only uniform initialized (unused when method=sph)
        flipRatio: DEFAULT_PICFLIP_FLIP_RATIO,
      });
    }

    if (opts?.enabled !== undefined) {
      this.setEnabled(!!opts.enabled);
    }
  }

  setMethod(method: FluidsMethod): void {
    this.write({ method: method === FluidsMethod.Picflip ? 1 : 0 });
  }
  getMethod(): FluidsMethod {
    return this.readValue("method") >= 0.5
      ? FluidsMethod.Picflip
      : FluidsMethod.Sph;
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
  setFlipRatio(v: number): void {
    this.write({ flipRatio: v });
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
  getFlipRatio(): number {
    return this.readValue("flipRatio");
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

  webgpu(): WebGPUDescriptor<FluidsInputs, FluidStateKeys> {
    return {
      states: ["density", "nearDensity", "prevVelX", "prevVelY"],
      // State pass:
      // - SPH: precompute density and near-density per particle
      // - PICFLIP: store previous velocity per particle (for FLIP delta)
      state: ({ particleVar, dtVar, getUniform, setState }) => `{
  let method = ${getUniform("method")};

  if (method < 0.5) {
    // SPH: Predict current particle position for this frame (approximate)
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
      // Skip removed or pinned neighbors
      if (other.mass <= 0.0) { continue; }

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
  } else {
    // PICFLIP: Store current velocity before blend/pressure
    ${setState("prevVelX", `${particleVar}.velocity.x`)};
    ${setState("prevVelY", `${particleVar}.velocity.y`)};
  }
}`,
      // Apply pass:
      // - SPH: pressure + viscosity using precomputed densities
      // - PICFLIP: simplified local-pressure PIC/FLIP blend (+ optional viscosity)
      apply: ({ particleVar, dtVar, getUniform, getState }) => `{
  let method = ${getUniform("method")};

  if (method < 0.5) {
    // ==========================
    // SPH
    // ==========================
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
      // Skip removed or pinned neighbors
      if (other.mass <= 0.0) { continue; }
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
        // Skip removed or pinned neighbors
        if (other.mass <= 0.0) { continue; }
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
  } else {
    // ==========================
    // PICFLIP (simplified local-pressure approximation)
    // ==========================
    // Scale UI-friendly values to PIC/FLIP internal tuning:
    // - influenceRadius: /2
    // - targetDensity: *3
    // - pressureMultiplier: *30
    let flipRatio = ${getUniform("flipRatio")};
    let rad = ${getUniform("influenceRadius")} * 0.5;
    let targetDensity = ${getUniform("targetDensity")} * 3.0;
    let pressureScale = ${getUniform("pressureMultiplier")} * 30.0;

    // Get stored previous velocity
    let prevVelX = ${getState("prevVelX")};
    let prevVelY = ${getState("prevVelY")};

    var newVelX = ${particleVar}.velocity.x;
    var newVelY = ${particleVar}.velocity.y;

    // Local density + average neighbor velocity (PIC grid approximation)
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
      let picVelX = avgVelX;
      let picVelY = avgVelY;
      let flipVelX = newVelX + (avgVelX - prevVelX);
      let flipVelY = newVelY + (avgVelY - prevVelY);

      newVelX = mix(picVelX, flipVelX, flipRatio);
      newVelY = mix(picVelY, flipVelY, flipRatio);

      // Simple pressure force based on local density
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

      // NOTE: no max-acceleration clamp for PIC/FLIP (it tends to need the max anyway)
      newVelX = newVelX + gradX * ${dtVar};
      newVelY = newVelY + gradY * ${dtVar};
    }

    ${particleVar}.velocity.x = newVelX;
    ${particleVar}.velocity.y = newVelY;
  }
}`,
    };
  }

  cpu(): CPUDescriptor<FluidsInputs, FluidStateKeys> {
    return {
      states: ["density", "nearDensity", "prevVelX", "prevVelY"],

      // State pass:
      // - SPH: precompute density and near-density per particle
      // - PICFLIP: store previous velocity per particle
      state: ({ particle, getNeighbors, dt, setState }) => {
        const method = this.readValue("method");

        if (method < 0.5) {
          // SPH
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
            // Skip removed or pinned neighbors
            if (other.mass <= 0) continue;

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
        } else {
          // PICFLIP
          setState("prevVelX", particle.velocity.x);
          setState("prevVelY", particle.velocity.y);
        }
      },

      // Apply pass:
      // - SPH: pressure + viscosity using precomputed densities
      // - PICFLIP: simplified local-pressure PIC/FLIP blend (+ optional viscosity)
      apply: ({ particle, getNeighbors, dt, getState }) => {
        const method = this.readValue("method");

        if (method < 0.5) {
          // SPH
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
            // Skip removed or pinned neighbors
            if (other.mass <= 0) continue;

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
              // Skip removed or pinned neighbors
              if (other.mass <= 0) continue;

              const deltaX = other.position.x - particle.position.x;
              const deltaY = other.position.y - particle.position.y;
              const dist2 = deltaX * deltaX + deltaY * deltaY;

              if (dist2 <= 0.0) continue;

              const dist = Math.sqrt(dist2);
              if (dist >= rad) continue;

              // Viscosity kernel: (max(0, r^2 - d^2)^3) / (pi/4 * r^8)
              const val = Math.max(0.0, r2 - dist2);
              const kVisc = (val * val * val) / ((Math.PI / 4.0) * r8);

              viscosityForceX +=
                (other.velocity.x - particle.velocity.x) * kVisc;
              viscosityForceY +=
                (other.velocity.y - particle.velocity.y) * kVisc;
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
        } else {
          // PICFLIP
          // Scale UI-friendly values to PIC/FLIP internal tuning:
          // - influenceRadius: /2
          // - targetDensity: *3
          // - pressureMultiplier: *30
          const flipRatio = this.readValue("flipRatio");
          const targetDensity = this.readValue("targetDensity") * 3.0;
          const rad = this.readValue("influenceRadius") * 0.5;
          const pressureScale = this.readValue("pressureMultiplier") * 30.0;

          // Get stored previous velocity
          const prevVelX = getState("prevVelX");
          const prevVelY = getState("prevVelY");

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

            // NOTE: no max-acceleration clamp for PIC/FLIP (it tends to need the max anyway)
            newVelX += gradX * dt;
            newVelY += gradY * dt;
          }

          particle.velocity.x = newVelX;
          particle.velocity.y = newVelY;
        }
      },
    };
  }
}
