import {
  Module,
  ModuleRole,
  DataType,
  type CPUDescriptor,
  type WebGPUDescriptor,
  type GridSpec,
} from "../../module";

export type ParticleDepositGridInputs = {
  radius: number;
  strength: number;
  mode: number; // 0 = add, 1 = max, 2 = overwrite
};

export type ParticleDepositGridOptions = {
  gridModuleName: string;
  radius?: number;
  strength?: number;
  mode?: number;
};

export class ParticleDepositGrid extends Module<
  "particleDepositGrid",
  ParticleDepositGridInputs
> {
  readonly name = "particleDepositGrid" as const;
  readonly role = ModuleRole.Force;
  readonly inputs = {
    radius: DataType.NUMBER,
    strength: DataType.NUMBER,
    mode: DataType.NUMBER,
  } as const;
  private gridModuleName: string;
  private gridSpec?: GridSpec;

  constructor(options: ParticleDepositGridOptions) {
    super();
    this.gridModuleName = options.gridModuleName;
    this.write({
      radius: options.radius ?? 4,
      strength: options.strength ?? 1,
      mode: options.mode ?? 0,
    });
  }

  cpu(): CPUDescriptor<ParticleDepositGridInputs> {
    return {
      apply: ({ particle, input, getGrid }) => {
        const grid = getGrid?.(this.gridModuleName);
        if (!grid) return;
        const spec = grid.spec;
        const cellSize = spec.cellSize ?? 1;
        const origin = spec.origin ?? { x: 0, y: 0 };
        const gx = Math.floor((particle.position.x - origin.x) / cellSize);
        const gy = Math.floor((particle.position.y - origin.y) / cellSize);
        const r = Math.max(0, Math.floor(input.radius / cellSize));
        const strength = input.strength;
        const mode = Math.floor(input.mode);
        for (let dy = -r; dy <= r; dy++) {
          for (let dx = -r; dx <= r; dx++) {
            const dxw = dx * cellSize;
            const dyw = dy * cellSize;
            if (dxw * dxw + dyw * dyw > input.radius * input.radius) continue;
            const x = gx + dx;
            const y = gy + dy;
            const idx = grid.index(x, y, 0);
            const buf = grid.readBuffer as any;
            const prev = buf[idx] ?? 0;
            let next = prev;
            if (mode === 1) next = Math.max(prev, strength);
            else if (mode === 2) next = strength;
            else next = prev + strength;
            buf[idx] = next;
          }
        }
      },
    };
  }

  webgpu(): WebGPUDescriptor<ParticleDepositGridInputs> {
    const gridSpec = this.gridSpec;
    const cellSize = gridSpec?.cellSize ?? 1;
    const originX = gridSpec?.origin?.x ?? 0;
    const originY = gridSpec?.origin?.y ?? 0;
    return {
      apply: ({ particleVar, getUniform }) => {
        return `
let gx = i32(floor((${particleVar}.position.x - ${originX}) / ${cellSize}));
let gy = i32(floor((${particleVar}.position.y - ${originY}) / ${cellSize}));
let radius = ${getUniform("radius")};
let strength = ${getUniform("strength")};
let mode = i32(${getUniform("mode")});
let r = i32(max(0.0, floor(radius / ${cellSize})));
for (var dy: i32 = -r; dy <= r; dy = dy + 1) {
  for (var dx: i32 = -r; dx <= r; dx = dx + 1) {
    let dxw = f32(dx) * ${cellSize};
    let dyw = f32(dy) * ${cellSize};
    if (dxw * dxw + dyw * dyw > radius * radius) { continue; }
    let x = gx + dx;
    let y = gy + dy;
    let prev = grid_${this.gridModuleName}_read(x, y, 0u);
    var next = prev;
    if (mode == 1) { next = max(prev, strength); }
    else if (mode == 2) { next = strength; }
    else { next = prev + strength; }
    grid_${this.gridModuleName}_write(x, y, 0u, next);
  }
}
`;
      },
    } as WebGPUDescriptor<ParticleDepositGridInputs>;
  }

  getGridModuleName(): string {
    return this.gridModuleName;
  }

  attachGridSpec(spec: GridSpec): void {
    this.gridSpec = spec;
  }
}
