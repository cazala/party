/**
 * Interaction (Force Module)
 *
 * Mouse-driven attract/repel impulse applied within a radius when the selected
 * input button is active. Strength falls off to zero at the edge of the radius.
 */
import {
  Module,
  type WebGPUDescriptor,
  type WebGL2Descriptor,
  ModuleRole,
  CPUDescriptor,
  DataType,
} from "../../module";

export const DEFAULT_INTERACTION_MODE: "attract" | "repel" = "attract";
export const DEFAULT_INTERACTION_STRENGTH = 10000;
export const DEFAULT_INTERACTION_RADIUS = 500;

// action: 0 -> click (left), 1 -> right_click
// mode: 0 -> attract, 1 -> repel

type InteractionInputs = {
  mode: number;
  strength: number;
  radius: number;
  positionX: number;
  positionY: number;
  active: number;
};

export class Interaction extends Module<"interaction", InteractionInputs> {
  readonly name = "interaction" as const;
  readonly role = ModuleRole.Force;
  readonly inputs = {
    mode: DataType.NUMBER,
    strength: DataType.NUMBER,
    radius: DataType.NUMBER,
    positionX: DataType.NUMBER,
    positionY: DataType.NUMBER,
    active: DataType.NUMBER,
  } as const;

  constructor(opts?: {
    enabled?: boolean;
    action?: "click" | "right_click";
    mode?: "attract" | "repel";
    strength?: number;
    radius?: number;
    position?: { x: number; y: number };
    active?: boolean;
  }) {
    super();
    const mode = (opts?.mode ?? DEFAULT_INTERACTION_MODE) === "repel" ? 1 : 0;
    this.write({
      mode,
      strength: opts?.strength ?? DEFAULT_INTERACTION_STRENGTH,
      radius: opts?.radius ?? DEFAULT_INTERACTION_RADIUS,
      positionX: opts?.position?.x ?? 0,
      positionY: opts?.position?.y ?? 0,
      active: opts?.active ? 1 : 0,
    });
    if (opts?.enabled !== undefined) {
      this.setEnabled(!!opts.enabled);
    }
  }

  setMode(v: "attract" | "repel"): void {
    this.write({ mode: v === "repel" ? 1 : 0 });
  }
  setStrength(v: number): void {
    this.write({ strength: v });
  }
  setRadius(v: number): void {
    this.write({ radius: v });
  }
  setPosition(x: number, y: number): void {
    this.write({ positionX: x, positionY: y });
  }
  setActive(active: boolean): void {
    this.write({ active: active ? 1 : 0 });
  }

  getMode(): number {
    return this.readValue("mode");
  }
  getStrength(): number {
    return this.readValue("strength");
  }
  getRadius(): number {
    return this.readValue("radius");
  }
  getPosition(): { x: number; y: number } {
    return {
      x: this.readValue("positionX"),
      y: this.readValue("positionY"),
    };
  }
  isActive(): boolean {
    return this.readValue("active") === 1;
  }

  webgpu(): WebGPUDescriptor<InteractionInputs> {
    return {
      apply: ({ particleVar, getUniform }) => `{
  if (${getUniform("active")} == 0.0 ) { return; }
  // Compute vector from particle to position
  let dx = ${getUniform("positionX")} - ${particleVar}.position.x;
  let dy = ${getUniform("positionY")} - ${particleVar}.position.y;
  let dist2 = dx*dx + dy*dy;
  let rad = ${getUniform("radius")};
  let r2 = rad * rad;
  if (dist2 <= 0.0 || dist2 > r2) { return; }
  let dist = sqrt(dist2);
  let dir = vec2<f32>(dx, dy) / dist;
  let falloff = 1.0 - (dist / rad);
  let f = ${getUniform("strength")} * falloff;
  let mode = ${getUniform("mode")} ;
  let force = select(dir * f, -dir * f, mode == 1.0);
  ${particleVar}.acceleration += force;
}`,
    };
  }

  cpu(): CPUDescriptor<InteractionInputs> {
    return {
      apply: ({ particle, input }) => {
        if (!input.active) return;

        // Compute vector from particle to position
        const dx = input.positionX - particle.position.x;
        const dy = input.positionY - particle.position.y;
        const dist2 = dx * dx + dy * dy;
        const rad = input.radius;
        const r2 = rad * rad;

        if (dist2 <= 0 || dist2 > r2) return;

        const dist = Math.sqrt(dist2);
        const dirX = dx / dist;
        const dirY = dy / dist;
        const falloff = 1.0 - dist / rad;
        const f = input.strength * falloff;
        const mode = input.mode;

        // mode 0 = attract, mode 1 = repel
        const forceX = mode === 1 ? -dirX * f : dirX * f;
        const forceY = mode === 1 ? -dirY * f : dirY * f;

        particle.acceleration.x += forceX;
        particle.acceleration.y += forceY;
      },
    };
  }

  webgl2(): WebGL2Descriptor<InteractionInputs> {
    return {
      apply: ({ particleVar, getUniform }) => `{
  if (${getUniform("active")} == 0.0 ) { return; }
  // Compute vector from particle to position
  let dx = ${getUniform("positionX")} - ${particleVar}.position.x;
  let dy = ${getUniform("positionY")} - ${particleVar}.position.y;
  let dist2 = dx*dx + dy*dy;
  let rad = ${getUniform("radius")};
  let r2 = rad * rad;
  if (dist2 <= 0.0 || dist2 > r2) { return; }
  let dist = sqrt(dist2);
  let dir = vec2<f32>(dx, dy) / dist;
  let falloff = 1.0 - (dist / rad);
  let f = ${getUniform("strength")} * falloff;
  let mode = ${getUniform("mode")} ;
  let force = select(dir * f, -dir * f, mode == 1.0);
  ${particleVar}.acceleration += force;
}`,
    };
  }
}
