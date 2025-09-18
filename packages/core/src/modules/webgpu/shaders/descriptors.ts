export enum ModuleRole {
  Force = "force",
  System = "system",
  Render = "render",
}

export enum RenderPassKind {
  Fullscreen = "fullscreen",
  Compute = "compute",
}

export interface BaseModuleDescriptor<Name extends string = string> {
  name: Name;
  role: ModuleRole;
  bindings?: readonly string[];
}

export interface SystemModuleDescriptor<Name extends string = string>
  extends BaseModuleDescriptor<Name> {
  role: ModuleRole.System;
  global?: (args: { getUniform: (id: string) => string }) => string;
  entrypoints?: () => string;
}

export interface ForceModuleDescriptor<
  Name extends string = string,
  Keys extends string = string,
  StateKeys extends string = string
> extends BaseModuleDescriptor<Name> {
  role: ModuleRole.Force;
  states?: readonly StateKeys[];
  global?: (args: { getUniform: (id: Keys) => string }) => string;
  state?: (args: {
    particleVar: string;
    dtVar: string;
    getUniform: (id: Keys) => string;
    getState: (name: StateKeys, pidVar?: string) => string;
    setState: (name: StateKeys, valueExpr: string, pidVar?: string) => string;
  }) => string;
  apply?: (args: {
    particleVar: string;
    dtVar: string;
    getUniform: (id: Keys) => string;
    getState: (name: StateKeys, pidVar?: string) => string;
    setState: (name: StateKeys, valueExpr: string, pidVar?: string) => string;
  }) => string;
  constrain?: (args: {
    particleVar: string;
    dtVar: string;
    getUniform: (id: Keys) => string;
    getState: (name: StateKeys, pidVar?: string) => string;
    setState: (name: StateKeys, valueExpr: string, pidVar?: string) => string;
  }) => string;
  correct?: (args: {
    particleVar: string;
    dtVar: string;
    getUniform: (id: Keys) => string;
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

export interface RenderModuleDescriptor<
  Name extends string = string,
  Keys extends string = string
> extends BaseModuleDescriptor<Name> {
  role: ModuleRole.Render;
  passes: Array<RenderPass<Keys>>;
}

export type ModuleDescriptor<
  Name extends string = string,
  Keys extends string = string,
  StateKeys extends string = never
> =
  | SystemModuleDescriptor<Name>
  | ForceModuleDescriptor<Name, Keys, StateKeys>
  | RenderModuleDescriptor<Name, Keys>;
