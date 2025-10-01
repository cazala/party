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
      aIndexes = opts.lines.map(l => l.aIndex);
      bIndexes = opts.lines.map(l => l.bIndex);
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
  setLines(
    linesOrAIndexes: Line[] | number[],
    bIndexes?: number[]
  ): void {
    let aIndexes: number[], bIndexesArray: number[];
    
    // Check if first argument is Line[] or number[]
    if (bIndexes === undefined) {
      // First overload: Line[]
      const lines = linesOrAIndexes as Line[];
      aIndexes = lines.map(l => l.aIndex);
      bIndexesArray = lines.map(l => l.bIndex);
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
      if (existingB < existingA) [existingA, existingB] = [existingB, existingA];
      if (existingA === aIndex && existingB === bIndex) return;
    }
    
    // Add the line
    currentLines.push({ aIndex, bIndex });
    this.setLines(currentLines);
  }

  remove(aIndex: number, bIndex: number): void {
    const currentLines = this.getLines();
    
    // Normalize indices for comparison
    let searchA = aIndex, searchB = bIndex;
    if (searchB < searchA) [searchA, searchB] = [searchB, searchA];
    
    // Find and remove the line (works with flipped indices too)
    const filteredLines = currentLines.filter(line => {
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
          instanced: false,
          fragment: ({ getUniform, getLength, sampleScene }) => `{
  // Convert screen UV to world coordinates using render uniforms
  let screen_pos = uv * render_uniforms.canvas_size;
  let world_pos = vec2<f32>(
    (screen_pos.x - render_uniforms.canvas_size.x * 0.5) / render_uniforms.zoom + render_uniforms.camera_position.x,
    -(screen_pos.y - render_uniforms.canvas_size.y * 0.5) / render_uniforms.zoom + render_uniforms.camera_position.y
  );
  
  // Start with existing scene color
  var scene_color = ${sampleScene("uv")};
  
  let jointCount = ${getLength("aIndexes")};
  let lineWidth = ${getUniform("lineWidth")};
  
  if (jointCount > 0u && lineWidth > 0.0) {
    // Check each joint to see if this pixel should be part of a line
    for (var j = 0u; j < jointCount; j++) {
      let ia = u32(${getUniform("aIndexes", "j")});
      let ib = u32(${getUniform("bIndexes", "j")});
      
      // Get particle positions
      let pa = particles[ia];
      let pb = particles[ib];
      
      // Skip if either particle is removed
      if (pa.mass == 0.0 || pb.mass == 0.0) { continue; }
      
      // Calculate distance from point to line segment
      let line_vec = pb.position - pa.position;
      let line_len_sq = dot(line_vec, line_vec);
      
      if (line_len_sq < 1e-8) { continue; } // Skip zero-length lines
      
      let point_vec = world_pos - pa.position;
      let t = clamp(dot(point_vec, line_vec) / line_len_sq, 0.0, 1.0);
      let closest_point = pa.position + t * line_vec;
      let dist_to_line = distance(world_pos, closest_point);
      
      // Convert line width from screen space to world space
      let world_line_width = lineWidth / render_uniforms.zoom;
      
      if (dist_to_line <= world_line_width * 0.5) {
        // Use color of particle A for the line
        let line_alpha = 1.0 - smoothstep(0.0, world_line_width * 0.5, dist_to_line);
        let line_color = vec4<f32>(pa.color.rgb, pa.color.a * line_alpha);
        
        // Blend line color with existing scene
        scene_color = scene_color + line_color * (1.0 - scene_color.a);
        scene_color.a = min(1.0, scene_color.a + line_color.a);
      }
    }
  }
  
  return scene_color;
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
