import type { ModuleDescriptor } from "./descriptors";
export type { ModuleDescriptor } from "./descriptors";

type BindingKeysBase = "enabled" | string;

export abstract class Module<
  Name extends string,
  BindingKeys extends BindingKeysBase,
  StateKeys extends string = never
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

  abstract descriptor(): ModuleDescriptor<Name, BindingKeys, StateKeys>;
}

// Deprecated: previously supported mixing descriptors and modules
// Now we only support ComputeModule instances across the codebase.

// Types moved to builder/compute-builder.ts

// capitalize helper removed with builder migration

// Note: all modules are instances of ComputeModule now

// buildComputeProgram moved to builder/compute-builder.ts
