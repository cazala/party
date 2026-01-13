import type { RootState } from "../slices/store";
import type { SessionData } from "../types/session";

const STABLE_TIME = "1970-01-01T00:00:00.000Z";

function pickEnabledModules(modules: RootState["modules"]): SessionData["modules"] {
  const enabledEntries = Object.entries(modules).filter(([, m]) => {
    return !!m && typeof (m as any).enabled === "boolean" && (m as any).enabled;
  });
  return Object.fromEntries(enabledEntries) as SessionData["modules"];
}

/**
 * Build a SessionData payload for embedding in the URL.
 *
 * Notes:
 * - Uses stable metadata fields to avoid time-driven URL churn.
 * - Includes ONLY enabled modules to minimize URL size.
 * - Does not include particle data (URL size constraints).
 */
export function buildShareableSessionData({
  state,
  particleCount,
}: {
  state: RootState;
  particleCount: number;
}): SessionData {
  return {
    id: "share",
    name: "Shared session",
    metadata: {
      particleCount,
      createdAt: STABLE_TIME,
      lastModified: STABLE_TIME,
      hasParticleData: false,
    },
    modules: pickEnabledModules(state.modules),
    init: state.init,
    engine: {
      constrainIterations: state.engine.constrainIterations,
      gridCellSize: state.engine.gridCellSize,
      maxNeighbors: state.engine.maxNeighbors,
      camera: state.engine.camera,
      zoom: state.engine.zoom,
    },
    render: (state as any).render,
    oscillators: state.oscillators,
  };
}

