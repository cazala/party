/**
 * ParticleStore for WebGL2
 *
 * CPU-side SoA-like packed Float32Array for particle attributes with helpers
 * to set/add/read particles and to synchronize to GPU textures.
 *
 * Layout for texture storage (3 texels per particle, RGBA32F):
 * Texel 0: [pos.x, pos.y, vel.x, vel.y]
 * Texel 1: [ax, ay, size, mass]
 * Texel 2: [color.r, color.g, color.b, color.a]
 *
 * Total: 12 floats per particle
 */
import { GL2Resources } from "./gl2-resources";
import { IParticle } from "../../interfaces";

export class ParticleStore {
  private readonly maxParticles: number;
  private readonly floatsPerParticle: number = 12;
  private readonly data: Float32Array;
  private count: number = 0;

  constructor(maxParticles: number) {
    this.maxParticles = Math.max(0, Math.floor(maxParticles));
    // We store data in texture format: 3 texels (4 floats each) per particle
    // But we'll pack it linearly and reshape when uploading to texture
    this.data = new Float32Array(this.maxParticles * this.floatsPerParticle);
  }

  setParticles(list: IParticle[]): void {
    const n = Math.min(list.length, this.maxParticles);
    for (let i = 0; i < n; i++) this.writeAtIndex(i, list[i]);
    this.count = n;
  }

  addParticle(p: IParticle): void {
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

  getParticles(): IParticle[] {
    const particles: IParticle[] = [];
    for (let i = 0; i < this.count; i++) {
      particles.push(this.getParticle(i));
    }
    return particles;
  }

  getParticle(index: number): IParticle {
    const base = index * this.floatsPerParticle;
    return {
      position: { x: this.data[base + 0], y: this.data[base + 1] },
      velocity: { x: this.data[base + 2], y: this.data[base + 3] },
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
   * Writes the currently active particle data to GPU texture.
   * Converts from linear layout to texture layout (3 RGBA texels per particle).
   */
  syncToGPU(resources: GL2Resources): void {
    if (this.count === 0) return;

    // We need to expand the data to fit texture layout
    // Each particle needs 3 RGBA texels (12 floats), but we need to pad to texture size
    const texelsNeeded = this.maxParticles * 3;
    const texSize = Math.ceil(Math.sqrt(texelsNeeded));
    const textureData = new Float32Array(texSize * texSize * 4);

    // Copy particle data into texture format
    for (let i = 0; i < this.count; i++) {
      const srcBase = i * this.floatsPerParticle;
      const dstBase = i * 3 * 4; // 3 texels, 4 floats each

      // Texel 0: position + velocity
      textureData[dstBase + 0] = this.data[srcBase + 0]; // pos.x
      textureData[dstBase + 1] = this.data[srcBase + 1]; // pos.y
      textureData[dstBase + 2] = this.data[srcBase + 2]; // vel.x
      textureData[dstBase + 3] = this.data[srcBase + 3]; // vel.y

      // Texel 1: acceleration + size + mass
      textureData[dstBase + 4] = this.data[srcBase + 4]; // ax
      textureData[dstBase + 5] = this.data[srcBase + 5]; // ay
      textureData[dstBase + 6] = this.data[srcBase + 6]; // size
      textureData[dstBase + 7] = this.data[srcBase + 7]; // mass

      // Texel 2: color
      textureData[dstBase + 8] = this.data[srcBase + 8]; // r
      textureData[dstBase + 9] = this.data[srcBase + 9]; // g
      textureData[dstBase + 10] = this.data[srcBase + 10]; // b
      textureData[dstBase + 11] = this.data[srcBase + 11]; // a
    }

    resources.writeParticleData(textureData);
  }

  /**
   * Reads particle data back from GPU texture to CPU.
   * Converts from texture layout back to linear layout.
   */
  async syncFromGPU(resources: GL2Resources): Promise<void> {
    if (this.count === 0) return;

    try {
      const textureData = await resources.readParticleData();

      // Convert from texture layout back to linear layout
      for (let i = 0; i < this.count; i++) {
        const srcBase = i * 3 * 4; // 3 texels, 4 floats each
        const dstBase = i * this.floatsPerParticle;

        // Texel 0: position + velocity
        this.data[dstBase + 0] = textureData[srcBase + 0]; // pos.x
        this.data[dstBase + 1] = textureData[srcBase + 1]; // pos.y
        this.data[dstBase + 2] = textureData[srcBase + 2]; // vel.x
        this.data[dstBase + 3] = textureData[srcBase + 3]; // vel.y

        // Texel 1: acceleration + size + mass
        this.data[dstBase + 4] = textureData[srcBase + 4]; // ax
        this.data[dstBase + 5] = textureData[srcBase + 5]; // ay
        this.data[dstBase + 6] = textureData[srcBase + 6]; // size
        this.data[dstBase + 7] = textureData[srcBase + 7]; // mass

        // Texel 2: color
        this.data[dstBase + 8] = textureData[srcBase + 8]; // r
        this.data[dstBase + 9] = textureData[srcBase + 9]; // g
        this.data[dstBase + 10] = textureData[srcBase + 10]; // b
        this.data[dstBase + 11] = textureData[srcBase + 11]; // a
      }
    } catch (error) {
      throw error;
    }
  }

  /**
   * Internal: encode one particle into the CPU buffer at a given index.
   */
  private writeAtIndex(index: number, particle: IParticle): void {
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
