import { GridSpec } from "../module";

export type GridBuffer =
  | Uint8Array
  | Int8Array
  | Uint16Array
  | Int16Array
  | Float32Array;

export function getGridChannelCount(spec: GridSpec): number {
  if (spec.channels) return spec.channels;
  switch (spec.format) {
    case "vec2f":
      return 2;
    case "vec4f":
      return 4;
    default:
      return 1;
  }
}

export function getGridBufferLength(spec: GridSpec): number {
  const channels = getGridChannelCount(spec);
  return Math.max(1, spec.width) * Math.max(1, spec.height) * channels;
}

export function createGridBuffer(spec: GridSpec, length?: number): GridBuffer {
  const size = length ?? getGridBufferLength(spec);
  switch (spec.format) {
    case "u8":
      return new Uint8Array(size);
    case "i8":
      return new Int8Array(size);
    case "u16":
      return new Uint16Array(size);
    case "i16":
      return new Int16Array(size);
    case "f16":
    case "f32":
    case "vec2f":
    case "vec4f":
    default:
      return new Float32Array(size);
  }
}

export class GridStore {
  readonly spec: GridSpec;
  readonly width: number;
  readonly height: number;
  readonly channels: number;
  readBuffer: GridBuffer;
  writeBuffer: GridBuffer;

  constructor(spec: GridSpec) {
    this.spec = spec;
    this.width = Math.max(1, spec.width);
    this.height = Math.max(1, spec.height);
    this.channels = getGridChannelCount(spec);
    const length = this.width * this.height * this.channels;
    this.readBuffer = createGridBuffer(spec, length);
    this.writeBuffer = createGridBuffer(spec, length);
  }

  swap(): void {
    const tmp = this.readBuffer;
    this.readBuffer = this.writeBuffer;
    this.writeBuffer = tmp;
  }

  private resolveCoord(
    v: number,
    max: number,
    wrap: GridSpec["wrap"]
  ): number {
    if (wrap === "repeat") {
      const m = ((v % max) + max) % max;
      return m;
    }
    if (wrap === "mirror") {
      const period = max * 2;
      const m = ((v % period) + period) % period;
      return m < max ? m : period - 1 - m;
    }
    return Math.max(0, Math.min(v, max - 1));
  }

  index(x: number, y: number, channel: number = 0): number {
    const wrap = this.spec.wrap ?? "clamp";
    const xx = this.resolveCoord(Math.floor(x), this.width, wrap);
    const yy = this.resolveCoord(Math.floor(y), this.height, wrap);
    const ch = Math.max(0, Math.min(channel, this.channels - 1));
    return (yy * this.width + xx) * this.channels + ch;
  }

  read(x: number, y: number, channel: number = 0): number {
    const idx = this.index(x, y, channel);
    return (this.readBuffer as any)[idx] ?? 0;
  }

  write(x: number, y: number, value: number | number[]): void {
    const base = this.index(x, y, 0);
    if (Array.isArray(value)) {
      for (let c = 0; c < this.channels; c++) {
        (this.writeBuffer as any)[base + c] = value[c] ?? 0;
      }
      return;
    }
    (this.writeBuffer as any)[base] = value;
  }
}
