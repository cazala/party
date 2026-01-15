import type { ModulesState } from "../../slices/modules";
import type { InitState } from "../../slices/init";
import type { EngineState } from "../../slices/engine";
import type { OscillatorsState } from "../../slices/oscillators";
import type { RenderState } from "../../slices/render";
import type { SessionDataVersion } from "./version";

// NOTE: v1 sessions in the wild may not include `version`.
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

export interface SessionDataV1 {
  /**
   * Session schema version.
   *
   * Notes:
   * - Older sessions may omit this field; we treat missing as v1.
   * - After migration, the latest `SessionData` always includes it.
   */
  version?: SessionDataVersion;
  id: string;
  name: string;
  metadata: SessionMetadata;
  // Saved sessions are forward/backward compatible: each module's payload can be partial
  // so older sessions can omit newly-added fields.
  modules: { [K in keyof ModulesState]: Partial<ModulesState[K]> };
  init: InitState;
  engine: Pick<
    EngineState,
    "constrainIterations" | "gridCellSize" | "maxNeighbors" | "camera" | "zoom"
  >;
  render?: RenderState;
  oscillators: OscillatorsState;
  oscillatorsElapsedSeconds?: number;
  particles?: SavedParticle[];
  /**
   * Optional aspect ratio captured when generating a shareable session URL.
   * Used to preserve scene framing across different device viewports.
   */
  sceneAspectRatio?: number;
}

