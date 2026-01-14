export { SESSION_DATA_VERSION } from "./version";
export type { SessionDataVersion } from "./version";

export type { SavedParticle, SessionMetadata, SessionDataV1 } from "./v1";

// Current/latest schema exports.
// When v2 is introduced:
// - add `v2.ts`
// - change `SessionData` to `SessionDataV2`
export type SessionData = Omit<import("./v1").SessionDataV1, "version"> & {
  version: import("./version").SessionDataVersion;
};

// Union of all versions we can deserialize/migrate from.
export type AnySessionData = import("./v1").SessionDataV1;

