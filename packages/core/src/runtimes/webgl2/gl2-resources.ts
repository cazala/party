/**
 * GL2Resources
 *
 * Low-level WebGL2 resource manager. Responsible for:
 * - Context acquisition and canvas configuration
 * - Creation and caching of GL buffers, textures, framebuffers, and programs
 * - Managing ping-pong render targets for simulation
 * - Providing helpers to write CPU data into GL buffers
 * - Cleaning up all GL objects on dispose
 */

export interface ParticleTextures {
  a: WebGLTexture;
  b: WebGLTexture;
  fboA: WebGLFramebuffer;
  fboB: WebGLFramebuffer;
}

export interface SceneTextures {
  a: WebGLTexture;
  b: WebGLTexture;
  fboA: WebGLFramebuffer;
  fboB: WebGLFramebuffer;
}

export class GL2Resources {
  public canvas: HTMLCanvasElement;
  public gl: WebGL2RenderingContext | null = null;

  private particleTextures: ParticleTextures | null = null;
  private sceneTextures: SceneTextures | null = null;
  private currentParticleTexture: "A" | "B" = "A";
  private currentSceneTexture: "A" | "B" = "A";
  private particleTextureSize: { width: number; height: number } | null = null;
  private programs: Map<string, WebGLProgram> = new Map();
  private buffers: Map<string, WebGLBuffer> = new Map();

  constructor(options: { canvas: HTMLCanvasElement }) {
    this.canvas = options.canvas;
  }

  async initialize(): Promise<void> {
    if (this.isInitialized()) return;

    // Get WebGL2 context
    const gl = this.canvas.getContext("webgl2", {
      alpha: true,
      depth: false,
      stencil: false,
      antialias: false,
      premultipliedAlpha: true,
      preserveDrawingBuffer: false,
    });

    if (!gl) {
      throw new Error("WebGL2 not supported");
    }

    this.gl = gl;

    // Enable necessary extensions
    const extColorBufferFloat = gl.getExtension("EXT_color_buffer_float");
    if (!extColorBufferFloat) {
      throw new Error("WebGL2 extension EXT_color_buffer_float not supported");
    }

    // Enable blending for rendering
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  }

  isInitialized(): boolean {
    return this.gl !== null;
  }

  getGL(): WebGL2RenderingContext {
    if (!this.gl) {
      throw new Error("GL2Resources not initialized");
    }
    return this.gl;
  }

  /**
   * Create particle storage textures. We use RGBA32F textures to store particle data.
   * Each particle requires 3 texels:
   * - Texel 0: position.xy, velocity.xy
   * - Texel 1: acceleration.xy, size, mass
   * - Texel 2: color.rgba
   */
  createParticleTextures(maxParticles: number): void {
    // Calculate texture size: we need 3 texels per particle
    // We'll use a square texture for simplicity
    const texelsNeeded = maxParticles * 3;
    const texSize = Math.ceil(Math.sqrt(texelsNeeded));

    this.particleTextureSize = { width: texSize, height: texSize };

    // Create two textures for ping-pong
    const texA = this.createFloatTexture(texSize, texSize);
    const texB = this.createFloatTexture(texSize, texSize);

    // Create framebuffers
    const fboA = this.createFramebuffer(texA);
    const fboB = this.createFramebuffer(texB);

    this.particleTextures = { a: texA, b: texB, fboA, fboB };
  }

  /**
   * Create scene render targets (for rendering particles and effects)
   */
  createSceneTextures(width: number, height: number): void {
    const gl = this.getGL();

    // Clean up old textures if they exist
    if (this.sceneTextures) {
      gl.deleteTexture(this.sceneTextures.a);
      gl.deleteTexture(this.sceneTextures.b);
      gl.deleteFramebuffer(this.sceneTextures.fboA);
      gl.deleteFramebuffer(this.sceneTextures.fboB);
    }

    const texA = this.createRGBATexture(width, height);
    const texB = this.createRGBATexture(width, height);

    const fboA = this.createFramebuffer(texA);
    const fboB = this.createFramebuffer(texB);

    this.sceneTextures = { a: texA, b: texB, fboA, fboB };
  }

