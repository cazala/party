import { ComputeModule, type ComputeModuleDescriptor } from "../compute";

type BoundaryKeys = "restitution" | "friction";

export class Boundary extends ComputeModule<"boundary", BoundaryKeys> {
  private restitution: number;
  private friction: number;

  constructor(opts?: { restitution?: number; friction?: number }) {
    super();
    this.restitution = opts?.restitution ?? 0.9;
    this.friction = opts?.friction ?? 0.0;
  }

  setRestitution(value: number): void {
    this.restitution = value;
    this.write({ restitution: value });
  }

  setFriction(value: number): void {
    this.friction = value;
    this.write({ friction: value });
  }

  attachUniformWriter(
    writer: (values: Partial<Record<string, number>>) => void
  ): void {
    super.attachUniformWriter(writer);
    this.write({ restitution: this.restitution, friction: this.friction });
  }

  descriptor(): ComputeModuleDescriptor<"boundary", BoundaryKeys> {
    return {
      name: "boundary",
      role: "force",
      bindings: ["restitution", "friction"] as const,
      apply: ({ particleVar, getUniform }) => `{
  // Bounce using global grid extents
  let halfSize = ${particleVar}.size;
  let minX = GRID_MINX();
  let maxX = GRID_MAXX();
  let minY = GRID_MINY();
  let maxY = GRID_MAXY();
  let bounce = ${getUniform("restitution")};
  let friction = ${getUniform("friction")};

  // X axis
  if (${particleVar}.position.x - halfSize < minX) {
    ${particleVar}.position.x = minX + halfSize;
    ${particleVar}.velocity.x = abs(${particleVar}.velocity.x) * bounce;
    ${particleVar}.velocity.y *= max(0.0, 1.0 - friction);
  } else if (${particleVar}.position.x + halfSize > maxX) {
    ${particleVar}.position.x = maxX - halfSize;
    ${particleVar}.velocity.x = -abs(${particleVar}.velocity.x) * bounce;
    ${particleVar}.velocity.y *= max(0.0, 1.0 - friction);
  }

  // Y axis
  if (${particleVar}.position.y - halfSize < minY) {
    ${particleVar}.position.y = minY + halfSize;
    ${particleVar}.velocity.y = abs(${particleVar}.velocity.y) * bounce;
    ${particleVar}.velocity.x *= max(0.0, 1.0 - friction);
  } else if (${particleVar}.position.y + halfSize > maxY) {
    ${particleVar}.position.y = maxY - halfSize;
    ${particleVar}.velocity.y = -abs(${particleVar}.velocity.y) * bounce;
    ${particleVar}.velocity.x *= max(0.0, 1.0 - friction);
  }
}`,
    };
  }
}
