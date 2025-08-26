import { ComputeModule, type ComputeModuleDescriptor } from "../compute";

type EnvKeys =
  | "strength"
  | "dirX"
  | "dirY"
  | "inertia"
  | "friction"
  | "damping";

export class Environment extends ComputeModule<"environment", EnvKeys> {
  private strength: number;
  private dirX: number;
  private dirY: number;
  private inertia: number;
  private friction: number;
  private damping: number;

  constructor(opts?: {
    strength?: number;
    dirX?: number;
    dirY?: number;
    inertia?: number;
    friction?: number;
    damping?: number;
  }) {
    super();
    this.strength = opts?.strength ?? 0;
    this.dirX = opts?.dirX ?? 0;
    this.dirY = opts?.dirY ?? 1;
    this.inertia = opts?.inertia ?? 0;
    this.friction = opts?.friction ?? 0;
    this.damping = opts?.damping ?? 0;
  }

  attachUniformWriter(
    writer: (values: Partial<Record<string, number>>) => void
  ): void {
    super.attachUniformWriter(writer);
    this.write({
      strength: this.strength,
      dirX: this.dirX,
      dirY: this.dirY,
      inertia: this.inertia,
      friction: this.friction,
      damping: this.damping,
    });
  }

  setStrength(value: number): void {
    this.strength = value;
    this.write({ strength: value });
  }
  setDirection(x: number, y: number): void {
    this.dirX = x;
    this.dirY = y;
    this.write({ dirX: x, dirY: y });
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

  descriptor(): ComputeModuleDescriptor<"environment", EnvKeys> {
    return {
      name: "environment",
      role: "force",
      bindings: [
        "strength",
        "dirX",
        "dirY",
        "inertia",
        "friction",
        "damping",
      ] as const,
      apply: ({ particleVar, dtVar, getUniform }) => `{
  // Gravity as force: acceleration += dir * strength
  let gdir = vec2<f32>(${getUniform("dirX")}, ${getUniform("dirY")});
  ${particleVar}.acceleration += normalize(gdir) * ${getUniform("strength")};

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
}`,
    };
  }
}
