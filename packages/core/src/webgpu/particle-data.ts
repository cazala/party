/**
 * GPU-Friendly Particle Data Structure
 * 
 * This module defines optimized particle data layouts for GPU computation,
 * implementing Structure of Arrays (SoA) approach for maximum performance
 * and efficient memory access patterns on the GPU.
 */

import { Particle } from '../modules/particle';
import { Vector2D } from '../modules/vector';

/**
 * GPU-optimized particle data layout using Structure of Arrays (SoA)
 * This layout separates different particle properties into different arrays
 * for optimal GPU memory coalescing and SIMD operations.
 */
export interface ParticleArrays {
  /** Particle positions (x, y) - vec2<f32> array */
  positions: Float32Array;
  /** Particle velocities (vx, vy) - vec2<f32> array */
  velocities: Float32Array;
  /** Particle accelerations (ax, ay) - vec2<f32> array */
  accelerations: Float32Array;
  /** Particle masses - f32 array */
  masses: Float32Array;
  /** Particle sizes/radii - f32 array */
  sizes: Float32Array;
  /** Particle colors (r, g, b, a) - vec4<f32> array */
  colors: Float32Array;
  /** Particle lifetimes and age data - vec2<f32> array (age, duration) */
  lifetimes: Float32Array;
  /** Particle flags and states - u32 array (bitfield) */
  states: Uint32Array;
  /** Number of active particles */
  count: number;
  /** Maximum capacity */
  capacity: number;
}

/**
 * Particle state flags for bitfield operations
 */
export enum ParticleState {
  ACTIVE = 1 << 0,     // Particle is active and should be processed
  PINNED = 1 << 1,     // Particle is pinned and shouldn't move
  GRABBED = 1 << 2,    // Particle is being grabbed by user
  DEAD = 1 << 3,       // Particle should be removed
  EMITTED = 1 << 4,    // Particle was created by an emitter
  COLLISION = 1 << 5,  // Particle is involved in collision this frame
  BOUNDARY = 1 << 6,   // Particle is near boundary
  FLUID = 1 << 7,      // Particle participates in fluid simulation
}

/**
 * Memory layout information for GPU buffers
 */
export interface ParticleLayout {
  /** Byte size of each component */
  sizes: {
    position: number;    // 8 bytes (vec2<f32>)
    velocity: number;    // 8 bytes (vec2<f32>)
    acceleration: number; // 8 bytes (vec2<f32>)
    mass: number;        // 4 bytes (f32)
    size: number;        // 4 bytes (f32)
    color: number;       // 16 bytes (vec4<f32>)
    lifetime: number;    // 8 bytes (vec2<f32>)
    state: number;       // 4 bytes (u32)
  };
  /** Buffer offsets for interleaved layout */
  offsets: {
    position: number;
    velocity: number;
    acceleration: number;
    mass: number;
    size: number;
    color: number;
    lifetime: number;
    state: number;
  };
  /** Total stride per particle for interleaved layout */
  stride: number;
  /** Alignment requirements */
  alignment: number;
}

/**
 * Conversion utilities between CPU Particle objects and GPU data arrays
 */
export class ParticleDataConverter {
  /** Standard GPU particle layout */
  public static readonly LAYOUT: ParticleLayout = {
    sizes: {
      position: 8,      // vec2<f32>
      velocity: 8,      // vec2<f32>
      acceleration: 8,  // vec2<f32>
      mass: 4,          // f32
      size: 4,          // f32
      color: 16,        // vec4<f32>
      lifetime: 8,      // vec2<f32> (age, duration)
      state: 4,         // u32
    },
    offsets: {
      position: 0,
      velocity: 8,
      acceleration: 16,
      mass: 24,
      size: 28,
      color: 32,
      lifetime: 48,
      state: 56,
    },
    stride: 60,  // Total size, aligned to 16 bytes
    alignment: 16
  };

