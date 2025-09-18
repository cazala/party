export interface SimulationPipelines {
  gridClear?: GPUComputePipeline;
  gridBuild?: GPUComputePipeline;
  state?: GPUComputePipeline;
  apply?: GPUComputePipeline;
  integrate?: GPUComputePipeline;
  constrain?: GPUComputePipeline;
  correct?: GPUComputePipeline;
  monolithic?: GPUComputePipeline; // fallback main
}

export interface SimulationRunConfig {
  particleCount: number;
  gridCellCount: number;
  workgroupSize: number;
  constrainIterations?: number;
}

export function runSimulationPasses(
  encoder: GPUCommandEncoder,
  bindGroup: GPUBindGroup,
  pipelines: SimulationPipelines,
  cfg: SimulationRunConfig
): void {
  const groups = Math.ceil(cfg.particleCount / cfg.workgroupSize);

  if (pipelines.gridClear && cfg.gridCellCount > 0) {
    const pass = encoder.beginComputePass();
    pass.setBindGroup(0, bindGroup);
    pass.setPipeline(pipelines.gridClear);
    const clearGroups = Math.ceil(cfg.gridCellCount / cfg.workgroupSize);
    if (clearGroups > 0) pass.dispatchWorkgroups(clearGroups);
    pass.end();
  }

  if (pipelines.gridBuild && cfg.particleCount > 0) {
    const pass = encoder.beginComputePass();
    pass.setBindGroup(0, bindGroup);
    pass.setPipeline(pipelines.gridBuild);
    const buildGroups = Math.ceil(cfg.particleCount / cfg.workgroupSize);
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
      const iterations = Math.max(1, cfg.constrainIterations ?? 1);
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

  if (pipelines.monolithic && groups > 0) {
    const simPass = encoder.beginComputePass();
    simPass.setBindGroup(0, bindGroup);
    simPass.setPipeline(pipelines.monolithic);
    simPass.dispatchWorkgroups(groups);
    simPass.end();
  }
}
