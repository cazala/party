/**
 * Boundary (Force Module)
 *
 * Enforces world bounds using the grid extents. Modes:
 * - bounce: reflect with restitution and tangential friction
 * - warp: wrap to the opposite side once fully outside
 * - kill: set mass=0 to cull particle when fully outside
 * - none: no constraint (repel still optional)
 * Supports optional repel force near edges.
 */
import {
  Module,
  type WebGPUDescriptor,
  ModuleRole,
  CPUDescriptor,
} from "../../module";
import { Vector } from "../../vector";
type BoundaryInputKeys =
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

export class Boundary extends Module<"boundary", BoundaryInputKeys> {
  readonly name = "boundary" as const;
  readonly role = ModuleRole.Force;
  readonly keys = [
    "restitution",
    "friction",
    "mode",
    "repelDistance",
    "repelStrength",
  ] as const;

  constructor(opts?: {
    restitution?: number;
    friction?: number;
    mode?: BoundaryMode;
    repelDistance?: number;
    repelStrength?: number;
  }) {
    super();
    const mode = opts?.mode ?? DEFAULT_BOUNDARY_MODE;
    this.write({
      restitution: opts?.restitution ?? DEFAULT_BOUNDARY_RESTITUTION,
      friction: opts?.friction ?? DEFAULT_BOUNDARY_FRICTION,
      mode: this.modeToUniform(mode),
      repelDistance: opts?.repelDistance ?? DEFAULT_BOUNDARY_REPEL_DISTANCE,
      repelStrength: opts?.repelStrength ?? DEFAULT_BOUNDARY_REPEL_STRENGTH,
    });
  }

  setRestitution(value: number): void {
    this.write({ restitution: value });
  }

  setFriction(value: number): void {
    this.write({ friction: value });
  }

  setMode(mode: BoundaryMode): void {
    this.write({ mode: this.modeToUniform(mode) });
  }

  setRepelDistance(value: number): void {
    this.write({ repelDistance: value });
  }

  setRepelStrength(value: number): void {
    this.write({ repelStrength: value });
  }

  getRestitution(): number {
    return this.readValue("restitution");
  }
  getFriction(): number {
    return this.readValue("friction");
  }
  getMode(): number {
    return this.readValue("mode");
  }
  getRepelDistance(): number {
    return this.readValue("repelDistance");
  }
  getRepelStrength(): number {
    return this.readValue("repelStrength");
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

  webgpu(): WebGPUDescriptor<BoundaryInputKeys> {
    return {
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

  cpu(): CPUDescriptor<BoundaryInputKeys> {
    return {
      apply: ({ particle, input, view }) => {
        // Calculate world bounds similar to WebGPU grid system
        const camera = view.getCamera();
        const zoom = Math.max(view.getZoom(), 0.0001);
        const size = view.getSize();
        const halfW = size.width / (2 * zoom);
        const halfH = size.height / (2 * zoom);
        const minX = camera.x - halfW;
        const maxX = camera.x + halfW;
        const minY = camera.y - halfH;
        const maxY = camera.y + halfH;
        const halfSize = particle.size;
        const bounce = input.restitution;
        const friction = input.friction;
        const mode = input.mode;
        const repelDist = input.repelDistance;
        const repelStrength = input.repelStrength;

        // Repel force applied for all modes
        if (repelStrength > 0) {
          const distLeft = particle.position.x - halfSize - minX;
          const distRight = maxX - (particle.position.x + halfSize);
          const distTop = particle.position.y - halfSize - minY;
          const distBottom = maxY - (particle.position.y + halfSize);

          let fx = 0;
          let fy = 0;

          if (repelDist <= 0) {
            if (distLeft < 0) fx += repelStrength;
            if (distRight < 0) fx -= repelStrength;
            if (distTop < 0) fy += repelStrength;
            if (distBottom < 0) fy -= repelStrength;
          } else {
            // Outside of bounds: apply full-strength push back in
            if (distLeft < 0) fx += repelStrength;
            if (distRight < 0) fx -= repelStrength;
            if (distTop < 0) fy += repelStrength;
            if (distBottom < 0) fy -= repelStrength;

            // Inside within repel distance: scale by proximity
            if (distLeft < repelDist && distLeft > 0) {
              const ratio = (repelDist - distLeft) / repelDist;
              fx += ratio * repelStrength;
            }
            if (distRight < repelDist && distRight > 0) {
              const ratio = (repelDist - distRight) / repelDist;
              fx -= ratio * repelStrength;
            }
            if (distTop < repelDist && distTop > 0) {
              const ratio = (repelDist - distTop) / repelDist;
              fy += ratio * repelStrength;
            }
            if (distBottom < repelDist && distBottom > 0) {
              const ratio = (repelDist - distBottom) / repelDist;
              fy -= ratio * repelStrength;
            }
          }

          particle.acceleration.add(new Vector(fx, fy));
        }

        if (mode === 0) {
          // bounce
          // X axis
          if (particle.position.x - halfSize < minX) {
            particle.position.x = minX + halfSize;
            particle.velocity.x = -particle.velocity.x * bounce;
            particle.velocity.y *= Math.max(0, 1 - friction);
          } else if (particle.position.x + halfSize > maxX) {
            particle.position.x = maxX - halfSize;
            particle.velocity.x = -particle.velocity.x * bounce;
            particle.velocity.y *= Math.max(0, 1 - friction);
          }

          // Y axis
          if (particle.position.y - halfSize < minY) {
            particle.position.y = minY + halfSize;
            particle.velocity.y = -particle.velocity.y * bounce;
            particle.velocity.x *= Math.max(0, 1 - friction);
          } else if (particle.position.y + halfSize > maxY) {
            particle.position.y = maxY - halfSize;
            particle.velocity.y = -particle.velocity.y * bounce;
            particle.velocity.x *= Math.max(0, 1 - friction);
          }
        } else if (mode === 1) {
          // warp
          // Only warp once the particle is fully outside the bounds
          const eps = 1; // spawn just outside the opposite edge so it slides in
          if (particle.position.x + halfSize < minX) {
            particle.position.x = maxX + halfSize + eps;
          } else if (particle.position.x - halfSize > maxX) {
            particle.position.x = minX - halfSize - eps;
          }
          if (particle.position.y + halfSize < minY) {
            particle.position.y = maxY + halfSize + eps;
          } else if (particle.position.y - halfSize > maxY) {
            particle.position.y = minY - halfSize - eps;
          }
        } else if (mode === 2) {
          // kill
          // Only kill once the particle is fully outside the bounds
          if (
            particle.position.x + halfSize < minX ||
            particle.position.x - halfSize > maxX ||
            particle.position.y + halfSize < minY ||
            particle.position.y - halfSize > maxY
          ) {
            particle.mass = 0;
          }
        } else if (mode === 3) {
          // none: no boundary constraints; repel force above still applies
        }
      },
    };
  }
}
