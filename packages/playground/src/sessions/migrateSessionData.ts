import { SESSION_DATA_VERSION } from "./versions";
import type { AnySessionData, SessionData } from "./versions";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function detectVersion(data: Record<string, unknown>): number {
  const v = (data as any).version;
  // Versionless sessions exist in the wild; treat as v1.
  if (v === undefined || v === null) return 1;
  return typeof v === "number" ? v : NaN;
}

/**
 * Migrate a deserialized session payload (any version) to the latest `SessionData`.
 *
 * Current state:
 * - v1 is the latest
 * - "missing version" is treated as v1
 *
 * Future:
 * - Add `versions/v2.ts` exporting `migrateToV2(session: SessionDataV1): SessionDataV2`
 * - Update `versions/index.ts` to set `SessionData = SessionDataV2` and include v2 in `AnySessionData`
 * - Add a `case 1: return migrateToV2(obj)` below
 */
export function migrateSessionDataToLatest(input: unknown): SessionData {
  if (!isRecord(input)) {
    throw new Error("Invalid session payload: expected an object");
  }

  const v = detectVersion(input);
  if (!Number.isFinite(v)) {
    throw new Error("Invalid session payload: version must be a number");
  }

  const obj = input as unknown as AnySessionData;

  switch (v) {
    case 1:
      // v1 is the current/latest schema; normalize missing version to the current value.
      return { ...(obj as any), version: SESSION_DATA_VERSION } as SessionData;
    default:
      throw new Error(`Unsupported session version ${v}`);
  }
}

