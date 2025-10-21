import { useCallback } from "react";
import { useAppDispatch } from "./useAppDispatch";
import { useAppSelector } from "./useAppSelector";
import { useEngine } from "./useEngine";
import {
  saveCurrentSessionThunk,
  loadSessionThunk,
  loadAvailableSessionsThunk,
  deleteSessionThunk,
  clearSaveError,
  clearLoadError,
  selectCurrentSessionName,
  selectIsSaving,
  selectIsLoading,
  selectSaveError,
  selectLoadError,
  selectAvailableSessions,
} from "../slices/session";
import { spawnParticlesThunk, getEngine } from "../slices/engine";
import { SessionSaveRequest } from "../types/session";

export function useSession() {
  const dispatch = useAppDispatch();
  const { getCount, pause, play } = useEngine();

  // Session state
  const currentSessionName = useAppSelector(selectCurrentSessionName);
  const isSaving = useAppSelector(selectIsSaving);
  const isLoading = useAppSelector(selectIsLoading);
  const saveError = useAppSelector(selectSaveError);
  const loadError = useAppSelector(selectLoadError);
  const availableSessions = useAppSelector(selectAvailableSessions);

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

        // Restart simulation with the loaded init configuration
        await dispatch(spawnParticlesThunk(sessionData.init)).unwrap();

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

  return {
    // State
    currentSessionName,
    isSaving,
    isLoading,
    saveError,
    loadError,
    availableSessions,

    // Actions
    saveCurrentSession,
    loadSession,
    deleteSession,
    refreshSessions,
    clearErrors,
  };
}
