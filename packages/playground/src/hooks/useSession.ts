import { useCallback } from "react";
import { useAppDispatch } from "./useAppDispatch";
import { useAppSelector } from "./useAppSelector";
import { useEngine } from "./useEngine";
import {
  saveCurrentSessionThunk,
  loadSessionThunk,
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
import { SessionSaveRequest } from "../types/session";

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
    deleteSession,
    renameSession,
    duplicateSession,
    refreshSessions,
    clearErrors,
    reorderSessionsList,
  };
}
