import { Particle } from "./particle";
import { View } from "./view";

/**
 * Module descriptors and base Module class
 *
 * Defines the type-level contract for modules and the DSL surface used by the
 * WGSL builders. A `Module` instance provides a `descriptor()` which declares:
 * - role: `system`, `force`, or `render`
 * - bindings: uniform fields exposed to CPU and populated into GPU uniform buffers
 * - for system/force modules: optional global/state/apply/constrain/correct hooks
 * - for render modules: one or more passes (fullscreen or compute) with their bindings
 *
 * The base `Module` offers uniform writer/reader plumbing and enabled toggling,
 * and module authors extend it to implement their descriptor and any runtime API.
 */
export enum ModuleRole {
  Force = "force",
  Render = "render",
}

export enum DataType {
  NUMBER = "number",
  ARRAY = "array",
}

export abstract class Module<
  Name extends string = string,
  Inputs extends Record<string, number | number[]> = Record<
    string,
    number | number[]
  >,
  StateKeys extends string = any
> {
  abstract readonly name: Name;
  abstract readonly role: ModuleRole;
  abstract readonly inputs: { [K in keyof Inputs]: DataType };

  private _state: Partial<Inputs> = {};
  private _writer:
    | ((values: Partial<Inputs & { enabled: number }>) => void)
    | null = (values: Partial<Inputs>) => {
    for (const key of Object.keys(values)) {
      const val = values[key as keyof Inputs];
      if (typeof val === "number") {
        this._state[key as keyof Inputs] = val as Inputs[keyof Inputs];
      } else if (Array.isArray(val)) {
        this._state[key as keyof Inputs] = [...val] as Inputs[keyof Inputs];
      }
    }
  };
  private _reader: (() => Partial<Inputs>) | null = () => {
    return { ...this._state };
  };
  private _enabled: boolean = true;

  attachUniformWriter(
    writer: (values: Partial<Record<string, number | number[]>>) => void
  ): void {
    const values = this.read();
    this._writer = writer;
    writer({ ...values, enabled: this._enabled ? 1 : 0 });
  }

  attachUniformReader(reader: () => Partial<Inputs>): void {
    this._reader = reader;
  }

  public write(values: Partial<Inputs>): void {
    // Binding keys are narrowed by the generic; cast to the writer's accepted shape
    this._writer?.(values as unknown as Partial<Inputs & { enabled: number }>);
  }

  public read(): Partial<Inputs> {
    const vals = this._reader?.() as unknown as Partial<Inputs>;
    return vals || {};
  }

  public readValue(key: keyof Inputs | "enabled"): number {
    const vals = this._reader?.() as unknown as Partial<
      Record<keyof Inputs | "enabled", number | number[]>
    >;
    const val = vals[key];
    return typeof val === "number" ? val : 0;
  }

  public readArray(key: keyof Inputs | "enabled"): number[] {
    const vals = this._reader?.() as unknown as Partial<
      Record<keyof Inputs | "enabled", number | number[]>
    >;
    const val = vals[key];
    return Array.isArray(val) ? val : [];
  }

  isEnabled(): boolean {
    return this._enabled;
  }

  setEnabled(enabled: boolean): void {
    this._enabled = !!enabled;
    // Propagate to GPU uniform if available
    if (this._writer) {
      this._writer({ enabled: this._enabled ? 1 : 0 } as unknown as Partial<
        Inputs & { enabled: number }
      >);
    }
  }

  abstract webgpu(): WebGPUDescriptor<Inputs, StateKeys>;
  abstract cpu(): CPUDescriptor<Inputs, StateKeys>;
  webgl2(): WebGL2Descriptor<Inputs, StateKeys> {
    throw new Error(`Module ${this.name} does not support WebGL2 runtime`);
  }
}

export interface WebGPUForceDescriptor<
  Inputs extends Record<string, number | number[]> = Record<
    string,
    number | number[]
  >,
  StateKeys extends string | number | symbol = string
