import {
  Module,
  type ModuleDescriptor,
  ModuleRole,
} from "../../module-descriptors";

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
  private action: number; // 0 click, 1 right_click
  private mode: number; // 0 attract, 1 repel
  private strength: number;
  private radius: number;
  private mouseX: number;
  private mouseY: number;
  private inputButton: number; // 2 = none, 0 = left, 1 = right

  constructor(opts?: {
    enabled?: boolean;
    action?: "click" | "right_click";
    mode?: "attract" | "repel";
    strength?: number;
    radius?: number;
  }) {
    super();
    this.action =
      (opts?.action ?? DEFAULT_INTERACTION_ACTION) === "right_click" ? 1 : 0;
    this.mode = (opts?.mode ?? DEFAULT_INTERACTION_MODE) === "repel" ? 1 : 0;
    this.strength = opts?.strength ?? DEFAULT_INTERACTION_STRENGTH;
    this.radius = opts?.radius ?? DEFAULT_INTERACTION_RADIUS;
    this.mouseX = 0;
    this.mouseY = 0;
    this.inputButton = 2; // none
    if (opts?.enabled !== undefined) {
      this.setEnabled(!!opts.enabled);
    }
  }

  attachUniformWriter(
    writer: (values: Partial<Record<string, number>>) => void
  ): void {
    super.attachUniformWriter(writer);
    this.write({
      action: this.action,
      mode: this.mode,
      strength: this.strength,
      radius: this.radius,
      mouseX: this.mouseX,
      mouseY: this.mouseY,
      inputButton: this.inputButton,
    });
  }

  setAction(v: "click" | "right_click"): void {
    this.action = v === "right_click" ? 1 : 0;
    this.write({ action: this.action });
  }
  setMode(v: "attract" | "repel"): void {
    this.mode = v === "repel" ? 1 : 0;
    this.write({ mode: this.mode });
  }
  setStrength(v: number): void {
    this.strength = v;
    this.write({ strength: v });
  }
  setRadius(v: number): void {
    this.radius = v;
    this.write({ radius: v });
  }
  setMousePosition(x: number, y: number): void {
    this.mouseX = x;
    this.mouseY = y;
    this.write({ mouseX: x, mouseY: y });
  }
  setInputButton(button: number): void {
    this.inputButton = button;
    this.write({ inputButton: button });
  }

  descriptor(): ModuleDescriptor<"interaction", InteractionBindingKeys> {
    return {
      name: "interaction",
      role: ModuleRole.Force,
      bindings: [
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
}
