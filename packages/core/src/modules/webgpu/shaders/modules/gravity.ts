import { ComputeModule, type ComputeModuleDescriptor } from "../compute";

export class Gravity extends ComputeModule<
  "gravity",
  "strength" | "dirX" | "dirY"
> {
  private strength: number;
  private dirX: number;
  private dirY: number;

  constructor(opts?: { strength?: number; dirX?: number; dirY?: number }) {
    super();
    this.strength = opts?.strength ?? 0;
    this.dirX = opts?.dirX ?? 0;
    this.dirY = opts?.dirY ?? 1;
  }

  // Seed initial uniforms when attached
  attachUniformWriter(
    writer: (values: Partial<Record<string, number>>) => void
  ): void {
    super.attachUniformWriter(writer);
    this.write(this.values());
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

  descriptor(): ComputeModuleDescriptor<
    "gravity",
    "strength" | "dirX" | "dirY"
  > {
    return {
      name: "gravity",
      role: "force",
      bindings: ["strength", "dirX", "dirY"] as const,
      apply: ({ particleVar, getUniform }) => `{
  let gravity_dir = vec2<f32>(${getUniform("dirX")}, ${getUniform("dirY")});
  let gravity = gravity_dir * ${getUniform("strength")};
  ${particleVar}.velocity += gravity;
}`,
    };
  }

  values(): Record<string, number> {
    return { strength: this.strength, dirX: this.dirX, dirY: this.dirY };
  }
}
