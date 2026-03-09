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

export function resampleGridBuffer(
  source: ArrayBufferView,
  sourceSpec: GridSpec,
  targetSpec: GridSpec,
  opts: { forceFloat?: boolean } = {}
): GridBuffer | Float32Array {
  const srcWidth = Math.max(1, sourceSpec.width);
  const srcHeight = Math.max(1, sourceSpec.height);
  const srcChannels = getGridChannelCount(sourceSpec);
  const dstWidth = Math.max(1, targetSpec.width);
  const dstHeight = Math.max(1, targetSpec.height);
  const dstChannels = getGridChannelCount(targetSpec);

  const dst = opts.forceFloat
    ? new Float32Array(dstWidth * dstHeight * dstChannels)
    : createGridBuffer(targetSpec, dstWidth * dstHeight * dstChannels);

  const src = source as any;
  const maxSrcX = Math.max(0, srcWidth - 1);
  const maxSrcY = Math.max(0, srcHeight - 1);
  const maxDstX = Math.max(1, dstWidth - 1);
  const maxDstY = Math.max(1, dstHeight - 1);
  const channelCopyCount = Math.min(srcChannels, dstChannels);

  for (let y = 0; y < dstHeight; y++) {
    const v = maxDstY === 0 ? 0 : y / maxDstY;
    const sy = Math.min(maxSrcY, Math.max(0, Math.round(v * maxSrcY)));
    for (let x = 0; x < dstWidth; x++) {
      const u = maxDstX === 0 ? 0 : x / maxDstX;
      const sx = Math.min(maxSrcX, Math.max(0, Math.round(u * maxSrcX)));
      const srcBase = (sy * srcWidth + sx) * srcChannels;
      const dstBase = (y * dstWidth + x) * dstChannels;
      for (let c = 0; c < channelCopyCount; c++) {
        (dst as any)[dstBase + c] = src[srcBase + c] ?? 0;
      }
      for (let c = channelCopyCount; c < dstChannels; c++) {
        (dst as any)[dstBase + c] = 0;
      }
    }
  }

  return dst;
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
