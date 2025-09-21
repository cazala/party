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
  constructor(opts?: { restitution?: number }) {
    super();
    this.write({
      restitution: opts?.restitution ?? DEFAULT_COLLISIONS_RESTITUTION,
    });
  }

  setRestitution(value: number): void {
    this.write({ restitution: value });
  }

  getRestitution(): number {
    return this.readValue("restitution");
  }

  webgpu(): WebGPUDescriptor<"collisions", CollisionBindingKeys> {
    return {
      name: "collisions",
      role: ModuleRole.Force,
      keys: ["restitution"] as const,
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
    return {
      name: "collisions",
      role: ModuleRole.Force,
      keys: ["restitution"] as const,
      constrain: ({ particle, getNeighbors, input }) => {
        // Find deepest overlap neighbor to reduce scan-order bias
        const searchRadius = particle.size * 2;
        const neighbors = getNeighbors(particle.position, searchRadius);

        let bestOverlap = 0;
        let bestOther: any = null;
        let bestN = { x: 0, y: 0 };

        for (const other of neighbors) {
          if (other.id === particle.id) continue;

          const r = other.size + particle.size;
          const deltaX = particle.position.x - other.position.x;
          const deltaY = particle.position.y - other.position.y;
          const dist2 = deltaX * deltaX + deltaY * deltaY;

          if (dist2 > 0.0001 && dist2 < r * r) {
            const dist = Math.sqrt(dist2);
            const overlap = r - dist;
            if (overlap > bestOverlap) {
              bestOverlap = overlap;
              bestOther = other;
              bestN = { x: deltaX / dist, y: deltaY / dist };
            }
          }
        }

        if (bestOther) {
          const n = bestN;

          // Pseudo-random helpers based on world position to avoid index-order bias
          const h1 =
            particle.position.x * 12.9898 + particle.position.y * 78.233;
          const rand1 = (Math.sin(h1) * 43758.5453) % 1;
          const h2 =
            particle.position.x * 93.9898 + particle.position.y * 67.345;
          const rand2 = (Math.sin(h2) * 15731.7431) % 1;

          // Symmetry breaking: if nearly vertical or horizontal alignment, slightly rotate normal
          const ax = Math.abs(n.x);
          const ay = Math.abs(n.y);
          if (ax < 0.03 || ay < 0.03) {
            const angle = (rand1 - 0.5) * 0.3;
            const ca = Math.cos(angle);
            const sa = Math.sin(angle);
            const nx = n.x * ca - n.y * sa;
            const ny = n.x * sa + n.y * ca;
            const len = Math.sqrt(nx * nx + ny * ny);
            if (len > 0) {
              n.x = nx / len;
              n.y = ny / len;
            }
          }

          // Position correction (move current particle only)
          const c1x = n.x * (bestOverlap * 0.55);
          const c1y = n.y * (bestOverlap * 0.55);

          // Tiny tangential jitter with zero-mean using rand2 to reduce directional bias
          const tx = -n.y;
          const ty = n.x;
          const jitterAmp = (rand2 - 0.5) * Math.min(bestOverlap * 0.1, 0.5);
          const jitterX = tx * jitterAmp;
          const jitterY = ty * jitterAmp;

          particle.position.x += c1x + jitterX;
          particle.position.y += c1y + jitterY;

          // Impulse-based bounce to conserve kinetic energy along contact normal
          const v1x = particle.velocity.x;
          const v1y = particle.velocity.y;
          const v2x = bestOther.velocity.x;
          const v2y = bestOther.velocity.y;
          const m1 = particle.mass;
          const m2 = bestOther.mass;
          const e = input.restitution;
          const relN = (v1x - v2x) * n.x + (v1y - v2y) * n.y;

          if (relN < 0) {
            const denom = Math.max(
              1 / Math.max(m1, 1e-6) + 1 / Math.max(m2, 1e-6),
              1e-6
            );
            const j = (-(1 + e) * relN) / denom;
            const dv = Math.min(j / Math.max(m1, 1e-6), 1000);
            particle.velocity.x = v1x + n.x * dv;
            particle.velocity.y = v1y + n.y * dv;
          }
        }
      },
    };
  }
}
