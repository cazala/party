// Centralized version constants for session schema.
// When adding a new version, update these and add a new `vN.ts` file.

export const SESSION_DATA_VERSION = 1 as const;
export type SessionDataVersion = typeof SESSION_DATA_VERSION;

