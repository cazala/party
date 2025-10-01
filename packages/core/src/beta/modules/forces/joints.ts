import {
  Module,
  ModuleRole,
  type WebGPUDescriptor,
  CPUDescriptor,
  DataType,
} from "../../module";
import type { Particle } from "../../particle";

type JointsInputs = {
  aIndexes: number[];
  bIndexes: number[];
  restLengths: number[];
  enableCollisions: number;
  momentum: number;
};

export class Joints extends Module<"joints", JointsInputs> {
  readonly name = "joints" as const;
  readonly role = ModuleRole.Force;
  readonly inputs = {
    aIndexes: DataType.ARRAY,
    bIndexes: DataType.ARRAY,
    restLengths: DataType.ARRAY,
    enableCollisions: DataType.NUMBER,
    momentum: DataType.NUMBER,
  } as const;

  constructor(opts?: {
    enabled?: boolean;
    aIndexes?: number[];
    bIndexes?: number[];
    restLengths?: number[];
    enableCollisions?: number;
    momentum?: number;
  }) {
    super();
    this.write({
      aIndexes: opts?.aIndexes ?? [],
      bIndexes: opts?.bIndexes ?? [],
      restLengths: opts?.restLengths ?? [],
      enableCollisions: opts?.enableCollisions ?? 1,
      momentum: opts?.momentum ?? 0.7,
    });
    if (opts?.enabled !== undefined) this.setEnabled(!!opts.enabled);
  }

  getJoints(): {
    aIndexes: number[];
    bIndexes: number[];
    restLengths: number[];
  } {
    return {
      aIndexes: this.readArray("aIndexes") as number[],
      bIndexes: this.readArray("bIndexes") as number[],
      restLengths: this.readArray("restLengths") as number[],
    };
  }

  setJoints(
    aIndexes: number[],
    bIndexes: number[],
    restLengths: number[]
  ): void {
    this.write({ aIndexes, bIndexes, restLengths });
  }

  getEnableCollisions() {
    return this.readValue("enableCollisions");
  }

  setEnableCollisions(val: number): void {
    this.write({ enableCollisions: val });
  }

  getMomentum() {
    return this.readValue("momentum");
  }

  setMomentum(val: number): void {
    this.write({ momentum: Math.max(0, Math.min(1, val)) }); // Clamp between 0 and 1
  }

  webgpu(): WebGPUDescriptor<JointsInputs, "prevX" | "prevY"> {
    return {
      states: ["prevX", "prevY"] as const,

      // Store pre-physics positions for momentum preservation
      state: ({ particleVar, getLength, setState }) => `{
  let jointCount = ${getLength("aIndexes")};
  if (jointCount > 0u) {
    // Store current position before physics integration
    ${setState("prevX", `${particleVar}.position.x`)};
    ${setState("prevY", `${particleVar}.position.y`)};
  }
}`,

      // v1: constrain in per-particle pass, linear scan over joints for simplicity
      constrain: ({ particleVar, getUniform, getLength }) => `{
  let jointCount = ${getLength("aIndexes")};
  if (jointCount == 0u) { return; }
  
  // Debug: Check array values for first particle only (to avoid spam)
  if (index == 0u && jointCount > 0u) {
    let debug_a = u32(${getUniform("aIndexes", "0u")});
    let debug_b = u32(${getUniform("bIndexes", "0u")});
    // This won't show but will help us understand if the force module has the same issue
  }
  
  // For v1: linear scan joints; future: binary search over sorted aIndexes
  for (var j = 0u; j < jointCount; j++) {
    let a = u32(${getUniform("aIndexes", "j")});
    let b = u32(${getUniform("bIndexes", "j")});
    let rest = ${getUniform("restLengths", "j")};
    if (rest <= 0.0) { continue; }
    var selfIndex = index;
    var otherIndex = 0xffffffffu;
    if (a == selfIndex) {
      otherIndex = b;
    } else if (b == selfIndex) {
      otherIndex = a;
    }
    if (otherIndex == 0xffffffffu) { continue; }
    var other = particles[otherIndex];
    // Skip removed
    if (${particleVar}.mass == 0.0 || other.mass == 0.0) { continue; }
    let delta = other.position - ${particleVar}.position;
    let dist2 = dot(delta, delta);
    if (dist2 < 1e-8) { continue; }
    let dist = sqrt(dist2);
    let dir = delta / dist;
    let diff = dist - rest;
    if (abs(diff) < 1e-6) { continue; }
    let invM_self = select(0.0, 1.0 / ${particleVar}.mass, ${particleVar}.mass > 0.0);
    let invM_other = select(0.0, 1.0 / other.mass, other.mass > 0.0);
    let invSum = invM_self + invM_other;
    if (invSum <= 0.0) { continue; }
    let corr = dir * (diff * (invM_self / invSum));
    ${particleVar}.position = ${particleVar}.position + corr;
  }
}`,

      // Apply momentum preservation after constraint solving
      correct: ({ particleVar, getUniform, getLength, getState, dtVar }) => `{
  let jointCount = ${getLength("aIndexes")};
  if (jointCount == 0u) { return; }
  
  let momentum = ${getUniform("momentum")};
  if (momentum <= 0.0) { return; }
  
  // Get stored pre-physics position
  let prevX = ${getState("prevX")};
  let prevY = ${getState("prevY")};
  let prevPos = vec2<f32>(prevX, prevY);
  
  // Calculate actual total movement (from pre-physics to post-constraint)
  let totalMovement = ${particleVar}.position - prevPos;
  let actualVelocity = totalMovement / ${dtVar};
  
  // Blend current velocity with actual movement velocity
  ${particleVar}.velocity = ${particleVar}.velocity * (1.0 - momentum) + actualVelocity * momentum;
}`,
    };
  }

