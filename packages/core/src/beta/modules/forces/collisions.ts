/**
 * Collisions (Force Module)
 *
 * Simple pairwise collision response using the spatial grid for neighbor queries.
 * Uses a two-phase approach: pick deepest overlap neighbor (to reduce bias), then
 * correct position and apply a bounce impulse along the contact normal.
 * Velocity response in apply() is commented out; constraint/correct handle stability.
 *
 * Special handling: When particles are at identical positions (e.g., from boundary
 * repositioning), they are separated with a small pseudo-random offset to prevent
 * them from being stuck together permanently.
 */
import {
  Module,
  type WebGPUDescriptor,
  ModuleRole,
  CPUDescriptor,
  DataType,
} from "../../module";
import { Particle } from "../../particle";

export const DEFAULT_COLLISIONS_RESTITUTION = 0.8;

// Simple, brute-force elastic collision response applied only to current particle
type CollisionsInputs = {
  restitution: number;
};

export class Collisions extends Module<"collisions", CollisionsInputs> {
  readonly name = "collisions" as const;
  readonly role = ModuleRole.Force;
  readonly inputs = {
    restitution: DataType.NUMBER,
  } as const;

  constructor(opts?: { enabled?: boolean; restitution?: number }) {
    super();
    this.write({
      restitution: opts?.restitution ?? DEFAULT_COLLISIONS_RESTITUTION,
    });
    if (opts?.enabled !== undefined) {
      this.setEnabled(!!opts.enabled);
    }
  }

  setRestitution(value: number): void {
    this.write({ restitution: value });
  }

  getRestitution(): number {
    return this.readValue("restitution");
  }

  webgpu(): WebGPUDescriptor<CollisionsInputs> {
    return {
      constrain: ({ particleVar, maxSizeVar, getUniform }) => `
  // Pass 1: find deepest overlap neighbor to reduce scan-order bias
  var it = neighbor_iter_init(${particleVar}.position, ${particleVar}.size + ${maxSizeVar} + 1);
  var bestJ: u32 = NEIGHBOR_NONE;
  var bestN: vec2<f32> = vec2<f32>(0.0, 0.0);
  var bestOverlap: f32 = 0.0;
  var identicalPositionJ: u32 = NEIGHBOR_NONE;
  loop {
    let j = neighbor_iter_next(&it, index);
    if (j == NEIGHBOR_NONE) { break; }
    var other = particles[j];
    // Skip removed neighbors; treat pinned as infinite mass later
    if (other.mass == 0.0) { continue; }
    let r = other.size + ${particleVar}.size;
    let delta = ${particleVar}.position - other.position;
    let dist2 = dot(delta, delta);
    
    // Special case: particles at identical positions
    if (dist2 <= 0.000001) {
      identicalPositionJ = j;
    } else if (dist2 > 0.0001 && dist2 < r*r) {
      let dist = sqrt(dist2);
      let overlap = r - dist;
      if (overlap > bestOverlap) {
        bestOverlap = overlap;
        bestJ = j;
        bestN = delta / dist;
      }
    }
  }

  // Handle particles at identical positions first
  if (identicalPositionJ != NEIGHBOR_NONE) {
    var other = particles[identicalPositionJ];
    
    // Generate pseudo-random separation direction based on particle indices
    let seed = f32(index * 73 + identicalPositionJ * 37);
    let h = seed * 0.01234567;
    let angle = fract(sin(h) * 43758.5453) * 6.283185307; // 0 to 2*PI
    let sepDist = (other.size + ${particleVar}.size) * 0.51; // Slightly more than touching
    
    let separationX = cos(angle) * sepDist;
    let separationY = sin(angle) * sepDist;
    
    ${particleVar}.position = ${particleVar}.position + vec2<f32>(separationX, separationY);
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
      // Treat pinned (mass < 0) as infinite mass: zero inverse mass
      let invM1 = select(0.0, 1.0 / max(m1, 1e-6), m1 > 0.0);
      let invM2 = select(0.0, 1.0 / max(m2, 1e-6), m2 > 0.0);
      let invSum = max(invM1 + invM2, 1e-6);
      let j = -(1.0 + e) * relN / invSum;
      let dv = min(j * invM1, 1000.0);
      ${particleVar}.velocity = v1 + n * dv;
    }
  }
`,
      correct: ({ particleVar, dtVar, prevPosVar, postPosVar }) => `
  // Position-based velocity correction from integration state
  let disp = ${particleVar}.position - ${prevPosVar};
  let disp2 = dot(disp, disp);
  let corr = ${particleVar}.position - ${postPosVar};
  let corr2 = dot(corr, corr);
  if (corr2 > 0.0 && ${dtVar} > 0.0) {
    let corrLenInv = inverseSqrt(corr2);
    let corrDir = corr * corrLenInv;
    let corrVel = corr / ${dtVar};
    let corrVelAlong = dot(corrVel, corrDir);
    let vNBefore = dot(${particleVar}.velocity, corrDir);
    let vNAfterCandidate = vNBefore + corrVelAlong;
    let vNAfter = select(vNBefore, vNAfterCandidate, abs(vNAfterCandidate) < abs(vNBefore));
    ${particleVar}.velocity = ${particleVar}.velocity + corrDir * (vNAfter - vNBefore);
  }
  let v2_total = dot(${particleVar}.velocity, ${particleVar}.velocity);
  if (disp2 < 1e-8 && v2_total < 0.5) {
    ${particleVar}.velocity = vec2<f32>(0.0, 0.0);
  }
`,
    };
  }

