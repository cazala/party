/**
 * Simulation (System Module)
 *
 * Declares simulation uniforms (dt, count, simStride) and emits global WGSL
 * helpers to access the shared SIM_STATE buffer used by force modules across
 * the multi-pass simulation pipeline.
 */
import {
  Module,
  type ModuleDescriptor,
  ModuleRole,
} from "../../module-descriptors";

type SimKeys = "dt" | "count" | "simStride";

export class Simulation extends Module<"simulation", SimKeys> {
  constructor() {
    super();
  }

  descriptor(): ModuleDescriptor<"simulation", SimKeys> {
    return {
      name: "simulation",
      role: ModuleRole.System,
      bindings: ["dt", "count", "simStride"],
      // Provide SIM_STATE helpers via global() so other modules can use them
      global: ({ getUniform }: any) => `
// Simulation state helpers (stride from simulation uniforms)
fn SIM_STATE_STRIDE() -> u32 { return u32(${getUniform("simStride")}); }
fn SIM_COUNT() -> u32 { return u32(${getUniform("count")}); }
fn sim_state_index(pid: u32, slot: u32) -> u32 { return pid * SIM_STATE_STRIDE() + slot; }
fn sim_state_read(pid: u32, slot: u32) -> f32 { return SIM_STATE[sim_state_index(pid, slot)]; }
fn sim_state_write(pid: u32, slot: u32, value: f32) { SIM_STATE[sim_state_index(pid, slot)] = value; }
`,
    };
  }
}
