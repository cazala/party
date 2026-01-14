export {
  SESSION_DATA_VERSION,
} from "../sessions/versions";
export type {
  SessionDataVersion,
  SavedParticle,
  SessionMetadata,
  SessionDataV1,
  SessionData,
} from "../sessions/versions";

import type { SessionMetadata } from "../sessions/versions";

export interface SessionSaveRequest {
  name: string;
  particleCount: number;
}

export interface SessionListItem {
  id: string;
  name: string;
  metadata: SessionMetadata;
}
