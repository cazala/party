/**
 * Collisions (Force Module)
 *
 * Simple pairwise collision response using the spatial grid for neighbor queries.
 * Uses a two-phase approach: pick deepest overlap neighbor (to reduce bias), then
 * correct position and apply a bounce impulse along the contact normal.
 * Velocity response in apply() is commented out; constraint/correct handle stability.
 */
import {
  Module,
  type WebGPUDescriptor,
  ModuleRole,
  CPUDescriptor,
} from "../../module";

type CollisionBindingKeys = "restitution";

export const DEFAULT_COLLISIONS_RESTITUTION = 0.9;

// Simple, brute-force elastic collision response applied only to current particle
export class Collisions extends Module<"collisions", CollisionBindingKeys> {
  private restitution: number;

  constructor(opts?: { restitution?: number }) {
    super();
    this.restitution = opts?.restitution ?? DEFAULT_COLLISIONS_RESTITUTION;
  }

  setRestitution(value: number): void {
    this.restitution = value;
    this.write({ restitution: value });
  }

  attachUniformWriter(
    writer: (values: Partial<Record<string, number>>) => void
  ): void {
    super.attachUniformWriter(writer);
    this.write({ restitution: this.restitution });
  }

  webgpu(): WebGPUDescriptor<"collisions", CollisionBindingKeys> {
    return {
      name: "collisions",
      role: ModuleRole.Force,
      keys: ["restitution"] as const,
      apply: ({ particleVar, getUniform }) => `
        // Grid neighbors iterator API using vec2 math, only updating the current particle
        var it = neighbor_iter_init(${particleVar}.position, ${particleVar}.size * 2.0);
        loop {
          let j = neighbor_iter_next(&it, index);
          if (j == NEIGHBOR_NONE) { break; }
          var other = particles[j];
      
          let delta = ${particleVar}.position - other.position;
          let r = other.size + ${particleVar}.size;
          let dist2 = dot(delta, delta);
          if (dist2 > 0.0001 && dist2 < r*r) {
            let dist = sqrt(dist2);
            let n = delta / dist;

            // TODO: REMOVE THIS
            // Velocity response (normal/tangent decomposition)
            // let v1 = ${particleVar}.velocity;
            // let v2 = other.velocity;
            // let v1n = dot(v1, n);
            // let v2n = dot(v2, n);
            // let v1t = v1 - n * v1n;
            // let m1 = ${particleVar}.mass;
            // let m2 = other.mass;
            // let e = ${getUniform("restitution")};
            // let v1nAfter = (v1n * (m1 - e * m2) + (1.0 + e) * m2 * v2n) / max(m1 + m2, 1e-6);
            // let newV1 = v1t + n * v1nAfter;
            // ${particleVar}.velocity = newV1;
          }
    }
  `,
      constrain: ({ particleVar, getUniform }) => `
  // Pass 1: find deepest overlap neighbor to reduce scan-order bias
  var it = neighbor_iter_init(${particleVar}.position, ${particleVar}.size * 2.0);
  var bestJ: u32 = NEIGHBOR_NONE;
  var bestN: vec2<f32> = vec2<f32>(0.0, 0.0);
  var bestOverlap: f32 = 0.0;
  loop {
    let j = neighbor_iter_next(&it, index);
    if (j == NEIGHBOR_NONE) { break; }
    var other = particles[j];
    let r = other.size + ${particleVar}.size;
    let delta = ${particleVar}.position - other.position;
    let dist2 = dot(delta, delta);
    if (dist2 > 0.0001 && dist2 < r*r) {
      let dist = sqrt(dist2);
      let overlap = r - dist;
      if (overlap > bestOverlap) {
        bestOverlap = overlap;
        bestJ = j;
        bestN = delta / dist;
      }
    }
  }

  if (bestJ != NEIGHBOR_NONE) {
    var other = particles[bestJ];
    var n = bestN;

    // Pseudo-random helpers based on world position to avoid index-order bias
    let h1 = dot(${particleVar}.position, vec2<f32>(12.9898, 78.233));
    let rand1 = fract(sin(h1) * 43758.5453);
    let h2 = dot(${particleVar}.position, vec2<f32>(93.9898, 67.345));
    let rand2 = fract(sin(h2) * 15731.7431);

    // Symmetry breaking: if nearly vertical or horizontal alignment, slightly rotate normal by tiny random angle
    let ax = abs(n.x);
    let ay = abs(n.y);
    if (ax < 0.03 || ay < 0.03) {
      let angle = (rand1 - 0.5) * 0.3;
      let ca = cos(angle);
      let sa = sin(angle);
      let nx = n.x * ca - n.y * sa;
      let ny = n.x * sa + n.y * ca;
      n = normalize(vec2<f32>(nx, ny));
    }

    // Position correction (move current particle only). We do not write to 'other'.
    var c1 = n * (bestOverlap * 0.55);
    // Tiny tangential jitter with zero-mean using rand2 to reduce directional bias
    let t = vec2<f32>(-n.y, n.x);
    let jitterAmp = (rand2 - 0.5) * min(bestOverlap * 0.1, 0.5);
    let jitter = t * jitterAmp;
    c1 = c1 + jitter;
    ${particleVar}.position = ${particleVar}.position + c1;

    // Impulse-based bounce to conserve kinetic energy along contact normal
    let v1 = ${particleVar}.velocity;
    let v2 = other.velocity;
    let m1 = ${particleVar}.mass;
    let m2 = other.mass;
    let e = ${getUniform("restitution")};
    let relN = dot(v1 - v2, n);
    if (relN < 0.0) {
      let denom = max((1.0 / max(m1, 1e-6)) + (1.0 / max(m2, 1e-6)), 1e-6);
      let j = -(1.0 + e) * relN / denom;
      let dv = min(j / max(m1, 1e-6), 1000.0);
      ${particleVar}.velocity = v1 + n * dv;
    }
  }
`,
    };
  }

  cpu(): CPUDescriptor<"collisions", CollisionBindingKeys> {
    throw new Error("Not implemented");
  }
}
