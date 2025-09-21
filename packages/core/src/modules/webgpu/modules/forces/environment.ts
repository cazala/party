/**
 * Environment (Force Module)
 *
 * Applies global influences: gravity (fixed/inwards/outwards/custom), inertia,
 * friction, and velocity damping. Gravity direction can be vector- or mode-driven,
 * with center computed from grid extents for inwards/outwards.
 */
import { Vector } from "../../vector";
import {
  Module,
  type WebGPUDescriptor,
  ModuleRole,
  CPUDescriptor,
} from "../../module";

export const DEFAULT_ENVIRONMENT_GRAVITY_STRENGTH = 0;
export const DEFAULT_ENVIRONMENT_GRAVITY_DIRECTION: GravityDirection = "down";
export const DEFAULT_ENVIRONMENT_GRAVITY_ANGLE = Math.PI / 2; // radians, default down
export const DEFAULT_ENVIRONMENT_INERTIA = 0;
export const DEFAULT_ENVIRONMENT_FRICTION = 0;
export const DEFAULT_ENVIRONMENT_DAMPING = 0;

type EnvBindingKeys =
  | "gravityStrength"
  | "dirX"
  | "dirY"
  | "inertia"
  | "friction"
  | "damping"
  | "mode";

export type GravityDirection =
  | "up"
  | "down"
  | "left"
  | "right"
  | "inwards"
  | "outwards"
  | "custom";

export class Environment extends Module<"environment", EnvBindingKeys> {
  private gravityDirection: GravityDirection = "down";
  private gravityAngle: number = Math.PI / 2; // radians, default down

  constructor(opts?: {
    gravityStrength?: number;
    dirX?: number;
    dirY?: number;
    inertia?: number;
    friction?: number;
    damping?: number;
    gravityDirection?: GravityDirection;
    gravityAngle?: number; // radians, only used when direction is custom
  }) {
    super();

    this.gravityDirection =
      opts?.gravityDirection ?? DEFAULT_ENVIRONMENT_GRAVITY_DIRECTION;
    this.gravityAngle = opts?.gravityAngle ?? DEFAULT_ENVIRONMENT_GRAVITY_ANGLE;

    // Initialize direction
    const initial = this.directionFromOptions(
      this.gravityDirection,
      this.gravityAngle,
      opts?.dirX,
      opts?.dirY
    );

    this.write({
      gravityStrength:
        opts?.gravityStrength ?? DEFAULT_ENVIRONMENT_GRAVITY_STRENGTH,
      dirX: initial.x,
      dirY: initial.y,
      inertia: opts?.inertia ?? DEFAULT_ENVIRONMENT_INERTIA,
      friction: opts?.friction ?? DEFAULT_ENVIRONMENT_FRICTION,
      damping: opts?.damping ?? DEFAULT_ENVIRONMENT_DAMPING,
      mode:
        this.gravityDirection === "inwards"
          ? 1
          : this.gravityDirection === "outwards"
          ? 2
          : 0,
    });
  }

  private directionFromOptions(
    dir: GravityDirection,
    angleRad: number,
    dirXOverride?: number,
    dirYOverride?: number
  ): { x: number; y: number } {
    // If explicit vector provided, use it
    if (dirXOverride !== undefined || dirYOverride !== undefined) {
      return { x: dirXOverride ?? 0, y: dirYOverride ?? 0 };
    }
    switch (dir) {
      case "up":
        return { x: 0, y: -1 };
      case "down":
        return { x: 0, y: 1 };
      case "left":
        return { x: -1, y: 0 };
      case "right":
        return { x: 1, y: 0 };
      case "inwards":
        // Approximate as downward for now (screen space inward not available here)
        return { x: 0, y: 1 };
      case "outwards":
        // Approximate as upward for now
        return { x: 0, y: -1 };
      case "custom":
      default: {
        const x = Math.cos(angleRad);
        const y = Math.sin(angleRad);
        return { x, y };
      }
    }
  }

  setGravityStrength(value: number): void {
    this.write({ gravityStrength: value });
  }
  setDirection(x: number, y: number): void {
    this.write({ dirX: x, dirY: y });
  }
  setGravityDirection(direction: GravityDirection): void {
    this.gravityDirection = direction;
    const v = this.directionFromOptions(
      this.gravityDirection,
      this.gravityAngle
    );
    this.setDirection(v.x, v.y);
    this.write({
      mode: direction === "inwards" ? 1 : direction === "outwards" ? 2 : 0,
    });
  }
  setGravityAngle(angleRadians: number): void {
    this.gravityAngle = angleRadians;
    if (this.gravityDirection === "custom") {
      const v = this.directionFromOptions("custom", this.gravityAngle);
      this.setDirection(v.x, v.y);
    }
  }
  setInertia(value: number): void {
    this.write({ inertia: value });
  }
  setFriction(value: number): void {
    this.write({ friction: value });
  }
  setDamping(value: number): void {
    this.write({ damping: value });
  }

