import type { ComputeModuleDescriptor } from "../compute";

export class Gravity {
  private strength: number;
  private dirX: number;
  private dirY: number;
  private onChange: ((values: Record<string, number>) => void) | null = null;

  constructor(opts?: { strength?: number; dirX?: number; dirY?: number }) {
    this.strength = opts?.strength ?? 0;
    this.dirX = opts?.dirX ?? 0;
    this.dirY = opts?.dirY ?? 1;
  }

  setStrength(value: number): void {
    this.strength = value;
    this.onChange?.(this.values());
  }
  setDirection(x: number, y: number): void {
    this.dirX = x;
    this.dirY = y;
    this.onChange?.(this.values());
  }

  subscribe(onChange: (values: Record<string, number>) => void): void {
    this.onChange = onChange;
  }

  descriptor(): ComputeModuleDescriptor {
    return {
      name: "gravity",
      role: "force",
      bindings: ["strength", "dirX", "dirY"],
      apply: ({ particleVar, dtVar, getUniform }) => `{
  let gravity_dir = vec2<f32>(${getUniform("dirX")}, ${getUniform("dirY")});
  let gravity = gravity_dir * ${getUniform("strength")};
  ${particleVar}.velocity += gravity * ${dtVar};
}`,
    };
  }

  values(): Record<string, number> {
    return { strength: this.strength, dirX: this.dirX, dirY: this.dirY };
  }
}
