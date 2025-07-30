import { Config } from "@cazala/party";

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

export interface SerializedJoint {
  id: string;
  particleAId: number;
  particleBId: number;
  restLength: number;
  stiffness: number;
  tolerance: number;
  isBroken: boolean;
}

export interface SavedSession {
  name: string;
  timestamp: number;
  config: Config;
  particles: SerializedParticle[];
  joints: SerializedJoint[];
  camera: {
    x: number;
    y: number;
    zoom: number;
  };
  metadata: {
    particleCount: number;
    jointCount: number;
    version: string;
  };
}

export interface SessionMetadata {
  name: string;
  timestamp: number;
  particleCount: number;
  jointCount: number;
  camera: {
    x: number;
    y: number;
    zoom: number;
  };
}
