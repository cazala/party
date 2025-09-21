import { WebGPUParticle } from "./interfaces";

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

export abstract class Module<
  Name extends string = string,
  BindingKeys extends BindingKeysBase = BindingKeysBase,
  StateKeys extends string = any
> {
  private _writer: ((values: Partial<Record<string, number>>) => void) | null =
    null;
  private _reader: (() => Partial<Record<string, number>>) | null = null;
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

  protected write(values: Partial<Record<BindingKeys, number>>): void {
    // Binding keys are narrowed by the generic; cast to the writer's accepted shape
    this._writer?.(values as unknown as Partial<Record<string, number>>);
  }

  protected read(): Partial<Record<BindingKeys, number>> {
    const vals = this._reader?.() as unknown as Partial<
      Record<BindingKeys, number>
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

  abstract webgpu(): WebGPUDescriptor<Name, BindingKeys, StateKeys>;
  abstract cpu(): CPUDescriptor<Name, BindingKeys, StateKeys>;
}

export enum RenderPassKind {
  Fullscreen = "fullscreen",
  Compute = "compute",
}

type BindingKeysBase = "enabled" | string;

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
  Keys extends string = string,
  StateKeys extends string = string
> extends BaseDescriptor<Name> {
  role: ModuleRole.Force;
  states?: readonly StateKeys[];
  global?: (args: { getUniform: (id: Keys) => string }) => string;
  state?: (args: {
    particleVar: string;
    dtVar: string;
    getUniform: (id: Keys) => string;
    setState: (name: StateKeys, valueExpr: string) => string;
  }) => string;
  apply?: (args: {
    particleVar: string;
    dtVar: string;
    getUniform: (id: Keys) => string;
    getState: (name: StateKeys, pidVar?: string) => string;
  }) => string;
  constrain?: (args: {
    particleVar: string;
    dtVar: string;
    getUniform: (id: Keys) => string;
    getState: (name: StateKeys, pidVar?: string) => string;
  }) => string;
  correct?: (args: {
    particleVar: string;
    dtVar: string;
    getUniform: (id: Keys) => string;
    getState: (name: StateKeys, pidVar?: string) => string;
  }) => string;
}

export type FullscreenRenderPass<Keys extends string = string> = {
  kind: RenderPassKind.Fullscreen;
  vertex?: (args: {
    getUniform: (id: Keys | "canvasWidth" | "canvasHeight") => string;
  }) => string;
  globals?: (args: { getUniform: (id: Keys) => string }) => string;
  fragment: (args: {
    getUniform: (
      id:
        | Keys
        | "canvasWidth"
        | "canvasHeight"
        | "clearColorR"
        | "clearColorG"
        | "clearColorB"
    ) => string;
    sampleScene: (uvExpr: string) => string;
  }) => string;
  bindings: readonly Keys[];
  readsScene?: boolean;
  writesScene?: true;
  instanced?: boolean;
};

export type ComputeRenderPass<Keys extends string = string> = {
  kind: RenderPassKind.Compute;
  kernel: (args: {
    getUniform: (
      id:
        | Keys
        | "canvasWidth"
        | "canvasHeight"
        | "clearColorR"
        | "clearColorG"
        | "clearColorB"
    ) => string;
    readScene: (coordsExpr: string) => string;
    writeScene: (coordsExpr: string, colorExpr: string) => string;
  }) => string;
  bindings: readonly Keys[];
  readsScene?: boolean;
  writesScene?: true;
  workgroupSize?: [number, number, number];
  globals?: (args: { getUniform: (id: Keys) => string }) => string;
};

export type RenderPass<Keys extends string = string> =
  | FullscreenRenderPass<Keys>
  | ComputeRenderPass<Keys>;

export interface WebGPURenderDescriptor<
  Name extends string = string,
  Keys extends string = string
> extends BaseDescriptor<Name> {
  role: ModuleRole.Render;
  passes: Array<RenderPass<Keys>>;
}

export type WebGPUDescriptor<
  Name extends string = string,
  Keys extends string = string,
  StateKeys extends string = never
> =
  | WebGPUForceDescriptor<Name, Keys, StateKeys>
  | WebGPURenderDescriptor<Name, Keys>;

export interface CPUForceDescriptor<
  Name extends string = string,
  Keys extends string = string,
  StateKeys extends string = never
> extends BaseDescriptor<Name, Keys> {
  role: ModuleRole.Force;
  states?: readonly StateKeys[];
  global?: (args: { getUniform: (id: Keys) => string }) => string;
  state?: (args: {
    particle: WebGPUParticle;
    getNeighbors: (
      position: { x: number; y: number },
      radius: number
    ) => WebGPUParticle[];
    dt: string;
    setState: (name: StateKeys, value: number) => string;
  }) => string;
  apply?: (args: {
    particle: WebGPUParticle;
    getNeighbors: (
      position: { x: number; y: number },
      radius: number
    ) => WebGPUParticle[];
    dt: string;
    values: Record<Keys, number>;
    state: readonly Record<StateKeys, number>[];
  }) => string;
  constrain?: (args: {
    particle: WebGPUParticle;
    getNeighbors: (
      position: { x: number; y: number },
      radius: number
    ) => WebGPUParticle[];
    dt: string;
    values: Record<Keys, number>;
    state: readonly Record<StateKeys, number>[];
  }) => string;
  correct?: (args: {
    particle: WebGPUParticle;
    getNeighbors: (
      position: { x: number; y: number },
      radius: number
    ) => WebGPUParticle[];
    dt: string;
    values: Record<Keys, number>;
    state: readonly Record<StateKeys, number>[];
  }) => string;
}

export interface CPURenderDescriptor<
  Name extends string = string,
  Keys extends string = string
> extends BaseDescriptor<Name, Keys> {
  role: ModuleRole.Render;
  render: (args: {
    context: CanvasRenderingContext2D;
    values: Record<Keys, number>;
  }) => void;
}

export type CPUDescriptor<
  Name extends string = string,
  Keys extends string = string,
  StateKeys extends string = never
> = CPUForceDescriptor<Name, Keys, StateKeys> | CPURenderDescriptor<Name, Keys>;
