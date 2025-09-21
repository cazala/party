/**
 * ParticleStore
 *
 * CPU-side SoA-like packed Float32Array for particle attributes with helpers
 * to set/add/read particles and to synchronize active slices to the GPU
 * storage buffer owned by GPUResources.
 *
 * Layout (floatsPerParticle=12):
 * [pos.x, pos.y, vel.x, vel.y, ax, ay, size, mass, color.r, color.g, color.b, color.a]
 */
import { Vector2D } from "../..";
import { GPUResources } from "./gpu-resources";

export type WebGPUParticle = {
  position: { x: number; y: number };
  velocity: { x: number; y: number };
  size: number;
  mass: number;
  color: {
    r: number;
    g: number;
    b: number;
    a: number;
  };
};

/**
 * CPU-side particle storage and synchronization to GPU storage buffer.
 */
export class ParticleStore {
  private readonly maxParticles: number;
  private readonly floatsPerParticle: number;
  private readonly data: Float32Array;
  private count: number = 0;

  constructor(maxParticles: number, floatsPerParticle = 12) {
    this.maxParticles = Math.max(0, Math.floor(maxParticles));
    this.floatsPerParticle = Math.max(1, Math.floor(floatsPerParticle));
    this.data = new Float32Array(this.maxParticles * this.floatsPerParticle);
  }

  setParticles(list: WebGPUParticle[]): void {
    const n = Math.min(list.length, this.maxParticles);
    for (let i = 0; i < n; i++) this.writeAtIndex(i, list[i]);
    this.count = n;
  }

  addParticle(p: WebGPUParticle): void {
    if (this.count >= this.maxParticles) return;
    this.writeAtIndex(this.count, p);
    this.count++;
  }

  clear(): void {
    this.count = 0;
  }

  getCount(): number {
    return this.count;
  }

  getParticles(): WebGPUParticle[] {
    const particles: WebGPUParticle[] = [];
    for (let i = 0; i < this.count; i++) {
      particles.push(this.getParticle(i));
    }
    return particles;
  }

  getParticle(index: number): WebGPUParticle {
    const base = index * this.floatsPerParticle;
    return {
      position: new Vector2D(this.data[base + 0], this.data[base + 1]),
      velocity: new Vector2D(this.data[base + 2], this.data[base + 3]),
      size: this.data[base + 6],
      mass: this.data[base + 7],
      color: {
        r: this.data[base + 8],
        g: this.data[base + 9],
        b: this.data[base + 10],
        a: this.data[base + 11],
      },
    };
  }

  /**
   * Writes the currently active particle slice to the GPU particle buffer.
   * Assumes the GPU storage buffer has already been created with matching capacity.
   */
  syncToGPU(resources: GPUResources): void {
    if (this.count === 0) return;
    const slice = this.data.subarray(0, this.count * this.floatsPerParticle);
    resources.writeParticleBuffer(slice);
  }

  /**
   * Internal: encode one particle into the CPU buffer at a given index.
   */
  private writeAtIndex(index: number, particle: WebGPUParticle): void {
    const base = index * this.floatsPerParticle;
    // Layout: pos2, vel2, accel2, size, mass, color4
    this.data[base + 0] = particle.position.x;
    this.data[base + 1] = particle.position.y;
    this.data[base + 2] = particle.velocity.x;
    this.data[base + 3] = particle.velocity.y;
    this.data[base + 4] = 0; // ax
    this.data[base + 5] = 0; // ay
    this.data[base + 6] = particle.size ?? 5;
    this.data[base + 7] = particle.mass ?? 1;
    const c = particle.color ?? { r: 1, g: 1, b: 1, a: 1 };
    this.data[base + 8] = c.r;
    this.data[base + 9] = c.g;
    this.data[base + 10] = c.b;
    this.data[base + 11] = c.a;
  }
}
