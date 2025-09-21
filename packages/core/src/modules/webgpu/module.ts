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
    this._writer = writer;
    writer({ enabled: this._enabled ? 1 : 0 });
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

  abstract webgpu(): WebGPUDescriptor<Name, InputKeys, StateKeys>;
  abstract cpu(): CPUDescriptor<Name, InputKeys, StateKeys>;
}

export interface BaseDescriptor<
  Name extends string = string,
  Keys extends string = string
> {
  name: Name;
  role: ModuleRole;
  keys?: readonly Keys[];
}

export interface WebGPUForceDescriptor<
  Name extends string = string,
  InputKeys extends string = string,
  StateKeys extends string = string
> extends BaseDescriptor<Name> {
  role: ModuleRole.Force;
  states?: readonly StateKeys[];
  global?: (args: { getUniform: (id: InputKeys) => string }) => string;
  state?: (args: {
    particleVar: string;
    dtVar: string;
    getUniform: (id: InputKeys) => string;
    setState: (name: StateKeys, valueExpr: string) => string;
  }) => string;
  apply?: (args: {
    particleVar: string;
    dtVar: string;
    getUniform: (id: InputKeys) => string;
    getState: (name: StateKeys, pidVar?: string) => string;
  }) => string;
  constrain?: (args: {
    particleVar: string;
    dtVar: string;
    getUniform: (id: InputKeys) => string;
    getState: (name: StateKeys, pidVar?: string) => string;
  }) => string;
  correct?: (args: {
    particleVar: string;
    dtVar: string;
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

export interface WebGPURenderDescriptor<
  Name extends string = string,
  InputKeys extends string = string
> extends BaseDescriptor<Name> {
  role: ModuleRole.Render;
  passes: Array<RenderPass<InputKeys>>;
}

export type WebGPUDescriptor<
  Name extends string = string,
  InputKeys extends string = string,
  StateKeys extends string = never
> =
  | WebGPUForceDescriptor<Name, InputKeys, StateKeys>
  | WebGPURenderDescriptor<Name, InputKeys>;

export interface CPUForceDescriptor<
  Name extends string = string,
  InputKeys extends string = string,
  StateKeys extends string = never
> extends BaseDescriptor<Name, InputKeys> {
  role: ModuleRole.Force;
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
  }) => void;
  apply?: (args: {
    particle: Particle;
    getNeighbors: (
      position: { x: number; y: number },
      radius: number
    ) => Particle[];
    dt: number;
    input: Record<InputKeys, number>;
    getState: (name: StateKeys, pid?: number) => number;
    view: View;
  }) => void;
  constrain?: (args: {
    particle: Particle;
    getNeighbors: (
      position: { x: number; y: number },
      radius: number
    ) => Particle[];
    dt: number;
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
    input: Record<InputKeys, number>;
    getState: (name: StateKeys, pid?: number) => number;
    view: View;
  }) => void;
}

export interface CPURenderDescriptor<
  Name extends string = string,
  InputKeys extends string = string
> extends BaseDescriptor<Name, InputKeys> {
  role: ModuleRole.Render;
  render: (args: {
    context: CanvasRenderingContext2D;
    input: Record<InputKeys, number>;
    view: View;
    particles: Particle[];
    clearColor: { r: number; g: number; b: number; a: number };
  }) => void;
}

export type CPUDescriptor<
  Name extends string = string,
  InputKeys extends string = string,
  StateKeys extends string = never
> =
  | CPUForceDescriptor<Name, InputKeys, StateKeys>
  | CPURenderDescriptor<Name, InputKeys>;