  /**
   * Convert array of Particle objects to GPU-friendly Structure of Arrays
   */
  static particlesToArrays(particles: Particle[], capacity?: number): ParticleArrays {
    const actualCapacity = capacity || Math.max(particles.length, 1000);
    const count = particles.length;

    // Allocate arrays with specified capacity
    const arrays: ParticleArrays = {
      positions: new Float32Array(actualCapacity * 2),      // vec2 per particle
      velocities: new Float32Array(actualCapacity * 2),     // vec2 per particle  
      accelerations: new Float32Array(actualCapacity * 2),  // vec2 per particle
      masses: new Float32Array(actualCapacity),             // f32 per particle
      sizes: new Float32Array(actualCapacity),              // f32 per particle
      colors: new Float32Array(actualCapacity * 4),         // vec4 per particle
      lifetimes: new Float32Array(actualCapacity * 2),      // vec2 per particle (age, duration)
      states: new Uint32Array(actualCapacity),              // u32 per particle
      count,
      capacity: actualCapacity
    };

    // Fill arrays with particle data
    for (let i = 0; i < count; i++) {
      const particle = particles[i];
      
      // Position (vec2)
      arrays.positions[i * 2] = particle.position.x;
      arrays.positions[i * 2 + 1] = particle.position.y;
      
      // Velocity (vec2)
      arrays.velocities[i * 2] = particle.velocity.x;
      arrays.velocities[i * 2 + 1] = particle.velocity.y;
      
      // Acceleration (vec2)
      arrays.accelerations[i * 2] = particle.acceleration.x;
      arrays.accelerations[i * 2 + 1] = particle.acceleration.y;
      
      // Mass (f32)
      arrays.masses[i] = particle.mass;
      
      // Size (f32)
      arrays.sizes[i] = particle.size;
      
      // Color (vec4) - parse from hex string
      const color = this.parseColor(particle.color, particle.alpha || 1.0);
      arrays.colors[i * 4] = color.r;
      arrays.colors[i * 4 + 1] = color.g;
      arrays.colors[i * 4 + 2] = color.b;
      arrays.colors[i * 4 + 3] = color.a;
      
      // Lifetime (vec2) - age and duration
      const age = particle.duration ? particle.getAge() : 0;
      const duration = particle.duration || -1; // -1 for infinite
      arrays.lifetimes[i * 2] = age;
      arrays.lifetimes[i * 2 + 1] = duration;
      
      // State (u32 bitfield)
      let state = ParticleState.ACTIVE;
      if (particle.pinned) state |= ParticleState.PINNED;
      if (particle.grabbed) state |= ParticleState.GRABBED;
      if (particle.isDead && particle.isDead()) state |= ParticleState.DEAD;
      arrays.states[i] = state;
    }

    return arrays;
  }

  /**
   * Convert GPU Structure of Arrays back to Particle objects
   */
  static arraysToParticles(arrays: ParticleArrays): Particle[] {
    const particles: Particle[] = [];
    
    for (let i = 0; i < arrays.count; i++) {
      // Extract data from arrays
      const position = new Vector2D(
        arrays.positions[i * 2],
        arrays.positions[i * 2 + 1]
      );
      
      const velocity = new Vector2D(
        arrays.velocities[i * 2],
        arrays.velocities[i * 2 + 1]
      );
      
      const acceleration = new Vector2D(
        arrays.accelerations[i * 2],
        arrays.accelerations[i * 2 + 1]
      );
      
      const mass = arrays.masses[i];
      const size = arrays.sizes[i];
      
      // Convert color back to hex string
      const r = arrays.colors[i * 4];
      const g = arrays.colors[i * 4 + 1];
      const b = arrays.colors[i * 4 + 2];
      const alpha = arrays.colors[i * 4 + 3];
      const color = this.colorToHex(r, g, b);
      
      // Extract lifetime data
      const age = arrays.lifetimes[i * 2];
      const duration = arrays.lifetimes[i * 2 + 1];
      
      // Extract state flags
      const state = arrays.states[i];
      const pinned = (state & ParticleState.PINNED) !== 0;
      const grabbed = (state & ParticleState.GRABBED) !== 0;
      
      // Create particle with extracted data
      const particle = new Particle({
        position,
        velocity,
        acceleration,
        mass,
        size,
        color,
        pinned,
        grabbed,
        duration: duration > 0 ? duration : undefined
      });
      
      // Set alpha separately
      particle.alpha = alpha;
      
      // Adjust creation time based on age
      if (duration > 0 && age > 0) {
        particle.creationTime = Date.now() - age;
      }
      
      particles.push(particle);
    }
    
    return particles;
  }

