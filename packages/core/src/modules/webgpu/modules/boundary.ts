import { Module, type ModuleDescriptor, ModuleRole } from "../module";

type BoundaryBindingKeys =
  | "restitution"
  | "friction"
  | "mode"
  | "repelDistance"
  | "repelStrength";

export type BoundaryMode = "bounce" | "warp" | "kill" | "none";

export const DEFAULT_BOUNDARY_RESTITUTION = 0.9;
export const DEFAULT_BOUNDARY_FRICTION = 0.1;
export const DEFAULT_BOUNDARY_MODE: BoundaryMode = "bounce";
export const DEFAULT_BOUNDARY_REPEL_DISTANCE = 0.0;
export const DEFAULT_BOUNDARY_REPEL_STRENGTH = 0.0;

export class Boundary extends Module<"boundary", BoundaryBindingKeys> {
  private restitution: number;
  private friction: number;
  private mode: BoundaryMode;
  private repelDistance: number;
  private repelStrength: number;

  constructor(opts?: {
    restitution?: number;
    friction?: number;
    mode?: BoundaryMode;
    repelDistance?: number;
    repelStrength?: number;
  }) {
    super();
    this.restitution = opts?.restitution ?? DEFAULT_BOUNDARY_RESTITUTION;
    this.friction = opts?.friction ?? DEFAULT_BOUNDARY_FRICTION;
    this.mode = opts?.mode ?? DEFAULT_BOUNDARY_MODE;
    this.repelDistance = opts?.repelDistance ?? DEFAULT_BOUNDARY_REPEL_DISTANCE;
    this.repelStrength = opts?.repelStrength ?? DEFAULT_BOUNDARY_REPEL_STRENGTH;
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

  setRepelDistance(value: number): void {
    this.repelDistance = value;
    this.write({ repelDistance: value });
  }

  setRepelStrength(value: number): void {
    this.repelStrength = value;
    this.write({ repelStrength: value });
  }

  private modeToUniform(mode: BoundaryMode): number {
    switch (mode) {
      case "bounce":
        return 0;
      case "warp":
        return 1;
      case "kill":
        return 2;
      case "none":
        return 3;
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
      repelDistance: this.repelDistance,
      repelStrength: this.repelStrength,
    });
  }

  descriptor(): ModuleDescriptor<"boundary", BoundaryBindingKeys> {
    return {
      name: "boundary",
      role: ModuleRole.Force,
      bindings: [
        "restitution",
        "friction",
        "mode",
        "repelDistance",
        "repelStrength",
      ] as const,
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
  let repelDist = ${getUniform("repelDistance")};
  let repelStrength = ${getUniform("repelStrength")};

  // Repel force applied for all modes
  if (repelStrength > 0.0) {
    let distLeft = (${particleVar}.position.x - halfSize) - minX;
    let distRight = maxX - (${particleVar}.position.x + halfSize);
    let distTop = (${particleVar}.position.y - halfSize) - minY;
    let distBottom = maxY - (${particleVar}.position.y + halfSize);

    var fx = 0.0;
    var fy = 0.0;
    if (repelDist <= 0.0) {
      if (distLeft < 0.0) { fx += repelStrength; }
      if (distRight < 0.0) { fx -= repelStrength; }
      if (distTop < 0.0) { fy += repelStrength; }
      if (distBottom < 0.0) { fy -= repelStrength; }
    } else {
      // Outside of bounds: apply full-strength push back in
      if (distLeft < 0.0) { fx += repelStrength; }
      if (distRight < 0.0) { fx -= repelStrength; }
      if (distTop < 0.0) { fy += repelStrength; }
      if (distBottom < 0.0) { fy -= repelStrength; }

      // Inside within repel distance: scale by proximity
      if (distLeft < repelDist && distLeft > 0.0) {
        let ratio = (repelDist - distLeft) / repelDist;
        fx += ratio * repelStrength;
      }
      if (distRight < repelDist && distRight > 0.0) {
        let ratio = (repelDist - distRight) / repelDist;
        fx -= ratio * repelStrength;
      }
      if (distTop < repelDist && distTop > 0.0) {
        let ratio = (repelDist - distTop) / repelDist;
        fy += ratio * repelStrength;
      }
      if (distBottom < repelDist && distBottom > 0.0) {
        let ratio = (repelDist - distBottom) / repelDist;
        fy -= ratio * repelStrength;
      }
    }
    ${particleVar}.acceleration += vec2<f32>(fx, fy);
  }

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
  } else if (mode == 3.0) {
    // none: no boundary constraints; repel force above still applies
  }
}`,
    };
  }
}
