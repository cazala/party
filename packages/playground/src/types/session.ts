import { Config } from "@party/core";

export interface SerializedParticle {
  id: number;
  position: { x: number; y: number };
  velocity: { x: number; y: number };
  acceleration: { x: number; y: number };
  mass: number;
  size: number;
  color: string;
  pinned?: boolean;
}

export interface SavedSession {
  name: string;
  timestamp: number;
  config: Config;
  particles: SerializedParticle[];
  camera: {
    x: number;
    y: number;
    zoom: number;
  };
  metadata: {
    particleCount: number;
    version: string;
  };
}

export interface SessionMetadata {
  name: string;
  timestamp: number;
  particleCount: number;
  camera: {
    x: number;
    y: number;
    zoom: number;
  };
}
