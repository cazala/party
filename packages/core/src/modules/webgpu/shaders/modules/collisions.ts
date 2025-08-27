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
      constrain: ({ particleVar }) => `{
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

      // Position correction (move current particle only). We do not write to 'other'.
      let overlap = r - dist;
      let totalMass = ${particleVar}.mass + other.mass;
      let separationPerMass = overlap / totalMass;
      let c1 = n * (separationPerMass * ${particleVar}.mass);
      ${particleVar}.position = ${particleVar}.position + c1;
    }
  }
}`,
    };
  }
}
