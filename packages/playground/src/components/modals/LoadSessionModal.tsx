import React, { useState, useEffect } from "react";
import {
  SpatialGrid,
  Boundary,
  Canvas2DRenderer,
  System,
} from "@cazala/party/legacy";
import { SessionManager } from "../../utils/SessionManager";
import { SessionMetadata } from "../../types/session";
import { UseUndoRedoReturn } from "../../hooks/useUndoRedo";
import { SystemControlsRef } from "../SystemControls";
import { ForcesControlsRef } from "../ForcesControls";
import "./Modal.css";

interface LoadSessionModalProps {
  isOpen: boolean;
  onClose: () => void;
  system: System | null;
  renderer?: Canvas2DRenderer;
  boundary?: Boundary;
  spatialGrid?: SpatialGrid;
  zoomStateRef?: any;
  undoRedo?: UseUndoRedoReturn;
  systemControlsRef?: React.RefObject<SystemControlsRef>;
  forcesControlsRef?: React.RefObject<ForcesControlsRef>;
  onLoadSuccess?: (sessionName: string) => void;
}

export function LoadSessionModal({
  isOpen,
  onClose,
  system,
  renderer,
  boundary,
  spatialGrid,
  zoomStateRef,
  undoRedo,
  systemControlsRef,
  forcesControlsRef,
  onLoadSuccess,
}: LoadSessionModalProps) {
  const [sessions, setSessions] = useState<SessionMetadata[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [editingSession, setEditingSession] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [wasPlayingBeforeModal, setWasPlayingBeforeModal] = useState(false);

  // Load sessions when modal opens
  useEffect(() => {
    if (isOpen) {
      loadSessions();
      setError("");
      setDeleteConfirm(null);
      setEditingSession(null);
      setEditName("");

      // Pause system when modal opens
      if (system) {
        setWasPlayingBeforeModal(system.isPlaying);
        system.pause();
      }
    } else if (system) {
      // Resume system when modal closes if it was playing before
      if (wasPlayingBeforeModal) {
        system.play();
      }
    }
  }, [isOpen, system]);

  // Close modal on Escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen && !isLoading) {
        if (deleteConfirm) {
          setDeleteConfirm(null);
        } else if (editingSession) {
          setEditingSession(null);
          setEditName("");
        } else {
          onClose();
        }
      }
    };

    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
      return () => document.removeEventListener("keydown", handleEscape);
    }
  }, [isOpen, isLoading, deleteConfirm, editingSession, onClose]);

  const loadSessions = () => {
    try {
      const metadata = SessionManager.getSessionMetadata();
      setSessions(metadata.sort((a, b) => b.timestamp - a.timestamp)); // Most recent first
    } catch (error) {
      setError("Failed to load sessions");
      console.error("Error loading sessions:", error);
    }
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget && !isLoading) {
      if (deleteConfirm) {
        setDeleteConfirm(null);
      } else {
        onClose();
      }
    }
  };

  const handleLoadSession = async (sessionName: string) => {
    if (!system) {
      setError("No system available to load into");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      const result = SessionManager.loadSession(
        system,
        sessionName,
        renderer,
        boundary,
        spatialGrid,
        zoomStateRef,
        undoRedo,
        (systemControls) => {
          // Restore system controls state if available
          if (systemControls && systemControlsRef?.current) {
            systemControlsRef.current.setSystemControlsState(systemControls);
          }

          // Restore collision controls state if available
          if (systemControls?.collisionControls && forcesControlsRef?.current) {
            forcesControlsRef.current.setCollisionControlsState(
              systemControls.collisionControls
            );
          }
        }
      );

      if (result.success) {
        onLoadSuccess?.(sessionName);
        onClose();
      } else {
        setError(result.error || "Failed to load session");
      }
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Unknown error occurred"
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteSession = async (sessionName: string) => {
    setIsLoading(true);
    setError("");

    try {
      const result = SessionManager.deleteSession(sessionName);

      if (result.success) {
        setDeleteConfirm(null);
        loadSessions(); // Refresh the list
      } else {
        setError(result.error || "Failed to delete session");
      }
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Unknown error occurred"
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleStartRename = (sessionName: string) => {
    setEditingSession(sessionName);
    setEditName(sessionName);
    setDeleteConfirm(null); // Clear any delete confirmation
  };

  const handleCancelRename = () => {
    setEditingSession(null);
    setEditName("");
    setError("");
  };

  const handleConfirmRename = async () => {
    if (!editingSession) return;

    const trimmedName = editName.trim();

    // Validation
    if (!trimmedName) {
      setError("Session name is required");
      return;
    }

    if (trimmedName.length < 2) {
      setError("Session name must be at least 2 characters");
      return;
    }

    if (trimmedName.length > 50) {
      setError("Session name must be 50 characters or less");
      return;
    }

    if (!/^[a-zA-Z0-9\s\-_]+$/.test(trimmedName)) {
      setError(
        "Session name can only contain letters, numbers, spaces, hyphens, and underscores"
      );
      return;
    }

    if (
      trimmedName !== editingSession &&
      SessionManager.sessionExists(trimmedName)
    ) {
      setError("A session with this name already exists");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      const result = SessionManager.renameSession(editingSession, trimmedName);

      if (result.success) {
        setEditingSession(null);
        setEditName("");
        loadSessions(); // Refresh the list
      } else {
        setError(result.error || "Failed to rename session");
      }
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Unknown error occurred"
      );
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInHours =
      Math.abs(now.getTime() - date.getTime()) / (1000 * 60 * 60);

    if (diffInHours < 1) {
      const minutes = Math.floor(diffInHours * 60);
      return `${minutes} minute${minutes !== 1 ? "s" : ""} ago`;
    } else if (diffInHours < 24) {
      const hours = Math.floor(diffInHours);
      return `${hours} hour${hours !== 1 ? "s" : ""} ago`;
    } else if (diffInHours < 168) {
      // 7 days
      const days = Math.floor(diffInHours / 24);
      return `${days} day${days !== 1 ? "s" : ""} ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  if (!isOpen) return null;

  const storageInfo = SessionManager.getStorageInfo();

  return (
    <div className="modal-backdrop" onClick={handleBackdropClick}>
      <div className="modal-content">
        <div className="modal-header">
          <h2 className="modal-title">Load Session</h2>
        </div>

        <div className="modal-body">
          {sessions.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">💾</div>
              <div className="empty-state-text">No saved sessions</div>
              <div className="empty-state-subtext">
                Save your current playground state to load it later
              </div>
            </div>
          ) : (
            <div className="session-list">
              {sessions.map((session) => (
                <div
                  key={session.name}
                  className={`session-item ${
                    editingSession === session.name
                      ? "session-item-editing"
                      : ""
                  } ${
                    deleteConfirm === session.name
                      ? "session-item-confirming"
                      : ""
                  }`}
                >
                  <div className="session-info">
                    {editingSession === session.name ? (
                      <>
                        <input
                          type="text"
                          className="session-edit-input"
                          value={editName}
                          onChange={(e) => {
                            setEditName(e.target.value);
                            if (error) setError("");
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              handleConfirmRename();
                            } else if (e.key === "Escape") {
                              handleCancelRename();
                            }
                          }}
                          autoFocus
                          disabled={isLoading}
                        />
                      </>
                    ) : (
                      <>
                        <div className="session-name">{session.name}</div>
                        <div className="session-meta">
                          {session.particleCount} particles •{" "}
                          {formatDate(session.timestamp)}
                        </div>
                      </>
                    )}
                  </div>

                  {deleteConfirm === session.name ? (
                    <div className="session-actions">
                      <button
                        className="session-button session-button-cancel"
                        onClick={() => setDeleteConfirm(null)}
                        disabled={isLoading}
                      >
                        No
                      </button>
                      <button
                        className="session-button session-button-confirm-delete"
                        onClick={() => handleDeleteSession(session.name)}
                        disabled={isLoading}
                      >
                        {isLoading ? "Deleting..." : "Yes"}
                      </button>
                    </div>
                  ) : editingSession === session.name ? (
                    <div className="session-edit-actions">
                      <button
                        className="session-edit-button cancel"
                        onClick={handleCancelRename}
                        disabled={isLoading}
                      >
                        Cancel
                      </button>
                      <button
                        className="session-edit-button"
                        onClick={handleConfirmRename}
                        disabled={isLoading || !editName.trim()}
                      >
                        {isLoading ? "Saving..." : "Save"}
                      </button>
                    </div>
                  ) : (
                    <div className="session-actions">
                      <button
                        className="session-button session-button-load"
                        onClick={() => handleLoadSession(session.name)}
                        disabled={isLoading}
                      >
                        Load
                      </button>
                      <button
                        className="session-button session-button-rename"
                        onClick={() => handleStartRename(session.name)}
                        disabled={isLoading}
                      >
                        Rename
                      </button>
                      <button
                        className="session-button session-button-delete"
                        onClick={() => setDeleteConfirm(session.name)}
                        disabled={isLoading}
                      >
                        Delete
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="modal-footer">
          <div className="modal-footer-info">
            {error ? (
              <div className="modal-error">{error}</div>
            ) : (
              <div
                className={`modal-storage-info ${
                  storageInfo.isNearLimit ? "warning" : ""
                }`}
              >
                {storageInfo.sessionCount} session
                {storageInfo.sessionCount !== 1 ? "s" : ""} •{" "}
                {storageInfo.estimatedSize} used
                {storageInfo.isNearLimit && " • Storage space running low"}
              </div>
            )}
          </div>
          <button
            type="button"
            className="modal-button modal-button-secondary"
            onClick={onClose}
            disabled={isLoading}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