  cpu(): CPUDescriptor<CollisionsInputs> {
    // Helper function equivalent to GLSL fract()
    const fract = (x: number) => x - Math.floor(x);

    return {
      constrain: ({ particle, getNeighbors, input, maxSize }) => {
        // Find deepest overlap neighbor to reduce scan-order bias
        const searchRadius = particle.size + maxSize + 1;
        const neighbors = getNeighbors(particle.position, searchRadius);

        let bestOverlap = 0;
        let bestOther: any = null;
        let bestN = { x: 0, y: 0 };
        let identicalPositionOther: Particle | null = null;

        for (const other of neighbors) {
          if (other.id === particle.id) continue;
          // Skip removed neighbors; treat pinned as infinite mass later
          if (other.mass === 0) continue;

          const r = other.size + particle.size;
          const deltaX = particle.position.x - other.position.x;
          const deltaY = particle.position.y - other.position.y;
          const dist2 = deltaX * deltaX + deltaY * deltaY;

          // Special case: particles at identical positions
          if (dist2 <= 0.000001) {
            identicalPositionOther = other;
          } else if (dist2 > 0.0001 && dist2 < r * r) {
            const dist = Math.sqrt(dist2);
            const overlap = r - dist;
            if (overlap > bestOverlap) {
              bestOverlap = overlap;
              bestOther = other;
              bestN = { x: deltaX / dist, y: deltaY / dist };
            }
          }
        }

        // Handle particles at identical positions first
        if (identicalPositionOther) {
          // Generate pseudo-random separation direction based on particle IDs (matching WebGPU logic)
          const seed = particle.id * 73 + identicalPositionOther.id * 37;
          const h = seed * 0.01234567;
          const angle = fract(Math.sin(h) * 43758.5453) * 6.283185307; // 0 to 2*PI
          const sepDist = (identicalPositionOther.size + particle.size) * 0.51; // Slightly more than touching

          const separationX = Math.cos(angle) * sepDist;
          const separationY = Math.sin(angle) * sepDist;

          particle.position.x += separationX;
          particle.position.y += separationY;
        }

        if (bestOther) {
          const n = bestN;

          // Pseudo-random helpers based on world position to avoid index-order bias
          const h1 =
            particle.position.x * 12.9898 + particle.position.y * 78.233;
          const rand1 = fract(Math.sin(h1) * 43758.5453);
          const h2 =
            particle.position.x * 93.9898 + particle.position.y * 67.345;
          const rand2 = fract(Math.sin(h2) * 15731.7431);

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
            // Treat pinned (mass < 0) as infinite mass: zero inverse mass
            const invM1 = m1 > 0 ? 1 / Math.max(m1, 1e-6) : 0;
            const invM2 = m2 > 0 ? 1 / Math.max(m2, 1e-6) : 0;
            const invSum = Math.max(invM1 + invM2, 1e-6);
            const j = (-(1 + e) * relN) / invSum;
            const dv = Math.min(j * invM1, 1000);
            particle.velocity.x = v1x + n.x * dv;
            particle.velocity.y = v1y + n.y * dv;
          }
        }
      },
      correct: ({ particle, dt, prevPos, postPos }) => {
        const dispX = particle.position.x - prevPos.x;
        const dispY = particle.position.y - prevPos.y;
        const disp2 = dispX * dispX + dispY * dispY;

        const corrX = particle.position.x - postPos.x;
        const corrY = particle.position.y - postPos.y;
        const corr2 = corrX * corrX + corrY * corrY;

        if (corr2 > 0.0 && dt > 0.0) {
          const corrLenInv = 1.0 / Math.sqrt(corr2);
          const corrDirX = corrX * corrLenInv;
          const corrDirY = corrY * corrLenInv;
          const corrVelX = corrX / dt;
          const corrVelY = corrY / dt;
          const corrVelAlong = corrVelX * corrDirX + corrVelY * corrDirY;
          const vNBefore =
            particle.velocity.x * corrDirX + particle.velocity.y * corrDirY;
          const vNAfterCandidate = vNBefore + corrVelAlong;
          const vNAfter =
            Math.abs(vNAfterCandidate) < Math.abs(vNBefore)
              ? vNAfterCandidate
              : vNBefore;

          particle.velocity.x =
            particle.velocity.x + corrDirX * (vNAfter - vNBefore);
          particle.velocity.y =
            particle.velocity.y + corrDirY * (vNAfter - vNBefore);
        }

        const v2_total =
          particle.velocity.x * particle.velocity.x +
          particle.velocity.y * particle.velocity.y;
        if (disp2 < 1e-8 && v2_total < 0.5) {
          particle.velocity.x = 0.0;
          particle.velocity.y = 0.0;
        }
      },
    };
  }
}
