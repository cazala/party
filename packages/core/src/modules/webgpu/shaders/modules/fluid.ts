import { ComputeModule, type ComputeModuleDescriptor } from "../compute";

type FluidBindingKeys =
  | "influenceRadius"
  | "targetDensity"
  | "pressureMultiplier"
  | "viscosity"
  | "nearPressureMultiplier"
  | "nearThreshold"
  | "enableNearPressure"
  | "maxAcceleration";

type FluidStateKeys = "density" | "nearDensity";

export class Fluid extends ComputeModule<
  "fluid",
  FluidBindingKeys,
  FluidStateKeys
> {
  private influenceRadius: number;
  private targetDensity: number;
  private pressureMultiplier: number;
  private viscosity: number;
  private nearPressureMultiplier: number;
  private nearThreshold: number;
  private enableNearPressure: boolean;
  private maxAcceleration: number;

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
    this.influenceRadius = opts?.influenceRadius ?? 100;
    this.targetDensity = opts?.targetDensity ?? 1;
    this.pressureMultiplier = opts?.pressureMultiplier ?? 15;
    this.viscosity = opts?.viscosity ?? 0.6;
    this.nearPressureMultiplier = opts?.nearPressureMultiplier ?? 30;
    this.nearThreshold = opts?.nearThreshold ?? 50;
    this.enableNearPressure = opts?.enableNearPressure ?? true;
    this.maxAcceleration = opts?.maxAcceleration ?? 80; // cap fluid acceleration to reduce fly-away droplets
    if (opts?.enabled !== undefined) {
      this.setEnabled(!!opts.enabled);
    }
  }

  attachUniformWriter(
    writer: (values: Partial<Record<string, number>>) => void
  ): void {
    super.attachUniformWriter(writer);
    this.write({
      influenceRadius: this.influenceRadius,
      targetDensity: this.targetDensity,
      pressureMultiplier: this.pressureMultiplier,
      viscosity: this.viscosity,
      nearPressureMultiplier: this.nearPressureMultiplier,
      nearThreshold: this.nearThreshold,
      enableNearPressure: this.enableNearPressure ? 1 : 0,
      maxAcceleration: this.maxAcceleration,
    });
  }

  setInfluenceRadius(v: number): void {
    this.influenceRadius = v;
    this.write({ influenceRadius: v });
  }
  setTargetDensity(v: number): void {
    this.targetDensity = v;
    this.write({ targetDensity: v });
  }
  setPressureMultiplier(v: number): void {
    this.pressureMultiplier = v;
    this.write({ pressureMultiplier: v });
  }
  setViscosity(v: number): void {
    this.viscosity = v;
    this.write({ viscosity: v });
  }
  setNearPressureMultiplier(v: number): void {
    this.nearPressureMultiplier = v;
    this.write({ nearPressureMultiplier: v });
  }
  setNearThreshold(v: number): void {
    this.nearThreshold = v;
    this.write({ nearThreshold: v });
  }
  setEnableNearPressure(enabled: boolean): void {
    this.enableNearPressure = enabled;
    this.write({ enableNearPressure: enabled ? 1 : 0 });
  }

  setMaxAcceleration(v: number): void {
    this.maxAcceleration = v;
    this.write({ maxAcceleration: v });
  }

  descriptor(): ComputeModuleDescriptor<
    "fluid",
    FluidBindingKeys,
    FluidStateKeys
  > {
    return {
      name: "fluid",
      role: "force",
      states: ["density", "nearDensity"],
      bindings: [
        "influenceRadius",
        "targetDensity",
        "pressureMultiplier",
        "viscosity",
        "nearPressureMultiplier",
        "nearThreshold",
        "enableNearPressure",
        "maxAcceleration",
      ] as const,
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
}
