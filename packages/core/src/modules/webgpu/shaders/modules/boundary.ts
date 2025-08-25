import { ComputeModule, type ComputeModuleDescriptor } from "../compute";

type BoundaryKeys = "minX" | "minY" | "maxX" | "maxY" | "restitution";

export class Boundary extends ComputeModule<"boundary", BoundaryKeys> {
  private minX: number;
  private minY: number;
  private maxX: number;
  private maxY: number;
  private restitution: number;

  constructor(opts?: {
    minX?: number;
    minY?: number;
    maxX?: number;
    maxY?: number;
    restitution?: number;
  }) {
    super();
    this.minX = opts?.minX ?? -400;
    this.minY = opts?.minY ?? -300;
    this.maxX = opts?.maxX ?? 400;
    this.maxY = opts?.maxY ?? 300;
    this.restitution = opts?.restitution ?? 0.9;
  }

  setBounds(minX: number, minY: number, maxX: number, maxY: number): void {
    this.minX = minX;
    this.minY = minY;
    this.maxX = maxX;
    this.maxY = maxY;
    this.write({ minX, minY, maxX, maxY });
  }

  setRestitution(value: number): void {
    this.restitution = value;
    this.write({ restitution: value });
  }

  attachUniformWriter(
    writer: (values: Partial<Record<string, number>>) => void
  ): void {
    super.attachUniformWriter(writer);
    this.write({
      minX: this.minX,
      minY: this.minY,
      maxX: this.maxX,
      maxY: this.maxY,
      restitution: this.restitution,
    });
  }

  descriptor(): ComputeModuleDescriptor<"boundary", BoundaryKeys> {
    return {
      name: "boundary",
      role: "force",
      bindings: ["minX", "minY", "maxX", "maxY", "restitution"] as const,
      apply: ({ particleVar, getUniform }) => `{
  // Bounce on X
  let halfSize = ${particleVar}.size;
  let minX = ${getUniform("minX")};
  let maxX = ${getUniform("maxX")};
  let bounce = ${getUniform("restitution")};
  if (${particleVar}.position.x - halfSize < minX) {
    ${particleVar}.position.x = minX + halfSize;
    ${particleVar}.velocity.x = abs(${particleVar}.velocity.x) * bounce;
  } else if (${particleVar}.position.x + halfSize > maxX) {
    ${particleVar}.position.x = maxX - halfSize;
    ${particleVar}.velocity.x = -abs(${particleVar}.velocity.x) * bounce;
  }

  // Bounce on Y
  let minY = ${getUniform("minY")};
  let maxY = ${getUniform("maxY")};
  if (${particleVar}.position.y - halfSize < minY) {
    ${particleVar}.position.y = minY + halfSize;
    ${particleVar}.velocity.y = abs(${particleVar}.velocity.y) * bounce;
  } else if (${particleVar}.position.y + halfSize > maxY) {
    ${particleVar}.position.y = maxY - halfSize;
    ${particleVar}.velocity.y = -abs(${particleVar}.velocity.y) * bounce;
  }
}`,
    };
  }
}