  /**
   * Create interleaved buffer data for GPU upload
   */
  static createInterleavedBuffer(arrays: ParticleArrays): ArrayBuffer {
    const stride = this.LAYOUT.stride;
    const buffer = new ArrayBuffer(arrays.count * stride);
    const view = new DataView(buffer);
    
    for (let i = 0; i < arrays.count; i++) {
      const offset = i * stride;
      
      // Position (vec2<f32>)
      view.setFloat32(offset + this.LAYOUT.offsets.position, arrays.positions[i * 2], true);
      view.setFloat32(offset + this.LAYOUT.offsets.position + 4, arrays.positions[i * 2 + 1], true);
      
      // Velocity (vec2<f32>)
      view.setFloat32(offset + this.LAYOUT.offsets.velocity, arrays.velocities[i * 2], true);
      view.setFloat32(offset + this.LAYOUT.offsets.velocity + 4, arrays.velocities[i * 2 + 1], true);
      
      // Acceleration (vec2<f32>)
      view.setFloat32(offset + this.LAYOUT.offsets.acceleration, arrays.accelerations[i * 2], true);
      view.setFloat32(offset + this.LAYOUT.offsets.acceleration + 4, arrays.accelerations[i * 2 + 1], true);
      
      // Mass (f32)
      view.setFloat32(offset + this.LAYOUT.offsets.mass, arrays.masses[i], true);
      
      // Size (f32)
      view.setFloat32(offset + this.LAYOUT.offsets.size, arrays.sizes[i], true);
      
      // Color (vec4<f32>)
      view.setFloat32(offset + this.LAYOUT.offsets.color, arrays.colors[i * 4], true);
      view.setFloat32(offset + this.LAYOUT.offsets.color + 4, arrays.colors[i * 4 + 1], true);
      view.setFloat32(offset + this.LAYOUT.offsets.color + 8, arrays.colors[i * 4 + 2], true);
      view.setFloat32(offset + this.LAYOUT.offsets.color + 12, arrays.colors[i * 4 + 3], true);
      
      // Lifetime (vec2<f32>)
      view.setFloat32(offset + this.LAYOUT.offsets.lifetime, arrays.lifetimes[i * 2], true);
      view.setFloat32(offset + this.LAYOUT.offsets.lifetime + 4, arrays.lifetimes[i * 2 + 1], true);
      
      // State (u32)
      view.setUint32(offset + this.LAYOUT.offsets.state, arrays.states[i], true);
    }
    
    return buffer;
  }

