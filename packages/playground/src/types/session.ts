import { ModulesState } from "../slices/modules";
import { InitState } from "../slices/init";
import { EngineState } from "../slices/engine";
import { OscillatorsState } from "../slices/oscillators";

export interface SessionMetadata {
  particleCount: number;
  createdAt: string;
  lastModified: string;
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
  oscillators: OscillatorsState;
  // New: time base for oscillator manager
  oscillatorsElapsedSeconds?: number;
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
