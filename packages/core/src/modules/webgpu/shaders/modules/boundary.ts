import { ComputeModule, type ComputeModuleDescriptor } from "../compute";

type BoundaryBindingKeys = "restitution" | "friction" | "mode";

export type BoundaryMode = "bounce" | "warp" | "kill";

export class Boundary extends ComputeModule<"boundary", BoundaryBindingKeys> {
  private restitution: number;
  private friction: number;
  private mode: BoundaryMode;

  constructor(opts?: {
    restitution?: number;
    friction?: number;
    mode?: BoundaryMode;
  }) {
    super();
    this.restitution = opts?.restitution ?? 0.9;
    this.friction = opts?.friction ?? 0.1;
    this.mode = opts?.mode ?? "bounce";
  }

  setRestitution(value: number): void {
    this.restitution = value;
    this.write({ restitution: value });
  }

  setFriction(value: number): void {
    this.friction = value;
    this.write({ friction: value });
  }

  setMode(mode: BoundaryMode): void {
    this.mode = mode;
    this.write({ mode: this.modeToUniform(mode) });
  }

  private modeToUniform(mode: BoundaryMode): number {
    switch (mode) {
      case "bounce":
        return 0;
      case "warp":
        return 1;
      case "kill":
        return 2;
      default:
        return 0;
    }
  }

  attachUniformWriter(
    writer: (values: Partial<Record<string, number>>) => void
  ): void {
    super.attachUniformWriter(writer);
    this.write({
      restitution: this.restitution,
      friction: this.friction,
      mode: this.modeToUniform(this.mode),
    });
  }

  descriptor(): ComputeModuleDescriptor<"boundary", BoundaryBindingKeys> {
    return {
      name: "boundary",
      role: "force",
      bindings: ["restitution", "friction", "mode"] as const,
      apply: ({ particleVar, getUniform }) => `{
  // Bounce using global grid extents
  let halfSize = ${particleVar}.size;
  let minX = GRID_MINX();
  let maxX = GRID_MAXX();
  let minY = GRID_MINY();
  let maxY = GRID_MAXY();
  let bounce = ${getUniform("restitution")};
  let friction = ${getUniform("friction")};
  let mode = ${getUniform("mode")};

  if (mode == 0.0) {
    // bounce
    // X axis
    if (${particleVar}.position.x - halfSize < minX) {
      ${particleVar}.position.x = minX + halfSize;
      ${particleVar}.velocity.x = -${particleVar}.velocity.x * bounce;
      ${particleVar}.velocity.y *= max(0.0, 1.0 - friction);
    } else if (${particleVar}.position.x + halfSize > maxX) {
      ${particleVar}.position.x = maxX - halfSize;
      ${particleVar}.velocity.x = -${particleVar}.velocity.x * bounce;
      ${particleVar}.velocity.y *= max(0.0, 1.0 - friction);
    }

    // Y axis
    if (${particleVar}.position.y - halfSize < minY) {
      ${particleVar}.position.y = minY + halfSize;
      ${particleVar}.velocity.y = -${particleVar}.velocity.y * bounce;
      ${particleVar}.velocity.x *= max(0.0, 1.0 - friction);
    } else if (${particleVar}.position.y + halfSize > maxY) {
      ${particleVar}.position.y = maxY - halfSize;
      ${particleVar}.velocity.y = -${particleVar}.velocity.y * bounce;
      ${particleVar}.velocity.x *= max(0.0, 1.0 - friction);
    }
  } else if (mode == 1.0) {
    // warp
    // Only warp once the particle is fully outside the bounds
    let eps = 1.0; // spawn just outside the opposite edge so it slides in
    if (${particleVar}.position.x + halfSize < minX) {
      ${particleVar}.position.x = maxX + halfSize + eps;
    } else if (${particleVar}.position.x - halfSize > maxX) {
      ${particleVar}.position.x = minX - halfSize - eps;
    }
    if (${particleVar}.position.y + halfSize < minY) {
      ${particleVar}.position.y = maxY + halfSize + eps;
    } else if (${particleVar}.position.y - halfSize > maxY) {
      ${particleVar}.position.y = minY - halfSize - eps;
    }
  } else if (mode == 2.0) {
    // kill
    // Only kill once the particle is fully outside the bounds
    if (
      ${particleVar}.position.x + halfSize < minX ||
      ${particleVar}.position.x - halfSize > maxX ||
      ${particleVar}.position.y + halfSize < minY ||
      ${particleVar}.position.y - halfSize > maxY
    ) {
      ${particleVar}.mass = 0.0;
    }
  }
}`,
    };
  }
}
