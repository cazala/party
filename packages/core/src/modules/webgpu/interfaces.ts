export interface IEngine {
  initialize(): Promise<void>;
  play(): void;
  pause(): void;
  toggle(): void;
  destroy(): void;
  getSize(): { width: number; height: number };
  setSize(width: number, height: number): void;
  setCamera(x: number, y: number): void;
  getCamera(): { x: number; y: number };
  setZoom(z: number): void;
  getZoom(): number;
  addParticle(p: WebGPUParticle): void;
  setParticles(p: WebGPUParticle[]): void;
  getParticles(): WebGPUParticle[];
  getParticle(index: number): WebGPUParticle;
  clear(): void;
  getCount(): number;
  getFPS(): number;
}

export type WebGPUParticle = {
  position: { x: number; y: number };
  velocity: { x: number; y: number };
  size: number;
  mass: number;
  color: {
    r: number;
    g: number;
    b: number;
    a: number;
  };
};
