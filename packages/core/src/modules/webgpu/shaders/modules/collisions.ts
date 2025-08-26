import { ComputeModule, type ComputeModuleDescriptor } from "../compute";

type CollisionKeys = "restitution";

// Simple, brute-force elastic collision response applied only to current particle
export class Collisions extends ComputeModule<"collisions", CollisionKeys> {
  private restitution: number;

  constructor(opts?: { restitution?: number }) {
    super();
    this.restitution = opts?.restitution ?? 0.9;
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

  descriptor(): ComputeModuleDescriptor<"collisions", CollisionKeys> {
    return {
      name: "collisions",
      role: "force",
      bindings: ["restitution"] as const,
      apply: ({ particleVar, getUniform }) => `{
  // Grid neighbors iterator API using vec2 math, only updating the current particle
  let e = ${getUniform("restitution")};
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

      // Position correction (move current particle only)
      let overlap = r - dist;
      let totalMass = ${particleVar}.mass + other.mass;
      let separationPerMass = overlap / totalMass;
      let c1 = n * (separationPerMass * ${particleVar}.mass);
      ${particleVar}.position = ${particleVar}.position + c1;

      // Velocity response (normal/tangent decomposition)
      let v1 = ${particleVar}.velocity;
      let v2 = other.velocity;
      let v1n = dot(v1, n);
      let v2n = dot(v2, n);
      let v1t = v1 - n * v1n;
      let m1 = ${particleVar}.mass;
      let m2 = other.mass;
      let v1nAfter = (v1n * (m1 - e * m2) + (1.0 + e) * m2 * v2n) / (m1 + m2);
      let newV1 = v1t + n * v1nAfter;
      ${particleVar}.velocity = newV1;
    }
  }
}`,
    };
  }
}
