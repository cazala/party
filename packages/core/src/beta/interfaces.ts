export interface IEngine {
  initialize(): Promise<void>;
  play(): void;
  pause(): void;
  toggle(): void;
  isPlaying(): boolean;
  destroy(): void;
  getSize(): { width: number; height: number };
  setSize(width: number, height: number): void;
  setCamera(x: number, y: number): void;
  getCamera(): { x: number; y: number };
  setZoom(z: number): void;
  getZoom(): number;
  addParticle(p: IParticle): void;
  setParticles(p: IParticle[]): void;
  getParticles(): Promise<IParticle[]>;
  getParticle(index: number): Promise<IParticle>;
  clear(): void;
  getCount(): number;
  getFPS(): number;
}

export interface IParticle {
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
}
