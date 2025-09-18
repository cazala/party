export class PipelineCache {
  private computePipelines = new Map<string, GPUComputePipeline>();
  private renderPipelines = new Map<string, GPURenderPipeline>();

  getOrCreateCompute(
    key: string,
    create: () => GPUComputePipeline
  ): GPUComputePipeline {
    const existing = this.computePipelines.get(key);
    if (existing) return existing;
    const pipeline = create();
    this.computePipelines.set(key, pipeline);
    return pipeline;
  }

  getOrCreateRender(
    key: string,
    create: () => GPURenderPipeline
  ): GPURenderPipeline {
    const existing = this.renderPipelines.get(key);
    if (existing) return existing;
    const pipeline = create();
    this.renderPipelines.set(key, pipeline);
    return pipeline;
  }

  clear(): void {
    this.computePipelines.clear();
    this.renderPipelines.clear();
  }
}