  getGravityStrength(): number {
    return this.readValue("gravityStrength");
  }
  getDirX(): number {
    return this.readValue("dirX");
  }
  getDirY(): number {
    return this.readValue("dirY");
  }
  getInertia(): number {
    return this.readValue("inertia");
  }
  getFriction(): number {
    return this.readValue("friction");
  }
  getDamping(): number {
    return this.readValue("damping");
  }
  getMode(): number {
    return this.readValue("mode");
  }

  webgpu(): WebGPUDescriptor<"environment", EnvBindingKeys> {
    return {
      name: "environment",
      role: ModuleRole.Force,
      keys: [
        "gravityStrength",
        "dirX",
        "dirY",
        "inertia",
        "friction",
        "damping",
        "mode",
      ] as const,
      apply: ({ particleVar, dtVar, getUniform }) => `
  // Gravity as force: acceleration += dir * strength
  let mode = ${getUniform("mode")};
  var gdir = vec2<f32>(${getUniform("dirX")}, ${getUniform("dirY")});
  if (mode == 1.0) {
    let cx = (GRID_MINX() + GRID_MAXX()) * 0.5;
    let cy = (GRID_MINY() + GRID_MAXY()) * 0.5;
    gdir = vec2<f32>(cx, cy) - ${particleVar}.position;
  } else if (mode == 2.0) {
    let cx = (GRID_MINX() + GRID_MAXX()) * 0.5;
    let cy = (GRID_MINY() + GRID_MAXY()) * 0.5;
    gdir = ${particleVar}.position - vec2<f32>(cx, cy);
  }
  let glen = length(gdir);
  if (glen > 0.0) {
    ${particleVar}.acceleration += (gdir / glen) * ${getUniform(
        "gravityStrength"
      )};
  }

  // Inertia: acceleration += velocity * dt * inertia
  let inertia = ${getUniform("inertia")};
  if (inertia > 0.0) {
    ${particleVar}.acceleration += ${particleVar}.velocity * (${dtVar}) * inertia;
  }

  // Friction: acceleration += -velocity * friction
  let friction = ${getUniform("friction")};
  if (friction > 0.0) {
    ${particleVar}.acceleration += -${particleVar}.velocity * friction;
  }

  // Damping: directly scale velocity (post-force effect in CPU code)
  let damping = ${getUniform("damping")};
  if (damping != 0.0) {
    ${particleVar}.velocity *= (1.0 - damping * 0.2);
  }
`,
    };
  }

  cpu(): CPUDescriptor<"environment", EnvBindingKeys> {
    return {
      name: "environment",
      role: ModuleRole.Force,
      keys: [
        "gravityStrength",
        "dirX",
        "dirY",
        "inertia",
        "friction",
        "damping",
        "mode",
      ] as const,

      apply: ({ particle, dt, input, getNeighbors, view }) => {
        const gdir = new Vector(input.dirX, input.dirY);
        const size = view.getSize();
        if (input.mode === 1) {
          const cx = size.width / 2;
          const cy = size.height / 2;
          gdir.set(cx, cy).subtract(particle.position);
        } else if (input.mode === 2) {
          const cx = size.width / 2;
          const cy = size.height / 2;
          gdir.set(particle.position.x - cx, particle.position.y - cy);
        }
        const glen = gdir.magnitude();
        if (glen > 0) {
          const gravityForce = gdir.clone().divide(glen).multiply(input.gravityStrength);
          particle.acceleration.add(gravityForce);
        }

        // Inertia: acceleration += velocity * dt * inertia
        const inertia = input.inertia;
        if (inertia > 0) {
          const inertiaForce = particle.velocity.clone().multiply(dt * inertia);
          particle.acceleration.add(inertiaForce);
        }

        // Friction: acceleration += -velocity * friction
        const friction = input.friction;
        if (friction > 0) {
          const frictionForce = particle.velocity.clone().multiply(-friction);
          particle.acceleration.add(frictionForce);
        }

        // Damping: directly scale velocity (post-force effect in CPU code)
        const damping = input.damping;
        if (damping !== 0) {
          particle.velocity.multiply(1 - damping * 0.2);
        }
      },
    };
  }
}
