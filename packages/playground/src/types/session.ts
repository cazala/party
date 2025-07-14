import { Config } from "@party/core";

export interface SerializedParticle {
  id: number;
  position: { x: number; y: number };
  velocity: { x: number; y: number };
  acceleration: { x: number; y: number };
  mass: number;
  size: number;
  color: string;
}

export interface SavedSession {
  name: string;
  timestamp: number;
  config: Config;
  particles: SerializedParticle[];
  metadata: {
    particleCount: number;
    version: string;
  };
}

export interface SessionMetadata {
  name: string;
  timestamp: number;
  particleCount: number;
}