import type {
  GetParticlesInRadiusOptions,
  GetParticlesInRadiusResult,
  ParticleQuery,
} from "../../interfaces";
import type { GPUResources } from "./gpu-resources";

/**
 * LocalQuery
 *
 * A small WebGPU compute pipeline used to query a bounded set of particles
 * in a region without doing a full GPU→CPU readback of the entire particle buffer.
 *
 * This is used by tool-like features (brush/pin/remove) that need local occupancy.
 */
export class LocalQuery {
  private pipeline: GPUComputePipeline | null = null;
  private uniform: GPUBuffer | null = null;
  private count: GPUBuffer | null = null;
  private out: GPUBuffer | null = null;
  private outIdx: GPUBuffer | null = null;
  private capacity: number = 0;
  private device: GPUDevice | null = null;

  dispose(): void {
    this.pipeline = null;
    this.uniform?.destroy();
    this.count?.destroy();
    this.out?.destroy();
    this.outIdx?.destroy();
    this.uniform = null;
    this.count = null;
    this.out = null;
    this.outIdx = null;
    this.capacity = 0;
    this.device = null;
  }

  private ensure(resources: GPUResources, maxResults: number): void {
    const device = resources.getDevice();

    // If device changed (runtime toggle / recreate), rebuild everything.
    if (this.device && this.device !== device) {
      this.dispose();
    }
    this.device = device;

    // (Re)allocate buffers if capacity changed
    if (this.capacity !== maxResults) {
      this.capacity = maxResults;
      this.uniform?.destroy();
      this.count?.destroy();
      this.out?.destroy();
      this.outIdx?.destroy();

      this.uniform = device.createBuffer({
        size: 8 * 4,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      });
      this.count = device.createBuffer({
        size: 4,
        usage:
          GPUBufferUsage.STORAGE |
          GPUBufferUsage.COPY_DST |
          GPUBufferUsage.COPY_SRC,
      });
      this.out = device.createBuffer({
        size: maxResults * 16,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
      });
      this.outIdx = device.createBuffer({
        size: maxResults * 4,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
      });
    }

    if (this.pipeline) return;

    const code = `
struct Particle {
  position: vec2<f32>,
  velocity: vec2<f32>,
  acceleration: vec2<f32>,
  size: f32,
  mass: f32,
  color: vec4<f32>,
};

struct QueryUniforms {
  v0: vec4<f32>, // center.x, center.y, radius, maxResults (as f32)
  v1: vec4<f32>, // particleCount, 0,0,0
};

@group(0) @binding(0) var<storage, read> particles: array<Particle>;
@group(0) @binding(1) var<uniform> query: QueryUniforms;
@group(0) @binding(2) var<storage, read_write> outCount: atomic<u32>;
@group(0) @binding(3) var<storage, read_write> outData: array<vec4<f32>>;
@group(0) @binding(4) var<storage, read_write> outIndex: array<u32>;

@compute @workgroup_size(256)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let i = gid.x;
  let count = u32(query.v1.x);
  if (i >= count) { return; }

  let p = particles[i];
  if (p.mass == 0.0) { return; }

  let cx = query.v0.x;
  let cy = query.v0.y;
  let radius = query.v0.z;
  let maxResults = u32(query.v0.w);

  // Disc-intersection semantics: dist <= radius + p.size
  let dx = p.position.x - cx;
  let dy = p.position.y - cy;
  let rr = radius + p.size;
  if (dx * dx + dy * dy > rr * rr) { return; }

  let outIdx = atomicAdd(&outCount, 1u);
  if (outIdx >= maxResults) { return; }
  outData[outIdx] = vec4<f32>(p.position.x, p.position.y, p.size, p.mass);
  outIndex[outIdx] = i;
}
`;

    this.pipeline = device.createComputePipeline({
      layout: "auto",
      compute: { module: device.createShaderModule({ code }), entryPoint: "main" },
    });
  }

  async getParticlesInRadius(
    resources: GPUResources,
    center: { x: number; y: number },
    radius: number,
    particleCount: number,
    opts?: GetParticlesInRadiusOptions
  ): Promise<GetParticlesInRadiusResult> {
    const maxResults = Math.max(1, Math.floor(opts?.maxResults ?? 20000));
    this.ensure(resources, maxResults);

    const device = resources.getDevice();
    const particleBuffer = resources.getParticleBuffer();
    if (!particleBuffer) return { particles: [], truncated: false };

    // Reset atomic counter
    device.queue.writeBuffer(this.count!, 0, new Uint32Array([0]));

    // Uniform: v0 = [cx, cy, radius, maxResults], v1 = [particleCount, 0, 0, 0]
    const u = new Float32Array(8);
    u[0] = center.x;
    u[1] = center.y;
    u[2] = radius;
    u[3] = maxResults;
    u[4] = particleCount;
    device.queue.writeBuffer(this.uniform!, 0, u);

    const bindGroup = device.createBindGroup({
      layout: this.pipeline!.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: particleBuffer } },
        { binding: 1, resource: { buffer: this.uniform! } },
        { binding: 2, resource: { buffer: this.count! } },
        { binding: 3, resource: { buffer: this.out! } },
        { binding: 4, resource: { buffer: this.outIdx! } },
      ],
    });

    const encoder = device.createCommandEncoder();
    const pass = encoder.beginComputePass();
    pass.setPipeline(this.pipeline!);
    pass.setBindGroup(0, bindGroup);
    const wg = 256;
    const n = Math.max(0, Math.floor(particleCount));
    pass.dispatchWorkgroups(Math.ceil(n / wg));
    pass.end();
    device.queue.submit([encoder.finish()]);

    const countBuf = await resources.readBuffer(this.count!, 4);
    const found = new Uint32Array(countBuf)[0] ?? 0;
    const truncated = found > maxResults;
    const readCount = Math.min(found, maxResults);
    if (readCount === 0) return { particles: [], truncated };

    const idxBuf = await resources.readBuffer(this.outIdx!, readCount * 4);
    const indices = new Uint32Array(idxBuf);

    const outBuf = await resources.readBuffer(this.out!, readCount * 16);
    const outFloats = new Float32Array(outBuf);

    const particles: ParticleQuery[] = [];
    for (let i = 0; i < readCount; i++) {
      const base = i * 4;
      particles.push({
        index: indices[i] ?? 0,
        position: { x: outFloats[base + 0], y: outFloats[base + 1] },
        size: outFloats[base + 2],
        mass: outFloats[base + 3],
      });
    }

    return { particles, truncated };
  }
}

