/**
 * Interaction (Force Module)
 *
 * Mouse-driven attract/repel impulse applied within a radius when the selected
 * input button is active. Strength falls off to zero at the edge of the radius.
 */
import {
  Module,
  type WebGPUDescriptor,
  ModuleRole,
  CPUDescriptor,
} from "../../module";

type InteractionBindingKeys =
  | "action"
  | "mode"
  | "strength"
  | "radius"
  | "mouseX"
  | "mouseY"
  | "inputButton";

export const DEFAULT_INTERACTION_ACTION: "click" | "right_click" = "click";
export const DEFAULT_INTERACTION_MODE: "attract" | "repel" = "attract";
export const DEFAULT_INTERACTION_STRENGTH = 10000;
export const DEFAULT_INTERACTION_RADIUS = 500;

// action: 0 -> click (left), 1 -> right_click
// mode: 0 -> attract, 1 -> repel

export class Interaction extends Module<"interaction", InteractionBindingKeys> {
  constructor(opts?: {
    enabled?: boolean;
    action?: "click" | "right_click";
    mode?: "attract" | "repel";
    strength?: number;
    radius?: number;
  }) {
    super();
    const action =
      (opts?.action ?? DEFAULT_INTERACTION_ACTION) === "right_click" ? 1 : 0;
    const mode = (opts?.mode ?? DEFAULT_INTERACTION_MODE) === "repel" ? 1 : 0;
    this.write({
      action,
      mode,
      strength: opts?.strength ?? DEFAULT_INTERACTION_STRENGTH,
      radius: opts?.radius ?? DEFAULT_INTERACTION_RADIUS,
      mouseX: 0,
      mouseY: 0,
      inputButton: 2,
    });
    if (opts?.enabled !== undefined) {
      this.setEnabled(!!opts.enabled);
    }
  }

  setAction(v: "click" | "right_click"): void {
    this.write({ action: v === "right_click" ? 1 : 0 });
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
  setMousePosition(x: number, y: number): void {
    this.write({ mouseX: x, mouseY: y });
  }
  setInputButton(button: number): void {
    this.write({ inputButton: button });
  }

  getAction(): number {
    return this.readValue("action");
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
  getMouseX(): number {
    return this.readValue("mouseX");
  }
  getMouseY(): number {
    return this.readValue("mouseY");
  }
  getInputButton(): number {
    return this.readValue("inputButton");
  }

  webgpu(): WebGPUDescriptor<"interaction", InteractionBindingKeys> {
    return {
      name: "interaction",
      role: ModuleRole.Force,
      keys: [
        "action",
        "mode",
        "strength",
        "radius",
        "mouseX",
        "mouseY",
        "inputButton",
      ] as const,
      apply: ({ particleVar, getUniform }) => `{
  if (${getUniform("inputButton")} != ${getUniform("action")} ) { return; }
  // Compute vector from particle to mouse
  let dx = ${getUniform("mouseX")} - ${particleVar}.position.x;
  let dy = ${getUniform("mouseY")} - ${particleVar}.position.y;
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

  cpu(): CPUDescriptor<"interaction", InteractionBindingKeys> {
    throw new Error("Not implemented");
  }
}
