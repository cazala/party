import { ComputeModule, type ComputeModuleDescriptor } from "../compute";

type BehaviorBindingKeys =
  | "wanderWeight"
  | "cohesionWeight"
  | "alignmentWeight"
  | "separationWeight"
  | "chaseWeight"
  | "avoidWeight"
  | "separationRange"
  | "viewRadius"
  | "viewAngle";

export class Behavior extends ComputeModule<"behavior", BehaviorBindingKeys> {
  private wanderWeight: number;
  private cohesionWeight: number;
  private alignmentWeight: number;
  private separationWeight: number;
  private chaseWeight: number;
  private avoidWeight: number;
  private separationRange: number;
  private viewRadius: number;
  private viewAngle: number;

  constructor(opts?: {
    wanderWeight?: number;
    cohesionWeight?: number;
    alignmentWeight?: number;
    separationWeight?: number;
    chaseWeight?: number;
    avoidWeight?: number;
    separationRange?: number;
    viewRadius?: number;
    viewAngle?: number;
    enabled?: boolean;
  }) {
    super();
    this.wanderWeight = opts?.wanderWeight ?? 0;
    this.cohesionWeight = opts?.cohesionWeight ?? 0;
    this.alignmentWeight = opts?.alignmentWeight ?? 0;
    this.separationWeight = opts?.separationWeight ?? 0;
    this.chaseWeight = opts?.chaseWeight ?? 0;
    this.avoidWeight = opts?.avoidWeight ?? 0;
    this.separationRange = opts?.separationRange ?? 30;
    this.viewRadius = opts?.viewRadius ?? 100;
    this.viewAngle = opts?.viewAngle ?? 2 * Math.PI;
    if (opts?.enabled !== undefined) this.setEnabled(!!opts.enabled);
  }

  attachUniformWriter(
    writer: (values: Partial<Record<string, number>>) => void
  ): void {
    super.attachUniformWriter(writer);
    this.write({
      wanderWeight: this.wanderWeight,
      cohesionWeight: this.cohesionWeight,
      alignmentWeight: this.alignmentWeight,
      separationWeight: this.separationWeight,
      chaseWeight: this.chaseWeight,
      avoidWeight: this.avoidWeight,
      separationRange: this.separationRange,
      viewRadius: this.viewRadius,
      viewAngle: this.viewAngle,
    });
  }

  setWanderWeight(v: number): void {
    this.wanderWeight = v;
    this.write({ wanderWeight: v });
  }
  setCohesionWeight(v: number): void {
    this.cohesionWeight = v;
    this.write({ cohesionWeight: v });
  }
  setAlignmentWeight(v: number): void {
    this.alignmentWeight = v;
    this.write({ alignmentWeight: v });
  }
  setSeparationWeight(v: number): void {
    this.separationWeight = v;
    this.write({ separationWeight: v });
  }
  setChaseWeight(v: number): void {
    this.chaseWeight = v;
    this.write({ chaseWeight: v });
  }
  setAvoidWeight(v: number): void {
    this.avoidWeight = v;
    this.write({ avoidWeight: v });
  }
  setSeparationRange(v: number): void {
    this.separationRange = v;
    this.write({ separationRange: v });
  }
  setViewRadius(v: number): void {
    this.viewRadius = v;
    this.write({ viewRadius: v });
  }
  setViewAngle(v: number): void {
    this.viewAngle = v;
    this.write({ viewAngle: v });
  }

