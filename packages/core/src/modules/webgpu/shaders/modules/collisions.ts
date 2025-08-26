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
  // Brute-force elastic collision: mass-aware normal/tangent response
  let e = ${getUniform("restitution")};
  for (var j: u32 = 0u; j < count; j = j + 1u) {
    if (j == index) { continue; }
    var other = particles[j];
    let dx = ${particleVar}.position.x - other.position.x;
    let dy = ${particleVar}.position.y - other.position.y;
    let r = other.size + ${particleVar}.size;
    let dist2 = dx*dx + dy*dy;
    if (dist2 > 0.0001 && dist2 < r*r) {
      let dist = sqrt(dist2);

      // Normal vector
      let nx = dx / dist;
      let ny = dy / dist;

      // Overlap
      let overlap = r - dist;

      // Total mass
      let totalMass = ${particleVar}.mass + other.mass;

      // Amount of separation each particle gets is inversely proportional to its mass
      let separationPerMass = overlap / totalMass;

      // Collision vector
      let c1x = nx * separationPerMass * ${particleVar}.mass;
      let c1y = ny * separationPerMass * ${particleVar}.mass;
      let c2x = nx * separationPerMass * other.mass;
      let c2y = ny * separationPerMass * other.mass;

      // Position update
      ${particleVar}.position.x = ${particleVar}.position.x + c1x;
      ${particleVar}.position.y = ${particleVar}.position.y + c1y;
      other.position.x = other.position.x - c2x;
      other.position.y = other.position.y - c2y;

      // Velocity components
      let v1x = ${particleVar}.velocity.x;
      let v1y = ${particleVar}.velocity.y;
      let v2x = other.velocity.x;
      let v2y = other.velocity.y;

      // Normal components (scalars)
      let v1n = v1x*nx + v1y*ny;
      let v2n = v2x*nx + v2y*ny;

      // Tangential components
      let v1tx = v1x - nx * v1n;
      let v1ty = v1y - ny * v1n;
      let v2tx = v2x - nx * v2n;
      let v2ty = v2y - ny * v2n;

      // Masses
      let m1 = ${particleVar}.mass;
      let m2 = other.mass;

      // New normal velocities after 1-D collision equations with restitution
      let v1nAfter = (v1n * (m1 - e * m2) + (1 + e) * m2 * v2n) / (m1 + m2);
      let v2nAfter = (v2n * (m2 - e * m1) + (1 + e) * m1 * v1n) / (m1 + m2);

      // New normal velocities
      let v1nx = nx * v1nAfter;
      let v1ny = ny * v1nAfter;
      let v2nx = nx * v2nAfter;
      let v2ny = ny * v2nAfter;

      // New velocities
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
