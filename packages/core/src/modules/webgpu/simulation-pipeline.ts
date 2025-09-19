import type { Program } from "./builders/module-builder";
import type { GPUResources } from "./gpu-resources";

export class SimulationPipeline {
  private program: Program | null = null;

  initialize(resources: GPUResources, program: Program): void {
    this.program = program;
    resources.buildComputeLayouts(program);
    resources.buildComputePipelines(program.code);
  }

  runPasses(
    encoder: GPUCommandEncoder,
    resources: GPUResources,
    params: {
      particleCount: number;
      gridCellCount: number;
      workgroupSize: number;
      constrainIterations?: number;
    }
  ): void {
    if (!this.program) throw new Error("SimulationPipeline not initialized");
    const bindGroup = resources.createComputeBindGroup(this.program);
    const groups = Math.ceil(params.particleCount / params.workgroupSize);
    const pipelines = resources.getSimulationPipelines();

    if (pipelines.gridClear && params.gridCellCount > 0) {
      const pass = encoder.beginComputePass();
      pass.setBindGroup(0, bindGroup);
      pass.setPipeline(pipelines.gridClear);
      const clearGroups = Math.ceil(
        params.gridCellCount / params.workgroupSize
      );
      if (clearGroups > 0) pass.dispatchWorkgroups(clearGroups);
      pass.end();
    }

    if (pipelines.gridBuild && params.particleCount > 0) {
      const pass = encoder.beginComputePass();
      pass.setBindGroup(0, bindGroup);
      pass.setPipeline(pipelines.gridBuild);
      const buildGroups = Math.ceil(
        params.particleCount / params.workgroupSize
      );
      if (buildGroups > 0) pass.dispatchWorkgroups(buildGroups);
      pass.end();
    }

    if (
      pipelines.state &&
      pipelines.apply &&
      pipelines.integrate &&
      pipelines.constrain &&
      pipelines.correct
    ) {
      if (groups > 0 && pipelines.state) {
        const pass = encoder.beginComputePass();
        pass.setBindGroup(0, bindGroup);
        pass.setPipeline(pipelines.state);
        pass.dispatchWorkgroups(groups);
        pass.end();
      }

      if (groups > 0 && pipelines.apply) {
        const pass = encoder.beginComputePass();
        pass.setBindGroup(0, bindGroup);
        pass.setPipeline(pipelines.apply);
        pass.dispatchWorkgroups(groups);
        pass.end();
      }

      if (groups > 0 && pipelines.integrate) {
        const pass = encoder.beginComputePass();
        pass.setBindGroup(0, bindGroup);
        pass.setPipeline(pipelines.integrate);
        pass.dispatchWorkgroups(groups);
        pass.end();
      }

      if (groups > 0 && pipelines.constrain) {
        const iterations = Math.max(1, params.constrainIterations ?? 1);
        for (let i = 0; i < iterations; i++) {
          const pass = encoder.beginComputePass();
          pass.setBindGroup(0, bindGroup);
          pass.setPipeline(pipelines.constrain);
          pass.dispatchWorkgroups(groups);
          pass.end();
        }
      }

      if (groups > 0 && pipelines.correct) {
        const pass = encoder.beginComputePass();
        pass.setBindGroup(0, bindGroup);
        pass.setPipeline(pipelines.correct);
        pass.dispatchWorkgroups(groups);
        pass.end();
      }
      return;
    }

    if (pipelines.main && groups > 0) {
      const simPass = encoder.beginComputePass();
      simPass.setBindGroup(0, bindGroup);
      simPass.setPipeline(pipelines.main);
      simPass.dispatchWorkgroups(groups);
      simPass.end();
    }
  }
}
