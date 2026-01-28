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

export type GameOfLifeInputs = {
  birthMask: number;
  surviveMask: number;
  seedDensity: number;
  cellSize: number;
};

export const DEFAULT_GOL_BIRTH_MASK = 1 << 3;
export const DEFAULT_GOL_SURVIVE_MASK = (1 << 2) | (1 << 3);
export const DEFAULT_GOL_SEED_DENSITY = 0.15;
export const DEFAULT_GOL_CELL_SIZE = 2;

export type GameOfLifeOptions = {
  width: number;
  height: number;
  seedDensity?: number;
  cellSize?: number;
  followView?: boolean;
};

export class GameOfLifeGrid extends Module<"gameOfLife", GameOfLifeInputs> {
  readonly name = "gameOfLife" as const;
  readonly role = ModuleRole.Grid;
  readonly inputs = {
    birthMask: DataType.NUMBER,
    surviveMask: DataType.NUMBER,
    seedDensity: DataType.NUMBER,
    cellSize: DataType.NUMBER,
  } as const;
  readonly gridSpec: GridSpec;
  private renderCanvas?: HTMLCanvasElement;
  private renderCtx?: CanvasRenderingContext2D;
  private imageData?: ImageData;

  constructor(options: GameOfLifeOptions) {
    super();
    this.gridSpec = {
      width: options.width,
      height: options.height,
      format: "u8",
      wrap: "clamp",
      cellSize: options.cellSize ?? DEFAULT_GOL_CELL_SIZE,
      followView: options.followView ?? true,
    };
    this.write({
      birthMask: DEFAULT_GOL_BIRTH_MASK, // B3
      surviveMask: DEFAULT_GOL_SURVIVE_MASK, // S23
      seedDensity: options.seedDensity ?? DEFAULT_GOL_SEED_DENSITY,
      cellSize: options.cellSize ?? DEFAULT_GOL_CELL_SIZE,
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
    buffer.fill(0);
    const centerX = view.width / 2;
    const centerY = view.height / 2;
    for (const particle of particles) {
      if (particle.mass === 0) continue;
      const screenX = centerX + (particle.position.x - view.cx) * view.zoom;
      const screenY = centerY + (particle.position.y - view.cy) * view.zoom;
      const gx = Math.floor((screenX / view.width) * width);
      const gy = Math.floor((screenY / view.height) * height);
      if (gx < 0 || gy < 0 || gx >= width || gy >= height) continue;
      buffer[gy * width + gx] = 1;
    }
    return true;
  }

  seedFromParticlesBuffer(
    particles: IParticle[],
    view: ViewSnapshot
  ): Float32Array | null {
    const total = this.gridSpec.width * this.gridSpec.height;
    const buffer = new Float32Array(total);
    return this.seedFromParticles(particles, view, buffer) ? buffer : null;
  }

  cpu(): CPUDescriptor<GameOfLifeInputs> {
    return {
      init: ({ grid, input, particles, view }) => {
        const buf = grid.writeBuffer as Float32Array;
        if (this.seedFromParticles(particles, view, buf)) return;
        const total = grid.width * grid.height;
        for (let i = 0; i < total; i++) {
          buf[i] = Math.random() < input.seedDensity ? 1 : 0;
        }
      },
      step: ({ grid, input }) => {
        const width = grid.width;
        const height = grid.height;
        for (let y = 0; y < height; y++) {
          for (let x = 0; x < width; x++) {
            let count = 0;
            for (let dy = -1; dy <= 1; dy++) {
              for (let dx = -1; dx <= 1; dx++) {
                if (dx === 0 && dy === 0) continue;
                const v = grid.read(x + dx, y + dy, 0);
                if (v > 0) count++;
              }
            }
            const alive = grid.read(x, y, 0) > 0 ? 1 : 0;
            const mask = alive ? input.surviveMask : input.birthMask;
            const next = (mask >> count) & 1;
            (grid.writeBuffer as any)[(y * width + x)] = next;
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

  webgpu(): WebGPUDescriptor<GameOfLifeInputs> {
    return {
      init: ({ cellCoordVar, widthVar, heightVar }) => {
        return `
let x = i32(${cellCoordVar}.x);
let y = i32(${cellCoordVar}.y);
let cx = i32(${widthVar} / 2u);
let cy = i32(${heightVar} / 2u);
let alive = select(0.0, 1.0, x == cx && y == cy);
grid_write(x, y, 0u, alive);
`;
      },
      step: ({ getUniform, cellCoordVar }) => {
        return `
let x = i32(${cellCoordVar}.x);
let y = i32(${cellCoordVar}.y);
var count: u32 = 0u;
for (var dy: i32 = -1; dy <= 1; dy = dy + 1) {
  for (var dx: i32 = -1; dx <= 1; dx = dx + 1) {
    if (dx == 0 && dy == 0) { continue; }
    let v = grid_read(x + dx, y + dy, 0u);
    if (v > 0.5) { count = count + 1u; }
  }
}
let alive = grid_read(x, y, 0u) > 0.5;
let birthMask = u32(${getUniform("birthMask")});
let surviveMask = u32(${getUniform("surviveMask")});
let mask = select(birthMask, surviveMask, alive);
let bit = (mask >> count) & 1u;
grid_write(x, y, 0u, f32(bit));
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
  let v = grid_read(gx, gy, 0u);
  return vec4<f32>(v, v, v, 1.0);
}`,
          },
        ],
      },
    } as WebGPUDescriptor<GameOfLifeInputs>;
  }
}
