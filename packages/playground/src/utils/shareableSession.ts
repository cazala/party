import type { RootState } from "../slices/store";
import type { SessionData } from "../types/session";
import { SESSION_DATA_VERSION } from "../types/session";
import { modulesReducer } from "../slices/modules";
import { initReducer, selectInitState } from "../slices/init";
import { engineReducer } from "../slices/engine";
import { renderReducer } from "../slices/render";

const STABLE_TIME = "1970-01-01T00:00:00.000Z";

type ShareableSessionData = Omit<
  SessionData,
  "modules" | "init" | "engine" | "render"
> & {
  // Allow partial payloads to minimize URL size; loader will restore defaults.
  modules: Record<string, any>;
  init: Partial<SessionData["init"]>;
  engine: Partial<SessionData["engine"]>;
  render?: Partial<NonNullable<SessionData["render"]>>;
};

const DEFAULT_MODULES = modulesReducer(undefined, { type: "@@INIT" } as any);
const DEFAULT_INIT_SLICE = initReducer(undefined, { type: "@@INIT" } as any);
const DEFAULT_INIT = selectInitState({ init: DEFAULT_INIT_SLICE } as any);
const DEFAULT_ENGINE_SLICE = engineReducer(undefined, { type: "@@INIT" } as any);
const DEFAULT_ENGINE = {
  constrainIterations: DEFAULT_ENGINE_SLICE.constrainIterations,
  gridCellSize: DEFAULT_ENGINE_SLICE.gridCellSize,
  maxNeighbors: DEFAULT_ENGINE_SLICE.maxNeighbors,
  camera: DEFAULT_ENGINE_SLICE.camera,
  zoom: DEFAULT_ENGINE_SLICE.zoom,
} as const;
const DEFAULT_RENDER_SLICE = renderReducer(undefined, { type: "@@INIT" } as any);
const DEFAULT_RENDER = { invertColors: DEFAULT_RENDER_SLICE.invertColors } as const;

function diffToDefaults<T>(value: T, defaults: any): any | undefined {
  if (Object.is(value, defaults)) return undefined;
  if (value === null || value === undefined) return undefined;

  const t = typeof value;
  if (t !== "object") return value;

  if (Array.isArray(value)) {
    if (!Array.isArray(defaults)) return value;
    if (value.length !== defaults.length) return value;
    for (let i = 0; i < value.length; i++) {
      if (diffToDefaults(value[i], defaults[i]) !== undefined) return value;
    }
    return undefined;
  }

  const out: Record<string, any> = {};
  const obj = value as any;
  const def = defaults ?? {};
  for (const key of Object.keys(obj)) {
    const child = diffToDefaults(obj[key], def[key]);
    if (child !== undefined) out[key] = child;
  }
  return Object.keys(out).length ? out : undefined;
}

function buildEnabledModulesDiff(modules: RootState["modules"]): Record<string, any> {
  const out: Record<string, any> = {};
  for (const [name, moduleState] of Object.entries(modules as any)) {
    const enabled = !!moduleState && (moduleState as any).enabled === true;
    if (!enabled) continue;
    const defaults = (DEFAULT_MODULES as any)[name];
    const diff = diffToDefaults(moduleState, defaults);
    // Presence of the module key in the share URL implies "enabled".
    // Drop `enabled: true` to keep payload smaller.
    if (diff && typeof diff === "object" && "enabled" in diff) {
      delete (diff as any).enabled;
    }
    // IMPORTANT: keep the module entry even if it matches defaults (signals "enabled" for
    // modules whose default enabled=true). Loader treats missing module entries as disabled.
    out[name] = diff ?? {};
  }
  return out;
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
}): ShareableSessionData {
  const currentInit = selectInitState(state as any);
  const initDiff = diffToDefaults(currentInit, DEFAULT_INIT) ?? {};

  const currentEngine = {
    constrainIterations: state.engine.constrainIterations,
    gridCellSize: state.engine.gridCellSize,
    maxNeighbors: state.engine.maxNeighbors,
    camera: state.engine.camera,
    zoom: state.engine.zoom,
  };
  const engineDiff = diffToDefaults(currentEngine, DEFAULT_ENGINE) ?? {};

  const currentRender = (state as any).render ?? DEFAULT_RENDER_SLICE;
  const renderDiff = diffToDefaults(
    { invertColors: !!currentRender.invertColors },
    DEFAULT_RENDER
  );

  return {
    version: SESSION_DATA_VERSION,
    id: "share",
    name: "Shared session",
    metadata: {
      particleCount,
      createdAt: STABLE_TIME,
      lastModified: STABLE_TIME,
      hasParticleData: false,
    },
    modules: buildEnabledModulesDiff(state.modules),
    init: initDiff,
    engine: engineDiff,
    ...(renderDiff ? { render: renderDiff } : {}),
    oscillators: state.oscillators,
  };
}

