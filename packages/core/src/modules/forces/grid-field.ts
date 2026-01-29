import {
  Module,
  ModuleRole,
  DataType,
  type CPUDescriptor,
  type WebGPUDescriptor,
  type GridSpec,
} from "../../module";

export type GridFieldForceInputs = {
  strength: number;
};

export type GridFieldForceOptions = {
  gridModuleName: string;
  strength?: number;
};

export class GridFieldForce extends Module<
  "gridField",
  GridFieldForceInputs
> {
  readonly name = "gridField" as const;
  readonly role = ModuleRole.Force;
  readonly inputs = {
    strength: DataType.NUMBER,
  } as const;
  private gridModuleName: string;
  private gridSpec?: GridSpec;

  constructor(options: GridFieldForceOptions) {
    super();
    this.gridModuleName = options.gridModuleName;
    this.write({
      strength: options.strength ?? 1,
    });
  }

  cpu(): CPUDescriptor<GridFieldForceInputs> {
    return {
      apply: ({ particle, input, getGrid }) => {
        const grid = getGrid?.(this.gridModuleName);
        if (!grid) return;
        const spec = grid.spec;
        const cellSize = spec.cellSize ?? 1;
        const origin = spec.origin ?? { x: 0, y: 0 };
        const gx = Math.floor((particle.position.x - origin.x) / cellSize);
        const gy = Math.floor((particle.position.y - origin.y) / cellSize);
        const vx =
          grid.read(gx, gy, 0) || 0;
        const vy =
          grid.channels >= 2 ? grid.read(gx, gy, 1) : vx;
        particle.acceleration.x += vx * input.strength;
        particle.acceleration.y += vy * input.strength;
      },
    };
  }

  webgpu(): WebGPUDescriptor<GridFieldForceInputs> {
    const gridSpec = this.gridSpec;
    const cellSize = gridSpec?.cellSize ?? 1;
    const originX = gridSpec?.origin?.x ?? 0;
    const originY = gridSpec?.origin?.y ?? 0;
    const channels =
      gridSpec?.channels ??
      (gridSpec?.format === "vec2f" ? 2 : gridSpec?.format === "vec4f" ? 4 : 1);
    return {
      apply: ({ particleVar, getUniform }) => {
        return `
let gx = i32(floor((${particleVar}.position.x - ${originX}) / ${cellSize}));
let gy = i32(floor((${particleVar}.position.y - ${originY}) / ${cellSize}));
let vx = grid_${this.gridModuleName}_read(gx, gy, 0u);
let vy = ${channels >= 2 ? `grid_${this.gridModuleName}_read(gx, gy, 1u)` : `vx`};
${particleVar}.acceleration += vec2<f32>(vx, vy) * ${getUniform("strength")};
`;
      },
    } as WebGPUDescriptor<GridFieldForceInputs>;
  }

  getGridModuleName(): string {
    return this.gridModuleName;
  }

  attachGridSpec(spec: GridSpec): void {
    this.gridSpec = spec;
  }
}