  private createFloatTexture(width: number, height: number): WebGLTexture {
    const gl = this.getGL();
    const tex = gl.createTexture();
    if (!tex) throw new Error("Failed to create texture");

    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA32F,
      width,
      height,
      0,
      gl.RGBA,
      gl.FLOAT,
      null
    );
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    return tex;
  }

  private createRGBATexture(width: number, height: number): WebGLTexture {
    const gl = this.getGL();
    const tex = gl.createTexture();
    if (!tex) throw new Error("Failed to create texture");

    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      width,
      height,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      null
    );
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    return tex;
  }

  private createFramebuffer(texture: WebGLTexture): WebGLFramebuffer {
    const gl = this.getGL();
    const fbo = gl.createFramebuffer();
    if (!fbo) throw new Error("Failed to create framebuffer");

    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(
      gl.FRAMEBUFFER,
      gl.COLOR_ATTACHMENT0,
      gl.TEXTURE_2D,
      texture,
      0
    );

    const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
    if (status !== gl.FRAMEBUFFER_COMPLETE) {
      throw new Error(`Framebuffer incomplete: ${status}`);
    }

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return fbo;
  }

  /**
   * Write particle data from CPU to GPU.
   * Data layout: 3 texels per particle (12 floats total)
   */
  writeParticleData(data: Float32Array): void {
    const gl = this.getGL();
    if (!this.particleTextures || !this.particleTextureSize) {
      throw new Error("Particle textures not created");
    }

    const { width, height } = this.particleTextureSize;
    const currentTex = this.getCurrentParticleTexture();

    gl.bindTexture(gl.TEXTURE_2D, currentTex);
    gl.texSubImage2D(
      gl.TEXTURE_2D,
      0,
      0,
      0,
      width,
      height,
      gl.RGBA,
      gl.FLOAT,
      data
    );
    gl.bindTexture(gl.TEXTURE_2D, null);
  }

  getCurrentParticleTexture(): WebGLTexture {
    if (!this.particleTextures) {
      throw new Error("Particle textures not created");
    }
    return this.currentParticleTexture === "A"
      ? this.particleTextures.a
      : this.particleTextures.b;
  }

  getOtherParticleTexture(): WebGLTexture {
    if (!this.particleTextures) {
      throw new Error("Particle textures not created");
    }
    return this.currentParticleTexture === "A"
      ? this.particleTextures.b
      : this.particleTextures.a;
  }

  getCurrentParticleFramebuffer(): WebGLFramebuffer {
    if (!this.particleTextures) {
      throw new Error("Particle textures not created");
    }
    return this.currentParticleTexture === "A"
      ? this.particleTextures.fboA
      : this.particleTextures.fboB;
  }

  getOtherParticleFramebuffer(): WebGLFramebuffer {
    if (!this.particleTextures) {
      throw new Error("Particle textures not created");
    }
    return this.currentParticleTexture === "A"
      ? this.particleTextures.fboB
      : this.particleTextures.fboA;
  }

  swapParticleTextures(): void {
    this.currentParticleTexture =
      this.currentParticleTexture === "A" ? "B" : "A";
  }

  getCurrentSceneTexture(): WebGLTexture {
    if (!this.sceneTextures) {
      throw new Error("Scene textures not created");
    }
    return this.currentSceneTexture === "A"
      ? this.sceneTextures.a
      : this.sceneTextures.b;
  }

  getOtherSceneTexture(): WebGLTexture {
    if (!this.sceneTextures) {
      throw new Error("Scene textures not created");
    }
    return this.currentSceneTexture === "A"
      ? this.sceneTextures.b
      : this.sceneTextures.a;
  }

  getCurrentSceneFramebuffer(): WebGLFramebuffer {
    if (!this.sceneTextures) {
      throw new Error("Scene textures not created");
    }
    return this.currentSceneTexture === "A"
      ? this.sceneTextures.fboA
      : this.sceneTextures.fboB;
  }

  getOtherSceneFramebuffer(): WebGLFramebuffer {
    if (!this.sceneTextures) {
      throw new Error("Scene textures not created");
    }
    return this.currentSceneTexture === "A"
      ? this.sceneTextures.fboB
      : this.sceneTextures.fboA;
  }

  swapSceneTextures(): void {
    this.currentSceneTexture = this.currentSceneTexture === "A" ? "B" : "A";
  }

  /**
   * Create and cache a shader program
   */
  createProgram(
    name: string,
    vertexShaderSource: string,
    fragmentShaderSource: string
  ): WebGLProgram {
    if (this.programs.has(name)) {
      return this.programs.get(name)!;
    }

    const gl = this.getGL();

    const vertexShader = this.compileShader(
      gl.VERTEX_SHADER,
      vertexShaderSource
    );
    const fragmentShader = this.compileShader(
      gl.FRAGMENT_SHADER,
      fragmentShaderSource
    );

    const program = gl.createProgram();
    if (!program) throw new Error("Failed to create program");

    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      const info = gl.getProgramInfoLog(program);
      throw new Error(`Failed to link program: ${info}`);
    }

    // Clean up shaders (they're now linked into the program)
    gl.deleteShader(vertexShader);
    gl.deleteShader(fragmentShader);

    this.programs.set(name, program);
    return program;
  }

  private compileShader(type: number, source: string): WebGLShader {
    const gl = this.getGL();
    const shader = gl.createShader(type);
    if (!shader) throw new Error("Failed to create shader");

    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const info = gl.getShaderInfoLog(shader);
      gl.deleteShader(shader);
      throw new Error(`Failed to compile shader: ${info}`);
    }

    return shader;
  }

  getProgram(name: string): WebGLProgram | undefined {
    return this.programs.get(name);
  }

  /**
   * Create a vertex buffer
   */
  createBuffer(name: string, data: Float32Array): WebGLBuffer {
    const gl = this.getGL();
    const buffer = gl.createBuffer();
    if (!buffer) throw new Error("Failed to create buffer");

    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);

    this.buffers.set(name, buffer);
    return buffer;
  }

  getBuffer(name: string): WebGLBuffer | undefined {
    return this.buffers.get(name);
  }

  /**
   * Read particle data back from GPU to CPU
   */
  async readParticleData(): Promise<Float32Array> {
    const gl = this.getGL();
    if (!this.particleTextures || !this.particleTextureSize) {
      throw new Error("Particle textures not created");
    }

    const { width, height } = this.particleTextureSize;
    const currentFbo = this.getCurrentParticleFramebuffer();

    // Read pixels from current particle texture
    const pixelData = new Float32Array(width * height * 4);
    gl.bindFramebuffer(gl.FRAMEBUFFER, currentFbo);
    gl.readPixels(0, 0, width, height, gl.RGBA, gl.FLOAT, pixelData);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    return pixelData;
  }

  /**
   * Clear scene textures to a given color
   */
  clearScene(color: { r: number; g: number; b: number; a: number }): void {
    const gl = this.getGL();
    if (!this.sceneTextures) return;

    // Clear both scene textures
    for (const fbo of [this.sceneTextures.fboA, this.sceneTextures.fboB]) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      gl.clearColor(color.r, color.g, color.b, color.a);
      gl.clear(gl.COLOR_BUFFER_BIT);
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  async dispose(): Promise<void> {
    const gl = this.gl;
    if (!gl) return;

    // Delete particle textures
    if (this.particleTextures) {
      gl.deleteTexture(this.particleTextures.a);
      gl.deleteTexture(this.particleTextures.b);
      gl.deleteFramebuffer(this.particleTextures.fboA);
      gl.deleteFramebuffer(this.particleTextures.fboB);
      this.particleTextures = null;
    }

    // Delete scene textures
    if (this.sceneTextures) {
      gl.deleteTexture(this.sceneTextures.a);
      gl.deleteTexture(this.sceneTextures.b);
      gl.deleteFramebuffer(this.sceneTextures.fboA);
      gl.deleteFramebuffer(this.sceneTextures.fboB);
      this.sceneTextures = null;
    }

    // Delete programs
    for (const program of this.programs.values()) {
      gl.deleteProgram(program);
    }
    this.programs.clear();

    // Delete buffers
    for (const buffer of this.buffers.values()) {
      gl.deleteBuffer(buffer);
    }
    this.buffers.clear();

    this.gl = null;
  }
}
