import type { ComputeModuleDescriptor } from "../compute";

export const gravityModule: ComputeModuleDescriptor = {
  name: "gravity",
  role: "force",
  bindings: ["strength", "dirX", "dirY"],
  apply: ({ particleVar, dtVar, getUniform }) => `{
  let gravity_dir = vec2<f32>(${getUniform("dirX")}, ${getUniform("dirY")});
  let gravity = gravity_dir * ${getUniform("strength")};
  ${particleVar}.velocity += gravity * ${dtVar};
}`,
};