> {
  states?: readonly StateKeys[];
  global?: (args: {
    getUniform: (id: keyof Inputs, index?: number | string) => string;
    getLength: (id: keyof Inputs) => string;
  }) => string;
  state?: (args: {
    particleVar: string;
    dtVar: string;
    maxSizeVar: string;
    getUniform: (id: keyof Inputs, index?: number | string) => string;
    getLength: (id: keyof Inputs) => string;
    setState: (name: StateKeys, valueExpr: string) => string;
  }) => string;
  apply?: (args: {
    particleVar: string;
    dtVar: string;
    maxSizeVar: string;
    getUniform: (id: keyof Inputs, index?: number | string) => string;
    getLength: (id: keyof Inputs) => string;
    getState: (name: StateKeys, pidVar?: string) => string;
  }) => string;
  constrain?: (args: {
    particleVar: string;
    dtVar: string;
    maxSizeVar: string;
    getUniform: (id: keyof Inputs, index?: number | string) => string;
    getLength: (id: keyof Inputs) => string;
    getState: (name: StateKeys, pidVar?: string) => string;
  }) => string;
  correct?: (args: {
    particleVar: string;
    dtVar: string;
    maxSizeVar: string;
    prevPosVar: string;
    postPosVar: string;
    getUniform: (id: keyof Inputs, index?: number | string) => string;
    getLength: (id: keyof Inputs) => string;
    getState: (name: StateKeys, pidVar?: string) => string;
  }) => string;
}

export type FullscreenRenderPass<
  Inputs extends Record<string, number | number[]> = Record<
    string,
    number | number[]
  >
> = {
  kind: RenderPassKind.Fullscreen;
  vertex?: (args: {
    getUniform: (
      id: keyof Inputs | "canvasWidth" | "canvasHeight",
      index?: number | string
    ) => string;
    getLength: (id: keyof Inputs) => string;
  }) => string;
  globals?: (args: {
    getUniform: (id: keyof Inputs, index?: number | string) => string;
    getLength: (id: keyof Inputs) => string;
  }) => string;
  fragment: (args: {
    getUniform: (
      id:
        | keyof Inputs
        | "canvasWidth"
        | "canvasHeight"
        | "clearColorR"
        | "clearColorG"
        | "clearColorB",
      index?: number | string
    ) => string;
    getLength: (id: keyof Inputs) => string;
    sampleScene: (uvExpr: string) => string;
  }) => string;
  bindings: (keyof Inputs)[];
  readsScene?: boolean;
  writesScene?: true;
  instanced?: boolean;
  // Optional: override instance count by the length of this array input
  instanceFrom?: keyof Inputs;
};

export enum RenderPassKind {
  Fullscreen = "fullscreen",
  Compute = "compute",
}

export type ComputeRenderPass<
  Inputs extends Record<string, number | number[]> = Record<
    string,
    number | number[]
  >
> = {
  kind: RenderPassKind.Compute;
  kernel: (args: {
    getUniform: (
      id:
        | keyof Inputs
        | "canvasWidth"
        | "canvasHeight"
        | "clearColorR"
        | "clearColorG"
        | "clearColorB",
      index?: number | string
    ) => string;
    getLength: (id: keyof Inputs) => string;
    readScene: (coordsExpr: string) => string;
    writeScene: (coordsExpr: string, colorExpr: string) => string;
  }) => string;
  bindings: (keyof Inputs)[];
  readsScene?: boolean;
  writesScene?: true;
  workgroupSize?: [number, number, number];
  globals?: (args: {
    getUniform: (id: keyof Inputs, index?: number | string) => string;
    getLength: (id: keyof Inputs) => string;
  }) => string;
};

export type RenderPass<
  Inputs extends Record<string, number | number[]> = Record<
    string,
    number | number[]
  >
> = FullscreenRenderPass<Inputs> | ComputeRenderPass<Inputs>;

export interface WebGPURenderDescriptor<
  Inputs extends Record<string, number | number[]> = Record<
    string,
    number | number[]
  >
> {
  passes: Array<RenderPass<Inputs>>;
}

export type WebGPUDescriptor<
  Inputs extends Record<string, number | number[]> = Record<
    string,
    number | number[]
  >,
  StateKeys extends string | number | symbol = string
> = WebGPUForceDescriptor<Inputs, StateKeys> | WebGPURenderDescriptor<Inputs>;

export interface CPUForceDescriptor<
  Inputs extends Record<string, number | number[]> = Record<
    string,
    number | number[]
  >,
  StateKeys extends string | number | symbol = never
