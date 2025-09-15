import { ComputeModule, type ComputeModuleDescriptor } from "../compute";

type TrailBindingKeys = "trailDecay" | "trailDiffuse";

export class Trails extends ComputeModule<"trails", TrailBindingKeys> {
  private trailDecay: number;
  private trailDiffuse: number;

  constructor(opts?: {
    enabled?: boolean;
    trailDecay?: number;
    trailDiffuse?: number;
  }) {
    super();
    this.trailDecay = opts?.trailDecay ?? 0.01;
    this.trailDiffuse = opts?.trailDiffuse ?? 0.0;

    if (opts?.enabled !== undefined) {
      this.setEnabled(!!opts.enabled);
    }
  }

  attachUniformWriter(
    writer: (values: Partial<Record<string, number>>) => void
  ): void {
    super.attachUniformWriter(writer);
    this.write({
      trailDecay: this.trailDecay,
      trailDiffuse: this.trailDiffuse,
    });
  }

  setTrailDecay(value: number): void {
    this.trailDecay = value;
    this.write({ trailDecay: value });
  }

  setTrailDiffuse(value: number): void {
    this.trailDiffuse = value;
    this.write({ trailDiffuse: value });
  }

  descriptor(): ComputeModuleDescriptor<"trails", TrailBindingKeys> {
    return {
      name: "trails",
      role: "force",
      bindings: ["trailDecay", "trailDiffuse"] as const,
    };
  }
}
