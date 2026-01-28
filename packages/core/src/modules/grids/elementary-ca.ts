import {
  Module,
  ModuleRole,
  DataType,
  type CPUDescriptor,
  type WebGPUDescriptor,
  RenderPassKind,
  CanvasComposition,
  type GridSpec,
} from "../../module";

export type ElementaryCAInputs = {
  rule: number;
};

export const DEFAULT_ECA_RULE = 30;

export type ElementaryCAOptions = {
  width: number;
  height: number;
  rule?: number;
};

export class ElementaryCAGrid extends Module<"elementaryCA", ElementaryCAInputs> {
  readonly name = "elementaryCA" as const;
  readonly role = ModuleRole.Grid;
  readonly inputs = {
    rule: DataType.NUMBER,
  } as const;
  readonly gridSpec: GridSpec;
  private renderCanvas?: HTMLCanvasElement;
  private renderCtx?: CanvasRenderingContext2D;
  private imageData?: ImageData;

  constructor(options: ElementaryCAOptions) {
    super();
    this.gridSpec = {
      width: options.width,
      height: options.height,
      format: "u8",
      wrap: "clamp",
    };
    this.write({
      rule: options.rule ?? DEFAULT_ECA_RULE,
    });
  }

  cpu(): CPUDescriptor<ElementaryCAInputs> {
    return {
      init: ({ grid }) => {
        const width = grid.width;
        const height = grid.height;
        for (let y = 0; y < height; y++) {
          for (let x = 0; x < width; x++) {
            const idx = y * width + x;
            (grid.writeBuffer as any)[idx] = 0;
          }
        }
        const mid = Math.floor(width / 2);
        (grid.writeBuffer as any)[mid] = 1;
      },
      step: ({ grid, input }) => {
        const width = grid.width;
        const height = grid.height;
        const rule = Math.max(0, Math.min(128, Math.floor(input.rule)));

        for (let y = 0; y < height; y++) {
          for (let x = 0; x < width; x++) {
            if (y === 0) {
              const left = grid.read(x - 1, 0, 0) > 0 ? 1 : 0;
              const center = grid.read(x, 0, 0) > 0 ? 1 : 0;
              const right = grid.read(x + 1, 0, 0) > 0 ? 1 : 0;
              const idx = (left << 2) | (center << 1) | right;
              const bit = (rule >> idx) & 1;
              (grid.writeBuffer as any)[x] = bit;
            } else {
              const above = grid.read(x, y - 1, 0) > 0 ? 1 : 0;
              (grid.writeBuffer as any)[y * width + x] = above;
            }
          }
        }
      },
      render: {
        composition: CanvasComposition.HandlesBackground,
        setup: ({ context, grid }) => {
          if (!grid) return;
          if (!this.renderCanvas) {
            this.renderCanvas = document.createElement("canvas");
            this.renderCtx = this.renderCanvas.getContext("2d")!;
          }
          if (
            this.renderCanvas.width !== grid.width ||
            this.renderCanvas.height !== grid.height
          ) {
            this.renderCanvas.width = grid.width;
            this.renderCanvas.height = grid.height;
            this.imageData = this.renderCtx!.createImageData(
              grid.width,
              grid.height
            );
          }
          if (!this.imageData) return;
          const data = this.imageData.data;
          const buf = grid.readBuffer as any;
          const total = grid.width * grid.height;
          for (let i = 0; i < total; i++) {
            const v = buf[i] > 0 ? 255 : 0;
            const idx = i * 4;
            data[idx + 0] = v;
            data[idx + 1] = v;
            data[idx + 2] = v;
            data[idx + 3] = 255;
          }
          this.renderCtx!.putImageData(this.imageData, 0, 0);
          context.drawImage(
            this.renderCanvas,
            0,
            0,
            context.canvas.width,
            context.canvas.height
          );
        },
      },
    };
  }

  webgpu(): WebGPUDescriptor<ElementaryCAInputs> {
    return {
      init: ({ cellCoordVar, widthVar }) => {
        return `
let x = i32(${cellCoordVar}.x);
let y = i32(${cellCoordVar}.y);
let mid = i32(${widthVar} / 2u);
let v = select(0.0, 1.0, y == 0 && x == mid);
grid_write(x, y, 0u, v);
`;
      },
      step: ({ getUniform, cellCoordVar }) => {
        return `
let x = i32(${cellCoordVar}.x);
let y = i32(${cellCoordVar}.y);
let rule = u32(${getUniform("rule")});
if (y == 0) {
  let left = grid_read(x - 1, 0, 0u) > 0.5;
  let center = grid_read(x, 0, 0u) > 0.5;
  let right = grid_read(x + 1, 0, 0u) > 0.5;
  let idx = (u32(left) << 2u) | (u32(center) << 1u) | u32(right);
  let bit = (rule >> idx) & 1u;
  grid_write(x, 0, 0u, f32(bit));
} else {
  let above = grid_read(x, y - 1, 0u);
  grid_write(x, y, 0u, above);
}
`;
      },
      render: {
        passes: [
          {
            kind: RenderPassKind.Fullscreen,
            bindings: [],
            fragment: () => `{
  let gx = i32(floor(frag_coord.x / render_uniforms.canvas_size.x * f32(GRID_WIDTH)));
  let gy = i32(floor(frag_coord.y / render_uniforms.canvas_size.y * f32(GRID_HEIGHT)));
  let v = grid_read(gx, gy, 0u);
  return vec4<f32>(v, v, v, 1.0);
}`,
          },
        ],
      },
    } as WebGPUDescriptor<ElementaryCAInputs>;
  }
}
