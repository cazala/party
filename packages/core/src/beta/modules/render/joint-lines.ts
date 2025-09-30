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

  webgpu(): WebGPUDescriptor<JointLinesInputs> {
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
