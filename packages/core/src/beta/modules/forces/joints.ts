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
  lineWidth: number;
};

export class Joints extends Module<"joints", JointsInputs> {
  readonly name = "joints" as const;
  readonly role = ModuleRole.Force;
  readonly inputs = {
    aIndexes: DataType.ARRAY,
    bIndexes: DataType.ARRAY,
    restLengths: DataType.ARRAY,
    enableCollisions: DataType.NUMBER,
    lineWidth: DataType.NUMBER,
  } as const;

  constructor(opts?: {
    enabled?: boolean;
    aIndexes?: number[];
    bIndexes?: number[];
    restLengths?: number[];
    enableCollisions?: number;
    lineWidth?: number;
  }) {
    super();
    this.write({
      aIndexes: opts?.aIndexes ?? [],
      bIndexes: opts?.bIndexes ?? [],
      restLengths: opts?.restLengths ?? [],
      enableCollisions: opts?.enableCollisions ?? 1,
      lineWidth: opts?.lineWidth ?? 1.5,
    });
    if (opts?.enabled !== undefined) this.setEnabled(!!opts.enabled);
  }

  setJoints(
    aIndexes: number[],
    bIndexes: number[],
    restLengths: number[]
  ): void {
    this.write({ aIndexes, bIndexes, restLengths });
  }

  setEnableCollisions(val: number): void {
    this.write({ enableCollisions: val });
  }

  setLineWidth(val: number): void {
    this.write({ lineWidth: val });
  }

  webgpu(): WebGPUDescriptor<JointsInputs> {
    return {
      // v1: constrain in per-particle pass, linear scan over joints for simplicity
      constrain: ({ particleVar, getUniform, getLength }) => `{
  let jointCount = ${getLength("aIndexes")};
  if (jointCount == 0u) { return; }
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
    };
  }

  cpu(): CPUDescriptor<JointsInputs> {
    return {
      // Force part: apply distance constraints with inverse-mass split
      constrain: (args: {
        particle: Particle;
        index?: number;
        getParticleByIndex?: (i: number) => Particle | undefined;
      }) => {
        const particle = (args as { particle: Particle }).particle;
        const index = (args as { index?: number }).index;
        const getParticleByIndex = (
          args as {
            getParticleByIndex?: (i: number) => Particle | undefined;
          }
        ).getParticleByIndex;
        if (!getParticleByIndex || index === undefined) return;
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
          const other = getParticleByIndex(otherIndex);
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
    };
  }
}