  cpu(): CPUDescriptor<JointsInputs, "prevX" | "prevY"> {
    return {
      states: ["prevX", "prevY"] as const,

      // Store pre-physics positions for momentum preservation
      state: ({ particle, setState }) => {
        // Store current position before physics integration (only for particles with joints)
        const jointCount = Math.min(
          (this.readArray("aIndexes") as number[])?.length || 0,
          (this.readArray("bIndexes") as number[])?.length || 0
        );

        if (jointCount > 0) {
          setState("prevX", particle.position.x);
          setState("prevY", particle.position.y);
        }
      },

      // Force part: apply distance constraints with inverse-mass split
      constrain: ({ particle, index, particles }) => {
        if (particle.mass === 0) return;
        const a = (this.readArray("aIndexes") as number[]) || [];
        const b = (this.readArray("bIndexes") as number[]) || [];
        const rest = (this.readArray("restLengths") as number[]) || [];
        const count = Math.min(a.length, b.length, rest.length);
        for (let j = 0; j < count; j++) {
          const ia = a[j] >>> 0;
          const ib = b[j] >>> 0;
          if (ia !== index && ib !== index) continue;
          const otherIndex = ia === index ? ib : ia;
          const other = particles[otherIndex];
          if (!other) continue;
          if (other.mass === 0) continue; // removed
          const dx = other.position.x - particle.position.x;
          const dy = other.position.y - particle.position.y;
          const dist2 = dx * dx + dy * dy;
          if (dist2 < 1e-8) continue;
          const dist = Math.sqrt(dist2);
          const rl = rest[j] ?? dist;
          const diff = dist - rl;
          if (Math.abs(diff) < 1e-6) continue;
          const invM_self = particle.mass > 0 ? 1 / particle.mass : 0;
          const invM_other = other.mass > 0 ? 1 / other.mass : 0;
          const invSum = invM_self + invM_other;
          if (invSum <= 0) continue; // both pinned
          const nx = dx / dist;
          const ny = dy / dist;
          const corrMag = diff * (invM_self / invSum);
          particle.position.x += nx * corrMag;
          particle.position.y += ny * corrMag;
        }
      },

      // Apply momentum preservation after constraint solving
      correct: ({ particle, getState, dt }) => {
        if (dt <= 0) return;

        const momentum = this.readValue("momentum") as number;
        if (momentum <= 0) return;

        // Check if this particle has any joints
        const a = (this.readArray("aIndexes") as number[]) || [];
        const b = (this.readArray("bIndexes") as number[]) || [];
        const hasJoints = a.includes(particle.id) || b.includes(particle.id);

        if (!hasJoints) return;

        // Get stored pre-physics position
        const prevX = getState("prevX");
        const prevY = getState("prevY");

        // Calculate actual total movement (from pre-physics to post-constraint)
        const totalMovementX = particle.position.x - prevX;
        const totalMovementY = particle.position.y - prevY;
        const actualVelocityX = totalMovementX / dt;
        const actualVelocityY = totalMovementY / dt;

        // Blend current velocity with actual movement velocity
        particle.velocity.x =
          particle.velocity.x * (1 - momentum) + actualVelocityX * momentum;
        particle.velocity.y =
          particle.velocity.y * (1 - momentum) + actualVelocityY * momentum;
      },
    };
  }
}
