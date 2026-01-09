/**
 * Behavior (Force Module)
 *
 * Boids-like steering behaviors: separation, alignment, cohesion, chase/avoid, wander.
 * Uses the spatial grid neighbor iterator to accumulate local influences and writes
 * into particle acceleration (no extra state). Tuned to avoid heavy branching and
 * zero-velocity edge cases.
 */
import {
  Module,
  type WebGPUDescriptor,
  type WebGL2Descriptor,
  ModuleRole,
  CPUDescriptor,
  DataType,
} from "../../module";

export const DEFAULT_BEHAVIOR_WANDER = 20;
export const DEFAULT_BEHAVIOR_COHESION = 1.5;
export const DEFAULT_BEHAVIOR_ALIGNMENT = 1.5;
export const DEFAULT_BEHAVIOR_REPULSION = 2;
export const DEFAULT_BEHAVIOR_CHASE = 0;
export const DEFAULT_BEHAVIOR_AVOID = 0;
export const DEFAULT_BEHAVIOR_SEPARATION = 10;
export const DEFAULT_BEHAVIOR_VIEW_RADIUS = 100;
export const DEFAULT_BEHAVIOR_VIEW_ANGLE = 1.5 * Math.PI;

type BehaviorInputs = {
  wander: number;
  cohesion: number;
  alignment: number;
  repulsion: number;
  chase: number;
  avoid: number;
  separation: number;
  viewRadius: number;
  viewAngle: number;
};

export class Behavior extends Module<"behavior", BehaviorInputs> {
  readonly name = "behavior" as const;
  readonly role = ModuleRole.Force;
  readonly inputs = {
    wander: DataType.NUMBER,
    cohesion: DataType.NUMBER,
    alignment: DataType.NUMBER,
    repulsion: DataType.NUMBER,
    chase: DataType.NUMBER,
    avoid: DataType.NUMBER,
    separation: DataType.NUMBER,
    viewRadius: DataType.NUMBER,
    viewAngle: DataType.NUMBER,
  } as const;

  constructor(opts?: {
    wander?: number;
    cohesion?: number;
    alignment?: number;
    repulsion?: number;
    chase?: number;
    avoid?: number;
    separation?: number;
    viewRadius?: number;
    viewAngle?: number;
    enabled?: boolean;
  }) {
    super();
    this.write({
      wander: opts?.wander ?? DEFAULT_BEHAVIOR_WANDER,
      cohesion: opts?.cohesion ?? DEFAULT_BEHAVIOR_COHESION,
      alignment: opts?.alignment ?? DEFAULT_BEHAVIOR_ALIGNMENT,
      repulsion: opts?.repulsion ?? DEFAULT_BEHAVIOR_REPULSION,
      chase: opts?.chase ?? DEFAULT_BEHAVIOR_CHASE,
      avoid: opts?.avoid ?? DEFAULT_BEHAVIOR_AVOID,
      separation: opts?.separation ?? DEFAULT_BEHAVIOR_SEPARATION,
      viewRadius: opts?.viewRadius ?? DEFAULT_BEHAVIOR_VIEW_RADIUS,
      viewAngle: opts?.viewAngle ?? DEFAULT_BEHAVIOR_VIEW_ANGLE,
    });
    if (opts?.enabled !== undefined) this.setEnabled(!!opts.enabled);
  }

  setWander(v: number): void {
    this.write({ wander: v });
  }
  setCohesion(v: number): void {
    this.write({ cohesion: v });
  }
  setAlignment(v: number): void {
    this.write({ alignment: v });
  }
  setRepulsion(v: number): void {
    this.write({ repulsion: v });
  }
  setChase(v: number): void {
    this.write({ chase: v });
  }
  setAvoid(v: number): void {
    this.write({ avoid: v });
  }
  setSeparation(v: number): void {
    this.write({ separation: v });
  }
  setViewRadius(v: number): void {
    this.write({ viewRadius: v });
  }
  setViewAngle(v: number): void {
    this.write({ viewAngle: v });
  }

  getWander(): number {
    return this.readValue("wander");
  }
  getCohesion(): number {
    return this.readValue("cohesion");
  }
  getAlignment(): number {
    return this.readValue("alignment");
  }
  getRepulsion(): number {
    return this.readValue("repulsion");
  }
  getChase(): number {
    return this.readValue("chase");
  }
  getAvoid(): number {
    return this.readValue("avoid");
  }
  getSeparation(): number {
    return this.readValue("separation");
  }
  getViewRadius(): number {
    return this.readValue("viewRadius");
  }
  getViewAngle(): number {
    return this.readValue("viewAngle");
  }

