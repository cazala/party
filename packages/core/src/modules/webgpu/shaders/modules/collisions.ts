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
  // Grid neighbors iterator API
  let e = ${getUniform("restitution")};
  var it = neighbor_iter_init(${particleVar}.position, ${particleVar}.size * 2.0);
  loop {
    let j = neighbor_iter_next(&it, index);
    if (j == NEIGHBOR_NONE) { break; }
    var other = particles[j];
    let dx = ${particleVar}.position.x - other.position.x;
    let dy = ${particleVar}.position.y - other.position.y;
    let r = other.size + ${particleVar}.size;
    let dist2 = dx*dx + dy*dy;
    if (dist2 > 0.0001 && dist2 < r*r) {
      let dist = sqrt(dist2);
      let nx = dx / dist;
      let ny = dy / dist;
      let overlap = r - dist;
      let totalMass = ${particleVar}.mass + other.mass;
      let separationPerMass = overlap / totalMass;
      let c1x = nx * separationPerMass * ${particleVar}.mass;
      let c1y = ny * separationPerMass * ${particleVar}.mass;
      let c2x = nx * separationPerMass * other.mass;
      let c2y = ny * separationPerMass * other.mass;
      ${particleVar}.position.x = ${particleVar}.position.x + c1x;
      ${particleVar}.position.y = ${particleVar}.position.y + c1y;
      other.position.x = other.position.x - c2x;
      other.position.y = other.position.y - c2y;
      let v1x = ${particleVar}.velocity.x;
      let v1y = ${particleVar}.velocity.y;
      let v2x = other.velocity.x;
      let v2y = other.velocity.y;
      let v1n = v1x*nx + v1y*ny;
      let v2n = v2x*nx + v2y*ny;
      let v1tx = v1x - nx * v1n;
      let v1ty = v1y - ny * v1n;
      let v2tx = v2x - nx * v2n;
      let v2ty = v2y - ny * v2n;
      let m1 = ${particleVar}.mass;
      let m2 = other.mass;
      let v1nAfter = (v1n * (m1 - e * m2) + (1 + e) * m2 * v2n) / (m1 + m2);
      let v2nAfter = (v2n * (m2 - e * m1) + (1 + e) * m1 * v1n) / (m1 + m2);
      let v1nx = nx * v1nAfter;
      let v1ny = ny * v1nAfter;
      let v2nx = nx * v2nAfter;
      let v2ny = ny * v2nAfter;
      ${particleVar}.velocity.x = v1tx + v1nx;
      ${particleVar}.velocity.y = v1ty + v1ny;
      other.velocity.x = v2tx + v2nx;
      other.velocity.y = v2ty + v2ny;
    }
  }
}`,
    };
  }
}
