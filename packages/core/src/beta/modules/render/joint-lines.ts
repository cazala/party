import {
  Module,
  ModuleRole,
  type WebGPUDescriptor,
  CPUDescriptor,
  DataType,
  RenderPassKind,
  CanvasComposition,
} from "../../module";

type JointLinesInputs = {
  aIndexes: number[];
  bIndexes: number[];
  lineWidth: number;
};

export class JointLines extends Module<"jointLines", JointLinesInputs> {
  readonly name = "jointLines" as const;
  readonly role = ModuleRole.Render;
  readonly inputs = {
    aIndexes: DataType.ARRAY,
    bIndexes: DataType.ARRAY,
    lineWidth: DataType.NUMBER,
  } as const;

  constructor(opts?: {
    enabled?: boolean;
    aIndexes?: number[];
    bIndexes?: number[];
    lineWidth?: number;
  }) {
    super();
    this.write({
      aIndexes: opts?.aIndexes ?? [],
      bIndexes: opts?.bIndexes ?? [],
      lineWidth: opts?.lineWidth ?? 1.5,
    });
    if (opts?.enabled !== undefined) this.setEnabled(!!opts.enabled);
  }

  setJoints(aIndexes: number[], bIndexes: number[]): void {
    this.write({ aIndexes, bIndexes });
  }

  setLineWidth(value: number): void {
    this.write({ lineWidth: value });
  }

  // For now, leave WebGPU rendering empty to keep type safety while force module is verified.
  webgpu(): WebGPUDescriptor<JointLinesInputs> {
    return {
      passes: [
        // Placeholder no-op compute pass that copies the scene
        {
          kind: RenderPassKind.Compute,
          kernel: ({ readScene, writeScene }) => `{
  let coords = vec2<i32>(i32(gid.x), i32(gid.y));
  ${writeScene("coords", `${readScene("coords")}`)};
`,
          bindings: [] as const,
          readsScene: true,
          writesScene: true,
        },
      ],
    };
  }

  cpu(): CPUDescriptor<JointLinesInputs> {
    return {
      composition: CanvasComposition.Additive,
      setup: ({ context, input, view, particles }) => {
        const a = (this.readArray("aIndexes") as number[]) || [];
        const b = (this.readArray("bIndexes") as number[]) || [];
        const lw = typeof input.lineWidth === "number" ? input.lineWidth : 1.5;

        const camera = view.getCamera();
        const zoom = view.getZoom();
        const size = view.getSize();
        const centerX = size.width / 2;
        const centerY = size.height / 2;

        context.save();
        context.lineWidth = lw;
        context.globalCompositeOperation = "source-over";
        const count = Math.min(a.length, b.length);
        for (let i = 0; i < count; i++) {
          const ia = a[i] >>> 0;
          const ib = b[i] >>> 0;
          const pa = particles[ia];
          const pb = particles[ib];
          if (!pa || !pb) continue;
          if (pa.mass === 0 || pb.mass === 0) continue; // skip removed
          // Screen-space coords
          const ax = centerX + (pa.position.x - camera.x) * zoom;
          const ay = centerY + (pa.position.y - camera.y) * zoom;
          const bx = centerX + (pb.position.x - camera.x) * zoom;
          const by = centerY + (pb.position.y - camera.y) * zoom;
          // Stroke color = color of particle A
          context.strokeStyle = `rgba(${pa.color.r * 255}, ${
            pa.color.g * 255
          }, ${pa.color.b * 255}, ${pa.color.a})`;
          context.beginPath();
          context.moveTo(ax, ay);
          context.lineTo(bx, by);
          context.stroke();
        }
        context.restore();
      },
    };
  }
}
