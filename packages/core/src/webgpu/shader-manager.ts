/**
 * WebGPU Shader Management System
 * 
 * This module provides comprehensive compute shader compilation,
 * pipeline management, and optimization for particle physics calculations.
 */

import { WebGPUContext } from './webgpu-context';

export interface ShaderCompileOptions {
  /** Entry point function name */
  entryPoint?: string;
  /** Shader constants to inject */
  constants?: Record<string, number>;
  /** Workgroup size override */
  workgroupSize?: [number, number, number];
  /** Enable debug information */
  debug?: boolean;
  /** Pipeline label for debugging */
  label?: string;
}

export interface ComputePipelineDescriptor {
  /** Shader source code */
  shaderSource: string;
  /** Compilation options */
  options?: ShaderCompileOptions;
  /** Bind group layouts */
  bindGroupLayouts?: GPUBindGroupLayout[];
}

export interface ShaderTemplate {
  /** Template name */
  name: string;
  /** Template source with placeholder tokens */
  source: string;
  /** Default constants */
  defaultConstants?: Record<string, number>;
  /** Required bind group count */
  bindGroupCount: number;
}

/**
 * Manages WebGPU compute shaders and pipelines for particle physics
 */
export class ShaderManager {
  private context: WebGPUContext;
  private compiledShaders: Map<string, GPUShaderModule> = new Map();
  private computePipelines: Map<string, GPUComputePipeline> = new Map();
  private bindGroupLayouts: Map<string, GPUBindGroupLayout> = new Map();
  private shaderTemplates: Map<string, ShaderTemplate> = new Map();

  constructor(context: WebGPUContext) {
    this.context = context;
    this.initializeBuiltinTemplates();
  }

  /**
   * Compile a compute shader from source
   */
  compileShader(source: string, options: ShaderCompileOptions = {}): GPUShaderModule {
    const device = this.context.getDevice();
    
    // Create cache key
    const cacheKey = this.createShaderCacheKey(source, options);
    
    // Return cached shader if available
    if (this.compiledShaders.has(cacheKey)) {
      return this.compiledShaders.get(cacheKey)!;
    }

    // Process shader source with constants
    const processedSource = this.processShaderSource(source, options);

    // Compile shader module
    const shaderModule = device.createShaderModule({
      label: options.label || 'compute-shader',
      code: processedSource
    });

    // Cache the compiled shader
    this.compiledShaders.set(cacheKey, shaderModule);
    
    return shaderModule;
  }

  /**
   * Create a compute pipeline
   */
  createComputePipeline(descriptor: ComputePipelineDescriptor): GPUComputePipeline {
    const device = this.context.getDevice();
    const options = descriptor.options || {};
    
    // Create cache key
    const cacheKey = this.createPipelineCacheKey(descriptor);
    
    // Return cached pipeline if available
    if (this.computePipelines.has(cacheKey)) {
      return this.computePipelines.get(cacheKey)!;
    }

    // Compile shader
    const shaderModule = this.compileShader(descriptor.shaderSource, options);

    // Create pipeline layout
    let layout: GPUPipelineLayout | 'auto' = 'auto';
    if (descriptor.bindGroupLayouts && descriptor.bindGroupLayouts.length > 0) {
      layout = device.createPipelineLayout({
        bindGroupLayouts: descriptor.bindGroupLayouts
      });
    }

    // Create compute pipeline
    const pipeline = device.createComputePipeline({
      label: options.label || 'compute-pipeline',
      layout,
      compute: {
        module: shaderModule,
        entryPoint: options.entryPoint || 'main',
        constants: options.constants
      }
    });

    // Cache the pipeline
    this.computePipelines.set(cacheKey, pipeline);
    
    return pipeline;
  }

  /**
   * Create a compute pipeline from template
   */
  createPipelineFromTemplate(
    templateName: string, 
    constants: Record<string, number> = {},
    options: Partial<ShaderCompileOptions> = {}
  ): GPUComputePipeline {
    const template = this.shaderTemplates.get(templateName);
    if (!template) {
      throw new Error(`Shader template '${templateName}' not found`);
    }

    const mergedConstants = { ...template.defaultConstants, ...constants };
    const mergedOptions: ShaderCompileOptions = {
      ...options,
      constants: mergedConstants,
      label: options.label || `${templateName}-pipeline`
    };

    return this.createComputePipeline({
      shaderSource: template.source,
      options: mergedOptions
    });
  }

  /**
   * Register a shader template
   */
  registerTemplate(template: ShaderTemplate): void {
    this.shaderTemplates.set(template.name, template);
  }

  /**
   * Create a bind group layout
   */
  createBindGroupLayout(entries: GPUBindGroupLayoutEntry[], label?: string): GPUBindGroupLayout {
    const device = this.context.getDevice();
    
    // Create cache key from entries
    const cacheKey = this.createBindGroupLayoutCacheKey(entries, label);
    
    if (this.bindGroupLayouts.has(cacheKey)) {
      return this.bindGroupLayouts.get(cacheKey)!;
    }

    const layout = device.createBindGroupLayout({
      label,
      entries
    });

    this.bindGroupLayouts.set(cacheKey, layout);
    return layout;
  }