  descriptor(): ComputeModuleDescriptor<"behavior", BehaviorBindingKeys> {
    return {
      name: "behavior",
      role: "force",
      bindings: [
        "wanderWeight",
        "cohesionWeight",
        "alignmentWeight",
        "separationWeight",
        "chaseWeight",
        "avoidWeight",
        "separationRange",
        "viewRadius",
        "viewAngle",
      ] as const,
      apply: ({ particleVar, getUniform }) => `
  // Neighbor loop within view radius
  let viewR = ${getUniform("viewRadius")};
  let sepRange = ${getUniform("separationRange")};
  let wSep = ${getUniform("separationWeight")};
  let wAli = ${getUniform("alignmentWeight")};
  let wCoh = ${getUniform("cohesionWeight")};
  let wChase = ${getUniform("chaseWeight")};
  let wAvoid = ${getUniform("avoidWeight")};
  let wWander = ${getUniform("wanderWeight")};
  let halfAngle = ${getUniform("viewAngle")} * 0.5;
  let cosHalf = cos(halfAngle);

  // Accumulators
  var sep: vec2<f32> = vec2<f32>(0.0, 0.0);
  var ali: vec2<f32> = vec2<f32>(0.0, 0.0);
  var cohPos: vec2<f32> = vec2<f32>(0.0, 0.0);
  var cohCount: f32 = 0.0;
  var aliCount: f32 = 0.0;

  // Normalize particle velocity for FOV; if zero, skip FOV filtering
  let vMag2 = dot(${particleVar}.velocity, ${particleVar}.velocity);
  let hasVel = vMag2 > 1e-6;
  let vNorm = select(vec2<f32>(1.0, 0.0), normalize(${particleVar}.velocity), hasVel);

  var it = neighbor_iter_init(${particleVar}.position, viewR);
  loop {
    let j = neighbor_iter_next(&it, index);
    if (j == NEIGHBOR_NONE) { break; }
    let other = particles[j];
    let toOther = other.position - ${particleVar}.position;
    let dist2 = dot(toOther, toOther);
    if (dist2 <= 0.0) { continue; }
    let dist = sqrt(dist2);
    if (dist >= viewR) { continue; }

    // Field of view check
    if (hasVel) {
      let dir = toOther / dist;
      let d = dot(vNorm, dir);
      if (d < cosHalf) { continue; }
    }

    // Separation (closer than sepRange)
    if (dist < sepRange && wSep > 0.0) {
      let away = (${particleVar}.position - other.position) / max(dist, 1e-3);
      sep = sep + away;
    }

    // Alignment
    if (wAli > 0.0) {
      ali = ali + other.velocity;
      aliCount = aliCount + 1.0;
    }

    // Cohesion
    if (wCoh > 0.0) {
      cohPos = cohPos + other.position;
      cohCount = cohCount + 1.0;
    }

    // Chase / Avoid based on mass relation
    if (wChase > 0.0 && ${particleVar}.mass > other.mass) {
      let massDelta = (${particleVar}.mass - other.mass) / max(${particleVar}.mass, 1e-6);
      let seek = (toOther / max(dist, 1e-3)) * (massDelta * ${particleVar}.mass);
      // accumulate into cohesion-like vector
      cohPos = cohPos + (${particleVar}.position + seek);
      cohCount = cohCount + 1.0;
    }
    if (wAvoid > 0.0 && ${particleVar}.mass < other.mass && dist < viewR * 0.5) {
      let massDelta = (other.mass - ${particleVar}.mass) / max(other.mass, 1e-6);
      var rep = (${particleVar}.position - other.position);
      let repLen = length(rep);
      if (repLen > 0.0) {
        rep = normalize(rep) * 100000.0 * massDelta * (1.0 / max(repLen, 1.0));
        sep = sep + rep;
      }
    }
  }

  // Finalize alignment: steer toward avg neighbor velocity
  if (aliCount > 0.0) {
    var avgV = ali / aliCount;
    if (length(avgV) > 0.0) {
      avgV = normalize(avgV) * 1000.0;
      let steerAli = avgV - ${particleVar}.velocity;
      ${particleVar}.acceleration = ${particleVar}.acceleration + steerAli * wAli;
    }
  }

  // Finalize cohesion: seek centroid
  if (cohCount > 0.0) {
    let center = cohPos / cohCount;
    var seek = center - ${particleVar}.position;
    if (length(seek) > 0.0) {
      seek = normalize(seek) * 1000.0 - ${particleVar}.velocity;
      ${particleVar}.acceleration = ${particleVar}.acceleration + seek * wCoh;
    }
  }

  // Apply separation
  if (length(sep) > 0.0) {
    sep = normalize(sep) * 1000.0 - ${particleVar}.velocity;
    ${particleVar}.acceleration = ${particleVar}.acceleration + sep * wSep;
  }

  // Simple wander: small perturbation perpendicular to velocity (no state)
  if (wWander > 0.0) {
    let vel = ${particleVar}.velocity;
    let l = length(vel);
    let dir = select(vec2<f32>(1.0, 0.0), vel / max(l, 1e-6), l > 1e-6);
    let perp = vec2<f32>(-dir.y, dir.x);
    // pseudo-random based on position
    let h = dot(${particleVar}.position, vec2<f32>(12.9898, 78.233));
    let r = fract(sin(h) * 43758.5453) - 0.5;
    let jitter = perp * (r * 200.0);
    ${particleVar}.acceleration = ${particleVar}.acceleration + jitter * wWander;
  }
`,
    };
  }
}
