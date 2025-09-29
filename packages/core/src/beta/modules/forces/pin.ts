/**
 * Pin (Force Module)
 *
 * Pins specific particles in place by setting their position to the previous position
 * and velocity to zero during the correct phase. This effectively stops physics
 * interactions for the pinned particles.
 */
import {
  Module,
  type WebGPUDescriptor,
  ModuleRole,
  CPUDescriptor,
  DataType,
} from "../../module";

type PinInputs = {
  pinnedParticleIndexes: number[];
};

export class Pin extends Module<"pin", PinInputs> {
  readonly name = "pin" as const;
  readonly role = ModuleRole.Force;
  readonly inputs = {
    pinnedParticleIndexes: DataType.ARRAY,
  } as const;

  constructor(opts?: { enabled?: boolean; pinnedParticleIndexes?: number[] }) {
    super();
    this.write({
      pinnedParticleIndexes: opts?.pinnedParticleIndexes ?? [],
    });
    if (opts?.enabled !== undefined) {
      this.setEnabled(!!opts.enabled);
    }
  }

  setPinnedParticleIndexes(indexes: number[]): void {
    this.write({ pinnedParticleIndexes: indexes });
  }

  getPinnedParticleIndexes(): number[] {
    return this.readArray("pinnedParticleIndexes");
  }

  webgpu(): WebGPUDescriptor<PinInputs> {
    return {
      correct: ({ particleVar, prevPosVar, getUniform, getLength }) => {
        const lengthExpr = getLength("pinnedParticleIndexes");
        const arrayAccessExpr = getUniform("pinnedParticleIndexes", "i");
        const code = `
  // Pin module correct phase - DEBUG
  let pinnedCount = ${lengthExpr};
  var isPinned = false;
  
  for (var i = 0u; i < pinnedCount; i++) {
    let pinnedIndex = u32(${arrayAccessExpr});
    if (index == pinnedIndex) {
      isPinned = true;
      break;
    }
  }
  
  // If pinned, restore previous position and zero velocity
  if (isPinned) {
    ${particleVar}.position = ${prevPosVar};
    ${particleVar}.velocity = vec2<f32>(0.0, 0.0);
  }
`;
        return code;
      },
    };
  }

  cpu(): CPUDescriptor<PinInputs> {
    return {
      correct: ({ particle, prevPos, input, index }) => {
        // Check if current particle index is in the pinned list
        const isPinned = input.pinnedParticleIndexes.includes(index);

        if (isPinned) {
          // Restore previous position and zero velocity
          particle.position.x = prevPos.x;
          particle.position.y = prevPos.y;
          particle.velocity.x = 0;
          particle.velocity.y = 0;
        }
      },
    };
  }
}
