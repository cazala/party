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
import type { IParticle } from "../../interfaces";
import type { ViewSnapshot } from "../../view";

export type ReactionDiffusionInputs = {
  feed: number;
  kill: number;
  diffusionA: number;
  diffusionB: number;
  dt: number;
  cellSize: number;
};

export const DEFAULT_RD_FEED = 0.0367;
export const DEFAULT_RD_KILL = 0.0649;
export const DEFAULT_RD_DIFFUSION_A = 1.0;
export const DEFAULT_RD_DIFFUSION_B = 0.5;
export const DEFAULT_RD_DT = 1.0;
export const DEFAULT_RD_CELL_SIZE = 2;

export type ReactionDiffusionOptions = {
  width: number;
  height: number;
  cellSize?: number;
  followView?: boolean;
};

export class ReactionDiffusionGrid extends Module<
  "reactionDiffusion",
  ReactionDiffusionInputs
> {
  readonly name = "reactionDiffusion" as const;
  readonly role = ModuleRole.Grid;
  readonly inputs = {
    feed: DataType.NUMBER,
    kill: DataType.NUMBER,
    diffusionA: DataType.NUMBER,
    diffusionB: DataType.NUMBER,
    dt: DataType.NUMBER,
    cellSize: DataType.NUMBER,
  } as const;
  readonly gridSpec: GridSpec;
  private renderCanvas?: HTMLCanvasElement;
  private renderCtx?: CanvasRenderingContext2D;
  private imageData?: ImageData;

  constructor(options: ReactionDiffusionOptions) {
    super();
    this.gridSpec = {
      width: options.width,
      height: options.height,
      format: "vec2f",
      wrap: "repeat",
      cellSize: options.cellSize ?? DEFAULT_RD_CELL_SIZE,
      followView: options.followView ?? true,
    };
    this.write({
      feed: DEFAULT_RD_FEED,
      kill: DEFAULT_RD_KILL,
      diffusionA: DEFAULT_RD_DIFFUSION_A,
      diffusionB: DEFAULT_RD_DIFFUSION_B,
      dt: DEFAULT_RD_DT,
      cellSize: options.cellSize ?? DEFAULT_RD_CELL_SIZE,
    });
  }

  private seedFromParticles(
    particles: IParticle[],
    view: ViewSnapshot,
    buffer: Float32Array
  ): boolean {
    if (!particles || particles.length === 0) return false;
    const width = this.gridSpec.width;
    const height = this.gridSpec.height;
    const channels = 2;
    buffer.fill(0);
    const total = width * height;
    for (let i = 0; i < total; i++) {
      buffer[i * channels + 0] = 1;
      buffer[i * channels + 1] = 0;
    }
    const centerX = view.width / 2;
    const centerY = view.height / 2;
    for (const particle of particles) {
      if (particle.mass === 0) continue;
      const screenX = centerX + (particle.position.x - view.cx) * view.zoom;
      const screenY = centerY + (particle.position.y - view.cy) * view.zoom;
      const gx = Math.floor((screenX / view.width) * width);
      const gy = Math.floor((screenY / view.height) * height);
      if (gx < 0 || gy < 0 || gx >= width || gy >= height) continue;
      const idx = (gy * width + gx) * channels;
      buffer[idx + 1] = 1;
    }
    return true;
  }

  seedFromParticlesBuffer(
    particles: IParticle[],
    view: ViewSnapshot
  ): Float32Array | null {
    const total = this.gridSpec.width * this.gridSpec.height * 2;
    const buffer = new Float32Array(total);
    return this.seedFromParticles(particles, view, buffer) ? buffer : null;
  }

  cpu(): CPUDescriptor<ReactionDiffusionInputs> {
    return {
      init: ({ grid, particles, view }) => {
        const buf = grid.writeBuffer as Float32Array;
        if (this.seedFromParticles(particles, view, buf)) return;
        const width = grid.width;
        const height = grid.height;
        for (let y = 0; y < height; y++) {
          for (let x = 0; x < width; x++) {
            const idx = (y * width + x) * grid.channels;
            (grid.writeBuffer as any)[idx + 0] = 1;
            (grid.writeBuffer as any)[idx + 1] = 0;
          }
        }
        const cx = Math.floor(width / 2);
        const cy = Math.floor(height / 2);
        const r = Math.max(2, Math.floor(Math.min(width, height) * 0.05));
        for (let y = -r; y <= r; y++) {
          for (let x = -r; x <= r; x++) {
            if (x * x + y * y > r * r) continue;
            const gx = cx + x;
            const gy = cy + y;
            if (gx < 0 || gx >= width || gy < 0 || gy >= height) continue;
            const idx = (gy * width + gx) * grid.channels;
            (grid.writeBuffer as any)[idx + 1] = 1;
          }
        }
      },
      step: ({ grid, input }) => {
        const width = grid.width;
        const height = grid.height;
        for (let y = 0; y < height; y++) {
          for (let x = 0; x < width; x++) {
            const a = grid.read(x, y, 0);
            const b = grid.read(x, y, 1);
            const lapA =
              -a +
              0.2 *
                (grid.read(x + 1, y, 0) +
                  grid.read(x - 1, y, 0) +
                  grid.read(x, y + 1, 0) +
                  grid.read(x, y - 1, 0)) +
              0.05 *
                (grid.read(x + 1, y + 1, 0) +
                  grid.read(x - 1, y + 1, 0) +
                  grid.read(x + 1, y - 1, 0) +
                  grid.read(x - 1, y - 1, 0));
            const lapB =
              -b +
              0.2 *
                (grid.read(x + 1, y, 1) +
                  grid.read(x - 1, y, 1) +
                  grid.read(x, y + 1, 1) +
                  grid.read(x, y - 1, 1)) +
              0.05 *
                (grid.read(x + 1, y + 1, 1) +
                  grid.read(x - 1, y + 1, 1) +
                  grid.read(x + 1, y - 1, 1) +
                  grid.read(x - 1, y - 1, 1));

            const reaction = a * b * b;
            const newA =
              a +
              (input.diffusionA * lapA - reaction + input.feed * (1 - a)) *
                input.dt;
            const newB =
              b +
              (input.diffusionB * lapB +
                reaction -
                (input.kill + input.feed) * b) *
                input.dt;

            const clampedA = Math.max(0, Math.min(1, newA));
            const clampedB = Math.max(0, Math.min(1, newB));
            const idx = (y * width + x) * grid.channels;
            (grid.writeBuffer as any)[idx + 0] = clampedA;
            (grid.writeBuffer as any)[idx + 1] = clampedB;
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
            const idx = i * grid.channels;
            const a = buf[idx + 0];
            const b = buf[idx + 1];
            const v = Math.max(0, Math.min(1, b - a + 1));
            const c = Math.floor(v * 255);
            const di = i * 4;
            data[di + 0] = c;
            data[di + 1] = c;
            data[di + 2] = c;
            data[di + 3] = 255;
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

  webgpu(): WebGPUDescriptor<ReactionDiffusionInputs> {
    return {
      init: ({ cellCoordVar, widthVar, heightVar }) => {
        return `
let x = i32(${cellCoordVar}.x);
let y = i32(${cellCoordVar}.y);
grid_write(x, y, 0u, 1.0);
grid_write(x, y, 1u, 0.0);
let cx = i32(${widthVar} / 2u);
let cy = i32(${heightVar} / 2u);
let dx = x - cx;
let dy = y - cy;
let r = i32(min(${widthVar}, ${heightVar})) / 20;
if (dx * dx + dy * dy <= r * r) {
  grid_write(x, y, 1u, 1.0);
}
`;
      },
      step: ({ getUniform, cellCoordVar }) => {
        return `
let x = i32(${cellCoordVar}.x);
let y = i32(${cellCoordVar}.y);
let a = grid_read(x, y, 0u);
let b = grid_read(x, y, 1u);
let lapA =
  -a +
  0.2 * (grid_read(x + 1, y, 0u) + grid_read(x - 1, y, 0u) + grid_read(x, y + 1, 0u) + grid_read(x, y - 1, 0u)) +
  0.05 * (grid_read(x + 1, y + 1, 0u) + grid_read(x - 1, y + 1, 0u) + grid_read(x + 1, y - 1, 0u) + grid_read(x - 1, y - 1, 0u));
let lapB =
  -b +
  0.2 * (grid_read(x + 1, y, 1u) + grid_read(x - 1, y, 1u) + grid_read(x, y + 1, 1u) + grid_read(x, y - 1, 1u)) +
  0.05 * (grid_read(x + 1, y + 1, 1u) + grid_read(x - 1, y + 1, 1u) + grid_read(x + 1, y - 1, 1u) + grid_read(x - 1, y - 1, 1u));
let reaction = a * b * b;
let feed = ${getUniform("feed")};
let kill = ${getUniform("kill")};
let diffA = ${getUniform("diffusionA")};
let diffB = ${getUniform("diffusionB")};
let dt = ${getUniform("dt")};
let newA = a + (diffA * lapA - reaction + feed * (1.0 - a)) * dt;
let newB = b + (diffB * lapB + reaction - (kill + feed) * b) * dt;
let clampedA = clamp(newA, 0.0, 1.0);
let clampedB = clamp(newB, 0.0, 1.0);
grid_write(x, y, 0u, clampedA);
grid_write(x, y, 1u, clampedB);
`;
      },
      render: {
        passes: [
          {
            kind: RenderPassKind.Fullscreen,
            bindings: [],
            instanced: false,
            writesScene: true,
            fragment: () => `{
  let gx = i32(floor(frag_coord.x / render_uniforms.canvas_size.x * f32(GRID_WIDTH)));
  let gy = i32(floor(frag_coord.y / render_uniforms.canvas_size.y * f32(GRID_HEIGHT)));
  let a = grid_read(gx, gy, 0u);
  let b = grid_read(gx, gy, 1u);
  let v = clamp(b - a + 1.0, 0.0, 1.0);
  return vec4<f32>(v, v, v, 1.0);
}`,
          },
        ],
      },
    } as WebGPUDescriptor<ReactionDiffusionInputs>;
  }
}