  /**
   * Extract particle data from interleaved buffer
   */
  static parseInterleavedBuffer(buffer: ArrayBuffer, particleCount: number): ParticleArrays {
    const stride = this.LAYOUT.stride;
    const view = new DataView(buffer);
    
    const arrays: ParticleArrays = {
      positions: new Float32Array(particleCount * 2),
      velocities: new Float32Array(particleCount * 2),
      accelerations: new Float32Array(particleCount * 2),
      masses: new Float32Array(particleCount),
      sizes: new Float32Array(particleCount),
      colors: new Float32Array(particleCount * 4),
      lifetimes: new Float32Array(particleCount * 2),
      states: new Uint32Array(particleCount),
      count: particleCount,
      capacity: particleCount
    };
    
    for (let i = 0; i < particleCount; i++) {
      const offset = i * stride;
      
      // Position
      arrays.positions[i * 2] = view.getFloat32(offset + this.LAYOUT.offsets.position, true);
      arrays.positions[i * 2 + 1] = view.getFloat32(offset + this.LAYOUT.offsets.position + 4, true);
      
      // Velocity  
      arrays.velocities[i * 2] = view.getFloat32(offset + this.LAYOUT.offsets.velocity, true);
      arrays.velocities[i * 2 + 1] = view.getFloat32(offset + this.LAYOUT.offsets.velocity + 4, true);
      
      // Acceleration
      arrays.accelerations[i * 2] = view.getFloat32(offset + this.LAYOUT.offsets.acceleration, true);
      arrays.accelerations[i * 2 + 1] = view.getFloat32(offset + this.LAYOUT.offsets.acceleration + 4, true);
      
      // Mass
      arrays.masses[i] = view.getFloat32(offset + this.LAYOUT.offsets.mass, true);
      
      // Size
      arrays.sizes[i] = view.getFloat32(offset + this.LAYOUT.offsets.size, true);
      
      // Color
      arrays.colors[i * 4] = view.getFloat32(offset + this.LAYOUT.offsets.color, true);
      arrays.colors[i * 4 + 1] = view.getFloat32(offset + this.LAYOUT.offsets.color + 4, true);
      arrays.colors[i * 4 + 2] = view.getFloat32(offset + this.LAYOUT.offsets.color + 8, true);
      arrays.colors[i * 4 + 3] = view.getFloat32(offset + this.LAYOUT.offsets.color + 12, true);
      
      // Lifetime
      arrays.lifetimes[i * 2] = view.getFloat32(offset + this.LAYOUT.offsets.lifetime, true);
      arrays.lifetimes[i * 2 + 1] = view.getFloat32(offset + this.LAYOUT.offsets.lifetime + 4, true);
      
      // State
      arrays.states[i] = view.getUint32(offset + this.LAYOUT.offsets.state, true);
    }
    
    return arrays;
  }

  /**
   * Resize particle arrays to new capacity
   */
  static resizeArrays(arrays: ParticleArrays, newCapacity: number): ParticleArrays {
    const newArrays: ParticleArrays = {
      positions: new Float32Array(newCapacity * 2),
      velocities: new Float32Array(newCapacity * 2),
      accelerations: new Float32Array(newCapacity * 2),
      masses: new Float32Array(newCapacity),
      sizes: new Float32Array(newCapacity),
      colors: new Float32Array(newCapacity * 4),
      lifetimes: new Float32Array(newCapacity * 2),
      states: new Uint32Array(newCapacity),
      count: arrays.count,
      capacity: newCapacity
    };

    // Copy existing data
    const copyCount = Math.min(arrays.count, newCapacity);
    
    newArrays.positions.set(arrays.positions.subarray(0, copyCount * 2));
    newArrays.velocities.set(arrays.velocities.subarray(0, copyCount * 2));
    newArrays.accelerations.set(arrays.accelerations.subarray(0, copyCount * 2));
    newArrays.masses.set(arrays.masses.subarray(0, copyCount));
    newArrays.sizes.set(arrays.sizes.subarray(0, copyCount));
    newArrays.colors.set(arrays.colors.subarray(0, copyCount * 4));
    newArrays.lifetimes.set(arrays.lifetimes.subarray(0, copyCount * 2));
    newArrays.states.set(arrays.states.subarray(0, copyCount));

    return newArrays;
  }

  /**
   * Parse color string to RGBA components
   */
  private static parseColor(colorStr: string, alpha: number = 1.0): { r: number; g: number; b: number; a: number } {
    // Remove # prefix if present
    const hex = colorStr.replace('#', '');
    
    // Parse hex values
    const r = parseInt(hex.substr(0, 2), 16) / 255;
    const g = parseInt(hex.substr(2, 2), 16) / 255;
    const b = parseInt(hex.substr(4, 2), 16) / 255;
    
    return { r, g, b, a: alpha };
  }

  /**
   * Convert RGBA components to hex color string
   */
  private static colorToHex(r: number, g: number, b: number): string {
    const toHex = (component: number) => {
      const hex = Math.round(component * 255).toString(16);
      return hex.length === 1 ? '0' + hex : hex;
    };
    
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  }
}