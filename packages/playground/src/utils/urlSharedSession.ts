import type { SessionData } from "../types/session";
import {
  decodePlaySessionParam,
  parseCurrentPlayRoute,
} from "./playUrl";

type Parsed =
  | { kind: "none" }
  | { kind: "data"; data: SessionData }
  | { kind: "error"; error: unknown };

let parsedOnce: Parsed | null = null;
let consumed = false;

function parseOnce(): Parsed {
  if (parsedOnce) return parsedOnce;

  try {
    const route = parseCurrentPlayRoute();
    if (!(route.kind === "play" && route.hasSession)) {
      parsedOnce = { kind: "none" };
      return parsedOnce;
    }

    const json = decodePlaySessionParam(route.sessionParam);
    const data = JSON.parse(json) as SessionData;
    parsedOnce = { kind: "data", data };
    return parsedOnce;
  } catch (error) {
    parsedOnce = { kind: "error", error };
    return parsedOnce;
  }
}

/**
 * True if the app was opened with a /play/:session URL.
 * This is computed once and does not react to later URL edits.
 */
export function openedWithSharedSessionUrl(): boolean {
  const p = parseOnce();
  return p.kind === "data" || p.kind === "error";
}

/**
 * Consume the shared session payload exactly once.
 * Later URL edits are ignored by design.
 */
export function consumeSharedSessionFromUrlOnce():
  | { kind: "none" }
  | { kind: "data"; data: SessionData }
  | { kind: "error"; error: unknown } {
  if (consumed) return { kind: "none" };
  consumed = true;
  return parseOnce();
}

