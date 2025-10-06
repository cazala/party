/**
 * Grab (Force Module)
 *
 * Handles particle grabbing during mouse drag operations. When a particle is grabbed
 * (grabbedIndex >= 0), it positions the particle at the specified coordinates and
 * sets its velocity to zero during the constrain phase. This approach is much more
 * efficient than syncing the entire particle array on every mouse move event.
 */
import {
  Module,
  type WebGPUDescriptor,
  ModuleRole,
  CPUDescriptor,
  DataType,
} from "../../module";

export const DEFAULT_GRAB_GRABBED_INDEX = -1;
export const DEFAULT_GRAB_POSITION_X = 0;
export const DEFAULT_GRAB_POSITION_Y = 0;

type GrabInputs = {
  grabbedIndex: number;
  positionX: number;
  positionY: number;
};

export class Grab extends Module<"grab", GrabInputs> {
  readonly name = "grab" as const;
  readonly role = ModuleRole.Force;
  readonly inputs = {
    grabbedIndex: DataType.NUMBER,
    positionX: DataType.NUMBER,
    positionY: DataType.NUMBER,
  } as const;

  constructor(opts?: {
    enabled?: boolean;
    grabbedIndex?: number;
    positionX?: number;
    positionY?: number;
  }) {
    super();

    this.write({
      grabbedIndex: opts?.grabbedIndex ?? DEFAULT_GRAB_GRABBED_INDEX,
      positionX: opts?.positionX ?? DEFAULT_GRAB_POSITION_X,
      positionY: opts?.positionY ?? DEFAULT_GRAB_POSITION_Y,
    });

    if (opts?.enabled !== undefined) {
      this.setEnabled(!!opts.enabled);
    }
  }

  // Input setters
  setGrabbedIndex(value: number): void {
    this.write({ grabbedIndex: Math.floor(value) });
  }

  setPositionX(value: number): void {
    this.write({ positionX: value });
  }

  setPositionY(value: number): void {
    this.write({ positionY: value });
  }

  setPosition(position: { x: number; y: number }): void {
    this.write({ positionX: position.x, positionY: position.y });
  }

  // Input getters
  getGrabbedIndex(): number {
    return this.readValue("grabbedIndex");
  }

  getPositionX(): number {
    return this.readValue("positionX");
  }

  getPositionY(): number {
    return this.readValue("positionY");
  }

  getPosition(): { x: number; y: number } {
    return {
      x: this.getPositionX(),
      y: this.getPositionY(),
    };
  }

  // Convenience methods
  grabParticle(index: number, position: { x: number; y: number }): void {
    this.write({
      grabbedIndex: index,
      positionX: position.x,
      positionY: position.y,
    });
  }

  releaseParticle(): void {
    this.setGrabbedIndex(-1);
  }

  isGrabbing(): boolean {
    return this.getGrabbedIndex() >= 0;
  }

  webgpu(): WebGPUDescriptor<GrabInputs> {
    return {
      correct: ({ getUniform }) => `{
  let grabbedIndex = ${getUniform("grabbedIndex")};
  let particleCount = arrayLength(&particles);
  if (grabbedIndex >= 0.0 && u32(grabbedIndex) < particleCount && particleCount > 0u) {
    let idx = u32(grabbedIndex);
    if (particles[idx].mass > 0.0) {
      // Position the grabbed particle at the target position
      particles[idx].position.x = ${getUniform("positionX")};
      particles[idx].position.y = ${getUniform("positionY")};
      
      // Set velocity to zero to prevent drift
      particles[idx].velocity.x = 0.0;
      particles[idx].velocity.y = 0.0;
    }
  }
}`,
    };
  }

  cpu(): CPUDescriptor<GrabInputs> {
    return {
      correct: ({ particles, input }) => {
        const grabbedIndex = Math.floor(input.grabbedIndex);

        if (grabbedIndex >= 0 && grabbedIndex < particles.length && particles.length > 0) {
          const particle = particles[grabbedIndex];

          // Only grab particles that are not pinned (mass > 0)
          if (particle && particle.mass > 0) {
            // Position the grabbed particle at the target position
            particle.position.x = input.positionX;
            particle.position.y = input.positionY;

            // Set velocity to zero to prevent drift
            particle.velocity.x = 0;
            particle.velocity.y = 0;
          }
        }
      },
    };
  }
}