  webgpu(): WebGPUDescriptor<BehaviorInputs> {
    return {
      apply: ({ particleVar, getUniform }) => `
  // Neighbor loop within view radius
  let viewR = ${getUniform("viewRadius")};
  let sepRange = ${getUniform("separation")};
  let wSep = ${getUniform("repulsion")};
  let wAli = ${getUniform("alignment")};
  let wCoh = ${getUniform("cohesion")};
  let wChase = ${getUniform("chase")};
  let wAvoid = ${getUniform("avoid")};
  let wWander = ${getUniform("wander")};
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

  cpu(): CPUDescriptor<BehaviorInputs> {
    return {
      apply: ({ particle, getNeighbors }) => {
        // Get behavior parameters
        const viewR = this.readValue("viewRadius");
        const sepRange = this.readValue("separation");
        const wSep = this.readValue("repulsion");
        const wAli = this.readValue("alignment");
        const wCoh = this.readValue("cohesion");
        const wChase = this.readValue("chase");
        const wAvoid = this.readValue("avoid");
        const wWander = this.readValue("wander");
        const halfAngle = this.readValue("viewAngle") * 0.5;
        const cosHalf = Math.cos(halfAngle);

        // Accumulators
        let sepX = 0,
          sepY = 0;
        let aliX = 0,
          aliY = 0;
        let cohPosX = 0,
          cohPosY = 0;
        let cohCount = 0;
        let aliCount = 0;

        // Normalize particle velocity for FOV; if zero, skip FOV filtering
        const vMag2 =
          particle.velocity.x * particle.velocity.x +
          particle.velocity.y * particle.velocity.y;
        const hasVel = vMag2 > 1e-6;
        let vNormX = 1,
          vNormY = 0;
        if (hasVel) {
          const vMag = Math.sqrt(vMag2);
          vNormX = particle.velocity.x / vMag;
          vNormY = particle.velocity.y / vMag;
        }

        // Get neighbors within view radius using spatial grid
        const neighbors = getNeighbors(particle.position, viewR);

        for (const other of neighbors) {
          if (other.id === particle.id) continue; // Skip self

          const toOtherX = other.position.x - particle.position.x;
          const toOtherY = other.position.y - particle.position.y;
          const dist2 = toOtherX * toOtherX + toOtherY * toOtherY;

          if (dist2 <= 0.0) continue;

          const dist = Math.sqrt(dist2);
          if (dist >= viewR) continue;

          // Field of view check
          if (hasVel) {
            const dirX = toOtherX / dist;
            const dirY = toOtherY / dist;
            const dotProduct = vNormX * dirX + vNormY * dirY;
            if (dotProduct < cosHalf) continue;
          }

          // Separation (closer than sepRange)
          if (dist < sepRange && wSep > 0.0) {
            const awayX =
              (particle.position.x - other.position.x) / Math.max(dist, 1e-3);
            const awayY =
              (particle.position.y - other.position.y) / Math.max(dist, 1e-3);
            sepX += awayX;
            sepY += awayY;
          }

          // Alignment
          if (wAli > 0.0) {
            aliX += other.velocity.x;
            aliY += other.velocity.y;
            aliCount += 1.0;
          }

          // Cohesion
          if (wCoh > 0.0) {
            cohPosX += other.position.x;
            cohPosY += other.position.y;
            cohCount += 1.0;
          }

          // Chase / Avoid based on mass relation
          if (wChase > 0.0 && particle.mass > other.mass) {
            const massDelta =
              (particle.mass - other.mass) / Math.max(particle.mass, 1e-6);
            const seekX =
              (toOtherX / Math.max(dist, 1e-3)) * (massDelta * particle.mass);
            const seekY =
              (toOtherY / Math.max(dist, 1e-3)) * (massDelta * particle.mass);
            // accumulate into cohesion-like vector
            cohPosX += particle.position.x + seekX;
            cohPosY += particle.position.y + seekY;
            cohCount += 1.0;
          }

          if (
            wAvoid > 0.0 &&
            particle.mass < other.mass &&
            dist < viewR * 0.5
          ) {
            const massDelta =
              (other.mass - particle.mass) / Math.max(other.mass, 1e-6);
            let repX = particle.position.x - other.position.x;
            let repY = particle.position.y - other.position.y;
            const repLen = Math.sqrt(repX * repX + repY * repY);
            if (repLen > 0.0) {
              repX =
                (repX / repLen) *
                100000.0 *
                massDelta *
                (1.0 / Math.max(repLen, 1.0));
              repY =
                (repY / repLen) *
                100000.0 *
                massDelta *
                (1.0 / Math.max(repLen, 1.0));
              sepX += repX;
              sepY += repY;
            }
          }
        }

        // Finalize alignment: steer toward avg neighbor velocity
        if (aliCount > 0.0) {
          let avgVX = aliX / aliCount;
          let avgVY = aliY / aliCount;
          const avgVLen = Math.sqrt(avgVX * avgVX + avgVY * avgVY);
          if (avgVLen > 0.0) {
            avgVX = (avgVX / avgVLen) * 1000.0;
            avgVY = (avgVY / avgVLen) * 1000.0;
            const steerAliX = avgVX - particle.velocity.x;
            const steerAliY = avgVY - particle.velocity.y;
            particle.acceleration.x += steerAliX * wAli;
            particle.acceleration.y += steerAliY * wAli;
          }
        }

        // Finalize cohesion: seek centroid
        if (cohCount > 0.0) {
          const centerX = cohPosX / cohCount;
          const centerY = cohPosY / cohCount;
          let seekX = centerX - particle.position.x;
          let seekY = centerY - particle.position.y;
          const seekLen = Math.sqrt(seekX * seekX + seekY * seekY);
          if (seekLen > 0.0) {
            seekX = (seekX / seekLen) * 1000.0 - particle.velocity.x;
            seekY = (seekY / seekLen) * 1000.0 - particle.velocity.y;
            particle.acceleration.x += seekX * wCoh;
            particle.acceleration.y += seekY * wCoh;
          }
        }

        // Apply separation
        const sepLen = Math.sqrt(sepX * sepX + sepY * sepY);
        if (sepLen > 0.0) {
          sepX = (sepX / sepLen) * 1000.0 - particle.velocity.x;
          sepY = (sepY / sepLen) * 1000.0 - particle.velocity.y;
          particle.acceleration.x += sepX * wSep;
          particle.acceleration.y += sepY * wSep;
        }

        // Simple wander: small perturbation perpendicular to velocity (no state)
        if (wWander > 0.0) {
          const velX = particle.velocity.x;
          const velY = particle.velocity.y;
          const velLen = Math.sqrt(velX * velX + velY * velY);

          let dirX = 1.0,
            dirY = 0.0;
          if (velLen > 1e-6) {
            dirX = velX / velLen;
            dirY = velY / velLen;
          }

          const perpX = -dirY;
          const perpY = dirX;

          // pseudo-random based on position (matching WebGPU logic)
          const h =
            particle.position.x * 12.9898 + particle.position.y * 78.233;
          const fract = (x: number) => x - Math.floor(x);
          const r = fract(Math.sin(h) * 43758.5453) - 0.5;
          const jitterX = perpX * (r * 200.0);
          const jitterY = perpY * (r * 200.0);

          particle.acceleration.x += jitterX * wWander;
          particle.acceleration.y += jitterY * wWander;
        }
      },
    };
  }

  webgl2(): WebGL2Descriptor<BehaviorInputs> {
    // WebGL2 boids-style steering: separation, alignment, cohesion, chase/avoid, wander
    return {
      apply: ({ particleVar, getUniform }) => `
  // Get behavior parameters
  float viewR = ${getUniform("viewRadius")};
  float sepRange = ${getUniform("separation")};
  float wSep = ${getUniform("repulsion")};
  float wAli = ${getUniform("alignment")};
  float wCoh = ${getUniform("cohesion")};
  float wChase = ${getUniform("chase")};
  float wAvoid = ${getUniform("avoid")};
  float wWander = ${getUniform("wander")};
  float halfAngle = ${getUniform("viewAngle")} * 0.5;
  float cosHalf = cos(halfAngle);

  // Accumulators
  vec2 sep = vec2(0.0, 0.0);
  vec2 ali = vec2(0.0, 0.0);
  vec2 cohPos = vec2(0.0, 0.0);
  float cohCount = 0.0;
  float aliCount = 0.0;

  // Normalize particle velocity for FOV check
  float vMag2 = dot(${particleVar}.velocity, ${particleVar}.velocity);
  bool hasVel = vMag2 > 1e-6;
  vec2 vNorm = hasVel ? normalize(${particleVar}.velocity) : vec2(1.0, 0.0);

  // Neighbor iteration using grid
  int neighbors[64];
  int neighborCount = getNeighbors(${particleVar}.position, viewR, particleId, neighbors, 64);

  for (int ni = 0; ni < neighborCount; ni++) {
    int j = neighbors[ni];
    if (j == particleId) continue;

    // Read neighbor particle data
    vec2 otherCoord0 = getTexelCoord(j, 0);
    vec2 otherCoord1 = getTexelCoord(j, 1);
    vec4 otherTexel0 = texture(u_particleTexture, otherCoord0);
    vec4 otherTexel1 = texture(u_particleTexture, otherCoord1);

    vec2 otherPos = otherTexel0.xy;
    vec2 otherVel = otherTexel0.zw;
    float otherMass = otherTexel1.w;

    vec2 toOther = otherPos - ${particleVar}.position;
    float dist2 = dot(toOther, toOther);
    if (dist2 <= 0.0) continue;

    float dist = sqrt(dist2);
    if (dist >= viewR) continue;

    // Field of view check
    if (hasVel) {
      vec2 dir = toOther / dist;
      float d = dot(vNorm, dir);
      if (d < cosHalf) continue;
    }

    // Separation (closer than sepRange)
    if (dist < sepRange && wSep > 0.0) {
      vec2 away = (${particleVar}.position - otherPos) / max(dist, 1e-3);
      sep += away;
    }

    // Alignment
    if (wAli > 0.0) {
      ali += otherVel;
      aliCount += 1.0;
    }

    // Cohesion
    if (wCoh > 0.0) {
      cohPos += otherPos;
      cohCount += 1.0;
    }

    // Chase / Avoid based on mass relation
    if (wChase > 0.0 && ${particleVar}.mass > otherMass) {
      float massDelta = (${particleVar}.mass - otherMass) / max(${particleVar}.mass, 1e-6);
      vec2 seek = (toOther / max(dist, 1e-3)) * (massDelta * ${particleVar}.mass);
      cohPos += ${particleVar}.position + seek;
      cohCount += 1.0;
    }

    if (wAvoid > 0.0 && ${particleVar}.mass < otherMass && dist < viewR * 0.5) {
      float massDelta = (otherMass - ${particleVar}.mass) / max(otherMass, 1e-6);
      vec2 rep = ${particleVar}.position - otherPos;
      float repLen = length(rep);
      if (repLen > 0.0) {
        rep = normalize(rep) * 100000.0 * massDelta * (1.0 / max(repLen, 1.0));
        sep += rep;
      }
    }
  }

  // Finalize alignment: steer toward avg neighbor velocity
  if (aliCount > 0.0) {
    vec2 avgV = ali / aliCount;
    if (length(avgV) > 0.0) {
      avgV = normalize(avgV) * 1000.0;
      vec2 steerAli = avgV - ${particleVar}.velocity;
      ${particleVar}.acceleration += steerAli * wAli;
    }
  }

  // Finalize cohesion: seek centroid
  if (cohCount > 0.0) {
    vec2 center = cohPos / cohCount;
    vec2 seek = center - ${particleVar}.position;
    if (length(seek) > 0.0) {
      seek = normalize(seek) * 1000.0 - ${particleVar}.velocity;
      ${particleVar}.acceleration += seek * wCoh;
    }
  }

  // Apply separation
  if (length(sep) > 0.0) {
    sep = normalize(sep) * 1000.0 - ${particleVar}.velocity;
    ${particleVar}.acceleration += sep * wSep;
  }

  // Simple wander: small perturbation perpendicular to velocity
  if (wWander > 0.0) {
    vec2 vel = ${particleVar}.velocity;
    float l = length(vel);
    vec2 dir = l > 1e-6 ? vel / max(l, 1e-6) : vec2(1.0, 0.0);
    vec2 perp = vec2(-dir.y, dir.x);
    // pseudo-random based on position
    float h = dot(${particleVar}.position, vec2(12.9898, 78.233));
    float r = fract(sin(h) * 43758.5453) - 0.5;
    vec2 jitter = perp * (r * 200.0);
    ${particleVar}.acceleration += jitter * wWander;
  }
`,
    };
  }
}