> {
  states?: readonly StateKeys[];
  state?: (args: {
    particle: Particle;
    getNeighbors: (
      position: { x: number; y: number },
      radius: number
    ) => Particle[];
    dt: number;
    input: Inputs;
    setState: (name: StateKeys, value: number) => void;
    view: View;
    index: number;
    particles: Particle[];
    getImageData: (
      x: number,
      y: number,
      width: number,
      height: number
    ) => ImageData | null;
  }) => void;
  apply?: (args: {
    particle: Particle;
    getNeighbors: (
      position: { x: number; y: number },
      radius: number
    ) => Particle[];
    dt: number;
    maxSize: number;
    input: Inputs;
    getState: (name: StateKeys, pid?: number) => number;
    view: View;
    index: number;
    particles: Particle[];
    getImageData: (
      x: number,
      y: number,
      width: number,
      height: number
    ) => ImageData | null;
  }) => void;
  constrain?: (args: {
    particle: Particle;
    getNeighbors: (
      position: { x: number; y: number },
      radius: number
    ) => Particle[];
    dt: number;
    maxSize: number;
    input: Inputs;
    getState: (name: StateKeys, pid?: number) => number;
    view: View;
    index: number;
    particles: Particle[];
    getImageData: (
      x: number,
      y: number,
      width: number,
      height: number
    ) => ImageData | null;
  }) => void;
  correct?: (args: {
    particle: Particle;
    getNeighbors: (
      position: { x: number; y: number },
      radius: number
    ) => Particle[];
    dt: number;
    maxSize: number;
    prevPos: { x: number; y: number };
    postPos: { x: number; y: number };
    input: Inputs;
    getState: (name: StateKeys, pid?: number) => number;
    view: View;
    index: number;
    particles: Particle[];
    getImageData: (
      x: number,
      y: number,
      width: number,
      height: number
    ) => ImageData | null;
  }) => void;
}

export interface CPURenderUtils {
  formatColor(color: { r: number; g: number; b: number; a: number }): string;
  drawCircle(
    x: number,
    y: number,
    radius: number,
    color: { r: number; g: number; b: number; a: number }
  ): void;
  drawRect(
    x: number,
    y: number,
    width: number,
    height: number,
    color: { r: number; g: number; b: number; a: number }
  ): void;
}

export enum CanvasComposition {
  // Module needs a clear canvas to work properly (default for most render modules)
  RequiresClear = "requiresClear",
  // Module handles its own background/clearing (e.g. trails with fade)
  HandlesBackground = "handlesBackground",
  // Module renders on top of whatever is there (additive effects)
  Additive = "additive",
}

export interface CPURenderDescriptor<
  Inputs extends Record<string, number | number[]> = Record<
    string,
    number | number[]
  >
> {
  // How this module composes with the canvas background
  composition?: CanvasComposition;

  // Optional setup phase (called once per frame before particles)
  setup?: (args: {
    context: CanvasRenderingContext2D;
    input: Inputs;
    view: View;
    clearColor: { r: number; g: number; b: number; a: number };
    utils: CPURenderUtils;
    particles: Particle[];
  }) => void;

  // Optional per-particle rendering (called for each visible particle with transformed coordinates)
  render?: (args: {
    context: CanvasRenderingContext2D;
    particle: Particle;
    screenX: number;
    screenY: number;
    screenSize: number;
    input: Inputs;
    utils: CPURenderUtils;
  }) => void;

  // Optional teardown phase (called once per frame after all particles)
  teardown?: (args: {
    context: CanvasRenderingContext2D;
    input: Inputs;
    utils: CPURenderUtils;
  }) => void;
}

export type CPUDescriptor<
  Inputs extends Record<string, number | number[]> = Record<
    string,
    number | number[]
  >,
  StateKeys extends string | number | symbol = string
> = CPUForceDescriptor<Inputs, StateKeys> | CPURenderDescriptor<Inputs>;

// WebGL2 descriptor types (placeholder for future implementation)
// For now, WebGL2 modules will have similar structure to WebGPU
export type WebGL2ForceDescriptor<
  Inputs extends Record<string, number | number[]> = Record<
    string,
    number | number[]
  >,
  StateKeys extends string | number | symbol = string
> = WebGPUForceDescriptor<Inputs, StateKeys>;

export type WebGL2RenderDescriptor<
  Inputs extends Record<string, number | number[]> = Record<
    string,
    number | number[]
  >
> = WebGPURenderDescriptor<Inputs>;

export type WebGL2Descriptor<
  Inputs extends Record<string, number | number[]> = Record<
    string,
    number | number[]
  >,
  StateKeys extends string | number | symbol = string
> = WebGL2ForceDescriptor<Inputs, StateKeys> | WebGL2RenderDescriptor<Inputs>;
