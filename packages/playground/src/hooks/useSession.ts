import { useCallback } from "react";
import { useAppDispatch } from "./useAppDispatch";
import { useAppSelector } from "./useAppSelector";
import { useEngine } from "./useEngine";
import {
  saveCurrentSessionThunk,
  loadSessionThunk,
  quickLoadSessionThunk,
  loadSessionDataThunk,
  loadAvailableSessionsThunk,
  deleteSessionThunk,
  renameSessionThunk,
  duplicateSessionThunk,
  clearSaveError,
  clearLoadError,
  selectCurrentSessionName,
  selectIsSaving,
  selectIsLoading,
  selectSaveError,
  selectLoadError,
  selectAvailableSessions,
  selectLastSessionName,
  selectOrderedSessions,
  selectStorageInfo,
  reorderSessions,
} from "../slices/session";
import {
  spawnParticlesThunk,
  setParticlesThunk,
  getEngine,
} from "../slices/engine";
import { SessionSaveRequest, SessionData } from "../types/session";
import {
  loadSession as loadSessionFromStorage,
  saveSession as saveSessionToStorage,
  generateSessionId,
} from "../utils/sessionManager";
import {
  toSnakeCase,
  isValidSessionData,
  downloadJsonFile,
  readJsonFile,
} from "../utils/importExportUtils";

