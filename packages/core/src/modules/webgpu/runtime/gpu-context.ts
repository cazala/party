export interface GPUContextInfo {
  device: GPUDevice;
  context: GPUCanvasContext;
  format: GPUTextureFormat;
}

export function getSwapChainFormat(
  context: GPUCanvasContext
): GPUTextureFormat {
  // Default browser-preferred format
  return navigator.gpu.getPreferredCanvasFormat();
}