  /**
   * Get optimal workgroup size for a given problem size
   */
  getOptimalWorkgroupSize(problemSize: number, maxWorkgroupSize: number = 256): [number, number, number] {
    const capabilities = this.context.getCapabilities();
    if (!capabilities) {
      return [64, 1, 1]; // Fallback
    }

    const maxSize = Math.min(maxWorkgroupSize, capabilities.maxComputeWorkgroupSize);
    
    // For 1D problems, use linear workgroups
    if (problemSize <= maxSize) {
      return [Math.min(problemSize, maxSize), 1, 1];
    }

    // For larger problems, try to find good factors
    const sqrt = Math.sqrt(problemSize);
    const x = Math.min(Math.ceil(sqrt), maxSize);
    const y = Math.min(Math.ceil(problemSize / x), maxSize);
    
    return [x, y, 1];
  }

  /**
   * Calculate dispatch size for a workgroup
   */
  calculateDispatchSize(problemSize: number, workgroupSize: [number, number, number]): [number, number, number] {
    const [wgX, wgY, wgZ] = workgroupSize;
    
    return [
      Math.ceil(problemSize / wgX),
      Math.ceil(1 / wgY), // Usually 1 for particle systems
      Math.ceil(1 / wgZ)  // Usually 1 for particle systems
    ];
  }

  /**
   * Clear all cached shaders and pipelines
   */
  clearCache(): void {
    this.compiledShaders.clear();
    this.computePipelines.clear();
    this.bindGroupLayouts.clear();
  }

  /**
   * Process shader source by injecting constants and preprocessor directives
   */
  private processShaderSource(source: string, options: ShaderCompileOptions): string {
    let processedSource = source;

    // Inject constants
    if (options.constants) {
      for (const [name, value] of Object.entries(options.constants)) {
        const constantDeclaration = `const ${name}: f32 = ${value};\n`;
        processedSource = constantDeclaration + processedSource;
      }
    }

    // Inject workgroup size if specified
    if (options.workgroupSize) {
      const [x, y, z] = options.workgroupSize;
      const workgroupDeclaration = `@workgroup_size(${x}, ${y}, ${z})\n`;
      processedSource = processedSource.replace(
        /@workgroup_size\(\d+(?:,\s*\d+){0,2}\)/,
        workgroupDeclaration.trim()
      );
    }

    return processedSource;
  }

  /**
   * Create cache key for shader compilation
   */
  private createShaderCacheKey(source: string, options: ShaderCompileOptions): string {
    const optionsStr = JSON.stringify({
      entryPoint: options.entryPoint || 'main',
      constants: options.constants || {},
      workgroupSize: options.workgroupSize || [64, 1, 1]
    });
    
    return this.hashString(source + optionsStr);
  }

  /**
   * Create cache key for pipeline creation
   */
  private createPipelineCacheKey(descriptor: ComputePipelineDescriptor): string {
    const key = {
      source: descriptor.shaderSource,
      options: descriptor.options || {},
      layoutCount: descriptor.bindGroupLayouts?.length || 0
    };
    
    return this.hashString(JSON.stringify(key));
  }

  /**
   * Create cache key for bind group layout
   */
  private createBindGroupLayoutCacheKey(entries: GPUBindGroupLayoutEntry[], label?: string): string {
    const key = { entries, label: label || '' };
    return this.hashString(JSON.stringify(key));
  }

  /**
   * Initialize built-in shader templates for common particle operations
   */
  private initializeBuiltinTemplates(): void {
    // Basic particle update template
    this.registerTemplate({
      name: 'particle-update',
      bindGroupCount: 1,
      defaultConstants: {
        WORKGROUP_SIZE: 64
      },
      source: `
@workgroup_size(WORKGROUP_SIZE, 1, 1)
@compute fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
    let index = global_id.x;
    if (index >= arrayLength(&particles)) {
        return;
    }
    
    // Particle update logic will be injected here
    // This is a template for particle position/velocity updates
}

struct Particle {
    position: vec2<f32>,
    velocity: vec2<f32>,
    mass: f32,
    size: f32,
}

@group(0) @binding(0) var<storage, read_write> particles: array<Particle>;
`
    });

    // Neighbor search template
    this.registerTemplate({
      name: 'neighbor-search',
      bindGroupCount: 2,
      defaultConstants: {
        WORKGROUP_SIZE: 64,
        MAX_NEIGHBORS: 32
      },
      source: `
@workgroup_size(WORKGROUP_SIZE, 1, 1)
@compute fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
    let index = global_id.x;
    if (index >= arrayLength(&particles)) {
        return;
    }
    
    // Neighbor search logic will be injected here
}

struct Particle {
    position: vec2<f32>,
    velocity: vec2<f32>,
    mass: f32,
    size: f32,
}

@group(0) @binding(0) var<storage, read> particles: array<Particle>;
@group(1) @binding(0) var<storage, read_write> neighbors: array<array<u32, MAX_NEIGHBORS>>;
`
    });
  }

  /**
   * Simple string hashing for cache keys
   */
  private hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString();
  }
}