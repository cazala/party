import {
  Module,
  ModuleRole,
  type WebGPUDescriptor,
  CPUDescriptor,
  DataType,
  RenderPassKind,
  CanvasComposition,
} from "../../module";

export interface Line {
  aIndex: number;
  bIndex: number;
}

type LinesInputs = {
  aIndexes: number[];
  bIndexes: number[];
  lineWidth: number;
};

export class Lines extends Module<"lines", LinesInputs> {
  readonly name = "lines" as const;
  readonly role = ModuleRole.Render;
  readonly inputs = {
    aIndexes: DataType.ARRAY,
    bIndexes: DataType.ARRAY,
    lineWidth: DataType.NUMBER,
  } as const;

  constructor(opts?: {
    enabled?: boolean;
    lines?: Line[];
    aIndexes?: number[];
    bIndexes?: number[];
    lineWidth?: number;
  }) {
    super();

    // Handle lines array if provided, otherwise use separate arrays
    let aIndexes: number[], bIndexes: number[];
    if (opts?.lines) {
      aIndexes = opts.lines.map((l) => l.aIndex);
      bIndexes = opts.lines.map((l) => l.bIndex);
    } else {
      aIndexes = opts?.aIndexes ?? [];
      bIndexes = opts?.bIndexes ?? [];
    }

    this.write({
      aIndexes,
      bIndexes,
      lineWidth: opts?.lineWidth ?? 1.5,
    });
    if (opts?.enabled !== undefined) this.setEnabled(!!opts.enabled);
  }

  getLines(): Line[] {
    const aIndexes = this.readArray("aIndexes") as number[];
    const bIndexes = this.readArray("bIndexes") as number[];

    const lines: Line[] = [];
    const length = Math.min(aIndexes.length, bIndexes.length);
    for (let i = 0; i < length; i++) {
      lines.push({
        aIndex: aIndexes[i],
        bIndex: bIndexes[i],
      });
    }
    return lines;
  }

  setLines(lines: Line[]): void;
  setLines(aIndexes: number[], bIndexes: number[]): void;
  setLines(linesOrAIndexes: Line[] | number[], bIndexes?: number[]): void {
    let aIndexes: number[], bIndexesArray: number[];

    // Check if first argument is Line[] or number[]
    if (bIndexes === undefined) {
      // First overload: Line[]
      const lines = linesOrAIndexes as Line[];
      aIndexes = lines.map((l) => l.aIndex);
      bIndexesArray = lines.map((l) => l.bIndex);
    } else {
      // Second overload: separate arrays
      aIndexes = linesOrAIndexes as number[];
      bIndexesArray = bIndexes;
    }

    this.write({ aIndexes, bIndexes: bIndexesArray });
  }

  setLineWidth(value: number): void {
    this.write({ lineWidth: value });
  }

  add(line: Line): void {
    const currentLines = this.getLines();

    // Normalize line (ensure aIndex <= bIndex) and dedupe
    let { aIndex, bIndex } = line;
    if (aIndex === bIndex) return; // Skip self-lines
    if (bIndex < aIndex) [aIndex, bIndex] = [bIndex, aIndex];

    // Check for duplicates
    for (const existing of currentLines) {
      let { aIndex: existingA, bIndex: existingB } = existing;
      if (existingB < existingA)
        [existingA, existingB] = [existingB, existingA];
      if (existingA === aIndex && existingB === bIndex) return;
    }

    // Add the line
    currentLines.push({ aIndex, bIndex });
    this.setLines(currentLines);
  }

  remove(aIndex: number, bIndex: number): void {
    const currentLines = this.getLines();

    // Normalize indices for comparison
    let searchA = aIndex,
      searchB = bIndex;
    if (searchB < searchA) [searchA, searchB] = [searchB, searchA];

    // Find and remove the line (works with flipped indices too)
    const filteredLines = currentLines.filter((line) => {
      let { aIndex: lineA, bIndex: lineB } = line;
      if (lineB < lineA) [lineA, lineB] = [lineB, lineA];
      return !(lineA === searchA && lineB === searchB);
    });

    this.setLines(filteredLines);
  }

  removeAll(): void {
    this.setLines([]);
  }

  webgpu(): WebGPUDescriptor<LinesInputs> {
    return {
      passes: [
        {
          kind: RenderPassKind.Fullscreen,
          instanced: true,
          instanceFrom: "aIndexes",
          // Vertex: position quad in NDC for a line instance, minimal work in fragment
          vertex: ({ getUniform }) => `{
  let ia = u32(${getUniform("aIndexes", "instance_index")});
  let ib = u32(${getUniform("bIndexes", "instance_index")});
  let pa = particles[ia];
  let pb = particles[ib];
  // Cull if either endpoint is removed (mass == 0)
  if (pa.mass == 0.0 || pb.mass == 0.0) {
    out.position = vec4<f32>(2.0, 2.0, 1.0, 1.0);
  } else {
    let a = (pa.position - render_uniforms.camera_position) * render_uniforms.zoom;
    let b = (pb.position - render_uniforms.camera_position) * render_uniforms.zoom;
    let lw = max(1.0, ${getUniform("lineWidth")});
    let dir = normalize(b - a + vec2<f32>(1e-6, 0.0));
    let n = vec2<f32>(-dir.y, dir.x);
    let halfW = (lw * 0.5);
    let ax = (a.x * 2.0) / render_uniforms.canvas_size.x;
    let ay = (-a.y * 2.0) / render_uniforms.canvas_size.y;
    let bx = (b.x * 2.0) / render_uniforms.canvas_size.x;
    let by = (-b.y * 2.0) / render_uniforms.canvas_size.y;
    let nx = (n.x * halfW * 2.0) / render_uniforms.canvas_size.x;
    let ny = (-n.y * halfW * 2.0) / render_uniforms.canvas_size.y;
    let quad = array<vec2<f32>,4>(
      vec2<f32>(ax - nx, ay - ny),
      vec2<f32>(bx - nx, by - ny),
      vec2<f32>(ax + nx, ay + ny),
      vec2<f32>(bx + nx, by + ny)
    );
    // Pass color from particle A
    out.color = pa.color;
    out.position = vec4<f32>(quad[li], 0.0, 1.0);
  }
}`,
          fragment: ({ sampleScene }) => `{
  // Simple overwrite blend with alpha compositing
  var dst = ${sampleScene("uv")};
  let src = color;
  let outc = dst + src * (1.0 - dst.a);
  return vec4<f32>(outc.rgb, min(1.0, outc.a));
}`,
          bindings: ["lineWidth"] as const,
          readsScene: true,
          writesScene: true,
        },
      ],
    };
  }

  cpu(): CPUDescriptor<LinesInputs> {
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