export function useSession() {
  const dispatch = useAppDispatch();
  const { getCount, pause, play } = useEngine();

  // Session state
  const currentSessionName = useAppSelector(selectCurrentSessionName);
  const lastSessionName = useAppSelector(selectLastSessionName);
  const isSaving = useAppSelector(selectIsSaving);
  const isLoading = useAppSelector(selectIsLoading);
  const saveError = useAppSelector(selectSaveError);
  const loadError = useAppSelector(selectLoadError);
  const availableSessions = useAppSelector(selectAvailableSessions);
  const orderedSessions = useAppSelector(selectOrderedSessions);
  const storageInfo = useAppSelector(selectStorageInfo);

  // Save current session
  const saveCurrentSession = useCallback(
    async (name: string): Promise<boolean> => {
      // Pause the engine during save to prevent oscillators from moving
      const wasPlaying = getEngine()?.isPlaying();

      try {
        if (wasPlaying) {
          pause();
        }

        const particleCount = getCount();
        const request: SessionSaveRequest = { name, particleCount };

        await dispatch(saveCurrentSessionThunk(request)).unwrap();

        // Resume if it was playing before
        if (wasPlaying) {
          play();
        }

        return true;
      } catch (error) {
        console.error("Failed to save session:", error);
        // Resume if there was an error and it was playing before
        if (wasPlaying) {
          play();
        }
        return false;
      }
    },
    [dispatch, getCount, pause, play]
  );

  // Load session from provided data and restart simulation
  const loadSessionData = useCallback(
    async (data: SessionData): Promise<boolean> => {
      try {
        // Pause the engine during loading
        pause();

        // Apply the session state
        const sessionData = await dispatch(loadSessionDataThunk(data)).unwrap();

        // Choose how to restore particles based on session data
        if (
          sessionData.metadata.hasParticleData === true &&
          sessionData.particles
        ) {
          // Restore exact particles (for sessions with ≤1000 particles)
          await dispatch(
            setParticlesThunk({
              particles: sessionData.particles,
              jointsToRestore: sessionData.modules.joints,
              linesToRestore: sessionData.modules.lines,
            })
          ).unwrap();
        } else {
          // Restart simulation with the loaded init configuration
          await dispatch(spawnParticlesThunk(sessionData.init)).unwrap();
        }

        // Resume the engine
        play();

        return true;
      } catch (error) {
        console.error("Failed to load session data:", error);
        // Resume engine even if loading failed
        play();
        return false;
      }
    },
    [dispatch, pause, play]
  );

  // Load session and restart simulation
  const loadSession = useCallback(
    async (sessionId: string): Promise<boolean> => {
      try {
        // Pause the engine during loading
        pause();

        // Load the session state
        const sessionData = await dispatch(
          loadSessionThunk(sessionId)
        ).unwrap();

        // Choose how to restore particles based on session data
        if (
          sessionData.metadata.hasParticleData === true &&
          sessionData.particles
        ) {
          // Restore exact particles (for sessions with ≤1000 particles)
          await dispatch(
            setParticlesThunk({
              particles: sessionData.particles,
              jointsToRestore: sessionData.modules.joints,
              linesToRestore: sessionData.modules.lines,
            })
          ).unwrap();
        } else {
          // Restart simulation with the loaded init configuration
          // (for sessions with >1000 particles or old sessions without particle data)
          await dispatch(spawnParticlesThunk(sessionData.init)).unwrap();
        }

        // Resume the engine
        play();

        return true;
      } catch (error) {
        console.error("Failed to load session:", error);
        // Resume engine even if loading failed
        play();
        return false;
      }
    },
    [dispatch, pause, play]
  );

  // Quick load session without affecting particles/joints
  const quickLoadSession = useCallback(
    async (sessionId: string): Promise<boolean> => {
      try {
        // Pause the engine during loading
        pause();

        // Load the session state (without particles and joints)
        await dispatch(quickLoadSessionThunk(sessionId)).unwrap();

        // Resume the engine
        play();

        return true;
      } catch (error) {
        console.error("Failed to quick load session:", error);
        // Resume engine even if loading failed
        play();
        return false;
      }
    },
    [dispatch, pause, play]
  );

  // Delete session
  const deleteSession = useCallback(
    async (sessionId: string): Promise<boolean> => {
      try {
        await dispatch(deleteSessionThunk(sessionId)).unwrap();
        return true;
      } catch (error) {
        console.error("Failed to delete session:", error);
        return false;
      }
    },
    [dispatch]
  );

  // Refresh available sessions
  const refreshSessions = useCallback(() => {
    dispatch(loadAvailableSessionsThunk());
  }, [dispatch]);

  // Clear errors
  const clearErrors = useCallback(() => {
    if (saveError) dispatch(clearSaveError());
    if (loadError) dispatch(clearLoadError());
  }, [dispatch, saveError, loadError]);

  // Reorder sessions
  const reorderSessionsList = useCallback(
    (newOrder: string[]) => {
      dispatch(reorderSessions(newOrder));
    },
    [dispatch]
  );

  // Rename session
  const renameSession = useCallback(
    async (sessionId: string, newName: string): Promise<boolean> => {
      try {
        await dispatch(renameSessionThunk({ sessionId, newName })).unwrap();
        return true;
      } catch (error) {
        console.error("Failed to rename session:", error);
        return false;
      }
    },
    [dispatch]
  );

  // Duplicate session
  const duplicateSession = useCallback(
    async (sessionId: string): Promise<boolean> => {
      try {
        const newSessionId = await dispatch(
          duplicateSessionThunk(sessionId)
        ).unwrap();
        // Refresh the sessions list to include the new duplicate
        await dispatch(loadAvailableSessionsThunk()).unwrap();

        // Insert the new session right after the original in the custom order
        const currentOrder = [...orderedSessions.map((s) => s.id)];
        const originalIndex = currentOrder.indexOf(sessionId);

        if (originalIndex !== -1) {
          // Insert the new session right after the original
          currentOrder.splice(originalIndex + 1, 0, newSessionId);
          dispatch(reorderSessions(currentOrder));
        }

        return true;
      } catch (error) {
        console.error("Failed to duplicate session:", error);
        return false;
      }
    },
    [dispatch, orderedSessions]
  );

  // Export session to JSON file
  const exportSession = useCallback(
    async (sessionId: string): Promise<boolean> => {
      try {
        // Load the complete session data from storage
        const sessionData = loadSessionFromStorage(sessionId);
        if (!sessionData) {
          console.error("Session not found for export:", sessionId);
          return false;
        }

        // Generate filename from session name
        const filename = toSnakeCase(sessionData.name);

        // Download as JSON file
        downloadJsonFile(sessionData, filename);

        return true;
      } catch (error) {
        console.error("Failed to export session:", error);
        return false;
      }
    },
    []
  );

  // Import session from JSON file
  const importSession = useCallback(
    async (file: File): Promise<{ success: boolean; error?: string }> => {
      try {
        // Read and parse the JSON file
        const data = await readJsonFile(file);

        // Validate the session data structure
        if (!isValidSessionData(data)) {
          return {
            success: false,
            error:
              "Invalid session file format. Please ensure you're importing a valid session file.",
          };
        }

        // Generate a new unique ID for the imported session
        const newSessionId = generateSessionId(data.name);
        const now = new Date().toISOString();

        // Create new session data with updated metadata
        const importedSessionData: SessionData = {
          ...data,
          id: newSessionId,
          metadata: {
            ...data.metadata,
            createdAt: now,
            lastModified: now,
          },
        };

        // Save the imported session
        saveSessionToStorage(importedSessionData);

        // Refresh the sessions list
        await dispatch(loadAvailableSessionsThunk()).unwrap();

        return { success: true };
      } catch (error) {
        console.error("Failed to import session:", error);
        return {
          success: false,
          error:
            error instanceof Error
              ? error.message
              : "Failed to import session file",
        };
      }
    },
    [dispatch]
  );

  return {
    // State
    currentSessionName,
    lastSessionName,
    isSaving,
    isLoading,
    saveError,
    loadError,
    availableSessions,
    orderedSessions,
    storageInfo,

    // Actions
    saveCurrentSession,
    loadSession,
    quickLoadSession,
    deleteSession,
    renameSession,
    duplicateSession,
    loadSessionData,
    exportSession,
    importSession,
    refreshSessions,
    clearErrors,
    reorderSessionsList,
  };
}
