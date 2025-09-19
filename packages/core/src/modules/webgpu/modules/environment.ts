import { Module, type ModuleDescriptor, ModuleRole } from "../module";

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
  private gravityStrength: number;
  private dirX: number;
  private dirY: number;
  private inertia: number;
  private friction: number;
  private damping: number;
  private gravityDirection: GravityDirection = "down";
  private gravityAngle: number = Math.PI / 2; // radians, default down
  private mode: number = 0; // 0 fixed, 1 inwards, 2 outwards

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
    this.gravityStrength =
      opts?.gravityStrength ?? DEFAULT_ENVIRONMENT_GRAVITY_STRENGTH;
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
    this.mode =
      this.gravityDirection === "inwards"
        ? 1
        : this.gravityDirection === "outwards"
        ? 2
        : 0;
    this.dirX = initial.x;
    this.dirY = initial.y;
    this.inertia = opts?.inertia ?? DEFAULT_ENVIRONMENT_INERTIA;
    this.friction = opts?.friction ?? DEFAULT_ENVIRONMENT_FRICTION;
    this.damping = opts?.damping ?? DEFAULT_ENVIRONMENT_DAMPING;
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

  attachUniformWriter(
    writer: (values: Partial<Record<string, number>>) => void
  ): void {
    super.attachUniformWriter(writer);
    this.write({
      gravityStrength: this.gravityStrength,
      dirX: this.dirX,
      dirY: this.dirY,
      inertia: this.inertia,
      friction: this.friction,
      damping: this.damping,
      mode: this.mode,
    });
  }

  setGravityStrength(value: number): void {
    this.gravityStrength = value;
    this.write({ gravityStrength: value });
  }
  setDirection(x: number, y: number): void {
    this.dirX = x;
    this.dirY = y;
    this.write({ dirX: x, dirY: y });
  }
  setGravityDirection(direction: GravityDirection): void {
    this.gravityDirection = direction;
    this.mode = direction === "inwards" ? 1 : direction === "outwards" ? 2 : 0;
    const v = this.directionFromOptions(
      this.gravityDirection,
      this.gravityAngle
    );
    this.setDirection(v.x, v.y);
    this.write({ mode: this.mode });
  }
  setGravityAngle(angleRadians: number): void {
    this.gravityAngle = angleRadians;
    if (this.gravityDirection === "custom") {
      const v = this.directionFromOptions("custom", this.gravityAngle);
      this.setDirection(v.x, v.y);
    }
  }
  setInertia(value: number): void {
    this.inertia = value;
    this.write({ inertia: value });
  }
  setFriction(value: number): void {
    this.friction = value;
    this.write({ friction: value });
  }
  setDamping(value: number): void {
    this.damping = value;
    this.write({ damping: value });
  }

  descriptor(): ModuleDescriptor<"environment", EnvBindingKeys> {
    return {
      name: "environment",
      role: ModuleRole.Force,
      bindings: [
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
}
