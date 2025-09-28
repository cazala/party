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

type InputKeysBase = "enabled" | string;

export abstract class Module<
  Name extends string = string,
  InputKeys extends InputKeysBase = InputKeysBase,
  StateKeys extends string = any
> {
  abstract readonly name: Name;
  abstract readonly role: ModuleRole;
  abstract readonly keys: readonly InputKeys[];

  private _state: Record<StateKeys, number> = {} as Record<StateKeys, number>;
  private _writer: ((values: Partial<Record<string, number>>) => void) | null =
    (values: Partial<Record<string, number>>) => {
      for (const key of Object.keys(values)) {
        this._state[key as StateKeys] = values[key as StateKeys] ?? 0;
      }
    };
  private _reader: (() => Partial<Record<string, number>>) | null = () => {
    return this._state;
  };
  private _enabled: boolean = true;

  attachUniformWriter(
    writer: (values: Partial<Record<string, number>>) => void
  ): void {
    const values = this.read();
    this._writer = writer;
    writer({ ...values, enabled: this._enabled ? 1 : 0 });
  }

  attachUniformReader(reader: () => Partial<Record<string, number>>): void {
    this._reader = reader;
  }

  public write(values: Partial<Record<InputKeys, number>>): void {
    // Binding keys are narrowed by the generic; cast to the writer's accepted shape
    this._writer?.(values as unknown as Partial<Record<string, number>>);
  }

  public read(): Partial<Record<InputKeys, number>> {
    const vals = this._reader?.() as unknown as Partial<
      Record<InputKeys, number>
    >;
    return vals || {};
  }

  public readValue(key: InputKeys): number {
    const vals = this._reader?.() as unknown as Partial<
      Record<InputKeys, number>
    >;
    return vals[key] ?? 0;
  }

  isEnabled(): boolean {
    return this._enabled;
  }

  setEnabled(enabled: boolean): void {
    this._enabled = !!enabled;
    // Propagate to GPU uniform if available
    if (this._writer) {
      this._writer({ enabled: this._enabled ? 1 : 0 });
    }
  }

  abstract webgpu(): WebGPUDescriptor<InputKeys, StateKeys>;
  abstract cpu(): CPUDescriptor<InputKeys, StateKeys>;
}

export interface BaseDescriptor {
  // Base descriptors no longer need name, role, keys as they're in the Module class
}

export interface WebGPUForceDescriptor<
  InputKeys extends string = string,
  StateKeys extends string = string
> extends BaseDescriptor {
  states?: readonly StateKeys[];
  global?: (args: { getUniform: (id: InputKeys) => string }) => string;
  state?: (args: {
    particleVar: string;
    dtVar: string;
    maxSizeVar: string;
    getUniform: (id: InputKeys) => string;
    setState: (name: StateKeys, valueExpr: string) => string;
  }) => string;
  apply?: (args: {
    particleVar: string;
    dtVar: string;
    maxSizeVar: string;
    getUniform: (id: InputKeys) => string;
    getState: (name: StateKeys, pidVar?: string) => string;
  }) => string;
  constrain?: (args: {
    particleVar: string;
    dtVar: string;
    maxSizeVar: string;
    getUniform: (id: InputKeys) => string;
    getState: (name: StateKeys, pidVar?: string) => string;
  }) => string;
  correct?: (args: {
    particleVar: string;
    dtVar: string;
    maxSizeVar: string;
    prevPosVar: string;
    postPosVar: string;
    getUniform: (id: InputKeys) => string;
    getState: (name: StateKeys, pidVar?: string) => string;
  }) => string;
}

export type FullscreenRenderPass<InputKeys extends string = string> = {
  kind: RenderPassKind.Fullscreen;
  vertex?: (args: {
    getUniform: (id: InputKeys | "canvasWidth" | "canvasHeight") => string;
  }) => string;
  globals?: (args: { getUniform: (id: InputKeys) => string }) => string;
  fragment: (args: {
    getUniform: (
      id:
        | InputKeys
        | "canvasWidth"
        | "canvasHeight"
        | "clearColorR"
        | "clearColorG"
        | "clearColorB"
    ) => string;
    sampleScene: (uvExpr: string) => string;
  }) => string;
  bindings: readonly InputKeys[];
  readsScene?: boolean;
  writesScene?: true;
  instanced?: boolean;
};

export enum RenderPassKind {
  Fullscreen = "fullscreen",
  Compute = "compute",
}

export type ComputeRenderPass<InputKeys extends string = string> = {
  kind: RenderPassKind.Compute;
  kernel: (args: {
    getUniform: (
      id:
        | InputKeys
        | "canvasWidth"
        | "canvasHeight"
        | "clearColorR"
        | "clearColorG"
        | "clearColorB"
    ) => string;
    readScene: (coordsExpr: string) => string;
    writeScene: (coordsExpr: string, colorExpr: string) => string;
  }) => string;
  bindings: readonly InputKeys[];
  readsScene?: boolean;
  writesScene?: true;
  workgroupSize?: [number, number, number];
  globals?: (args: { getUniform: (id: InputKeys) => string }) => string;
};

export type RenderPass<Keys extends string = string> =
  | FullscreenRenderPass<Keys>
  | ComputeRenderPass<Keys>;

export interface WebGPURenderDescriptor<InputKeys extends string = string>
  extends BaseDescriptor {
  passes: Array<RenderPass<InputKeys>>;
}

export type WebGPUDescriptor<
  InputKeys extends string = string,
  StateKeys extends string = never
> =
  | WebGPUForceDescriptor<InputKeys, StateKeys>
  | WebGPURenderDescriptor<InputKeys>;

export interface CPUForceDescriptor<
  InputKeys extends string = string,
  StateKeys extends string = never
> extends BaseDescriptor {
  states?: readonly StateKeys[];
  state?: (args: {
    particle: Particle;
    getNeighbors: (
      position: { x: number; y: number },
      radius: number
    ) => Particle[];
    dt: number;
    input: Record<InputKeys, number>;
    setState: (name: StateKeys, value: number) => void;
    view: View;
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
    input: Record<InputKeys, number>;
    getState: (name: StateKeys, pid?: number) => number;
    view: View;
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
    input: Record<InputKeys, number>;
    getState: (name: StateKeys, pid?: number) => number;
    view: View;
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
    input: Record<InputKeys, number>;
    getState: (name: StateKeys, pid?: number) => number;
    view: View;
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

export interface CPURenderDescriptor<InputKeys extends string = string>
  extends BaseDescriptor {
  // How this module composes with the canvas background
  composition?: CanvasComposition;

  // Optional setup phase (called once per frame before particles)
  setup?: (args: {
    context: CanvasRenderingContext2D;
    input: Record<InputKeys, number>;
    view: View;
    clearColor: { r: number; g: number; b: number; a: number };
    utils: CPURenderUtils;
  }) => void;

  // Optional per-particle rendering (called for each visible particle with transformed coordinates)
  render?: (args: {
    context: CanvasRenderingContext2D;
    particle: Particle;
    screenX: number;
    screenY: number;
    screenSize: number;
    input: Record<InputKeys, number>;
    utils: CPURenderUtils;
  }) => void;

  // Optional teardown phase (called once per frame after all particles)
  teardown?: (args: {
    context: CanvasRenderingContext2D;
    input: Record<InputKeys, number>;
    utils: CPURenderUtils;
  }) => void;
}

export type CPUDescriptor<
  InputKeys extends string = string,
  StateKeys extends string = never
> = CPUForceDescriptor<InputKeys, StateKeys> | CPURenderDescriptor<InputKeys>;
