import { ModulesState } from "../slices/modules";
import { InitState } from "../slices/init";
import { EngineState } from "../slices/engine";
import { OscillatorsState } from "../slices/oscillators";
import { RenderState } from "../slices/render";

// Particle data interface matching engine's IParticle
export interface SavedParticle {
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

export interface SessionMetadata {
  particleCount: number;
  createdAt: string;
  lastModified: string;
  hasParticleData?: boolean;
}

export interface SessionData {
  id: string;
  name: string;
  metadata: SessionMetadata;
  // Core simulation state
  modules: ModulesState;
  init: InitState;
  engine: Pick<
    EngineState,
    "constrainIterations" | "gridCellSize" | "maxNeighbors" | "camera" | "zoom"
  >;
  render: RenderState;
  oscillators: OscillatorsState;
  oscillatorsElapsedSeconds?: number;
  particles?: SavedParticle[];
}

export interface SessionSaveRequest {
  name: string;
  particleCount: number;
}

export interface SessionListItem {
  id: string;
  name: string;
  metadata: SessionMetadata;
}
